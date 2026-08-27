// A SINGLE EARLY READING MUST NOT RESTART A PLAYLIST THAT WAS ABOUT TO PLAY
// FINE, AND A NATIVE CALL THAT HANGS MUST NOT FREEZE THE RECOVERY PATH.
//
// Ethan, 27.08 (his second round of Apple Music reports): "if I am playing
// music already from Apple Music then after about 1 song the playlist will
// start from the top but won't play", plus "occasionally the app will
// freeze and I'll have to force close it".
//
// TWO BUGS, both found reading the code this session rather than guessed at
// blind, and both fit the shape of a bug already fixed once for a SIBLING
// symptom on 26.08 (RESUME_SETTLE_MS): MusicKit can take up to ~3s to
// answer honestly after a resume, measured from the owner's own clip.
//
//   (A) `verifyResume` asked ONCE at 1.6s and, on a single "not playing"
//       answer, called `recoverApplePlayback` — which re-queues the
//       playlist from track one. A perfectly healthy resume landing inside
//       that known-lying window was read as a failure and "recovered" by
//       restarting from the top. Fixed with a second, later look before
//       giving up (RESUME_RECHECK_MS), the same patience the 5s poll
//       already has.
//   (B) `recoverApplePlayback`'s own native calls were NOT timeout-wrapped,
//       even though `withTimeout` exists specifically because a Swift
//       `try?` call can hang rather than throw — and this is the recovery
//       path a stalled resume calls into. Fixed by wrapping them the same
//       way `startApplePlaylist`'s already were.
//
// Both are proven against the ORIGINAL source text (read via `git show`,
// never touching the working tree) as a control BEFORE testing the fix, so
// this suite can't quietly pass by testing nothing.
//
// ADVANCE BY COUNTED READS, NEVER BY WALL-CLOCK SLEEPS — the rule
// test-apple-resume-blip.mjs already learned the hard way. The first cut of
// this file slept a fixed number of milliseconds against real setTimeouts
// and flapped between pass and fail on identical code, purely on timer
// jitter: some runs landed either side of the 1.6s / 3.6s boundaries. The
// stub counts every `getAppleNowPlaying` call instead, and the test waits
// for a specific read NUMBER, so it is deterministic however the timers
// happen to line up on the day.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const HOOK_SRC_PATH = `${REPO}/src/utils/useAppleMusicPlayback.ts`;
const APPLE_SRC_PATH = `${REPO}/src/utils/appleMusic.ts`;
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function original(path) {
  // The last committed version, BEFORE this session's fix — the control.
  const rel = path.slice(REPO.length + 1);
  let src = execSync(`git show HEAD:${rel}`, { cwd: REPO, encoding: 'utf8' });
  if (rel.endsWith('useAppleMusicPlayback.ts')) {
    /**
     * THE CONTROL CARRIES THE askedAt FIX, DELIBERATELY.
     *
     * The old text read `const askedAt = Date.now()` while `play` had
     * stamped `lastControlRef.current` from its own `Date.now()` one line
     * earlier — so whenever the millisecond ticked between them the guard
     * fired instantly and verifyResume did nothing at all. That is its own
     * bug (fixed in src, and it is very likely the "occasionally" in
     * Ethan's report), but leaving it in the control makes the control
     * NON-DETERMINISTIC: it would half the time prove nothing rather than
     * reproduce the bug under test. Patching just that line isolates the
     * single-check behaviour, which is what this control is for.
     */
    const before = src;
    src = src.replace('const askedAt = Date.now();', 'const askedAt = lastControlRef.current;');
    if (src === before) throw new Error('control patch did not apply — has the original text changed?');
  }
  return src;
}

// ---------------------------------------------------------------------
// (A) verifyResume's patience
// ---------------------------------------------------------------------

