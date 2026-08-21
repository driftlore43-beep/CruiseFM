/**
 * A drive asked for from OUTSIDE the tabs — today that means a widget tap.
 *
 * WHY A FLAG AND NOT JUST `np.open()` AT THE LINK. The fullscreen deck is
 * rendered by `NowPlayingHost`, which is mounted in the TABS layout, not at
 * the root. A deep link is a root route, so when a tap cold-starts the app
 * straight into `/drive` the host does not exist yet: calling open() there
 * measured as a session that really started, with the right station, and no
 * deck on screen at all. Waiting a guessed number of milliseconds for the
 * tabs to mount would be the fragile version of this.
 *
 * So the link records WHAT was asked for and sends the driver to the home
 * tab, which is inside the tabs and therefore has the host; the home screen
 * consumes the request as it comes into focus. Same shape as
 * createStationRequest, and a module flag rather than a route param for the
 * same reason: a param STICKS, so returning to that screen an hour later
 * would start a drive out of nowhere. Reading this takes it, so it cannot
 * fire twice.
 */
export type DriveRequest = { stationId: string; mode: string };

let pending: DriveRequest | null = null;

/** Ask the home tab to start this drive as soon as it appears. */
export function requestDrive(req: DriveRequest): void {
  pending = req;
}

/** The pending drive, once, for the first caller after a request. */
export function consumeDriveRequest(): DriveRequest | null {
  const was = pending;
  pending = null;
  return was;
}
