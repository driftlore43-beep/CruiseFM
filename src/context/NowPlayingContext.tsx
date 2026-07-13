import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { recordDriveEnd } from '@/utils/driveStats';
import { isSpotifyConnected, startPlayback } from '@/utils/spotify';
import { getStationPlaylist } from '@/utils/stationPlaylists';

/**
 * Kick Spotify toward this station's sound. If the user linked a playlist to
 * the station it starts playing; otherwise (unless onlyIfLinked) we just
 * resume whatever they had going. Fire-and-forget: no device / not connected
 * simply means the visuals run without us touching the music.
 */
async function playStationMusic(stationId: string, opts?: { onlyIfLinked?: boolean }) {
  try {
    if (!(await isSpotifyConnected())) return;
    const linked = await getStationPlaylist(stationId);
    if (!linked && opts?.onlyIfLinked) return;
    await startPlayback(linked?.uri);
  } catch {
    // never let a playback hiccup break the drive
  }
}

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
};

const Ctx = createContext<NowPlayingCtx | null>(null);

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NowPlayingSession | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
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
    if (!opts?.paused) playStationMusic(stationId);
  }, []);

  const minimize = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);

  const setStationId = useCallback((stationId: string) => {
    const current = sessionRef.current;
    if (!current || current.stationId === stationId) return;
    setSession({ ...current, stationId });
    // Retuning mid-drive (Tuner lock-on, Change Mood) switches the music
    // too — but only when the new station actually has a linked playlist.
    playStationMusic(stationId, { onlyIfLinked: true });
  }, []);

  const stop = useCallback(() => {
    setSession(null);
    setExpanded(false);
    setPlaying(false);
    recordDriveEnd().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop }),
    [session, expanded, playing, open, minimize, expand, setStationId, stop],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNowPlaying(): NowPlayingCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNowPlaying must be used inside NowPlayingProvider');
  return ctx;
}
