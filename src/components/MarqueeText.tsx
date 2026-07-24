import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * A one-line title that pans across once when it's too long to fit, then
 * stops. Short titles sit still. The pan runs a single out-and-back (reveal
 * the end, ease back to the start) and does not loop — a gentle reveal, not a
 * ticker. Used for song titles, which can run long.
 */
export function MarqueeText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const tx = useRef(new Animated.Value(0)).current;
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);

  useEffect(() => {
    tx.stopAnimation();
    tx.setValue(0);
    const overflow = textW - boxW;
    if (overflow > 4 && boxW > 0) {
      const travel = overflow + 6;
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(tx, { toValue: -travel, duration: Math.max(1600, travel * 22), easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(tx, { toValue: 0, duration: Math.max(1200, travel * 16), easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]).start(); // no loop — settles back at the start and stops
    }
    return () => tx.stopAnimation();
  }, [text, textW, boxW]);

  return (
    <View style={styles.box} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      {/* Not width-constrained, so it lays out at its natural width and the
          box clips the overflow; that natural width is what we measure. */}
      <Animated.Text
        numberOfLines={1}
        onLayout={(e) => setTextW(e.nativeEvent.layout.width)}
        // flexShrink: 0 is the load-bearing part — without it the row
        // compresses the text to the box and ellipsizes it BEFORE we measure,
        // so long titles read "…"-chopped and the pan never fires.
        style={[style, { flexShrink: 0, transform: [{ translateX: tx }] }]}>
        {text}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden', flexDirection: 'row' },
});
