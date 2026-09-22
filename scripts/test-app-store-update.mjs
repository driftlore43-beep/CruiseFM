// The "go update from the App Store" card — owner, 19.08: "some app require
// you to go to the App Store and update from there". Transpiles the SHIPPED
// module against a fake AsyncStorage and a fake fetch, so it tests the real
// caching, dismissal and version-compare logic rather than a lookalike.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/appStoreUpdate.ts';
const VERSION_SRC = '/home/user/CruiseFM/src/utils/appVersion.ts';

const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

/**
 * The REAL utils/appVersion, not a stub of it. It owns `isNewer` now, and a
 * stub carrying its own copy of that comparison is precisely how a test ends
 * up passing against arithmetic the app does not ship.
 *
 * `nativeVersion` stands in for the binary's own CFBundleShortVersionString;
 * null is the case that matters most, since it is what web and any build
 * without expo-application report, and the rule is that unknown means no.
 */
function loadAppVersion({ installed = '1.3.0', nativeVersion = null } = {}) {
  const mod = { exports: {} };
  const req = (name) => {
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { version: installed } } };
    if (name === 'expo-application') return { nativeApplicationVersion: nativeVersion };
    throw new Error('unstubbed ' + name);
  };
  new Function('module', 'exports', 'require', compile(VERSION_SRC))(mod, mod.exports, req);
  return mod.exports;
}

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};

function load({ installed, storeVersion, netFails = false }) {
  const js = compile(SRC);

  const disk = new Map();
  const storage = {
    getItem: async (k) => (disk.has(k) ? disk.get(k) : null),
    setItem: async (k, v) => { disk.set(k, v); },
  };

  let fetchCalls = 0;
  const fakeFetch = async () => {
    fetchCalls++;
    if (netFails) throw new Error('offline');
    return { ok: true, json: async () => ({ results: [{ version: storeVersion }] }) };
  };

  const mod = { exports: {} };
  const req = (name) => {
    if (name === '@react-native-async-storage/async-storage') return storage;
    if (name === '@/utils/appVersion') return loadAppVersion({ installed });
    return new Proxy({}, { get: () => () => {} });
  };
  const fn = new Function('module', 'exports', 'require', 'fetch', 'AbortController', js);
  fn(mod, mod.exports, req, fakeFetch, globalThis.AbortController);
  return { mod: mod.exports, disk, callCount: () => fetchCalls };
}

console.log('\n  isNewer — segment-by-segment, not string order:');
{
  const { isNewer } = loadAppVersion();
  check('1.3.1 > 1.3.0', isNewer('1.3.1', '1.3.0'), true);
  check('1.3.0 > 1.3.0 — no', isNewer('1.3.0', '1.3.0'), false);
  check('1.2.9 > 1.3.0 — no', isNewer('1.2.9', '1.3.0'), false);
  check('1.3.10 > 1.3.9 (string order would say no)', isNewer('1.3.10', '1.3.9'), true);
  check('2.0.0 > 1.9.9', isNewer('2.0.0', '1.9.9'), true);
  check('missing patch segment counts as 0: 1.4 > 1.3.9', isNewer('1.4', '1.3.9'), true);
}

