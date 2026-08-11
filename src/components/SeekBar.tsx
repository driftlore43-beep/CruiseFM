import { useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';

import type { ScrubApi } from '@/utils/useTrackClock';

const DOT = 14;

/**
 * The shared draggable progress bar. Touch anywhere on it and the position
 * jumps to your finger; drag to scrub; release to seek the real song (the
 * ScrubApi handles the Spotify call and restarting the clock). Claims the
 * touch on start so it can't lose the gesture to a parent swipe.
 */
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
  // The dot rides OUTSIDE the scaled view on purpose — as a child it would be
  // squashed with it and read as an ellipse.
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
      <Animated.View style={{
        position: 'absolute', left: -DOT / 2,
        width: DOT, height: DOT, borderRadius: DOT / 2,
        backgroundColor: '#ffffff',
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 }, elevation: 4,
        transform: [{ translateX: dotShift }],
      }} />
    </View>
  );
}
