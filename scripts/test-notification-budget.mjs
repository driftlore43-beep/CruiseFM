// The restraint rules, exercised against the SHIPPED engine.
//
// These are the whole feature — the app promises at most two a week, never two
// in a day, nothing in the small hours, nothing on a day you drove, and it
// gives up entirely when ignored. A promise like that is only worth what the
// code actually does, and none of it had ever been run.
//
// Transpiles src/utils/notifications.ts and stubs its world: an in-memory
// AsyncStorage, a fake expo-notifications that records what it was asked to
// schedule, and a controllable drive log. Assertions are PROPERTIES of the
// output rather than fixed expectations, so the test does not care what time
// it is run at.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM/src';
const IDS = ['night-run', 'rain-drive', 'coastal', 'mountain-pass', 'after-midnight',
  'sunset', 'cars-coffee', 'tunnel', 'downtown', 'daylight'];

function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function run(file, req) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', compile(file))(mod, mod.exports, req);
  return mod.exports;
}

const stationsStub = { STATIONS: IDS.map((id) => ({ id, name: id })) };
const schedule = run(`${ROOT}/constants/schedule.ts`, (s) => {
  if (s === '@/constants/stations') return stationsStub;
  throw new Error('unstubbed ' + s);
});
const copy = run(`${ROOT}/constants/notificationCopy.ts`, () => { throw new Error('no deps'); });

// ── the world ────────────────────────────────────────────────────────────────
let store = {};
let scheduled = [];
let driveLog = [];

// __esModule matters: TypeScript's importDefault interop wraps a plain object
// a SECOND time, so the module under test would look for `.default.default`
// and silently fall back to its own defaults — which reads as "install day,
// send nothing" and quietly passes.
const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (k) => (k in store ? store[k] : null),
    setItem: async (k, v) => { store[k] = v; },
  },
};
const notifications = {
  getPermissionsAsync: async () => ({ status: 'granted', canAskAgain: false }),
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  cancelAllScheduledNotificationsAsync: async () => { scheduled = []; },
  scheduleNotificationAsync: async (req) => {
    scheduled.push({ ...req.content, at: req.trigger?.date ?? null });
  },
};

function loadEngine() {
  return run(`${ROOT}/utils/notifications.ts`, (s) => {
    if (s === '@react-native-async-storage/async-storage') return asyncStorage;
    if (s === 'react-native') return { Platform: { OS: 'ios' } };
    if (s === 'expo-notifications') return notifications;
    if (s === '@/constants/notificationCopy') return copy;
    if (s === '@/constants/schedule') return schedule;
    if (s === '@/constants/stations') return stationsStub;
    if (s === '@/utils/driveStats') {
      return {
        getDriveLog: async () => driveLog,
        getDriveStats: async () => ({ drivesThisWeek: 0, totalMinutes: 0, streakDays: 0, totalDrives: driveLog.length, favoriteStationId: null }),
      };
    }
    if (s === '@/utils/lastCruise') return { loadLastCruise: async () => null };
    throw new Error('unstubbed ' + s);
  });
}

let fails = 0;
const fail = (m) => { fails++; console.log('  FAIL', m); };
const ok = (cond, m) => { if (!cond) fail(m); };

const DAY = 86400000;
const WEEK = 7 * DAY;

/** Fresh world; `installedDaysAgo` and any state overrides. */
async function reset(installedDaysAgo = 30, state = {}, prefs = null) {
  store = {};
  scheduled = [];
  driveLog = [];
  const N = loadEngine();
  if (prefs) store.cruisefm_notification_prefs = JSON.stringify(prefs);
  store.cruisefm_notification_state = JSON.stringify({
    installedAt: Date.now() - installedDaysAgo * DAY,
    pending: [], usedAt: {}, sentAt: [], ignoredStreak: 0,
    nearlySent: [], badgesSent: [], asked: true,
    ...state,
  });
  return N;
}

