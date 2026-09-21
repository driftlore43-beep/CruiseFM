import { Linking, Platform } from 'react-native';

/**
 * The Apple Music twin of spotifyHandoff. Same two jobs:
 *
 * 1. Parse a pasted playlist link (Apple Music → ⋯ → Share → Copy Link) into
 *    a canonical https://music.apple.com/… url.
 * 2. Hand that playlist to the Apple Music app via deep link — no auth, no
 *    developer token, no quota to ask anyone for.
 *
 * Unlike Spotify there is no API path behind this and no allowlist in front
 * of it: for an Apple Music listener the handoff IS the experience, not a
 * fallback. Cruise FM stays the visual layer.
 */

/**
 * Accepts share links and music:// uris; returns a canonical https url, or
 * null.
 *
 * What makes a link openable is the `pl.…` id — the country segment and the
 * human-readable slug are decoration. We still keep the path Apple gave us
 * (minus query junk) rather than rebuilding a tidier one, because a
 * reconstructed url without the slug doesn't reliably resolve.
 */
export function parseAppleMusicPlaylistLink(text: string): string | null {
  const m = text.trim().match(
    /(?:https?:\/\/|music:\/\/)?(music\.apple\.com\/(?:[a-z]{2}\/)?playlist\/[^\s?#]*?pl\.[A-Za-z0-9._-]+)/i,
  );
  return m ? `https://${m[1]}` : null;
}

/**
 * Open the playlist in the Apple Music app (falls back to the web player when
 * it isn't installed). Resolves true if something opened.
 *
 * Native leads with the music:// scheme, which goes straight to the app and
 * skips the browser bounce a universal link can take. The web build has only
 * the https url to offer.
 */
export async function openInAppleMusic(url: string): Promise<boolean> {
  const scheme = url.replace(/^https:\/\//i, 'music://');
  const order = Platform.OS === 'web' ? [url] : [scheme, url];
  for (const u of order) {
    try {
      await Linking.openURL(u);
      return true;
    } catch {
      // try the next flavour
    }
  }
  return false;
}
