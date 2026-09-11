// A SCRUB MUST REACH THE SERVICE THAT IS ACTUALLY PLAYING.
//
// The symptom this guards against is one the owner has reported twice: the
// record turns under your finger, the progress bar moves, and the song you can
// hear does not. Both times the gesture was fine — the seek was being handed to
// an app that wasn't playing.
//
//   04.08  every mode seeked Spotify directly, so on Apple Music nothing moved.
//          Fixed by routing through seekActive.
//   25.08  seekActive's platform cache was only refreshed on the SPOTIFY branch,
//          so a listener who switched Apple -> Spotify kept seeking Apple Music
//          for the rest of the session. The same bug from the other side.
//
// Neither was caught by anything until a person noticed on a drive. This is
// deterministic and cheap, so it runs with every sweep instead.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/useTrackClock.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param saved       what the phone has stored as the chosen platform
 * @param hasMusicKit whether this build carries the native Apple Music module
 */
function load({ saved = 'spotify', hasMusicKit = true } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const calls = [];
  const state = { saved };
  const req = (name) => {
    if (name === './appleMusic') return {
      appleMusicAvailable: () => hasMusicKit,
      appleSeekTo: async (ms) => { calls.push(['apple', Math.round(ms)]); },
    };
    if (name === './spotify') return {
      seekTo: async (ms) => { calls.push(['spotify', Math.round(ms)]); },
    };
    if (name === './musicPlatform') return { getSavedPlatform: async () => state.saved };
    if (name === 'react') return { useEffect: () => {}, useRef: () => ({ current: null }), useState: () => [null, () => {}] };
    if (name === 'react-native') return { Animated: { Value: class {} }, Easing: {} };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { seek: m.exports.seekActive, calls, state };
}

console.log('\n  it seeks the service the listener actually chose:');
{
  const { seek, calls } = load({ saved: 'appleMusic' });
  await tick();                       // let the module's priming read land
  seek(96_438);
  check('Apple Music listener — Apple is asked',
    calls.some(([p]) => p === 'apple'), JSON.stringify(calls));
  check('...and Spotify is never asked',
    !calls.some(([p]) => p === 'spotify'), JSON.stringify(calls));
  check('the position is passed through untouched',
    calls.some(([, ms]) => ms === 96_438), JSON.stringify(calls));
}
{
  const { seek, calls } = load({ saved: 'spotify' });
  await tick();
  seek(30_000);
  check('Spotify listener — Spotify is asked, Apple is not',
    calls.some(([p]) => p === 'spotify') && !calls.some(([p]) => p === 'apple'),
    JSON.stringify(calls));
}
{
  // "Skip for now" saves 'none'. Spotify is the historic default and the only
  // service that could be connected without a platform having been chosen.
  const { seek, calls } = load({ saved: 'none' });
  await tick();
  seek(1000);
  check('no platform chosen — falls back to Spotify',
    calls.some(([p]) => p === 'spotify'), JSON.stringify(calls));
}
{
  // Apple Music selected on a build with no MusicKit (web, anything before
  // build 23). There is nothing to seek; it must not throw.
  const { seek, calls } = load({ saved: 'appleMusic', hasMusicKit: false });
  await tick();
  let threw = false;
  try { seek(5000); } catch { threw = true; }
  check('Apple saved but no module — falls through rather than throwing',
    !threw && calls.some(([p]) => p === 'spotify'), JSON.stringify(calls));
}

// THE 25.08 BUG. The cache was refreshed only after the Spotify branch, so the
// Apple branch returned early and never re-read — and a listener who moved to
// Spotify kept seeking Apple Music until they restarted the app.
console.log('\n  a mid-session platform switch lands on the next scrub:');
{
  const { seek, calls, state } = load({ saved: 'appleMusic' });
  await tick();
  seek(1000);                          // scrubbing as an Apple listener
  state.saved = 'spotify';             // they switch in Profile
  seek(2000);                          // the scrub that notices
  await tick();
  calls.length = 0;
  seek(3000);
  check('Apple -> Spotify: the next scrub reaches Spotify',
    calls.some(([p]) => p === 'spotify') && !calls.some(([p]) => p === 'apple'),
    JSON.stringify(calls));
}
{
  const { seek, calls, state } = load({ saved: 'spotify' });
  await tick();
  seek(1000);
  state.saved = 'appleMusic';
  seek(2000);
  await tick();
  calls.length = 0;
  seek(3000);
  check('Spotify -> Apple: the next scrub reaches Apple Music',
    calls.some(([p]) => p === 'apple') && !calls.some(([p]) => p === 'spotify'),
    JSON.stringify(calls));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a scrub reaches whichever service is playing, and follows a switch\n');
process.exit(fails ? 1 : 0);
