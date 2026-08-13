// Every on-air notification must be TRUE.
//
// The system's own rule is that a notification is a statement about the world:
// "Sunset AM is on air" is a fact, and if the app says it, it has to be so.
// That was checked by eye until the schedule landed (12.08) and immediately
// caught a line claiming Cars & Coffee FM broadcasts on weekday mornings, when
// its window is weekend mornings only.
//
// So it is checked by machine now. Transpiles the SHIPPED copy and the SHIPPED
// schedule and asserts that every nudge names a station genuinely on air at
// the hour and day it fires.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM/src';
const IDS = ['night-run', 'rain-drive', 'coastal', 'mountain-pass', 'after-midnight',
  'sunset', 'cars-coffee', 'tunnel', 'downtown', 'daylight'];
const NAMES = {
  'night-run': 'Night Run AM', 'rain-drive': 'Rain Drive FM', coastal: 'Coastal FM',
  'mountain-pass': 'Mountain Pass FM', 'after-midnight': 'After Hours FM',
  sunset: 'Sunset AM', 'cars-coffee': 'Cars & Coffee FM', tunnel: 'Tunnel FM',
  downtown: 'Downtown FM', daylight: 'Daylight AM',
};

function load(file, stubs = {}) {
  let js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [spec, value] of Object.entries(stubs)) {
    js = js.split(`require("${spec}")`).join(value);
  }
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => { throw new Error('unstubbed require'); });
  return mod.exports;
}

const S = load(`${ROOT}/constants/schedule.ts`, {
  '@/constants/stations': `({ STATIONS: ${JSON.stringify(IDS.map((id) => ({ id })))} })`,
});
const SK = load(`${ROOT}/utils/sessionKind.ts`, {
  '@react-native-async-storage/async-storage':
    '({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } })',
  // sessionKind exports a hook as well as the plain functions, so it imports
  // React. Nothing here renders, so the hooks only need to exist.
  react: '({ useEffect: () => {}, useState: (v) => [v, () => {}] })',
});
globalThis.__sk = SK;
const C = load(`${ROOT}/constants/notificationCopy.ts`, { '@/utils/sessionKind': 'globalThis.__sk' });

let fails = 0;
const fail = (m) => { fails++; console.log('  FAIL', m); };

// 1. THE HONESTY RULE. For every day the nudge may fire on, the station it
//    names must actually be broadcasting at that hour.
for (const n of C.ON_AIR) {
  const days = n.days ?? [0, 1, 2, 3, 4, 5, 6];
  for (const day of days) {
    // 9 Aug 2026 was a Sunday, so +day lands on the weekday we want.
    const when = new Date(2026, 7, 9 + day, n.hour, n.minute ?? 0);
    if (when.getDay() !== day) { fail(`${n.id}: test date is wrong`); continue; }
    if (!S.isOnAir(n.stationId, when)) {
      fail(`${n.id} claims ${NAMES[n.stationId]} is on air on day ${day} at ${n.hour}:${String(n.minute ?? 0).padStart(2, '0')} — it is not`);
    }
  }
}

// 2. The body must NAME the station it opens — a tap that lands somewhere the
//    text didn't mention is its own kind of lie.
for (const n of C.ON_AIR) {
  const name = NAMES[n.stationId];
  if (name && !n.body.includes(name)) fail(`${n.id}: body does not mention ${name}`);
}

// 3. Ids are the no-repeat memory, so they must be unique.
const seen = new Set();
for (const n of C.ON_AIR) {
  if (seen.has(n.id)) fail(`duplicate id ${n.id}`);
  seen.add(n.id);
}

// 4. Nothing may fire in the quiet hours unless it is a late-night line.
for (const n of C.ON_AIR) {
  const h = n.hour + (n.minute ?? 0) / 60;
  if (!n.lateNight && (h >= 22.5 || h < 6.5)) fail(`${n.id} fires at ${n.hour} but is not marked lateNight`);
}

// 5. Nothing guilt-shaped, ever. These are the shapes the doc bans outright.
const BANNED = [/miss(ed)? you/i, /come back/i, /don'?t lose/i, /waiting for you/i, /streak.*lose/i];
for (const n of [...C.ON_AIR, ...Object.values(C.BADGE_COPY), ...Object.values(C.BADGE_NEARLY)]) {
  for (const re of BANNED) {
    if (re.test(n.title) || re.test(n.body)) fail(`banned phrasing in "${n.title}": ${re}`);
  }
}

console.log(`  ${C.ON_AIR.length} on-air lines checked`);
console.log(fails === 0 ? '  ALL PASS' : `  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
