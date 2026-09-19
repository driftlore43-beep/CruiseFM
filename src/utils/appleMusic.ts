import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { probeAppleArtwork } from './appleArtwork';
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
  /**
   * The system player's ACTUAL shuffle/repeat state — added 26.08, so a
   * build without it (nothing shipped between builds is guaranteed to have
   * it) sends `undefined` here, not a wrong answer. See useAppleMusicPlayback
   * for why the caller must treat "missing" and "false"/"off" differently.
   *
   * NULL IS ALSO "MISSING" (15.09): the player reports `.default` when it is
   * deferring to the listener's own preference, which is an unknown rather
   * than an off, and the bridge now passes that through honestly as null.
   */
  shuffleOn?: boolean | null;
  repeatMode?: 'off' | 'context' | 'track' | null;
  /**
   * The same two settings, raw and unmapped, straight off each of the two
   * players that both claim to drive the Music app. DIAGNOSTIC ONLY —
   * nothing in the app may read these to decide anything. They exist because
   * three rounds have now guessed which surface is real, so the check in
   * Settings prints what the phone actually says instead of a fourth theory.
   */
  mpRepeatRaw?: number;
  mpShuffleRaw?: number;
  mkRepeatRaw?: string;
  mkShuffleRaw?: string;
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

/** Schemes React Native's <Image> can actually load. */
const LOADABLE_URL = /^(https?|file|data):/i;

