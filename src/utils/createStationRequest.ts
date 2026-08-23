/**
 * "Make a station" asked for from somewhere that isn't the Stations page.
 *
 * The create sheet lives on the Stations page and only there — one home for
 * making and managing stations, rather than a second copy of a 600-line modal
 * mounted on the home screen. So the home page's invitations raise a flag and
 * send the driver to Stations, which opens the sheet on arrival.
 *
 * A MODULE FLAG RATHER THAN A ROUTE PARAM, deliberately. `router.push(
 * '/stations?create=1')` reads better but the param STICKS: navigate back to
 * Stations an hour later and the sheet opens again out of nowhere, unless
 * every consumer remembers to clear it. This cannot misfire twice — reading it
 * takes it.
 */
let pending = false;
/** A station the driver asked to EDIT from somewhere other than Stations. */
let pendingEdit: string | null = null;

/** Ask the Stations page to open the create sheet when it next appears. */
export function requestCreateStation(): void {
  pending = true;
}

/** True once, for the first caller after a request. */
export function consumeCreateRequest(): boolean {
  const was = pending;
  pending = false;
  return was;
}

/**
 * Ask the Stations page to open the EDIT sheet for this station.
 *
 * Same reasoning as the create request, and the same reason it is needed: the
 * sheet lives on the Stations page and only there, so the home shelf cannot
 * open it directly. Until now the home shelf simply did not offer editing at
 * all — a listener reported changing a station's colour as a missing feature
 * (23.08) when it existed, just not from where he was standing.
 */
export function requestEditStation(id: string): void {
  pendingEdit = id;
}

/** The station to edit, once. Reading it takes it. */
export function consumeEditRequest(): string | null {
  const was = pendingEdit;
  pendingEdit = null;
  return was;
}
