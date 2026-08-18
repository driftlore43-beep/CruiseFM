// How far the progress bar may run ahead of the last thing the music service
// actually told us.
//
// Owner, mid-drive: "it was moving the scrub but not the actual song." The bar
// was animated from a known position all the way to the END of the track, and
// only a poll restarted it — invisible while polls arrive every five seconds,
// and a lie the moment they stop. One reading now buys a bounded coast.
//
// This tests the arithmetic of that bound. Getting it wrong is worse than the
// bug: overshoot the end and the bar runs past 100%; mistake the cap for the
// track ending and the bar snaps back to zero mid-song.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const src = fs.readFileSync('/home/user/CruiseFM/src/utils/useTrackClock.ts', 'utf8');
const m = /const MAX_COAST_MS = (\d+);/.exec(src);
if (!m) { console.log('  FAIL MAX_COAST_MS is gone from useTrackClock'); process.exit(1); }
const CAP = Number(m[1]);

// The shipped expression, lifted verbatim from startFrom.
function coast(fromMs, durMs) {
  const clamped = Math.max(0, Math.min(fromMs, durMs));
  const remaining = durMs - clamped;
  if (remaining <= 0) return { ended: true, toValue: 0, duration: 0 };
  const span = Math.min(remaining, CAP);
  return { reachesEnd: span >= remaining, toValue: (clamped + span) / durMs, duration: span };
}

let fails = 0;
const check = (name, got, want) => {
  const ok = Math.abs(got - want) < 1e-9 || got === want;
  if (ok) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${got}, wanted ${want}`);
};

const SONG = 210000; // 3:30, an ordinary track
console.log(`\n  cap: ${CAP / 1000}s · poll: 5s\n`);

// Mid-song: coast the cap, and do NOT claim the track ended.
const mid = coast(60000, SONG);
check('mid-song coasts exactly the cap', mid.duration, CAP);
check('mid-song does not claim the end', mid.reachesEnd, false);
check('mid-song target is where the cap lands', mid.toValue, (60000 + CAP) / SONG);

// Near the end: coast only what is left, and DO claim the end so the bar wraps.
const near = coast(SONG - 4000, SONG);
check('near the end coasts only what remains', near.duration, 4000);
check('near the end claims the end', near.reachesEnd, true);
check('near the end targets exactly 1', near.toValue, 1);

// The boundary between those two behaviours.
check('exactly the cap from the end — reaches it', coast(SONG - CAP, SONG).reachesEnd, true);
check('a millisecond more than the cap — does not', coast(SONG - CAP - 1, SONG).reachesEnd, false);

// THE BUG THIS GUARDS. Overshooting would drive the bar past the end of the
// song, which is the failure the cap exists to prevent, in the other direction.
console.log('\n  never past the end, from anywhere in the song:');
let over = 0;
for (let pos = 0; pos < SONG; pos += 997) if (coast(pos, SONG).toValue > 1 + 1e-9) over++;
check('positions that overshoot 100%', over, 0);

// A very short track — shorter than the cap itself, which is the case most
// likely to break a bound written with long songs in mind.
console.log('\n  a track shorter than the cap:');
const shortT = coast(0, 12000);
check('coasts the whole track', shortT.duration, 12000);
check('claims the end', shortT.reachesEnd, true);
check('targets exactly 1', shortT.toValue, 1);

console.log('\n  edges:');
check('already at the end', coast(SONG, SONG).ended, true);
check('past the end is clamped', coast(SONG + 5000, SONG).ended, true);
check('start of the song', coast(0, SONG).toValue, CAP / SONG);

// The cap has to be comfortably more than the poll interval or the bar stalls
// in normal use; and small enough that a stalled bar is not a big lie.
console.log('\n  the cap is in a sane band:');
check('at least 4 polls of slack', CAP >= 4 * 5000, true);
check('under a minute of possible error', CAP <= 60000, true);

// ── AND WHAT HAPPENS WHEN THE CAP IS REACHED ──────────────────────────────
// The cap on its own was wrong, and the owner caught it (18.08): "sometimes
// the time at the start stays on 1:19 even when I scrub the bar." Reproduced
// in the web build by telling a stubbed service to go quiet mid-song — the bar
// coasted its 30 seconds and then FROZE for the rest of the drive, because a
// fresh reading was the only thing that ever restarted it.
//
// Silence has two meanings and this is the rule that tells them apart. A
// service that SAID it stopped is handled elsewhere (the clock will not start
// until isPlaying confirms); a service we merely cannot REACH is a patchy
// signal, which on a drive is ordinary, and the music is still playing.
const jsm = /const MAX_SILENCE_MS = (\d+);/.exec(src);
if (!jsm) { console.log('  FAIL MAX_SILENCE_MS is gone from useTrackClock'); process.exit(1); }
const SILENCE = Number(jsm[1]);

const modJs = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
// The module runs a `getSavedPlatform().then(...)` at import to cache the
// platform, so the stub has to return something thenable rather than a bare
// function — otherwise the file cannot even be loaded.
const stub = () => new Proxy({}, {
  get: () => () => ({ then: () => ({ catch: () => {} }), catch: () => {} }),
});
new Function('module', 'exports', 'require', modJs)(mod, mod.exports, stub);
const { shouldKeepCoasting } = mod.exports;
if (typeof shouldKeepCoasting !== 'function') {
  console.log('  FAIL shouldKeepCoasting is not exported'); process.exit(1);
}

console.log(`\n  the coast re-arms while the service is only briefly quiet (limit ${SILENCE / 1000}s):`);
const NOW = 1_700_000_000_000;
check('a reading from a moment ago', shouldKeepCoasting(NOW, NOW - 200), true);
check('one missed poll', shouldKeepCoasting(NOW, NOW - 5000), true);
check('past the cap but still recent', shouldKeepCoasting(NOW, NOW - 31000), true);
check('a minute of silence — keep going', shouldKeepCoasting(NOW, NOW - 60000), true);
check('exactly the limit — still going', shouldKeepCoasting(NOW, NOW - SILENCE), true);
check('past the limit — hold', shouldKeepCoasting(NOW, NOW - SILENCE - 1), false);
check('a five-minute outage — hold', shouldKeepCoasting(NOW, NOW - 300000), false);

// THE DEMO BAR HAS NO SERVICE TO LOSE TOUCH WITH. Companion mode and the
// decks' own demo tapes have no reading at all, so they must simply run —
// this is the case that made the vinyl and cassette decks stop dead too.
console.log('\n  no reading at all means the demo bar, which just runs:');
check('null', shouldKeepCoasting(NOW, null), true);
check('undefined', shouldKeepCoasting(NOW, undefined), true);

// The band the limit has to sit in. Too short and an ordinary tunnel freezes
// the readout; too long and the bar walks through a song that has since ended
// and been replaced, which is a worse claim than plainly stopping.
console.log('\n  the silence limit is in a sane band:');
check('more than a dozen missed polls', SILENCE >= 12 * 5000, true);
check('shorter than a typical song', SILENCE <= 210000, true);

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
