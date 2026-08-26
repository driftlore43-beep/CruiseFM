// SHUFFLE AND REPEAT MUST TELL THE TRUTH, NOT JUST FLIP THE ICON.
//
// Owner, 26.08: "the buttons highlight, but doesn't repeat." Before this,
// `useAppleMusicPlayback`'s shuffle/repeat did nothing but flip local state —
// `currentEntry` never reported the real setting, so there was nothing to
// reconcile against. A command that silently failed to reach the Music app
// was INDISTINGUISHABLE from one that worked: the button lit up either way.
//
// Fixed on both ends: the native side now reads the setting back off
// MPMusicPlayerController (the same bridge setShuffle/setRepeat write
// through, replacing the newer, less-trusted MusicKit `state` mutation this
// file cannot verify without a device), and the JS side holds a press
// against a stale poll exactly the way Spotify's already does (18.08) —
// imported wholesale rather than re-invented.
//
// THIS DRIVES REAL POLLS, not just re-renders — a re-render with no new
// data would trivially "pass" every one of these by doing nothing, which is
// the standing lesson about a test that can't fail. `pollMs` is set low and
// the test waits real milliseconds so the hook's own `setInterval` actually
// fires and calls the stubbed `getAppleNowPlaying` again.
//
// What's provable from here, and what isn't:
//   PROVABLE:     a genuine failure (command sent, Music app never obeys) now
//                 shows up as the button springing back, instead of lying.
//   NOT PROVABLE: whether MPMusicPlayerController's repeatMode/shuffleMode
//                 actually take on a real device — no device, can't build
//                 Swift here. That's the honest limit of this test.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/useAppleMusicPlayback.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeReact() {
  let states = [], idx = 0, effects = [], dirty = false;
  const React = {
    useState: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: typeof init === 'function' ? init() : init };
      const set = (next) => {
        const nv = typeof next === 'function' ? next(states[i].v) : next;
        if (nv !== states[i].v) { states[i].v = nv; dirty = true; }
      };
      return [states[i].v, set];
    },
    useRef: (init) => {
      const i = idx++;
      if (states[i] === undefined) states[i] = { v: { current: init } };
      return states[i].v;
    },
    useEffect: (fn) => { effects.push(fn); },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  };
  const render = (component, props) => {
    idx = 0; effects = [];
    const out = component(props);
    for (const e of effects) e();
    return out;
  };
  const reRenderWhileDirty = (component, props, max = 10) => {
    let out;
    do { dirty = false; out = render(component, props); } while (dirty && max-- > 0);
    return out;
  };
  return { React, render, reRenderWhileDirty };
}

/**
 * @param entry        what getAppleNowPlaying answers, mutable via the
 *                      returned `state.entry` so a test can change the
 *                      "truth" mid-run, as a real Music app would.
 * @param guardMs       stands in for TOGGLE_GUARD_MS.
 * @param pollMs        how often the hook's own interval re-asks — kept tiny
 *                      so a test can wait real (short) milliseconds rather
 *                      than the real 5s default.
 */
function load({ entry, guardMs = 6000, pollMs = 4 } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const { React, reRenderWhileDirty } = makeReact();
  const state = { entry };
  const req = (name) => {
    if (name === 'react') return React;
    if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } };
    if (name === '@/utils/useAppActive') return { isInFront: () => true };
    if (name === '@/context/NowPlayingContext') return { useActivityPing: () => () => {}, useAdoptPlayState: () => () => {} };
    if (name === './appleArtwork') return { lookupAppleArtwork: async () => null };
    if (name === './useSpotifyPlayback') return {
      backButtonAction: () => 'previous',
      TOGGLE_GUARD_MS: guardMs,
      acceptReported: (pending, reported, now) => !pending || pending.want === reported || now >= pending.until,
    };
    if (name === './appleMusic') return {
      appleMusicAvailable: () => true, isAppleMusicConnected: async () => true,
      getAppleLibraryArtwork: async () => null, getAppleNowPlaying: async () => state.entry,
      recoverApplePlayback: async () => false,
      appleNext: async () => {}, applePrev: async () => {}, applePlay: async () => {}, applePause: async () => {},
      appleSeekTo: async () => {}, appleSetShuffle: async () => {}, appleSetRepeat: async () => {},
    };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  const hook = m.exports.useAppleMusicPlayback;
  const run = () => reRenderWhileDirty(hook, [true, { pollMs }]);
  // The hook takes (visible, opts) — apply spreads the array as arguments.
  const call = () => reRenderWhileDirty((args) => hook(args[0], args[1]), [true, { pollMs }]);
  return { call, state };
}

