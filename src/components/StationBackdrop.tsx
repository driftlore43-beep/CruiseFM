import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import type { Station } from '@/constants/stations';

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
      <ExpoImage
        source={station.motion}
        placeholder={station.imageBlur ?? station.image}
        placeholderContentFit="cover"
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
      />
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
    <ExpoImage
      source={station.imageBlur ?? station.image}
      contentFit="cover"
      blurRadius={station.imageBlur ? 0 : blurRadius}
      cachePolicy="memory-disk"
      style={StyleSheet.absoluteFill}
    />
  );
}
