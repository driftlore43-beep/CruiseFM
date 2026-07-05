import { useEffect, useRef, useState } from 'react';
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
import { router } from 'expo-router';

import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { CassetteFullscreen } from '@/components/CassetteMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { RetroRadioFullscreen } from '@/components/RetroRadioMode';
import { OWNER_MODE } from '@/constants/config';
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

// ── Compact mode row card ─────────────────────────────────────────────────────
function CompactModeCard({
  title,
  desc,
  icon,
  gradient,
  locked,
}: {
  title: string;
  desc: string;
  icon: string;
  gradient: [string, string, string];
  locked: boolean;
}) {
  return (
    <View style={styles.compactCard}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <View style={styles.compactIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.compactTitle}>{title}</Text>
        <Text style={styles.compactDesc} numberOfLines={2}>{desc}</Text>
      </View>
      {locked && <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.55)" style={{ marginLeft: 8 }} />}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ModesScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeMode, setActiveMode] = useState<string | null>(null);

  const isPro = OWNER_MODE;

  function open(mode: string, locked: boolean) {
    if (locked) { router.push('/premium'); return; }
    setActiveMode(mode);
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

        <AnimatedCard scrollY={scrollY} onPress={() => open('vinyl', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Vinyl Record Mode"
            desc="Rotating analogue record with warm ambient glow and tactile presence."
            icon="album"
            gradient={['#c05a20', '#8a3a18', '#3a180a']}
            locked={!isPro}
          />
        </AnimatedCard>

        <AnimatedCard scrollY={scrollY} onPress={() => open('radio', !isPro)} style={{ marginBottom: 14 }}>
          <CompactModeCard
            title="Retro FM Radio Mode"
            desc="Glowing frequency dial and a satisfying weighted tuner slider."
            icon="radio"
            gradient={['#6a3ae0', '#3a6aa8', '#1a8a9a']}
            locked={!isPro}
          />
        </AnimatedCard>

      </Animated.ScrollView>

      <EqualizerFullscreen visible={activeMode === 'equalizer'} onClose={() => setActiveMode(null)} />
      <CassetteFullscreen visible={activeMode === 'cassette'} onClose={() => setActiveMode(null)} />
      <VinylFullscreen visible={activeMode === 'vinyl'} onClose={() => setActiveMode(null)} />
      <RetroRadioFullscreen visible={activeMode === 'radio'} onClose={() => setActiveMode(null)} />
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
