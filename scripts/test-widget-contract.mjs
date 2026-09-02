// THE SEAM BETWEEN THE APP AND ITS WIDGETS.
//
// The snapshot leaves TypeScript as JSON and arrives in Swift as a Codable
// struct, and Swift's decoder is ALL OR NOTHING: one required property whose
// name does not appear in the JSON and the whole decode returns nil, which
// blanks every widget at once with no error anywhere. Nothing on either side
// of that seam knows about the other, so nothing catches a rename — which is
// exactly the kind of silent, total failure worth a test of its own.
//
// This reads the property names straight out of the shipped Swift and checks
// them against a snapshot built by the shipped TypeScript. It is not a
// compiler; it cannot tell you the Swift builds. It can tell you the two
// halves still agree about what they are called.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM';
const IDS = ['night-run', 'rain-drive', 'coastal', 'mountain-pass', 'after-midnight',
  'sunset', 'cars-coffee', 'tunnel', 'downtown', 'daylight'];

let fails = 0;
const check = (name, ok, extra = '') => {
  if (ok) { console.log('  ok  ', name); return; }
  fails++; console.log('  FAIL', name, extra);
};

// ── The real snapshot, from the real code ──────────────────────────────────
const compile = (p) => ts.transpileModule(fs.readFileSync(p, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const schedule = (() => {
  const js = compile(`${ROOT}/src/constants/schedule.ts`).replace(
    /require\("@\/constants\/stations"\)/g,
    `({ STATIONS: ${JSON.stringify(IDS.map((id) => ({ id })))} })`);
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, () => { throw new Error('no'); });
  return m.exports;
})();

const station = (id) => ({
  id, name: `${id} FM`, tagline: 't', premium: false,
  cardGradient: ['#111111', '#227722', '#000000'], eqColors: ['#a', '#b', '#c'],
  iconName: 'music-note', icon: 'music-note',
});

const W = (() => {
  const m = { exports: {} };
  const req = (name) => {
    if (name.endsWith('MaterialCommunityIcons.json')) { const g = { 'music-note': 983943 }; g.default = g; return g; }
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => null };
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === '@/constants/schedule') return schedule;
    if (name === '@/constants/stations') return { STATIONS: IDS.map(station), stationDial: () => ({ band: 'FM', label: '92.1' }) };
    if (name === '@/utils/customStations') return {
      resolveAnyStation: station, cachedCustomStations: () => [{ id: 'c' }], loadCustomStations: async () => [] };
    if (name === '@/utils/lastCruise') return { loadLastCruise: async () => ({ stationId: 'sunset', mode: 'vinyl' }) };
    if (name === '@/utils/driveStats') return { getDriveStats: async () => ({ streakDays: 3, drivesThisWeek: 2, listensThisWeek: 5, totalMinutes: 140 }) };
    if (name === '@/utils/sessionKind') return {
      cachedSessionKind: () => 'driving', loadSessionKind: async () => 'driving',
      words: () => ({ countLabel: 'DRIVES', timeLabel: 'CRUISED' }) };
    if (name === './lastPlayed') return {
      getLastPlayed: async () => ({ title: 'Zero', artist: 'Pumpkins', artUrl: null, at: 1 }),
    };
    throw new Error('unstubbed: ' + name);
  };
  new Function('module', 'exports', 'require', compile(`${ROOT}/src/utils/widgetData.ts`))(m, m.exports, req);
  return m.exports;
})();

const snap = JSON.parse(JSON.stringify(await W.buildWidgetSnapshot(new Date(2026, 7, 12, 14, 37))));

// ── The Swift side's property names ────────────────────────────────────────
const swift = fs.readFileSync(`${ROOT}/targets/widgets/Snapshot.swift`, 'utf8');

/** Every `let name: Type` inside a named struct, with whether it's optional. */
function structFields(structName) {
  const m = new RegExp(`struct ${structName}: Codable \\{([\\s\\S]*?)\\n\\}`).exec(swift);
  if (!m) return null;
  return [...m[1].matchAll(/^\s*let\s+(\w+)\s*:\s*([^\n]+)$/gm)]
    .map(([, name, type]) => ({ name, optional: type.trim().endsWith('?') }));
}