console.log('\n  a command that genuinely fails springs back, not lies:');
{
  const { call, state } = load({
    entry: { title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 0,
      isPlaying: true, shuffleOn: false, repeatMode: 'off' },
  });
  let out = call();
  await sleep(20); out = call();
  check('starts off', out.shuffleOn === false);

  out.shuffle(true);
  out = call();
  check('lights up immediately (optimistic)', out.shuffleOn === true);

  // The Music app never actually obeyed — state.entry keeps saying false.
  // Several real polls land inside the 6s guard and must not un-light it.
  await sleep(20); out = call();
  check('poll landing inside the guard: still on', out.shuffleOn === true, String(out.shuffleOn));
  await sleep(20); out = call();
  check('a second poll, same guard: still on', out.shuffleOn === true, String(out.shuffleOn));
}

console.log('\n  a real success is reported honestly:');
{
  const { call, state } = load({
    entry: { title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 0,
      isPlaying: true, shuffleOn: false, repeatMode: 'off' },
  });
  let out = call();
  await sleep(20); out = call();

  out.shuffle(true);
  out = call();
  state.entry = { ...state.entry, shuffleOn: true };       // the Music app caught up
  await sleep(20); out = call();
  check('the poll agreeing keeps it on', out.shuffleOn === true);
}

console.log("\n  an older build with no shuffle/repeat field doesn't reset anything:");
{
  // No shuffleOn/repeatMode at all — the shape currentEntry had before 26.08.
  const { call } = load({
    entry: { title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 0, isPlaying: true },
  });
  let out = call();
  await sleep(20); out = call();

  out.shuffle(true);
  out = call();
  check('optimistic flip happens', out.shuffleOn === true);
  await sleep(20); out = call();
  check('a poll with the field simply absent leaves it alone', out.shuffleOn === true, String(out.shuffleOn));
  await sleep(20); out = call();
  check('...and stays that way', out.shuffleOn === true, String(out.shuffleOn));
}

console.log('\n  the repeat cycle is honest the same way, all three states:');
{
  const { call, state } = load({
    entry: { title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 0,
      isPlaying: true, shuffleOn: false, repeatMode: 'off' },
  });
  let out = call();
  await sleep(20); out = call();

  out.repeat('context');
  out = call();
  check('optimistic: repeat the playlist', out.repeatMode === 'context');
  state.entry = { ...state.entry, repeatMode: 'context' };
  await sleep(20); out = call();
  check('confirmed by the poll', out.repeatMode === 'context');

  out.repeat('track');
  out = call();
  state.entry = { ...state.entry, repeatMode: 'off' };      // it FAILED to take
  await sleep(20); out = call();
  check('a failed press still shows the optimistic guess inside the guard', out.repeatMode === 'track', out.repeatMode);
}

console.log('\n  and a command that NEVER takes eventually gives up the lie:');
{
  const { call, state } = load({
    guardMs: 1,     // expires almost instantly — proves the SHAPE of the
                    // rule without waiting out the real 6s (which the
                    // Spotify-side test already covers for the timing).
    entry: { title: 'S', artist: 'A', artworkUrl: null, durationMs: 1, positionMs: 0,
      isPlaying: true, shuffleOn: false, repeatMode: 'off' },
  });
  let out = call();
  await sleep(20); out = call();

  out.shuffle(true);
  out = call();
  check('optimistic flip happens', out.shuffleOn === true);
  await sleep(20); out = call();                            // guard long expired by now
  check('once the guard expires, the truth wins — it does NOT lie forever',
    out.shuffleOn === false, String(out.shuffleOn));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : "\n  the toggle believes the player, not just its own last press\n");
process.exit(fails ? 1 : 0);
