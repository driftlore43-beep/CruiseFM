import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

/**
 * Animated opening: starts pixel-identical to the native splash (mark centred
 * on dark graphite), then the violet broadcast arcs pulse outward one by one —
 * the station coming on air — before the whole thing lifts to reveal the app.
 *
 * Driven by one rAF clock (RN Animated stalls on web). Layers generated from
 * the master logo by scripts in assets/images/intro/, so they align exactly.
 */

const BG = '#0E0E14'; // must match expo-splash-screen backgroundColor
const MARK = 200;

const DISC = require('../../assets/images/intro/logo-disc.png');
const ARCS = [
  require('../../assets/images/intro/logo-arc-1.png'),
  require('../../assets/images/intro/logo-arc-2.png'),
  require('../../assets/images/intro/logo-arc-3.png'),
];

const END = 2.05; // seconds

/** 0 before start, 1 after start+dur, eased in between. */
function seg(t: number, start: number, dur: number) {
  const p = Math.min(1, Math.max(0, (t - start) / dur));
  return 1 - (1 - p) * (1 - p); // ease-out quad
}

export function BrandIntro() {
  const [t, setT] = useState(0);
  const [done, setDone] = useState(false);
  const start = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = () => {
      const now = Date.now();
      // Clock starts at the first rendered frame, not at mount — a slow
      // bundle load must not eat the animation.
      if (!start.current) start.current = now;
      if (now - last >= 33) {
        last = now;
        const secs = (now - start.current) / 1000;
        setT(secs);
        if (secs > END) { setDone(true); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Failsafe: if frames ever stall (throttled webview, background tab),
    // never leave the intro blocking the app.
    const kill = setTimeout(() => setDone(true), (END + 0.6) * 1000);
    return () => { cancelAnimationFrame(raf); clearTimeout(kill); };
  }, []);

  if (done) return null;

  const discIn = seg(t, 0, 0.45);
  // Broadcast pulse: inner arc first, outward, with a soft breathe after.
  const arcIn = [seg(t, 0.5, 0.3), seg(t, 0.68, 0.3), seg(t, 0.86, 0.3)];
  const breathe = t > 1.25 && t < 1.65 ? 1 - 0.3 * Math.sin(((t - 1.25) / 0.4) * Math.PI) : 1;
  const wordIn = seg(t, 0.95, 0.4);
  const fadeOut = 1 - seg(t, 1.75, 0.3);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { opacity: fadeOut }]} pointerEvents={t > 1.7 ? 'none' : 'auto'}>
      <View style={{ width: MARK, height: MARK }}>
        <Image
          source={DISC}
          style={[
            StyleSheet.absoluteFill,
            { width: MARK, height: MARK, opacity: discIn, transform: [{ scale: 0.9 + 0.1 * discIn }] },
          ]}
        />
        {ARCS.map((src, i) => (
          <Image
            key={i}
            source={src}
            style={[
              StyleSheet.absoluteFill,
              {
                width: MARK, height: MARK,
                opacity: arcIn[i] * breathe,
                transform: [{ scale: 0.94 + 0.06 * arcIn[i] }],
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.word, { opacity: wordIn }]}>CRUISE FM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
    gap: 22,
  },
  word: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 6 },
});
