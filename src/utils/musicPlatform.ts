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
