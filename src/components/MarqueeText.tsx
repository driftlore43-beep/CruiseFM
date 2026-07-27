import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * A one-line title that pans across once when it's too long to fit, then
 * stops. Short titles sit still. The pan runs a single out-and-back (reveal
 * the end, ease back to the start) and does not loop — a gentle reveal, not a
 * ticker.
 *
 * Measuring trick: iOS constrains a Text to its container's width and
 * ellipsizes BEFORE layout reports, so measuring the visible text always
 * says "it fits". A hidden ghost copy gets a huge width (so it can never
 * truncate) and reports the REAL line width via onTextLayout; the visible
 * text is then given that exact width so nothing ellipsizes, and the pan
 * covers the true overflow.
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

  const overflowing = textW - boxW > 4 && boxW > 0;

  return (
    <View style={styles.box} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Animated.Text
        numberOfLines={1}
        // Real intrinsic width once known — otherwise iOS ellipsizes at the
        // box edge and there is nothing left to reveal.
        style={[style, overflowing && { width: textW + 8 }, { flexShrink: 0, transform: [{ translateX: tx }] }]}>
        {text}
      </Animated.Text>
      {/* Ghost measurer — unbounded width so it can never truncate; reports
          the true single-line width. Invisible and untouchable. */}
      <Text
        numberOfLines={1}
        onTextLayout={(e) => {
          const w = Math.ceil(e.nativeEvent.lines?.[0]?.width ?? 0);
          if (w > 0) setTextW(w);
        }}
        style={[style, styles.ghost]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden', flexDirection: 'row' },
  ghost: { position: 'absolute', opacity: 0, width: 10000, left: 0, top: 0 },
});
