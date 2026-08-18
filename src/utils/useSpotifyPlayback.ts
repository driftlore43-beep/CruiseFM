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


/**
 * The next repeat setting when the button is pressed: off → the playlist →
 * this song → off.
 *
 * IT USED TO BE A TWO-STATE BUTTON OVER A THREE-STATE FEATURE, and that is
 * why repeat did not work on a station's playlist (owner, 18.08). Every mode
 * sent `'track'`, so the only repeat you could reach was repeat-ONE — which on
 * a station whose whole point is its playlist means the playlist stops. And
 * the button flattened Spotify's three states into a boolean, so a player
 * genuinely set to repeat the playlist showed the repeat-one icon, and there
 * was no press that could get back to it.
 *
 * Repeating the PLAYLIST comes first because it is the one people mean.
 */
export function nextRepeat(mode: RepeatMode): RepeatMode {
  return mode === 'off' ? 'context' : mode === 'context' ? 'track' : 'off';
}

/** A setting we have asked for and not yet seen confirmed. */
export type PendingToggle<T> = { want: T; until: number } | null;

/** How long we hold a pressed toggle against the player's own reading. Long
 *  enough for Spotify to catch up, short enough to give in quickly. */
export const TOGGLE_GUARD_MS = 6000;

/**
 * Should the player's reported setting be believed, or is it older than the
 * button press it contradicts?
 *
 * Pressing shuffle flips the button and sends the command, and the chase
 * re-polls 220ms later — long before Spotify has necessarily applied it. That
 * reading carries the OLD setting, and believing it drops the button straight
 * back, so from the outside the button simply does not take. Same shape as the
 * seek that sprang back (10.08), same answer: disbelieve a reading that
 * disagrees until one AGREES, or until the guard expires — so a command that
 * genuinely failed cannot leave the button lying for the rest of the drive.
 *
 * Pure and exported because it decides whether a control tells the truth.
 */
export function acceptReported<T>(pending: PendingToggle<T>, reported: T, now: number): boolean {
  if (!pending) return true;                 // nothing outstanding
  if (reported === pending.want) return true; // it landed
  return now > pending.until;                 // gave up waiting
}

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
        // Keep the shuffle/repeat buttons honest with Spotify's real state —
        // but not with a reading that predates the button being pressed. See
        // pendingToggleRef.
        if (data) {
          const sh = !!data.shuffle_state;
          if (settled(pendingShuffleRef, sh)) setShuffleOn(sh);
          const rp = data.repeat_state as RepeatMode | undefined;
          if (rp && settled(pendingRepeatRef, rp)) setRepeatMode(rp);
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
      if (!now) { inFront = false; stopPoll(); return; }
      // IN FRONT. Restart when we were away — and ALSO whenever the poll is
      // simply not running, whatever killed it. The first version of this
      // returned early on every non-transition, which quietly removed a
      // safety net the old code had: any foreground event used to revive a
      // dead poll. That matters more than the network call it saves, because
      // the deck extrapolates between polls — with no updates arriving, the
      // progress bar sails on toward the end of the song while the music
      // itself sits still, which is exactly what the owner saw mid-drive.
      const wasAway = !inFront;
      inFront = true;
      if (wasAway || pollRef.current == null) { refreshRef.current(); startPoll(); }
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
  /**
   * A shuffle or repeat change we have asked for but not yet seen confirmed.
   *
   * WHY IT EXISTS (owner, 18.08: "make sure the shuffle and the repeat buttons
   * work"). Pressing one flips the button at once and sends the command — and
   * `after()` then re-polls at 220ms, long before Spotify has necessarily
   * applied it. That poll reports the OLD setting, the poll is believed, and
   * the button drops back. From the outside the button simply does not take.
   *
   * It is the same shape as the seek that sprang back (10.08) and it has the
   * same answer: hold what we asked for, and disbelieve any reading that
   * disagrees until one AGREES — or until the guard expires, so a command that
   * genuinely failed cannot leave the button lying for the rest of the drive.
   */
  const pendingShuffleRef = useRef<PendingToggle<boolean>>(null);
  const pendingRepeatRef = useRef<PendingToggle<RepeatMode>>(null);
  const settled = <T,>(ref: { current: PendingToggle<T> }, reported: T): boolean => {
    const ok = acceptReported(ref.current, reported, Date.now());
    if (ok) ref.current = null;
    return ok;
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
    /**
     * Optimistic local flip, held against stale polls (see pendingShuffleRef),
     * and TAKEN BACK if Spotify actually refuses.
     *
     * spotifyFetch folds every failure into null — no active device, a
     * restriction on the current context, a timeout — and swallowing that left
     * the button showing a setting the music was not using. Now the button
     * returns to where it was, which at least tells the truth about what
     * happened.
     */
    shuffle: (state: boolean) => {
      ping();
      const was = shuffleOn;
      setShuffleOn(state);
      // Nobody connected a service, so there is nothing to command and nothing
      // that can refuse — the flip is the whole of it, exactly as before. Only
      // a real connection makes a promise worth taking back.
      if (!connected) return;
      pendingShuffleRef.current = { want: state, until: Date.now() + TOGGLE_GUARD_MS };
      spotifySetShuffle(state)
        .then((ok) => { if (!ok) { pendingShuffleRef.current = null; setShuffleOn(was); } })
        .catch(() => { pendingShuffleRef.current = null; setShuffleOn(was); });
      after();
    },
    repeat: (mode: RepeatMode) => {
      ping();
      const was = repeatMode;
      setRepeatMode(mode);
      // Nobody connected a service, so there is nothing to command and nothing
      // that can refuse — the flip is the whole of it, exactly as before. Only
      // a real connection makes a promise worth taking back.
      if (!connected) return;
      pendingRepeatRef.current = { want: mode, until: Date.now() + TOGGLE_GUARD_MS };
      spotifySetRepeat(mode)
        .then((ok) => { if (!ok) { pendingRepeatRef.current = null; setRepeatMode(was); } })
        .catch(() => { pendingRepeatRef.current = null; setRepeatMode(was); });
      after();
    },
  };
}
