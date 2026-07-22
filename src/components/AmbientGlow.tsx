import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * Shared atmosphere layer — a station-tinted band low on the screen that
 * breathes slowly while the music plays, like cabin lighting swelling with
 * the drive. Runs entirely on the native driver (opacity + scale transforms
 * on two static gradients), so it adds vibe without adding any frame cost.
 *
 * Sits under the title/controls (zIndex 0) and ignores touches; when the
 * drive is paused it settles to a faint steady glow instead of vanishing.
 */
export function AmbientGlow({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(pulse, { toValue: 0.15, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.2, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={ag.wrap} pointerEvents="none">
      {/* Broad wash — always faintly present, swells with the breath */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.42] }),
            transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + '4D', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Hot core — only blooms near the top of the breath */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: pulse.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 0.26] }),
            transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.1] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + '99', 'transparent']}
          locations={[0.25, 0.5, 0.75]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const ag = StyleSheet.create({
  // Low band behind the song title, clear of the hero visual up top.
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    top: SCREEN_H * 0.52,
    height: SCREEN_H * 0.42,
    zIndex: 0,
  },
});
