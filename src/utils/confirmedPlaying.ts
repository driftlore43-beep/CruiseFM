import type { NowPlaying } from '@/utils/useMusicPlayback';

/**
 * Is the music GENUINELY running, or have we merely asked?
 *
 * `playing` is optimistic. The transport flips it the instant a thumb lands —
 * before the service has been asked, let alone answered — and that is right
 * for a button, because a control that hesitates reads as broken. It is wrong
 * for anything that then acts as evidence that sound is coming out.
 *
 * THE CLIP THAT SETTLED IT (owner, 11.08, Vinyl over a sleeping Spotify).
 * Reading the elapsed time out of the frames: the TRUE position was 00:16 and
 * never moved, while the app's own clock climbed 01:41 → 01:49 beside it, and
 * the record turned the whole time. Her words, and they are the design brief:
 * "the moving animation misleads me, because the animation SHOULD produce
 * music."
 *
 * The cause of the run-ahead is worth knowing: the clock adds
 * `Date.now() - syncedAt` to the last known position whenever it believes it
 * is playing, so against a service that never actually started, the error
 * grows without bound — after 88 seconds it was a minute and a half out.
 *
 * So the scene now waits for the service's own verdict, exactly as the clock
 * does. Three things are folded in here rather than repeated in eight files:
 *
 *   - `playing` — we have asked for playback and not asked to stop.
 *   - `!switching` — a station change is in flight; the old song's state is
 *     meaningless until the new one reports.
 *   - the service's `isPlaying`, where ONLY an explicit false holds the scene.
 *
 * That last default is load-bearing and deliberate. A listener with no music
 * connection at all has no track, so `isPlaying` is undefined and the visuals
 * run exactly as before — companion mode is the whole point of the app for
 * anyone outside Spotify's tiny developer allowlist, and it must never be
 * gated on a verdict that can never arrive.
 */
export function confirmedPlaying(
  playing: boolean,
  track: NowPlaying | null | undefined,
  switching = false,
): boolean {
  return playing && !switching && (track?.isPlaying ?? true);
}
