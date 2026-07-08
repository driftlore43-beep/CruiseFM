import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Cruise } from '@/constants/theme';

const AMBER      = '#F59E0B';
const AMBER_SOFT = 'rgba(245,158,11,0.14)';
const AMBER_LINE = 'rgba(245,158,11,0.35)';

const FEATURES: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'album',
    title: 'Premium Music Modes',
    desc: 'Vinyl, Retro Radio and the Circular Wave orb — the richest ways to drive.',
  },
  {
    icon: 'palette',
    title: 'Visual Mood Themes',
    desc: 'Every premium mood palette, plus unique imagery and colour.',
  },
  {
    icon: 'playlist-music',
    title: 'Unlimited Playlists',
    desc: 'Build as many custom stations as your drives demand.',
  },
  {
    icon: 'star-four-points',
    title: 'Future Premium Additions',
    desc: 'New modes and moods, added over time — always included.',
  },
];

const COMPARISON: { label: string; free: boolean; premium: boolean }[] = [
  { label: 'Cassette & Equalizer modes', free: true,  premium: true },
  { label: 'Basic playback controls',    free: true,  premium: true },
  { label: 'Badges & achievements',      free: true,  premium: true },
  { label: 'Vinyl, Radio & Orb modes',   free: false, premium: true },
  { label: 'All premium mood themes',    free: false, premium: true },
  { label: 'Unlimited custom playlists', free: false, premium: true },
  { label: 'Future premium modes',       free: false, premium: true },
];

function TickCell({ on, amber }: { on: boolean; amber?: boolean }) {
  return (
    <View style={styles.compareIconCell}>
      <MaterialCommunityIcons
        name={on ? 'check' : 'minus'}
        size={16}
        color={on ? (amber ? AMBER : 'rgba(255,255,255,0.85)') : 'rgba(255,255,255,0.25)'}
      />
    </View>
  );
}

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();

  function handleUnlock() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: wire to RevenueCat purchase flow (Week 4 — Paywall & Pro).
  }

  return (
    <View style={styles.root}>
      {/* Warm amber ambience */}
      <LinearGradient
        colors={['#1c1206', '#120b04', '#0a0602']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={17} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.crestWrap}>
              <MaterialCommunityIcons name="star-four-points" size={28} color={AMBER} />
            </View>
            <Text style={styles.title}>Cruise FM Premium</Text>
            <Text style={styles.subtitle}>Unlock the full driving atmosphere.</Text>
          </View>

          {/* Feature cards */}
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <MaterialCommunityIcons name={f.icon} size={22} color="#fff" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Comparison */}
          <Text style={styles.sectionLabel}>FREE VS PREMIUM</Text>
          <View style={styles.compareCard}>
            <View style={styles.compareHeadRow}>
              <Text style={[styles.compareCell, styles.compareFeatureHead]}>Feature</Text>
              <Text style={[styles.compareCol, styles.compareColHead]}>Free</Text>
              <Text style={[styles.compareCol, styles.compareColHead, { color: AMBER }]}>Premium</Text>
            </View>
            {COMPARISON.map((row, i) => (
              <View
                key={row.label}
                style={[styles.compareRow, i < COMPARISON.length - 1 && styles.compareRowBorder]}>
                <Text style={styles.compareCell}>{row.label}</Text>
                <TickCell on={row.free} />
                <TickCell on={row.premium} amber />
              </View>
            ))}
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>£2.99</Text>
            <Text style={styles.pricePer}>/ month</Text>
          </View>
          <Text style={styles.trialNote}>7-day free trial · cancel anytime</Text>

          {/* CTAs */}
          <Pressable style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.9 }]} onPress={handleUnlock}>
            <LinearGradient
              colors={['#F7B733', '#F59E0B']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.unlockGradient}>
              <Text style={styles.unlockText}>Unlock Premium</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.laterText}>Maybe Later</Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0602' },
  glowOrb: {
    position: 'absolute',
    top: '6%',
    alignSelf: 'center',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  content: { paddingHorizontal: 22, paddingTop: 48 },

  header: { alignItems: 'center', marginBottom: 32 },
  crestWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: AMBER_SOFT,
    borderWidth: 1, borderColor: AMBER_LINE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#fff', fontSize: 27, fontWeight: '700',
    letterSpacing: 0.2, marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14.5,
    textAlign: 'center', lineHeight: 20,
  },

  featureList: { gap: 12, marginBottom: 32 },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.16)',
  },
  featureIconWrap: {
    width: 46, height: 46, borderRadius: 13,
    backgroundColor: AMBER_SOFT,
    borderWidth: 1, borderColor: AMBER_LINE,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 3 },
  featureTitle: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  featureDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 18 },

  sectionLabel: {
    color: 'rgba(245,158,11,0.7)', fontSize: 10.5, fontWeight: '800',
    letterSpacing: 2, marginBottom: 12,
  },
  compareCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  compareHeadRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  compareRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  compareCell: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 13, paddingRight: 8 },
  compareFeatureHead: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  compareCol: { width: 58, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  compareColHead: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 0.5 },
  compareIconCell: { width: 58, alignItems: 'center' },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  price: { color: '#fff', fontSize: 34, fontWeight: '800' },
  pricePer: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  trialNote: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12.5,
    textAlign: 'center', marginTop: 6, marginBottom: 22,
  },

  unlockBtn: {
    borderRadius: 16, overflow: 'hidden',
    shadowColor: AMBER, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 10,
  },
  unlockGradient: { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  unlockText: { color: '#2a1a00', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  laterBtn: { alignItems: 'center', paddingTop: 16 },
  laterText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' },
});
