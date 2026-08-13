import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { stationDial, type Station } from '@/constants/stations';
import { useDsegFont } from '@/components/StationIdentity';
import { stationImageSource } from '@/utils/stationImage';

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
  // NOT `station.image` directly — a custom station's is a file path string,
  // which RN's Image draws as nothing. See utils/stationImage.
  const art = stationImageSource(station.image);
  const dseg = useDsegFont();
  const dial = stationDial(station.id, !!station.premium);
  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 42, bounciness: 5 }).start();

  return (
    <Animated.View style={{ width: SHELF_CARD_W, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => press(0.96)} onPressOut={() => press(1)}>
        <View style={st.art}>
          {art ? (
            <ImageBackground
              source={art}
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
        {/* "(dial no.) (name)" — the receiver identity follows the station
            onto every card (owner, 30.07). Nested Text carries the
            seven-segment face for the number only. */}
        <Text style={st.name} numberOfLines={1}>
          <Text style={[st.dial, { fontFamily: dseg }]}>{dial.label}</Text>
          {'  '}{station.name}
        </Text>
        {!!station.tags[0] && <Text style={st.tag} numberOfLines={1}>{station.tags[0]}</Text>}
      </Pressable>
    </Animated.View>
  );
}

/**
 * The empty slot at the end of your own shelf.
 *
 * Deliberately the same size and rhythm as a station, but drawn as an outline
 * rather than a picture — it reads as a space waiting to be filled instead of
 * as another station you own. Only ever the LAST card on the "Your stations"
 * shelf, where "one more" is the obvious next thought.
 */
export function NewStationCard({ onPress }: { onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 42, bounciness: 5 }).start();

  return (
    <Animated.View style={{ width: SHELF_CARD_W, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => press(0.96)} onPressOut={() => press(1)}>
        <View style={[st.art, st.newArt]}>
          <MaterialCommunityIcons name="plus" size={26} color="rgba(255,255,255,0.66)" />
        </View>
        <Text style={st.name} numberOfLines={1}>New station</Text>
        <Text style={st.tag} numberOfLines={1}>your photo, your mood</Text>
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
  newArt: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
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
    letterSpacing: 0,
    marginTop: 8,
  },
  dial: { color: 'rgba(255,255,255,0.55)', fontSize: 10.5 },
  tag: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12.5,
    marginTop: 1,
  },
});
