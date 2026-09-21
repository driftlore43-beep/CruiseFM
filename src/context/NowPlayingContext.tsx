import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { recordDriveEnd } from '@/utils/driveStats';
import { getSavedPlatform, type PlatformId } from '@/utils/musicPlatform';
import {
  HANDOFF_APP_NAME, openPlaylist, platformOfUri, type HandoffPlatform,
} from '@/utils/playlistHandoff';
import { isRestrictedAccount, isSpotifyConnected, startPlayback, type StartResult } from '@/utils/spotify';
import { openInSpotify } from '@/utils/spotifyHandoff';
import { getStationPlaylist } from '@/utils/stationPlaylists';

/** Start outcomes, plus the one that isn't Spotify's to report. */
export type DriveStartResult = StartResult | 'link-needed';

type StartOutcome = { result: DriveStartResult; platform: HandoffPlatform | null };

/** Only these two can take a pasted playlist link today. */
function handoffPlatformOf(id: PlatformId | null): HandoffPlatform | null {
  return id === 'spotify' || id === 'appleMusic' ? id : null;
}

/**
 * Get this station's music going, by whichever path this user has:
 *
 * - Apple Music playlist linked → hand it to the Apple Music app. There is no
 *   API path here at all, so none of the Spotify checks below apply.
 * - Spotify, allowlisted + connected → full Web API control.
 * - Spotify, not allowlisted (or not connected), playlist linked → hand the
 *   playlist to the Spotify app; Cruise FM stays the visuals.
 * - Nothing linked, but the user told us which service they use → say how to
 *   link one, rather than playing nothing and explaining nothing.
 * - Nothing linked and no preference → demo mode, silently.
 *
 * Returns the verdict (and who it's about) so the UI can narrate; null means
 * "didn't need to try".
 */
async function playStationMusic(stationId: string, opts?: { onlyIfLinked?: boolean }): Promise<StartOutcome | null> {
  try {
    const linked = await getStationPlaylist(stationId);
    if (!linked && opts?.onlyIfLinked) return null;

    const linkedPlatform = linked ? platformOfUri(linked.uri) : null;

    // Anything that isn't Spotify is handoff-only — go straight there.
    if (linked && linkedPlatform && linkedPlatform !== 'spotify') {
      const ok = await openPlaylist(linked.uri);
      return { result: ok ? 'handoff' : 'error', platform: linkedPlatform };
    }

    const connected = await isSpotifyConnected();
    const restricted = connected && (await isRestrictedAccount());

    if (connected && !restricted) {
      const r = await startPlayback(linked?.uri);
      // Allowlist rejection discovered mid-drive falls through to handoff —
      // and so does a dead/slow network ('error'): opening the playlist in
      // the Spotify app beats asking the user to retry.
      if (r !== 'restricted' && !(r === 'error' && linked)) return { result: r, platform: 'spotify' };
    }

    if (linked) {
      const ok = await openInSpotify(linked.uri);
      return { result: ok ? 'handoff' : 'error', platform: 'spotify' };
    }
    // Restricted with nothing linked: explain how to still get music.
    if (connected) return { result: 'restricted', platform: 'spotify' };

    // No API and nothing linked. If they picked a service we can take links
    // for, say so; if they skipped that question — or chose one we can't
    // accept links for yet — stay quiet, because demo mode is a fair default
    // and a notice we can't act on is just nagging.
    const preferred = handoffPlatformOf(await getSavedPlatform());
    if (preferred) return { result: 'link-needed', platform: preferred };
    return null;
  } catch {
    return null; // never let a playback hiccup break the drive
  }
}

/**
 * Plain-words translation of a start attempt, shown over the player.
 *
 * Anything a non-Spotify listener can actually hit is worded from their app's
 * name; the rest are Spotify API states that only arise on the Spotify path.
 */
function noticeFor(result: DriveStartResult, platform: HandoffPlatform | null): string | null {
  const app = HANDOFF_APP_NAME[platform ?? 'spotify'];
  switch (result) {
    case 'playing':
      return null;
    case 'handoff':
      return `Playlist sent to ${app} — press play there, then come back. Your drive keeps rolling here.`;
    case 'link-needed':
      return `No playlist linked to this station yet. In ${app}: open a playlist → Share → Copy Link, then paste it here and Start Drive will open it for you.`;
    case 'error':
      return `${app} didn't respond. Check the ${app} app is open and logged in, then press play to retry.`;
    case 'no-device':
      return "Spotify isn't awake. Open Spotify, play any song for a second, then come back and press play.";
    case 'premium-required':
      return 'Spotify needs a Premium account to let Cruise FM control playback.';
    case 'restricted':
      return 'This Spotify account isn’t on the Cruise FM test list, so in-app control is off. Link a playlist to this station (paste a Spotify link) and drives will play through the Spotify app instead.';
    default:
      return null;
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
  /** Bumps whenever the user touches a playback control — the
   * "Are you driving?" check watches this for signs of life. */
  activityTick: number;
  activityPing: () => void;
  /** Why the last start attempt made no sound, in plain words (null = fine). */
  playbackNotice: string | null;
  clearPlaybackNotice: () => void;
  /** Feed a fresh start attempt's outcome into the notice. Platform decides
   * which music app the wording names; omit it for the Spotify path. */
  reportStartResult: (result: DriveStartResult, platform?: HandoffPlatform | null) => void;
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
  const reportStartResult = useCallback((result: DriveStartResult, platform: HandoffPlatform | null = null) => {
    setPlaybackNotice(noticeFor(result, platform));
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
      playStationMusic(stationId).then((o) => { if (o) reportStartResult(o.result, o.platform); });
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
    playStationMusic(stationId, { onlyIfLinked: true }).then((o) => { if (o) reportStartResult(o.result, o.platform); });
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
export function useStartResultReporter(): (result: DriveStartResult, platform?: HandoffPlatform | null) => void {
  return useContext(Ctx)?.reportStartResult ?? noopPing;
}
