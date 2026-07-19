import { Linking, Platform } from 'react-native';

/**
 * The no-API Spotify path. Two jobs:
 *
 * 1. Parse a pasted playlist link (Spotify → Share → Copy link) into a
 *    canonical spotify:playlist:ID uri — how non-allowlisted users link
 *    playlists to stations without the Web API.
 * 2. Hand a playlist to the Spotify app via deep link — how their drives
 *    get music. Needs no auth, no allowlist, no permission from anyone.
 */

/** Accepts share links and raw uris; returns a canonical uri, or null. */
export function parseSpotifyPlaylistLink(text: string): string | null {
  const t = text.trim();
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
  const web = t.match(/open\.spotify\.com\/(?:[a-z-]+\/)?playlist\/([A-Za-z0-9]+)/i);
  if (web) return `spotify:playlist:${web[1]}`;
  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uri = t.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
  if (uri) return `spotify:playlist:${uri[1]}`;
  return null;
}

/** spotify:playlist:ID → https://open.spotify.com/playlist/ID */
function webUrlFor(uri: string): string | null {
  const m = uri.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
  return m ? `https://open.spotify.com/playlist/${m[1]}` : null;
}

/**
 * Open the playlist in the Spotify app (falls back to the web player when
 * the app isn't installed). Resolves true if something opened.
 *
 * Native apps take the spotify: scheme directly; browsers (iOS Safari
 * especially) often swallow raw schemes, so the web build leads with the
 * https universal link — which opens the app when installed anyway.
 */
export async function openInSpotify(uri: string): Promise<boolean> {
  const web = webUrlFor(uri);
  const order = Platform.OS === 'web' ? [web, uri] : [uri, web];
  for (const url of order) {
    if (!url) continue;
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try the next flavour
    }
  }
  return false;
}
