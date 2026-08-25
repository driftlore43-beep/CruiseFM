// ONLY THE STATION YOU LAND ON TALKS TO THE MUSIC SERVICE.
//
// A listener reported the app freezing when he changed station from the Tuner
// (23.08). The Tuner is the only place in the app that retunes mid-drive, and
// that path deliberately restarts the music — so hunting across the dial used
// to start one uncancellable chain per landing, each with its own delayed
// kick, its own conversation with Spotify and its own playback notice
// resolving out of order. That notice is its own iOS window, so a stack of
// them mounts and unmounts real windows over the mode's own: the third-window
// trap, where iOS presents nothing and swallows every touch.
//
// THIS IS TESTED HERE RATHER THAN IN A BROWSER, and that was learned the
// expensive way. Six versions of a Playwright probe measured 8 calls against
// 10, then 11 against 8 — noise either way, because a browser refuses requests
// instantly (so chains never overlap), its mouse is too slow to land stations
// inside the 900ms breath, and it has no iOS windows to stack in the first
// place. What it CAN still show is that rapid tuning leaves the app
// interactive, and scripts/harness/tuner-sweep.mjs is kept for exactly that
// and claims nothing more.
//
// The rule itself is deterministic, so it is driven directly: the context is
// transpiled and run against a tiny hook runtime and a stubbed, deliberately
// SLOW music service — a car going through a tunnel, which is the condition
// the bug was reported under.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/context/NowPlayingContext.tsx';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How long the stubbed service takes to answer. Longer than the breath, so
 *  a chain is still talking when the next landing arrives — which is the
 *  whole point. */
const SERVICE_MS = 2500;

function mount() {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const calls = [];
  const slow = (name, result) => async (...args) => {
    calls.push(name);
    await sleep(SERVICE_MS);
    return typeof result === 'function' ? result(...args) : result;
  };

  // A minimum viable hook runtime: state that really holds, refs that persist
  // across renders, and effects that run after each one. Enough to drive the
  // provider's own callbacks, which is all this needs.
  let slots = [];
  let idx = 0;
  let effects = [];
  let value = null;
  let rendering = false;
  let dirty = false;

  const React = {
    createContext: () => ({ Provider: () => null }),
    useContext: () => ({ isPro: true }),
    useCallback: (fn) => fn,
    useMemo: (fn) => { const v = fn(); value = v; return v; },
    useRef: (init) => {
      const i = idx++;
      if (!(i in slots)) slots[i] = { current: init };
      return slots[i];
    },
    useState: (init) => {
      const i = idx++;
      if (!(i in slots)) slots[i] = init;
      return [slots[i], (next) => {
        slots[i] = typeof next === 'function' ? next(slots[i]) : next;
        if (rendering) { dirty = true; return; }
        render();
      }];
    },
    useEffect: (fn) => { effects.push(fn); },
  };

  const req = (name) => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    if (name === 'react-native') return {
      AppState: { addEventListener: () => ({ remove() {} }) },
      Platform: { OS: 'ios' },
    };
    if (name === 'expo-keep-awake') return {
      activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: () => {},
    };
    if (name === '@/constants/modeCatalog') return { isProMode: () => false };
    if (name === '@/context/EntitlementsContext') return { useEntitlements: () => ({ isPro: true }) };
    if (name === '@/utils/driveStats') return {
      noteDriveMode: async () => {}, recordDriveEnd: async () => null,
    };
    if (name === '@/utils/musicPlatform') return { getSavedPlatform: async () => 'spotify' };
    if (name === '@/utils/appleMusic') return {
      appleMusicAvailable: () => false, applePause: async () => {}, applePlay: async () => {},
      isAppleMusicConnected: async () => false, isApplePlaylist: () => false,
      startApplePlaylist: async () => 'playing',
    };
    if (name === '@/utils/spotify') return {
      getPlaybackState: async () => null,
      isRestrictedAccount: async () => false,
      isSpotifyConnected: async () => true,
      looksOffline: () => false,
      pause: slow('pause'),
      probePlaybackState: slow('probe', { kind: 'state', data: null }),
      startPlayback: slow('start', 'playing'),
    };
    if (name === '@/utils/spotifyHandoff') return { openInSpotify: async () => {} };
    if (name === '@/utils/stationPlaylists') return {
      getStationPlaylist: async (id) => ({ uri: `spotify:playlist:${id}`, name: id }),
    };
    return new Proxy({}, { get: () => () => {} });
  };

  const m = { exports: {} };
  // The classic JSX transform emits bare `React.createElement`, so the name has
  // to be in scope — the provider's own return statement is the only JSX here.
  new Function('module', 'exports', 'require', 'React', js)(m, m.exports, req, {
    ...React, createElement: () => null,
  });

  function render() {
    do {
      dirty = false;
      idx = 0;
      effects = [];
      rendering = true;
      m.exports.NowPlayingProvider({ children: null });
      rendering = false;
      effects.forEach((fn) => { try { fn(); } catch { /* stubbed away */ } });
    } while (dirty);
  }

  render();
  return { calls, api: () => value };
}

// Four landings, each arriving while the last is still talking. This is a
// thumb hunting across the dial: the needle settles, the music starts to
// change, and before it can finish the thumb has moved again.
const LANDINGS = ['sunset', 'daylight', 'coastal', 'downtown'];
const GAP_MS = 500;   // well inside the 900ms breath

console.log('\n  hunting across the dial:');
{
  const { calls, api } = mount();
  api().open('tuner', 'night-run', { paused: true });
  await sleep(50);
  calls.length = 0;

  for (const id of LANDINGS) {
    api().setStationId(id);
    await sleep(GAP_MS);
  }
  // Long enough for every chain that was ever going to speak to have done so.
  await sleep(900 + SERVICE_MS + 1200);

  // The breath's own pause happens on every landing and is never stale — it
  // belongs to the change being made, not to a change already left behind.
  const conversations = calls.filter((c) => c !== 'pause').length;
  check('only the station you land on starts its music',
    conversations > 0 && conversations <= 3, `calls: ${JSON.stringify(calls)}`);
  check('it does start SOMETHING — a silent dial would be the worse bug',
    conversations > 0, JSON.stringify(calls));
  console.log('       calls:', JSON.stringify(calls));
}

console.log('\n  one landing on its own is untouched:');
{
  const { calls, api } = mount();
  api().open('tuner', 'night-run', { paused: true });
  await sleep(50);
  calls.length = 0;

  api().setStationId('sunset');
  await sleep(900 + SERVICE_MS + 1200);
  const conversations = calls.filter((c) => c !== 'pause').length;
  check('a single station change still talks to the service', conversations > 0,
    JSON.stringify(calls));
}

console.log('\n  and landing back where you started changes nothing:');
{
  const { calls, api } = mount();
  api().open('tuner', 'night-run', { paused: true });
  await sleep(50);
  calls.length = 0;
  api().setStationId('night-run');
  await sleep(600);
  check('retuning to the station already playing is ignored',
    calls.length === 0, JSON.stringify(calls));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a burst of station changes makes one conversation, not one each\n');
process.exit(fails ? 1 : 0);
