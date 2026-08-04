import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform } from 'react-native';

import { lookupAppleArtwork } from './appleArtwork';
import type { LinkedPlaylist } from './stationPlaylists';

/**
 * Apple Music service layer — the peer of spotify.ts.
 *
 * Everything here goes through a single native module (MusicKit can only be
 * reached from Swift), so this file's whole job is to be a safe, typed front
 * door to it: every call works when the module is present and quietly does
 * nothing when it isn't. That matters because this ships over the air TODAY,
 * into builds that do not contain the module yet — nothing may throw.
 *
 * WHY MUSICKIT AT ALL: Spotify's developer quota caps us at 5 listeners
 * until the company clears their 250k-user bar. Apple Music has no such
 * gate — any subscriber gets full in-app playback from day one.
 */

type Bridge = {
  /** Ask the user for Apple Music access. Resolves to the resulting status. */
  requestAuthorization(): Promise<AuthStatus>;
  /** Current status without prompting. */
  authorizationStatus(): Promise<AuthStatus>;
  /** Does this Apple ID actually have an Apple Music subscription? */
  canPlayCatalog(): Promise<boolean>;
  /** What's playing right now, or null. */
  currentEntry(): Promise<RawEntry | null>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  setShuffle(on: boolean): Promise<void>;
  setRepeat(mode: 'off' | 'context' | 'track'): Promise<void>;
  /** Queue a playlist by its MusicKit id and start it. */
  playPlaylist(id: string): Promise<void>;
  /** The user's own playlists, for linking to stations. */
  userPlaylists(): Promise<{ id: string; name: string }[]>;
  /** The songs inside a playlist — the thing Spotify's tier refuses. */
  playlistTracks(id: string): Promise<
    { id: string; title: string; artist: string; durationMs: number | null }[]>;
  /** Jump to one song, keeping the rest of the playlist queued behind it. */
  playTrackInPlaylist(playlistId: string, trackId: string): Promise<void>;
  /** Build 22+: MediaPlayer artwork for the current song. OPTIONAL — older
   *  builds lack it, and this file ships OTA into them, so every call site
   *  must guard. */
  libraryArtwork?(): Promise<string | null>;
};

export type AuthStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined';

type RawEntry = {
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationMs: number | null;
  positionMs: number | null;
  isPlaying: boolean;
  /** Name of the playlist/album the queue came from, when known. */
  contextName?: string | null;
};

/**
 * CruiseMusicKit lives in modules/cruise-music-kit and is an EXPO module, so
 * it is reached through the Expo registry rather than React Native's legacy
 * `NativeModules` map. `requireOptionalNativeModule` returns null instead of
 * throwing when the module is absent, which is exactly the contract this file
 * needs: the JS ships over the air into builds that predate the module, and
 * nothing here may throw. The NativeModules lookup is kept as a fallback so
 * an older build that somehow carries a legacy-bridge build still resolves.
 */
const bridge: Bridge | null =
  Platform.OS === 'ios'
    ? (requireOptionalNativeModule<Bridge>('CruiseMusicKit')
       ?? ((NativeModules as Record<string, unknown>).CruiseMusicKit as Bridge | undefined)
       ?? null)
    : null;

/**
 * True only in builds carrying the native module. Every caller checks this
 * first; the switchboard uses it to decide whether Apple Music is even a
 * choice on this device.
 */
export function appleMusicAvailable(): boolean {
  return bridge != null;
}

/** Swallow anything the bridge throws — playback must never crash a drive. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!bridge) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// ── Connecting ───────────────────────────────────────────────────────────────

/**
 * Ask for access. This is the ONE prompt Apple shows, and by design it is
 * only ever triggered by an explicit user action (choosing Apple Music, or
 * pressing connect / start a drive having chosen it) — never on app launch,
 * where a reflexive "Don't Allow" would be expensive to undo.
 */
