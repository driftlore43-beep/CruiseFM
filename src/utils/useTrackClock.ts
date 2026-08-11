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
  if (appleMusicAvailable() && cachedPlatform === 'appleMusic') {
    appleSeekTo(ms).catch(() => {});
    return;
  }
  seekTo(ms).catch(() => {});
  // Re-read in the background so a platform switch mid-session lands on the
  // next scrub rather than never.
  getSavedPlatform().then((p) => { cachedPlatform = p; }).catch(() => {});
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
    anim.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    anim.current.start(({ finished }) => {
      if (!finished) return;
      progress.setValue(0);
      // Demo mode loops forever; with Spotify the next poll re-syncs us onto
      // the following song anyway.
      if (playingRef.current) startFrom(0);
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
      // Real position, plus however long ago we asked.
      const base = track.progressMs + (playing ? Date.now() - track.syncedAt : 0);
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
      if (playing) {
        startFrom(base);
      } else {
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
  }, [visible, playing, track?.progressMs, track?.syncedAt, track?.title, durationMs]);

  return { progress, elapsedMs, durationMs, scrub };
}
