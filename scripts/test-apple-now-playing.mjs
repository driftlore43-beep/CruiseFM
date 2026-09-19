// WHAT THE APP BELIEVES IS PLAYING ON APPLE MUSIC, AND WHY IT MUST DOUBT IT.
//
// `getAppleNowPlaying` is the single read every Apple Music drive is built
// on: the deck's song, the clock, the widget's cover and the queue check all
// start here. Two of its rules were written after real failures and neither
// has been checked since.
//
//   04.08  THE FOUND-BUT-BLANK BUG. MusicKit hands back `musicKit://` URLs
//          for library artwork — renderable only by Apple's own view, so
//          React Native's <Image> silently drew nothing. Worse, the url was
//          non-empty, so the fallback chase that would have fetched a real
//          one never ran: every diagnostic said "artwork yes" over a blank
//          deck. An unloadable url is worse than none.
//   build 21  A NATIVE CALL THAT HANGS rather than throws would wedge every
//          poll behind it and the whole app shows "no track". The read is
//          raced against a timeout so it degrades for one beat and recovers.
//
// Neither is reachable from a browser sweep — there is no MusicKit there at
// all — and neither shows on a device unless you happen to be looking at the
// one song whose artwork came back in the wrong scheme.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const SRC = `${REPO}/src/utils/appleMusic.ts`;

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

/** `entry` is whatever the native side hands back; `hang` never answers. */
function load({ entry = null, hang = false, scale = 50 } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const bridge = {
    currentEntry: async () => (hang ? new Promise(() => {}) : entry),
    playPlaylist: async () => {}, play: async () => {}, seekTo: async () => {},
  };
  const req = (n) => {
    if (n === 'expo-modules-core') return { requireOptionalNativeModule: () => bridge };
    if (n === 'react-native') return { NativeModules: {}, Platform: { OS: 'ios' } };
    if (n === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: { getItem: async () => null, setItem: async () => {} } };
    }
    return new Proxy({}, { get: () => () => {} });
  };
  // setTimeout is passed in so it shadows the global inside the module: the
  // real race is 4 seconds and this suite would otherwise sit through it.
  const fast = (fn, ms) => setTimeout(fn, Math.max(0, Math.round((ms ?? 0) / scale)));
  const m = { exports: {} };
  new Function('module', 'exports', 'require', 'setTimeout', js)(m, m.exports, req, fast);
  return m.exports;
}

const song = (artworkUrl) => ({
  title: 'Zero', artist: 'The Smashing Pumpkins', artworkUrl,
  durationMs: 200000, positionMs: 1000, isPlaying: true,
});

await (async () => {
  console.log('\n  an artwork url the app cannot draw is treated as none:');
  {
    const A = load({ entry: song('musicKit://artwork/library/abc/300x300') });
    const got = await A.getAppleNowPlaying();
    check('a musicKit:// url is nulled out', got?.artworkUrl === null, String(got?.artworkUrl));
    check('...and the rest of the song survives it', got?.title === 'Zero' && got?.isPlaying === true);
  }
  {
    // The whole point of nulling it: `undefined` would look like "this build
    // doesn't report artwork", while null is "there is none, go and find one".
    const A = load({ entry: song('musicKit://artwork/library/abc/300x300') });
    const got = await A.getAppleNowPlaying();
    check('it is null, not undefined — the chase reads the difference',
      got !== null && Object.prototype.hasOwnProperty.call(got, 'artworkUrl') && got.artworkUrl === null);
  }

  console.log('\n  a url the app CAN draw is left alone:');
  for (const [what, url] of [
    ['https, from the public catalogue lookup', 'https://is1-ssl.mzstatic.com/image/thumb/240x240bb.jpg'],
    ['http', 'http://example.com/a.jpg'],
    ['file://, from the MediaPlayer fallback', 'file:///var/mobile/art.jpg'],
    ['a data uri', 'data:image/jpeg;base64,/9j/4AAQ'],
  ]) {
    const A = load({ entry: song(url) });
    const got = await A.getAppleNowPlaying();
    check(`${what} is kept`, got?.artworkUrl === url, String(got?.artworkUrl));
  }
  {
    // A control: if EVERY url were nulled the cases above would pass by
    // accident and the app would simply never show a cover.
    const A = load({ entry: song(null) });
    check('no artwork at all is still null', (await A.getAppleNowPlaying())?.artworkUrl === null);
  }

  console.log('\n  nothing playing is not an error:');
  {
    const A = load({ entry: null });
    check('an empty queue reads as no track', (await A.getAppleNowPlaying()) === null);
  }

  console.log('\n  a native call that hangs degrades instead of wedging the poll:');
  {
    const A = load({ hang: true });
    const began = Date.now();
    const got = await Promise.race([
      A.getAppleNowPlaying(),
      new Promise((r) => setTimeout(() => r('STILL-HANGING'), 1500)),
    ]);
    check('it settles rather than hanging for ever', got !== 'STILL-HANGING');
    check('...and reports no track rather than a wrong one', got === null, String(got));
    check('...within its own bound, not the test\'s', Date.now() - began < 1200,
      `${Date.now() - began}ms`);
  }

  console.log(fails === 0
    ? '\n  the app never believes an artwork url it cannot draw, and a hung read recovers\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
