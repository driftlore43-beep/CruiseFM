import Constants from 'expo-constants';

/**
 * A human-readable "what am I running" line for the Profile footer.
 *
 * Shows the app version plus, when an over-the-air update is live, the time
 * that update was published — so the owner can glance and confirm the phone
 * actually pulled the latest `eas update` (a fresh timestamp = it landed).
 * On the plain installed build (no OTA yet) it reads "base build". Guarded so
 * it never throws on web or in builds without the updates module.
 */
export function appVersionLabel(): string {
  const v = Constants.expoConfig?.version ?? '1.0.0';
  let stamp = 'base build';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates');
    if (Updates.isEmbeddedLaunch === false && Updates.createdAt) {
      const d = new Date(Updates.createdAt);
      const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      stamp = `updated ${date}, ${time}`;
    }
  } catch {
    // web / no updates module — leave as "base build"
  }
  return `Cruise FM v${v} · ${stamp}`;
}