export async function getAppleNowPlaying(): Promise<RawEntry | null> {
  // Raced against a timeout, not just caught. Build 21's artwork fallback
  // taught the lesson: a native call that HANGS (rather than throws) would
  // otherwise wedge every poll behind it and the whole app shows "no track"
  // — with a timeout the poll degrades to null for one beat and recovers.
  const entry = await safe(
    () => Promise.race([
      bridge!.currentEntry(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]),
    null,
  );
  /**
   * THE FOUND-BUT-BLANK BUG (owner screenshot, 04.08): MusicKit hands back
   * `musicKit://` scheme URLs for library artwork — renderable only by
   * Apple's own ArtworkImage view, so RN's <Image> silently drew nothing,
   * while the non-empty URL stopped the fallback chase from ever running.
   * Every diagnostic said "artwork yes" over a blank deck. An unloadable
   * URL is worse than none: null here lets the chase fetch a real one
   * (MediaPlayer file:// or the public catalogue).
   */
  if (entry?.artworkUrl && !LOADABLE_URL.test(entry.artworkUrl)) {
    return { ...entry, artworkUrl: null };
  }
  return entry;
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
/**
 * THE LAST QUEUE THIS APP HANDED TO THE MUSIC APP.
 *
 * Remembered so a failed resume can be recovered without every caller having
 * to know which station's playlist is loaded. See `recoverApplePlayback`.
 */
let lastQueuedUri: string | null = null;
export function lastAppleQueueUri(): string | null { return lastQueuedUri; }

/**
 * THE SAME THING, BUT REMEMBERED ACROSS LAUNCHES — AND IT IS A DIFFERENT
 * QUESTION FROM THE ONE ABOVE, WHICH IS WHY IT IS A SECOND VALUE.
 *
 * `lastQueuedUri` answers "what did I queue in THIS session, so I can put it
 * back?" and must stay in memory: `recoverApplePlayback` acts on it, and a
 * value surviving from yesterday would have that function re-queue a playlist
 * over music that is playing perfectly well.
 *
 * This one answers "what is the Music app most likely holding?", which is the
 * question a drive start has to ask, and the answer has to outlive the app —
 * because the case that matters most is a WIDGET TAP, which cold-starts the
 * app while the Music app is already playing.
 *
 * IT IS OUR OWN MEMORY RATHER THAN THE SERVICE'S ANSWER, and that is a real
 * difference from the Spotify side. `currentEntry` reports `contextName` as
 * nil (the Swift has never filled it in), so MusicKit tells us nothing about
 * where the queue came from. Making it say would be a native change and a new
 * build; this is the honest thing available over the air, and it is checked
 * against the playlist's own track list before it is trusted — see
 * `appleQueueState`.
 */
const QUEUE_KEY = 'cruisefm_apple_queue_uri';
let queuedUri: string | null | undefined;

async function readQueuedUri(): Promise<string | null> {
  if (queuedUri !== undefined) return queuedUri;
  try {
    queuedUri = (await AsyncStorage.getItem(QUEUE_KEY)) || null;
  } catch {
    queuedUri = null;
  }
  return queuedUri;
}

function rememberQueuedUri(uri: string): void {
  queuedUri = uri;
  try {
    const w = AsyncStorage.setItem(QUEUE_KEY, uri) as unknown as Promise<void> | undefined;
    w?.catch?.(() => {});
  } catch {
    // Storage is not worth failing a drive over; the in-memory copy stands.
  }
}

/**
 * Races a native call against a timeout, REJECTING rather than resolving
 * quietly on it — the caller below is already inside a try/catch that turns
 * any throw into an honest 'error' verdict.
 *
 * WHY IT'S HERE: Ethan (25.08) — "if the Apple Music app is not open cruise
 * fm will not play music and will freeze inside a station." `bridge.play()`
 * and `bridge.playPlaylist()` are `try?` on the Swift side and were awaited
 * here with no bound, so a native call that HANGS rather than throws (the
 * Music app not being warm is a believable way for that to happen, though it
 * can't be confirmed without a device — Swift can't be built from here) left
 * nothing telling the driver anything: `startStationMusic`'s own 8-second
 * safety timer would eventually clear the "switching" state, but the
 * attempt itself never resolved and never reported a verdict, so the notice
 * that should have said "try again" never appeared either. This is the
 * control-side twin of `getAppleNowPlaying`'s read-side timeout above.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Apple Music did not answer')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * HOW LONG TO GIVE A FRESHLY QUEUED PLAYLIST BEFORE CHECKING IT ACTUALLY TOOK.
 *
 * Reasoned from RESUME_SETTLE_MS in useAppleMusicPlayback.ts (3500ms),
 * measured on the owner's own screen recording of a RESUME after
 * backgrounding — not independently measured for a cold start, which this
 * is, and cannot be without a device. A cold Music app has strictly more
 * work to do than a resume (activating the audio session from nothing, not
 * just picking back up), so if anything this is an underestimate.
 */
const START_VERIFY_MS = 3500;

/**
 * THE NATIVE CALL RESOLVING IS NOT THE SAME AS AUDIO ACTUALLY PLAYING.
 *
 * Ethan, 27.08: "when I go to play a station without music already playing
 * from Apple Music nothing happens." A Music app that was not already
 * active can accept a queue and still take a few seconds to make sound —
 * the same lag RESUME_SETTLE_MS already knows about — and nothing here ever
 * checked for that; the deck simply showed "playing" over silence.
 *
 * DELIBERATELY NOT ON THE RETURN PATH. Checking before answering would add
 * ~3.5s to every ordinary start, healthy or not, to catch a failure that is
 * the exception — and worse, a rapid string of station changes already has
 * its own supersede guard (`startStationMusic`'s generation counter, 25.08's
 * tuner freeze), which this check knows nothing about; blocking here would
 * only add a second, uncoordinated source of delay on top of it. So
 * `startApplePlaylist` still answers the instant the native call resolves,
 * exactly as before, and this runs alongside, unawaited — quiet on success,
 * and a genuine silent failure gets ONE recovery attempt a few seconds
 * later instead of never. `recoverApplePlayback` always acts on whichever
 * playlist is CURRENTLY queued, so a check left over from a station someone
 * has since tuned away from corrects whatever is actually meant to be
 * playing rather than stepping on it.
 */
/**
 * AND IT ASKS TWICE, BECAUSE ONE READING FROM THE SYSTEM PLAYER IS NEVER
 * EVIDENCE — the 27.08 rule, which `verifyResume` learned and this never did.
 *
 * Ethan, 18.09: "I'm still having sync issues and it's auto restarting the
 * playlist." This is the second way that happens. The owner's own screen
 * recording measured the system player answering "not playing" for the better
 * part of three seconds after a resume, and START_VERIFY_MS above says in as
 * many words that a cold start has strictly more work to do than a resume —
 * so a single reading at 3.5s can easily catch a playlist that started
 * perfectly well, and the "recovery" then re-queues it FROM THE TOP a few
 * seconds in. From the outside that is the app restarting your playlist for
 * no reason, which is exactly what was reported.
 *
 * AND THE RECOVERY KEEPS THE POSITION NOW. If the player has loaded the
 * queue but genuinely not started, it still knows where it is; re-queueing
 * without that number threw the place away even when the recovery was right
 * to fire.
 */
const START_RECHECK_MS = 2500;

async function verifyPlaylistTook(): Promise<void> {
  await new Promise((r) => setTimeout(r, START_VERIFY_MS));
  let entry = await getAppleNowPlaying().catch(() => null);
  if (entry?.isPlaying) return;
  await new Promise((r) => setTimeout(r, START_RECHECK_MS));
  entry = await getAppleNowPlaying().catch(() => null);
  if (entry?.isPlaying) return;
  const at = entry?.positionMs ?? null;
  await recoverApplePlayback(at != null && at > 1500 ? at : null);
}

/**
 * IS THE MUSIC APP ALREADY PLAYING THIS STATION'S PLAYLIST?
 *
 * Ethan, 18.09: "I'm still having sync issues and it's auto restarting the
 * playlist… I believe pressing on the widget might be also telling the app to
 * reset?" He is right, and it was never only the widget: EVERY start of a
 * station's music on Apple Music re-queued the playlist, and queueing starts
 * it at track one. Tap a widget, open a deck, come back to the station you
 * were already listening to — the song you were in the middle of was thrown
 * away every time. Spotify has been spared this since 18.08 (`startActionFor`
 * in NowPlayingContext); the Apple branch went straight to `playPlaylist` and
 * the note from that round says why — "the bridge exposes no queue-source id,
 * so there is nothing to compare".
 *
 * THERE IS SOMETHING TO COMPARE NOW, in two halves, and it needs both.
 *   1. What this app last handed the Music app (`readQueuedUri`), which
 *      survives a cold start and so covers the widget tap.
 *   2. Whether the song actually playing is IN that playlist — asked of the
 *      library, not of our own memory. Without it, a listener who queued
 *      something else in the Music app after our last drive would have that
 *      music silently adopted under the station's name, which is a new kind
 *      of wrong rather than a fix.
 *
 * WHEN IN DOUBT IT ANSWERS "NO". A missing memory, an unreadable track list,
 * a song that is not in the playlist — all of them fall through to starting
 * it properly, which is precisely today's behaviour. Being wrong toward
 * "start" costs the restart being fixed here; being wrong toward "leave"
 * costs silence, or somebody else's album playing under a station's name.
 *
 * Returns null when nothing is loaded at all, which is its own answer.
 */
async function queueHoldsTrack(playlistUri: string, title: string): Promise<boolean> {
  const wanted = title.trim().toLowerCase();
  if (!wanted) return false;
  try {
    const rows = await Promise.race([
      getApplePlaylistTracks(playlistUri),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!rows || rows.length === 0) return false;
    // Title alone. The now-playing entry and the library row do not always
    // spell an artist the same way (featured credits, "&" against "and"),
    // and a title collision inside one playlist would mean leaving music from
    // the same song — which is not a failure worth guarding against.
    return rows.some((t) => t.title.trim().toLowerCase() === wanted);
  } catch {
    return false;
  }
}

export async function appleQueueState(
  targetUri: string,
): Promise<{ uri: string | null; isPlaying: boolean } | null> {
  const entry = await getAppleNowPlaying().catch(() => null);
  if (!entry) return null;
  const remembered = await readQueuedUri();
  if (remembered !== targetUri) return { uri: remembered, isPlaying: entry.isPlaying };
  const holds = await queueHoldsTrack(targetUri, entry.title);
  return { uri: holds ? targetUri : null, isPlaying: entry.isPlaying };
}

/**
 * RESUME WHAT IS ALREADY LOADED, WITHOUT RE-QUEUEING IT.
 *
 * The paused half of the rule above: the right playlist is in the player and
 * stopped, so the fix is a bare play — handing `playPlaylist` the same uri
 * would restart it, which is the bug this whole round is about.
 *
 * Verified the same way a fresh start is, and for the same reason: `play()`
 * is `try?` in Swift and answers nothing, so a refusal would otherwise leave
 * the deck showing a drive over silence. If it has not taken by then the
 * playlist IS queued properly, since at that point a restart is better than
 * nothing playing.
 */
export async function resumeAppleQueue(uri: string): Promise<void> {
  await applePlay();
  (async () => {
    await new Promise((r) => setTimeout(r, START_VERIFY_MS));
    const entry = await getAppleNowPlaying().catch(() => null);
    if (entry?.isPlaying) return;
    await startApplePlaylist(uri);
  })().catch(() => {});
}

export async function startApplePlaylist(uri?: string): Promise<'playing' | 'error'> {
  if (!bridge) return 'error';
  try {
    if (uri && isApplePlaylist(uri)) {
      await withTimeout(bridge.playPlaylist(applePlaylistId(uri)), 6000);
      lastQueuedUri = uri;
      rememberQueuedUri(uri);
    } else {
      await withTimeout(bridge.play(), 6000);
    }
    verifyPlaylistTook().catch(() => {});
    return 'playing';
  } catch {
    return 'error';
  }
}

/**
 * PUT THE QUEUE BACK AND CARRY ON FROM WHERE IT STOPPED.
 *
 * Reported by a listener on 23.08: "after pausing the song through the app it
 * completely freezes trying to play it again and it desyncs from Apple Music…
 * most of the time the music won't play from the app itself and you have to
 * keep going back to Apple Music to play it again."
 *
 * WHAT WE KNOW FROM THE CODE, without being able to reproduce it here (no
 * device, and Swift cannot be built from this environment): the whole path is
 * silent when it fails. The native `play()` is `try? await player.play()`,
 * which throws away the error, and `applePlay` swallows it again on this
 * side — so if `SystemMusicPlayer` refuses to resume, the app has no idea and
 * simply appears frozen. `currentEntry` returning nil makes it worse, because
 * that blanks the deck's track entirely, which is the "desync".
 *
 * THE RECOVERY IS WHAT THE LISTENER DOES BY HAND. Going back to the Music app
 * and pressing play works because it gives the system player a queue again.
 * This does the same thing from here: re-queue the playlist the app itself
 * last started, then seek back to where the song was, so the fix is invisible
 * rather than a restart from the top.
 *
 * Returns false when there is nothing to recover WITH — i.e. no bridge at all.
 *
 * EVERY NATIVE CALL HERE IS TIMEOUT-WRAPPED (27.08) — it was not, even
 * though `withTimeout` exists specifically because a Swift `try?` call can
 * hang rather than throw, and this is the recovery path a stalled resume
 * calls into. An unwrapped hang here was a believable second cause of
 * Ethan's "occasionally the app will freeze" (27.08) on top of the one this
 * function already exists to fix.
 */
export async function recoverApplePlayback(resumeAtMs: number | null): Promise<boolean> {
  if (!bridge) return false;
  // NO QUEUE OF OUR OWN IS STILL WORTH A SECOND PRESS. A drive started from
  // music already playing (the "I can hear this" card) never calls
  // startApplePlaylist, by design — adopting exists precisely to touch
  // nothing — so `lastQueuedUri` is null on exactly the flow the listener said
  // he uses most, and the recovery used to decline there (23.08).
  //
  // Re-queueing would be wrong: that music belongs to the Music app and taking
  // it over would be worse than the bug. A bare second press is not — it sets
  // no queue, so the worst case is that it fails the same way the first
  // attempt did, and it is literally what the listener does by hand.
  if (!lastQueuedUri) {
    try {
      await withTimeout(bridge.play(), 6000);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await withTimeout(bridge.playPlaylist(applePlaylistId(lastQueuedUri)), 6000);
    // Re-queueing starts the playlist at its first track, so without this the
    // recovery would silently throw away where they were.
    if (resumeAtMs != null && resumeAtMs > 1500) {
      await withTimeout(bridge.seekTo(resumeAtMs), 6000);
    }
    return true;
  } catch {
    return false;
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
    // The RAW url from the bridge, scheme and all — "artwork yes" is how a
    // musicKit:// url the deck can't load hid behind a passing check for a
    // whole round (04.08). An instrument may never summarise the one detail
    // under investigation.
    out.push(entry
      ? `Now playing: ${entry.title} — artwork ${entry.artworkUrl ? `"${entry.artworkUrl.slice(0, 34)}…"` : 'MISSING'}`
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
    // holding a copy of the picture. Probed FRESH — no caches — and the
    // answer names the real failure, so one screenshot settles which side
    // is broken. "found" with a still-blank deck = the deck; anything else
    // is the words to bring back.
    if (entry?.title) {
      out.push(`Catalogue artwork: ${await probeAppleArtwork(entry.title, entry.artist)}`);
    }
  } catch { out.push('Now playing: no answer'); }
  out.push(...await probeRepeat());
  return out;
}

/**
 * DOES THE REPEAT COMMAND ACTUALLY REACH THE MUSIC APP?
 *
 * Three rounds have now answered that by reasoning about which of Apple's
 * two player surfaces is the real one, and the owner has reported the same
 * symptom after every one. So this stops theorising and MEASURES: read both
 * players raw, send a real `setRepeat('context')`, read both again, then put
 * the setting back where it was.
 *
 * IT MUST ISSUE THE COMMAND, not merely read — a probe that does not do the
 * same work as the code proves nothing about the code (03.08, the Spotify
 * playlist round, where four probes passed against an endpoint the app was
 * drowning in). A surface whose raw value MOVES is the one that obeys; one
 * that sits still is being written to for nothing. That is the fact the next
 * fix needs, and no amount of reading the Swift can supply it.
 *
 * Raw and unabbreviated on purpose: "repeat on" is exactly the kind of
 * summary that hid an unloadable artwork url for a whole round (04.08).
 */
async function probeRepeat(): Promise<string[]> {
  if (!bridge) return [];
  const read = async () => {
    const e = await safe(() => bridge!.currentEntry(), null);
    if (!e) return null;
    return {
      mp: e.mpRepeatRaw, mk: e.mkRepeatRaw,
      mode: e.repeatMode === undefined ? 'missing' : String(e.repeatMode),
    };
  };
  const before = await read();
  if (!before) return ['Repeat: nothing playing, so nothing to test'];
  if (before.mp === undefined && before.mk === undefined) {
    return ['Repeat: this build does not report it'];
  }
  // A number Apple's own docs give meaning to, so the screenshot is readable
  // without a table: 0 default (i.e. UNKNOWN), 1 none, 2 one, 3 all.
  const show = (r: NonNullable<Awaited<ReturnType<typeof read>>>) =>
    `MediaPlayer ${r.mp ?? '?'} · MusicKit ${r.mk ?? '?'} · app sees "${r.mode}"`;
  const lines = [`Repeat before: ${show(before)}`];
  await safe(() => bridge!.setRepeat('context'), undefined);
  await new Promise((r) => setTimeout(r, 900));
  const after = await read();
  lines.push(after ? `Repeat after asking for all: ${show(after)}` : 'Repeat after: no answer');
  if (after) {
    lines.push(`Which surface moved: ${
      [after.mp !== before.mp && 'MediaPlayer', after.mk !== before.mk && 'MusicKit']
        .filter(Boolean).join(' + ') || 'NEITHER — the command is not landing'}`);
  }
  // Put it back, so running the check does not quietly change what the
  // listener had set.
  await safe(() => bridge!.setRepeat(
    before.mode === 'track' || before.mode === 'context' ? before.mode : 'off'), undefined);
  return lines;
}
