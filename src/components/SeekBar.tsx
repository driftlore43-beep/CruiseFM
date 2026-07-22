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

  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });

  return (
    <View
      style={{ width: '100%', height: 36, justifyContent: 'center' }}
      onLayout={(e) => { setBarW(e.nativeEvent.layout.width); wRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <Animated.View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, width: fillW, backgroundColor: '#ffffff' }}>
        <View style={{
          position: 'absolute', right: -DOT / 2, top: -(DOT / 2 - 3),
          width: DOT, height: DOT, borderRadius: DOT / 2,
          backgroundColor: '#ffffff',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }} />
      </Animated.View>
    </View>
  );
}
