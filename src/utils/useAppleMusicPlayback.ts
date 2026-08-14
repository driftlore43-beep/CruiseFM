import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isInFront } from '@/utils/useAppActive';

import { useActivityPing, useAdoptPlayState } from '@/context/NowPlayingContext';

import { lookupAppleArtwork } from './appleArtwork';
import {
  getAppleLibraryArtwork,
  appleMusicAvailable,
  appleNext,
  applePause,
  applePlay,
  applePrev,
  appleSeekTo,
  appleSetRepeat,
  appleSetShuffle,
  getAppleNowPlaying,
  isAppleMusicConnected,
} from './appleMusic';
import { backButtonAction, type NowPlaying, type RepeatMode } from './useSpotifyPlayback';

/**
 * Live Apple Music playback bridge — the peer of useSpotifyPlayback, and the
 * second seat behind the useMusicPlayback switchboard.
 *
 * Deliberately the same shape as the Spotify hook so the switchboard can
 * return either one and no caller can tell the difference.
 *
 * Simpler than Spotify's in two ways, both because MusicKit plays on THIS
 * phone rather than commanding a remote device: there is no waking a dozing
 * speaker (so no wake nudge, no start-result reporting), and no playlist
 * "context" to chase — the queue is ours.
 */
export function useAppleMusicPlayback(visible: boolean, opts?: { pollMs?: number }) {
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [contextName, setContextName] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  // Read by the back button, which has to know where the song is right now.
  const trackRef = useRef<NowPlaying | null>(null);
  trackRef.current = track;
  const artCacheRef = useRef<{ key: string | null; url: string | null; at: number }>({ key: null, url: null, at: 0 });
  const refreshRef = useRef<() => void>(() => {});
  const lastControlRef = useRef(0);
  const adoptPlay = useAdoptPlayState();
  const adoptRef = useRef(adoptPlay);
  adoptRef.current = adoptPlay;

  /**
   * The poll is owned by a ref so the AppState listener can stop and restart
   * it. This is a CRASH FIX, not a battery tweak: iOS SIGKILLs a backgrounded
   * app that keeps a timer running (bug_type 309, invisible to Sentry), which
   * is exactly what the Spotify poll did before it was gated. Any repeating
   * timer added here must obey the same rule.
   */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(() => refreshRef.current(), opts?.pollMs ?? 5000);
  };

  useEffect(() => {
    if (!visible || !appleMusicAvailable()) return;
    cancelledRef.current = false;

    (async () => {
      const conn = await isAppleMusicConnected();
      if (cancelledRef.current) return;
      setConnected(conn);
      if (!conn) return;

      /**
       * Artwork is chased SEPARATELY from the song, and never awaited before
       * the song is published. Both fallbacks can take seconds — a native
       * call with its own race, then a network lookup — and build 21 already
       * proved what happens when artwork sits between the poll and the title:
       * the whole deck reads "no track" for the entire drive.
       *
       * Claimed in the cache BEFORE the work starts so the 5s poll doesn't
       * launch the same chase over and over while the first one is in flight.
       */
      const chaseArtwork = async (artKey: string, title: string, artist: string) => {
        // Local first: it is exact, instant on the next song, and needs no
        // signal. Empty for a streamed library, which is why the catalogue
        // lookup exists behind it.
        let url = await getAppleLibraryArtwork();
        if (!url) url = await lookupAppleArtwork(title, artist);
        if (!url) return;                        // the claim's timestamp reopens the chase
        // The song may have moved on while we were away — patch only if this
        // is still what's playing, or the deck would wear the last cover.
        if (artCacheRef.current.key !== artKey) return;
        artCacheRef.current = { key: artKey, url, at: Date.now() };
        // Deliberately NOT gated on cancelledRef: a completed lookup is valid
        // whatever the screen did while it ran, and dropping it left the
        // claim blocking retries with nothing to show. A state update on a
        // gone instance is a harmless no-op.
        setTrack((t) => (t && t.title === title ? { ...t, albumArt: url } : t));
      };

      const refresh = async () => {
        const entry = await getAppleNowPlaying();
        if (cancelledRef.current) return;
        if (!entry) { setTrack(null); return; }
        // Library tracks usually carry no loadable MusicKit artwork URL —
        // keyed on title AND artist, since two songs can share either one.
        const artKey = `${entry.title}|${entry.artist}`;
        const claimed = artCacheRef.current.key === artKey;
        const art = entry.artworkUrl ?? (claimed ? artCacheRef.current.url : null);
        // Mirror reality: if music stops elsewhere (car Bluetooth drops, the
        // Music app pauses) the drive follows. Recent taps win for 8s.
        if (Date.now() - lastControlRef.current > 8000) adoptRef.current(entry.isPlaying);
        setTrack({
          title: entry.title,
          artist: entry.artist,
          albumArt: art,
          durationMs: entry.durationMs,
          progressMs: entry.positionMs,
          syncedAt: Date.now(),
          isPlaying: entry.isPlaying,
        });
        if (entry.contextName !== undefined) setContextName(entry.contextName ?? null);
        // A missing cover is re-chased every ~20s, not claimed once forever:
        // a chase can die mid-flight (backgrounded app, dropped signal), and
        // the old one-shot claim left the deck blank for the rest of the
        // song with all three artwork routes healthy.
        const staleMiss = claimed && artCacheRef.current.url == null
          && Date.now() - artCacheRef.current.at > 20000;
        if (!entry.artworkUrl && (!claimed || staleMiss)) {
          artCacheRef.current = { key: artKey, url: null, at: Date.now() };
          chaseArtwork(artKey, entry.title, entry.artist);
        }
      };
      refreshRef.current = refresh;
      refresh();
      if (isInFront(AppState.currentState)) startPoll();
    })();

    return () => {
      cancelledRef.current = true;
      stopPoll();
    };
  }, [visible]);

  // Poll only while the app is in front of the user — see the note above.
  // Returning to the app also re-reads immediately so the title and progress
  // snap into step rather than waiting out the interval.
  useEffect(() => {
    if (!visible || !appleMusicAvailable()) return;
    // Same rule as Spotify's, and for the same reason — see useAppActive.
    let inFront = isInFront(AppState.currentState);
    const sub = AppState.addEventListener('change', (state) => {
      const now = isInFront(state);
      if (!now) { inFront = false; stopPoll(); return; }
      // Also revives a poll that is dead for any other reason — see the note
      // on the Spotify copy of this.
      const wasAway = !inFront;
      inFront = true;
      if (wasAway || pollRef.current == null) { refreshRef.current(); startPoll(); }
    });
    return () => sub.remove();
  }, [visible]);

  const ping = useActivityPing();
  const after = () => setTimeout(() => refreshRef.current(), 500);

  return {
    available: appleMusicAvailable(),
    connected,
    track,
    contextName,
    // Apple's system player exposes no queue-source id — the in-drive song
    // list is Spotify-only for now, and null is how it knows.
    contextUri: null as string | null,
    shuffleOn,
    repeatMode,
    // Controls are optimistic: fire, then re-read so the display catches up.
    // Playback is local, so these land far faster than Spotify's remote calls
    // and need none of its waking machinery.
    play: () => { ping(); lastControlRef.current = Date.now(); applePlay(); after(); },
    pause: () => { ping(); lastControlRef.current = Date.now(); applePause(); after(); },
    next: () => { ping(); lastControlRef.current = Date.now(); appleNext(); after(); },
    // Restart-then-previous, same rule and same window as Spotify's — see the
    // note on RESTART_WINDOW_MS there.
    prev: () => {
      ping();
      lastControlRef.current = Date.now();
      if (backButtonAction(trackRef.current) === 'restart') { appleSeekTo(0); after(); return; }
      applePrev();
      after();
    },
    shuffle: (state: boolean) => { ping(); setShuffleOn(state); appleSetShuffle(state); after(); },
    repeat: (mode: RepeatMode) => { ping(); setRepeatMode(mode); appleSetRepeat(mode); after(); },
  };
}
