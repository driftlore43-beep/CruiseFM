// A CUSTOM STATION'S PHOTOGRAPH HAS TO BE COPIED, AND THE COPY HAS TO BE
// CLEANED UP — BOTH FAIL SILENTLY.
//
// The ten built-in stations' backdrops are bundled inside the widget
// extension. A custom station's photo lives in the app's documents directory,
// which a widget extension cannot reach at all — separate process, separate
// sandbox — so the only route across is a copy into the App Group.
//
// Three ways that goes quietly wrong, all pinned here:
//   1. the copy is never sent, and the widget keeps a gradient for ever;
//   2. the copy is sent but never cleared, so a deleted station's photo goes
//      on being drawn;
//   3. the SAVE path's internal tidy-up clears the copy it has just written,
//      which would leave every freshly-saved station blank.
//
// It also pins that all of this no-ops on a build whose bridge has no
// setStationImage — this ships over the air to build 38, which has neither
// the function nor any code to draw the result.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load({ hasStationImage = true, customs = [], stored = {} } = {}) {
  const js = ts.transpileModule(fs.readFileSync(`${ROOT}/src/utils/widgetArtwork.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const calls = [];
  const bridge = {
    setArtwork: async () => true,
    ...(hasStationImage
      ? { setStationImage: async (id, b64) => { calls.push([id, b64 === null ? null : 'jpeg']); return true; } }
      : {}),
  };
  const disk = { ...stored };
  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => bridge };
    if (name === '@react-native-async-storage/async-storage') return {
      getItem: async (k) => (k in disk ? disk[k] : null),
      setItem: async (k, v) => { disk[k] = v; },
    };
    if (name === './lastPlayed') return { noteLastPlayed: async () => true };
    if (name === './customStations') return {
      cachedCustomStations: () => customs,
      loadCustomStations: async () => customs,
    };
    if (name === 'expo-image-manipulator') return {
      manipulateAsync: async () => ({ base64: 'AAAA' }),
      SaveFormat: { JPEG: 'jpeg' },
    };
    if (name === 'expo-file-system/legacy') return { cacheDirectory: '/tmp/', downloadAsync: async () => ({ uri: '/tmp/x' }) };
    throw new Error('unstubbed: ' + name);
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { mod: m.exports, calls, disk };
}

console.log('\n  a photo is copied across, and a removed one is cleared:');
{
  const { mod, calls } = load();
  await mod.sendStationImageToWidgets('custom-1', 'file:///photos/custom-1-blur.jpg');
  check('a saved photo is sent', calls.some(([id, b]) => id === 'custom-1' && b === 'jpeg'),
    JSON.stringify(calls));

  calls.length = 0;
  await mod.sendStationImageToWidgets('custom-1', null);
  check('no photo clears the copy rather than leaving an orphan',
    calls.length === 1 && calls[0][0] === 'custom-1' && calls[0][1] === null,
    JSON.stringify(calls));
}

console.log('\n  the SAVE path must not wipe the copy it just wrote:');
{
  // deleteStationPhoto is called twice for very different reasons: with a
  // keepStamp it is the tidy-up INSIDE a save, and without one it is a real
  // delete. Only the second may clear the widget's copy.
  const src = fs.readFileSync(`${ROOT}/src/utils/stationPhoto.ts`, 'utf8');
  check('the clear is guarded on keepStamp being absent',
    /if\s*\(keepStamp\s*==\s*null\)\s*sendStationImageToWidgets\([^)]*null\)/.test(src),
    'an unguarded clear here blanks every freshly-saved station');
  check('a successful save sends the new blur copy',
    /sendStationImageToWidgets\(stationId,\s*imageBlur\)/.test(src));
}

console.log('\n  stations that already exist are back-filled, once:');
{
  const customs = [
    { id: 'custom-1', imageBlur: 'file:///photos/a-blur.jpg' },
    { id: 'custom-2', imageBlur: null },              // colours only
    { id: 'custom-3', imageBlur: 'file:///photos/c-blur.jpg' },
  ];
  const { mod, calls, disk } = load({ customs });
  await mod.backfillStationImagesOnce();
  const sent = calls.filter(([, b]) => b === 'jpeg').map(([id]) => id);
  check('every existing station WITH a photo is sent',
    sent.includes('custom-1') && sent.includes('custom-3'), JSON.stringify(sent));
  check('a colours-only station is not', !sent.includes('custom-2'), JSON.stringify(sent));
  check('the flag is written so it cannot run again', !!disk.cruisefm_widget_station_images_v1);

  calls.length = 0;
  await mod.backfillStationImagesOnce();
  check('a second call does nothing', calls.length === 0, JSON.stringify(calls));
}

console.log('\n  and none of it runs on a build whose bridge cannot take it:');
{
  // This ships over the air to build 38, whose extension has no
  // setStationImage and no code to draw the result.
  const { mod, calls } = load({ hasStationImage: false, customs: [{ id: 'c', imageBlur: 'x' }] });
  let threw = false;
  try {
    await mod.sendStationImageToWidgets('c', 'file:///x.jpg');
    await mod.backfillStationImagesOnce();
  } catch { threw = true; }
  check('nothing throws', !threw);
  check('nothing is sent', calls.length === 0, JSON.stringify(calls));
}

console.log('\n  the two sides agree on the filename:');
{
  const swiftApp = fs.readFileSync(`${ROOT}/modules/cruise-widgets/ios/CruiseWidgetsModule.swift`, 'utf8');
  const swiftExt = fs.readFileSync(`${ROOT}/targets/widgets/Artwork.swift`, 'utf8');
  const pat = /stationFile\(_ id: String\) -> String \{ "([^"]+)" \}/;
  const a = pat.exec(swiftApp)?.[1];
  const b = pat.exec(swiftExt)?.[1];
  check('both declare a station filename', !!a && !!b, `app ${a} / ext ${b}`);
  check('and it is the same one', a === b,
    `${a} vs ${b} — if these drift the widget reads a file nothing ever writes`);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a custom station\'s photograph reaches its widget, and leaves when it does\n');
process.exit(fails ? 1 : 0);