function makeReact() {
  let states = [], idx = 0, effects = [];
  const React = {
    useState: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: typeof init === 'function' ? init() : init };
      return [states[i].v, (next) => { states[i].v = typeof next === 'function' ? next(states[i].v) : next; }];
    },
    useRef: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: { current: init } };
      return states[i].v;
    },
    useEffect: (fn) => { effects.push(fn); },
  };
  const render = (component, args) => {
    idx = 0; effects = [];
    const out = component(...args);
    for (const e of effects) e();
    return out;
  };
  return { React, render };
}

/**
 * Loads useAppleMusicPlayback.ts (from `src` — either the live working-tree
 * text or a control string) against a bridge whose `currentEntry` answer is
 * driven by the test via `state.isPlaying`, and calls `.play()` on it once.
 */
function loadHook(src, { isPlayingAfterPress } = {}) {
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const { React, render } = makeReact();
  const calls = [];
  // `reads` counts every answer the hook actually took — the test advances
  // on this rather than on elapsed time. See the note at the top.
  const state = { isPlaying: isPlayingAfterPress, reads: 0 };
  const req = (name) => {
    if (name === 'react') return React;
    if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } };
    if (name === '@/utils/useAppActive') return { isInFront: () => true };
    if (name === '@/context/NowPlayingContext') return { useActivityPing: () => () => {}, useAdoptPlayState: () => () => {} };
    if (name === './appleArtwork') return { lookupAppleArtwork: async () => null };
    if (name === './useSpotifyPlayback') return {
      backButtonAction: () => 'previous',
      TOGGLE_GUARD_MS: 6000,
      acceptReported: () => true,
    };
    if (name === './appleMusic') return {
      appleMusicAvailable: () => true, isAppleMusicConnected: async () => true,
      getAppleLibraryArtwork: async () => null,
      getAppleNowPlaying: async () => {
        state.reads += 1;
        return {
          title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 1000,
          isPlaying: state.isPlaying,
        };
      },
      recoverApplePlayback: async (resumeAt) => { calls.push(['recover', resumeAt]); return true; },
      appleNext: async () => {}, applePrev: async () => {},
      applePlay: async () => {}, applePause: async () => {},
      appleSeekTo: async () => {}, appleSetShuffle: async () => {}, appleSetRepeat: async () => {},
    };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  const hook = m.exports.useAppleMusicPlayback;
  const out = render(hook, [true, { pollMs: 999999 }]); // poll parked well out of the way
  out.play();
  /** Resolve once the hook has taken at least `n` readings — the
   *  deterministic replacement for sleeping a guessed number of ms. */
  const untilRead = async (n, capMs = 20000) => {
    const start = Date.now();
    while (state.reads < n && Date.now() - start < capMs) await sleep(10);
    return state.reads >= n;
  };
  return { calls, state, untilRead };
}

/**
 * WHICH READ IS WHICH, counted rather than timed. Pressing play produces a
 * fixed, deterministic sequence of `getAppleNowPlaying` calls:
 *   read 1 — the mount refresh
 *   read 2 — `after()`, the 500ms re-read every control does
 *   read 3 — verifyResume's FIRST check (RESUME_CHECK_MS, 1.6s)
 *   read 4 — verifyResume's SECOND check (+RESUME_RECHECK_MS) — fixed only
 * The original code has no read 4: it acts on read 3 and stops.
 */
const FIRST_CHECK = 3;
const SECOND_CHECK = 4;

console.log("\n  a resume that only settles AFTER the old single check window:");
{
  console.log('    against the ORIGINAL code (control — must reproduce the bug):');
  const { calls, untilRead } = loadHook(original(HOOK_SRC_PATH), { isPlayingAfterPress: false });
  check('the old code reached its one and only check', await untilRead(FIRST_CHECK));
  await sleep(50); // let the recover call it makes land
  check('the OLD code wrongly recovers a healthy, merely-slow resume',
    calls.some(([f]) => f === 'recover'), JSON.stringify(calls));
}
{
  console.log('    against the FIXED code:');
  const { calls, state, untilRead } = loadHook(fs.readFileSync(HOOK_SRC_PATH, 'utf8'), { isPlayingAfterPress: false });
  check('reached the first check', await untilRead(FIRST_CHECK));
  state.isPlaying = true;   // the resume was fine all along, just slow to report
  check('reached the second check', await untilRead(SECOND_CHECK));
  await sleep(50);
  check('the fix gives it a second look and does NOT recover a healthy resume',
    !calls.some(([f]) => f === 'recover'), JSON.stringify(calls));
}

