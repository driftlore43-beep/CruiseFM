import { useState } from 'react';
import { NativeModules } from 'react-native';

import type { NowPlaying, RepeatMode } from './useSpotifyPlayback';

/**
 * Apple Music playback — the second seat at the table useMusicPlayback
 * switches between.
 *
 * CURRENT STATE: a structured stub. The real thing needs a native MusicKit
 * module, which can only ship in a fresh build (never OTA) — so the JS side
 * is built first against this exact surface, and the native module drops in
 * underneath without touching any caller. Until the module exists in the
 * installed binary, `available` is false and the switchboard never selects
 * this implementation, so shipping this file over the air changes nothing.
 *
 * The native bridge, when it lands, registers as NativeModules.CruiseMusicKit
 * with: requestAuthorization(), currentEntry(), play(), pause(), next(),
 * previous(), seekTo(ms), setShuffle(bool), setRepeat(mode),
 * playPlaylist(id), userPlaylists().
 */

const Bridge: unknown = (NativeModules as Record<string, unknown>)?.CruiseMusicKit ?? null;

/** True only in builds that carry the native MusicKit module. */
export function appleMusicAvailable(): boolean {
  return Bridge != null;
}

export function useAppleMusicPlayback(_visible: boolean, _opts?: { pollMs?: number }) {
  // State hooks exist so the real implementation slots in without changing
  // the hook's call order — rules of hooks make retrofitting state painful.
  const [connected] = useState(false);
  const [track] = useState<NowPlaying | null>(null);
  const [shuffleOn] = useState(false);
  const [repeatMode] = useState<RepeatMode>('off');
  const [contextName] = useState<string | null>(null);

  return {
    available: appleMusicAvailable(),
    connected,
    track,
    contextName,
    shuffleOn,
    repeatMode,
    play: () => {},
    pause: () => {},
    next: () => {},
    prev: () => {},
    shuffle: (_state: boolean) => {},
    repeat: (_mode: RepeatMode) => {},
  };
}
