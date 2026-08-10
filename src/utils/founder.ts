import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Founder's club — no accounts, no server, so the honest rule is device-local:
 * any phone that first opens Cruise FM during the launch window is a Founder,
 * permanently. Beta testers who were here before launch qualify automatically.
 *
 * IT IS A DATE, NOT A HEAD COUNT, and it cannot be anything else: with no
 * server there is no way to know who the five-hundredth person was. So never
 * promote this as "the first N users" — that is a promise the app cannot keep.
 * Promote the DEADLINE, which is true and carries the same urgency.
 *
 * Whenever this date moves, check the two places that describe it in words:
 * the badge's own `desc` in constants/badges.ts and the Founder section on
 * website/index.html. A window that outlives the phrase "launch week" makes
 * both of them wrong.
 */

const FOUNDER_KEY = 'cruise_founder_badge';

// Extended 10.08 from the original launch week, so the badge is still worth
// promoting while the first real recruiting happens (TikTok, Reddit, friends).
const WINDOW_CLOSES_MS = Date.parse('2026-08-31T23:59:59Z');

/** Call once at app start. Decides and records eligibility. Idempotent. */
export async function claimFounderIfEligible(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(FOUNDER_KEY);
    const inWindow = Date.now() <= WINDOW_CLOSES_MS;

    // Granted is permanent. The badge is never taken back, whatever the date
    // says later.
    if (existing === 'true') return;

    // But a "no" is NOT final, and that is the point of this branch: if the
    // window is later extended — as it was on 10.08 — someone who opened the
    // app the day after the old deadline should qualify again once the change
    // reaches them. Without this they would be refused forever by a decision
    // taken before the rule changed. Only ever re-decides upward.
    if (existing === 'false' && !inWindow) return;

    await AsyncStorage.setItem(FOUNDER_KEY, inWindow ? 'true' : 'false');
  } catch {
    // storage hiccup — try again next launch
  }
}

/** Was this device part of launch week? */
export async function isFounder(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FOUNDER_KEY)) === 'true';
  } catch {
    return false;
  }
}
