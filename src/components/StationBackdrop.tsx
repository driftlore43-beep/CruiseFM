import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useDaylight } from '@/context/MotionContext';
import type { Station } from '@/constants/stations';

/**
 * Daylight veil. Every white label in the app that sits on a photograph gets
 * its contrast from how dark the photograph is behind it, and in sun a
 * mid-bright photo swallows white type whole. A flat 22% black knocks the
 * picture back just enough for the type to hold, everywhere at once — this
 * component is the backdrop for all eight modes, the station hero and the
 * landscape deck, so one veil covers the lot.
 */
function DaylightVeil() {
  const daylight = useDaylight();
  if (!daylight) return null;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,3,10,0.22)' }]} pointerEvents="none" />;
}

/**
 * Full-bleed station background. If the station has a looping `motion` clip
 * (animated WebP) it plays that via expo-image, with the static photo as an
 * instant placeholder; otherwise it renders the plain blurred photo.
 * Custom stations have no photo — they get their chosen palette instead.
 */
export function StationBackdrop({
  station,
  blurRadius = 2.5,
  motionAllowed = false,
}: {
  station: Station;
  blurRadius?: number;
  /** Gate for the looping clip (premium + not Data Saver). Hero passes true. */
  motionAllowed?: boolean;
}) {
  if (!station.image) {
    return (
      <LinearGradient
        colors={station.gradientColors}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  if (station.motion && motionAllowed) {
    return (
      <>
        <ExpoImage
          source={station.motion}
          placeholder={station.imageBlur ?? station.image}
          placeholderContentFit="cover"
          contentFit="cover"
          blurRadius={blurRadius}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
        />
        <DaylightVeil />
      </>
    );
  }
  // Pre-blurred asset when we have one: a live blurRadius re-blurs the full
  // image on the main thread every re-display (mode open, app re-entry) —
  // Sentry caught iOS killing the app for exactly that. Displaying an
  // already-blurred JPEG costs the same as any photo.
  //
  // expo-image with contentFit="cover", NOT ImageBackground. The old version
  // forced `imageStyle={{width:'100%',height:'100%'}}` to work around web
  // rendering the photo at its intrinsic size — but explicit dimensions fight
  // resizeMode, and in LANDSCAPE that showed as the photo failing to reach
  // the left and bottom edges, leaving a hard black margin in the corner
  // (owner, 30.07). The station assets are portrait (1080 wide), so a wide
  // window is exactly the case that exposed it. contentFit covers correctly
  // on every platform and orientation with no override needed, and
  // expo-image is already in the build for the motion clips.
  return (
    <>
      <ExpoImage
        source={station.imageBlur ?? station.image}
        contentFit="cover"
        blurRadius={station.imageBlur ? 0 : blurRadius}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
      />
      <UserPhotoVeil station={station} />
      <DaylightVeil />
    </>
  );
}

/**
 * An extra knock-back for a photo of the user's own.
 *
 * The ten built-in stations are photographed dark on purpose — dusk, tunnels,
 * night roads — and every white label in the app leans on that. Someone's own
 * photo has no such discipline: a bright beach shot swallows the song title
 * whole. A file path means a user photo (the built-ins are bundled assets, so
 * numbers), which makes the check free and needs no extra field.
 *
 * Deliberately gentle. It has to rescue the worst case without flattening a
 * good photo into grey — the point of letting someone use their own picture is
 * that they can still see it.
 */
function UserPhotoVeil({ station }: { station: Station }) {
  if (typeof station.image !== 'string') return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,6,14,0.30)' }]}
      pointerEvents="none"
    />
  );
}
