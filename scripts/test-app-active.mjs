// "In front of the user" — the rule that decides whether animations run and
// polls tick. It was `state === 'active'`, which is wrong on iOS because
// `inactive` means STILL ON SCREEN: Notification Centre pulled down, Control
// Centre, the app switcher, a call banner, a Face ID sheet.
//
// Owner, 14.08: "when I swipe down the home page to look for notifications,
// the animation likes to pause." That is this rule, in three places.
//
// The direction of the mistake is what matters. Guessing "gone" when the app
// is visible freezes a screen the user is looking at. Guessing "here" when it
// is gone costs one more poll — and the SIGKILL this gate exists to prevent is
// a BACKGROUND risk, which the rule still covers exactly.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const js = ts.transpileModule(
  fs.readFileSync('/home/user/CruiseFM/src/utils/useAppActive.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(
  mod, mod.exports, () => new Proxy({}, { get: () => () => {} }));
const { isInFront } = mod.exports;

let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${got}, wanted ${want}`);
};

console.log('\n  the three iOS states:');
check('active — animations run', isInFront('active'), true);
check('inactive — STILL ON SCREEN, so they run', isInFront('inactive'), true);
check('background — actually gone, so they stop', isInFront('background'), false);

// Every one of these puts the app in `inactive` while it stays visible. Each
// used to freeze the scene the user was looking straight at.
console.log('\n  the things that produce `inactive`, all still visible:');
for (const what of [
  'notification centre pulled down',
  'control centre pulled up',
  'app switcher',
  'incoming call banner',
  'Face ID sheet',
]) check(what, isInFront('inactive'), true);

console.log('\n  unknown states err toward running, not freezing:');
check("'unknown'", isInFront('unknown'), true);
check("'extension'", isInFront('extension'), true);
check('null', isInFront(null), true);
check('undefined', isInFront(undefined), true);

// The whole reason the gate exists (27.07, bug_type 309). If this ever comes
// back true the app starts getting SIGKILLed again with nothing in the logs.
console.log('\n  the SIGKILL protection is intact:');
check('background is the one state that stops work', isInFront('background'), false);

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
