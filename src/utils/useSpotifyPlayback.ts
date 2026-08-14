import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isInFront } from '@/utils/useAppActive';

import { useActivityPing, useAdoptPlayState, useStartResultReporter, useWakeNudge } from '@/context/NowPlayingContext';

import {
  isSpotifyConnected,
  probePlaybackState,
  getPlaylistName,
  pause as spotifyPause,
  startPlayback,
  skipNext,
  skipPrev,
  seekTo,
  setShuffle as spotifySetShuffle,
  setRepeat as spotifySetRepeat,
} from './spotify';

/**
 * How far into a song the back button stops meaning "previous".
 *
 * Owner, 13.08: "the back button should restart the song not go back to the
 * previous song. Press it back twice and then it plays to the previous song."
 * That is what every music player does, and three seconds is the convention —
 * long enough that a deliberate double-tap always reaches the previous track
 * (the first press puts the position at 0, so the second is inside the window),
 * short enough that pressing back in the opening bars still goes back.
 *
 * IT ONLY APPLIES WHEN THERE IS A REAL POSITION TO RETURN TO. With no live
 * track — companion mode, which is most listeners — there is nothing to
 * restart, so the button keeps its plain meaning.
 */
export const RESTART_WINDOW_MS = 3000;

/** Where the song actually is right now, running the clock forward from the
 *  last reading the service gave us. */
export function elapsedMs(
  t: { progressMs: number | null; syncedAt: number; isPlaying?: boolean } | null,
  now: number = Date.now(),
): number | null {
  if (!t || t.progressMs == null) return null;
  return t.progressMs + (t.isPlaying === false ? 0 : now - t.syncedAt);
}

/**
 * What the back button should do, given where the song is. Pulled out as a
 * plain function so it can be tested without a player — see
 * scripts/test-back-button.mjs.
 */
export function backButtonAction(
  t: { progressMs: number | null; syncedAt: number; isPlaying?: boolean } | null,
  now: number = Date.now(),
): 'restart' | 'previous' {
  const at = elapsedMs(t, now);
  return at != null && at > RESTART_WINDOW_MS ? 'restart' : 'previous';
}

export type RepeatMode = 'off' | 'context' | 'track';

