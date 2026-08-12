import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSavedPlatform, type PlatformId } from '@/utils/musicPlatform';

const KEY = 'cruise_station_playlists';

export type LinkedPlaylist = { uri: string; name: string };

/**
 * A station's linked playlist, PER MUSIC SERVICE.
 *
 * THE BUG THIS FIXES (owner, 04.08 and again 11.08): there was one slot per
 * station, so linking an Apple Music playlist overwrote the Spotify one and
 * vice versa. Switching service — or just trying the other one once — silently
 * threw away every playlist you had chosen, and the station page would go on
 * showing a link that playback then refused, because an Apple player cannot
 * open a `spotify:` uri.
 *
 * The fix lives HERE rather than in the callers. Thirty-odd call sites across
 * the eight modes, the station page and the context all use
 * getStationPlaylist/setStationPlaylist, and threading a platform argument
 * through all of them is exactly how one gets missed — the same shape as the
 * `seekTo` sweep on 04.08, where two modes kept importing the old function and
 * scrub silently broke on Apple Music. So the signatures are unchanged and the
 * store works out the service itself.
 *
 * A playlist is filed under the service its OWN URI belongs to, not under
 * whatever platform happened to be selected when it was saved. That way a
 * pasted Spotify link lands in the Spotify slot even for a listener who never
 * finished choosing a service, and the file cannot be corrupted by a stale
 * platform setting.
 */
type Slots = Partial<Record<PlatformId, LinkedPlaylist>>;
type Store = Record<string, Slots>;

/** Which service a uri belongs to. Apple's are minted by appleMusic.ts with an
 *  `applemusic:` prefix; everything else in the app is a Spotify uri or link. */
export function platformOfUri(uri: string): PlatformId {
  return uri.startsWith('applemusic:') ? 'appleMusic' : 'spotify';
}

/** The old shape was `{ [stationId]: LinkedPlaylist }`. Anything already saved
 *  is moved into the slot its uri says it belongs to — lossless, and it means
 *  nobody loses the playlist they linked before this shipped. */
function migrate(raw: unknown): Store {
  const out: Store = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [stationId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (typeof v.uri === 'string') {
      // v1 entry: a bare playlist.
      const pl = { uri: v.uri, name: String(v.name ?? '') };
      out[stationId] = { [platformOfUri(pl.uri)]: pl };
    } else {
      // v2 entry: already keyed by service. Copy across the ones that look real.
      const slots: Slots = {};
      for (const [platform, pl] of Object.entries(v)) {
        if (pl && typeof pl === 'object' && typeof (pl as LinkedPlaylist).uri === 'string') {
          slots[platform as PlatformId] = pl as LinkedPlaylist;
        }
      }
      if (Object.keys(slots).length) out[stationId] = slots;
    }
  }
  return out;
}

async function readAll(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** The service whose playlist should be used right now. A listener who never
 *  picked one (or skipped) still reaches Spotify links through the deep-link
 *  handoff, so they read the Spotify slot. */
async function currentPlatform(): Promise<PlatformId> {
  const saved = await getSavedPlatform();
  return saved === 'appleMusic' ? 'appleMusic' : 'spotify';
}

export async function getStationPlaylist(stationId: string): Promise<LinkedPlaylist | null> {
  const all = await readAll();
  const slots = all[stationId];
  if (!slots) return null;
  return slots[await currentPlatform()] ?? null;
}

/** Every service's playlist for this station — for anything that needs to show
 *  or reason about the other side rather than just play. */
export async function getStationPlaylistSlots(stationId: string): Promise<Slots> {
  return (await readAll())[stationId] ?? {};
}

export async function setStationPlaylist(stationId: string, playlist: LinkedPlaylist): Promise<void> {
  const all = await readAll();
  const slots = all[stationId] ?? {};
  // Filed by the uri's own service, so a Spotify link pasted by an Apple Music
  // listener still lands where playback will look for it.
  slots[platformOfUri(playlist.uri)] = playlist;
  all[stationId] = slots;
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

/** Unlink the playlist for the service in use. The other service's choice is
 *  deliberately left alone — losing it is the bug this file exists to fix. */
export async function clearStationPlaylist(stationId: string): Promise<void> {
  const all = await readAll();
  const slots = all[stationId];
  if (!slots) return;
  delete slots[await currentPlatform()];
  if (Object.keys(slots).length) all[stationId] = slots;
  else delete all[stationId];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

/** Every trace of a station, both services — for deleting a custom station. */
export async function clearStationPlaylistAll(stationId: string): Promise<void> {
  const all = await readAll();
  delete all[stationId];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
