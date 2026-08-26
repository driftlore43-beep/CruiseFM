// AN "ON" TOGGLE MUST LOOK ON — ON EVERY STATION.
//
// Owner, 26.08: "the shuffle playlists doesn't seem to highlight when i tap
// on it, so im not sure if it does shuffle. the same goes for the repeat."
//
// The commands were reaching the service the whole time (that cycle is
// covered by test-transport-toggles.mjs). What failed was the SIGNAL: "on"
// was drawn by swapping the icon from white-at-85% to the station's accent,
// and an accent is almost always DARKER than white — so pressing it dimmed
// the icon instead of lighting it. This pins down both halves of the fix:
//
//   1. the pill's fill clears a floor on EVERY colour the app can produce,
//      so the shape is visible whatever station you are on;
//   2. a colour already bright enough is returned UNTOUCHED, so nothing that
//      reads well today changes.
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
const { litAccent, PILL_FLOOR } = m.exports;

const perceived = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};
const hueOf = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 1e-6) return null;                       // grey has no hue to keep
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
};

// Every colour the app can actually put behind this pill: the ten built-in
// stations' accents, and all 25 custom-station swatches.
const STATION_ACCENTS = [...fs.readFileSync('/home/user/CruiseFM/src/constants/stations.ts', 'utf8')
  .matchAll(/eqColors: \['#\w+', '(#\w+)', '#\w+'\]/g)].map((x) => x[1]);
const SWATCHES = [...fs.readFileSync('/home/user/CruiseFM/src/components/CreateStationModal.tsx', 'utf8')
  .matchAll(/label: '(\w+)',\s+color: '(#\w+)'/g)].map((x) => ({ label: x[1], color: x[2] }));

console.log(`\n  the pill clears the floor (${PILL_FLOOR}) on every built-in station:`);
{
  check(`all ${STATION_ACCENTS.length} station accents found`, STATION_ACCENTS.length === 10, String(STATION_ACCENTS.length));
  const bad = STATION_ACCENTS.filter((c) => perceived(litAccent(c)) < PILL_FLOOR - 0.5);
  check('none is left too dark to see', bad.length === 0, JSON.stringify(bad));
}

console.log('\n  ...and on every custom-station colour:');
{
  check(`all ${SWATCHES.length} swatches found`, SWATCHES.length === 25, String(SWATCHES.length));
  const bad = SWATCHES.filter((s) => perceived(litAccent(s.color)) < PILL_FLOOR - 0.5);
  check('none is left too dark to see', bad.length === 0,
    JSON.stringify(bad.map((s) => `${s.label} ${s.color}->${litAccent(s.color)}`)));
  // The two the owner would have hit first: the default, and the darkest.
  const violet = SWATCHES.find((s) => s.label === 'Violet');
  const none = SWATCHES.find((s) => s.label === 'None');
  console.log(`       Violet  ${violet.color} -> ${litAccent(violet.color)}  `
    + `(${perceived(violet.color).toFixed(0)} -> ${perceived(litAccent(violet.color)).toFixed(0)})`);
  console.log(`       None    ${none.color} -> ${litAccent(none.color)}  `
    + `(${perceived(none.color).toFixed(0)} -> ${perceived(litAccent(none.color)).toFixed(0)})`);
}

console.log('\n  a colour bright enough already is left ALONE:');
{
  // THE CONTROL. Without this the function could "pass" by flooding every
  // pill to near-white, which would throw away the station's identity — the
  // exact thing the accent is there to carry.
  const bright = ['#FFE070', '#F2F6FF', '#EFE8DC', '#FFFFFF'];
  for (const c of bright) {
    check(`${c} is returned unchanged`, litAccent(c) === c, litAccent(c));
  }
  const untouched = [...STATION_ACCENTS, ...SWATCHES.map((s) => s.color)]
    .filter((c) => perceived(c) >= PILL_FLOOR);
  check('every colour already above the floor is untouched',
    untouched.every((c) => litAccent(c) === c),
    JSON.stringify(untouched.filter((c) => litAccent(c) !== c)));
}

console.log('\n  the station keeps its identity — hue survives the lift:');
{
  const shifted = SWATCHES
    .map((s) => ({ ...s, lit: litAccent(s.color), h0: hueOf(s.color), h1: hueOf(litAccent(s.color)) }))
    .filter((s) => s.h0 != null && s.h1 != null)
    .map((s) => ({ ...s, d: Math.min(Math.abs(s.h1 - s.h0), 360 - Math.abs(s.h1 - s.h0)) }))
    .filter((s) => s.d > 1.5);
  check('no swatch shifts hue by more than 1.5 degrees', shifted.length === 0,
    JSON.stringify(shifted.map((s) => `${s.label} ${s.d.toFixed(1)}deg`)));
  // ...and it must not simply desaturate everything to grey either.
  const greyed = SWATCHES.filter((s) => hueOf(s.color) != null && hueOf(litAccent(s.color)) == null);
  check('no colour is flattened to grey', greyed.length === 0, JSON.stringify(greyed.map((s) => s.label)));
}

console.log('\n  it never throws on rubbish:');
{
  for (const bad of ['', 'rgba(255,255,255,0.85)', 'nonsense', '#12', '#GGGGGG']) {
    let threw = false;
    try { litAccent(bad); } catch { threw = true; }
    check(`"${bad}" is handled rather than thrown on`, !threw);
  }
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  an active toggle reads as active on every station the app can make\n');
process.exit(fails ? 1 : 0);
