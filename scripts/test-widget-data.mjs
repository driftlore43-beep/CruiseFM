// The widget snapshot, against the SHIPPED code and the REAL broadcast
// schedule — schedule.ts is transpiled too rather than stubbed, because the
// one claim worth testing is that the timeline never names a station that
// isn't actually on air at that moment. A widget is read at a glance and
// believed; the same honesty rule the notification budget is held to.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM';
const IDS = ['night-run', 'rain-drive', 'coastal', 'mountain-pass', 'after-midnight',
  'sunset', 'cars-coffee', 'tunnel', 'downtown', 'daylight'];

const compile = (p) => ts.transpileModule(fs.readFileSync(p, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

// The real schedule, with only its stations import stubbed (bundled images).
const schedule = (() => {
  const js = compile(`${ROOT}/src/constants/schedule.ts`).replace(
    /require\("@\/constants\/stations"\)/g,
    `({ STATIONS: ${JSON.stringify(IDS.map((id) => ({ id })))} })`,
  );
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, () => { throw new Error('no'); });
  return m.exports;
})();

const station = (id) => ({
  id, name: `${id} FM`, tagline: `${id} tagline`, premium: false,
  cardGradient: ['#111111', '#227722', '#000000'], eqColors: ['#a', '#ACCENT', '#c'],
  iconName: 'music-note', icon: 'music-note',
});

let stats = { streakDays: 3, drivesThisWeek: 2, listensThisWeek: 5, totalMinutes: 140 };
let lastCruise = { stationId: 'sunset', mode: 'vinyl' };
let kind = 'driving';

const W = (() => {
  const js = compile(`${ROOT}/src/utils/widgetData.ts`);
  const m = { exports: {} };
  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => null };
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    if (name === '@/constants/schedule') return schedule;
    if (name === '@/constants/stations') return {
      STATIONS: IDS.map(station),
      stationDial: (id) => ({ band: 'FM', label: '92.1', value: 92.1 }),
    };
    if (name === '@/utils/customStations') return {
      resolveAnyStation: (id) => station(id),
      cachedCustomStations: () => [{ id: 'custom-1' }],
      loadCustomStations: async () => [],
    };
    if (name === '@/utils/lastCruise') return { loadLastCruise: async () => lastCruise };
    if (name === '@/utils/driveStats') return { getDriveStats: async () => stats };
    if (name === '@/utils/sessionKind') return {
      cachedSessionKind: () => kind,
      loadSessionKind: async () => kind,
      words: (k) => k === 'driving'
        ? { countLabel: 'DRIVES', timeLabel: 'CRUISED' }
        : { countLabel: 'SESSIONS', timeLabel: 'LISTENED' },
    };
    throw new Error('unstubbed import: ' + name);
  };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return m.exports;
})();

let fails = 0;
const check = (name, ok, extra = '') => {
  if (ok) { console.log('  ok  ', name); return; }
  fails++; console.log('  FAIL', name, extra);
};

console.log('\n  the timeline tells the truth:');
{
  // Every entry, at every hour of a whole week, must name a station that the
  // schedule itself agrees is on air then. This is the whole point of the file.
  let lies = [];
  let emptyAt = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const now = new Date(2026, 7, 9 + d, h, 37); // deliberately mid-hour
      const line = W.buildOnAirTimeline(now);
      if (!line.length) { emptyAt.push(`${d}/${h}`); continue; }
      for (const e of line) {
        if (!schedule.isOnAir(e.id, new Date(e.at))) lies.push(`${e.id}@${new Date(e.at).toISOString()}`);
      }
    }
  }
  check('every entry is genuinely on air at its own time', lies.length === 0, lies.slice(0, 3).join(' '));
  check('never empty — a widget always has something current', emptyAt.length === 0, emptyAt.join(' '));
}

