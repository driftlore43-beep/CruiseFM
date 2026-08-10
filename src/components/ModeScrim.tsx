import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import type { Station } from '@/constants/stations';

/**
 * The shading a mode lays over its station photograph.
 *
 * ONE COMPONENT BECAUSE THIS ALREADY DRIFTED ONCE. Three modes carry a scrim,
 * they each had their own copy of the stops, and when they were eased on 03.08
 * only two were found — the note from that day even records "only Equalizer
 * and Vinyl carry one", which was wrong. CD was left at 0.58 rising to 0.82,
 * roughly double the other two and nearly six times heavier at the top, which
 * is exactly where the picture is. It was the darkest screen in the app for a
 * week and nobody could see why.
 *
 * THE SHAPE IS THE POINT, not the overall amount. Nothing sits in the top half
 * of a mode but the object, so shading there only buries the photograph; the
 * bottom is where the song title, the seek bar and the transport live, and
 * white type needs something behind it. So both ramps stay light at the top
 * and gather at the foot.
 *
 * A USER'S OWN PHOTO GETS LESS (owner, 10.08: "it's their personalised image,
 * it should be appreciated a bit more"). The built-in ten are photographed
 * dark on purpose and can take shading; someone's own picture is the whole
 * reason they made that station. So the top of the ramp nearly vanishes for
 * them while the foot stays close to the built-in weight — the picture opens
 * up, the words stay readable.
 */

/** Built-in stations: the values approved on 03.08. Do not raise these. */
const BUILT_IN = [
  'rgba(2,2,12,0.10)',
  'rgba(2,2,12,0.06)',
  'rgba(2,2,12,0.18)',
  'rgba(2,2,12,0.32)',
  'rgba(2,2,12,0.46)',
] as const;

/** A photo of the user's own: open at the top, still safe under the type. */
const USER_PHOTO = [
  'rgba(2,2,12,0.04)',
  'rgba(2,2,12,0.02)',
  'rgba(2,2,12,0.10)',
  'rgba(2,2,12,0.24)',
  'rgba(2,2,12,0.40)',
] as const;

const LOCATIONS = [0, 0.4, 0.65, 0.85, 1] as const;

export function ModeScrim({ station }: { station: Station }) {
  // A file path means a user photo; the built-ins are bundled assets, so
  // numbers. Same free discrimination StationBackdrop uses.
  const userPhoto = typeof station.image === 'string';
  return (
    <LinearGradient
      colors={[...(userPhoto ? USER_PHOTO : BUILT_IN)]}
      locations={[...LOCATIONS]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
