// A NATIVE CALL THAT HANGS MUST NOT LEAVE A STATION LOOKING FROZEN.
//
// Ethan (25.08): "if the Apple Music app is not open cruise fm will not play
// music and will freeze inside a station." bridge.play()/bridge.playPlaylist()
// are `try?` on the Swift side and were awaited with no bound — a native call
// that HANGS rather than throws left startApplePlaylist's promise never
// resolving, so nothing ever reported a verdict and no notice ever appeared.
//
// This can't reproduce the native hang itself (no device, Swift not
// buildable here), but it CAN prove the bound: a bridge that never answers
// must still make startApplePlaylist settle, on 'error', within a few
// seconds — not never.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/appleMusic.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load(bridgeOverrides = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const bridge = {
    requestAuthorization: async () => 'authorized',
    authorizationStatus: async () => 'authorized',
    canPlayCatalog: async () => true,
    currentEntry: async () => null,
    play: async () => {},
    pause: async () => {},
    next: async () => {},
    previous: async () => {},
    seekTo: async () => {},
    setShuffle: async () => {},
    setRepeat: async () => {},
    playPlaylist: async () => {},
    userPlaylists: async () => [],
    playlistTracks: async () => [],
    playTrackInPlaylist: async () => {},
    ...bridgeOverrides,
  };

  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => bridge };
    if (name === 'react-native') return { NativeModules: {}, Platform: { OS: 'ios' } };
    if (name === './appleArtwork') return { probeAppleArtwork: async () => 'no answer' };
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return m.exports;
}

const timed = async (fn) => {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
};

console.log('\n  the ordinary case is unaffected:');
{
  const { startApplePlaylist } = load();
  const { result, ms } = await timed(() => startApplePlaylist('applemusic:playlist:abc'));
  check('a bridge that answers normally still returns playing', result === 'playing');
  check('...and does so quickly, not after the timeout', ms < 1000, `took ${ms}ms`);
}

console.log('\n  a bridge that never answers:');
{
  const hung = new Promise(() => {}); // never resolves, never rejects
  const { startApplePlaylist } = load({ playPlaylist: () => hung });
  const { result, ms } = await timed(() => startApplePlaylist('applemusic:playlist:abc'));
  check('settles on error rather than hanging forever', result === 'error', `got ${result}`);
  check('settles within a bounded window', ms < 7000 && ms >= 5900, `took ${ms}ms`);
}
{
  // The no-playlist branch calls bridge.play() instead — same bound applies.
  const hung = new Promise(() => {});
  const { startApplePlaylist } = load({ play: () => hung });
  const { result, ms } = await timed(() => startApplePlaylist(undefined));
  check('the play() branch is bounded the same way', result === 'error' && ms < 7000, `got ${result} in ${ms}ms`);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a hung Apple Music call reports itself instead of freezing the station\n');
process.exit(fails ? 1 : 0);
