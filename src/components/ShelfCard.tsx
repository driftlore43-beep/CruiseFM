import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Station } from '@/constants/stations';

export const SHELF_CARD_W = 150;

/**
 * A station on a horizontal shelf: its photograph as a square, its name and
 * one tag in plain text underneath.
 *
 * Replaces the landscape "postcard" the home strip used to carry (StationCard's
 * compact variant), which wore the station's accent palette as a vivid diagonal
 * gradient under glass. That was a fifth card style on a page that already had
 * four, and the gradient hid the photograph it was drawn from.
 *
 * Square-with-caption is the shape every music app uses for a shelf, for a good
 * reason: the artwork is the thing being recommended, and text below a picture
 * needs no scrim, so nothing is darkened to make room for it.
 */
export function ShelfCard({ station, onPress }: { station: Station; onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 42, bounciness: 5 }).start();

  return (
    <Animated.View style={{ width: SHELF_CARD_W, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => press(0.96)} onPressOut={() => press(1)}>
        <View style={st.art}>
          {station.image ? (
            <ImageBackground
              source={station.image}
              style={StyleSheet.absoluteFill}
              imageStyle={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={station.gradientColors}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {/* Just enough darkening at the top for the icon to survive a bright
              sky — the caption is outside the picture, so nothing else needs it. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.42)', 'transparent']}
            locations={[0, 0.45]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <MaterialCommunityIcons
            name={station.iconName as any}
            size={17}
            color="#fff"
            style={st.icon}
          />
        </View>
        <Text style={st.name} numberOfLines={1}>{station.name}</Text>
        {!!station.tags[0] && <Text style={st.tag} numberOfLines={1}>{station.tags[0]}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  art: {
    width: SHELF_CARD_W,
    height: SHELF_CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0d0d14',
  },
  icon: {
    position: 'absolute',
    left: 10,
    top: 9,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  name: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  tag: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12.5,
    marginTop: 1,
  },
});
