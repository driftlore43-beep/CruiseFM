import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruise_drive_log';
const MAX_EVENTS = 400;

export type DriveEvent = { ts: number; stationId: string; minutes?: number };

/** The raw drive history — badges are judged from this. */
export async function getDriveLog(): Promise<DriveEvent[]> {
  return loadLog();
}

export type DriveStats = {
  drivesThisWeek: number;
  totalMinutes: number;
  streakDays: number;
  totalDrives: number;
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
export async function recordDriveStart(stationId: string): Promise<void> {
  const log = await loadLog();
  log.push({ ts: Date.now(), stationId });
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

export async function getDriveStats(): Promise<DriveStats> {
  const log = await loadLog();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const drivesThisWeek = log.filter((e) => e.ts >= weekAgo).length;
  const totalMinutes = log.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const totalDrives = log.length;

  // Favourite = the most-driven station.
  const counts: Record<string, number> = {};
  for (const e of log) counts[e.stationId] = (counts[e.stationId] ?? 0) + 1;
  let favoriteStationId: string | null = null;
  let max = 0;
  for (const [id, c] of Object.entries(counts)) {
    if (c > max) { max = c; favoriteStationId = id; }
  }

  // Streak: consecutive days with at least one drive. A quiet today doesn't
  // break it yet — the chain only snaps once a full day is missed.
  const days = new Set(log.map((e) => dayKey(new Date(e.ts))));
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streakDays = 0;
  while (days.has(dayKey(cursor))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { drivesThisWeek, totalMinutes, streakDays, totalDrives, favoriteStationId };
}
