import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Founder's club — no accounts, no server, so the honest rule is device-local:
 * any phone that first opens Cruise FM during the launch window is a Founder,
 * permanently. Matches the website's promise ("reserved for launch-week
 * drivers"). Beta testers who were here before launch qualify automatically.
 */

const FOUNDER_KEY = 'cruise_founder_badge';

// End of the launch window (generous week-and-a-bit past the planned release).
const WINDOW_CLOSES_MS = Date.parse('2026-08-10T23:59:59Z');

/** Call once at app start. Decides and records eligibility. Idempotent. */
export async function claimFounderIfEligible(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(FOUNDER_KEY);
    if (existing !== null) return; // already decided on this device
    const eligible = Date.now() <= WINDOW_CLOSES_MS;
    await AsyncStorage.setItem(FOUNDER_KEY, eligible ? 'true' : 'false');
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
