import { useEffect, useRef, useState } from 'react';

import { useActivityPing } from '@/context/NowPlayingContext';

import {
  isSpotifyConnected,
  getCurrentTrack,
  pause as spotifyPause,
  startPlayback,
  skipNext,
  skipPrev,
} from './spotify';

export type NowPlaying = { title: string; artist: string };

/**
 * Live Spotify playback bridge for the visual modes.
 *
 * While `visible` and Spotify is connected, polls the current track every 5s
 * (plus right after a control is used) and exposes real play/pause/skip.
 * When Spotify isn't connected (e.g. web preview), everything no-ops and
 * `track` stays null so callers can fall back to their demo track names.
 */
export function useSpotifyPlayback(visible: boolean) {
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const cancelledRef = useRef(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!visible) return;
    cancelledRef.current = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const conn = await isSpotifyConnected();
      if (cancelledRef.current) return;
      setConnected(conn);
      if (!conn) return;

      const refresh = async () => {
        const data = await getCurrentTrack();
        if (cancelledRef.current) return;
        const item = data?.item;
        if (item?.name) {
          setTrack({
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
          });
        }
      };
      refreshRef.current = refresh;
      refresh();
      interval = setInterval(refresh, 5000);
    })();

    return () => {
      cancelledRef.current = true;
      if (interval) clearInterval(interval);
    };
  }, [visible]);

  // Fire-and-forget controls; refresh shortly after so the title catches up.
  // Each one is also a sign of life for the "Are you driving?" check.
  const ping = useActivityPing();
  const after = () => setTimeout(() => refreshRef.current(), 700);

  return {
    connected,
    track,
    play: () => { ping(); startPlayback().catch(() => {}); after(); },
    pause: () => { ping(); spotifyPause().catch(() => {}); after(); },
    next: () => { ping(); skipNext().catch(() => {}); after(); },
    prev: () => { ping(); skipPrev().catch(() => {}); after(); },
  };
}
