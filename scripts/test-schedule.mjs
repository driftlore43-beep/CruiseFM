// Test the SHIPPED schedule module. Transpiles the real file and stubs only
// its one import (constants/stations pulls in bundled images, which node can't
// load), so this exercises the code that actually runs.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/constants/schedule.ts';
const IDS = ['night-run', 'rain-drive', 'coastal', 'mountain-pass', 'after-midnight',
  'sunset', 'cars-coffee', 'tunnel', 'downtown', 'daylight'];

const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText.replace(
  /require\("@\/constants\/stations"\)/g,
  `({ STATIONS: ${JSON.stringify(IDS.map((id) => ({ id })))} })`,
);

const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, () => { throw new Error('no'); });
const S = mod.exports;

let fails = 0;
const check = (name, ok, extra = '') => {
  if (!ok) { fails++; console.log('  FAIL', name, extra); }
};

// 1. COVERAGE: every hour of every day must have at least one scheduled
//    station on air — not counting rain-drive, which is 'always' and would
//    mask a dead hour.
let dead = [];
for (let d = 0; d < 7; d++) {
  for (let h = 0; h < 24; h++) {
    const now = new Date(2026, 7, 9 + d, h, 30); // 9 Aug 2026 was a Sunday
    const on = S.onAirNow(now).filter((id) => id !== 'rain-drive');
    if (on.length === 0) dead.push(`${d}/${h}`);
  }
}
check('no dead hours', dead.length === 0, dead.join(' '));
console.log('  hours with nothing scheduled:', dead.length);

// 2. A headline station at every hour, and it must actually be on air.
let badPrimary = [];
for (let d = 0; d < 7; d++) {
  for (let h = 0; h < 24; h++) {
    const now = new Date(2026, 7, 9 + d, h, 30);
    const p = S.primaryOnAir(now);
    if (!S.isOnAir(p, now) || p === 'rain-drive') badPrimary.push(`${d}/${h}=${p}`);
  }
}
check('primary is always genuinely on air', badPrimary.length === 0, badPrimary.slice(0, 6).join(' '));

// 3. Wrap-around windows: Night Run (20:00–01:00) at 23:00 and 00:30.
check('night-run on at 23:00', S.isOnAir('night-run', new Date(2026, 7, 12, 23, 0)));
check('night-run on at 00:30', S.isOnAir('night-run', new Date(2026, 7, 12, 0, 30)));
check('night-run off at 02:00', !S.isOnAir('night-run', new Date(2026, 7, 12, 2, 0)));
check('night-run off at 14:00', !S.isOnAir('night-run', new Date(2026, 7, 12, 14, 0)));

// 4. Day-limited: Cars & Coffee on a Saturday morning but not a Wednesday.
check('cars-coffee on Sat 08:00', S.isOnAir('cars-coffee', new Date(2026, 7, 15, 8, 0)));
check('cars-coffee off Wed 08:00', !S.isOnAir('cars-coffee', new Date(2026, 7, 12, 8, 0)));
check('cars-coffee headlines Sat 08:00', S.primaryOnAir(new Date(2026, 7, 15, 8, 0)) === 'cars-coffee',
  S.primaryOnAir(new Date(2026, 7, 15, 8, 0)));

// 5. 'always' is on but never headlines.
check('rain-drive always on', S.isOnAir('rain-drive', new Date(2026, 7, 12, 3, 0)));
check('rain-drive schedule line', S.scheduleLine('rain-drive') === 'On air around the clock');

// 6. Back-on labels read like a person talking.
const wedAfternoon = new Date(2026, 7, 12, 14, 0);
check('night-run back at 8pm', S.backOnLabel('night-run', wedAfternoon) === 'Back at 8pm',
  S.backOnLabel('night-run', wedAfternoon));
check('cars-coffee back Saturday', S.backOnLabel('cars-coffee', wedAfternoon) === 'Back Saturday',
  S.backOnLabel('cars-coffee', wedAfternoon));
check('on-air station has no back label', S.backOnLabel('daylight', wedAfternoon) === null);
// PART-WAY THROUGH A MINUTE. The label used to be worked out as now + a
// ROUNDED gap in minutes, so 04:38:57 to a 5pm start rounded down to 741 and
// landed back on 16:59:57 — "Back at 4pm" for a station that comes on at
// five. Any call with seconds on the clock could hit it, which is every real
// one. The hour must come from the schedule, not from the arithmetic.
for (const sec of [0, 1, 29, 30, 57, 59]) {
  const t = new Date(2026, 7, 12, 4, 38, sec);
  check(`sunset back at 5pm at 04:38:${String(sec).padStart(2, '0')}`,
    S.backOnLabel('sunset', t) === 'Back at 5pm', S.backOnLabel('sunset', t));
}
check('clock: midnight', S.clockLabel(0) === 'midnight');
check('clock: noon', S.clockLabel(12) === 'noon');
check('clock: 5am', S.clockLabel(5) === '5am');
check('clock: 11pm', S.clockLabel(23) === '11pm');

// 7. Up next is always ahead, never something already on.
for (let h = 0; h < 24; h++) {
  const now = new Date(2026, 7, 12, h, 20);
  const n = S.upNext(now);
  if (n && (S.isOnAir(n.id, now) || n.minutes <= 0)) {
    check(`upNext sane at ${h}:20`, false, JSON.stringify(n));
  }
}
check('upNext exists at 14:00', !!S.upNext(new Date(2026, 7, 12, 14, 0)));

// A readable day, for eyeballing the rotation.
console.log('\n  Wednesday:');
for (let h = 0; h < 24; h += 2) {
  const now = new Date(2026, 7, 12, h, 0);
  console.log(`   ${String(h).padStart(2, '0')}:00  ${S.primaryOnAir(now).padEnd(15)} on air: ${S.onAirNow(now).join(', ')}`);
}
console.log('\n  Saturday 08:00 →', S.primaryOnAir(new Date(2026, 7, 15, 8, 0)));

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
