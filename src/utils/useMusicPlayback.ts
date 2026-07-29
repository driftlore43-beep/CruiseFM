import { useEffect, useState } from 'react';

import { getSavedPlatform, type PlatformId } from './musicPlatform';
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
 * Both implementations are real hooks and both are always called (rules of
 * hooks: no conditional calls); the loser idles cheaply. Apple Music selects
 * itself only when the user chose it AND the installed build carries the
 * native MusicKit module — until then everyone lands on the Spotify path,
 * whose own `connected` flag handles the not-linked case, so behaviour is
 * byte-for-byte what it was before this seam existed.
 */
export function useMusicPlayback(visible: boolean, opts?: { pollMs?: number }) {
  const spotify = useSpotifyPlayback(visible, opts);
  const apple = useAppleMusicPlayback(visible, opts);

  const [platform, setPlatform] = useState<PlatformId | null>(null);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    getSavedPlatform().then((p) => { if (live) setPlatform(p); });
    return () => { live = false; };
  }, [visible]);

  if (platform === 'appleMusic' && apple.available) {
    return { ...apple, platform };
  }
  return { ...spotify, platform };
}
