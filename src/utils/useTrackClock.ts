import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

import type { NowPlaying } from './useSpotifyPlayback';

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

  useEffect(() => {
    if (!visible) { anim.current?.stop(); return; }
    if (track?.progressMs != null) {
      // Real position, plus however long ago we asked.
      const base = track.progressMs + (playing ? Date.now() - track.syncedAt : 0);
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

  return { progress, elapsedMs, durationMs };
}
