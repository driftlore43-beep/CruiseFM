import { STATIONS } from '@/constants/stations';

/**
 * The schedule — what's on air, and when.
 *
 * WHY THIS EXISTS. The app is themed as radio and behaved like a static menu:
 * ten stations, always the same ten, in the same order, identical every time
 * you opened it. Real radio's whole appeal is that it is DIFFERENT when you
 * tune in — that is what makes "what's on tonight?" a question worth asking,
 * and it is the cheapest reason to come back that this app can have, because
 * it needs no new content. Only the arrangement changes.
 *
 * THE ONE RULE THAT MATTERS: off air is a PRESENTATION state, never a lock.
 * Every station stays playable at every hour. On a real receiver the frequency
 * is still there when nobody is broadcasting on it — it is simply quiet — and
 * a listener who loves Night Run at two in the afternoon must never be told
 * no. What the schedule changes is what the app SUGGESTS and how the dial
 * LOOKS, nothing else.
 *
 * Replaces the five-way hour switch that used to live in lastCruise.ts, which
 * only ever chose one station and told the rest of the app nothing.
 */

/** Half-open [start, end) in hours. `end` may be smaller than `start`, which
 *  means the window wraps past midnight. */
export type Window = {
  start: number;
  end: number;
  /** 0 = Sunday … 6 = Saturday. Omitted means every day. */
  days?: number[];
};

const WEEKEND = [0, 6];

/**
 * `'always'` is a station that broadcasts around the clock. Rain Drive is the
 * one — its schedule is really the WEATHER, and until that ships (it needs a
 * rough location, so it is deliberately later and opt-in) the honest thing is
 * to have it permanently available rather than to invent a time of day for it.
 * It never becomes the headline pick, because it has no window to be in the
 * middle of.
 */
const SCHEDULE: Record<string, Window[] | 'always'> = {
  // Morning, in order of how early they start.
  'mountain-pass': [{ start: 5, end: 10 }],
  // The weekend one, and the reason day-of-week is in here at all: "cold
  // mornings, warm cups, engines idling" is a Saturday, not a Tuesday.
  'cars-coffee': [{ start: 6, end: 11, days: WEEKEND }],
  daylight: [{ start: 10, end: 16 }],
  coastal: [{ start: 15, end: 19 }],
  // GOLDEN HOUR IS AN HOUR (owner, 13.08: "I would suggest that sunset am to
  // run from 5-6pm"). It ran 4-8pm, which is most of an evening and is why the
  // hero was still calling it golden hour at half past seven.
  sunset: [{ start: 17, end: 18 }],
  downtown: [{ start: 19, end: 23 }],
  'night-run': [{ start: 20, end: 1 }],
  tunnel: [{ start: 21, end: 2 }],
  // Runs to 5am so the dial is never dark: nothing else starts until Mountain
  // Pass at 5. If these hours are ever changed, re-run the coverage test.
  'after-midnight': [{ start: 23, end: 5 }],
  'rain-drive': 'always',
};

function inWindow(w: Window, hour: number, day: number): boolean {
  if (w.days && !w.days.includes(day)) return false;
  return w.start <= w.end
    ? hour >= w.start && hour < w.end
    // Wraps midnight: the window is the two ends of the day joined up.
    : hour >= w.start || hour < w.end;
}

/** Is this station broadcasting right now? Custom stations always are — they
 *  are the driver's own, and nobody schedules their own station. */
export function isOnAir(stationId: string, now: Date = new Date()): boolean {
  const windows = SCHEDULE[stationId];
  if (!windows) return true;
  if (windows === 'always') return true;
  return windows.some((w) => inWindow(w, now.getHours(), now.getDay()));
}

/**
 * Does this station keep hours at all? False for the round-the-clock ones and
 * for the driver's own creations — nobody schedules their own station.
 *
 * The distinction matters to the dial: an unscheduled station is neither lit
 * nor dimmed, because "on air now" is not a claim that applies to it. Lighting
 * a lamp that never goes out would only make the lamps that do mean less.
 */
export function isScheduled(stationId: string): boolean {
  const windows = SCHEDULE[stationId];
  return !!windows && windows !== 'always';
}

/** Every SCHEDULED station on air right now, in dial order — the set that
 *  earns a broadcast lamp. */
export function onAirNow(now: Date = new Date()): string[] {
  return STATIONS.filter((s) => isScheduled(s.id) && isOnAir(s.id, now)).map((s) => s.id);
}

/**
 * How far through its window a station is, 0 at the start and 1 at the end.
 * Used to pick the headline station: the one nearest the MIDDLE of its own
 * window is the one this hour most belongs to, which rotates the pick through
 * the day for free and needs no priority list to maintain.
 */
function windowSpan(w: Window): number {
  return w.start <= w.end ? w.end - w.start : 24 - w.start + w.end;
}

/**
 * MINUTE-ACCURATE, and that is not fussiness. On whole hours a ONE-HOUR window
 * is always at position 0 — you are never "half way through" it — so it scores
 * its worst possible distance from the middle for the entire time it is on, and
 * can never headline. Golden hour would have been on air and never announced.
 */
