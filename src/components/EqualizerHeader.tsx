import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Cruise } from '@/constants/theme';

// Each bar has its own height range, animation speed and phase offset.
// Colors go violet → violet-blue across the 8 bars for a spectrum look.
// Compact sonic wave — small bars that sit on the right of the header.
const BAR_CONFIGS = [
  { maxH: 10, duration: 480, delay: 0,   color: '#7B38E0' },
  { maxH: 20, duration: 560, delay: 70,  color: '#7D3DE8' },
  { maxH: 8,  duration: 440, delay: 150, color: '#8045EF' },
  { maxH: 24, duration: 600, delay: 30,  color: '#8050F5' },
  { maxH: 14, duration: 520, delay: 110, color: '#7A5CF8' },
  { maxH: 22, duration: 500, delay: 190, color: '#7068F8' },
  { maxH: 11, duration: 460, delay: 55,  color: '#6575F5' },
] as const;

function EqBar({
  maxH,
  duration,
  delay,
  color,
}: {
  maxH: number;
  duration: number;
  delay: number;
  color: string;
}) {
  const h = useSharedValue(3);

  useEffect(() => {
    h.value = withDelay(
      delay,
      withRepeat(
        withTiming(maxH, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function EqualizerHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>NOW PLAYING</Text>
        <Text style={styles.sublabel}>Night Run FM</Text>
      </View>
      <View style={styles.equalizerRow}>
        {BAR_CONFIGS.map((cfg, i) => (
          <EqBar key={i} {...cfg} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
  },
  equalizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 26,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  labelGroup: {
    gap: 3,
  },
  label: {
    color: Cruise.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  sublabel: {
    color: Cruise.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
