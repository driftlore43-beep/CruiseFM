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

/**
 * NOT SPLIT INTO ROAD BADGES AND DESK BADGES, and this is worth explaining
 * because a split was the obvious answer.
 *
 * Read what each one actually measures: nights, streaks, hours, stations,
 * moods. Every single one is about USING THE APP, not about being in a car —
 * only the wording was drive-shaped. So splitting them would have meant
 * inventing a second, near-identical set, and left the desk listener with an
 * empty shelf until it existed.
 *
 * They are judged on every session instead, and worded so they are true of
 * both. The split that IS visible lives where it belongs: the stats strip,
 * which counts drives and desk sessions separately and says which is which.
 */
/**
 * THE FIVE CAR-SHAPED BADGES WERE RENAMED, NOT REPLACED (owner, 13.09: "the
 * app needs to remove the driving badges — suggest other badges that can come
 * instead"). Ignition, Warm Engine, Road Tripper, Long Hauler and Regular's
 * car icon all described a car; none of them MEASURED one, which is the point
 * the note above already makes. So the criteria are untouched and only the
 * name, the icon and the wording moved into the radio and record voice the
 * rest of the app speaks.
 *
 * KEEPING THE IDS IS THE WHOLE REASON THIS IS A RENAME. Earned badges are
 * remembered by id (`noteBadgesEarned`), so a new id would empty a listener's
 * shelf and then congratulate them all over again for something they earned
 * weeks ago. Never change an id to change a name.
 *
 * WHY THESE WORDS: a record's two sides make an hour the natural first
 * milestone; "Long Player" is what LP stands for; a box set is what fifty
 * hours of listening looks like on a shelf. They mean the same thing at a
 * desk and in a car, which is the bar every badge here has to clear.
 */
export const BADGES: Badge[] = [
  { id: 'ignition',     name: 'Tuned In',      desc: 'Your first session on the books.',          icon: 'radio-tower' },
  { id: 'night-owl',    name: 'Night Owl',     desc: 'Three sessions after dark (10pm–5am).',     icon: 'weather-night' },
  { id: 'three-peat',   name: 'Three-Peat',    desc: 'Three days in a row.',                      icon: 'fire' },
  { id: 'full-week',    name: 'Full Week',     desc: 'Seven days in a row.',                      icon: 'calendar-week' },
  { id: 'warm-engine',  name: 'Side A',        desc: 'One hour of music.',                        icon: 'album' },
  { id: 'road-tripper', name: 'Long Player',   desc: 'Ten hours listened.',                       icon: 'record-player' },
  { id: 'long-hauler',  name: 'Box Set',       desc: 'Fifty hours listened.',                     icon: 'archive-music-outline' },
  { id: 'regular',      name: 'Regular',       desc: 'Ten sessions with Cruise FM.',              icon: 'headphones' },
  { id: 'veteran',      name: 'Veteran',       desc: 'Fifty sessions with Cruise FM.',            icon: 'medal-outline' },
  { id: 'local-legend', name: 'Local Legend',  desc: 'Ten sessions on a single station.',         icon: 'star-circle-outline' },
  { id: 'dial-surfer',  name: 'Dial Surfer',   desc: 'Every mood, heard.',                        icon: 'radio' },
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
