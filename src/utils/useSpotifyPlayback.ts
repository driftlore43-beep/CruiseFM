import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useActivityPing, useAdoptPlayState, useStartResultReporter, useWakeNudge } from '@/context/NowPlayingContext';

import {
  isSpotifyConnected,
  getPlaybackState,
  getPlaylistName,
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
  /** Album cover URL (mid-size), null when Spotify doesn't provide one. */
  albumArt: string | null;
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
export function useSpotifyPlayback(visible: boolean, opts?: { pollMs?: number }) {
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  // Name of the playlist the music is ACTUALLY coming from right now (may
  // differ from the station's linked playlist — e.g. user picked another
  // one in Spotify). Null when unknown / not a playlist context.
  const [contextName, setContextName] = useState<string | null>(null);
  const lastCtxUriRef = useRef<string | null | undefined>(undefined);
  const cancelledRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  // What Spotify last reported about actual playback — the play button's
  // "did sound really start?" check reads this after a resume attempt.
  const isPlayingRef = useRef<boolean | null>(null);
  // When the user last pressed a control — recent presses win over the poll
  // so an optimistic tap isn't fought by slightly-stale server state.
  const lastControlRef = useRef(0);
  const adoptPlay = useAdoptPlayState();
  const adoptRef = useRef(adoptPlay);
  adoptRef.current = adoptPlay;

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
        if (data) isPlayingRef.current = data.is_playing ?? null;
        // Mirror reality: if Spotify pauses on its own (car Bluetooth off,
        // pause from another device) the drive pauses too — and resumes when
        // music starts again elsewhere. Recent user taps win for 8s.
        if (typeof data?.is_playing === 'boolean' && Date.now() - lastControlRef.current > 8000) {
          adoptRef.current(data.is_playing);
        }
        if (item?.name) {
          setTrack({
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
            // Spotify sorts images largest-first; [1] (~300px) suits the label.
            albumArt: item.album?.images?.[1]?.url ?? item.album?.images?.[0]?.url ?? null,
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
        // Which playlist is really playing? Follow the player's context so
        // the pill updates when the music source changes under us.
        const ctxUri: string | null = data?.context?.uri ?? null;
        if (ctxUri !== lastCtxUriRef.current) {
          lastCtxUriRef.current = ctxUri;
          const m = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(ctxUri ?? '');
          if (m) {
            getPlaylistName(m[1]).then((n) => { if (!cancelledRef.current && n) setContextName(n); }).catch(() => {});
          } else {
            setContextName(null);
          }
        }
      };
      refreshRef.current = refresh;
      refresh();
      // Battery: callers showing less detail (the mini-player) poll slower —
      // every network wake costs radio time.
      interval = setInterval(refresh, opts?.pollMs ?? 5000);
    })();

    return () => {
      cancelledRef.current = true;
      if (interval) clearInterval(interval);
    };
  }, [visible]);

  // Smooth re-entry: the moment the app comes back to the foreground, ask
  // Spotify where things stand instead of waiting out the 5s poll — the
  // title, progress and play state snap into step before the user notices.
  // Never triggers a start attempt or the wake note; music already flowing
  // is left completely alone.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshRef.current();
    });
    return () => sub.remove();
  }, [visible]);

  // Fire-and-forget controls; refresh shortly after so the title catches up.
  // Each one is also a sign of life for the "Are you driving?" check, and
  // play doubles as a retry that reports Spotify's verdict to the notice.
  const ping = useActivityPing();
  const report = useStartResultReporter();
  const wakeNudge = useWakeNudge();
  const after = () => setTimeout(() => refreshRef.current(), 700);

  return {
    connected,
    track,
    contextName,
    shuffleOn,
    repeatMode,
    // Only surface Spotify's verdict for users who actually connected it —
    // demo-mode listeners shouldn't be nagged about a service they never linked.
    play: () => {
      ping();
      lastControlRef.current = Date.now();
      // The wake note is the DEFAULT on every play — new users learn the
      // Spotify dance up front instead of sitting in silence. A clean
      // 'playing' verdict clears it within a beat.
      if (connected) wakeNudge();
      startPlayback()
        .then((r) => { if (connected) report(r); })
        .catch(() => {});
      // After a long pause Spotify's API often accepts the play while the
      // dozing device takes ages to actually make sound. Re-poll and, if
      // nothing is truly playing a few seconds in, re-show the wake tip.
      if (connected) {
        setTimeout(() => refreshRef.current(), 3200);
        setTimeout(() => { if (isPlayingRef.current === false) wakeNudge(); }, 4200);
      }
      after();
    },
    pause: () => { ping(); lastControlRef.current = Date.now(); isPlayingRef.current = false; spotifyPause().catch(() => {}); after(); },
    next: () => { ping(); lastControlRef.current = Date.now(); skipNext().catch(() => {}); after(); },
    prev: () => { ping(); lastControlRef.current = Date.now(); skipPrev().catch(() => {}); after(); },
    // Optimistic local flip; the API call + next poll settle the truth.
    shuffle: (state: boolean) => { ping(); setShuffleOn(state); spotifySetShuffle(state).catch(() => {}); after(); },
    repeat: (mode: RepeatMode) => { ping(); setRepeatMode(mode); spotifySetRepeat(mode).catch(() => {}); after(); },
  };
}
