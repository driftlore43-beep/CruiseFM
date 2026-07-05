import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Station } from '@/constants/stations';

const KEY = 'cruise_custom_stations';

export type CustomStation = Omit<Station, 'image' | 'iconName' | 'bestTime' | 'duration' | 'trackCount' | 'spotifyUrl' | 'appleMusicUrl'> & {
  image: null;
  color: string;
  bestTime: string;
  duration: string;
  trackCount: number;
  spotifyUrl: string;
  appleMusicUrl: string;
};

export async function loadCustomStations(): Promise<CustomStation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCustomStation(station: CustomStation): Promise<void> {
  const existing = await loadCustomStations();
  const updated = [...existing, station];
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}

export async function deleteCustomStation(id: string): Promise<void> {
  const existing = await loadCustomStations();
  const updated = existing.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}
