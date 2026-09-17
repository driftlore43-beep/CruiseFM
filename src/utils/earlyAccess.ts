import AsyncStorage from '@react-native-async-storage/async-storage';

import { LAUNCH_FREE } from '@/constants/config';

/**
 * FREE PREMIUM FOR THE PEOPLE WHO WERE HERE FIRST — owner, 17.09:
 * "give the early users a free app subscription".
 *
 * THERE IS NO SERVER AND NO ACCOUNT, so this is decided the same way the
 * Founder badge is (utils/founder.ts): on the phone, from what the phone can
 * see. THE RULE IS EVIDENCE OF PRIOR USE, NOT A DATE AND NOT A HEAD COUNT.
 * A head count is a promise the app cannot keep with no server to count.
 * A date is worse here than it was for the badge, because the paywall does
 * not reach every phone on the same day: the store binary gets it from the
 * App Store update, the phones already running 1.4.0 get it over the air
 * afterwards, and preview phones had it days earlier — so "before the 20th"
 * is true on one phone and false on the next for the same person.
 *
 * WHAT IS CHECKABLE, AND HONEST, is whether THIS PHONE used Cruise FM before
 * Premium arrived on it. The moment the first paywall bundle runs here, it
 * looks for anything a fresh install cannot have produced in its first
 * seconds — a logged session (needs two real minutes), a remembered cruise
 * (needs a drive to have been opened), or the Founder badge — and writes the
 * answer down. A "yes" is permanent, exactly like the badge. A "no" is ALSO
 * permanent, which is the part that differs from founder.ts: the badge
 * re-decides upward when its window is extended, but this rule has no window
 * to extend, and letting a "no" turn into a "yes" would mean one free drive
 * after the paywall buys Premium for good.
 *
 * NOTHING IS DECIDED WHILE `LAUNCH_FREE` IS ON. During a free period every
 * phone is Premium anyway, and writing a "no" for a fresh install then would
 * lock out someone who genuinely used the app free — the opposite of the
 * point. The decision waits for the paywall.
 *
 * IT IS TIED TO THE PHONE. A reinstall, or a new phone without a backup,
 * starts from nothing and will not qualify — there is nothing to restore
 * because nothing was ever bought. If that ever matters, Apple Offer Codes
 * (a code redeemed through the App Store, honoured by RevenueCat like any
 * purchase) are the durable version; this is the version that ships today
 * with no server and no code to hand out.
 *
 * A REVIEWER NEVER QUALIFIES. Apple installs fresh, so the reviewer sees the
 * paywall exactly as a new customer would — which is what the review is for.
 */

const KEY = 'cruise_early_access';
/** Written once the home card has been shown. Shown is told. */
export const EARLY_ACCESS_TOLD_KEY = 'cruise_early_access_told';

// The three pieces of evidence, read by key rather than through their own
// modules so this file stays free of imports that could pull the whole
// stats layer into the entitlements provider. Keys are pinned in
// scripts/test-early-access.mjs against the modules that own them.
const FOUNDER_KEY = 'cruise_founder_badge';
const DRIVE_LOG_KEY = 'cruise_drive_log';
const LAST_CRUISE_KEY = 'cruise_last_cruise';

/** Anything a phone that has genuinely used the app would have written. */
async function usedBeforePremium(): Promise<boolean> {
  if ((await AsyncStorage.getItem(FOUNDER_KEY)) === 'true') return true;
  const log = await AsyncStorage.getItem(DRIVE_LOG_KEY);
  if (log) {
    try {
      const parsed = JSON.parse(log);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    } catch {
      // a corrupt log is not evidence of anything
    }
  }
  const last = await AsyncStorage.getItem(LAST_CRUISE_KEY);
  return !!last;
}

async function decide(): Promise<boolean> {
  if (LAUNCH_FREE) return false;
  const existing = await AsyncStorage.getItem(KEY);
  if (existing === 'true') return true;
  if (existing === 'false') return false;
  const early = await usedBeforePremium();
  await AsyncStorage.setItem(KEY, early ? 'true' : 'false');
  return early;
}

let decision: Promise<boolean> | null = null;

/**
 * Decides once per launch and remembers the answer. Safe to call from
 * anywhere, any number of times; every caller shares one read. A storage
 * failure answers "no" for now WITHOUT writing anything down, so the next
 * launch gets to decide properly.
 */
export function claimEarlyAccessIfEligible(): Promise<boolean> {
  if (!decision) {
    decision = decide().catch(() => {
      decision = null;
      return false;
    });
  }
  return decision;
}

/** Does this phone have free Premium for being here first? */
export function hasEarlyAccess(): Promise<boolean> {
  return claimEarlyAccessIfEligible();
}
