import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useMotion } from '@/context/MotionContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// One beat ≈ 100 BPM: quick swell, longer relax.
const BEAT_ATTACK_MS = 150;
const BEAT_RELEASE_MS = 450;

/** A soft round haze — dense in the middle, dissolving to nothing at the
 * edges, like a smoke machine's plume under a coloured light. */
function Haze({ id, color }: { id: string; color: string }) {
  return (
    <Svg width="100%" height="100%" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.72" />
          <Stop offset="55%" stopColor={color} stopOpacity="0.34" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Shared atmosphere layer — station-tinted smoke drifting over the lower
 * two-thirds of the screen. Three overlapping round hazes breathe out of
 * phase (so the cloud constantly shifts shape instead of pulsing as one
 * line), and a centre plume snaps to a steady ~100 BPM beat — but only while
 * audio is genuinely playing (`beat`); when the music stops or is switching,
 * the beat dies down and just the slow drift remains.
 *
 * All animation is opacity/scale transforms on the native driver — zero
 * frame cost.
 */
export function AmbientGlow({ active, beat, color, hero = true, trackKey }: {
  active: boolean; beat?: boolean; color: string; hero?: boolean;
  /** Current song identity (title). When it changes, the beat holds its
   *  breath for a couple of seconds — atmosphere pauses between songs. */
  trackKey?: string | null;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const beatPulse = useRef(new Animated.Value(0)).current;
  const { atmosphere, softAtmosphere } = useMotion();

  // Song-transition hold: a new title means the old song just ended — the
  // 5s poll can't see the ~1s silent gap itself, so the moment the title
  // flips we rest the beat briefly, like the room catching its breath.
  const [transitionHold, setTransitionHold] = useState(false);
  const prevKeyRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevKeyRef.current;
    prevKeyRef.current = trackKey;
    if (prev === undefined || prev === trackKey || !trackKey) return;
    setTransitionHold(true);
    const t = setTimeout(() => setTransitionHold(false), 2200);
    return () => clearTimeout(t);
  }, [trackKey]);
  const beatActive = !!beat && !transitionHold;

  useEffect(() => {
    if (!active) {
      Animated.timing(breath, { toValue: 0.18, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0.2, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active]);

  useEffect(() => {
    if (!beatActive) {
      // Music stopped / switching / between songs — the pulse dies out gently.
      Animated.timing(beatPulse, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(beatPulse, { toValue: 1, duration: BEAT_ATTACK_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(beatPulse, { toValue: 0.12, duration: BEAT_RELEASE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [beatActive]);

  // The two side hazes ride the same breath in opposite phase, so the smoke
  // leans left, then right — a drifting cloud, not a blinking band.
  const leftO  = breath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.2] });
  const rightO = breath.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });
  const mainO  = breath.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
  const heroO  = breath.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] });

  // Profile toggle: some drivers want the scene without the smoke.
  if (!atmosphere) return null;
  // ...and most want less of it. "Softer Atmosphere" scales the whole layer
  // rather than each haze, so the shapes and timing are untouched and only
  // the weight changes.
  const strength = softAtmosphere ? 0.5 : 1;

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: strength }]} pointerEvents="none">
    {/* Hero halo — the cassette-style orb behind the mode's centrepiece.
        Turned off (hero={false}) in modes whose scene already owns that
        space (Cassette's own orb, Horizon's sun). */}
    {hero && (
      <View style={ag.heroWrap} pointerEvents="none">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: heroO,
              transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] }) }] },
          ]}>
          <Haze id="agHero" color={color} />
        </Animated.View>
      </View>
    )}
    <View style={ag.wrap} pointerEvents="none">
      {/* Wide base cloud */}
      <Animated.View
        style={[ag.haze, {
          left: -SCREEN_W * 0.35, right: -SCREEN_W * 0.35, top: '18%', height: '82%',
          opacity: mainO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.18] }) }],
        }]}>
        <Haze id="agMain" color={color} />
      </Animated.View>
      {/* Side plumes, breathing against each other */}
      <Animated.View
        style={[ag.haze, {
          left: -SCREEN_W * 0.45, width: SCREEN_W * 0.95, top: '5%', height: '75%',
          opacity: leftO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.92] }) }],
        }]}>
        <Haze id="agLeft" color={color} />
      </Animated.View>
      <Animated.View
        style={[ag.haze, {
          right: -SCREEN_W * 0.45, width: SCREEN_W * 0.95, top: '25%', height: '75%',
          opacity: rightO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
        }]}>
        <Haze id="agRight" color={color} />
      </Animated.View>
      {/* Beat plume — centre burst on every kick, only while audio plays */}
      <Animated.View
        style={[ag.haze, {
          left: -SCREEN_W * 0.15, right: -SCREEN_W * 0.15, top: '10%', height: '90%',
          opacity: beatPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
          transform: [{ scale: beatPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
        }]}>
        <Haze id="agBeat" color={color} />
      </Animated.View>
    </View>
    </View>
  );
}

const ag = StyleSheet.create({
  // Lower two-thirds of the screen; hazes bleed past the edges so nothing
  // reads as a straight line.
  //
  // NEVER put `overflow: 'hidden'` back on this. The hazes breathe up to
  // scale 1.18, so a clip here slices the scaled-up smoke into a hard
  // horizontal line — it used to land at exactly 0.96 × screen height and
  // showed as a visible seam near the home indicator on every mode screen.
  // Unclipped, the hazes simply fade out on their own gradient; the screen
  // edge does the only clipping that's actually wanted.
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    top: SCREEN_H * 0.34,
    bottom: 0,
    zIndex: 0,
  },
  // Upper-middle halo zone, bleeding past the sides so it stays round.
  heroWrap: {
    position: 'absolute',
    left: -SCREEN_W * 0.18, right: -SCREEN_W * 0.18,
    top: SCREEN_H * 0.08,
    height: SCREEN_H * 0.5,
    zIndex: 0,
  },
  haze: { position: 'absolute' },
});
