import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * THE LAST SONG THE APP SAW PLAY — and why a widget may show it at all.
 *
 * A widget is redrawn a handful of times a day, at iOS's discretion. It can
 * therefore NEVER honestly say what is playing now: by the time anyone looks,
 * the song has usually changed, and a widget is read at a glance and believed.
 * That is the whole reason the widgets draw the station rather than the track.
 *
 * "Last played" escapes that entirely, and it is the owner's own idea (01.09):
 * it is a statement about the PAST, and the past does not go stale. A cover
 * sitting on the record under the words "Last played" is true an hour later,
 * a day later, and after the app has been closed all week. The widget must
 * keep saying "last played" and never "now playing" — that one word is what
 * makes the whole thing honest, and it is the thing to protect if this is
 * ever redesigned.
 *
 * Stored in AsyncStorage rather than held in memory because the widget is
 * most useful precisely when the app is NOT running.
 */
const KEY = 'cruisefm_last_played';

export type LastPlayed = {
  title: string;
  artist: string;
  /** Where the cover came from — https from the catalogue lookup, or file://
   *  from the phone. Kept so a changed song can be told from a changed URL. */
  artUrl: string | null;
  at: number;
};

export async function getLastPlayed(): Promise<LastPlayed | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastPlayed;
    // A hand-edited or half-written entry must not take a widget down; the
    // widget's own empty state is a perfectly good outcome.
    return typeof v?.title === 'string' && typeof v?.artist === 'string' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Remember a song. Returns true when this is genuinely a NEW one, which is
 * what tells the caller it is worth the work of shipping a new cover across —
 * the poll runs every five seconds and the song changes every few minutes.
 */
export async function noteLastPlayed(
  title: string, artist: string, artUrl: string | null,
): Promise<boolean> {
  if (!title) return false;
  try {
    const prev = await getLastPlayed();
    const sameSong = !!prev && prev.title === title && prev.artist === artist;
    /**
     * THE COVER OFTEN ARRIVES AFTER THE SONG DOES, AND THAT USED TO LOSE IT.
     *
     * Ethan, 18.09, on Apple Music: "the Album Artwork doesn't show in the
     * widgets as well it just shows the Station background." It never could.
     * MusicKit returns nothing for a library track's artwork (04.08), so the
     * cover comes from the public catalogue lookup, which runs BESIDE the
     * poll and patches the url in a beat later. The first sighting of a song
     * therefore carries `artUrl: null` — and this returned false for every
     * call after it, so the real cover, when it finally landed, was never
     * shipped across. Every Apple Music listener's widgets fell back to the
     * station photograph for ever, including the CD look, whose whole point
     * is the sleeve.
     *
     * So a LATE COVER FOR A SONG ALREADY KNOWN counts as news. Only in that
     * direction: a null arriving after a real url is the lookup failing or a
     * poll racing, and clearing a good cover on the strength of it would be
     * the same bug pointing the other way.
     */
    if (sameSong && !(artUrl && !prev!.artUrl)) return false;
    await AsyncStorage.setItem(KEY, JSON.stringify({ title, artist, artUrl, at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}
