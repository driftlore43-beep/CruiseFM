/**
 * Every line Cruise FM will ever send, and when it is allowed to send it.
 *
 * Drafted in docs/notifications-copy.md and approved by the owner (07.08).
 * The rule that governs all of it: a notification is a STATEMENT ABOUT THE
 * WORLD, never a request. "Sunset AM is on air" is a fact; "come back to
 * Cruise FM" is a plea. The first gets tapped, the second gets muted.
 *
 * Each line carries the station it opens, so one tap goes straight into a
 * drive rather than to the home screen.
 */

export type NudgeKind = 'onair' | 'badge' | 'recap' | 'whatsnew';

export type Nudge = {
  /** Stable id — the "no repeat within 8 weeks" rule remembers these. */
  id: string;
  kind: NudgeKind;
  title: string;
  body: string;
  /** Which station the tap opens. */
  stationId: string;
  /** 0 = Sunday … 6 = Saturday. Omit for any day. */
  days?: number[];
  /** Local hour it may fire at. */
  hour: number;
  minute?: number;
  /** Late-night lines are opt-in — they sit outside the quiet hours. */
  lateNight?: boolean;
};

/** The on-air nudges: a station coming on air at the hour it suits. */
export const ON_AIR: Nudge[] = [
  // Weekday evening — the drive home.
  { id: 'clock-off', kind: 'onair', days: [1, 2, 3, 4], hour: 17, minute: 15,
    title: 'Clocking off?', body: 'Sunset AM is on air. Golden hour, open roads.', stationId: 'sunset' },
  { id: 'long-way-home', kind: 'onair', days: [1, 2, 3, 4], hour: 17, minute: 40,
    title: 'The long way home', body: "Sunset AM's playing. No need to rush back.", stationId: 'sunset' },
  { id: 'sun-going-down', kind: 'onair', days: [1, 2, 3], hour: 18, minute: 5,
    title: "Sun's going down", body: 'Golden hour on Sunset AM. Take the scenic route.', stationId: 'sunset' },

  // Friday — the week ends.
  { id: 'week-done', kind: 'onair', days: [5], hour: 17, minute: 20,
    title: "That's the week done", body: 'Sunset AM is on air. Drive it out of your system.', stationId: 'sunset' },
  { id: 'friday-finally', kind: 'onair', days: [5], hour: 19, minute: 30,
    title: 'Friday, finally', body: "Downtown FM's on. Violet towers, sleeping streets.", stationId: 'downtown' },

  // Saturday morning — the weekend jam.
  { id: 'sat-nowhere', kind: 'onair', days: [6], hour: 10, minute: 15,
    title: 'Saturday. Nowhere to be.', body: "Daylight AM's playing. Top down, open road.", stationId: 'daylight' },
  { id: 'cold-morning', kind: 'onair', days: [6], hour: 8, minute: 45,
    title: 'Cold morning, warm cup', body: 'Cars & Coffee FM is on air. Engines idling.', stationId: 'cars-coffee' },
  { id: 'roads-are-yours', kind: 'onair', days: [6], hour: 11, minute: 30,
    title: 'The roads are yours today', body: 'Daylight AM. Go somewhere.', stationId: 'daylight' },

  // Sunday — the wind-down.
  { id: 'sunday-last-light', kind: 'onair', days: [0], hour: 17, minute: 45,
    title: "Sunday's last light", body: 'Coastal FM is on. Ocean air, open horizons.', stationId: 'coastal' },
  { id: 'one-before-monday', kind: 'onair', days: [0], hour: 20, minute: 15,
    title: 'One more before Monday', body: "Night Run AM's playing. Empty expressways.", stationId: 'night-run' },

  // Weekday morning — the run in.
  { id: 'morning-air', kind: 'onair', days: [1, 2, 3, 4, 5], hour: 7, minute: 45,
    title: 'Morning air', body: 'Mountain Pass FM. Cold air, fog ahead, one more corner.', stationId: 'mountain-pass' },
  { id: 'beat-traffic', kind: 'onair', days: [1, 2, 3, 4, 5], hour: 8, minute: 20,
    title: 'Beat the traffic', body: 'Cars & Coffee FM is on air. Warm cup, cold morning.', stationId: 'cars-coffee' },

  // Late night — opt-in only, deliberately outside quiet hours.
  { id: 'world-asleep', kind: 'onair', hour: 23, minute: 30, lateNight: true,
    title: "The world's asleep", body: 'After Hours FM. The road belongs to you.', stationId: 'after-midnight' },
  { id: 'still-up', kind: 'onair', hour: 22, minute: 45, lateNight: true,
    title: 'Still up?', body: "Night Run AM's on. Blue-lit dashboards.", stationId: 'night-run' },
];

/** Badge lines. Sent only when something is genuinely earned, or one drive
 *  away — and the "one more" variant fires ONCE per badge, ever. */
export const BADGE_COPY: Record<string, { title: string; body: string }> = {
  ignition:      { title: 'Ignition', body: "Your first drive's on the books." },
  'night-owl':   { title: 'Night Owl, earned', body: 'Three drives after dark. It suits you.' },
  'three-peat':  { title: 'Three-Peat', body: 'Three days running. Something is forming.' },
  'full-week':   { title: 'Full Week', body: "Seven days straight. That's a habit now." },
  'warm-engine': { title: 'Warm Engine', body: 'An hour of music on the road.' },
  regular:       { title: 'Regular', body: 'Ten drives in. You know the dial by now.' },
  'dial-surfer': { title: 'Dial Surfer', body: "Every mood, driven. There isn't one left." },
};

/** One drive away — the only forward-looking line, and never a countdown. */
export const BADGE_NEARLY: Record<string, { title: string; body: string }> = {
  'full-week':  { title: 'One more for Full Week', body: "Six days down. Night Run AM's on air." },
  'three-peat': { title: 'One more for Three-Peat', body: 'Two days running. Tomorrow makes it three.' },
};

/** Sunday recap. Never sent when the week was empty — silence is the
 *  correct message, and a nag about not driving is the fastest way to be
 *  muted forever. */
export function recapCopy(drives: number, minutes: number, station: string | null):
  { title: string; body: string } | null {
  if (drives < 1) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h ? `${h}h ${m}m` : `${m} minutes`;
  const where = station ? ` Mostly ${station}.` : '';
  if (drives === 1) return { title: 'One drive this week', body: `${time} on the road.${where} Worth it.` };
  if (drives >= 6) return { title: 'Some week', body: `${drives} drives, ${time}.${where}` };
  return { title: 'Your week on the road', body: `${drives} drives, ${time}.${where}` };
}

/** What's new. At most one per release, and never "we fixed some bugs". */
export const WHATS_NEW: { id: string; title: string; body: string; stationId: string } | null = null;
