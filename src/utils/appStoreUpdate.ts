import AsyncStorage from '@react-native-async-storage/async-storage';

import { appVersion } from '@/utils/appVersion';

/**
 * "Some apps require you to go to the App Store and update from there" —
 * owner, 19.08, after being told what OTA can and can't reach.
 *
 * OTA (expo-updates) can only carry JS and assets to a binary that is
 * ALREADY installed. It cannot put a new binary on someone's phone — that is
 * the one thing only the App Store can do, and the one case it matters is
 * exactly the case OTA can't help with: a release that changed something
 * native (Apple Music, a new permission, a new module), where someone stuck
 * on an old binary has no way back into step without a fresh download.
 *
 * This is the honest, no-server route to closing that gap: Apple's own
 * public listing already answers "what version is live" — the same public
 * catalogue endpoint appleArtwork.ts already calls for album covers, so this
 * asks nothing new of the privacy story ("an anonymous, routine version
 * check" is the whole of what leaves the device). No push token, no server
 * of ours, no account.
 *
 * CACHED so it isn't a network call on every launch: a check is good for
 * `CHECK_EVERY_MS`, and a version once dismissed by the driver is
 * remembered SO IT DOESN'T NAG AGAIN FOR THE SAME RELEASE, house style
 * throughout the app — but nothing else clears the dismissal, so the next
 * genuinely newer version still gets its own chance to ask.
 */

const LOOKUP = 'https://itunes.apple.com/lookup?bundleId=com.driftlore.CruiseFM';
export const APP_STORE_URL = 'https://apps.apple.com/app/id6793233679';
const CACHE_KEY = 'cruisefm_store_version_cache';
const DISMISS_KEY = 'cruisefm_store_update_dismissed';
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000; // twice a day is plenty for a version number
const TIMEOUT_MS = 6000;

type Cache = { checkedAt: number; storeVersion: string | null };

/** "1.3.10" > "1.3.9" — a plain string compare gets that backwards, so each
 *  segment is compared as a number. Missing segments count as 0. */
export function isNewer(store: string, installed: string): boolean {
  const a = store.split('.').map((n) => parseInt(n, 10) || 0);
  const b = installed.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function fetchStoreVersion(): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(LOOKUP, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const version = json?.results?.[0]?.version;
    return typeof version === 'string' && version.length ? version : null;
  } catch {
    return null; // offline, blocked, malformed — a missed check is not an error
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the store version to nudge about, or null if there's nothing to
 * say — either because it's up to date, the check is still fresh in the
 * cache, the driver already dismissed this exact version, or the lookup
 * failed. Never throws.
 */
export async function checkForStoreUpdate(): Promise<string | null> {
  try {
    const installed = appVersion();
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    let cache: Cache | null = raw ? JSON.parse(raw) : null;

    if (!cache || Date.now() - cache.checkedAt > CHECK_EVERY_MS) {
      const storeVersion = await fetchStoreVersion();
      cache = { checkedAt: Date.now(), storeVersion };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }

    if (!cache.storeVersion || !isNewer(cache.storeVersion, installed)) return null;

    const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
    if (dismissed === cache.storeVersion) return null;

    return cache.storeVersion;
  } catch {
    return null;
  }
}

export async function dismissStoreUpdate(storeVersion: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISS_KEY, storeVersion);
  } catch {
    // if it doesn't save, the card just asks again next time — harmless
  }
}
