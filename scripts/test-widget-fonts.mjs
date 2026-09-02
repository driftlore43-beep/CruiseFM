// A WIDGET'S FONTS FAIL SILENTLY, SO THEY GET PINNED HERE.
//
// The first widget build (38, 01.09) drew its dial in a plain system face and
// every station icon as a missing-glyph box. Two independent causes, and
// NEITHER threw, logged, or failed a build:
//
//   1. `fonts: [...]` in expo-target.config.js was never a supported option.
//      @bacons/apple-targets reads icon/images/colors/entitlements/frameworks
//      and silently ignores anything else, so the ttf files were never copied
//      into the extension and UIAppFonts was never declared. The key sat there
//      looking correct from 21.08 to 01.09.
//   2. Swift asked for `.custom("MaterialCommunityIcons")` — the FILENAME. The
//      font's PostScript name, which is what SwiftUI wants, is
//      "MaterialDesignIcons". iOS quietly substitutes the system font, where a
//      private-use codepoint has no glyph.
//
// An icon that does not render is invisible to every other check in this repo,
// which is exactly why it survived a build. This file makes both mechanical.
import fs from 'node:fs';

const ROOT = '/home/user/CruiseFM';
const DIR = `${ROOT}/targets/widgets`;
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

/** The PostScript name (nameID 6), read from the ttf's own name table — the
 *  only authority on what `.custom()` will match. */
function postScriptName(file) {
  const d = fs.readFileSync(file);
  const numTables = d.readUInt16BE(4);
  let off = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (d.toString('latin1', rec, rec + 4) === 'name') { off = d.readUInt32BE(rec + 8); break; }
  }
  if (off == null) return null;
  const count = d.readUInt16BE(off + 2), strOff = d.readUInt16BE(off + 4);
  for (let i = 0; i < count; i++) {
    const r = off + 6 + i * 12;
    const platformId = d.readUInt16BE(r), nameId = d.readUInt16BE(r + 6);
    const len = d.readUInt16BE(r + 8), so = d.readUInt16BE(r + 10);
    if (nameId !== 6) continue;
    const raw = d.subarray(off + strOff + so, off + strOff + so + len);
    return platformId === 3 ? raw.swap16().toString('utf16le') : raw.toString('latin1');
  }
  return null;
}

console.log('\n  the fonts are in the folder the target syncs:');
const plist = fs.readFileSync(`${DIR}/Info.plist`, 'utf8');
const declared = [...plist.matchAll(/<string>([^<]+\.ttf)<\/string>/g)].map((m) => m[1]);
check('Info.plist declares UIAppFonts', /UIAppFonts/.test(plist));
check('...and names at least one font', declared.length > 0, JSON.stringify(declared));
for (const f of declared) {
  check(`${f} exists beside it`, fs.existsSync(`${DIR}/${f}`));
}

console.log('\n  Info.plist still registers the widget at all:');
// Losing this while hand-authoring the file would unregister the extension —
// the widgets would simply never appear in the gallery, with no error.
check('NSExtensionPointIdentifier is widgetkit-extension',
  /com\.apple\.widgetkit-extension/.test(plist));

console.log('\n  every font Swift asks for is one we actually ship:');
const swift = fs.readFileSync(`${DIR}/Snapshot.swift`, 'utf8');
const asked = [...swift.matchAll(/\.custom\("([^"]+)"/g)].map((m) => m[1]);
check('Swift asks for at least one custom font', asked.length > 0,
  'if this is 0 the regex matched nothing and every case below is vacuous');
const shipped = declared.map((f) => postScriptName(`${DIR}/${f}`));
console.log(`       shipped PostScript names: ${JSON.stringify(shipped)}`);
for (const name of asked) {
  check(`"${name}" matches a shipped font's PostScript name`, shipped.includes(name),
    `asked for "${name}" — the ttf files call themselves ${JSON.stringify(shipped)}`);
}

console.log('\n  the subset still covers every icon a station can use:');
{
  const glyphs = JSON.parse(fs.readFileSync(
    `${ROOT}/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json`, 'utf8'));
  const names = new Set();
  for (const m of fs.readFileSync(`${ROOT}/src/constants/stations.ts`, 'utf8').matchAll(/iconName:\s*'([^']+)'/g)) names.add(m[1]);
  for (const m of fs.readFileSync(`${ROOT}/src/utils/customStations.ts`, 'utf8').matchAll(/iconName:.*?'([a-z][a-z0-9-]+)'/g)) names.add(m[1]);
  const cs = fs.readFileSync(`${ROOT}/src/components/CreateStationModal.tsx`, 'utf8');
  for (const blk of cs.matchAll(/ICONS\s*=\s*\[([^\]]+)\]/g)) {
    for (const m of blk[1].matchAll(/'([a-z][a-z0-9-]+)'/g)) names.add(m[1]);
  }
  check('found the icon names to check', names.size >= 10, `${names.size} — a regex matching nothing passes vacuously`);

  const sub = declared.find((f) => /Material/i.test(f));
  const d = fs.readFileSync(`${DIR}/${sub}`);
  // Walk the cmap format-4/12 subtables for the codepoints actually present.
  const covered = new Set();
  const numTables = d.readUInt16BE(4);
  let cmapOff = null;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (d.toString('latin1', rec, rec + 4) === 'cmap') { cmapOff = d.readUInt32BE(rec + 8); break; }
  }
  const n = d.readUInt16BE(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const sub2 = cmapOff + d.readUInt32BE(cmapOff + 4 + i * 8 + 4);
    const fmt = d.readUInt16BE(sub2);
    if (fmt === 4) {
      const segX2 = d.readUInt16BE(sub2 + 6);
      for (let s = 0; s < segX2 / 2; s++) {
        const end = d.readUInt16BE(sub2 + 14 + s * 2);
        const start = d.readUInt16BE(sub2 + 16 + segX2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) covered.add(c);
      }
    } else if (fmt === 12) {
      const groups = d.readUInt32BE(sub2 + 12);
      for (let g = 0; g < groups; g++) {
        const o = sub2 + 16 + g * 12;
        for (let c = d.readUInt32BE(o); c <= d.readUInt32BE(o + 4); c++) covered.add(c);
      }
    }
  }
  const missing = [...names].filter((nm) => glyphs[nm] && !covered.has(glyphs[nm]));
  check('every station icon is in the subset', missing.length === 0,
    `missing: ${JSON.stringify(missing)} — re-run the subset after adding an icon`);
  const unknown = [...names].filter((nm) => !glyphs[nm]);
  check('every icon name is a real glyph', unknown.length === 0, JSON.stringify(unknown));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  the widgets ship the fonts they draw with, under the names they ask for\n');
process.exit(fails ? 1 : 0);
