import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_H } = Dimensions.get('window');

// One beat ≈ 100 BPM: a quick swell and a longer relax — reads as a
// heartbeat/kick pattern without needing to hear the actual song.
const BEAT_ATTACK_MS = 150;
const BEAT_RELEASE_MS = 450;

/**
 * Shared atmosphere layer — a station-tinted glow across the lower half of
 * the screen that pulses to a steady drive-beat while music plays, over a
 * slower breathing wash. Runs entirely on the native driver (opacity + scale
 * transforms on static gradients), so all the vibe costs zero frames.
 *
 * Sits under the title/controls (zIndex 0) and ignores touches; when the
 * drive is paused it settles to a faint steady glow instead of vanishing.
 */
export function AmbientGlow({ active, color }: { active: boolean; color: string }) {
  const breath = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(breath, { toValue: 0.18, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      Animated.timing(beat, { toValue: 0, duration: 500, useNativeDriver: true }).start();
      return;
    }
    const breathLoop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0.25, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const beatLoop = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: BEAT_ATTACK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0.12, duration: BEAT_RELEASE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    breathLoop.start();
    beatLoop.start();
    return () => { breathLoop.stop(); beatLoop.stop(); };
  }, [active]);

  return (
    <View style={ag.wrap} pointerEvents="none">
      {/* Broad wash — the room light, swelling slowly */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.65] }),
            transform: [{ scaleY: breath.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.22] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + '73', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Beat layer — snaps bright on every pulse, relaxes between */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: beat.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
            transform: [{ scaleY: beat.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }] },
        ]}>
        <LinearGradient
          colors={['transparent', color + 'A6', 'transparent']}
          locations={[0.2, 0.5, 0.8]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const ag = StyleSheet.create({
  // Lower half of the screen, behind the song title and controls.
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    top: SCREEN_H * 0.45,
    height: SCREEN_H * 0.52,
    zIndex: 0,
  },
});
