/**
 * The one place a millisecond count becomes a time on screen.
 *
 * THERE WERE ELEVEN COPIES OF THIS, AND THEY HAD ALREADY DRIFTED — found
 * 03.09 when the owner reported "the times on the music bars". Three
 * different faults, none of which any single mode's author could have seen:
 *
 *   NaN:NaN   ALL EIGHT decks printed this when the duration was not known
 *             yet. `Math.floor(NaN / 1000)` is NaN and every copy went
 *             straight on to build a string out of it.
 *   -1:-5     Equalizer and Vinyl had no clamp while the other six did, so a
 *             position past the end of the track — which the clock can reach,
 *             it coasts — came out as that.
 *   03:05     Vinyl and Cassette padded the minutes; the other six did not.
 *             The same song read differently depending on which deck you were
 *             looking at.
 *
 * A TIME WE DO NOT KNOW IS NOT ZERO. `0:00` is a claim — it says the song is
 * at the beginning — and this app does not make claims it cannot support (the
 * same rule as LAST PLAYED on the widget, and the reason the clock waits for
 * the service's own verdict before it starts). So an unknown time is drawn as
 * a blank readout, which is what a real deck shows before the tape is in.
 */

/** What a deck shows when there is no time to show. */
const UNKNOWN = '--:--';

/**
 * `ms` as m:ss.
 *
 * @param pad two-digit minutes, for the decks whose readout is a piece of
 *   HARDWARE rather than a caption — the cassette's counter and the vinyl's
 *   deck display both show leading zeros, because the real things do. Every
 *   other mode writes a time the way a person would say it.
 */
export function mmss(ms: number | null | undefined, opts?: { pad?: boolean }): string {
  // Blank whether padded or not: a readout with nothing to show shows nothing.
  if (ms == null || !Number.isFinite(ms)) return UNKNOWN;
  // Clamped, because the clock genuinely can run past the end of a track: it
  // coasts between readings, so a song that finishes while the signal is out
  // leaves the position beyond the duration until the next reading lands.
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${opts?.pad ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}
