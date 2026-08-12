import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { BADGE_COPY, BADGE_NEARLY, ON_AIR, recapCopy, type Nudge } from '@/constants/notificationCopy';
import { STATIONS } from '@/constants/stations';
import { getDriveLog, getDriveStats } from '@/utils/driveStats';
import { loadLastCruise } from '@/utils/lastCruise';

/**
 * CRUISE FM'S NOTIFICATIONS — and, mostly, the rules that stop them.
 *
 * Everything here is LOCAL: the phone schedules its own reminders, nothing is
 * sent to a server, no push tokens exist, and no data leaves the device. That
 * is what keeps the Privacy page's "no Cruise FM server" claim literally true.
 *
 * THE RESTRAINT IS THE FEATURE. Most apps treat notifications as a volume
 * dial — more sends, more opens — which works for a quarter and then gets you
 * muted, permanently, because nobody ever un-mutes an app. So the budget here
 * is mechanical rather than aspirational, and the app gives up quietly when it
 * isn't wanted:
 *
 *   • at most 2 a week, and never two within 48 hours
 *   • nothing between 22:30 and 06:30 unless late-night is opted into
 *   • never during a drive, nor for 6 hours after one
 *   • never on a day they have already driven
 *   • no line repeated within 8 weeks
 *   • nothing at all on the day the app was installed
 *
 * And the centrepiece — AN IGNORED NOTIFICATION IS AN ANSWER. Two ignored in
 * a row and the app drops to one a week; four, one a fortnight; six, it stops
 * completely until they open the app themselves, and then resumes with no
 * "we missed you". Most apps read silence as a reason to try harder. That is
 * exactly why people mute them.
 */

// expo-notifications is a native module: absent on web and in any build made
// before 1.2.0. Everything degrades to doing nothing rather than throwing.
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
  }
} catch {
  Notifications = null;
}

export function notificationsAvailable(): boolean {
  return !!Notifications;
}

// ── Settings and state ───────────────────────────────────────────────────────

const PREFS_KEY = 'cruisefm_notification_prefs';
const STATE_KEY = 'cruisefm_notification_state';

export type NotifPrefs = {
  onAir: boolean;
  lateNight: boolean;
  badges: boolean;
  recap: boolean;
  newStations: boolean;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  onAir: true,
  lateNight: false,
  badges: true,
  recap: true,
  newStations: true,
};

type State = {
  /** When the app was first opened — nothing sends on day one. */
  installedAt: number;
  /** Fire times of everything scheduled, so we can tell ignored from tapped. */
  pending: { id: string; at: number }[];
  /** Line id → when it was last sent (the 8-week no-repeat rule). */
  usedAt: Record<string, number>;
  /** Fire times of what has actually gone out, newest last. */
  sentAt: number[];
  /** Consecutive notifications that came and went untouched. */
  ignoredStreak: number;
  /** Badge "one more" lines already spent — once each, ever. */
  nearlySent: string[];
  /** Badges we have already congratulated. */
  badgesSent: string[];
  /** Set when the permission prompt has been shown, so it is never shown twice. */
  asked: boolean;
};

const DEFAULT_STATE: State = {
  installedAt: 0, pending: [], usedAt: {}, sentAt: [],
  ignoredStreak: 0, nearlySent: [], badgesSent: [], asked: false,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : DEFAULT_NOTIF_PREFS;
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export async function setNotifPrefs(patch: Partial<NotifPrefs>): Promise<NotifPrefs> {
  const next = { ...(await getNotifPrefs()), ...patch };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  void reschedule();
  return next;
}

async function getState(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const s = raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
    if (!s.installedAt) { s.installedAt = Date.now(); await putState(s); }
    return s;
  } catch {
    return { ...DEFAULT_STATE, installedAt: Date.now() };
  }
}

async function putState(s: State): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(s)).catch(() => {});
}

// ── The budget ───────────────────────────────────────────────────────────────

const WEEK = 7 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 48 * 60 * 60 * 1000;
const NO_REPEAT_MS = 8 * WEEK;
/** Quiet hours, unless the late-night lines are switched on. */
const QUIET_FROM = 22.5, QUIET_TO = 6.5;
/** After a drive ends, the app has nothing to tell them for a while. */
const AFTER_DRIVE_QUIET_MS = 6 * 60 * 60 * 1000;

/**
 * How many may be sent in a rolling week, given how the last few landed.
 * This is the whole anti-nag mechanism, and it only ever goes one way until
 * the person comes back of their own accord.
 */
function weeklyAllowance(ignoredStreak: number): number {
  if (ignoredStreak >= 6) return 0;      // stop entirely; they'll be back or they won't
  if (ignoredStreak >= 4) return 0.5;    // one a fortnight
  if (ignoredStreak >= 2) return 1;      // one a week
  return 2;
}

