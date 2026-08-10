import { STATIONS } from '@/constants/stations';
import { type DriveEvent } from '@/utils/driveStats';

/**
 * Badges — free for everyone, forever (product decision). Judged purely from
 * the on-device drive log, so nothing here needs a server or an account.
 */

export type Badge = {
  id: string;
  name: string;
  desc: string;
  /** MaterialCommunityIcons glyph. */
  icon: string;
  /** True = can never be earned in-app (e.g. the Founder cosmetic). */
  reserved?: boolean;
};

export type JudgedBadge = Badge & { earned: boolean };

export const BADGES: Badge[] = [
  { id: 'ignition',     name: 'Ignition',      desc: 'Your first drive on the books.',            icon: 'key-variant' },
  { id: 'night-owl',    name: 'Night Owl',     desc: 'Three drives after dark (10pm–5am).',       icon: 'weather-night' },
  { id: 'three-peat',   name: 'Three-Peat',    desc: 'Drive three days in a row.',                icon: 'fire' },
  { id: 'full-week',    name: 'Full Week',     desc: 'Drive seven days in a row.',                icon: 'calendar-week' },
  { id: 'warm-engine',  name: 'Warm Engine',   desc: 'One hour of music on the road.',            icon: 'engine-outline' },
  { id: 'road-tripper', name: 'Road Tripper',  desc: 'Ten hours cruised.',                        icon: 'map-marker-distance' },
  { id: 'long-hauler',  name: 'Long Hauler',   desc: 'Fifty hours cruised.',                      icon: 'highway' },
  { id: 'regular',      name: 'Regular',       desc: 'Ten drives with Cruise FM.',                icon: 'car' },
  { id: 'veteran',      name: 'Veteran',       desc: 'Fifty drives with Cruise FM.',              icon: 'medal-outline' },
  { id: 'local-legend', name: 'Local Legend',  desc: 'Ten drives on a single station.',           icon: 'star-circle-outline' },
  { id: 'dial-surfer',  name: 'Dial Surfer',   desc: 'Drive with every mood.',                    icon: 'radio' },
  { id: 'founder',      name: 'Founder',       desc: 'Here at the start. Never offered again.', icon: 'flag-checkered', reserved: true },
];

function streakDays(log: DriveEvent[]): number {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const days = new Set(log.map((e) => dayKey(new Date(e.ts))));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(cursor))) { n++; cursor.setDate(cursor.getDate() - 1); }
  return n;
}

/** Judge every badge against the drive log (+ the device's Founder status). */
export function judgeBadges(log: DriveEvent[], opts?: { founder?: boolean }): JudgedBadge[] {
  const totalDrives  = log.length;
  const totalMinutes = log.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const nightDrives  = log.filter((e) => { const h = new Date(e.ts).getHours(); return h >= 22 || h < 5; }).length;
  const perStation: Record<string, number> = {};
  for (const e of log) perStation[e.stationId] = (perStation[e.stationId] ?? 0) + 1;
  const maxOnOne = Math.max(0, ...Object.values(perStation));
  const allEight = STATIONS.every((s) => (perStation[s.id] ?? 0) > 0);
  const streak = streakDays(log);

  const earned: Record<string, boolean> = {
    'ignition':     totalDrives >= 1,
    'night-owl':    nightDrives >= 3,
    'three-peat':   streak >= 3,
    'full-week':    streak >= 7,
    'warm-engine':  totalMinutes >= 60,
    'road-tripper': totalMinutes >= 600,
    'long-hauler':  totalMinutes >= 3000,
    'regular':      totalDrives >= 10,
    'veteran':      totalDrives >= 50,
    'local-legend': maxOnOne >= 10,
    'dial-surfer':  allEight,
    'founder':      !!opts?.founder, // granted by install date, never earned by driving
  };

  return BADGES.map((b) => ({ ...b, earned: earned[b.id] ?? false }));
}
