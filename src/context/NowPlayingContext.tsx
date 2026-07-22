import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { recordDriveEnd } from '@/utils/driveStats';
import { getSavedPlatform } from '@/utils/musicPlatform';
import { getPlaybackState, isRestrictedAccount, isSpotifyConnected, pause as pauseSpotify, startPlayback, type StartResult } from '@/utils/spotify';
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
async function playStationMusic(stationId: string, opts?: { resumeAny?: boolean }): Promise<StartResult | null> {
  try {
    const linked = await getStationPlaylist(stationId);
    const connected = await isSpotifyConnected();

    // Each station owns its own sound. A station with no playlist never
    // borrows whatever happens to be playing — that made stations feel
    // interchangeable and confusing. Pause the stray music and ask for a
    // playlist instead. EXCEPT free-mode previews (`resumeAny`): a taste of
    // a locked visual should work with whatever song the user has going.
    if (!linked) {
      if (opts?.resumeAny && connected) {
        const restrictedPrev = await isRestrictedAccount();
        if (!restrictedPrev) return await startPlayback();
        return 'restricted';
      }
      if (connected) {
        pauseSpotify().catch(() => {});
        return 'no-playlist';
      }
      // Not connected: only nudge Spotify-platform people toward linking a
      // playlist. YouTube Music / Apple Music / other listeners run their
      // music in their own app — Cruise FM is the visual companion, silently.
      const platform = await getSavedPlatform();
      return platform === 'spotify' ? 'no-playlist' : null;
    }

    const restricted = connected && (await isRestrictedAccount());

    if (connected && !restricted) {
      const r = await startPlayback(linked.uri);
      // Allowlist rejection discovered mid-drive falls through to handoff —
      // and so does a dead/slow network ('error'): opening the playlist in
      // the Spotify app beats asking the user to retry.
      if (r !== 'restricted' && r !== 'error') return r;
    }

    return (await openInSpotify(linked.uri)) ? 'handoff' : 'error';
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
  'no-playlist': "This station doesn't have its own playlist yet. Tap Add Playlist to give it one — every drive here will play it.",
  'error': "Spotify didn't respond. Check the Spotify app is open and logged in, then press play to retry.",
};

/** The default companion note on every start attempt — Spotify only hands
 * over control once its own app is awake, and new users need to know that
 * up front, not after a timeout. A clean 'playing' verdict clears it. */
const WAKE_SPOTIFY_NUDGE =
  "Waking Spotify… if nothing plays in a few seconds, open Spotify and play any song for a moment, then come back and press play.";

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
  /** The station's linked playlist just changed. If that station is the one
   * currently driving, switch the music to the new playlist right away;
   * otherwise it simply takes effect on the next Start Drive. */
  relinkStationPlaylist: (stationId: string) => void;
  /** Show the wake-Spotify tip (playback controls call this when a start is
   * dragging on with no verdict). */
  showWakeNudge: () => void;
};

const Ctx = createContext<NowPlayingCtx | null>(null);

