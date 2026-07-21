import { useEffect, useRef, useState } from 'react';

import { useActivityPing, useMicQuietRequester, useStartResultReporter } from '@/context/NowPlayingContext';

import {
  isSpotifyConnected,
  getPlaybackState,
  pause as spotifyPause,
  startPlayback,
  skipNext,
  skipPrev,
  setShuffle as spotifySetShuffle,
  setRepeat as spotifySetRepeat,
} from './spotify';

export type RepeatMode = 'off' | 'context' | 'track';

export type NowPlaying = {
  title: string;
  artist: string;
  /** Real track length from Spotify, null when unknown. */
  durationMs: number | null;
  /** Where the song was (ms) when we last asked… */
  progressMs: number | null;
  /** …and when that was, so callers can extrapolate between polls. */
  syncedAt: number;
  isPlaying: boolean;
};

/**
 * Live Spotify playback bridge for the visual modes.
 *
 * While `visible` and Spotify is connected, polls the current track every 5s
 * (plus right after a control is used) and exposes real play/pause/skip.
 * When Spotify isn't connected (e.g. web preview), everything no-ops and
 * `track` stays null so callers can fall back to their demo track names.
 */
export function useSpotifyPlayback(visible: boolean) {
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const cancelledRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  const lastTitleRef = useRef<string | null>(null);

  // Ask the mic-reactive hook to step aside for a beat so Spotify can (re)start
  // audio cleanly. Kept in a ref so the poll effect needn't depend on it.
  const requestMicQuiet = useMicQuietRequester();
  const hushMicRef = useRef(requestMicQuiet);
  hushMicRef.current = requestMicQuiet;
  const hushMic = () => hushMicRef.current();

  useEffect(() => {
    if (!visible) return;
    cancelledRef.current = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const conn = await isSpotifyConnected();
      if (cancelledRef.current) return;
      setConnected(conn);
      if (!conn) return;

      const refresh = async () => {
        const data = await getPlaybackState();
        if (cancelledRef.current) return;
        const item = data?.item;
        if (item?.name) {
          // A new song (auto-advance) is also a fresh audio start — hush the
          // mic so Spotify's transition isn't fighting the recorder.
          if (lastTitleRef.current && lastTitleRef.current !== item.name) hushMic();
          lastTitleRef.current = item.name;
          setTrack({
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
            durationMs: item.duration_ms ?? null,
            progressMs: data.progress_ms ?? null,
            syncedAt: Date.now(),
            isPlaying: data.is_playing ?? true,
          });
        }
        // Keep the shuffle/repeat buttons honest with Spotify's real state.
        if (data) {
          setShuffleOn(!!data.shuffle_state);
          if (data.repeat_state) setRepeatMode(data.repeat_state as RepeatMode);
        }
      };
      refreshRef.current = refresh;
      refresh();
      interval = setInterval(refresh, 5000);
    })();

    return () => {
      cancelledRef.current = true;
      if (interval) clearInterval(interval);
    };
  }, [visible]);

  // Fire-and-forget controls; refresh shortly after so the title catches up.
  // Each one is also a sign of life for the "Are you driving?" check, and
  // play doubles as a retry that reports Spotify's verdict to the notice.
  const ping = useActivityPing();
  const report = useStartResultReporter();
  const after = () => setTimeout(() => refreshRef.current(), 700);

  return {
    connected,
    track,
    shuffleOn,
    repeatMode,
    // Only surface Spotify's verdict for users who actually connected it —
    // demo-mode listeners shouldn't be nagged about a service they never linked.
    play: () => { ping(); hushMic(); startPlayback().then((r) => { if (connected) report(r); }).catch(() => {}); after(); },
    pause: () => { ping(); spotifyPause().catch(() => {}); after(); },
    next: () => { ping(); hushMic(); skipNext().catch(() => {}); after(); },
    prev: () => { ping(); hushMic(); skipPrev().catch(() => {}); after(); },
    // Optimistic local flip; the API call + next poll settle the truth.
    shuffle: (state: boolean) => { ping(); setShuffleOn(state); spotifySetShuffle(state).catch(() => {}); after(); },
    repeat: (mode: RepeatMode) => { ping(); setRepeatMode(mode); spotifySetRepeat(mode).catch(() => {}); after(); },
  };
}
