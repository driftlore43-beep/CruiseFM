/**
 * THE ENTITLEMENT, READABLE FROM OUTSIDE REACT.
 *
 * `useEntitlements()` is a hook, and the widget snapshot is built by a plain
 * module that can be called from a drive start, an AppState change or a song
 * change — none of which has a component to read a context from. This is the
 * same arrangement `cachedSessionKind()` already uses for the driving /
 * listening answer, and for the same reason.
 *
 * WHAT IT IS FOR, and the limit that matters: the widgets need to know
 * whether to mark a station as premium in the station picker. It is a
 * PRESENTATION fact, not a lock — nothing anywhere is gated on this value,
 * and it must never be, because a cache written by a React provider is
 * exactly the wrong place to enforce a paywall. The real gate is
 * `NowPlayingContext.open`, which reads the live entitlement.
 *
 * DEFAULTS TO TRUE — i.e. "no padlocks" — because that is the state it will
 * be in for the first frames of a cold start, before the provider has
 * resolved anything, and a widget that briefly draws padlocks on a paying
 * customer's own stations is worse than one that briefly draws none.
 */
let cached = true;

/** Called by EntitlementsProvider whenever the answer changes. */
export function setCachedIsPro(v: boolean): void {
  cached = v;
}

/** The last known entitlement. Presentation only — never gate on this. */
export function cachedIsPro(): boolean {
  return cached;
}
