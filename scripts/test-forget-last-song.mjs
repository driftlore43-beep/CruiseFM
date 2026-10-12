// "DELETE MY DATA" LEFT A PICTURE OF YOUR LAST SONG ON YOUR HOME SCREEN.
//
// Owner, 12.10, taking the widget screenshot for the 1.4.3 listing: the big
// turntable was drawing a commercial album cover on its label, and there was
// no way to get rid of it short of reinstalling the app. Reading the code
// settled why: the widgets say what the last song was from TWO places, and
// nothing cleared either of them.
//
//   1. The TITLE AND ARTIST ride in the snapshot, built from
//      `getLastPlayed()` — i.e. AsyncStorage.
//   2. The COVER is a JPEG this app wrote into the App Group container, which
//      only the native bridge can remove (`setArtwork(null)`).
//
// `AsyncStorage.clear()` — the whole of what "Delete My Data" did — reaches
// neither. It wiped the app and left the widgets intact, which is a privacy
// button that keeps publishing the thing it claims to have deleted. The same
// gap left every custom station's photograph sitting in the shared container
// after the station that owned it was gone.
//
// THE RULES PROVEN HERE, each with a control that fails in the other
// direction, because "it cleared something" is not the claim:
//
//   - forgetting clears BOTH halves, not just the one JavaScript can see
//   - a cover that was never shipped is not reported as cleared (vacuous pass)
//   - station photographs are cleared, and only ever with null
//   - the ORDER inside Delete My Data: widgets first (the station list it
//     reads is about to be destroyed), storage second, publish last
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const compile = (src) => ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// One store and one bridge shared by both real modules, so "forget" has to
// clear the very thing "note" wrote rather than a convenient copy of it.
function harness({ stations = [], withBridge = true } = {}) {
  const store = new Map();
  const calls = [];
  const bridge = {
    setArtwork: async (b64) => { calls.push(['setArtwork', b64]); return true; },
    setStationImage: async (id, b64) => { calls.push(['setStationImage', id, b64]); return true; },
  };
  const asyncStorage = {
    __esModule: true,
    default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => { store.set(k, v); },
      removeItem: async (k) => { store.delete(k); },
    },
  };

  const load = (path, extra = {}) => {
    const m = { exports: {} };
    new Function('module', 'exports', 'require', compile(fs.readFileSync(`${REPO}/${path}`, 'utf8')))(
      m, m.exports,
      (name) => {
        if (name === '@react-native-async-storage/async-storage') return asyncStorage;
        if (name === 'expo-modules-core') {
          return { requireOptionalNativeModule: () => (withBridge ? bridge : null) };
        }
        if (extra[name]) return extra[name];
        // expo-image-manipulator / expo-file-system are reached inside a
        // try/catch and are not on any path under test.
        throw new Error(`unstubbed require: ${name}`);
      },
    );
    return m.exports;
  };

  const lastPlayed = load('src/utils/lastPlayed.ts');
  const art = load('src/utils/widgetArtwork.ts', {
    './lastPlayed': lastPlayed,
    './customStations': {
      cachedCustomStations: () => stations,
      loadCustomStations: async () => stations,
    },
  });
  return { store, calls, lastPlayed, art };
}

await (async () => {
  console.log('\n  forgetting clears both halves:');
  const h = harness();
  await h.lastPlayed.noteLastPlayed('Twin Flame', 'Kaytranada', 'https://x/cover.jpg');

  // THE CONTROL. Without this the whole suite could pass against a song that
  // was never stored, which is exactly how a clearing test goes vacuous.
  const before = await h.lastPlayed.getLastPlayed();
  check('the setup really stored a song', before?.title === 'Twin Flame', JSON.stringify(before));

  await h.art.forgetLastSongForWidgets();
  const after = await h.lastPlayed.getLastPlayed();
  check('the stored song is gone', after === null, JSON.stringify(after));

  const cleared = h.calls.filter((c) => c[0] === 'setArtwork');
  check('the bridge was told to drop the cover', cleared.length === 1 && cleared[0][1] === null,
    JSON.stringify(cleared));

  console.log('\n  the half a storage wipe cannot reach:');
  // AsyncStorage.clear() is what "Delete My Data" did and all it did. Model
  // it: the stored song goes, the cover stays. This is the bug, reproduced.
  const h2 = harness();
  await h2.lastPlayed.noteLastPlayed('Twin Flame', 'Kaytranada', 'https://x/cover.jpg');
  h2.store.clear();
  check('a storage wipe alone leaves the cover on the record',
    h2.calls.filter((c) => c[0] === 'setArtwork').length === 0, JSON.stringify(h2.calls));

  console.log('\n  station photographs:');
  const h3 = harness({ stations: [{ id: 'custom-1' }, { id: 'custom-2' }] });
  await h3.art.clearWidgetStationImages();
  const shots = h3.calls.filter((c) => c[0] === 'setStationImage');
  check('every custom station is cleared', shots.length === 2, JSON.stringify(shots));
  check('and only ever with null', shots.every((c) => c[2] === null), JSON.stringify(shots));

  console.log('\n  a build with no widget extension:');
  // This ships over the air to phones whose binary has no bridge at all. The
  // storage half must still happen; the native half must not throw.
  const h4 = harness({ withBridge: false });
  await h4.lastPlayed.noteLastPlayed('Zero', 'Chris Brown', null);
  await h4.art.forgetLastSongForWidgets();
  await h4.art.clearWidgetStationImages();
  check('the song is still forgotten', (await h4.lastPlayed.getLastPlayed()) === null);
  check('and nothing reached a bridge that is not there', h4.calls.length === 0);

  console.log('\n  the order inside Delete My Data:');
  // READ OUT OF THE SOURCE, because this ordering cannot be observed without
  // running React — and it is a real rule, not a spelling: the station list
  // `clearWidgetStationImages` reads is destroyed by `AsyncStorage.clear()`,
  // and a publish before the wipe would hand the widgets the old snapshot.
  const sheet = fs.readFileSync(`${REPO}/src/components/SettingsSheet.tsx`, 'utf8');
  // COMMENTS BLANKED FIRST, line by line. The first run of this check
  // reported the order reversed — because the comment EXPLAINING the order
  // names `AsyncStorage.clear()` above the calls it describes. A scan that
  // reads comments is the 02.09 trap, and it fired here within a minute.
  const body = sheet.slice(sheet.indexOf('function DeleteDataRow'))
    .split('\n').map((l) => (l.trimStart().startsWith('//') ? '' : l)).join('\n');
  const at = (s) => body.indexOf(s);
  check('it forgets the last song', at('forgetLastSongForWidgets()') > 0);
  check('station photos are cleared before storage is wiped',
    at('clearWidgetStationImages()') > 0 && at('clearWidgetStationImages()') < at('AsyncStorage.clear()'),
    `${at('clearWidgetStationImages()')} vs ${at('AsyncStorage.clear()')}`);
  check('and the snapshot is republished after it',
    at('publishWidgetData()') > at('AsyncStorage.clear()'),
    `${at('publishWidgetData()')} vs ${at('AsyncStorage.clear()')}`);

  console.log(fails ? `\n  ${fails} FAILED\n` : '\n  all passed\n');
  process.exit(fails ? 1 : 0);
})();
