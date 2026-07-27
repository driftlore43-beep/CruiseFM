import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet } from 'react-native';

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
  if (station.imageBlur) {
    return (
      <ImageBackground
        source={station.imageBlur}
        style={StyleSheet.absoluteFill}
        imageStyle={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    );
  }
  return (
    <ImageBackground
      source={station.image}
      style={StyleSheet.absoluteFill}
      imageStyle={{ width: '100%', height: '100%' }}
      blurRadius={blurRadius}
      resizeMode="cover"
    />
  );
}
