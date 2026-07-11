import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { recordDriveEnd } from '@/utils/driveStats';

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
   * `{ preview: true }` for a free-user taste of a locked mode. */
  open: (mode: string, stationId?: string, opts?: { preview?: boolean }) => void;
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

  const open = useCallback((mode: string, stationId: string = 'night-run', opts?: { preview?: boolean }) => {
    // iPod mode was retired — any old saved iPod cruise resumes in Equalizer.
    const m = mode === 'ipod' ? 'equalizer' : mode;
    setSession({ mode: m, stationId, preview: opts?.preview });
    setExpanded(true);
    setPlaying(true);
  }, []);

  const minimize = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);

  const setStationId = useCallback((stationId: string) => {
    setSession((s) => (s ? { ...s, stationId } : s));
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
