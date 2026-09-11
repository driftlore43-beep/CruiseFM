import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { appleMusicAvailable, appleSeekTo } from './appleMusic';
import { getSavedPlatform } from './musicPlatform';
import { seekTo } from './spotify';

/**
 * Seek whichever platform is actually playing.
 *
 * This module used to call Spotify's seek directly, so on Apple Music the
 * record and the disc turned under the finger and the song never moved
 * (owner, 04.08) — the gesture worked, the seek went to an app that wasn't
 * playing. The platform is read once and cached: a seek fires on release and
 * must not wait on storage.
 */
let cachedPlatform: string | null = null;
getSavedPlatform().then((p) => { cachedPlatform = p; }).catch(() => {});

export function seekActive(ms: number): void {
  // THE RE-READ HAPPENS ON BOTH BRANCHES, and it has to. It used to sit after
  // the Apple branch's `return`, so the cache was only ever refreshed by a
  // Spotify seek — meaning a listener who chose Apple Music and later switched
  // to Spotify kept seeking Apple Music for the rest of the session. Same
  // symptom as the 04.08 bug this function was written to fix (the record
  // turns, the bar moves, the song does not), reached from the other side.
  //
  // Fired first and NOT awaited: a seek happens on release and cannot wait on
  // storage, so this scrub uses the cache it has and the next one is correct.
  getSavedPlatform().then((p) => { cachedPlatform = p; }).catch(() => {});
  if (appleMusicAvailable() && cachedPlatform === 'appleMusic') {
    appleSeekTo(ms).catch(() => {});
    return;
  }
  seekTo(ms).catch(() => {});
}
import type { NowPlaying } from './useMusicPlayback';

/** Drag-to-seek hooks a progress bar can call: freeze on grab, follow the
 * finger, then seek the real song (and restart the clock) on release. */
export type ScrubApi = {
  begin: () => void;
  move: (pct: number) => void;
  end: (pct: number) => void;
};

/**
 * The shared progress clock behind every mode's progress bar.
 *
 * With Spotify connected it follows the REAL song: length comes from the
 * track, and the bar re-syncs to Spotify's reported position on every poll
 * (~5s) and right after skips, so it can't drift far or show the wrong
 * duration. Without Spotify it falls back to the classic demo loop.
 */
/**
 * How far the clock will run ahead of the last thing Spotify actually told us.
 *
 * The bar is animated from a known position to the END of the song, and only a
 * poll restarts it. That is invisible while polls arrive every five seconds —
 * and a lie the moment they stop. If the network drops, or the song is paused
 * somewhere we cannot see, the bar keeps travelling while the music sits still.
 * The owner watched it happen mid-drive: "it was moving the scrub but not the
 * actual song".
 *
 * So one reading buys a bounded amount of coasting, not the rest of the track.
 * Six missed polls is a real outage rather than a hiccup, and half a minute is
 * a small enough error to be honest about. Past that the bar HOLDS rather than
 * inventing a position — the same rule as the rest of the app: state what is
 * known, and stop where knowledge stops.
 */
const MAX_COAST_MS = 30000;

/**
 * AND HOW LONG WE KEEP COASTING IN THE DARK — because the cap above, on its
 * own, was wrong, and the owner caught it: "sometimes the time at the start
 * stays on 1:19 even when I scrub the bar."
 *
 * MEASURED (18.08, web build, a stubbed service told to go quiet mid-song):
 * the signal drops at 0:41, the bar coasts its 30 seconds to 1:12, and then
 * FREEZES THERE FOR THE REST OF THE DRIVE while the music plays on. Nothing
 * restarts it, because the only thing that ever did was a fresh reading.
 *
 * The mistake was treating one silence as though it were another. There are
 * two, and they mean opposite things:
 *
 *   the service SAID it stopped  — already handled, and properly: the clock
 *                                  refuses to run at all until `isPlaying`
 *                                  confirms, and the poll adopts a real pause
 *                                  after two idle answers.
 *   we could not REACH it        — a patchy signal, which on a drive is the
 *                                  normal case. Spotify's own app is still
 *                                  playing locally. Here the bar holding is a
 *                                  lie in the other direction, and a worse one,
 *                                  because the error grows without bound and
 *                                  reads as the app having died.
 *
 * So a coast now RE-ARMS while the last thing we heard was "playing" — the
 * 30-second chunk stays, because it costs nothing and any fresh reading still
 * lands immediately. What stops it is a genuinely long silence: past this, the
 * song has probably ended and moved on, and a bar walking through a track that
 * is no longer playing is worse than one that has plainly stopped. Thirty
 * missed polls is an outage, not a hiccup, and it is shorter than most songs,
 * so we hold before the bar can wrap onto a track we know nothing about.
 */
