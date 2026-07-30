import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
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

/** Height the bars settle at when nothing is playing — a row of dots. */
const REST_H = 3;

function EqBar({
  maxH,
  duration,
  delay,
  color,
  live,
}: {
  maxH: number;
  duration: number;
  delay: number;
  color: string;
  /** Bars only move while audio is genuinely playing. */
  live: boolean;
}) {
  const h = useSharedValue(REST_H);

  // The loop used to start on mount and never stop, so the meter bounced
  // merrily along over paused music — which is the one thing an equalizer
  // must not do. It now starts and stops with the audio.
  useEffect(() => {
    if (live) {
      h.value = withDelay(
        delay,
        withRepeat(
          withTiming(maxH, { duration, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      );
    } else {
      // cancelAnimation first: withTiming alone would be overridden by the
      // repeat that is still running.
      cancelAnimation(h);
      h.value = withTiming(REST_H, { duration: 320, easing: Easing.out(Easing.quad) });
    }
  }, [live]);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function EqualizerHeader({
  stationName,
  live = false,
  accent,
}: {
  /** Station to show — the active drive's, or tonight's pick when idle. */
  stationName: string;
  /** True when audio is genuinely playing — drives whether the bars move. */
  live?: boolean;
  /** Mood colour to tint the bars, so the header matches the station. */
  accent?: string;
}) {
  // WHETHER this renders is the caller's decision (there is nothing to report
  // with no drive and no playback, and idle it used to read "TONIGHT'S PICK /
  // <station>" — which the hero directly below says twice over in bigger
  // type). What it reports is decided here: the label and the motion both
  // follow the audio, so an open-but-paused drive reads as paused instead of
  // dancing over silence.
  return (
    <View style={styles.container}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>{live ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.sublabel}>{stationName}</Text>
      </View>
      <View style={styles.equalizerRow}>
        {BAR_CONFIGS.map((cfg, i) => (
          <EqBar key={i} {...cfg} color={accent ?? cfg.color} live={live} />
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
