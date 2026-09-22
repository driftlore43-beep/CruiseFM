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
/**
 * THE VERSION IN THE BUNDLE — which is NOT the version of the app on the phone.
 *
 * An update carries JS and assets onto a binary that is already installed, and
 * `runtimeVersion` is deliberately held back so the App Store build keeps
 * receiving them. So a phone running the 1.4.0 binary reports 1.4.2 here the
 * moment it pulls a 1.4.2 bundle, while none of 1.4.2's native code exists on
 * it. Fine for a footer, and wrong for anything deciding whether a feature is
 * actually there — use `binaryAtLeast()` for that.
 */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * THE VERSION OF THE BINARY ITSELF — iOS's own CFBundleShortVersionString,
 * i.e. the number on the build this phone downloaded from the App Store. An
 * over-the-air update cannot move it, which is exactly the point: it is the
 * only honest answer to "does this phone have the native half of release X".
 *
 * Null when it cannot be read (web, or a build without expo-application).
 * Every caller must treat null as "don't know" and stay quiet rather than
 * guessing — a wrong yes announces a feature that is not there.
 */
export function nativeAppVersion(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Application = require('expo-application') as typeof import('expo-application');
    return Application.nativeApplicationVersion ?? null;
  } catch {
    return null;
  }
}

/**
 * "1.3.10" > "1.3.9" — a plain string compare gets that backwards, so each
 * segment is compared as a number. Missing segments count as 0.
 *
 * Lives here rather than beside its first caller because it is the app's ONE
 * version comparison, and two copies of this is how two screens end up
 * disagreeing about which release is newer.
 */
export function isNewer(candidate: string, against: string): boolean {
  const a = candidate.split('.').map((n) => parseInt(n, 10) || 0);
  const b = against.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Does the INSTALLED BINARY carry release `want` or later?
 *
 * The test to reach for before telling anyone about something native. Answers
 * NO when the binary's version cannot be read at all, because the cost of the
 * two mistakes is not symmetrical: staying quiet means somebody is told a
 * release late, while a wrong yes sends them hunting for a widget, a setting
 * or a screen their phone does not have.
 */
export function binaryAtLeast(want: string): boolean {
  const have = nativeAppVersion();
  if (!have) return false;
  return !isNewer(want, have);
}

export function appVersionLabel(): string {
  const v = appVersion();
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
