// COMING BACK TO THE APP MUST NOT PAUSE A DRIVE THAT NEVER STOPPED.
//
// Owner, 26.08: "when i leave the app to go to another app and open back the
// app the pause button comes on and the disc likes to stop, while the music
// continues to play. after a few seconds it picks back up."
//
// THE MECHANISM: the poll is stopped while backgrounded (the SIGKILL rule),
// so returning fires an immediate refresh at exactly the moment the system
// player is still spinning its state back up — and its first answer after a
// resume is routinely a stale `isPlaying: false`. One reading was enough to
// adopt PAUSED, which both flips the transport AND (via confirmedPlaying,
// which reads track.isPlaying) stops the mode's animation. The next poll put
// it back, which is the "after a few seconds it picks back up".
//
// Spotify has required TWO idle answers in a row since 10.08 for exactly this
// reason. Apple never got the rule. This pins down that it now has it, on
// BOTH surfaces — the transport and the scene — because holding one without
// the other still leaves the disc frozen, which is the half actually seen.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/useAppleMusicPlayback.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A ~40-line React, and the DEPENDENCY ARRAY IS THE POINT.
 *
 * The first version of this ran every effect on every render, which meant a
 * single `call()` re-ran the mount effect and fired several polls at once —
 * the streak raced past 2 and every assertion here failed against correct
 * code. Honouring deps makes the mount effect run once, so the ONLY thing
 * driving refreshes is the hook's own interval, at a rate this test sets.
 */
function makeReact() {
  let states = [], idx = 0, pending = [], dirty = false;
  const React = {
    useState: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: typeof init === 'function' ? init() : init };
      return [states[i].v, (next) => {
        const nv = typeof next === 'function' ? next(states[i].v) : next;
        if (nv !== states[i].v) { states[i].v = nv; dirty = true; }
      }];
    },
    useRef: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: { current: init } };
      return states[i].v;
    },
    useEffect: (fn, deps) => {
      const i = idx++;
      const prev = states[i];
      const changed = !prev || !deps || !prev.deps
        || deps.length !== prev.deps.length
        || deps.some((d, k) => d !== prev.deps[k]);
      if (changed) { states[i] = { deps }; pending.push(fn); }
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  };
  const render = (c, p) => {
    idx = 0; pending = [];
    const o = c(p);
    for (const e of pending) e();
    return o;
  };
  const loop = (c, p, max = 10) => { let o; do { dirty = false; o = render(c, p); } while (dirty && max-- > 0); return o; };
  return { React, loop };
}

function load({ pollMs = 30 } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const { React, loop } = makeReact();
  // `adopted` is what the DRIVE believes — NowPlayingContext's play state,
  // i.e. what the pause button shows.
  // DETERMINISTIC BY COUNT, NOT BY CLOCK. Sleeping a fixed number of
  // milliseconds against a real interval means some windows catch two polls
  // and some catch one, purely on timer phase — which made this test fail
  // against correct code. `state.polls` counts actual reads, so a step can
  // wait for EXACTLY one more however the timers happen to line up.
  const state = { entry: null, adopted: [], polls: 0 };
  const req = (name) => {
    if (name === 'react') return React;
    if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } };
    if (name === '@/utils/useAppActive') return { isInFront: () => true };
    if (name === '@/context/NowPlayingContext') return {
      useActivityPing: () => () => {},
      useAdoptPlayState: () => (p) => { state.adopted.push(p); },
    };
    if (name === './appleArtwork') return { lookupAppleArtwork: async () => null };
    if (name === './useSpotifyPlayback') return {
      backButtonAction: () => 'previous', TOGGLE_GUARD_MS: 6000,
      acceptReported: (pending, reported, now) => !pending || pending.want === reported || now >= pending.until,
    };
    if (name === './appleMusic') return {
      appleMusicAvailable: () => true, isAppleMusicConnected: async () => true,
      getAppleLibraryArtwork: async () => null,
      getAppleNowPlaying: async () => { state.polls += 1; return state.entry; },
      recoverApplePlayback: async () => false,
      appleNext: async () => {}, applePrev: async () => {}, applePlay: async () => {}, applePause: async () => {},
      appleSeekTo: async () => {}, appleSetShuffle: async () => {}, appleSetRepeat: async () => {},
    };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  const hook = m.exports.useAppleMusicPlayback;
  const call = () => loop((a) => hook(a[0], a[1]), [true, { pollMs }]);
  /** Wait for exactly one more read, let its async body finish, then render. */
  const step = async () => {
    const target = state.polls + 1;
    const deadline = Date.now() + 2000;
    while (state.polls < target && Date.now() < deadline) await sleep(2);
    await sleep(4);                       // let the awaited body settle
    return call();
  };
  return { call, step, state };
}

const playing = { title: 'S', artist: 'A', artworkUrl: null, durationMs: 200000, positionMs: 5000, isPlaying: true };

console.log('\n  returning to the app after a stale reading:');
{
  const { call, step, state } = load();
  state.entry = playing;
  let out = call();
  out = await step();
  check('the drive is playing', out.track?.isPlaying === true);
  state.adopted.length = 0;

  // THE RESUME. The system player answers "not playing" once while it comes
  // back up, and the music is in fact still going.
  state.entry = { ...playing, isPlaying: false };
  out = await step();
  check('ONE stale reading does not pause the transport',
    !state.adopted.includes(false), JSON.stringify(state.adopted));
  check('...and does not stop the scene either — the disc keeps turning',
    out.track?.isPlaying === true, String(out.track?.isPlaying));

  // The player catches up: it was playing all along.
  state.entry = playing;
  out = await step();
  check('when it catches up nothing ever visibly changed', out.track?.isPlaying === true);
  check('the drive was never told to pause', !state.adopted.includes(false), JSON.stringify(state.adopted));
}

console.log('\n  a REAL pause still lands, and quickly:');
{
  const { call, step, state } = load();
  state.entry = playing;
  let out = call();
  out = await step();
  state.adopted.length = 0;

  // Genuinely paused elsewhere — the Music app, a Bluetooth drop. It keeps
  // saying so, so the second answer confirms it.
  state.entry = { ...playing, isPlaying: false };
  out = await step();
  check('first answer is held (not yet believed)', !state.adopted.includes(false));
  out = await step();
  check('the second answer is believed — the drive pauses',
    state.adopted.includes(false), JSON.stringify(state.adopted));
  check('and the scene stops too', out.track?.isPlaying === false, String(out.track?.isPlaying));
}

console.log('\n  music starting is still adopted immediately:');
{
  const { call, step, state } = load();
  state.entry = { ...playing, isPlaying: false };
  let out = call();
  out = await step();
  out = await step();          // settle into a real paused state
  state.adopted.length = 0;

  state.entry = playing;
  out = await step();
  check('one reading is enough to start — no waiting to hear music',
    state.adopted.includes(true), JSON.stringify(state.adopted));
  check('the scene runs at once', out.track?.isPlaying === true);
}

console.log('\n  a blip does not leave the count armed for next time:');
{
  const { call, step, state } = load();
  state.entry = playing;
  let out = call();
  out = await step();
  state.adopted.length = 0;

  state.entry = { ...playing, isPlaying: false };   // blip 1
  out = await step();
  state.entry = playing;                            // recovered
  out = await step();
  state.entry = { ...playing, isPlaying: false };   // a LATER, unrelated blip
  out = await step();
  check('the counter reset, so one later blip still does not pause',
    !state.adopted.includes(false), JSON.stringify(state.adopted));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a drive that never stopped is never shown as stopped\n');
process.exit(fails ? 1 : 0);
