// THE TIME ON THE BAR HAD ELEVEN IMPLEMENTATIONS AND THEY HAD DRIFTED.
//
// Found 03.09 off "the times on the music bars". Every deck carried its own
// copy of the same eight lines, and between them they had three faults that
// no single mode's author could have seen:
//
//   NaN:NaN   printed by ALL EIGHT when the duration was not known yet
//   -1:-5     Equalizer and Vinyl had no clamp; the other six did
//   03:05     Vinyl and Cassette padded the minutes; the other six did not
//
// This pins the rules the shared one keeps, and — the part that stops it
// happening a twelfth time — that no component has quietly grown its own.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = '/home/user/CruiseFM';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

// Run the SHIPPED module, not a copy of it.
const src = fs.readFileSync(`${ROOT}/src/utils/formatTime.ts`, 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { mmss } = mod.exports;

console.log('\n  the rules a time on a bar keeps:');
check('a normal position reads as a person would say it', mmss(185000) === '3:05', mmss(185000));
check('seconds always carry two digits', mmss(65000) === '1:05', mmss(65000));
check('the start of a track is 0:00', mmss(0) === '0:00', mmss(0));

// An unknown time is NOT zero. 0:00 says "at the beginning", which is a claim.
for (const [label, v] of [['null', null], ['undefined', undefined],
                          ['NaN', NaN], ['Infinity', Infinity]]) {
  check(`an unknown duration (${label}) is blank, never a number`,
    mmss(v) === '--:--', String(mmss(v)));
}

// The clock coasts between readings, so it genuinely reaches past the end.
check('a position past the end clamps rather than going negative',
  mmss(-5000) === '0:00', mmss(-5000));
check('and stays clamped when padded', mmss(-5000, { pad: true }) === '00:00',
  mmss(-5000, { pad: true }));

// The two hardware readouts — the cassette counter and the vinyl deck — show
// leading zeros because the real objects do. That is a look, not a fault, and
// it is the ONLY difference the shared formatter allows.
check('padded minutes are available for the hardware readouts',
  mmss(185000, { pad: true }) === '03:05', mmss(185000, { pad: true }));
check('padding changes only the minutes, never the rule',
  mmss(NaN, { pad: true }) === '--:--' && mmss(-1, { pad: true }) === '00:00');

check('a set longer than an hour still reads', mmss(3660000) === '61:00', mmss(3660000));

// ── and that nobody has grown a private copy again ────────────────────────
console.log('\n  one implementation, not eleven:');
/**
 * Formats a DURATION IN MINUTES, not milliseconds — "1:20" meaning an hour and
 * twenty, on a drive stub. Same shape, different unit, so it neither can nor
 * should go through mmss.
 */
const ALLOWED = { 'src/components/DriveStub.tsx': 'formats minutes, not milliseconds' };

// The shape every one of the eleven copies had, whatever it called itself: a
// template literal gluing one expression to another with a colon, where the
// second pads to two digits. Matched on the STRING being built rather than on
// any particular arithmetic, because the arithmetic is what kept varying.
const SHAPE = /`[^`\n]*\$\{[^`]*?\}:\$\{[^`]*padStart\(2[^`]*`/;

const offenders = [];
let scanned = 0;
for (const dir of ['src/components', 'src/utils']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!/\.tsx?$/.test(f) || f === 'formatTime.ts') continue;
    const rel = `${dir}/${f}`;
    if (ALLOWED[rel]) continue;
    scanned++;
    if (SHAPE.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) offenders.push(rel);
  }
}
// A scan that reached nothing would pass every case vacuously — which is
// exactly how the first version of this check shipped, so it says so.
check('the scan actually read the components', scanned > 40, `only ${scanned} files`);

check('no component builds its own m:ss from a division by 60',
  offenders.length === 0,
  offenders.join(', ') + ' — use mmss from utils/formatTime');

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  every time on every bar comes from one place, and knows what it does not know\n');
process.exit(fails ? 1 : 0);
