import AsyncStorage from '@react-native-async-storage/async-storage';

import { cachedSessionKind, type SessionKind } from '@/utils/sessionKind';

const KEY = 'cruise_drive_log';
const MAX_EVENTS = 400;

export type DriveEvent = {
  ts: number;
  stationId: string;
  minutes?: number;
  /**
   * Driving, or listening at a desk. ABSENT MEANS DRIVING — every session
   * logged before 13.08 was recorded under the old assumption that all use was
   * driving, and rewriting that history would be its own small lie.
   */
  kind?: SessionKind;
};

/** The raw drive history — badges are judged from this. */
export async function getDriveLog(): Promise<DriveEvent[]> {
  return loadLog();
}

export type DriveStats = {
  /** Real drives only — these keep their name, so nothing that reads them
   *  starts quietly counting desk sessions as time on the road. */
  drivesThisWeek: number;
  totalDrives: number;
  /** Listening at a desk, counted in its own right. */
  listensThisWeek: number;
  totalListens: number;
  /** BOTH KINDS. What anything asking "have they used this app yet?" wants —
   *  a listener who never drives has still used it. */
  totalSessions: number;
  totalMinutes: number;
  streakDays: number;
  favoriteStationId: string | null;
};

// One drive runs at a time, so the open drive is simply the last logged event.
let driveOpenedAt: number | null = null;
// Set when the "Are you driving?" check went unanswered — the session is
// still open but its minutes stopped counting until the user shows up.
let driveSuspended = false;

async function loadLog(): Promise<DriveEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLog(log: DriveEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(log.slice(-MAX_EVENTS)));
  } catch {
    // ignore
  }
}

/** Call when a drive launches (any station, any screen). */
export async function recordDriveStart(stationId: string, kind: SessionKind = cachedSessionKind()): Promise<void> {
  const log = await loadLog();
  log.push({ ts: Date.now(), stationId, kind });
  driveOpenedAt = Date.now();
  driveSuspended = false;
  await saveLog(log);
}

async function bankMinutes(upTo: number): Promise<void> {
  if (driveOpenedAt == null) return;
  const minutes = Math.max(0, Math.round((upTo - driveOpenedAt) / 60000));
  driveOpenedAt = null;
  if (minutes === 0) return;
  const log = await loadLog();
  const last = log[log.length - 1];
  if (last) {
    last.minutes = (last.minutes ?? 0) + minutes;
    await saveLog(log);
  }
}

/**
 * The "Are you driving?" check went unanswered — bank only the time up to
 * when we asked, then stop the clock. The music and visuals keep going.
 */
export async function suspendDriveClock(askedAt: number): Promise<void> {
  if (driveOpenedAt == null) return;
  driveSuspended = true;
  await bankMinutes(askedAt);
}

/** The user showed signs of life again — the drive counts from here on. */
export function resumeDriveClock(): void {
  if (!driveSuspended) return;
  driveSuspended = false;
  driveOpenedAt = Date.now();
}

/** Call when the visual mode closes — banks the drive's duration. */
export async function recordDriveEnd(): Promise<void> {
  driveSuspended = false;
  await bankMinutes(Date.now());
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// A drive only counts once it's real: at least this many banked minutes.
// Twenty-second mode peeks and setting fiddles no longer inflate the stats.
const QUALIFYING_MINUTES = 2;

export async function getDriveStats(): Promise<DriveStats> {
  const log = await loadLog();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // The drive happening right now hasn't banked minutes yet — count it.
  const lastEvent = log[log.length - 1];
  const real = log.filter((e) =>
    (e.minutes ?? 0) >= QUALIFYING_MINUTES || (e === lastEvent && driveOpenedAt != null),
  );

  // Absent kind means driving — see the note on DriveEvent.
  const drove = real.filter((e) => (e.kind ?? 'driving') === 'driving');
  const listened = real.filter((e) => e.kind === 'listening');
  const drivesThisWeek = drove.filter((e) => e.ts >= weekAgo).length;
  const listensThisWeek = listened.filter((e) => e.ts >= weekAgo).length;
  const totalMinutes = log.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const totalDrives = drove.length;

  // Favourite = the most-driven station (real drives only).
  const counts: Record<string, number> = {};
  for (const e of real) counts[e.stationId] = (counts[e.stationId] ?? 0) + 1;
  let favoriteStationId: string | null = null;
  let max = 0;
  for (const [id, c] of Object.entries(counts)) {
    if (c > max) { max = c; favoriteStationId = id; }
  }

  // Streak: consecutive days with at least one real drive. A quiet today
  // doesn't break it yet — the chain only snaps once a full day is missed.
  const days = new Set(real.map((e) => dayKey(new Date(e.ts))));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (days.has(dayKey(cursor))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    drivesThisWeek, totalDrives,
    listensThisWeek, totalListens: listened.length,
    totalSessions: real.length,
    totalMinutes, streakDays, favoriteStationId,
  };
}
