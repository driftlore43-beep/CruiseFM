import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import { readableOn, type Palette } from '@/utils/appearance';

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

/** The bar's own shape carries no colour of its own — the station's accent
 *  arrives as a prop — so it stays outside the themed stylesheet. */
const BAR_STYLE = { width: 3, borderRadius: 2 } as const;

/**
 * One bar.
 *
 * WHY React Native's own Animated and not Reanimated (fixed 02.08): this was
 * the only component in the app still on Reanimated, and the only one
 * animating HEIGHT — a layout property — instead of a transform. Every other
 * animation in Cruise FM is an Animated transform on the native driver, and
 * every one of those runs on device; this one didn't, while measuring exactly
 * the same component in the browser showed the loop working perfectly. A
 * single component on a different engine, animating the one property that
 * can't take the native driver, is not a coincidence worth defending.
 *
 * The bar is drawn at its FULL height and scaled down instead. Scaling happens
 * about the centre, so it is paired with a translate that puts the bottom edge
 * back on the baseline — React Native has no transform-origin.
 */
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
  // 0 = resting dot, 1 = full height.
  const v = useRef(new Animated.Value(0)).current;

  // The loop used to start on mount and never stop, so the meter bounced
  // merrily along over paused music — which is the one thing an equalizer
  // must not do. It starts and stops with the audio.
  useEffect(() => {
    if (!live) {
      v.stopAnimation();
      Animated.timing(v, {
        toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
      return;
    }
    // The delay runs ONCE, before the loop — inside it, every bar would pause
    // at the bottom of every cycle and the row would breathe in unison.
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [live, delay, duration, v]);

  const minScale = REST_H / maxH;
  const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [minScale, 1] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [(maxH - REST_H) / 2, 0] });

  return (
    <Animated.View
      style={[BAR_STYLE, { height: maxH, backgroundColor: color, transform: [{ translateY }, { scaleY }] }]}
    />
  );
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
  // with no drive, and idle it used to read "TONIGHT'S PICK / <station>" —
  // which the hero directly below says twice over in bigger type). What it
  // reports is decided here: the label and the motion both follow the audio,
  // so an open-but-paused drive reads as paused instead of dancing over
  // silence.
  const styles = useStyles(makeStyles);
  const pal = usePalette();
  // The bars stand on the PAGE, not on artwork, so a station whose palette is
  // white — Mountain Pass is literally three whites — drew an invisible meter
  // in the light theme. Same rule as the dial's icons (14.08).
  const barColor = accent ? readableOn(accent, pal.mode) : undefined;
  return (
    <View style={styles.container}>
      <View style={styles.labelGroup}>
        <Text style={styles.label}>{live ? 'NOW PLAYING' : 'PAUSED'}</Text>
        <Text style={styles.sublabel}>{stationName}</Text>
      </View>
      <View style={styles.equalizerRow}>
        {BAR_CONFIGS.map((cfg, i) => (
          <EqBar key={i} {...cfg} color={barColor ?? cfg.color} live={live} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
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
  labelGroup: {
    gap: 3,
  },
  label: {
    // THE STATION'S NAME WAS WHITE ON PAPER (owner, 19.08). This component
    // was written before the light theme and never converted, so both lines
    // were hardcoded dark-theme literals — and `Cruise.textPrimary` is
    // #FFFFFF, i.e. the name simply vanished into the page. The dark side of
    // each token below is byte-identical to what it replaces, per the rule
    // in utils/appearance.ts.
    color: p.mode === 'dark' ? '#505068' : p.ink(0.55),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  sublabel: {
    color: p.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
