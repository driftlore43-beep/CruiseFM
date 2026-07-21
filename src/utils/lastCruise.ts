import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATIONS } from '@/constants/stations';

const KEY = 'cruise_last_cruise';

export type LastCruise = { stationId: string; mode: string };

export async function saveLastCruise(cruise: LastCruise): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cruise));
  } catch {
    // ignore
  }
}

export async function loadLastCruise(): Promise<LastCruise | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Picks a sensible station for the current time of day (first-run default). */
export function defaultStationForNow(): string {
  const h = new Date().getHours();
  let id: string;
  if (h >= 0 && h < 5) id = 'after-midnight';
  else if (h >= 5 && h < 11) id = 'mountain-pass';
  else if (h >= 11 && h < 16) id = 'daylight';
  else if (h >= 16 && h < 20) id = 'sunset';
  else id = 'night-run';
  // Fall back to the first station if that id is somehow missing.
  return STATIONS.some((s) => s.id === id) ? id : STATIONS[0].id;
}

/** The cruise to start when the user taps Start Drive: last one, or the default. */
export async function resolveCruiseToStart(): Promise<LastCruise> {
  const last = await loadLastCruise();
  if (last && STATIONS.some((s) => s.id === last.stationId)) return last;
  return { stationId: defaultStationForNow(), mode: 'equalizer' };
}
