import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruisefm_driver_name';
export const DEFAULT_DRIVER_NAME = 'Night Driver';

export async function getDriverName(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const name = raw?.trim();
    return name ? name : DEFAULT_DRIVER_NAME;
  } catch {
    return DEFAULT_DRIVER_NAME;
  }
}

export async function setDriverName(name: string): Promise<void> {
  try {
    const trimmed = name.trim();
    if (trimmed) await AsyncStorage.setItem(KEY, trimmed);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // storage hiccup — the in-memory name still shows this session
  }
}

/** "Night Driver" → "ND", "Jess" → "J" — the avatar's initials. */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'ND';
}