// 1. NOTHING ON INSTALL DAY.
{
  const N = await reset(0);
  await N.reschedule();
  ok(scheduled.length === 0, `install day should send nothing, planned ${scheduled.length}`);
}

// 2. A NORMAL WEEK: at most two, at least 48h apart, never two in one day.
{
  const N = await reset();
  await N.reschedule();
  ok(scheduled.length > 0, 'a settled user should get something planned');
  ok(scheduled.length <= 2, `ceiling is two a week, planned ${scheduled.length}`);
  const times = scheduled.map((s) => +s.at).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    ok(times[i] - times[i - 1] >= 48 * 3600000, 'two notifications closer than 48 hours');
  }
  console.log(`  normal week: ${scheduled.length} planned`);
}

// 3. QUIET HOURS respected while late-night is off.
{
  const N = await reset(30, {}, { onAir: true, lateNight: false, badges: true, recap: true, newStations: true });
  await N.reschedule();
  for (const s of scheduled) {
    const h = new Date(s.at).getHours() + new Date(s.at).getMinutes() / 60;
    ok(!(h >= 22.5 || h < 6.5), `scheduled inside quiet hours at ${new Date(s.at).toTimeString().slice(0, 5)}`);
  }
}

// 4. THE HONESTY RULE, end to end: whatever gets scheduled, its station is
//    genuinely on air when it fires.
{
  const N = await reset(30, {}, { onAir: true, lateNight: true, badges: true, recap: true, newStations: true });
  await N.reschedule();
  ok(scheduled.length <= 2, `ceiling breached with late night on: ${scheduled.length}`);
  for (const s of scheduled) {
    ok(schedule.isOnAir(s.data.stationId, new Date(s.at)),
      `${s.data.id} would fire when ${s.data.stationId} is off air`);
  }
  console.log(`  truth filter: ${scheduled.length} planned, all on air`);
}

// 5. NEVER ON A DAY THEY DROVE.
//    Only TODAY can be tested, and that is not a shortcoming of the code: a
//    drive log holds the past, so whether they will drive next Tuesday is not
//    knowable when the notification is laid down. What keeps the promise is
//    that the app replans whenever a drive ends, which drops any nudge still
//    pending for the rest of that day.
{
  const N = await reset();
  driveLog = [{ ts: Date.now(), stationId: 'sunset', minutes: 30 }];
  await N.reschedule();
  const today = new Date().toDateString();
  for (const s of scheduled) {
    ok(new Date(s.at).toDateString() !== today, 'nudged on a day they had already driven');
  }
}

// 6. THE SIX-HOUR HUSH after a drive.
{
  const N = await reset();
  driveLog = [{ ts: Date.now(), stationId: 'sunset', minutes: 30 }];
  await N.reschedule();
  for (const s of scheduled) {
    ok(+s.at - Date.now() >= 6 * 3600000, 'scheduled within six hours of a drive');
  }
}

// 7. THE BACK-OFF LADDER — the centrepiece.
{
  const cases = [
    { streak: 0, label: 'normal', min: 1 },
    { streak: 2, label: 'one a week', max: 1 },
    { streak: 4, label: 'one a fortnight', max: 1 },
    { streak: 6, label: 'stopped', max: 0 },
  ];
  for (const c of cases) {
    const N = await reset(30, { ignoredStreak: c.streak });
    await N.reschedule();
    if (c.max !== undefined) {
      ok(scheduled.length <= c.max, `streak ${c.streak} (${c.label}) planned ${scheduled.length}, max ${c.max}`);
    }
    if (c.min !== undefined) {
      ok(scheduled.length >= c.min, `streak ${c.streak} (${c.label}) planned nothing`);
    }
    console.log(`  ignored x${c.streak} → ${scheduled.length} planned (${c.label})`);
  }
}