// The other half of the same question, and the one a release note leans on:
// not "is the store ahead of me" but "does THIS PHONE'S BUILD carry it".
console.log('\n  binaryAtLeast — the installed BINARY, never the bundle:');
{
  check('binary 1.4.2, wants 1.4.2 — yes',
    loadAppVersion({ nativeVersion: '1.4.2' }).binaryAtLeast('1.4.2'), true);
  check('binary 1.4.3, wants 1.4.2 — yes',
    loadAppVersion({ nativeVersion: '1.4.3' }).binaryAtLeast('1.4.2'), true);
  check('binary 1.4.0, wants 1.4.2 — no',
    loadAppVersion({ nativeVersion: '1.4.0' }).binaryAtLeast('1.4.2'), false);
  check('binary 1.4.10 beats 1.4.9 (string order would say no)',
    loadAppVersion({ nativeVersion: '1.4.10' }).binaryAtLeast('1.4.9'), true);
  // THE ONE THAT MATTERS. A bundle at 1.4.2 riding a 1.4.0 binary is the
  // whole reason this function exists; reading the bundle would say yes.
  const ota = loadAppVersion({ installed: '1.4.2', nativeVersion: '1.4.0' });
  check('bundle says 1.4.2 while the binary is 1.4.0 — still no',
    ota.binaryAtLeast('1.4.2'), false);
  check('...and the bundle version is genuinely the newer one',
    ota.appVersion(), '1.4.2');
  // Unknown is NOT a yes: staying quiet costs a late telling, a wrong yes
  // sends somebody hunting for a feature their phone does not have.
  check('binary version unreadable — no', loadAppVersion().binaryAtLeast('1.0.0'), false);
}

console.log('\n  checkForStoreUpdate:');
{
  const { mod } = load({ installed: '1.3.0', storeVersion: '1.3.1' });
  const v = await mod.checkForStoreUpdate();
  check('store ahead — surfaces the version', v, '1.3.1');
}
{
  const { mod } = load({ installed: '1.3.1', storeVersion: '1.3.1' });
  const v = await mod.checkForStoreUpdate();
  check('up to date — nothing to say', v, null);
}
{
  const { mod } = load({ installed: '1.4.0', storeVersion: '1.3.1' });
  const v = await mod.checkForStoreUpdate();
  check('installed newer than the listing (own device ahead of a stale cache elsewhere) — nothing to say', v, null);
}
{
  const { mod } = load({ installed: '1.3.0', storeVersion: '1.3.1', netFails: true });
  const v = await mod.checkForStoreUpdate();
  check('offline — fails quiet, not thrown', v, null);
}

console.log('\n  caching — one network call per CHECK_EVERY_MS window, not per launch:');
{
  const { mod, callCount } = load({ installed: '1.3.0', storeVersion: '1.3.1' });
  await mod.checkForStoreUpdate();
  await mod.checkForStoreUpdate();
  await mod.checkForStoreUpdate();
  check('three calls to checkForStoreUpdate — one real fetch', callCount(), 1);
}

console.log('\n  dismissal — remembers the VERSION, not "never ask again":');
{
  const { mod } = load({ installed: '1.3.0', storeVersion: '1.3.1' });
  const first = await mod.checkForStoreUpdate();
  check('first check surfaces it', first, '1.3.1');
  await mod.dismissStoreUpdate('1.3.1');
  const second = await mod.checkForStoreUpdate();
  check('dismissed this version — stays quiet (cache still fresh, no new fetch)', second, null);
}
{
  // Simulate: dismissed 1.3.1, but the cache has since gone stale and a NEWER
  // version (1.3.2) is now live. The dismissal must not swallow that too.
  const js = compile(SRC);
  const disk = new Map();
  disk.set('cruisefm_store_update_dismissed', '1.3.1');
  disk.set('cruisefm_store_version_cache', JSON.stringify({ checkedAt: 0, storeVersion: '1.3.1' })); // expired
  const storage = { getItem: async (k) => (disk.has(k) ? disk.get(k) : null), setItem: async (k, v) => disk.set(k, v) };
  const fakeFetch = async () => ({ ok: true, json: async () => ({ results: [{ version: '1.3.2' }] }) });
  const mod = { exports: {} };
  const req = (name) => {
    if (name === '@react-native-async-storage/async-storage') return storage;
    if (name === '@/utils/appVersion') return loadAppVersion({ installed: '1.3.0' });
    return new Proxy({}, { get: () => () => {} });
  };
  new Function('module', 'exports', 'require', 'fetch', 'AbortController', js)(
    mod, mod.exports, req, fakeFetch, globalThis.AbortController);
  const v = await mod.exports.checkForStoreUpdate();
  check('a NEWER release than the dismissed one still gets to ask', v, '1.3.2');
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  every case checks out\n');
process.exit(fails ? 1 : 0);
