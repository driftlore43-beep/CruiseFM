import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export const PLATFORM_KEY        = 'cruisefm_platform';
export const PLATFORM_SKIPPED_KEY = 'cruisefm_platform_skipped';

export type PlatformId = 'spotify' | 'appleMusic' | 'youtubeMusic' | 'amazonMusic' | 'tidal' | 'none';

export type Platform = {
  name: string;
  color: string;
  getUrl: (query: string) => string;
  webUrl: (query: string) => string;
};

export const PLATFORMS: Record<Exclude<PlatformId, 'none'>, Platform> = {
  spotify: {
    name: 'Spotify',
    color: '#1DB954',
    getUrl: (q) => `spotify:search:${q} driving playlist`,
    webUrl: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  },
  appleMusic: {
    name: 'Apple Music',
    color: '#FC3C44',
    getUrl: (q) => `music://music.apple.com/search?term=${encodeURIComponent(q)}`,
    webUrl: (q) => `https://music.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  youtubeMusic: {
    name: 'YouTube Music',
    color: '#FF0000',
    getUrl: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}+driving+playlist`,
    webUrl: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
  },
  amazonMusic: {
    name: 'Amazon Music',
    color: '#00A8E0',
    getUrl: (q) => `amznmp3://search?q=${encodeURIComponent(q)}`,
    webUrl: (q) => `https://music.amazon.com/search/${encodeURIComponent(q)}`,
  },
  tidal: {
    name: 'Tidal',
    color: '#CBCBCB',
    getUrl: (q) => `tidal://search?q=${encodeURIComponent(q)}`,
    webUrl: (q) => `https://tidal.com/search?q=${encodeURIComponent(q)}`,
  },
};

export async function getSavedPlatform(): Promise<PlatformId | null> {
  try {
    const value = await AsyncStorage.getItem(PLATFORM_KEY);
    return (value as PlatformId) ?? null;
  } catch {
    return null;
  }
}

export async function savePlatform(id: PlatformId): Promise<void> {
  await AsyncStorage.setItem(PLATFORM_KEY, id);
  if (id !== 'none') {
    await AsyncStorage.removeItem(PLATFORM_SKIPPED_KEY);
  }
}

export async function getPlatformSkipped(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PLATFORM_SKIPPED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setPlatformSkipped(): Promise<void> {
  await AsyncStorage.setItem(PLATFORM_SKIPPED_KEY, 'true');
}

/**
 * Which playlist picker a station page / in-drive pill should open.
 *
 * Spotify linking is ONLY for listeners who already saved Spotify — the
 * picker no longer offers it (01.09), because a development-tier app is
 * capped at five authorised accounts. Asking anyone else to paste a
 * Spotify link is an errand that cannot succeed.
 *
 * `null` (never chosen) and `'none'` (skipped) take Apple Music when the
 * build can actually play it. YouTube / Amazon / Tidal stay visual
 * companions — no paste box, no lock on Start Drive.
 *
 * `musicKit` is passed in rather than imported, so this file never
 * cycles with appleMusic.ts.
 */
export type PlaylistSheetKind = 'spotify' | 'apple' | 'companion';

export function offersSpotifyPlaylist(platform: PlatformId | null): boolean {
  return platform === 'spotify';
}

/** Home's Connect Apple Music card — first-run and skipped, not YouTube. */
export function offersAppleMusicConnect(platform: PlatformId | null): boolean {
  return platform === 'appleMusic' || platform == null || platform === 'none';
}

/**
 * Start Drive waits for a playlist only when this platform can play one
 * in-app. `'none'` is a skip: the visuals still start. `null` (never
 * chosen) is the onboarding offer, so it gates when MusicKit is present.
 */
export function gatesStartOnPlaylist(platform: PlatformId | null, musicKit: boolean): boolean {
  if (platform === 'spotify') return true;
  if (platform === 'youtubeMusic' || platform === 'amazonMusic' || platform === 'tidal') return false;
  if (platform === 'none') return false;
  // appleMusic, or never chosen
  return musicKit;
}

export function playlistSheetKind(platform: PlatformId | null, musicKit: boolean): PlaylistSheetKind {
  if (platform === 'spotify') return 'spotify';
  if (platform === 'youtubeMusic' || platform === 'amazonMusic' || platform === 'tidal') {
    return 'companion';
  }
  return musicKit ? 'apple' : 'companion';
}

export async function openMusicPlatform(stationName: string): Promise<void> {
  const platformId = await getSavedPlatform();
  if (!platformId || platformId === 'none') return;

  const p = PLATFORMS[platformId as Exclude<PlatformId, 'none'>];
  if (!p) return;

  const deepLink = p.getUrl(stationName);
  const supported = await Linking.canOpenURL(deepLink);
  if (supported) {
    Linking.openURL(deepLink);
  } else {
    Linking.openURL(p.webUrl(stationName));
  }
}
