import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { GlossSheen } from '@/components/GlossSheen';
import { MirrorBallGlyph } from '@/components/MirrorBallGlyph';
import { PremiumShimmer } from '@/components/PremiumShimmer';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';

// ── Spinning cassette reel (featured card visual) ─────────────────────────────
function Reel({ size = 64 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[reel.wrap, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate }] }]}>
      {[0, 60, 120].map((deg) => (
        <View key={deg} style={[reel.spoke, { transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
      <View style={reel.hub} />
    </Animated.View>
  );
}

const reel = StyleSheet.create({
  wrap: {
    borderWidth: 3,
    borderColor: 'rgba(150,90,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: {
    position: 'absolute',
    width: '86%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(150,90,255,0.45)',
  },
  hub: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(150,90,255,0.8)',
  },
});

// ── Card with press-extend + scroll-shrink animation ─────────────────────────
function AnimatedCard({
  scrollY,
  onPress,
  children,
  style,
}: {
  scrollY: Animated.Value;
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const [layoutY, setLayoutY] = useState(0);
  const [layoutH, setLayoutH] = useState(1);
  const pressScale = useRef(new Animated.Value(1)).current;

  // As the card scrolls up toward/off the top edge, it "caves in".
  const scrollScale = scrollY.interpolate({
    inputRange: [layoutY - 80, layoutY + layoutH],
    outputRange: [1, 0.88],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      onLayout={(e) => { setLayoutY(e.nativeEvent.layout.y); setLayoutH(e.nativeEvent.layout.height); }}
      style={[{ transform: [{ scale: Animated.multiply(pressScale, scrollScale) }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(pressScale, { toValue: 1.03, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
        onPressOut={() => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ── Glitter scattered around a card ───────────────────────────────────────────
// Deterministic scatter (no Math.random — the specks must not jump about on
// every re-render), each twinkling on its own native-driver loop. The layer
// deliberately sits OUTSIDE the card's rounded clip so the sparkle spills past
// the edges, which is the whole point of "glitter surrounding it".
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Speck({ left, top, r, cross, dur, delay }: {
  left: `${number}%`; top: `${number}%`; r: number; cross: boolean; dur: number; delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.9] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const box = r * (cross ? 7 : 2);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left, top, width: box, height: box, marginLeft: -box / 2, marginTop: -box / 2,
        alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }],
      }}>
      {/* The hairline cross-flare is what separates "glitter" from "a dot" */}
      {cross && <View style={{ position: 'absolute', width: box, height: 1, backgroundColor: '#fff', opacity: 0.5 }} />}
      {cross && <View style={{ position: 'absolute', width: 1, height: box, backgroundColor: '#fff', opacity: 0.5 }} />}
      <View style={{
        width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#fff',
        shadowColor: '#dbe6ff', shadowOpacity: 0.95, shadowRadius: r * 2.6, shadowOffset: { width: 0, height: 0 },
      }} />
    </Animated.View>
  );
}

function CardGlitter({ count = 16 }: { count?: number }) {
  const specks = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Walk the card's perimeter rather than scattering over the whole box —
    // glitter dropped at random lands on top of the title and reads as dirt.
    // Round the edges it frames the card, which is what was asked for.
    const p = ((i + hash01(i * 1.73) * 0.75) / count) % 1;
    let x: number, y: number, along: 'h' | 'v';
    if (p < 0.4)       { x = p / 0.4;                 y = 0; along = 'h'; }
    else if (p < 0.5)  { x = 1;                       y = (p - 0.4) / 0.1; along = 'v'; }
    else if (p < 0.9)  { x = 1 - (p - 0.5) / 0.4;     y = 1; along = 'h'; }
    else               { x = 0;                       y = 1 - (p - 0.9) / 0.1; along = 'v'; }
    // Drift each speck off its edge so the ring isn't a dotted outline.
    const off = (hash01(i * 4.91 + 2.2) - 0.4) * 0.22;
    if (along === 'h') y = Math.max(-0.03, Math.min(1.03, y + (y < 0.5 ? off : -off)));
    else               x = Math.max(-0.03, Math.min(1.03, x + (x < 0.5 ? off : -off)));
    return {
      left: `${Number((x * 100).toFixed(1))}%` as `${number}%`,
      top: `${Number((y * 100).toFixed(1))}%` as `${number}%`,
      r: 0.9 + hash01(i * 5.31) * 1.6,
      cross: hash01(i * 6.07) > 0.42,
      dur: 850 + Math.floor(hash01(i * 2.23) * 1500),
      delay: Math.floor(hash01(i * 9.41) * 2600),
    };
  }), [count]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10, right: -10, top: -10, bottom: -10 }}>
      {specks.map((s, i) => <Speck key={i} {...s} />)}
    </View>
  );
}

// ── Compact mode row card ─────────────────────────────────────────────────────
function CompactModeCard({
  title,
  desc,
  icon,
  iconNode,
  gradient,
  locked,
  premium = false,
  silver = false,
  glitter = false,
}: {
  title: string;
  desc: string;
  icon?: string;
  /** Drawn icon, for modes an icon font has no glyph for (the mirror ball). */
  iconNode?: React.ReactNode;
  gradient: [string, string, string];
  locked: boolean;
  premium?: boolean;
  /** Frosted white/silver glass instead of a coloured slab. */
  silver?: boolean;
  glitter?: boolean;
}) {
  return (
    // The glow lives on the wrapper, not the card: the card clips its own
    // children (overflow hidden for the rounded gradient), and on iOS that
    // clips the shadow with them.
    <View style={silver && styles.silverGlow}>
      <View style={[styles.compactCard, silver && styles.silverCard]}>
        {/* Silver runs on the diagonal — a bright top-left corner falling away
            to the bottom-right is what makes a neutral wash read as polished
            metal rather than flat grey. */}
        <LinearGradient
          colors={gradient}
          start={silver ? { x: 0, y: 0 } : { x: 0, y: 0.5 }}
          end={silver ? { x: 1, y: 1 } : { x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {premium && <GlossSheen radius={18} />}
        {locked && <PremiumShimmer />}
        <View style={[styles.compactIconWrap, silver && styles.silverIconWrap]}>
          {iconNode ?? <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.compactTitle}>{title}</Text>
          <Text style={styles.compactDesc} numberOfLines={2}>{desc}</Text>
        </View>
        {locked && <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.55)" style={{ marginLeft: 8 }} />}
      </View>
      {glitter && <CardGlitter />}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ModesScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const np = useNowPlaying();

  const { isPro } = useEntitlements();

  function open(mode: string, locked: boolean) {
    // Locked modes give a free taste — the gate handles the upsell after.
    // Browsing modes opens them idle; previews auto-play so the taste moves.
    np.open(mode, undefined, { preview: locked, paused: !locked });
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}>

        <Text style={styles.pageTitle}>Playback Modes</Text>

        {/* ── Featured: Cassette ── */}
        <AnimatedCard scrollY={scrollY} onPress={() => open('cassette', false)} style={{ marginBottom: 16 }}>
          <View style={styles.featuredCard}>
            <LinearGradient
              colors={['#241238', '#170d28', '#0d0718']}
              start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.featuredHeader}>
              <Text style={styles.featuredTitle}>Cassette Tape Mode</Text>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>FEATURED</Text>
              </View>
            </View>

            <Text style={styles.tapeLabel}>CRUISE FM / SIDE A</Text>
            <View style={styles.tapeWindow}>
              <Reel />
              <Reel />
            </View>

            <Text style={styles.featuredDesc}>
              Spinning reels, retro Japanese tuner culture, soft purple cabin glow.
            </Text>
          </View>
        </AnimatedCard>

        {/* ── Compact rows ── */}
        <AnimatedCard scrollY={scrollY} onPress={() => open('equalizer', false)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Equalizer Mode"
            desc="LED bars pulsing with every station's mood colours."
            icon="equalizer"
            gradient={['#164a6a', '#123049', '#0a1a2a']}
            locked={false}
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('orb', false)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Circular Equaliser Mode"
            desc="A glowing orb of light that pulses and radiates to your station's mood."
            icon="circle-slice-8"
            gradient={['#b23ae6', '#7a2ac0', '#2a1550']}
            locked={false}
          />
        </AnimatedCard>

        {/* ── Premium modes stacked together at the bottom ── */}
        <Text style={styles.sectionLabel}>PREMIUM</Text>

        <AnimatedCard scrollY={scrollY} onPress={() => open('vinyl', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Vinyl Record Mode"
            desc="Rotating analogue record with warm ambient glow and tactile presence."
            icon="album"
            gradient={['#c05a20', '#8a3a18', '#3a180a']}
            locked={!isPro}
            premium
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('radio', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Tuner Mode"
            desc="Drag the dial — glide between moods and lock onto a station."
            icon="radio-tower"
            gradient={['#6a3ae0', '#3a6aa8', '#1a8a9a']}
            locked={!isPro}
            premium
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('horizon', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Horizon Mode"
            desc="An endless outrun grid rolling into a glowing sun — all in your station's colours."
            icon="weather-sunset-up"
            gradient={['#b02a8a', '#5a1a8a', '#200a45']}
            locked={!isPro}
            premium
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('cd', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="CD Mode"
            desc="Your album on a mirrored disc, spinning behind jewel-case plastic."
            icon="disc"
            gradient={['#5a6f9a', '#8a4fd0', '#141a2e']}
            locked={!isPro}
            premium
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('disco', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Mirror Ball Mode"
            desc="A slow-turning mirror ball scattering light across your night drive."
            iconNode={<MirrorBallGlyph size={26} />}
            gradient={['rgba(255,255,255,0.30)', 'rgba(203,220,252,0.17)', 'rgba(255,255,255,0.07)']}
            locked={!isPro}
            premium
            silver
            glitter
          />
        </AnimatedCard>

      </Animated.ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  pageTitle: {
    color: Cruise.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginLeft: 4,
    marginBottom: 18,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginLeft: 4,
    marginTop: 8,
    marginBottom: 12,
  },

  // Featured card
  featuredCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150,90,255,0.25)',
    padding: 20,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  featuredBadge: {
    backgroundColor: 'rgba(60,220,230,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(60,220,230,0.45)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featuredBadgeText: {
    color: '#3cdce6',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tapeLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 10,
  },
  tapeWindow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(150,90,255,0.35)',
    borderRadius: 12,
    paddingVertical: 18,
    marginBottom: 18,
    backgroundColor: 'rgba(150,90,255,0.05)',
  },
  featuredDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 19,
  },

  // Compact cards
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  // Frosted silver glass — no colour slab, just white at low opacity over the
  // app's own dark background, with a bright rim and a cool outward glimmer.
  silverCard: {
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(150,168,205,0.10)',
  },
  silverGlow: {
    borderRadius: 18,
    shadowColor: '#cfe0ff',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  compactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silverIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  compactTitle: {
    color: '#fff',
    fontSize: 15.5,
    fontWeight: '800',
  },
  compactDesc: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 17,
  },
});
