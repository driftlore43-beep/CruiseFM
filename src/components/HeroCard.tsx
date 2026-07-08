import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cruise } from '@/constants/theme';
import { GlossSheen } from '@/components/GlossSheen';
import { StationBackdrop } from '@/components/StationBackdrop';
import { WelcomeCueLine } from '@/components/WelcomeMessage';
import { useMotion } from '@/context/MotionContext';
import type { Station } from '@/constants/stations';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

type HeroCardProps = {
  onStartDrive: () => void;
  /** e.g. "Tonight's pick: Sunset FM" or "Night Run FM · iPod mode" */
  cueLabel: string;
  /** The station the button will launch — its photo becomes the hero scene. */
  station: Station;
  /** "Start Drive" fresh, "Continue Drive" when resuming. */
  buttonLabel?: string;
  driverName?: string;
};

export function HeroCard({ onStartDrive, cueLabel, station, buttonLabel = 'Start Drive', driverName = 'Night Driver' }: HeroCardProps) {
  const { dataSaver } = useMotion();
  const handleStart = () => {
    triggerHaptic();
    onStartDrive();
  };

  const glowTint = (station.eqColors?.[1] ?? Cruise.violet) + '22';

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        {/* Tonight's pick, full bleed — the hero always animates (a taste of
            motion for everyone), unless Data Saver forces stills */}
        <StationBackdrop station={station} blurRadius={2} motionAllowed={!dataSaver} />
        {/* Dark fade so the copy stays readable over any photo */}
        <LinearGradient
          colors={[
            'rgba(2,2,12,0.30)',
            'rgba(2,2,12,0.18)',
            'rgba(2,2,12,0.38)',
            'rgba(2,2,12,0.62)',
          ]}
          locations={[0, 0.35, 0.68, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Soft mood tint pulled from the station's own palette */}
        <LinearGradient
          colors={['transparent', glowTint]}
          start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* ── Main copy ── */}
        <View style={styles.copyBlock}>
          <Text style={styles.greeting}>Welcome back, {driverName}</Text>
          <Text style={styles.title}>Let’s cruise.</Text>
          {/* Greeting fades in first, then cross-fades into the cue label */}
          <WelcomeCueLine cueLabel={cueLabel} />
        </View>

        {/* ── One big Start Drive button ── */}
        <View style={styles.buttonsRow}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
            onPress={handleStart}
            hitSlop={8}>
            {/* White glass — translucent, the scene glows through */}
            <LinearGradient
              colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <GlossSheen radius={18} />
            <Ionicons name="play" size={17} color="#fff" style={styles.startBtnIcon} />
            <Text style={styles.startBtnText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer shadow halo — separate from overflow:hidden inner
  cardShadow: {
    marginHorizontal: 16,
    marginBottom: 28,
    borderRadius: 26,
    shadowColor: Cruise.violet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 12,
  },
  card: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    minHeight: 280,
    backgroundColor: '#0A0A22',
  },
  // ── Copy ──
  copyBlock: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 10,
    gap: 8,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },
  // ── Buttons ──
  buttonsRow: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 24,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  startBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  startBtnIcon: {
    fontSize: 18,
    color: '#fff',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
