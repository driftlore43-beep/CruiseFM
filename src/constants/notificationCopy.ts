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

import { words, type SessionKind } from '@/utils/sessionKind';

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
  // 17:10, not 18:05 — golden hour is 5-6pm since 13.08, and the truth test
  // caught this line the moment the window moved.
  { id: 'sun-going-down', kind: 'onair', days: [1, 2, 3], hour: 17, minute: 10,
    title: "Sun's going down", body: 'Golden hour on Sunset AM. Take the scenic route.', stationId: 'sunset' },

  // Friday — the week ends.
  { id: 'week-done', kind: 'onair', days: [5], hour: 17, minute: 20,
    title: "That's the week done", body: 'Sunset AM is on air. Drive it out of your system.', stationId: 'sunset' },
  { id: 'friday-finally', kind: 'onair', days: [5], hour: 19, minute: 30,
    title: 'Friday, finally', body: "Downtown FM's on. Violet towers, sleeping streets.", stationId: 'downtown' },

  // Weekend mornings — the jam, and the one window Cars & Coffee keeps.
  { id: 'sat-nowhere', kind: 'onair', days: [6], hour: 10, minute: 15,
    title: 'Saturday. Nowhere to be.', body: "Daylight AM's playing. Top down, open road.", stationId: 'daylight' },
  { id: 'cold-morning', kind: 'onair', days: [6], hour: 8, minute: 45,
    title: 'Cold morning, warm cup', body: 'Cars & Coffee FM is on air. Engines idling.', stationId: 'cars-coffee' },
  { id: 'roads-are-yours', kind: 'onair', days: [6], hour: 11, minute: 30,
    title: 'The roads are yours today', body: 'Daylight AM. Go somewhere.', stationId: 'daylight' },
  { id: 'sunday-coffee', kind: 'onair', days: [0], hour: 9, minute: 15,
    title: 'Sunday, slow start', body: 'Cars & Coffee FM is on air. Nowhere to be yet.', stationId: 'cars-coffee' },

  // Sunday — the wind-down.
  { id: 'sunday-last-light', kind: 'onair', days: [0], hour: 17, minute: 45,
    title: "Sunday's last light", body: 'Coastal FM is on. Ocean air, open horizons.', stationId: 'coastal' },
  { id: 'one-before-monday', kind: 'onair', days: [0], hour: 20, minute: 15,
    title: 'One more before Monday', body: "Night Run AM's playing. Empty expressways.", stationId: 'night-run' },

  // Weekday morning — the run in.
  { id: 'morning-air', kind: 'onair', days: [1, 2, 3, 4, 5], hour: 7, minute: 45,
    title: 'Morning air', body: 'Mountain Pass FM. Cold air, fog ahead, one more corner.', stationId: 'mountain-pass' },
  // WAS Cars & Coffee, and that was a lie: its window is weekend mornings, so
  // on a Tuesday at 8:20 the station named here was not on air. Caught by
  // scripts/test-notifications.mjs the day the schedule landed. Mountain Pass
  // is the station that genuinely broadcasts on a weekday morning.
  { id: 'beat-traffic', kind: 'onair', days: [1, 2, 3, 4, 5], hour: 8, minute: 20,
    title: 'Beat the traffic', body: 'Mountain Pass FM is on air. Take the long way in.', stationId: 'mountain-pass' },

  // Late night — opt-in only, deliberately outside quiet hours.
  { id: 'world-asleep', kind: 'onair', hour: 23, minute: 30, lateNight: true,
    title: "The world's asleep", body: 'After Hours FM. The road belongs to you.', stationId: 'after-midnight' },
  { id: 'still-up', kind: 'onair', hour: 22, minute: 45, lateNight: true,
    title: 'Still up?', body: "Night Run AM's on. Blue-lit dashboards.", stationId: 'night-run' },
];

/** Badge lines. Sent only when something is genuinely earned, or one drive
 *  away — and the "one more" variant fires ONCE per badge, ever. */
export const BADGE_COPY: Record<string, { title: string; body: string }> = {
  ignition:      { title: 'Ignition', body: "Your first one's on the books." },
  'night-owl':   { title: 'Night Owl, earned', body: 'Three after dark. It suits you.' },
  'three-peat':  { title: 'Three-Peat', body: 'Three days running. Something is forming.' },
  'full-week':   { title: 'Full Week', body: "Seven days straight. That's a habit now." },
  'warm-engine': { title: 'Warm Engine', body: 'An hour of music.' },
  regular:       { title: 'Regular', body: 'Ten in. You know the dial by now.' },
  'dial-surfer': { title: 'Dial Surfer', body: "Every mood, heard. There isn't one left." },
};

/** One drive away — the only forward-looking line, and never a countdown. */
export const BADGE_NEARLY: Record<string, { title: string; body: string }> = {
  'full-week':  { title: 'One more for Full Week', body: "Six days down. Night Run AM's on air." },
  'three-peat': { title: 'One more for Three-Peat', body: 'Two days running. Tomorrow makes it three.' },
};

/**
 * One line per release, and only for something you can actually go and look
 * at. Never "we fixed some bugs", never an offer.
 *
 * Keyed by the version in app.json. A release with no entry here announces
 * NOTHING — which is the right default, since most releases have nothing worth
 * interrupting anyone for. Add a line only when a version genuinely adds
 * something to see.
 */
export const WHATS_NEW: Record<string, { title: string; body: string; stationId?: string }> = {
  '1.3.0': {
    title: 'Your own photo, behind your own station',
    body: 'Make a station, give it a picture from your camera roll, and drive to it.',
  },
};

/**
 * Sunday recap. Never sent when the week was empty — silence is the correct
 * message, and a nag about not driving is the fastest way to be muted forever.
 *
 * Kind-aware, because it was counting DRIVES: a desk listener would have had
 * zero every week and never received one at all.
 */
export function recapCopy(
  count: number, minutes: number, station: string | null, kind: SessionKind = 'driving',
): { title: string; body: string } | null {
  if (count < 1) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h ? `${h}h ${m}m` : `${m} minutes`;
  const where = station ? ` Mostly ${station}.` : '';
  const w = words(kind);
  const heading = kind === 'driving' ? 'Your week on the road' : 'Your week of listening';
  if (count === 1) {
    return {
      title: `One ${w.noun} this week`,
      body: `${time}${kind === 'driving' ? ' on the road' : ''}.${where} Worth it.`,
    };
  }
  if (count >= 6) return { title: 'Some week', body: `${count} ${w.plural}, ${time}.${where}` };
  return { title: heading, body: `${count} ${w.plural}, ${time}.${where}` };
}
