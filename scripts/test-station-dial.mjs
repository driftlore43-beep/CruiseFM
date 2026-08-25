// A CUSTOM STATION'S DIAL NUMBER — Ethan (25.08): "each custom station gets
// assigned a random number so when you look at it on the tuner they are not
// next to each other and I would like the option to put all my custom
// stations in order."
//
// The number is what decides where a station SITS on the dial, so it has to
// behave like a real frequency: on the AM scale, on a round 10 kHz, and
// stable. The two properties worth pinning down are that a station without a
// chosen number is completely unaffected by this change (every station made
// before today), and that a typed number can never land somewhere a receiver
// couldn't show.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/constants/stations.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
// The station list `require`s image assets; a Proxy stands in for all of it.
const req = () => new Proxy({}, { get: () => () => {} });
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, req);
const { clampAm, stationAm, stationDial, STATION_AM } = m.exports;

console.log('\n  a station with no chosen number behaves exactly as before:');
{
  const ids = ['custom-1755000000000', 'custom-1699999999999', 'my-station', 'x'];
  for (const id of ids) {
    const a = stationAm(id);
    check(`${id} lands on the AM scale`, a >= 540 && a <= 1600, String(a));
    check(`${id} lands on a round 10 kHz`, a % 10 === 0, String(a));
    check(`${id} is stable across calls`, stationAm(id) === a);
  }
  check('the built-in stations keep their fixed places',
    stationAm('night-run') === STATION_AM['night-run']
    && stationAm('sunset') === STATION_AM['sunset']
    && stationAm('daylight') === STATION_AM['daylight']);
}

console.log('\n  a chosen number is used instead:');
{
  check('the number the user typed is what the dial reads', stationAm('custom-1', 1010) === 1010);
  check('...regardless of what the id would have hashed to', stationAm('custom-2', 1010) === 1010);
  check('two stations can deliberately sit together',
    stationAm('custom-a', 800) === stationAm('custom-b', 800));
  // Ethan's actual case: three colour-matched stations, grouped by hand.
  const grouped = ['custom-a', 'custom-b', 'custom-c'].map((id, i) => stationAm(id, 900 + i * 10));
  check('a group can be laid out in consecutive slots',
    JSON.stringify(grouped) === JSON.stringify([900, 910, 920]), JSON.stringify(grouped));
}

console.log('\n  a chosen number is kept on the real AM scale:');
{
  check('below the band is pulled up to 540', clampAm(12) === 540);
  check('above the band is pulled down to 1600', clampAm(9999) === 1600);
  check('the ends themselves are valid', clampAm(540) === 540 && clampAm(1600) === 1600);
  check('an off-grid number rounds to the nearest 10', clampAm(1013) === 1010 && clampAm(1016) === 1020);
  check('stationAm applies the same clamp', stationAm('custom-1', 3) === 540 && stationAm('custom-1', 5000) === 1600);
  check('a rounded number is unchanged', clampAm(1240) === 1240);
}

console.log('\n  the dial label follows:');
{
  const d = stationDial('custom-1', false, 1010);
  check('a custom station stays on the AM band', d.band === 'AM');
  check('it reads the chosen number', d.label === '1010' && d.value === 1010);
  const auto = stationDial('custom-1', false);
  check('with no choice it reads the automatic one',
    auto.value === stationAm('custom-1'), JSON.stringify(auto));
}
{
  // The override has no business on the FM side — a custom station is never
  // premium, so it never reaches that branch, but passing one must not do
  // anything strange if it ever does.
  const fm = stationDial('night-run', true, 1010);
  check('an override is ignored on the FM band', fm.band === 'FM' && fm.value !== 1010, JSON.stringify(fm));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a driver can place their own stations on the dial, and they stay put\n');
process.exit(fails ? 1 : 0);
