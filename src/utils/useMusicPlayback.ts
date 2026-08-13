import { useEffect, useState } from 'react';

import { noteTrackHeard } from './driveStats';

import { getSavedPlatform, type PlatformId } from './musicPlatform';
import { appleMusicAvailable } from './appleMusic';
import { useAppleMusicPlayback } from './useAppleMusicPlayback';
import { useSpotifyPlayback } from './useSpotifyPlayback';

export type { NowPlaying, RepeatMode } from './useSpotifyPlayback';

/**
 * The music switchboard.
 *
 * Every mode and the home page talk to playback through THIS hook, not to
 * any one service — Spotify and Apple Music are implementations behind it,
 * chosen by the platform the user picked. (Many call sites still name their
 * local variable `spotify` — historic, from when Spotify was the only seat.)
 *
 * Both implementations are real hooks and both are always CALLED (rules of
 * hooks forbid a conditional call) — but only the selected one is ever made
 * ACTIVE, and that distinction is the whole point.
 *
 * THE BUG THAT TAUGHT IT (owner's screen recording, 04.08, on a Spotify
 * drive after using Apple Music): this used to hand `visible` to both, and
 * the note here claimed the loser "idles cheaply". It does not. Each hook
 * polls its own service and calls `adoptPlayState` to mirror reality — so
 * both were writing the shared play state from different services at once.
 * Spotify said playing, Apple's leftover queue said paused, and the app
 * flip-flopped: play/pause alternating and the clock jumping backwards
 * (0:09 → 0:06 → 0:10 → 0:13 → 0:10 in eight seconds), which dragged the
 * mode's animation with it.
 *
 * Passing `visible && selected` gates the poll, the adopt and the AppState
 * listener in one move, because every one of them is keyed on that flag.
 * Until the saved platform loads, Spotify is active — the historic default.
 */
export function useMusicPlayback(visible: boolean, opts?: { pollMs?: number }) {
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    getSavedPlatform().then((p) => { if (live) setPlatform(p); });
    return () => { live = false; };
  }, [visible]);

  const useApple = platform === 'appleMusic' && appleMusicAvailable();
  const spotify = useSpotifyPlayback(visible && !useApple, opts);
  const apple = useAppleMusicPlayback(visible && useApple, opts);

  const live = useApple ? apple : spotify;

  // THE DRIVE REMEMBERS WHAT IT PLAYED. Recorded here rather than in either
  // player, because this is the one seat every screen already sits in — and
  // several of them mount it at once, which is why noteTrackHeard dedupes
  // against the last song rather than trusting a single caller. It no-ops
  // entirely when no drive is open, and in companion mode there is no track
  // to record, which is exactly why the stub has to read well without one.
  const heard = live.track ? `${live.track.title}\u0000${live.track.artist}` : null;
  useEffect(() => {
    if (!live.track?.title) return;
    noteTrackHeard(live.track.title, live.track.artist ?? '').catch(() => {});
  }, [heard]);

  return useApple ? { ...apple, platform } : { ...spotify, platform };
}
