import { useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * The deck comes forward while you wind it.
 *
 * Owner, 18.08: "when the users scrub the CD, and vinyl mode can it have a
 * haptic and enlarge and blur the background, so it feels focused."
 *
 * ENLARGE AND VEIL, NOT BLUR, and the reason is a crash rather than a
 * preference. There is no animatable blur available to us: `blurRadius` on a
 * live image re-blurs the whole photograph on the main thread every time it is
 * re-displayed, and iOS killed the app for exactly that (see the note in
 * StationBackdrop, which is why the stations ship a pre-blurred FILE instead).
 * Animating it sixty times a second would be that same fault, continuously.
 *
 * So the focus is built from the two cues a camera actually gives you when it
 * racks focus onto something near: the subject grows, and everything behind it
 * both DARKENS and drifts slightly wider. The scale on the backdrop is small
 * and is most of what sells it — a veil alone reads as the lights going down,
 * while a veil plus a little push reads as the background falling away.
 *
 * Everything here is opacity and transform, so it all runs on the native
 * driver and none of it touches the JS thread mid-gesture — which matters,
 * because the gesture is on that thread doing angle maths every frame.
 */
export type ScrubFocus = {
  /** 0 resting, 1 fully wound-in. */
  focus: Animated.Value;
  /** The deck's own scale — put it on the object that is being turned. */
  objectScale: Animated.AnimatedInterpolation<number>;
  /** The backdrop's scale — a slight push, so it reads as falling away. */
  backdropScale: Animated.AnimatedInterpolation<number>;
  /** How dark the veil over the backdrop sits. */
  veilOpacity: Animated.AnimatedInterpolation<number>;
  begin: () => void;
  end: () => void;
};

/** How much bigger the record or the disc gets. Small on purpose: the object
 *  nearly fills its pane already, so anything larger crops against the edges
 *  and reads as a glitch rather than a lean-in. */
const OBJECT_SCALE = 1.06;
/** The background's drift. Bigger than the deck's, because a push outwards is
 *  the strongest defocus cue available to us with no blur to animate — and it
 *  has to carry what the blur would have. Measured at 1.05 it was invisible
 *  next to the veil; at 1.10 the picture plainly falls away. */
const BACKDROP_SCALE = 1.10;
/** Deep enough to push the picture back, light enough that the station is
 *  still plainly there behind the deck — the mood is the product, and a scrub
 *  must not black it out. Measured on the backdrop's own lit areas: about a
 *  third darker while the finger is down. */
const VEIL = 0.52;

/** Fast in — the hand is already moving and the response has to feel
 *  immediate — and slower out, so letting go settles rather than snaps. */
const IN_MS = 170;
const OUT_MS = 320;

/**
 * @param objectScale How much the deck grows. The default suits an object with
 *   room around it; a mode whose object already runs close to the screen edges
 *   must pass something smaller, or the lean-in crops it — the CD's jewel case
 *   sits at 97% of the window and came out with its corners sliced off, which
 *   reads as a glitch rather than as focus.
 */
export function useScrubFocus(objectScale = OBJECT_SCALE): ScrubFocus {
  const focus = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);

  return useMemo(() => {
    const run = (to: number, duration: number) => {
      anim.current?.stop();
      anim.current = Animated.timing(focus, {
        toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      anim.current.start();
    };
    return {
      focus,
      objectScale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, objectScale] }),
      backdropScale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, BACKDROP_SCALE] }),
      veilOpacity: focus.interpolate({ inputRange: [0, 1], outputRange: [0, VEIL] }),
      begin: () => run(1, IN_MS),
      end: () => run(0, OUT_MS),
    };
  }, [focus, objectScale]);
}
