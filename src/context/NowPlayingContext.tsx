import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { recordDriveEnd } from '@/utils/driveStats';
import { isRestrictedAccount, isSpotifyConnected, startPlayback, type StartResult } from '@/utils/spotify';
import { openInSpotify } from '@/utils/spotifyHandoff';
import { getStationPlaylist } from '@/utils/stationPlaylists';

/**
 * Get this station's music going, by whichever path this user has:
 *
 * - Allowlisted + connected → full Web API control (today's experience).
 * - Not allowlisted (or not connected) but a playlist is linked → hand the
 *   playlist to the Spotify app via deep link; Cruise FM stays the visuals.
 * - Nothing linked and no API → demo mode, silently (nothing to explain).
 *
 * Returns the verdict so the UI can narrate; null means "didn't need to try".
 */
async function playStationMusic(stationId: string, opts?: { onlyIfLinked?: boolean }): Promise<StartResult | null> {
  try {
    const linked = await getStationPlaylist(stationId);
    if (!linked && opts?.onlyIfLinked) return null;

    const connected = await isSpotifyConnected();
    const restricted = connected && (await isRestrictedAccount());

    if (connected && !restricted) {
      const r = await startPlayback(linked?.uri);
      // Allowlist rejection discovered mid-drive falls through to handoff —
      // and so does a dead/slow network ('error'): opening the playlist in
      // the Spotify app beats asking the user to retry.
      if (r !== 'restricted' && !(r === 'error' && linked)) return r;
    }

    if (linked) return (await openInSpotify(linked.uri)) ? 'handoff' : 'error';
    // Restricted with nothing linked: explain how to still get music.
    if (connected) return 'restricted';
    return null;
  } catch {
    return null; // never let a playback hiccup break the drive
  }
}

/** Plain-words translation of a start attempt, shown over the player. */
const START_NOTICES: Record<StartResult, string | null> = {
  'playing': null,
  'no-device': "Spotify isn't awake. Open Spotify, play any song for a second, then come back and press play.",
  'premium-required': 'Spotify needs a Premium account to let Cruise FM control playback.',
  'restricted': 'This Spotify account isn’t on the Cruise FM test list, so in-app control is off. Link a playlist to this station (paste a Spotify link) and drives will play through the Spotify app instead.',
  // Handoff is explained by the persistent in-mode panel, not a transient toast.
  'handoff': null,
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
  /** True when this drive's music was handed to the Spotify app (no in-app
   * control): the modes swap their dead transport for an honest panel. */
  handoff: boolean;
  /** Re-open the current station's playlist in Spotify (the honest panel's
   * "Open Spotify" action). */
  returnToSpotify: () => void;
  /** Bumps each time Spotify is about to (re)start audio (drive start, play,
   * skip, track change). The mic-reactive hook briefly stops listening around
   * these moments so iOS hands the audio session to Spotify cleanly — the
   * "smart auto-pause" that keeps playback crisp without killing the visuals. */
  micQuietTick: number;
  requestMicQuiet: () => void;
  /** The station's linked playlist just changed. If that station is the one
   * currently driving, switch the music to the new playlist right away;
   * otherwise it simply takes effect on the next Start Drive. */
  relinkStationPlaylist: (stationId: string) => void;
};