const MAX_SILENCE_MS = 150000;

/**
 * Keep going, or hold? Exported because everything it decides ends in the app
 * making a claim about where the song is, so the rule should be readable and
 * testable rather than buried in an animation callback.
 *
 * No reading at all means the demo bar, which has no service to lose touch
 * with — it simply runs.
 */
export function shouldKeepCoasting(now: number, lastReadingAt: number | null | undefined): boolean {
  if (lastReadingAt == null) return true;
  return now - lastReadingAt <= MAX_SILENCE_MS;
}

export function useTrackClock(opts: {
  visible: boolean;
  playing: boolean;
  track: NowPlaying | null;
  demoDurationMs?: number;
}) {
  const { visible, playing, track } = opts;
  const durationMs = track?.durationMs ?? opts.demoDurationMs ?? 214000;

  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const playingRef = useRef(playing);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  const durationRef = useRef(durationMs);
  useEffect(() => { durationRef.current = durationMs; }, [durationMs]);

  // Only commit state when the displayed second changes — otherwise every
  // animation frame re-renders the whole mode (and its blurred background).
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      const ms = value * durationRef.current;
      setElapsedMs((prev) => (Math.floor(ms / 1000) === Math.floor(prev / 1000) ? prev : ms));
    });
    return () => progress.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startFrom = (fromMs: number) => {
    anim.current?.stop();
    const dur = durationRef.current;
    const clamped = Math.max(0, Math.min(fromMs, dur));
    progress.setValue(dur > 0 ? clamped / dur : 0);
    const remaining = dur - clamped;
    if (remaining <= 0) { progress.setValue(0); return; }
    // Coast only as far as this one reading justifies — see MAX_COAST_MS. In
    // normal use a poll lands every five seconds and restarts this long before
    // the cap, so it is invisible.
    const span = Math.min(remaining, MAX_COAST_MS);
    const reachesEnd = span >= remaining;
    anim.current = Animated.timing(progress, {
      toValue: (clamped + span) / dur, duration: span, easing: Easing.linear, useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (!finished) return;
      if (reachesEnd) {
        // The track really ran out. Demo mode loops forever; with Spotify the
        // next poll re-syncs us onto the following song anyway.
        progress.setValue(0);
        if (playingRef.current) startFrom(0);
        return;
      }
      // Only the CAP was reached, which is not the track ending — wrapping to
      // 0 here would restart the bar while the song plays on. Carry on from
      // where we are, unless the service has been silent long enough that we
      // no longer believe our own position. See MAX_SILENCE_MS.
      if (!playingRef.current) return;
      if (!shouldKeepCoasting(Date.now(), trackRef.current?.syncedAt)) return;
      startFrom(clamped + span);
    });
  };

  const trackRef = useRef(track);
  useEffect(() => { trackRef.current = track; }, [track]);

  // Stable ref object: every captured function only touches refs, so the
  // first-render closures stay correct for the component's whole life.
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  /**
   * A scrub in progress, and the moments just after one.
   *
   * THE POLL USED TO WIN AND THIS IS WHY THE BAR SPRANG BACK. The effect below
   * re-syncs the clock every time Spotify reports a position, and Spotify is
   * eventually consistent — asked right after a seek it still returns where
   * the song WAS. So a successful seek was immediately overwritten by a stale
   * reading, and the bar snapped to where the finger started (owner, 10.08,
   * with a screen recording: the dot follows the drag, then jumps back on
   * release, twice).
   *
   * So while a finger is down the poll may not touch the clock at all, and
   * after a seek its readings are ignored until one of them AGREES with where
   * we asked to go — or until the guard times out, so a seek that genuinely
   * failed cannot freeze the bar forever.
   */
  const scrubbingRef = useRef(false);
  const seekTargetRef = useRef<number | null>(null);
  const seekUntilRef = useRef(0);
  /** How close a reported position has to be to count as "the seek landed". */
  const SEEK_TOLERANCE_MS = 2500;
  /** After this, believe the poll again whatever it says. */
  const SEEK_GUARD_MS = 6000;

  const scrub = useRef<ScrubApi>({
    begin: () => { scrubbingRef.current = true; anim.current?.stop(); },
    move: (pct: number) => { progress.setValue(clamp01(pct)); },
    end: (pct: number) => {
      const p = clamp01(pct);
      const ms = p * durationRef.current;
      scrubbingRef.current = false;
      // Real song → actually seek whichever platform is playing; the demo
      // bar just moves.
      if (trackRef.current?.durationMs != null) {
        seekActive(ms);
        seekTargetRef.current = ms;
        seekUntilRef.current = Date.now() + SEEK_GUARD_MS;
      }
      if (playingRef.current) startFrom(ms);
      else progress.setValue(p);
    },
  }).current;

  useEffect(() => {
    if (!visible) { anim.current?.stop(); return; }
    // A finger is on the bar: it owns the clock, nothing else may move it.
    if (scrubbingRef.current) return;
    if (track?.progressMs != null) {
      /**
       * IS IT REALLY PLAYING, or have we just asked?
       *
       * `playing` is OPTIMISTIC — the transport flips it the instant a thumb
       * lands, before the service has been asked, let alone answered. That is
       * right for the button (a control that waits feels broken) and wrong for
       * the clock, which makes a falsifiable claim about where in the song we
       * are.
       *
       * THE BUG IT CAUSED (owner, 11.08): press play, Spotify is asleep, so
       * the bar and the scene run ahead of silence. The listener, reasonably,
       * assumes something is wrong and presses pause — and the next poll
       * reports the position never moved, so the bar JUMPS BACK to where it
       * started. They then go to Spotify, press play there, and come back. The
       * app was wrong twice: it claimed to be playing, then took it back.
       *
       * `track.isPlaying` is the service's own verdict, so the clock waits for
       * it. In the ordinary case the chase poll answers in about 300ms and
       * nobody sees a thing; in the asleep case the bar simply never moves,
       * which is the truth and leaves nothing to rewind.
       */
      const confirmed = track.isPlaying !== false;
      // Real position, plus however long ago we asked — only extrapolate
      // forward if the music is genuinely running.
      const base = track.progressMs + (playing && confirmed ? Date.now() - track.syncedAt : 0);
      // Just seeked? Only believe a reading once it agrees with where we went.
      if (seekTargetRef.current != null) {
        if (Date.now() > seekUntilRef.current) {
          seekTargetRef.current = null;        // guard expired — trust the poll
        } else if (Math.abs(base - seekTargetRef.current) > SEEK_TOLERANCE_MS) {
          return;                              // stale: Spotify hasn't caught up
        } else {
          seekTargetRef.current = null;        // it landed; back to normal
        }
      }
      if (playing && confirmed) {
        startFrom(base);
      } else {
        // Paused, OR asked-but-not-yet-confirmed: park on the real position
        // and wait. Landing here after a play tap is the whole point — the
        // next poll either confirms and we start, or it never does and the
        // bar honestly never moved.
        anim.current?.stop();
        progress.setValue(durationRef.current > 0 ? Math.min(1, base / durationRef.current) : 0);
      }
    } else if (playing) {
      // Demo fallback: carry on from wherever the bar currently sits.
      startFrom((progress as any).__getValue() * durationRef.current);
    } else {
      anim.current?.stop();
    }
    return () => anim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // isPlaying is load-bearing in this list: it is the signal that turns a
    // held clock into a running one, so without it the bar would wait for the
    // next position change instead of starting the moment play is confirmed.
  }, [visible, playing, track?.isPlaying, track?.progressMs, track?.syncedAt, track?.title, durationMs]);

  return { progress, elapsedMs, durationMs, scrub };
}
