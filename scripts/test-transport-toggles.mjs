// The shuffle and repeat buttons.
//
// Owner, 18.08: "make sure the shuffle and the repeat buttons work on the
// created playlists." Two separate faults sat behind that, and both are the
// kind that only a test can hold still.
//
// (1) REPEAT WAS A TWO-STATE BUTTON OVER A THREE-STATE FEATURE. Every mode
//     sent 'track', so the only repeat reachable was repeat-ONE — which on a
//     station whose whole point is its playlist means the playlist stops. And
//     the state was flattened to a boolean, so a player genuinely set to
//     repeat the playlist showed the repeat-one icon with no press that could
//     get back to it.
//
// (2) A PRESS WAS OVERWRITTEN BY A POLL THAT PREDATED IT. The command is sent
//     and the chase re-polls at 220ms, which reports the OLD setting; that was
//     believed, and the button dropped back. Indistinguishable, from the
//     outside, from a button that does nothing.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const src = fs.readFileSync('/home/user/CruiseFM/src/utils/useSpotifyPlayback.ts', 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
const stub = () => new Proxy({}, {
  get: () => () => ({ then: () => ({ catch: () => {} }), catch: () => {} }),
});
new Function('module', 'exports', 'require', js)(mod, mod.exports, stub);
const { nextRepeat, acceptReported, TOGGLE_GUARD_MS } = mod.exports;

let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};

console.log('\n  repeat cycles through all three states:');
check('off → the playlist', nextRepeat('off'), 'context');
check('the playlist → this song', nextRepeat('context'), 'track');
check('this song → off', nextRepeat('track'), 'off');

// THE PLAYLIST COMES FIRST because it is the one people mean on a station.
// If this ever flips, repeat-one becomes the first press again and a station's
// playlist stops dead on the song it was on — the reported bug, exactly.
check('the FIRST press repeats the playlist, not the song', nextRepeat('off'), 'context');

// Every state must be reachable from every other, or the button can strand
// the player somewhere the app cannot describe.
console.log('\n  every state is reachable, and the cycle closes:');
let m = 'off';
const seen = new Set();
for (let i = 0; i < 3; i++) { m = nextRepeat(m); seen.add(m); }
check('three presses visit all three states', seen.size, 3);
check('three presses return to the start', m, 'off');

console.log(`\n  a press is held against a stale reading (guard ${TOGGLE_GUARD_MS / 1000}s):`);
const NOW = 1_700_000_000_000;
const pend = (want, at = NOW) => ({ want, until: at + TOGGLE_GUARD_MS });

check('nothing pending — believe the player', acceptReported(null, true, NOW), true);
check('the chase poll still reports the old setting', acceptReported(pend(true), false, NOW + 220), false);
check('a second later, still the old setting', acceptReported(pend(true), false, NOW + 1200), false);
check('the poll catches up and agrees', acceptReported(pend(true), true, NOW + 900), true);

// THE GUARD MUST EXPIRE. A command Spotify genuinely refused must not leave
// the button lying for the rest of the drive — that would be the same fault
// in the other direction.
check('the guard expires and the player wins', acceptReported(pend(true), false, NOW + TOGGLE_GUARD_MS + 1), true);
check('exactly at the deadline, still holding', acceptReported(pend(true), false, NOW + TOGGLE_GUARD_MS), false);

console.log('\n  the same rule carries repeat, which is not a boolean:');
check('asked for the playlist, told off', acceptReported(pend('context'), 'off', NOW + 300), false);
check('asked for the playlist, told the playlist', acceptReported(pend('context'), 'context', NOW + 300), true);
check('asked for the playlist, told this song', acceptReported(pend('context'), 'track', NOW + 300), false);

// The guard has to outlast the whole chase or the last chase poll wins and we
// are back where we started. CHASE_MS ends at 3600ms.
console.log('\n  the guard outlasts the chase that caused the bug:');
const chase = /const CHASE_MS = \[([\d, ]+)\]/.exec(src);
if (!chase) { console.log('  FAIL CHASE_MS is gone'); fails++; }
else {
  const last = Math.max(...chase[1].split(',').map((n) => Number(n.trim())));
  check(`last chase poll (${last}ms) lands inside the guard`, TOGGLE_GUARD_MS > last, true);
}

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
