// OFFLINE, WITH DOWNLOADED MUSIC — owner, in the car: "I used Cruise FM
// without using any data, but I used music downloaded from Spotify... I
// thought Cruise FM can work without wifi."
//
// The visuals do. Spotify's CONTROL cannot, and never will: api.spotify.com
// is a cloud service, so telling Spotify what to play is a network call even
// when the song is already on the phone. What was wrong was the EXPLANATION —
// every failure produced "Spotify didn't respond, check it's open and logged
// in", which is unhelpable advice for someone with no signal.
//
// This transpiles the shipped spotify.ts against a fetch that fails the way
// an offline phone does, and checks the app can tell that apart from Spotify
// answering with an error.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/spotify.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load(fetchImpl) {
  // A CONNECTED driver with no signal is the case that matters — hers. With
  // no stored token the app never reaches the network at all, so it could not
  // tell offline from never-signed-in, and the first run of this test caught
  // exactly that.
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const disk = new Map([['spotify_refresh_token', 'refresh-abc'], ['spotify_access_token', 'tok']]);
  const m = { exports: {} };
  const req = (name) => {
    if (name === '@react-native-async-storage/async-storage') return {
      getItem: async (k) => disk.get(k) ?? null,
      multiGet: async (ks) => ks.map((k) => [k, disk.get(k) ?? null]),
      multiSet: async (ps) => { ps.forEach(([k, v]) => disk.set(k, v)); },
      multiRemove: async (ks) => { ks.forEach((k) => disk.delete(k)); },
      setItem: async (k, v) => { disk.set(k, v); },
      removeItem: async (k) => { disk.delete(k); },
    };
    // Everything else this module reaches for is inert for these cases.
    return new Proxy({}, { get: () => () => {} });
  };
  new Function('module', 'exports', 'require', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', js)(
    m, m.exports, req, fetchImpl, globalThis.AbortController, globalThis.setTimeout, globalThis.clearTimeout);
  return m.exports;
}

console.log('\n  a phone with no signal:');
{
  // What RN throws when the request never leaves the device.
  const offlineFetch = async () => { throw new TypeError('Network request failed'); };
  const S = load(offlineFetch);
  check('starts out not claiming to be offline', S.looksOffline() === false);
  // Any call that reaches the network marks it.
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('a failed request is recognised as offline', S.looksOffline() === true);
}

console.log('\n  a phone that CAN reach Spotify:');
{
  const okFetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
  const S = load(okFetch);
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('a reachable server is never called offline', S.looksOffline() === false);
}

console.log('\n  Spotify answering with an error is NOT offline:');
{
  // A real response with a failing status — the server was reached.
  const errFetch = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
  const S = load(errFetch);
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('a 500 is Spotify being unhappy, not the phone being offline',
    S.looksOffline() === false);
}

console.log('\n  signal coming back clears it (a car is not offline for ever):');
{
  let online = false;
  const flaky = async () => {
    if (!online) throw new TypeError('Network request failed');
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  const S = load(flaky);
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('offline while it is', S.looksOffline() === true);
  online = true;
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('one successful request clears it', S.looksOffline() === false);
}

console.log('\n  it is a recency check, not a latch:');
{
  const S = load(async () => { throw new TypeError('Network request failed'); });
  await S.startPlayback('spotify:playlist:x').catch(() => {});
  check('true within the window', S.looksOffline(30_000) === true);
  check('false once the window has passed', S.looksOffline(0) === false);
}

console.log('\n  the notice a driver actually reads:');
{
  const ctx = fs.readFileSync('/home/user/CruiseFM/src/context/NowPlayingContext.tsx', 'utf8');
  const line = /'offline':\s*"([^"]+)"/.exec(ctx)?.[1] ?? '';
  check('there is an offline notice at all', line.length > 0);
  check('it does not tell them to check Spotify is logged in',
    !/logged in/i.test(line), line);
  check('it says they are offline', /offline/i.test(line));
  check('it says what still works rather than only what does not',
    /visual|downloaded/i.test(line), line);
  check("offline falls through to the deep link, which needs no signal",
    /r !== 'offline'/.test(ctx));
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  offline is told apart from Spotify saying no\n');
process.exit(fails ? 1 : 0);
