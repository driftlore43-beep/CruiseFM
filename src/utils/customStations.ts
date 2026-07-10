import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATIONS, type Station } from '@/constants/stations';

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

// Sync cache of the saved custom stations, kept fresh by every load/save.
// Lets the modes/mini-player resolve a custom station without going async.
let cache: CustomStation[] = [];

async function persist(list: CustomStation[]): Promise<void> {
  cache = list;
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function loadCustomStations(): Promise<CustomStation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : [];
    return cache;
  } catch {
    return cache;
  }
}

export async function saveCustomStation(station: CustomStation): Promise<void> {
  const existing = await loadCustomStations();
  await persist([...existing, station]);
}

export async function updateCustomStation(station: CustomStation): Promise<void> {
  const existing = await loadCustomStations();
  await persist(existing.map((s) => (s.id === station.id ? station : s)));
}

export async function deleteCustomStation(id: string): Promise<void> {
  const existing = await loadCustomStations();
  await persist(existing.filter((s) => s.id !== id));
}

/** A custom station dressed as a full Station so modes can render it. */
export function customToStation(c: CustomStation): Station {
  return {
    ...c,
    image: null as unknown as Station['image'],
    iconName: /^[a-z]/.test(c.icon) ? c.icon : 'star-four-points',
    eqColors: c.eqColors ?? [c.color, c.color, c.color],
  } as Station;
}

/** Resolve any station id — official first, then the user's own creations. */
export function resolveAnyStation(id: string | undefined): Station {
  const official = STATIONS.find((s) => s.id === id);
  if (official) return official;
  const custom = cache.find((s) => s.id === id);
  if (custom) return customToStation(custom);
  return STATIONS[0];
}
