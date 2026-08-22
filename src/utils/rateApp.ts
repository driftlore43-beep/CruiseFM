import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_STORE_URL } from '@/utils/appStoreUpdate';

/**
 * ASKING FOR A RATING, ONCE.
 *
 * The listing has no ratings at all, which costs twice over: it is a ranking
 * signal, and to someone deciding whether to tap Get, "no ratings" reads as
 * "nobody uses this". Nothing in the app has ever asked.
 *
 * THE RESTRAINT IS THE DESIGN, same as the notification budget. Every rule
 * below exists to make sure the ask lands on someone who has actually enjoyed
 * the app, and lands exactly once:
 *
 *   - EARNED, not immediate. Three real sessions, counted by the app's own
 *     2-banked-minute bar, so opening a mode to look at it does not count.
 *   - NEVER ON THE FIRST DAY. Someone still deciding what this is has nothing
 *     to rate yet.
 *   - NEVER DURING A DRIVE. The one moment the app must not interrupt.
 *   - ONCE, FULL STOP. Asked is asked, whether they rated, dismissed, or
 *     ignored it. A second ask is the thing everyone hates about this pattern,
 *     and the app has spent its whole life removing that sort of thing.
 *
 * NO NATIVE MODULE. Apple's in-app prompt (StoreKit) needs one, which means a
 * fresh binary; this opens the App Store review page with a plain link
 * instead, so it ships over the air today. The trade is honest and worth
 * stating: it leaves the app. Swap it for the native prompt at the next
 * build — the rules here do not change, only where the tap goes.
 */

const KEY = 'cruise_rate_state';

/** Real sessions before the ask is earned. */
export const MIN_SESSIONS = 3;
/** A full day of having the app before it asks anything of you. */
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** Deep link straight to the review sheet on the listing. */
export const REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

export type RateState = {
  /** First time the app looked — its own clock, so it needs nothing else. */
  firstSeenAt: number;
  /** When the card was shown. Non-null means never again, by design. */
  askedAt: number | null;
};

const FRESH: RateState = { firstSeenAt: 0, askedAt: null };

export async function loadRateState(now = Date.now()): Promise<RateState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const s: RateState = raw ? { ...FRESH, ...JSON.parse(raw) } : { ...FRESH };
    // Self-initialising: the first consult starts the clock. An install that
    // predates this feature therefore waits a day before being asked, which is
    // the right way round — better a day late than asking the moment an
    // update lands.
    if (!s.firstSeenAt) {
      s.firstSeenAt = now;
      await AsyncStorage.setItem(KEY, JSON.stringify(s));
    }
    return s;
  } catch {
    // Storage trouble must never produce an ask — silence is the safe failure.
    return { firstSeenAt: now, askedAt: now };
  }
}

/**
 * The whole rule, pure so it can be read and tested rather than inferred from
 * an effect. Everything it decides ends in interrupting someone, so it is
 * worth being able to see all of it at once.
 */
export function shouldAskForRating(opts: {
  now: number;
  state: RateState;
  sessions: number;
  inDrive: boolean;
}): boolean {
  const { now, state, sessions, inDrive } = opts;
  if (inDrive) return false;
  if (state.askedAt != null) return false;
  if (sessions < MIN_SESSIONS) return false;
  if (now - state.firstSeenAt < MIN_AGE_MS) return false;
  return true;
}

/**
 * Mark it asked. Called when the card APPEARS, not when it is answered —
 * seeing it is the ask, and someone who scrolls past should not be shown it
 * again tomorrow.
 */
export async function markAsked(now = Date.now()): Promise<void> {
  try {
    const s = await loadRateState(now);
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, askedAt: now }));
  } catch {
    // If it fails to save, the worst case is one repeat. Not worth surfacing.
  }
}