export async function connectAppleMusic(): Promise<AuthStatus> {
  return safe(() => bridge!.requestAuthorization(), 'notDetermined');
}

export async function appleMusicStatus(): Promise<AuthStatus> {
  return safe(() => bridge!.authorizationStatus(), 'notDetermined');
}

export async function isAppleMusicConnected(): Promise<boolean> {
  return (await appleMusicStatus()) === 'authorized';
}

/**
 * Authorised is not the same as subscribed: someone can grant access and
 * still have no Apple Music plan, in which case catalog songs won't play.
 * Callers use this to say so plainly instead of failing silently.
 */
export async function canPlayAppleMusic(): Promise<boolean> {
  return safe(() => bridge!.canPlayCatalog(), false);
}

// ── Reading what's playing ───────────────────────────────────────────────────

export async function getAppleNowPlaying(): Promise<RawEntry | null> {
  // Raced against a timeout, not just caught. Build 21's artwork fallback
  // taught the lesson: a native call that HANGS (rather than throws) would
  // otherwise wedge every poll behind it and the whole app shows "no track"
  // — with a timeout the poll degrades to null for one beat and recovers.
  return safe(
    () => Promise.race([
      bridge!.currentEntry(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]),
    null,
  );
}

/** MediaPlayer artwork for library tracks (build 22+); null anywhere else.
 *  Its own short race — this call is allowed to be lost, the poll is not. */
export async function getAppleLibraryArtwork(): Promise<string | null> {
  if (!bridge?.libraryArtwork) return null;
  return safe(
    () => Promise.race([
      bridge!.libraryArtwork!(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]),
    null,
  );
}

// ── Controls ─────────────────────────────────────────────────────────────────

export async function applePlay(): Promise<void> { await safe(() => bridge!.play(), undefined); }
export async function applePause(): Promise<void> { await safe(() => bridge!.pause(), undefined); }
export async function appleNext(): Promise<void> { await safe(() => bridge!.next(), undefined); }
export async function applePrev(): Promise<void> { await safe(() => bridge!.previous(), undefined); }
export async function appleSeekTo(ms: number): Promise<void> { await safe(() => bridge!.seekTo(ms), undefined); }
export async function appleSetShuffle(on: boolean): Promise<void> { await safe(() => bridge!.setShuffle(on), undefined); }
export async function appleSetRepeat(mode: 'off' | 'context' | 'track'): Promise<void> {
  await safe(() => bridge!.setRepeat(mode), undefined);
}

// ── Playlists ────────────────────────────────────────────────────────────────

/**
 * Station playlists are stored as a `uri` string shared with Spotify, so the
 * prefix is what tells the two apart later: `applemusic:playlist:<id>`.
 */
export const APPLE_PLAYLIST_PREFIX = 'applemusic:playlist:';

export function isApplePlaylist(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith(APPLE_PLAYLIST_PREFIX);
}

export function applePlaylistId(uri: string): string {
  return uri.slice(APPLE_PLAYLIST_PREFIX.length);
}

export async function getAppleUserPlaylists(): Promise<LinkedPlaylist[]> {
  const raw = await safe(() => bridge!.userPlaylists(), [] as { id: string; name: string }[]);
  return raw.map((p) => ({ uri: `${APPLE_PLAYLIST_PREFIX}${p.id}`, name: p.name }));
}

/**
 * Start a station's linked Apple Music playlist. Mirrors Spotify's
 * StartResult vocabulary so the player's existing notices work unchanged:
 * 'playing' | 'no-device' | 'error'. Apple has no device-handoff concept —
 * playback happens on this phone — so 'no-device' never occurs.
 */
export async function startApplePlaylist(uri?: string): Promise<'playing' | 'error'> {
  if (!bridge) return 'error';
  try {
    if (uri && isApplePlaylist(uri)) {
      await bridge.playPlaylist(applePlaylistId(uri));
    } else {
      await bridge.play();
    }
    return 'playing';
  } catch {
    return 'error';
  }
}

export type { LinkedPlaylist };

/**
 * The songs in an Apple Music playlist.
 *
 * Shaped like Spotify's `PlaylistTrack` so SongListSheet can render either
 * without caring which platform it is looking at. The `uri` is the synthetic
 * `applemusic:track:<id>` form — the sheet only uses it as a key and hands it
 * straight back to `playAppleTrack`.
 */
export async function getApplePlaylistTracks(
  playlistId: string,
): Promise<{ uri: string; title: string; artist: string; durationMs: number }[]> {
  // Accept the full `applemusic:playlist:<id>` uri as well as a bare id.
  // The first version took the uri from the song list RAW and handed it to
  // MusicKit's id filter, which of course matched nothing — so the sheet said
  // the playlist had no songs while it played happily (owner, 04.08).
  // playAppleTrack stripped the prefix; this didn't. One rule now.
  const id = isApplePlaylist(playlistId) ? applePlaylistId(playlistId) : playlistId;
  const rows = await safe(() => bridge!.playlistTracks(id), []);
  return (rows ?? []).map((t) => ({
    uri: `applemusic:track:${t.id}`,
    title: t.title ?? '',
    artist: t.artist ?? '',
    durationMs: t.durationMs ?? 0,
  }));
}

/** Start one song within its playlist, so skip still walks the rest. */
export async function playAppleTrack(playlistUri: string, trackUri: string): Promise<void> {
  const pid = applePlaylistId(playlistUri);
  const tid = trackUri.replace(/^applemusic:track:/, '');
  if (!pid || !tid) return;
  await safe(() => bridge!.playTrackInPlaylist(pid, tid), undefined);
}

/**
 * Ask the Apple Music bridge the basic questions and report each answer —
 * the Apple twin of diagnoseSpotify, and it exists for the same reason: two
 * of the three Apple Music faults reported on 04.08 were guessed at once
 * already, and a screenshot of facts ends a fault in one round.
 */
export async function diagnoseAppleMusic(playlistUri: string | null): Promise<string[]> {
  if (!bridge) return ['This build does not carry the Apple Music module.'];
  const out: string[] = [];
  try { out.push(`Access: ${await bridge.authorizationStatus()}`); } catch { out.push('Access: no answer'); }
  try { out.push(`Subscription: ${(await bridge.canPlayCatalog()) ? 'active' : 'not found'}`); } catch { out.push('Subscription: no answer'); }
  if (playlistUri) {
    const id = isApplePlaylist(playlistUri) ? applePlaylistId(playlistUri) : playlistUri;
    out.push(`Playlist id asked: ${id}`);
    try { out.push(`Songs returned: ${((await bridge.playlistTracks(id)) ?? []).length}`); }
    catch { out.push('Songs returned: no answer'); }
  }
  try {
    const entry = await bridge.currentEntry();
    out.push(entry
      ? `Now playing: ${entry.title} — artwork ${entry.artworkUrl ? 'yes' : 'MISSING'}`
      : 'Now playing: nothing');
    // WHICH route failed. Three builds have now guessed at blank artwork;
    // MusicKit's own url and the MediaPlayer image fail for different
    // reasons and need opposite fixes, so the check must tell them apart.
    if (!bridge.libraryArtwork) {
      out.push('Backup artwork: not in this build');
    } else {
      const img = await getAppleLibraryArtwork();
      out.push(`Backup artwork: ${img ? `found (${img.slice(-22)})` : 'MISSING too'}`);
    }
    // The third route, and the only one that does not depend on the phone
    // holding a copy of the picture. If this line says found and the deck is
    // still blank, the fault is in the deck, not in the lookup.
    if (entry?.title) {
      const cat = await lookupAppleArtwork(entry.title, entry.artist);
      out.push(`Catalogue artwork: ${cat ? 'found' : 'no match'}`);
    }
  } catch { out.push('Now playing: no answer'); }
  return out;
}
