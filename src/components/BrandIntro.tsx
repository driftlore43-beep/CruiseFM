import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/**
 * The opening logo.
 *
 * Cruise FM's launch screen used to flash past: the native splash hides the
 * moment the first screen mounts, so the mark was on screen for a frame or
 * two. This holds it, and while it's held the three broadcast arcs light up
 * in order from the inside out — the logo transmitting.
 *
 * WHY IT LOOKS IDENTICAL TO THE NATIVE SPLASH, AND HAS TO:
 * the native splash renders `splash-icon.png` (the whole mark, arcs included)
 * at 120pt wide. This overlay rebuilds that same mark out of its four source
 * layers so the arcs can be animated separately — and it must land on exactly
 * the same pixels, or the handover from native splash to JS is a visible jump.
 *
 * The layers are all 512x512 canvases so they stack with no offsets, but the
 * artwork inside them is drawn 504/474 larger than in splash-icon.png. Hence
 * BOX below: 120 x 0.9405 puts the disc back at precisely the size the native
 * splash was already showing. (Measured, not guessed — compositing the four
 * layers at that scale differs from splash-icon.png by 3.4/255 of alpha.)
 *
 * A CONSEQUENCE OF THAT MATCH: the arcs cannot fade IN from nothing, because
 * the splash underneath has been showing them all along and they would blink
 * out first. So everything starts lit exactly as the splash left it, holds,
 * dims, and only then sweeps back outward. The dim is far enough into the
 * hold to read as the animation starting rather than as a glitch.
 *
 * The previous attempt at an intro (deleted 28.07) drove itself with a
 * requestAnimationFrame loop calling setState every 33ms during the busiest
 * moment of boot, and was jagged by construction. This one is opacity-only on
 * the native driver, with a single setState at the very end to unmount.
 */

// Splash-screen geometry, from app.json's expo-splash-screen plugin config.
// Both values are load-bearing: change them here only if they change there.
const SPLASH_BG = '#0E0E14';
const SPLASH_ICON_W = 120;
const LAYER_SCALE = 0.9405;
const BOX = SPLASH_ICON_W * LAYER_SCALE;

// Timings, in order. Total ≈ 2.2s — long enough to read as a brand moment,
// short enough not to be in the way on the fifth launch of the day.
const HOLD_MS = 400;      // as the splash left it, so the handover is invisible
const DIM_MS = 200;       // arcs drop back, ready to transmit
const ARC_MS = 260;       // one arc lighting
const ARC_STAGGER = 180;  // the gap that makes it read as a sweep outward
const LIT_HOLD_MS = 380;  // all three up
const FADE_MS = 420;
// When the last arc has finished lighting, measured from the start.
const SWEEP_END_MS = HOLD_MS + DIM_MS + 2 * ARC_STAGGER + ARC_MS;

const DIM = 0.18;

const DISC = require('../../assets/images/intro/logo-disc.png');
const ARCS = [
  require('../../assets/images/intro/logo-arc-1.png'),
  require('../../assets/images/intro/logo-arc-2.png'),
  require('../../assets/images/intro/logo-arc-3.png'),
];

export function BrandIntro({ onDone }: { onDone?: () => void }) {
  const [done, setDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  // Start lit: this is what the native splash is already showing.
  const arcs = useRef(ARCS.map(() => new Animated.Value(1))).current;

  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Separate from `cancelled` on purpose. If finishing also marked the intro
  // cancelled, a re-run of the effect (React strict mode, a hot reload) would
  // find `cancelled` already true, refuse to start, and never call
  // hideAsync() — leaving the app stuck behind a splash it cannot dismiss.
  const ended = useRef(false);

  const finish = () => {
    if (ended.current) return;
    ended.current = true;
    setDone(true);
    doneRef.current?.();
  };

  const started = useRef(false);
  const loaded = useRef(0);
  const cancelled = useRef(false);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const bail = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Nothing begins until all four layers have actually decoded.
   *
   * Found by tracing the launch: the overlay paints as soon as it mounts, but
   * the images arrive a beat later, so the first part of the hold was a blank
   * background with the mark popping in afterwards — a worse flash than the
   * one being fixed. Waiting for the layers means the native splash stays up
   * until there is something identical to replace it with.
   */
  const begin = () => {
    if (started.current || cancelled.current) return;
    started.current = true;

    // Hand over from the native splash. Fire-and-forget: if it ever rejects,
    // the app must not be left staring at a splash it cannot dismiss.
    SplashScreen.hideAsync().catch(() => {});

    // Each arc owns its own two-step animation and the fade owns its own
    // delay, rather than everything hanging off one big Animated.sequence.
    //
    // That is not a style preference — the sequence version reported the
    // right total duration while the screen faded out in the first 400ms.
    // Giving the fade an explicit `delay` makes it impossible for it to start
    // before its turn, whatever the platform does with the rest.
    arcs.forEach((a, i) => {
      Animated.sequence([
        // Down together, once the hold is over.
        Animated.timing(a, {
          toValue: DIM, delay: HOLD_MS, duration: DIM_MS,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        // Back up one at a time, inner to outer. The stagger is what makes it
        // read as a signal leaving the mark rather than a flicker.
        Animated.timing(a, {
          toValue: 1, delay: i * ARC_STAGGER, duration: ARC_MS,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]).start();
    });

    anim.current = Animated.timing(fade, {
      toValue: 0, delay: SWEEP_END_MS + LIT_HOLD_MS, duration: FADE_MS,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    });
    anim.current.start(({ finished }) => { if (finished && !cancelled.current) finish(); });

    // If an animation is ever interrupted (a background and return during
    // boot), the intro still gets out of the way rather than sitting over
    // the app forever.
    bail.current = setTimeout(finish, 6000);
  };

  useEffect(() => {
    cancelled.current = false;
    // If a previous run was interrupted part-way (strict mode, a hot reload),
    // let it run again from the top. Without this the fade it was relying on
    // to unmount itself has been stopped and never restarts, and the app sits
    // behind an opaque logo forever.
    if (started.current && !ended.current) started.current = false;
    // Never wait on a decode for longer than this: a missing or slow asset
    // must not be able to wedge the launch behind the splash.
    const guard = setTimeout(begin, 1200);
    return () => {
      cancelled.current = true;
      clearTimeout(guard);
      if (bail.current) clearTimeout(bail.current);
      anim.current?.stop();
    };
  }, []);

  const onLayerLoad = () => {
    loaded.current += 1;
    if (loaded.current >= ARCS.length + 1) begin();
  };

  if (done) return null;

  return (
    <Animated.View style={[st.fill, { opacity: fade }]} pointerEvents="none">
      <View style={{ width: BOX, height: BOX }}>
        {/* The disc carries the arc-shaped cut-outs, so it sits underneath and
            never animates — only the light inside it moves. */}
        <Image source={DISC} style={st.layer} resizeMode="contain" onLoad={onLayerLoad} />
        {ARCS.map((src, i) => (
          <Animated.Image
            key={i}
            source={src}
            style={[st.layer, { opacity: arcs[i] }]}
            resizeMode="contain"
            onLoad={onLayerLoad}
          />
        ))}
      </View>
    </Animated.View>
  );
}

/** Keep the native splash up until BrandIntro has taken over from it. */
export function holdSplashScreen() {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const st = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  layer: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    width: '100%',
    height: '100%',
  },
});
