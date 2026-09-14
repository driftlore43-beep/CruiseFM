// SPOTIFY IS OFFERED IN BETA AND NEVER IN THE STORE BUILD.
//
//   node scripts/test-beta-spotify.mjs
//
// WHY THIS IS PINNED. Spotify caps a development-tier app at five authorised
// accounts, so the offer was pulled on 01.09 — for everyone else it was a
// promise the app could not keep, and they would sign in, be refused, and land
// in the companion mode they could have had without the detour. It is back for
// beta builds only (14.09), which means one boolean now decides whether a
// stranger is shown something that will refuse them.
//
// THE RULE IT ENFORCES IS "FAIL CLOSED": anything that is not positively
// identified as a beta channel must be treated as the public build. A missing
// updates module, an empty channel, a channel called `production`, a value
// that is not even a string — every one of those has to come back false. The
// dangerous direction is the one that costs nothing to get wrong in testing
// and everything in the store.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const src = readFileSync(`${ROOT}/src/utils/betaBuild.ts`, 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};

/** Load the shipped module with __DEV__ and a stubbed expo-updates. */
function load({ dev = false, updates = undefined, throws = false }) {
  const mod = { exports: {} };
  const req = (name) => {
    if (name !== 'expo-updates') throw new Error('unexpected require ' + name);
    if (throws) throw new Error('no native module');
    return updates;
  };
  new Function('module', 'exports', 'require', '__DEV__', js)(mod, mod.exports, req, dev);
  return mod.exports.isBetaBuild();
}

check('a testflight build (channel preview) shows Spotify', load({ updates: { channel: 'preview' } }) === true);
check('the store build (channel production) does NOT', load({ updates: { channel: 'production' } }) === false);
check('an empty channel does NOT', load({ updates: { channel: '' } }) === false);
check('a missing channel does NOT', load({ updates: {} }) === false);
check('a non-string channel does NOT', load({ updates: { channel: 7 } }) === false);
check('no updates module at all does NOT', load({ throws: true }) === false);
check('a future channel name is treated as beta', load({ updates: { channel: 'internal' } }) === true,
  'anything that is not production is not the store');
check('__DEV__ always counts as beta', load({ dev: true, throws: true }) === true);

// ── and the picker must actually use it ───────────────────────────────────
// A rule nothing consults is worse than no rule, and this file has shipped
// that shape more than once.
const picker = readFileSync(`${ROOT}/src/components/PlatformSelector.tsx`, 'utf8');
check('the picker imports the rule', /isBetaBuild/.test(picker));
check("the picker filters Spotify on it",
  /filter\(\(\[id\]\) => id !== 'spotify' \|\| BETA\)/.test(picker));
check('Spotify\'s caption does not promise plain "full in-app control"',
  /spotify:\s*'Full control · invited accounts'/.test(picker),
  'five accounts is a condition and the caption has to carry it');

// ── the channels this depends on are the ones eas.json actually sets ──────
// If a profile ever stops sending testflight to `preview`, or the store build
// stops being `production`, this whole rule inverts silently.
const eas = JSON.parse(readFileSync(`${ROOT}/eas.json`, 'utf8'));
check('the testflight profile still publishes to preview',
  eas.build?.testflight?.channel === 'preview', String(eas.build?.testflight?.channel));
check('the production profile still publishes to production',
  eas.build?.production?.channel === 'production', String(eas.build?.production?.channel));

console.log(fails ? `\n${fails} failure(s)` : '\nSpotify is offered in beta and never in the store build');
process.exit(fails ? 1 : 0);
