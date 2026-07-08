import { Image as ExpoImage } from 'expo-image';
import { ImageBackground, StyleSheet } from 'react-native';

import type { Station } from '@/constants/stations';

/**
 * Full-bleed station background. If the station has a looping `motion` clip
 * (animated WebP) it plays that via expo-image, with the static photo as an
 * instant placeholder; otherwise it renders the plain blurred photo.
 */
export function StationBackdrop({
  station,
  blurRadius = 3.5,
  motionAllowed = false,
}: {
  station: Station;
  blurRadius?: number;
  /** Gate for the looping clip (premium + not Data Saver). Hero passes true. */
  motionAllowed?: boolean;
}) {
  if (station.motion && motionAllowed) {
    return (
      <ExpoImage
        source={station.motion}
        placeholder={station.image}
        placeholderContentFit="cover"
        contentFit="cover"
        blurRadius={blurRadius}
        cachePolicy="memory-disk"
        style={StyleSheet.absoluteFill}
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
