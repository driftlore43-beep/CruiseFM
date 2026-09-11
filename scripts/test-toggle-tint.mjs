// AN "ON" TOGGLE MUST LOOK ON, AND ITS ARROWS MUST BE READABLE — ON EVERY
// STATION AND EVERY SWATCH.
//
// Two owner reports, and the second was caused by the fix for the first.
//
// 26.08: "the shuffle playlists doesn't seem to highlight when i tap on it."
// The commands were reaching the service the whole time (that cycle is
// covered by test-transport-toggles.mjs); what failed was the SIGNAL. An
// active toggle grew a filled pill to fix it.
//
// 01.09: "can it be a bold colour — whatever colour theme is selected — not a
// bubble which makes it hard to see the shuffle arrows." The pill was filled
// with the accent LIFTED TOWARD WHITE (to separate it from the dark deck)
// while the icon on it was hardcoded white — two jobs pulling opposite ways.
// Measured, the arrows fell under 3:1 on 20 of 35 colours, and Mountain Pass
// sat at 1.08:1, which is white on white.
//
// So this file now pins the property that actually matters and is the one
// that was violated: WHATEVER the fill, the arrows on it can be seen.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/components/TransportToggle.tsx';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
// react-native's StyleSheet.create is called at module scope, so the stub has
// to answer it with something callable rather than the blanket Proxy.
const req = (name) => {
  if (name === 'react-native') {
    return { StyleSheet: { create: (o) => o }, View: 'View', TouchableOpacity: 'TouchableOpacity' };
  }
  return new Proxy({}, { get: () => () => {} });
};
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, req);
const { inkOn, INK_DARK } = m.exports;

const relLum = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};
const contrast = (a, b) => {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Every colour the app can actually put behind this pill: the ten built-in
// stations' accents, and all 25 custom-station swatches.
const STATION_ACCENTS = [...fs.readFileSync('/home/user/CruiseFM/src/constants/stations.ts', 'utf8')
  .matchAll(/eqColors: \['#\w+', '(#\w+)', '#\w+'\]/g)].map((x) => x[1]);
const SWATCHES = [...fs.readFileSync('/home/user/CruiseFM/src/components/CreateStationModal.tsx', 'utf8')
  .matchAll(/label: '(\w+)',\s+color: '(#\w+)'/g)].map((x) => ({ label: x[1], color: x[2] }));
const ALL = [
  ...STATION_ACCENTS.map((c) => ({ label: 'station', color: c })),
  ...SWATCHES,
];

console.log(`\n  the palette this has to survive: ${STATION_ACCENTS.length} stations + ${SWATCHES.length} swatches`);
check('both palettes were actually found', STATION_ACCENTS.length >= 8 && SWATCHES.length >= 20,
  `${STATION_ACCENTS.length}/${SWATCHES.length} — if either is 0 this whole file passes vacuously`);

// 3:1 is the WCAG bar for a graphic this size; 4.5:1 is the normal-text bar.
// Hold the floor at 3 and REPORT anything under 4.5, so a future swatch that
// merely gets close is visible before it gets worse.
const ICON_FLOOR = 3.0;

console.log('\n  the arrows are legible on every fill the app can produce:');
{
  const bad = ALL.filter((s) => contrast(s.color, inkOn(s.color)) < ICON_FLOOR);
  check(`nothing falls under ${ICON_FLOOR}:1`, bad.length === 0,
    JSON.stringify(bad.map((s) => `${s.label} ${s.color} -> ${contrast(s.color, inkOn(s.color)).toFixed(2)}:1`)));
  const worst = ALL.map((s) => ({ ...s, cr: contrast(s.color, inkOn(s.color)) }))
    .sort((a, b) => a.cr - b.cr)[0];
  console.log(`       worst is ${worst.label} ${worst.color} at ${worst.cr.toFixed(2)}:1 (ink ${inkOn(worst.color)})`);
}

console.log('\n  the exact colours that were broken before are fixed:');
for (const [name, hex] of [['Mountain Pass', '#F2F6FF'], ['Pearl', '#EFE8DC'], ['Rain Drive', '#FFE070']]) {
  const cr = contrast(hex, inkOn(hex));
  check(`${name} ${hex} — was white-on-white, now ${cr.toFixed(2)}:1`, cr >= ICON_FLOOR);
}

console.log('\n  the fill is the station colour, untouched:');
{
  // THE REGRESSION GUARD FOR THIS ROUND. The old build lifted the fill toward
  // white, which is exactly what made the arrows vanish. Nothing exported
  // here may transform a colour any more.
  check('litAccent is gone', m.exports.litAccent === undefined);
  check('PILL_FLOOR is gone', m.exports.PILL_FLOOR === undefined);
  const src = fs.readFileSync(SRC, 'utf8');
  check('the pill fills with the raw accent', /backgroundColor: accent\b/.test(src));
  check('...and carries a rim so a dark pill still reads',
    /borderColor: 'rgba\(255,255,255/.test(src));
}

console.log('\n  ink is chosen by measurement, both ways:');
{
  check('a pale fill gets dark arrows', inkOn('#F2F6FF') === INK_DARK);
  check('a deep fill gets white arrows', inkOn('#2A2E3D') === '#ffffff');
  check('near-black ink, not pure black — #000 reads as a hole punched in a bright pill',
    INK_DARK !== '#000000' && relLum(INK_DARK) < 0.02);
  let threw = false;
  try { inkOn('not-a-colour'); } catch { threw = true; }
  check('a malformed colour does not throw on a deck', !threw);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  the pill wears the station\'s own colour and the arrows read on all of it\n');
process.exit(fails ? 1 : 0);
