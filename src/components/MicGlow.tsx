import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useMotion } from '@/context/MotionContext';
import { useMicLevel } from '@/utils/useMicLevel';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * Shared music-reactive glow — drops into any visual mode so the whole scene
 * breathes with the sound around the phone. Same technique proven in the
 * Equalizer: a soft station-tinted band that brightens with loudness, plus a
 * second "bloom" band that only shows on the loud peaks.
 *
 * Self-contained: it owns the mic hook and the `micReactive` setting, and it
 * renders NOTHING unless live loudness is actually available. So on web,
 * without permission, or with the setting off, the host mode looks exactly as
 * it did before — this is purely additive when the mic is driving.
 *
 * Sits in the upper-middle of the screen (the hero/visualiser zone), clear of
 * the bottom title and controls so text stays legible on the peaks.
 */
export function MicGlow({ active, color }: { active: boolean; color: string }) {
  const { micReactive } = useMotion();
  const mic = useMicLevel(active && micReactive);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!mic.available) return;
    Animated.timing(pulse, {
      toValue: Math.min(1, mic.level * 1.9),
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [mic.level, mic.available]);

  if (!mic.available) return null;

  return (
    <View style={st.wrap} pointerEvents="none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.72] }),
            transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + '59', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: pulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0, 0.55] }),
            transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + 'B3', 'transparent']}
          locations={[0.2, 0.5, 0.8]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  // Low band, behind the song title — clear of the centre visual (the vinyl
  // disc, the cassette, the dial) so it never washes or blurs it.
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    top: SCREEN_H * 0.55,
    height: SCREEN_H * 0.38,
    zIndex: 0,
  },
});
