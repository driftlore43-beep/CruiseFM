import { useEffect, useState } from 'react';

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

  return useApple ? { ...apple, platform } : { ...spotify, platform };
}