function inQuietHours(d: Date): boolean {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= QUIET_FROM || h < QUIET_TO;
}

/** The next occurrence of a nudge's day/time, at least `after`. */
function nextOccurrence(n: Nudge, after: Date): Date {
  const d = new Date(after);
  d.setSeconds(0, 0);
  for (let i = 0; i < 14; i++) {
    const cand = new Date(d.getTime() + i * DAY);
    cand.setHours(n.hour, n.minute ?? 0, 0, 0);
    if (cand <= after) continue;
    if (n.days && !n.days.includes(cand.getDay())) continue;
    return cand;
  }
  return new Date(after.getTime() + 14 * DAY);
}

function sameDay(a: number, b: number): boolean {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

// ── Permission ───────────────────────────────────────────────────────────────

/** Whether the honest pre-prompt card should be offered: after the THIRD
 *  drive, never on first launch, and only once ever. iOS allows exactly one
 *  system prompt, and a denial is close to permanent — so it has to be
 *  earned before it is asked for. */
export async function shouldOfferPrompt(): Promise<boolean> {
  if (!Notifications) return false;
  const s = await getState();
  if (s.asked) return false;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'undetermined') { await putState({ ...s, asked: true }); return false; }
  } catch { return false; }
  const log = await getDriveLog().catch(() => []);
  return log.length >= 3;
}

/** Runs the system prompt. Called only from the pre-prompt card's yes button. */
export async function requestPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const s = await getState();
  await putState({ ...s, asked: true });
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';
    if (granted) await reschedule();
    return granted;
  } catch {
    return false;
  }
}

export async function markPromptDismissed(): Promise<void> {
  const s = await getState();
  await putState({ ...s, asked: true });
}

/**
 * What iOS currently thinks, for the settings page.
 *
 *  - 'granted'      — notifications will arrive.
 *  - 'askable'      — the one system prompt has never been spent; we can ask.
 *  - 'denied'       — they said no, or turned it off later. Only the phone's
 *                     own Settings can undo that; the app cannot ask again.
 *  - 'unsupported'  — no module (web, or a build before notifications landed).
 */
export type NotifPermission = 'granted' | 'askable' | 'denied' | 'unsupported';

export async function getPermissionState(): Promise<NotifPermission> {
  if (!Notifications) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.status === 'granted') return 'granted';
    if (p.status === 'undetermined') return 'askable';
    return p.canAskAgain ? 'askable' : 'denied';
  } catch {
    return 'unsupported';
  }
}

async function hasPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.status === 'granted';
  } catch {
    return false;
  }
}

// ── Reconciling what happened while the app was closed ───────────────────────

/**
 * Anything scheduled whose time has passed, and which was not tapped, counts
 * as ignored. Called before planning, so the allowance always reflects
 * reality rather than optimism.
 */
async function reconcile(s: State): Promise<State> {
  const now = Date.now();
  const fired = s.pending.filter((p) => p.at <= now);
  if (!fired.length) return s;
  const sentAt = [...s.sentAt, ...fired.map((f) => f.at)].filter((t) => now - t < 12 * WEEK);
  return {
    ...s,
    pending: s.pending.filter((p) => p.at > now),
    sentAt,
    ignoredStreak: s.ignoredStreak + fired.length,
  };
}

/** A tap resets the back-off — they wanted it, so the app carries on. */
export async function noteOpenedFromNotification(id: string): Promise<void> {
  const s = await getState();
  await putState({
    ...s,
    ignoredStreak: 0,
    pending: s.pending.filter((p) => p.id !== id),
  });
}

/** Opening the app by hand also lifts a full stop — the rule is that silence
 *  ends when they come back on their own, not when we decide to try again. */
export async function noteAppOpened(): Promise<void> {
  const s = await getState();
  if (s.ignoredStreak >= 6) await putState({ ...s, ignoredStreak: 0 });
}

// ── Planning ─────────────────────────────────────────────────────────────────

type Planned = { id: string; title: string; body: string; at: Date; stationId: string };