export type NowPlaying = {
  title: string;
  artist: string;
  /** Spotify track uri — lets the in-drive song list mark the current row. */
  uri?: string | null;
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
  // The playlist actually feeding the music, so the in-drive song list can
  // show what is playing rather than whatever is merely linked to the station.
  const [contextUri, setContextUri] = useState<string | null>(null);
  const lastCtxUriRef = useRef<string | null | undefined>(undefined);
  const cancelledRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  // What Spotify last reported about actual playback — the play button's
  // "did sound really start?" check reads this after a resume attempt.
  const isPlayingRef = useRef<boolean | null>(null);
  // When the user last pressed a control — recent presses win over the poll
  // so an optimistic tap isn't fought by slightly-stale server state.
  const lastControlRef = useRef(0);
  // Consecutive polls where Spotify said nothing is playing. See refresh().
  const idleStreakRef = useRef(0);
  // Mirror of `track`, readable inside callbacks without re-creating them.
  const trackRef = useRef<NowPlaying | null>(null);
  const adoptPlay = useAdoptPlayState();
  const adoptRef = useRef(adoptPlay);
  adoptRef.current = adoptPlay;

  // The poll is owned by a ref rather than a local, because it has to be
  // stopped and restarted by the AppState listener below as well as by this
  // effect's own cleanup.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const startPoll = () => {
    stopPoll();
    // Battery: callers showing less detail (the mini-player) poll slower —
    // every network wake costs radio time.
    pollRef.current = setInterval(() => refreshRef.current(), opts?.pollMs ?? 5000);
  };

  useEffect(() => {
    if (!visible) return;
    cancelledRef.current = false;

    (async () => {
      const conn = await isSpotifyConnected();
      if (cancelledRef.current) return;
      setConnected(conn);
      if (!conn) return;

      const refresh = async () => {
        const probe = await probePlaybackState();
        if (cancelledRef.current) return;

        // Spotify answered and has nothing playing — it was force-quit, or the
        // device dropped off Connect. Stop the drive rather than animating over
        // silence. TWO IN A ROW is required because Spotify briefly returns
        // this during ordinary handovers (a track change, moving between
        // devices), and one blip must not pause a working drive. At a 5s poll
        // that settles within about ten seconds.
        if (probe.kind === 'idle') {
          idleStreakRef.current += 1;
          if (idleStreakRef.current >= 2 && Date.now() - lastControlRef.current > 8000) {
            isPlayingRef.current = false;
            adoptRef.current(false);
            setTrack((t) => (t ? { ...t, isPlaying: false } : t));
            clearChase();
          } else if (idleStreakRef.current === 1) {
            // Confirm QUICKLY rather than waiting for the next 5s poll. Two
            // answers are still required — one blip must not pause a working
            // drive — but the second is asked 900ms later, so a closed Spotify
            // settles in about a second instead of ten (owner, 10.08: "response
            // is a bit slow to pause").
            clearChase();
            chaseRef.current = [setTimeout(() => refreshRef.current(), 900)];
          }
          return;
        }
        idleStreakRef.current = 0;
        // 'unknown' means no usable answer — a timeout, offline, a 403. Say
        // nothing and let the drive carry on, which is what the old code did
        // for every outcome including this one.
        if (probe.kind !== 'state') return;

        const data = probe.data;
        const item = data?.item;
        if (data) isPlayingRef.current = data.is_playing ?? null;
        // Mirror reality: if Spotify pauses on its own (car Bluetooth off,
        // pause from another device) the drive pauses too — and resumes when
        // music starts again elsewhere. Recent user taps win for 8s.
        if (typeof data?.is_playing === 'boolean' && Date.now() - lastControlRef.current > 8000) {
          adoptRef.current(data.is_playing);
        }
        if (item?.name) {
          // The chase is over the moment the track actually changes — usually
          // the first or second check, so the later ones are rarely spent.
          if (chaseFromRef.current !== null && (item.uri ?? null) !== chaseFromRef.current) {
            clearChase();
          }
          trackRef.current = {
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
            uri: item.uri ?? null,
            albumArt: item.album?.images?.[1]?.url ?? item.album?.images?.[0]?.url ?? null,
            durationMs: item.duration_ms ?? null,
            progressMs: data.progress_ms ?? null,
            syncedAt: Date.now(),
            isPlaying: data.is_playing ?? true,
          };
          setTrack({
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
            // Spotify sorts images largest-first; [1] (~300px) suits the label.
            uri: item.uri ?? null,
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
          setContextUri(ctxUri);
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
      if (isInFront(AppState.currentState)) startPoll();
    })();

    return () => {
      cancelledRef.current = true;
      stopPoll();
      clearChase();
    };
  }, [visible]);

  /**
   * The poll runs ONLY while the app is in front of the user.
   *
   * This is a crash fix, not a battery tweak. iOS expects a backgrounded app
   * to fall silent within a few seconds; one that keeps a five-second network
   * timer running gets SIGKILLed, which is what produced the run of
   * `bug_type 309` terminations after leaving and re-entering the app. The
   * process is shot rather than allowed to fail, so Sentry never sees it.
   *
   * Coming back also asks Spotify where things stand straight away instead of
   * waiting out the interval, so the title, progress and play state snap into
   * step before the user notices. It never triggers a start attempt or the
   * wake note; music already flowing is left completely alone.
   */
  useEffect(() => {
    if (!visible) return;
    // isInFront, NOT `=== 'active'`: a pulled-down Notification Centre reports
    // `inactive` with the app still on screen, and stopping the poll there
    // froze the readout in plain view (owner, 14.08). See useAppActive.
    //
    // Acting on the TRANSITION rather than on every event: active → inactive →
    // active fires twice and both are "in front", so a plain check would spend
    // a network call on every banner that appears.
    let inFront = isInFront(AppState.currentState);
    const sub = AppState.addEventListener('change', (state) => {
      const now = isInFront(state);
      if (now === inFront) return;
      inFront = now;
      if (now) { refreshRef.current(); startPoll(); }
      else stopPoll();
    });
    return () => sub.remove();
  }, [visible]);

  // Fire-and-forget controls; refresh shortly after so the title catches up.
  // Each one is also a sign of life for the "Are you driving?" check, and
  // play doubles as a retry that reports Spotify's verdict to the notice.
  const ping = useActivityPing();
  const report = useStartResultReporter();
  const wakeNudge = useWakeNudge();
  /**
   * Chase the truth after a transport command.
   *
   * This used to be a SINGLE refresh at 700ms, and that is why skip felt slow.
   * Spotify's API is eventually consistent: ask it what is playing right after
   * a skip and it very often still reports the previous track. Miss that one
   * chance and nothing corrects the screen until the ordinary 5s poll comes
   * round — so the title and artwork could sit wrong for five seconds after a
   * press that had already worked (owner, 10.08).
   *
   * So it is a short burst instead, front-loaded because most commands land
   * almost immediately, and it STOPS EARLY the moment the thing we were
   * waiting for actually changes — which is usually after the first or second
   * check, so the extra requests are rarely spent.
   */
  const CHASE_MS = [220, 600, 1300, 2400, 3600];
  const chaseRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** What was playing when the command was sent; the chase ends when it moves. */
  const chaseFromRef = useRef<string | null>(null);
  const clearChase = () => {
    chaseRef.current.forEach(clearTimeout);
    chaseRef.current = [];
    chaseFromRef.current = null;
  };
  const after = (watchTrack = false) => {
    clearChase();
    chaseFromRef.current = watchTrack ? (trackRef.current?.uri ?? null) : null;
    chaseRef.current = CHASE_MS.map((ms) => setTimeout(() => refreshRef.current(), ms));
  };

  return {
    connected,
    track,
    contextName,
    contextUri,
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
    next: () => { ping(); lastControlRef.current = Date.now(); skipNext().catch(() => {}); after(true); },
    prev: () => {
      ping();
      lastControlRef.current = Date.now();
      if (backButtonAction(trackRef.current) === 'restart') {
        // Back to the top of this song. `after()` without watching the track,
        // because the track is not changing — the chase it starts is what makes
        // the progress bar snap to zero rather than drifting on until the next
        // five-second poll.
        seekTo(0).catch(() => {});
        after();
        return;
      }
      skipPrev().catch(() => {});
      after(true);
    },
    // Optimistic local flip; the API call + next poll settle the truth.
    shuffle: (state: boolean) => { ping(); setShuffleOn(state); spotifySetShuffle(state).catch(() => {}); after(); },
    repeat: (mode: RepeatMode) => { ping(); setRepeatMode(mode); spotifySetRepeat(mode).catch(() => {}); after(); },
  };
}
