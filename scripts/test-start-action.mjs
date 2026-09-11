// Should starting a drive touch the music that is already playing?
//
// Owner, 18.08: "when I'm already playing music from Spotify and I already
// know what playlist it belongs in, I click the right playlist but then the
// music changes. It would be nice for the music to continue playing — unless
// it's a different playlist, and then it should change."
//
// The cause is that Spotify's play call with a context_uri starts that context
// FROM THE TOP, so handing it the playlist it is already playing throws away
// wherever you had got to. From the outside that looks like the app skipping
// your song for no reason.
//
// Three outcomes, and getting any of them wrong is a different visible bug:
//   leave   the right playlist is already running — say nothing
//   resume  the right playlist is loaded but paused — resume IN PLACE, which
//           means calling play with NO uri; passing one restarts it, which is
//           the original bug wearing a different hat
//   start   anything else
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const src = fs.readFileSync('/home/user/CruiseFM/src/context/NowPlayingContext.tsx', 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const mod = { exports: {} };
const stub = () => new Proxy({}, {
  get: () => () => ({ then: () => ({ catch: () => {} }), catch: () => {} }),
});
new Function('module', 'exports', 'require', js)(mod, mod.exports, stub);
const { startActionFor } = mod.exports;
if (typeof startActionFor !== 'function') {
  console.log('  FAIL startActionFor is not exported'); process.exit(1);
}

let fails = 0;
const check = (name, got, want) => {
  if (got === want) { console.log(`  ok   ${name}`); return; }
  fails++; console.log(`  FAIL ${name} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
};

const MINE = 'spotify:playlist:aaa';
const OTHER = 'spotify:playlist:bbb';

console.log('\n  the reported case — the same playlist, already going:');
check('leave it exactly where it is', startActionFor(MINE, true, MINE), 'leave');

console.log('\n  the same playlist, but paused:');
check('resume in place, never restart', startActionFor(MINE, false, MINE), 'resume');

console.log('\n  a different playlist — this is the half that must still change:');
check('playing something else', startActionFor(OTHER, true, MINE), 'start');
check('paused on something else', startActionFor(OTHER, false, MINE), 'start');

// Spotify reports no context at all when playing a bare track, an album, or
// the radio. That is not our playlist, so it gets replaced.
console.log('\n  no playlist context at all (a bare track, an album, radio):');
check('null context', startActionFor(null, true, MINE), 'start');

// THE SAFE DEFAULT. `undefined` means the service did not answer usefully —
// offline, a timeout, nothing playing. Guessing "leave" there would open a
// drive in silence and look broken.
console.log('\n  no usable answer from the service:');
check('undefined context starts properly', startActionFor(undefined, undefined, MINE), 'start');
check('undefined context, even if isPlaying somehow says true', startActionFor(undefined, true, MINE), 'start');

// A uri is compared whole. Prefix or case sloppiness here would silently
// decline to change playlists that genuinely differ.
console.log('\n  uris are matched exactly:');
check('a longer uri sharing a prefix', startActionFor(MINE + 'x', true, MINE), 'start');
check('different case is a different playlist', startActionFor(MINE.toUpperCase(), true, MINE), 'start');

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
