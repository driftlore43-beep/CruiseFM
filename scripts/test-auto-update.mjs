// The app restarts itself into a new version — these are the rules that say
// when it may, and every one of them exists to stop it happening at a bad
// moment. Owner, 14.08: updates should land "when it's closed for them"
// instead of behind a button.
//
// The decision is a pure function precisely so it can be read and tested
// here rather than inferred from an effect. This transpiles the SHIPPED
// component, so it tests what actually runs.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/components/AutoUpdateHost.tsx';
const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(
  mod, mod.exports, () => new Proxy({}, { get: () => () => {} }));
const { shouldUpdateNow, AWAY_MS, COOLDOWN_MS, COLD_START_GRACE_MS } = mod.exports;

const MIN = 60 * 1000;
let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${got}, wanted ${want}`);
};

// A settled, ordinary return: away a while, app has been running, nothing
// checked recently, nothing happening on screen.
const CALM = { awayMs: 30 * MIN, sinceBootMs: 60 * MIN, sinceLastCheckMs: Infinity, busy: false };
const on = (over) => shouldUpdateNow({ ...CALM, ...over });

console.log(`\n  away ${AWAY_MS / MIN}m · cooldown ${COOLDOWN_MS / MIN}m · cold-start grace ${COLD_START_GRACE_MS / MIN}m\n`);

check('a calm return updates', on({}), true);

// THE ONE THAT MATTERS MOST. A drive must never be interrupted, whatever else
// is true — so it is tested against the most favourable conditions there are.
console.log('\n  never over something the user is doing:');
check('drive running — refuses', on({ busy: true }), false);
check('...even after a long absence', on({ busy: true, awayMs: 12 * 60 * MIN }), false);
check('...even with no check for days', on({ busy: true, sinceLastCheckMs: 5 * 24 * 60 * MIN }), false);

console.log('\n  a glance away is not an absence:');
check('gone 5s — refuses', on({ awayMs: 5 * 1000 }), false);
check('gone 1m — refuses', on({ awayMs: 1 * MIN }), false);
check('just under the threshold — refuses', on({ awayMs: AWAY_MS - 1 }), false);
check('exactly the threshold — updates', on({ awayMs: AWAY_MS }), true);

console.log('\n  never seconds into a cold start (that reads as a crash, or loops):');
check('2s after boot — refuses', on({ sinceBootMs: 2000 }), false);
check('just inside the grace — refuses', on({ sinceBootMs: COLD_START_GRACE_MS - 1 }), false);
check('past the grace — updates', on({ sinceBootMs: COLD_START_GRACE_MS }), true);

console.log('\n  not once per app-switch:');
check('checked a minute ago — refuses', on({ sinceLastCheckMs: 1 * MIN }), false);
check('just inside the cooldown — refuses', on({ sinceLastCheckMs: COOLDOWN_MS - 1 }), false);
check('past the cooldown — updates', on({ sinceLastCheckMs: COOLDOWN_MS }), true);
check('first ever return — updates', on({ sinceLastCheckMs: Infinity }), true);

// A rule that can never fire is as bad as one that fires too often: the
// thresholds have to leave a real window open on an ordinary day.
console.log('\n  the window is actually reachable in normal use:');
check('back after lunch, app open since morning', on({ awayMs: 45 * MIN, sinceBootMs: 5 * 60 * MIN, sinceLastCheckMs: 4 * 60 * MIN }), true);
check('next morning, first return of the day', on({ awayMs: 9 * 60 * MIN, sinceBootMs: 10 * 60 * MIN, sinceLastCheckMs: 10 * 60 * MIN }), true);

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