export function NowPlayingProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NowPlayingSession | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlayingRaw] = useState(false);
  const [activityTick, setActivityTick] = useState(0);
  const activityPing = useCallback(() => setActivityTick((t) => t + 1), []);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const clearPlaybackNotice = useCallback(() => setPlaybackNotice(null), []);
  const showWakeNudge = useCallback(() => setPlaybackNotice(WAKE_SPOTIFY_NUDGE), []);
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

  // Smooth re-entry: when the app comes back to the foreground mid-drive,
  // adopt Spotify's real play state. If the user paused from the lock screen
  // or Spotify itself while away, the drive shows paused instead of dancing
  // to silence — and vice versa. Quietly reads state; never starts, stops,
  // or nags.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !sessionRef.current) return;
      (async () => {
        try {
          if (!(await isSpotifyConnected())) return;
          const data = await getPlaybackState();
          if (data && typeof data.is_playing === 'boolean') setPlayingRaw(data.is_playing);
        } catch { /* re-sync is best-effort */ }
      })();
    });
    return () => sub.remove();
  }, []);

  // Kick the station's music and narrate the outcome. Connected drivers see
  // the wake-Spotify note IMMEDIATELY on every start attempt — new users
  // shouldn't have to wait out a silent gap to learn why nothing plays. A
  // clean 'playing' verdict clears it within a beat; any other verdict
  // replaces it with its own message.
  //
  // `breath` (mood switches): rather than yanking the music straight from one
  // playlist to the next, pause first and hold a beat of silence — a station
  // change should feel like retuning a radio, not a hard cut.
  // `resumeAny` (previews): no linked playlist just resumes the user's music.
  const startStationMusic = useCallback((stationId: string, opts?: { breath?: boolean; resumeAny?: boolean }) => {
    let settled = false;
    isSpotifyConnected()
      .then((c) => { if (c && !settled) setPlaybackNotice(WAKE_SPOTIFY_NUDGE); })
      .catch(() => {});
    const kick = () => {
      playStationMusic(stationId, { resumeAny: opts?.resumeAny }).then((r) => {
        settled = true;
        if (r) reportStartResult(r);
      });
    };
    if (opts?.breath) {
      isSpotifyConnected()
        .then((c) => { if (c) return pauseSpotify().catch(() => {}); })
        .catch(() => {});
      setTimeout(kick, 900);
    } else {
      kick();
    }
  }, [reportStartResult]);

  const open = useCallback((mode: string, stationId: string = 'night-run', opts?: { preview?: boolean; paused?: boolean }) => {
    // iPod mode was retired — any old saved iPod cruise resumes in Equalizer.
    const m = mode === 'ipod' ? 'equalizer' : mode;
    setSession({ mode: m, stationId, preview: opts?.preview });
    setExpanded(true);
    setPlaying(!opts?.paused);
    setHandoff(false); // fresh drive; playStationMusic re-flags it if handed off
    // Every drive tries to get its station's own playlist going. A paused
    // open leaves Spotify alone until the user presses play. Previews may
    // resume whatever the user was listening to — any song works for a taste.
    if (!opts?.paused) startStationMusic(stationId, { resumeAny: !!opts?.preview });
  }, [startStationMusic]);

  const minimize = useCallback(() => setExpanded(false), []);
  const expand = useCallback(() => setExpanded(true), []);

  const setStationId = useCallback((stationId: string) => {
    const current = sessionRef.current;
    if (!current || current.stationId === stationId) return;
    setSession({ ...current, stationId });
    // Retuning mid-drive (Tuner lock-on, Change Mood) switches the music too —
    // with a breath of silence between moods so it feels like retuning, not a
    // hard cut. A station with no playlist pauses the old one and asks for
    // its own — moods never bleed into each other.
    startStationMusic(stationId, { breath: true });
  }, [startStationMusic]);

  const stop = useCallback(() => {
    setSession(null);
    setExpanded(false);
    setPlaying(false);
    setHandoff(false);
    // The ✕ ends the whole drive — music included. Leaving Spotify running
    // after the player is gone made every next station start confusing.
    isSpotifyConnected()
      .then((c) => { if (c) pauseSpotify().catch(() => {}); })
      .catch(() => {});
    recordDriveEnd().catch(() => {});
  }, []);

  const relinkStationPlaylist = useCallback((stationId: string) => {
    const current = sessionRef.current;
    // Only live-switch when this station is the active drive; otherwise the new
    // playlist is already saved and the next Start Drive will use it.
    if (!current || current.stationId !== stationId) return;
    // Same breath as a mood switch: pause the old playlist, hold a beat,
    // then bring in the new one — never a mid-note yank.
    startStationMusic(stationId, { breath: true });
  }, [startStationMusic]);

  const returnToSpotify = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    getStationPlaylist(current.stationId).then((linked) => {
      if (linked) openInSpotify(linked.uri);
    });
  }, []);

  const value = useMemo(
    () => ({ session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult, handoff, returnToSpotify, relinkStationPlaylist, showWakeNudge }),
    [session, expanded, playing, setPlaying, open, minimize, expand, setStationId, stop, activityTick, activityPing, playbackNotice, clearPlaybackNotice, reportStartResult, handoff, returnToSpotify, relinkStationPlaylist, showWakeNudge],
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

/** Safe anywhere — lets playback controls surface the wake-Spotify tip when a
 * start attempt drags on with no verdict. */
export function useWakeNudge(): () => void {
  return useContext(Ctx)?.showWakeNudge ?? noopPing;
}