console.log('\n  a resume that genuinely never takes still gets recovered:');
{
  const { calls, untilRead } = loadHook(fs.readFileSync(HOOK_SRC_PATH, 'utf8'), { isPlayingAfterPress: false });
  check('reached the second check', await untilRead(SECOND_CHECK));
  await sleep(50);
  check('the final check still recovers a genuine failure',
    calls.some(([f]) => f === 'recover'), JSON.stringify(calls));
}

// ---------------------------------------------------------------------
// (B) recoverApplePlayback is timeout-bounded
// ---------------------------------------------------------------------

/**
 * The hang flags are checked INSIDE each bridge call, not baked into a
 * one-shot override — the same "queue successfully first, only then make
 * the re-queue refuse" shape test-apple-resume.mjs already uses, and it
 * matters here for the same reason: `lastQueuedUri` is only ever set by a
 * SUCCESSFUL call to `startApplePlaylist`, so seeding it and then testing a
 * hang on the recovery path needs the first call to genuinely succeed.
 */
function loadApple(src) {
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const hang = { playlist: false, seek: false, play: false };
  const forever = () => new Promise(() => {});
  const bridge = {
    currentEntry: async () => null,
    play: async () => { if (hang.play) return forever(); },
    playPlaylist: async () => { if (hang.playlist) return forever(); },
    seekTo: async () => { if (hang.seek) return forever(); },
  };
  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => bridge };
    if (name === 'react-native') return { NativeModules: {}, Platform: { OS: 'ios' } };
    if (name === './appleArtwork') return { probeAppleArtwork: async () => 'no answer' };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { ...m.exports, hang };
}
const timed = async (fn) => {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
};

console.log('\n  recoverApplePlayback against a queue that hangs rather than answers:');
{
  console.log('    against the ORIGINAL code (control — must hang):');
  const A = loadApple(original(APPLE_SRC_PATH));
  await A.startApplePlaylist('applemusic:playlist:abc'); // succeeds — sets lastQueuedUri
  A.hang.playlist = true; // NOW make the re-queue hang
  const raced = await Promise.race([
    A.recoverApplePlayback(60_000).then(() => 'settled'),
    sleep(2500).then(() => 'still hanging'),
  ]);
  check('the OLD code genuinely hangs past a short window', raced === 'still hanging', raced);
}
{
  console.log('    against the FIXED code:');
  const A = loadApple(fs.readFileSync(APPLE_SRC_PATH, 'utf8'));
  await A.startApplePlaylist('applemusic:playlist:abc');
  A.hang.playlist = true;
  const { result, ms } = await timed(() => A.recoverApplePlayback(60_000));
  check('the fix settles instead of hanging forever', result === false, `got ${result}`);
  check('...within a bounded window', ms < 7000 && ms >= 5900, `took ${ms}ms`);
}
{
  // The no-queue branch (bare bridge.play()) needed the same bound.
  const A = loadApple(fs.readFileSync(APPLE_SRC_PATH, 'utf8'));
  A.hang.play = true;
  const { result, ms } = await timed(() => A.recoverApplePlayback(60_000));
  check('the bare-play branch is bounded the same way', result === false && ms < 7000, `got ${result} in ${ms}ms`);
}
{
  const A = loadApple(fs.readFileSync(APPLE_SRC_PATH, 'utf8'));
  await A.startApplePlaylist('applemusic:playlist:abc');
  A.hang.seek = true;
  const { result, ms } = await timed(() => A.recoverApplePlayback(60_000));
  check('the seek step is bounded too', result === false && ms < 7000, `got ${result} in ${ms}ms`);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a healthy but slow resume is trusted, and a hung recovery cannot freeze the station\n');
process.exit(fails ? 1 : 0);
