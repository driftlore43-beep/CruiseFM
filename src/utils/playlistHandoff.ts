import { openInAppleMusic, parseAppleMusicPlaylistLink } from './appleMusicHandoff';
import { openInSpotify, parseSpotifyPlaylistLink } from './spotifyHandoff';

/**
 * One door in front of the per-service handoffs, so callers (Start Drive, the
 * playlist sheet) never have to care which music app a station is linked to.
 */

/** The services a station playlist can be linked from. */
export type HandoffPlatform = 'spotify' | 'appleMusic';

export const HANDOFF_APP_NAME: Record<HandoffPlatform, string> = {
  spotify: 'Spotify',
  appleMusic: 'Apple Music',
};

/**
 * Which service a stored playlist uri belongs to.
 *
 * The uri format is the marker, so there's nothing extra to persist and
 * playlists linked before Apple Music support existed keep working untouched.
 */
export function platformOfUri(uri: string): HandoffPlatform | null {
  if (/^spotify:playlist:/i.test(uri)) return 'spotify';
  if (/music\.apple\.com/i.test(uri)) return 'appleMusic';
  return null;
}

/**
 * Parse a pasted link from any supported service. Whichever app the user
 * copied from wins — their saved platform preference doesn't gate this, so
 * pasting an Apple Music link works even for someone who picked Spotify.
 */
export function parsePlaylistLink(text: string): { uri: string; platform: HandoffPlatform } | null {
  const spotify = parseSpotifyPlaylistLink(text);
  if (spotify) return { uri: spotify, platform: 'spotify' };

  const apple = parseAppleMusicPlaylistLink(text);
  if (apple) return { uri: apple, platform: 'appleMusic' };

  return null;
}

/** Hand a linked playlist back to whichever app it came from. */
export async function openPlaylist(uri: string): Promise<boolean> {
  switch (platformOfUri(uri)) {
    case 'spotify':    return openInSpotify(uri);
    case 'appleMusic': return openInAppleMusic(uri);
    default:           return false;
  }
}
