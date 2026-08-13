// The back button restarts the song before it goes back.
//
// Owner, 13.08: "the back button should restart the song not go back to the
// previous song. Press it back twice and then it plays to the previous song."
//
// The double-tap is the case worth testing, because it only works by
// consequence rather than by counting presses: the first press seeks to 0, so
// the second press finds the song at the start and falls into the other branch.
// Nothing anywhere counts taps, and nothing needs to.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/useSpotifyPlayback.ts';

// The module imports React and the Spotify client; only the two pure functions
// at the top are under test, so the whole file is loaded with every import
// stubbed to an empty object.
const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => new Proxy({}, { get: () => () => {} }));
const { backButtonAction, elapsedMs, RESTART_WINDOW_MS } = mod.exports;

const NOW = 1_700_000_000_000;
let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${got}, wanted ${want}`);
};
const track = (progressMs, { syncedAt = NOW, isPlaying = true } = {}) => ({ progressMs, syncedAt, isPlaying });

console.log(`\n  window: ${RESTART_WINDOW_MS}ms\n`);

// The rule itself.
check('at 0:00 — goes back',            backButtonAction(track(0), NOW), 'previous');
check('at 2.9s — still goes back',      backButtonAction(track(2900), NOW), 'previous');
check('at 3.1s — restarts',             backButtonAction(track(3100), NOW), 'restart');
check('mid-song — restarts',            backButtonAction(track(100_000), NOW), 'restart');

// The clock runs on between polls, so a reading taken 4s ago from a playing
// track is 4s further along than it says.
check('stale reading, playing — counts the gap',
  backButtonAction(track(500, { syncedAt: NOW - 4000 }), NOW), 'restart');
check('stale reading, paused — does not',
  backButtonAction(track(500, { syncedAt: NOW - 4000, isPlaying: false }), NOW), 'previous');

// No live track at all — companion mode, which is most listeners. There is no
// position to restart from, so the button keeps its plain meaning.
check('no track — goes back',           backButtonAction(null, NOW), 'previous');
check('no position — goes back',        backButtonAction(track(null), NOW), 'previous');

// THE DOUBLE TAP, end to end. Press once mid-song: restart. That seeks to 0,
// so the next reading is 0 — press again and it goes back.
const first = backButtonAction(track(96_000), NOW);
const afterRestart = track(0, { syncedAt: NOW + 200 });
const second = backButtonAction(afterRestart, NOW + 400);
check('double tap: first press restarts', first, 'restart');
check('double tap: second press goes back', second, 'previous');

// And a slow double tap does NOT go back — by then the song is playing again.
check('two presses 5s apart: the second restarts too',
  backButtonAction(track(0, { syncedAt: NOW }), NOW + 5000), 'restart');

check('elapsed runs the clock forward', elapsedMs(track(1000, { syncedAt: NOW - 2000 }), NOW), 3000);

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
