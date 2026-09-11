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
 * says "it fits". A hidden ghost copy sits in a 10000-wide row (so it can
 * never truncate) and reports the REAL line width; the visible text is then
 * given that exact width so nothing ellipsizes, and the pan covers the true
 * overflow.
 *
 * TWO measurements, not one, and the second is what makes this TESTABLE:
 * `onTextLayout` is not implemented in react-native-web at all, so in the
 * web build the ghost never reported, the overflow always read as zero and
 * NO title in the app ever panned — which is indistinguishable from a broken
 * marquee when you are looking at a screenshot. `onLayout` is implemented on
 * both, and inside a row that wide a Text lays out to its natural width, so
 * it measures the same thing. The larger of the two wins; each is stored
 * separately so a change of song replaces both rather than sticking at the
 * longest title ever seen.
 */
export function MarqueeText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const tx = useRef(new Animated.Value(0)).current;
  const [boxW, setBoxW] = useState(0);
  const [linesW, setLinesW] = useState(0);
  const [layoutW, setLayoutW] = useState(0);
  const textW = Math.max(linesW, layoutW);

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
      {/* THE WIDTH GOES ON A VIEW, NOT ON THE TEXT. Setting it on the Text
          works on iOS but not in the web build, where the text stayed
          squeezed to the box and panning simply carried the ellipsized line
          out of sight — a title that scrolled away to nothing. A View honours
          an explicit width on both, so the two platforms now agree and the
          harness can actually see this working. */}
      <Animated.View
        style={[
          overflowing ? { width: textW + 8 } : { flex: 1 },
          { flexShrink: 0, transform: [{ translateX: tx }] },
        ]}>
        <Text numberOfLines={1} style={style}>{text}</Text>
      </Animated.View>
      {/* Ghost measurer — unbounded width so it can never truncate; reports
          the true single-line width. Invisible and untouchable. */}
      <View style={styles.ghostWrap} pointerEvents="none">
        <Text
          numberOfLines={1}
          onTextLayout={(e) => setLinesW(Math.ceil(e.nativeEvent.lines?.[0]?.width ?? 0))}
          onLayout={(e) => setLayoutW(Math.ceil(e.nativeEvent.layout.width))}
          style={[style, styles.ghostText]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', overflow: 'hidden', flexDirection: 'row' },
  // The row is huge so nothing can ever truncate inside it; the text itself
  // is left to its natural width, which is the number being measured.
  ghostWrap: { position: 'absolute', opacity: 0, left: 0, top: 0, width: 10000, flexDirection: 'row' },
  ghostText: { flexShrink: 0 },
});
