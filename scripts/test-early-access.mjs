// FREE PREMIUM FOR THE PHONES THAT WERE HERE FIRST — AND NOBODY ELSE.
//
// The rule has two silent failure modes, and both would cost real money or
// real goodwill: grant it to a fresh install and the paywall is decorative;
// refuse it to somebody who has driven with the app for a month and the
// paywall reads as a betrayal. Neither throws. So the shipped module is
// transpiled and driven against a fake AsyncStorage in every state a phone
// can actually be in.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM';
const SRC = `${ROOT}/src/utils/earlyAccess.ts`;
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load(initial = {}, { launchFree = false, broken = false } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const store = { ...initial };
  const writes = [];
  const AsyncStorage = broken
    ? {
      getItem: async () => { throw new Error('storage unreadable'); },
      setItem: async () => { throw new Error('storage unreadable'); },
    }
    : {
      getItem: async (k) => (k in store ? store[k] : null),
      setItem: async (k, v) => { store[k] = v; writes.push(k); },
    };
  const req = (name) => {
    // A stub for one of these harnesses MUST carry __esModule, or TS's
    // __importDefault wraps it a second time and every call lands on
    // undefined (the 16.09 trap).
    if (name === '@react-native-async-storage/async-storage') return AsyncStorage;
    if (name === '@/constants/config') return { __esModule: true, LAUNCH_FREE: launchFree };
    throw new Error(`unstubbed require: ${name}`);
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { mod: m.exports, store, writes };
}

// THE KEYS ARE PINNED AGAINST THE MODULES THAT OWN THEM. earlyAccess.ts reads
// three other modules' storage by key rather than importing them; if one of
// those modules ever renames its key, the evidence silently stops existing
// and every existing user is refused. This is the check that notices.
console.log('\n  the evidence keys still match their owners:');
const src = fs.readFileSync(SRC, 'utf8');
const owner = (file, re) => (fs.readFileSync(`${ROOT}/${file}`, 'utf8').match(re) || [])[1];
const pin = (label, mine, theirs) => check(`${label} key agrees (${theirs})`, !!theirs && mine === theirs, `mine=${mine}`);
pin('founder', src.match(/FOUNDER_KEY = '([^']+)'/)[1], owner('src/utils/founder.ts', /FOUNDER_KEY = '([^']+)'/));
pin('drive log', src.match(/DRIVE_LOG_KEY = '([^']+)'/)[1], owner('src/utils/driveStats.ts', /const KEY = '([^']+)'/));
pin('last cruise', src.match(/LAST_CRUISE_KEY = '([^']+)'/)[1], owner('src/utils/lastCruise.ts', /const KEY = '([^']+)'/));

const KEY = 'cruise_early_access';
const LOG = JSON.stringify([{ ts: 1, stationId: 'sunset', minutes: 12 }]);

console.log('\n  a brand-new install gets nothing:');
{
  const { mod, store } = load({});
  check('refused', (await mod.hasEarlyAccess()) === false);
  check('and the refusal is written down', store[KEY] === 'false');
}

console.log('\n  prior use is what qualifies — each kind of evidence on its own:');
{
  const { mod, store } = load({ cruise_drive_log: LOG });
  check('a logged session', (await mod.hasEarlyAccess()) === true);
  check('written as granted', store[KEY] === 'true');
}
{
  const { mod } = load({ cruise_last_cruise: JSON.stringify({ stationId: 'sunset', mode: 'vinyl' }) });
  check('a remembered cruise', (await mod.hasEarlyAccess()) === true);
}
{
  const { mod } = load({ cruise_founder_badge: 'true' });
  check('the Founder badge', (await mod.hasEarlyAccess()) === true);
}
{
  const { mod } = load({ cruise_founder_badge: 'false' });
  check('a Founder "no" is not evidence (it is written on every first launch)', (await mod.hasEarlyAccess()) === false);
}
{
  const { mod } = load({ cruise_drive_log: '[]' });
  check('an empty log is not evidence', (await mod.hasEarlyAccess()) === false);
}
{
  const { mod } = load({ cruise_drive_log: '{not json' });
  check('a corrupt log is not evidence, and does not throw', (await mod.hasEarlyAccess()) === false);
}

console.log('\n  the decision is permanent in BOTH directions:');
{
  // One free drive after the paywall must not buy Premium for good.
  const { mod, store, writes } = load({ [KEY]: 'false', cruise_drive_log: LOG });
  check('a refused phone that drives later stays refused', (await mod.hasEarlyAccess()) === false);
  check('nothing rewritten', writes.length === 0 && store[KEY] === 'false');
}
{
  // Granted is granted, whatever the evidence looks like later (a cleared log).
  const { mod, writes } = load({ [KEY]: 'true' });
  check('a granted phone with no evidence left stays granted', (await mod.hasEarlyAccess()) === true);
  check('nothing rewritten', writes.length === 0);
}

console.log('\n  nothing is decided while the app is free:');
{
  const { mod, store, writes } = load({}, { launchFree: true });
  check('answers no', (await mod.hasEarlyAccess()) === false);
  check('and writes NOTHING, so the paywall decides later', writes.length === 0 && !(KEY in store));
}
{
  const { mod, writes } = load({ cruise_drive_log: LOG }, { launchFree: true });
  check('even with evidence — the grant waits for the paywall', (await mod.hasEarlyAccess()) === false && writes.length === 0);
}

console.log('\n  one launch, one read:');
{
  const { mod } = load({ cruise_drive_log: LOG });
  const orig = mod.claimEarlyAccessIfEligible;
  const a = orig();
  const b = mod.hasEarlyAccess();
  check('every caller shares the same decision', a === b);
}

console.log('\n  storage failure is "not now", never "no forever":');
{
  const { mod } = load({}, { broken: true });
  check('answers no without throwing', (await mod.hasEarlyAccess()) === false);
}

console.log('\n  the copy:');
{
  const copy = fs.readFileSync(`${ROOT}/src/constants/notificationCopy.ts`, 'utf8');
  const block = copy.match(/EARLY_ACCESS = \{[\s\S]*?\};/)[0];
  check('never an offer', !/upgrade|% off|discount|only \$|limited time|trial/i.test(block));
  check('never a head count', !/first \d+|first (hundred|thousand)/i.test(block));
  const card = fs.readFileSync(`${ROOT}/src/components/EarlyAccessCard.tsx`, 'utf8');
  check('the card never calls it a subscription (nothing renews)', !/subscription/i.test(card.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
}

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all green\n');
process.exit(fails ? 1 : 0);
