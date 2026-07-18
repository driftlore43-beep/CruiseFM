import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { recordDriveEnd } from '@/utils/driveStats';
import { isSpotifyConnected, startPlayback, type StartResult } from '@/utils/spotify';
import { getStationPlaylist } from '@/utils/stationPlaylists';

/**
 * Kick Spotify toward this station's sound. If the user linked a playlist to
 * the station it starts playing; otherwise (unless onlyIfLinked) we just
 * resume whatever they had going. Returns Spotify's verdict so the UI can
 * explain a silent drive; null means "didn't even try" (not connected /
 * nothing linked) which needs no explaining.
 */
async function playStationMusic(stationId: string, opts?: { onlyIfLinked?: boolean }): Promise<StartResult | null> {
  try {
    if (!(await isSpotifyConnected())) return null;
    const linked = await getStationPlaylist(stationId);
    if (!linked && opts?.onlyIfLinked) return null;
    return await startPlayback(linked?.uri);
  } catch {
    return null; // never let a playback hiccup break the drive
  }
}

/** Plain-words translation of a failed start, shown over the player. */
const START_NOTICES: Record<StartResult, string | null> = {
  'playing': null,
  'no-device': "Spotify isn't awake. Open Spotify, play any song for a second, then come back and press play.",
  'premium-required': 'Spotify needs a Premium account to let Cruise FM control playback.',
  'error': "Spotify didn't respond. Check the Spotify app is open and logged in, then press play to retry.",
};

export type NowPlayingSession = { mode: string; stationId: string; preview?: boolean };

type NowPlayingCtx = {
  /** The active drive (mode + station), or null when nothing is up. */
  session: NowPlayingSession | null;
  /** True while the mode fullscreen covers the app; false = mini-player. */
  expanded: boolean;
  /** Shared play state so the fullscreen and mini-player stay in sync. */
  playing: boolean;
  setPlaying: (p: boolean) => void;
  /** Start (or replace) a session and show its fullscreen. Pass
   * `{ preview: true }` for a free-user taste of a locked mode, or
   * `{ paused: true }` to open idle until the user presses play. */
  open: (mode: string, stationId?: string, opts?: { preview?: boolean; paused?: boolean }) => void;
  /** Keep the session (and the music) but drop to the mini-player. */
  minimize: () => void;
  /** Bring the fullscreen back for the current session. */
  expand: () => void;
  /** Station switched from inside a mode — keeps the mini-player honest. */
  setStationId: (stationId: string) => void;
  /** End the session entirely (mini-player ✕) — banks the drive. */
  stop: () => void;
  /** Bumps whenever the user touches a playback control — the
   * "Are you driving?" check watches this for signs of life. */
  activityTick: number;
  activityPing: () => void;
  /** Why the last start attempt made no sound, in plain words (null = fine). */
  playbackNotice: string | null;
  clearPlaybackNotice: () => void;
  /** Feed a fresh start attempt's outcome into the notice. */
  reportStartResult: (result: StartResult) => void;
};

const Ctx = createContext<NowPlayingCtx | null>(null);

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NowPlayingSession | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlayingRaw] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const activityPing = useCallback(() => setActivityTick((t) => t + 1), []);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const clearPlaybackNotice = useCallback(() => setPlaybackNotice(null), []);
  const reportStartResult = useCallback((result: StartResult) => {
    setPlaybackNotice(START_NOTICES[result] ?? null);
  }, []);
  // Every play/pause is also a sign of life for the drive check.
  const setPlaying = useCallback((p: boolean) => {
    setPlayingRaw(p);
    setActivityTick((t) => t + 1);
  }, []);
  const sessionRef = useRef<NowPlayingSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const open = useCallback((mode: string, stationId: string = 'night-run', opts?: { preview?: boolean; paused?: boolean }) => {
    // iPod mode was retired — any old saved iPod cruise resumes in Equalizer.
    const m = mode === 'ipod' ? 'equalizer' : mode;
    setSession({ mode: m, stationId, preview: opts?.preview });
    setExpanded(true);
    setPlaying(!opts?.paused);
    // Every drive tries to get music going — the station's linked playlist
    // if it has one, otherwise resume whatever was playing. A paused open
    // leaves Spotify alone until the user presses play.
    if (!opts?.paused) {
      playStationMusic(stationId).then((r) => { if (r) reportStartResult(r); });
    }
  }, [reportStartResult]);

  const minimize = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);

  const setStationId = useCallback((stationId: string) => {
    const current = sessionRef.current;
    if (!current || current.stationId === stationId) return;
    setSession({ ...current, stationId });
    // Retuning mid-drive (Tuner lock-on, Change Mood) switches the music
    // too — but only when the new station actually has a linked playlist.
    playStationMusic(stationId, { onlyIfLinked: true }).then((r) => { if (r) reportStartResult(r); });
  }, [reportStartResult]);

  const stop = useCallback(() => {
    setSession(null);
    setExpanded(false);
    setPlaying(false);
    recordDriveEnd().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult }),
    [session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNowPlaying(): NowPlayingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNowPlaying must be used inside NowPlayingProvider');
  return ctx;
}

const noopPing = () => {};

/** Safe anywhere (no-ops outside the provider) — lets shared hooks report
 * playback-control touches to the drive check. */
export function useActivityPing(): () => void {
  return useContext(Ctx)?.activityPing ?? noopPing;
}

/** Safe anywhere — lets the playback hook feed start outcomes to the notice. */
export function useStartResultReporter(): (result: StartResult) => void {
  return useContext(Ctx)?.reportStartResult ?? noopPing;
}
