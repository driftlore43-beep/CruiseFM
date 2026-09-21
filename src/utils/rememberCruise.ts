import { saveLastCruise, type LastCruise } from './lastCruise';
import { publishWidgetData } from './widgetData';

/**
 * REMEMBER A DRIVE, AND TELL THE WIDGETS.
 *
 * Five widgets draw their station from the remembered cruise — Start Drive,
 * On the Deck, The Mode's three looks and Last Played all read
 * `lastDrive ?? currentOnAir()` — and the snapshot they read is written by
 * the app. So saving the cruise and republishing the snapshot are two halves
 * of ONE action, and the day they were two separate calls at five different
 * call sites is the day one of them got forgotten.
 *
 * IT WAS. Before this existed, the snapshot was rewritten only when the app
 * was backgrounded or a NEW SONG was noticed, so a station changed inside the
 * app reached the Home Screen late (and never at all for a companion-mode
 * listener, who has no song to trigger it). Owner, 21.09: "all the 'on the
 * deck' 'start drive' and 'pick up where you left off' stay on sunset AM -
 * and it doesn't change."
 *
 * THE FIX LIVES HERE RATHER THAN IN `saveLastCruise` ITSELF, and that is
 * forced rather than chosen: widgetData.ts imports loadLastCruise, so
 * lastCruise.ts importing widgetData would close a circle. This module
 * imports both and neither imports it — the same shape the 17.09 round used
 * to keep widgetData and widgetArtwork apart.
 *
 * THE PUBLISH IS NOT AWAITED BY THE SAVE'S CALLERS' STANDARDS: it no-ops
 * without the native bridge, swallows its own failures, and a widget that is
 * briefly out of date is a far smaller problem than a drive that stutters
 * trying to update one.
 *
 * COST: one `reloadAllTimelines()` per station or mode change, which is a
 * deliberate human action a handful of times a day. Against iOS's per-widget
 * daily budget that is nothing next to the publish `useMusicPlayback` already
 * does on every new song.
 */
export async function rememberCruise(cruise: LastCruise): Promise<void> {
  await saveLastCruise(cruise);
  // REMEMBERING MUST NOT DEPEND ON THE WIDGETS. If the publish ever throws,
  // the cruise is still saved and the home hero still offers to resume it —
  // the tiles are simply a snapshot behind until the next AppState change.
  // The other way round would be a widget fault costing someone their place.
  await publishWidgetData().catch(() => {});
}
