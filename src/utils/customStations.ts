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

/** Blend two hex colours — used to spread one chosen colour into a mood ramp. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** A custom station's three mood stops, spread from its one chosen colour.
 *  Three IDENTICAL stops (what this used to return) give the visualisers
 *  nothing to work with — flat bars, a one-tone mirror ball — so the chosen
 *  colour becomes the middle of a light → base → deep ramp. Derived rather
 *  than stored, so stations saved before this get it too. */
export function rampFromColor(color: string): [string, string, string] {
  return [mixHex(color, '#ffffff', 0.45), color, mixHex(color, '#0c0f1a', 0.42)];
}

/** A custom station dressed as a full Station so modes can render it. */
export function customToStation(c: CustomStation): Station {
  return {
    ...c,
    image: null as unknown as Station['image'],
    iconName: /^[a-z]/.test(c.icon) ? c.icon : 'star-four-points',
    eqColors: c.eqColors ?? rampFromColor(c.color),
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
