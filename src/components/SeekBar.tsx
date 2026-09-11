import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';

import { useSessionKind } from '@/utils/sessionKind';
import type { ScrubApi } from '@/utils/useTrackClock';

/**
 * A little drop-top, driving the length of the song (owner, 13.08: "a little
 * car driving on the scrub", then "a cabriolet - a drop top"). The bar already
 * reads as a road — the played part lit, the rest ahead of you — so this costs
 * almost nothing and is the most on-brand detail available.
 *
 * IT SITS ABOVE THE BAR, not on it, and that is not a stylistic preference: at
 * the playhead the bar changes from solid white to dark, so a marker sitting
 * there is half over each and reads as a smudge whatever colour it is. Above
 * the line it is always against the backdrop, and the wheels overlap the road
 * by a few pixels so it is plainly ON it.
 *
 * It also replaces the old white dot rather than joining it. Nothing is lost:
 * the whole 36pt row is the touch target, not the dot, so the affordance was
 * never the dot's job.
 *
 * SIDE VIEW, FACING THE WAY IT IS TRAVELLING. `car-convertible` is drawn in
 * profile with the roof down and the screen raked forward, so at this size the
 * open top is legible and the nose points right — the same direction the bar
 * fills. A front-facing glyph was tried first (`taxi`, briefly shipped) and
 * loses that: a car coming at you does not read as one driving the song.
 */
const CAR = 25;
/**
 * How far the wheels sink into the road. Small: any deeper and they cross into
 * the played (white) half of the bar and disappear into it whenever the car's
 * own colour is pale. Sitting ON the surface keeps the whole silhouette against
 * the backdrop wherever it is along the song.
 */
const CAR_SIT = 6;

/**
 * The shared draggable progress bar. Touch anywhere on it and the position
 * jumps to your finger; drag to scrub; release to seek the real song (the
 * ScrubApi handles the Spotify call and restarting the clock). Claims the
 * touch on start so it can't lose the gesture to a parent swipe.
 */
/**
 * The car itself, exported because Vinyl carries its own copy of the bar (it
 * predates the shared one and grows its track while you scrub). One definition
 * rather than two, or the deck would end up the only mode without a car and
 * that would read as a bug.
 *
 * IT IS WHITE, not the station's accent. That was tried (13.08) and rolled
 * back on the owner's call: every mode already throws its station's colour, so
 * one more coloured object was the surface losing its one neutral marker.
 *
 * AND IT ONLY APPEARS WHEN THERE IS A DRIVE. Someone who has said "just
 * listening" gets a plain dot instead (owner, 13.08) — a car driving along the
 * bar is a small claim about what they are doing, and the whole point of that
 * setting is to stop the app claiming it.
 */
export function SeekCar({
  shift, trackH = 6, rowH = 36,
}: {
  shift: Animated.AnimatedInterpolation<number>;
  trackH?: number;
  rowH?: number;
}) {
  const kind = useSessionKind();
  if (kind === 'listening') return <SeekDot shift={shift} trackH={trackH} rowH={rowH} />;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -CAR / 2,
        // The track is centred in the row, so its top edge is at (rowH - trackH)/2.
        top: (rowH - trackH) / 2 - CAR + CAR_SIT,
        transform: [{ translateX: shift }],
      }}>
      {/* The shadow is what grounds it — without one it floats above the road,
          and it also separates a pale body from the white half of the bar at
          any position. Vector icons are text, so this is a text shadow rather
          than a view shadow. */}
      <MaterialCommunityIcons
        name="car-convertible"
        size={CAR}
        color="#ffffff"
        style={{
          textShadowColor: 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      />
    </Animated.View>
  );
}

/** The plain playhead, for anyone not driving. What the bar carried before the
 *  car, so nothing is lost — the whole 36pt row is still the touch target. */
const DOT = 12;

function SeekDot({
  shift, trackH = 6, rowH = 36,
}: {
  shift: Animated.AnimatedInterpolation<number>;
  trackH?: number;
  rowH?: number;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -DOT / 2,
        top: (rowH - DOT) / 2,
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        backgroundColor: '#ffffff',
        transform: [{ translateX: shift }],
      }}
    />
  );
}

export function SeekBar({ progress, scrub }: { progress: Animated.Value; scrub: ScrubApi }) {
  const [barW, setBarW] = useState(300);
  const wRef = useRef(300);
  const pctRef = useRef(0);
  const scrubRef = useRef(scrub);
  scrubRef.current = scrub;

  const set = (x: number) => {
    const pct = Math.max(0, Math.min(1, x / wRef.current));
    pctRef.current = pct;
    scrubRef.current.move(pct);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => { scrubRef.current.begin(); set(e.nativeEvent.locationX); },
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
      onPanResponderRelease: () => scrubRef.current.end(pctRef.current),
      onPanResponderTerminate: () => scrubRef.current.end(pctRef.current),
    })
  ).current;

  // SCALED, NOT RESIZED. This used to animate `width`, and width is a LAYOUT
  // property, so Animated cannot hand it to the native driver — every frame of
  // every song, in every mode, had to cross into JavaScript to move a white
  // bar. `scaleX` and `translateX` are both native-driver properties, so the
  // whole thing now runs off the JS thread entirely.
  //
  // The bar is drawn at full width and squashed. RN scales about a view's
  // CENTRE and has no transform-origin, so a plain scaleX(p) would shrink it
  // toward the middle from both ends; the paired translateX pins the left edge:
  // a view of width W scaled by p spans W(1-p)/2 .. W(1+p)/2, so shifting left
  // by W(1-p)/2 puts it back at 0..Wp. That shift is exactly linear in p, which
  // is why one interpolation from -W/2 to 0 is enough. (Same trick as the home
  // header's meter, which had the same problem with `height`.)
  //
  // The floor of 0.0001 matters: a scaleX of exactly 0 is a degenerate matrix.
  const fillScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.0001, 1], extrapolate: 'clamp' });
  const fillShift = progress.interpolate({ inputRange: [0, 1], outputRange: [-barW / 2, 0], extrapolate: 'clamp' });
  // The car rides OUTSIDE the scaled view on purpose — as a child it would be
  // squashed with it and come out stretched.
  const dotShift = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW], extrapolate: 'clamp' });

  return (
    <View
      style={{ width: '100%', height: 36, justifyContent: 'center' }}
      onLayout={(e) => { setBarW(e.nativeEvent.layout.width); wRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <Animated.View style={{
        position: 'absolute', left: 0, width: barW, height: 6, borderRadius: 3,
        backgroundColor: '#ffffff',
        transform: [{ translateX: fillShift }, { scaleX: fillScale }],
      }} />
      <SeekCar shift={dotShift} />
    </View>
  );
}
