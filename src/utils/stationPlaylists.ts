import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruise_station_playlists';

export type LinkedPlaylist = { uri: string; name: string };

type Map = Record<string, LinkedPlaylist>;

async function readAll(): Promise<Map> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function getStationPlaylist(stationId: string): Promise<LinkedPlaylist | null> {
  const all = await readAll();
  return all[stationId] ?? null;
}

export async function setStationPlaylist(stationId: string, playlist: LinkedPlaylist): Promise<void> {
  const all = await readAll();
  all[stationId] = playlist;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function clearStationPlaylist(stationId: string): Promise<void> {
  const all = await readAll();
  delete all[stationId];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