const Ctx = createContext<NowPlayingCtx | null>(null);

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NowPlayingSession | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlayingRaw] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const activityPing = useCallback(() => setActivityTick((t) => t + 1), []);
  const [micQuietTick, setMicQuietTick] = useState(0);
  const requestMicQuiet = useCallback(() => setMicQuietTick((t) => t + 1), []);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const clearPlaybackNotice = useCallback(() => setPlaybackNotice(null), []);
  const reportStartResult = useCallback((result: StartResult) => {
    setPlaybackNotice(START_NOTICES[result] ?? null);
    // Handoff = the music is playing in the Spotify app, uncontrollable here.
    setHandoff(result === 'handoff');
  }, []);
  // Every play/pause is also a sign of life for the drive check.
  const setPlaying = useCallback((p: boolean) => {
    setPlayingRaw(p);
    setActivityTick((t) => t + 1);
  }, []);
  const sessionRef = useRef<NowPlayingSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Keep the screen awake for the whole drive — a driving companion that dims
  // and locks mid-cruise is useless. Tied to the session (any mode, portrait
  // or landscape); released the moment the drive ends so the phone sleeps
  // normally again. A distinct tag keeps this independent of any per-mode
  // keep-awake so neither cancels the other.
  const driveActive = session != null;
  useEffect(() => {
    if (Platform.OS === 'web' || !driveActive) return;
    activateKeepAwakeAsync('cruise-drive').catch(() => {});
    return () => { deactivateKeepAwake('cruise-drive').catch(() => {}); };
  }, [driveActive]);

  const open = useCallback((mode: string, stationId: string = 'night-run', opts?: { preview?: boolean; paused?: boolean }) => {
    // iPod mode was retired — any old saved iPod cruise resumes in Equalizer.
    const m = mode === 'ipod' ? 'equalizer' : mode;
    setSession({ mode: m, stationId, preview: opts?.preview });
    setExpanded(true);
    setPlaying(!opts?.paused);
    setHandoff(false); // fresh drive; playStationMusic re-flags it if handed off
    // Every drive tries to get music going — the station's linked playlist
    // if it has one, otherwise resume whatever was playing. A paused open
    // leaves Spotify alone until the user presses play.
    if (!opts?.paused) {
      requestMicQuiet(); // let Spotify grab the audio session cleanly on start
      playStationMusic(stationId).then((r) => { if (r) reportStartResult(r); });
    }
  }, [reportStartResult, requestMicQuiet]);

  const minimize = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);

  const setStationId = useCallback((stationId: string) => {
    const current = sessionRef.current;
    if (!current || current.stationId === stationId) return;
    setSession({ ...current, stationId });
    // Retuning mid-drive (Tuner lock-on, Change Mood) switches the music
    // too — but only when the new station actually has a linked playlist.
    requestMicQuiet();
    playStationMusic(stationId, { onlyIfLinked: true }).then((r) => { if (r) reportStartResult(r); });
  }, [reportStartResult, requestMicQuiet]);

  const stop = useCallback(() => {
    setSession(null);
    setExpanded(false);
    setPlaying(false);
    setHandoff(false);
    recordDriveEnd().catch(() => {});
  }, []);

  const relinkStationPlaylist = useCallback((stationId: string) => {
    const current = sessionRef.current;
    // Only live-switch when this station is the active drive; otherwise the new
    // playlist is already saved and the next Start Drive will use it.
    if (!current || current.stationId !== stationId) return;
    requestMicQuiet();
    playStationMusic(stationId).then((r) => { if (r) reportStartResult(r); });
  }, [reportStartResult, requestMicQuiet]);

  const returnToSpotify = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    getStationPlaylist(current.stationId).then((linked) => {
      if (linked) openInSpotify(linked.uri);
    });
  }, []);

  const value = useMemo(
    () => ({ session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult, handoff, returnToSpotify, micQuietTick, requestMicQuiet, relinkStationPlaylist }),
    [session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult, handoff, returnToSpotify, micQuietTick, requestMicQuiet, relinkStationPlaylist],
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

/** Safe anywhere — lets playback controls ask the mic to briefly step aside so
 * Spotify can (re)start audio cleanly (the "smart auto-pause"). */
export function useMicQuietRequester(): () => void {
  return useContext(Ctx)?.requestMicQuiet ?? noopPing;
}

/** Safe anywhere — the counter the mic hook watches to know when to hush. */
export function useMicQuietSignal(): number {
  return useContext(Ctx)?.micQuietTick ?? 0;
}
