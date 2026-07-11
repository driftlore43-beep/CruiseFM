import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/**
 * A slow amber light-sweep across a locked premium card — the velvet rope.
 * Lay it over the card's gradient (inside an overflow:hidden container).
 */
export function PremiumShimmer() {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.delay(1600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-220, 620] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[shimmer.band, { transform: [{ translateX }, { rotate: '18deg' }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(245,158,11,0.16)', 'rgba(255,220,150,0.30)', 'rgba(245,158,11,0.16)', 'transparent']}
          locations={[0, 0.3, 0.5, 0.7, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const shimmer = StyleSheet.create({
  band: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 130,
  },
});
