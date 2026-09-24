// NOBODY IS THROWN INTO SPOTIFY WHO DID NOT CHOOSE SPOTIFY.
//
// Owner, 2026-09-24: "i found a bug where spotify is disconnect and
// unselected and when i click on afterhours FM station - specifically in the
// horizon mode it still opens spotify - can this be removed?"
//
// It could, and the cause is a gate that exists in one branch of
// playStationMusic and not the other. The `!linked` branch already states the
// rule in as many words — "only nudge Spotify-platform people... other
// listeners run their music in their own app, Cruise FM is the visual
// companion, silently" — and returns null for everyone else. The branch that
// DOES find a playlist had no such test and walked all the way to
// `openInSpotify(linked.uri)`.
//
// AND A COMPANION LISTENER REALLY DOES FIND ONE, which is the part that is
// easy to miss: `currentPlatform()` in stationPlaylists.ts answers 'spotify'
// for anything that is not 'appleMusic', so somebody who pressed "Skip for
// now" still reads the SPOTIFY slot. That is deliberate — it is what lets a
// pasted Spotify link work for someone who never chose a service — so any
// station linked while they were on Spotify still hands back a spotify: uri
// long after they have left.
//
// THE HAND-OFF ITSELF IS NOT THE BUG AND MUST SURVIVE. Spotify grants in-app
// control to five invited accounts and refuses everyone else, so for a
// Spotify listener who cannot connect, deep-linking the playlist IS the
// product (08.08). The fix is only about WHO gets it.
//
// Driven directly rather than in a browser: the rule is deterministic, and a
// browser has no Spotify app to be thrown into.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/context/NowPlayingContext.tsx';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mount({ platform, connected, linked = true, asked = true, startResult = 'no-device' }) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const opened = [];          // every uri handed to the Spotify app
  let slots = [], idx = 0, effects = [], value = null, rendering = false, dirty = false;

  const React = {
    createContext: () => ({ Provider: () => null }),
    useContext: () => ({ isPro: true }),
    useCallback: (fn) => fn,
    useMemo: (fn) => { const v = fn(); value = v; return v; },
    useRef: (init) => { const i = idx++; if (!(i in slots)) slots[i] = { current: init }; return slots[i]; },
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
      AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' },
    };
    if (name === 'expo-keep-awake') return { activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: () => {} };
    if (name === '@/constants/modeCatalog') return { needsPreview: () => false };
    if (name === '@/context/EntitlementsContext') return { useEntitlements: () => ({ isPro: true }) };
    if (name === '@/utils/driveStats') return { noteDriveMode: async () => {}, recordDriveEnd: async () => null };
    if (name === '@/utils/rememberCruise') return { rememberCruise: async () => {} };
    if (name === '@/utils/musicPlatform') return { getSavedPlatform: async () => platform };
    // APPLE'S MODULE IS ONLY PRESENT FOR AN APPLE LISTENER, which is how a
    // build without MusicKit behaves and is the case that falls through to
    // the Spotify path by accident.
    if (name === '@/utils/appleMusic') return {
      appleMusicAvailable: () => platform === 'appleMusic',
      applePause: async () => {}, applePlay: async () => {},
      appleQueueState: async () => null,
      isAppleMusicConnected: async () => platform === 'appleMusic',
      isApplePlaylist: (uri) => String(uri).startsWith('applemusic:'),
      resumeAppleQueue: async () => {},
      startApplePlaylist: async () => 'playing',
    };
    if (name === '@/utils/spotify') return {
      getPlaybackState: async () => null,
      isRestrictedAccount: async () => false,
      isSpotifyConnected: async () => connected,
      looksOffline: () => false,
      pause: async () => {},
      probePlaybackState: async () => ({ kind: 'state', data: null }),
      // Whatever the caller asked for: 'no-device' is the snoozing Spotify
      // that the hand-off exists to rescue.
      startPlayback: async () => startResult,
      startActionFor: () => 'start',
    };
    if (name === '@/utils/startAction') return { startActionFor: () => 'start' };
    if (name === '@/utils/spotifyHandoff') return {
      // THE STUB IS THE ASSERTION (15.09): what we need to know is whether
      // the app tried to leave, so record it rather than swallowing it.
      openInSpotify: async (uri) => { opened.push(uri); return true; },
    };
    if (name === '@/utils/spotifyConnectAsk') return {
      spotifyConnectAsked: async () => asked,
      markSpotifyConnectAsked: async () => {},
    };
    if (name === '@/utils/stationPlaylists') return {
      // A spotify: uri even for a companion listener — see the note above.
      getStationPlaylist: async (id) => (linked ? { uri: `spotify:playlist:${id}`, name: id } : null),
    };
    return new Proxy({}, { get: () => () => {} });
  };

  const m = { exports: {} };
  new Function('module', 'exports', 'require', 'React', js)(m, m.exports, req, { ...React, createElement: () => null });

  function render() {
    do {
      dirty = false; idx = 0; effects = []; rendering = true;
      m.exports.NowPlayingProvider({ children: null });
      rendering = false;
      effects.forEach((fn) => { try { fn(); } catch { /* stubbed away */ } });
    } while (dirty);
  }
  render();
  return { opened, api: () => value };
}

async function drive(opts) {
  const { opened, api } = mount(opts);
  api().open('horizon', 'after-midnight');
  await sleep(400);
  return opened;
}

console.log('\n  the reported bug — Spotify unselected and disconnected:');
{
  const opened = await drive({ platform: 'none', connected: false });
  check('a companion listener is never thrown into Spotify',
    opened.length === 0, `opened: ${JSON.stringify(opened)}`);
}

console.log('\n  and the same for everyone else who runs their own music:');
for (const platform of ['youtubeMusic', 'amazonMusic', 'tidal']) {
  const opened = await drive({ platform, connected: false });
  check(`${platform} stays in the app`, opened.length === 0, JSON.stringify(opened));
}

console.log('\n  an Apple Music listener never reaches the Spotify path at all:');
{
  const opened = await drive({ platform: 'appleMusic', connected: false });
  check('Apple Music is left alone', opened.length === 0, JSON.stringify(opened));
}

console.log('\n  THE CONTROL — the hand-off is the product for Spotify listeners:');
{
  // Five accounts get in-app control and everyone else is refused before a
  // token exists, so this path must keep working or the fix has broken the
  // thing it was protecting.
  const opened = await drive({ platform: 'spotify', connected: false, asked: true });
  check('a Spotify listener who cannot connect is still handed off',
    opened.length === 1, JSON.stringify(opened));
}
{
  // Connected, but Spotify has dozed off Connect and reports no device.
  const opened = await drive({ platform: 'spotify', connected: true, startResult: 'no-device' });
  check('a snoozing Spotify is still woken by the deep link',
    opened.length === 1, JSON.stringify(opened));
}
{
  const opened = await drive({ platform: 'spotify', connected: true, startResult: 'playing' });
  check('a working start never opens Spotify', opened.length === 0, JSON.stringify(opened));
}

console.log(fails ? `\n  ${fails} FAILED\n` : '\n  nobody is thrown into Spotify who did not choose it\n');
process.exit(fails ? 1 : 0);