function windowProgress(w: Window, at: number): number {
  const span = windowSpan(w);
  const into = w.start <= w.end ? at - w.start : (at - w.start + 24) % 24;
  return span === 0 ? 0 : into / span;
}

/** The station this hour belongs to — the app's single recommendation. */
export function primaryOnAir(now: Date = new Date()): string {
  const hour = now.getHours();
  const at = hour + now.getMinutes() / 60;
  const day = now.getDay();
  let bestId = STATIONS[0].id;
  let bestScore = Infinity;
  for (const s of STATIONS) {
    const windows = SCHEDULE[s.id];
    // 'always' stations never headline — see the note on SCHEDULE.
    if (!windows || windows === 'always') continue;
    for (const w of windows) {
      if (!inWindow(w, hour, day)) continue;
      // Distance from the middle of the window, less two bonuses for being
      // the more SPECIFIC occasion. A day-limited window beats an everyday one
      // (Saturday at 8am is Cars & Coffee, not Mountain Pass), and a short
      // window beats a long one that happens to overlap it — a station on air
      // for one hour a day owns that hour more than one on air for six.
      // Without the second bonus a narrow window is drowned by whatever wide
      // one it sits inside, which is exactly what happened to golden hour.
      const shortBonus = Math.max(0, (4 - windowSpan(w)) * 0.2);
      const score = Math.abs(windowProgress(w, at) - 0.5) - (w.days ? 0.25 : 0) - shortBonus;
      if (score < bestScore) { bestScore = score; bestId = s.id; }
    }
  }
  return bestId;
}

/** Minutes until this station is next on air; 0 if it already is. */
export function minutesUntilOnAir(stationId: string, now: Date = new Date()): number {
  if (isOnAir(stationId, now)) return 0;
  const windows = SCHEDULE[stationId];
  if (!windows || windows === 'always') return 0;
  // Walk forward an hour at a time. A week is the longest any window can be
  // away (Cars & Coffee on a Monday), and 168 cheap checks beats a calendar.
  const probe = new Date(now.getTime());
  probe.setMinutes(0, 0, 0);
  for (let i = 1; i <= 24 * 7; i++) {
    probe.setHours(probe.getHours() + 1);
    if (windows.some((w) => inWindow(w, probe.getHours(), probe.getDay()))) {
      return Math.round((probe.getTime() - now.getTime()) / 60000);
    }
  }
  return 0;
}

/** The next station to come on air that isn't already, as an id + when. */
export function upNext(now: Date = new Date()): { id: string; minutes: number; hour: number } | null {
  let best: { id: string; minutes: number; hour: number } | null = null;
  for (const s of STATIONS) {
    if (isOnAir(s.id, now)) continue;
    const minutes = minutesUntilOnAir(s.id, now);
    if (minutes <= 0) continue;
    if (!best || minutes < best.minutes) {
      // THE HOUR IS RETURNED, not left to be worked out from `minutes`.
      // Callers used to print `now + minutes` and read the hour off that,
      // which is only true at the instant it is computed — and this line is
      // rendered on focus, so a page left open drifts and starts announcing a
      // time that has already passed. A start hour cannot go stale: it is a
      // fact about the schedule, not about now.
      best = { id: s.id, minutes, hour: nextOnAirHour(s.id, now) };
    }
  }
  return best;
}

/** The hour this station is next on air — the same walk as
 *  `minutesUntilOnAir`, reporting the hour it lands on instead of the gap. */
function nextOnAirHour(stationId: string, now: Date): number {
  const windows = SCHEDULE[stationId];
  if (!windows || windows === 'always') return now.getHours();
  const probe = new Date(now.getTime());
  probe.setMinutes(0, 0, 0);
  for (let i = 1; i <= 24 * 7; i++) {
    probe.setHours(probe.getHours() + 1);
    if (windows.some((w) => inWindow(w, probe.getHours(), probe.getDay()))) return probe.getHours();
  }
  return now.getHours();
}

/** "8pm", "5am", "midnight", "noon" — the way somebody would say it. */
export function clockLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * When a station is next on, in words: "Back at 8pm", "Back Saturday".
 * Returns null while it is on air, so a caller can render nothing.
 */
export function backOnLabel(stationId: string, now: Date = new Date()): string | null {
  if (isOnAir(stationId, now)) return null;
  const minutes = minutesUntilOnAir(stationId, now);
  if (minutes <= 0) return null;
  const then = new Date(now.getTime() + minutes * 60000);
  // Past tomorrow, the day is the useful part — "back at 6am" three days out
  // tells you nothing about which morning.
  const days = Math.floor((then.getTime() - now.getTime()) / 86400000);
  if (days >= 1) {
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][then.getDay()];
    return `Back ${dayName}`;
  }
  return `Back at ${clockLabel(then.getHours())}`;
}

/** "On air now" or "Back at 8pm" — the one line a station page prints. */
export function scheduleLine(stationId: string, now: Date = new Date()): string {
  if (SCHEDULE[stationId] === 'always') return 'On air around the clock';
  return isOnAir(stationId, now) ? 'On air now' : (backOnLabel(stationId, now) ?? 'On air now');
}