// 8. A FORTNIGHTLY USER who was sent one yesterday waits a fortnight from
//    THAT one — planning it now is fine, firing it soon is not.
{
  const lastSent = Date.now() - DAY;
  const N = await reset(30, { ignoredStreak: 4, sentAt: [lastSent] });
  await N.reschedule();
  ok(scheduled.length <= 1, `fortnightly allowance planned ${scheduled.length}`);
  for (const s of scheduled) {
    const gapDays = (+s.at - lastSent) / DAY;
    ok(gapDays >= 14, `fortnightly gap was only ${gapDays.toFixed(1)} days`);
  }
  console.log(`  fortnightly: next in ${scheduled.length ? ((+scheduled[0].at - Date.now()) / DAY).toFixed(1) : '—'} days`);
}

// 9. A TAP RESETS THE BACK-OFF.
{
  const N = await reset(30, { ignoredStreak: 5, pending: [{ id: 'clock-off', at: Date.now() - 1000 }] });
  await N.noteOpenedFromNotification('clock-off');
  await N.reschedule();
  ok(scheduled.length > 0, 'a tap should restore the normal cadence');
}

// 10. A FULL STOP LIFTS when they open the app themselves — and only then.
{
  const N = await reset(30, { ignoredStreak: 6 });
  await N.reschedule();
  ok(scheduled.length === 0, 'stopped state should plan nothing before they return');
  await N.noteAppOpened();
  await N.reschedule();
  ok(scheduled.length > 0, 'opening the app by hand should resume the cadence');
}

// 11. THE 8-WEEK NO-REPEAT: a line used last week cannot come round again.
{
  const N = await reset(30, { usedAt: { 'clock-off': Date.now() - WEEK } });
  await N.reschedule();
  ok(!scheduled.some((s) => s.data.id === 'clock-off'), 'repeated a line inside eight weeks');
}

// 12. SWITCHING ON-AIR OFF silences the on-air nudges.
{
  const N = await reset(30, {}, { onAir: false, lateNight: false, badges: true, recap: true, newStations: true });
  await N.reschedule();
  ok(scheduled.length === 0, `on-air switched off, yet ${scheduled.length} planned`);
}

// 13. BADGES: the first look records history silently; only what is genuinely
//     new afterwards is congratulated.
{
  const N = await reset();
  await N.noteBadgesEarned(['ignition', 'night-owl']);
  ok(scheduled.length === 0, 'congratulated a badge that was already old');
  await N.noteBadgesEarned(['ignition', 'night-owl']);
  ok(scheduled.length === 0, 'congratulated the same badges twice');
  await N.noteBadgesEarned(['ignition', 'night-owl', 'full-week']);
  const quiet = (() => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 22.5 || h < 6.5; })();
  ok(quiet || scheduled.length === 1, `a freshly earned badge should send once, sent ${scheduled.length}`);
  console.log(`  badges: seeded silently, then ${scheduled.length} for the new one${quiet ? ' (quiet hours)' : ''}`);
}

// 14. WHAT'S NEW: nothing on a first sighting, one line on a real upgrade, and
//     never twice for the same version.
{
  const N = await reset();
  await N.announceReleaseIfNew('1.2.0');
  ok(scheduled.length === 0, 'announced a release on first run');
  await N.announceReleaseIfNew('1.3.0');
  const quiet = (() => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 22.5 || h < 6.5; })();
  ok(quiet || scheduled.length === 1, `an upgrade should announce once, sent ${scheduled.length}`);
  const after = scheduled.length;
  await N.announceReleaseIfNew('1.3.0');
  ok(scheduled.length === after, 'announced the same version twice');
  console.log(`  what's new: silent on install, ${after} on upgrade${quiet ? ' (quiet hours)' : ''}`);
}

// 15. A VERSION WITH NO COPY says nothing at all.
{
  const N = await reset();
  await N.announceReleaseIfNew('1.2.0');
  await N.announceReleaseIfNew('9.9.9');
  ok(scheduled.length === 0, 'announced a version that has no line written for it');
}

console.log(fails === 0 ? '  ALL PASS' : `  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
