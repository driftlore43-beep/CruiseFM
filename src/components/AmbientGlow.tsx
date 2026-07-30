import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { useMotion } from '@/context/MotionContext';

// One beat ≈ 100 BPM: quick swell, longer relax.
const BEAT_ATTACK_MS = 150;
const BEAT_RELEASE_MS = 450;

/** A soft round haze — dense in the middle, dissolving to nothing at the
 * edges, like a smoke machine's plume under a coloured light.
 *
 * SIZED IN REAL PIXELS, AND DRAWN THROUGH A viewBox. Both matter, and this
 * was a real bug (owner, 30.07: a hard horizontal line across the left of
 * the Mirror Ball and Circular EQ after turning the phone). It used to be
 * `<Svg width="100%" height="100%">` with `50%` geometry inside — the only
 * percentage-sized SVG in the app. On iOS a percentage-sized canvas is
 * resolved natively and does NOT re-resolve when the window changes shape,
 * so after a rotation the ellipse was still drawn at its PORTRAIT
 * proportions while the view had already re-laid-out to the landscape box —
 * and the view clips, so the bottom half of the haze was sliced off in a
 * straight line. (Measured on the owner's screenshots: the cut sat exactly
 * where the portrait-shaped ellipse ran out of landscape box.)
 *
 * Concrete numbers give the native side a new canvas on every dimension
 * change, and the `0 0 100 100` viewBox with `preserveAspectRatio="none"`
 * means the drawing itself no longer depends on how any percentage resolves.
 */
function Haze({ id, color, w, h }: { id: string; color: string; w: number; h: number }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" rx="50" ry="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={color} stopOpacity="0.72" />
          <Stop offset="55%" stopColor={color} stopOpacity="0.34" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id})`} />
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
  // LIVE dimensions, not module-load ones. These were captured once at
  // startup (so always portrait), which meant that sideways the whole layer
  // was positioned for a screen twice as tall as the real one: the smoke
  // band collapsed into a sliver at the bottom and the side plumes became a
  // patch in the lower-left corner. That is why atmosphere had to be gated
  // out of landscape at all — with live values it simply works in both.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

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

  // Every box in real pixels. These are exactly the proportions the layer has
  // always had (the lower two-thirds of the screen, plumes bleeding past both
  // edges) — only written as left+width/top+height rather than left+right and
  // percentages, so each haze can be handed its own concrete size. See the
  // note on Haze for why that is load-bearing rather than tidying.
  const wrapTop = SCREEN_H * 0.34;
  const wrapH   = SCREEN_H * 0.66;
  const boxes = {
    hero:  { left: -SCREEN_W * 0.18, width: SCREEN_W * 1.36, top: SCREEN_H * 0.08,    height: SCREEN_H * 0.5 },
    main:  { left: -SCREEN_W * 0.35, width: SCREEN_W * 1.70, top: wrapH * 0.18, height: wrapH * 0.82 },
    left:  { left: -SCREEN_W * 0.45, width: SCREEN_W * 0.95, top: wrapH * 0.05, height: wrapH * 0.75 },
    right: { left:  SCREEN_W * 0.50, width: SCREEN_W * 0.95, top: wrapH * 0.25, height: wrapH * 0.75 },
    beat:  { left: -SCREEN_W * 0.15, width: SCREEN_W * 1.30, top: wrapH * 0.10, height: wrapH * 0.90 },
  };

  return (
    // Keyed on the orientation: a turn rebuilds the hazes outright rather
    // than resizing native SVG canvases in place. Cheap (it happens only when
    // the phone actually turns) and it cannot leave a stale canvas behind.
    // The breathing values live on this component, so nothing restarts.
    <View
      key={SCREEN_W > SCREEN_H ? 'ls' : 'pt'}
      style={[StyleSheet.absoluteFill, { opacity: strength }]}
      pointerEvents="none">
    {/* Hero halo — the cassette-style orb behind the mode's centrepiece.
        Turned off (hero={false}) in modes whose scene already owns that
        space (Cassette's own orb, Horizon's sun). */}
    {hero && (
      <View style={[ag.heroWrap, boxes.hero]} pointerEvents="none">
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: heroO,
              transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] }) }] },
          ]}>
          <Haze id="agHero" color={color} w={boxes.hero.width} h={boxes.hero.height} />
        </Animated.View>
      </View>
    )}
    <View style={[ag.wrap, { top: wrapTop }]} pointerEvents="none">
      {/* Wide base cloud */}
      <Animated.View
        style={[ag.haze, boxes.main, {
          opacity: mainO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.18] }) }],
        }]}>
        <Haze id="agMain" color={color} w={boxes.main.width} h={boxes.main.height} />
      </Animated.View>
      {/* Side plumes, breathing against each other */}
      <Animated.View
        style={[ag.haze, boxes.left, {
          opacity: leftO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.92] }) }],
        }]}>
        <Haze id="agLeft" color={color} w={boxes.left.width} h={boxes.left.height} />
      </Animated.View>
      <Animated.View
        style={[ag.haze, boxes.right, {
          opacity: rightO,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
        }]}>
        <Haze id="agRight" color={color} w={boxes.right.width} h={boxes.right.height} />
      </Animated.View>
      {/* Beat plume — centre burst on every kick, only while audio plays */}
      <Animated.View
        style={[ag.haze, boxes.beat, {
          opacity: beatPulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
          transform: [{ scale: beatPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
        }]}>
        <Haze id="agBeat" color={color} w={boxes.beat.width} h={boxes.beat.height} />
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
  // `top` is supplied per render from the LIVE screen height — see the note
  // in the component. Everything else is orientation-independent.
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: 0,
    zIndex: 0,
  },
  // Upper-middle halo zone, bleeding past the sides so it stays round.
  // Position/size also supplied per render.
  heroWrap: {
    position: 'absolute',
    zIndex: 0,
  },
  haze: { position: 'absolute' },
});