console.log('\n  Swift structs are readable at all:');
for (const s of ['Snapshot', 'WidgetStation', 'WidgetStats']) {
  check(`${s} found in Snapshot.swift`, structFields(s) !== null);
}

console.log('\n  every REQUIRED Swift property exists in the JSON:');
const cases = [
  ['Snapshot', snap],
  ['WidgetStation', snap.onAir[0]],
  ['WidgetStation (lastDrive)', snap.lastDrive],
  ['WidgetStats', snap.stats],
];
for (const [label, obj] of cases) {
  const fields = structFields(label.split(' ')[0]);
  const missing = fields.filter((f) => !f.optional && (obj?.[f.name] === undefined));
  check(`${label}: nothing required is missing`, missing.length === 0,
    missing.map((f) => f.name).join(', '));
}

console.log('\n  the app sends nothing Swift silently drops:');
{
  // Not a failure — Swift ignores unknown keys by design, and the version
  // field exists so a deliberate addition is safe. But an UNEXPECTED extra is
  // usually a rename half-done, so it is worth printing.
  const known = new Set(structFields('Snapshot').map((f) => f.name));
  const extra = Object.keys(snap).filter((k) => !known.has(k));
  check('no stray top-level keys', extra.length === 0, extra.join(', '));
  const knownS = new Set(structFields('WidgetStation').map((f) => f.name));
  const extraS = Object.keys(snap.onAir[0]).filter((k) => !knownS.has(k));
  check('no stray station keys', extraS.length === 0, extraS.join(', '));
}

console.log('\n  the two halves agree on the App Group and the key:');
{
  const mod = fs.readFileSync(`${ROOT}/modules/cruise-widgets/ios/CruiseWidgetsModule.swift`, 'utf8');
  const target = fs.readFileSync(`${ROOT}/targets/widgets/expo-target.config.js`, 'utf8');
  const grab = (src, re) => (re.exec(src) || [])[1];
  const appGroupApp = grab(mod, /appGroup\s*=\s*"([^"]+)"/);
  const appGroupExt = grab(swift, /appGroup\s*=\s*"([^"]+)"/);
  const keyApp = grab(mod, /snapshotKey\s*=\s*"([^"]+)"/);
  const keyExt = grab(swift, /static let key\s*=\s*"([^"]+)"/);
  // These four strings have to match or the widgets read an empty container
  // forever, with nothing logged anywhere — the worst way for this to fail.
  check('app and extension name the same App Group', !!appGroupApp && appGroupApp === appGroupExt,
    `${appGroupApp} vs ${appGroupExt}`);
  check('...and the target config declares it too', target.includes(appGroupApp ?? '\0'));
  check('app and extension name the same key', !!keyApp && keyApp === keyExt, `${keyApp} vs ${keyExt}`);
}

console.log('\n  the version gate is real:');
{
  const supported = /supportedVersion\s*=\s*(\d+)/.exec(swift);
  check('the extension declares a supported version', !!supported);
  check('the app ships a version it can draw', Number(supported?.[1]) >= snap.version,
    `app ${snap.version} vs widget ${supported?.[1]}`);
}

// FONTS MOVED TO scripts/test-widget-fonts.mjs, and the block that used to sit
// here is worth remembering as a warning. It asserted two things:
//
//   1. that expo-target.config.js listed font files under a `fonts:` key —
//      which @bacons/apple-targets never reads, so the check was confirming a
//      setting that did nothing; and
//   2. that Swift asked for "MaterialCommunityIcons" — which is the FILENAME,
//      not the font's PostScript name ("MaterialDesignIcons"), so it was
//      pinning the exact bug that made every station icon render as a
//      missing-glyph box.
//
// It passed the whole time both were broken. A check that asserts your
// assumption rather than the property is worse than none, because it is read
// as evidence. The replacement reads the ttf's own name table.

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the app and its widgets agree\n');
process.exit(fails ? 1 : 0);