console.log('\n  the timeline is well formed:');
{
  const now = new Date(2026, 7, 12, 14, 37);
  const line = W.buildOnAirTimeline(now);
  check('first entry is NOW, not the next hour', line[0].at === now.getTime());
  check('strictly ordered in time', line.every((e, i) => i === 0 || e.at > line[i - 1].at));
  check('no consecutive repeats — one entry per real changeover',
    line.every((e, i) => i === 0 || e.id !== line[i - 1].id));
  check('changeovers land on the hour', line.slice(1).every((e) => new Date(e.at).getMinutes() === 0));
  // NOT "the last entry is 24h out" — that was the first assertion here and it
  // was wrong about the code rather than the other way round. Changeovers are
  // collapsed, so the final CHANGE can land mid-evening and that entry simply
  // stays current to the end of the window. What actually matters is that the
  // entry a widget would render at the far end names the right station.
  const far = new Date(now.getTime() + 24 * 3600e3);
  const current = [...line].reverse().find((e) => e.at <= far.getTime());
  check('the entry still current a full day out is the right station',
    current?.id === schedule.primaryOnAir(far), `${current?.id} vs ${schedule.primaryOnAir(far)}`);
  check('more than one station across a day (it is a schedule, not a constant)',
    new Set(line.map((e) => e.id)).size > 1);
  console.log(`        ${line.length} changeovers in 24h:`, line.map((e) => e.id).join(' → '));
}

console.log('\n  a widget can draw every entry:');
{
  const line = W.buildOnAirTimeline(new Date(2026, 7, 12, 9, 5));
  const bad = line.filter((e) => !e.name || !e.dial || !e.icon || !e.accent || e.colors?.length !== 3);
  check('every entry carries name, dial, icon, accent and a 3-stop ramp', bad.length === 0,
    bad.map((b) => b.id).join(' '));
}

console.log('\n  the snapshot:');
{
  const snap = await W.buildWidgetSnapshot(new Date(2026, 7, 12, 14, 37));
  check('carries a version, so an old widget can decline a newer shape', snap.version === 1);
  check('last drive points at the station last driven', snap.lastDrive?.id === 'sunset');
  check('...and remembers the mode, so the tile opens the right deck', snap.lastDrive?.mode === 'vinyl');
  check('up-next line is worded, not raw numbers', /at \d/.test(snap.upNextLine ?? ''));
  check('driving: counts DRIVES', snap.stats.countLabel === 'DRIVES' && snap.stats.sessionsThisWeek === 2);
  check('serialises (it crosses to Swift as JSON)', typeof JSON.stringify(snap) === 'string');
}

console.log('\n  a desk listener is counted in their own kind (13.08 rule):');
{
  kind = 'listening';
  const snap = await W.buildWidgetSnapshot(new Date(2026, 7, 12, 14, 37));
  check('counts SESSIONS, not drives', snap.stats.countLabel === 'SESSIONS');
  check('...and shows their listening count, not a drive count of 2', snap.stats.sessionsThisWeek === 5);
  kind = 'driving';
}

console.log('\n  it never throws on a cold or empty phone:');
{
  const keepStats = stats, keepLast = lastCruise;
  stats = null; lastCruise = null;
  const snap = await W.buildWidgetSnapshot(new Date(2026, 7, 12, 14, 37));
  check('no last drive yet — the tile has nothing to point at, and says so', snap.lastDrive === null);
  check('stats fall back to zero rather than undefined',
    snap.stats.streakDays === 0 && snap.stats.totalMinutes === 0);
  check('the schedule still fills the timeline', snap.onAir.length > 0);
  stats = keepStats; lastCruise = keepLast;
}

console.log('\n  publishing is a safe no-op without the extension:');
{
  let threw = false;
  try { await W.publishWidgetData(); } catch { threw = true; }
  check('no bridge, no throw — this runs on drive start and foreground', !threw);
  check('widgetsAvailable() is honest about it', W.widgetsAvailable() === false);
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the widgets will be told the truth\n');
process.exit(fails ? 1 : 0);
