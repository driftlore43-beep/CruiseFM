import { AppState } from 'react-native';

/**
 * When to send the listener to Spotify before playing, rather than after
 * failing.
 *
 * WHY (owner, 03.08): Spotify drops off Connect once its own app has been
 * paused in the background, so the first drive after opening Cruise FM
 * usually finds nothing to play on — "it becomes a game of opening, closing
 * and switching apps". Waiting for that attempt to fail and only then
 * deep-linking works, but it spends a few seconds looking broken first.
 * Opening the playlist up front wakes Spotify AND puts the right music in
 * front of them in one move.
 *
 * THE WHOLE DESIGN IS IN WHEN IT *DOESN'T* FIRE. A redirect on every play
 * would throw people out of the app mid-drive, which is the opposite of what
 * it is for. So it fires on exactly two signals, both meaning "Spotify has
 * probably dozed off":
 *
 *   1. the first play after a cold start — module state, so it resets itself;
 *   2. the first play after the app has been in the background a long while.
 *
 * Switching stations mid-drive is neither, so it stays out of the way there —
 * which matters, because that is when the music is definitely already awake.
 */

/** How long backgrounded before Spotify is assumed asleep again. */
const SLEEP_AFTER_MS = 15 * 60 * 1000;

let needsWake = true; // a cold start always counts as the first play
let leftAt: number | null = null;

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    if (leftAt != null && Date.now() - leftAt > SLEEP_AFTER_MS) needsWake = true;
    leftAt = null;
  } else if (leftAt == null) {
    leftAt = Date.now();
  }
});

/** True when the next play should open Spotify first. */
export function shouldWakeSpotify(): boolean {
  return needsWake;
}

/**
 * Called after ANY start attempt — the redirect itself, or a normal API
 * start. Either way Spotify has just been asked to play, so the next play in
 * this stretch of use should go straight through the API.
 */
export function markSpotifyWoken(): void {
  needsWake = false;
}