async function plan(): Promise<Planned[]> {
  const prefs = await getNotifPrefs();
  let s = await getState();
  s = await reconcile(s);
  await putState(s);

  const now = Date.now();
  // Nothing at all on install day.
  if (sameDay(s.installedAt, now)) return [];

  const allowance = weeklyAllowance(s.ignoredStreak);
  if (allowance <= 0) return [];

  const sentThisWeek = s.sentAt.filter((t) => now - t < WEEK).length;
  const lastSent = s.sentAt.length ? Math.max(...s.sentAt) : 0;
  // A fortnightly allowance means one send per two weeks, expressed as a gap.
  const minGap = allowance < 1 ? 2 * WEEK : MIN_GAP_MS;
  if (allowance >= 1 && sentThisWeek >= allowance) return [];

  const log = await getDriveLog().catch(() => []);
  const lastDrive = log.length ? Math.max(...log.map((d) => d.ts)) : 0;

  const earliest = new Date(Math.max(
    now + 60_000,
    lastSent + minGap,
    lastDrive + AFTER_DRIVE_QUIET_MS,
  ));

  const out: Planned[] = [];
  const budget = allowance >= 1 ? Math.floor(allowance) - sentThisWeek : 1;

  if (prefs.onAir) {
    const candidates = ON_AIR
      .filter((n) => (n.lateNight ? prefs.lateNight : true))
      // The 8-week no-repeat rule.
      .filter((n) => !s.usedAt[n.id] || now - s.usedAt[n.id] > NO_REPEAT_MS)
      .map((n) => ({ n, at: nextOccurrence(n, earliest) }))
      .filter(({ n, at }) => (n.lateNight ? true : !inQuietHours(at)))
      // Never on a day they have already driven.
      .filter(({ at }) => !log.some((d) => sameDay(d.ts, at.getTime())))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    let last = earliest.getTime();
    for (const { n, at } of candidates) {
      if (out.length >= budget) break;
      if (at.getTime() < last) continue;
      out.push({ id: n.id, title: n.title, body: n.body, at, stationId: n.stationId });
      last = at.getTime() + MIN_GAP_MS;
    }
  }

  return out;
}

// ── Scheduling ───────────────────────────────────────────────────────────────

let rescheduling = false;

/**
 * Cancel everything and lay out the next allowed nudges. Safe to call often —
 * on launch, on foreground, when a drive ends, when settings change.
 */
export async function reschedule(): Promise<void> {
  if (!Notifications || rescheduling) return;
  if (!(await hasPermission())) return;
  rescheduling = true;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const planned = await plan();
    const s = await getState();
    const pending: { id: string; at: number }[] = [];
    const usedAt = { ...s.usedAt };

    for (const p of planned) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: p.title,
            body: p.body,
            data: { id: p.id, stationId: p.stationId },
          },
          trigger: { type: 'date', date: p.at } as never,
        });
        pending.push({ id: p.id, at: p.at.getTime() });
        usedAt[p.id] = p.at.getTime();
      } catch { /* one failure must not lose the rest */ }
    }
    await putState({ ...s, pending, usedAt });
  } catch {
    /* scheduling is best-effort; a failure must never surface to a driver */
  } finally {
    rescheduling = false;
  }
}

/** Congratulate a freshly-earned badge — outside the weekly budget, because
 *  it is a response to something they did, not an attempt to get them back.
 *  Still silent during quiet hours and during a drive. */
export async function noteBadgesEarned(earnedIds: string[]): Promise<void> {
  if (!Notifications || !earnedIds.length) return;
  const prefs = await getNotifPrefs();
  if (!prefs.badges) return;
  if (!(await hasPermission())) return;
  const s = await getState();
  const fresh = earnedIds.filter((id) => BADGE_COPY[id] && !s.badgesSent.includes(id));
  if (!fresh.length) return;
  const copy = BADGE_COPY[fresh[0]];
  const last = await loadLastCruise().catch(() => null);
  const stationId = last?.stationId ?? 'night-run';
  if (inQuietHours(new Date())) {
    await putState({ ...s, badgesSent: [...s.badgesSent, ...fresh] });
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, data: { id: `badge:${fresh[0]}`, stationId } },
      trigger: { type: 'timeInterval', seconds: 60, repeats: false } as never,
    });
  } catch { /* ignore */ }
  await putState({ ...s, badgesSent: [...s.badgesSent, ...fresh] });
}

/** The Sunday recap. Silence when the week was empty is deliberate — a nag
 *  about NOT driving is the fastest way to be muted forever. */
export async function scheduleRecapIfDue(): Promise<void> {
  if (!Notifications) return;
  const prefs = await getNotifPrefs();
  if (!prefs.recap) return;
  if (!(await hasPermission())) return;
  const stats = await getDriveStats().catch(() => null);
  if (!stats || stats.drivesThisWeek < 1) return;
  const station = stats.favoriteStationId ? STATIONS.find((x) => x.id === stats.favoriteStationId)?.name ?? null : null;
  const copy = recapCopy(stats.drivesThisWeek, stats.totalMinutes, station);
  if (!copy) return;
  const at = new Date();
  const daysToSunday = (7 - at.getDay()) % 7;
  at.setDate(at.getDate() + daysToSunday);
  at.setHours(19, 30, 0, 0);
  if (at.getTime() < Date.now() + 60_000) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, data: { id: 'recap', stationId: stats.favoriteStationId ?? 'night-run' } },
      trigger: { type: 'date', date: at } as never,
    });
  } catch { /* ignore */ }
}

export { BADGE_NEARLY };
