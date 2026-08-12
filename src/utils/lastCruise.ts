import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATIONS } from '@/constants/stations';
import { primaryOnAir } from '@/constants/schedule';
import { knownMode } from '@/constants/modeCatalog';

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

/**
 * The station the current hour belongs to.
 *
 * This used to be a five-way switch on the hour, living here, which chose one
 * station and told the rest of the app nothing — so the dial, the station
 * pages and everything else stayed identical around the clock. The schedule
 * now owns it (constants/schedule.ts) and every surface reads from the same
 * timetable. Kept as a named function because a dozen call sites use it.
 */
export function defaultStationForNow(): string {
  const id = primaryOnAir();
  // Fall back to the first station if that id is somehow missing.
  return STATIONS.some((s) => s.id === id) ? id : STATIONS[0].id;
}

/** The cruise to start when the user taps Start Drive: last one, or the default. */
export async function resolveCruiseToStart(): Promise<LastCruise> {
  const last = await loadLastCruise();
  // knownMode(): a retired mode (Sound Waves, 25.07) is stored as a bare
  // string, so a saved cruise can outlive the mode it names.
  if (last && STATIONS.some((s) => s.id === last.stationId)) {
    return { ...last, mode: knownMode(last.mode) };
  }
  return { stationId: defaultStationForNow(), mode: 'equalizer' };
}
