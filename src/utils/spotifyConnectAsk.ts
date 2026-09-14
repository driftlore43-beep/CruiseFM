import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruisefm_spotify_connect_asked';

/**
 * HAVE WE ALREADY ASKED THIS LISTENER TO CONNECT SPOTIFY?
 *
 * WHY IT EXISTS. Choosing Spotify in the picker does not sign you in — the
 * connection is a separate, per-device thing — so a listener can be on the
 * Spotify platform with no token at all. Until now, pressing Start in that
 * state fell straight through to the hand-off: Cruise FM deep-linked the
 * playlist into the Spotify app, which, if that app is not signed in either,
 * opens on ITS sign-in screen. Owner, 14.09, on a fresh iPad: "when I clicked
 * on the station card it opened to Spotify with needing to sign in." From the
 * outside the app simply threw her out to a different app's login.
 *
 * THE HAND-OFF IS STILL RIGHT FOR MOST PEOPLE, which is why this is a
 * one-time ask rather than a block. Spotify only grants in-app control to five
 * invited accounts; everyone else CANNOT connect however many times they try,
 * and for them opening the playlist in Spotify is not a failure, it is the
 * product. Refusing to hand off until they had connected would strand them.
 *
 * AND THE OBVIOUS TEST FOR "THEY CANNOT CONNECT" DOES NOT WORK. A
 * non-allowlisted account is refused by Spotify's OWN sign-in page before any
 * token exists, so `isRestrictedAccount` — which is set by a 403 from an API
 * call we make WITH a token — is never set for them at all. There is no flag
 * that says "this person is not invited", so the app cannot know in advance.
 *
 * SO IT ASKS ONCE AND THEN STOPS. The first Start on a Spotify platform with
 * no connection explains what is missing and offers the connection; every
 * Start after that hands off exactly as before. Somebody invited connects and
 * gets full control; somebody not invited loses one tap, once, ever.
 *
 * Reading it does NOT consume it — `markSpotifyConnectAsked` does that, called
 * only on the path that actually shows the message. A flag spent by a check
 * is a flag that can be spent by something nobody saw.
 */
export async function spotifyConnectAsked(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Storage unreadable: treat as already asked, so the hand-off still works
    // rather than a broken read costing someone their music.
    return true;
  }
}

export async function markSpotifyConnectAsked(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* best effort */ }
}

/** Connecting successfully clears it, so a later disconnect asks again. */
export async function clearSpotifyConnectAsked(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* best effort */ }
}
