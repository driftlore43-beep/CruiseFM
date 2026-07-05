import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cruise, Fonts } from '@/constants/theme';
import { WelcomeCueLine } from '@/components/WelcomeMessage';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

type HeroCardProps = {
  onStartDrive: () => void;
  /** e.g. "Resuming Night Run FM" or "Tonight's pick: Sunset FM" */
  cueLabel: string;
};

export function HeroCard({ onStartDrive, cueLabel }: HeroCardProps) {
  const handleStart = () => {
    triggerHaptic();
    onStartDrive();
  };

  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        {/* Gradient background */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.cardBg,
            // @ts-ignore
            {
              experimental_backgroundImage:
                'linear-gradient(150deg, #2C0B6E 0%, #15083C 40%, #0A0A22 100%)',
            },
          ]}
        />
        {/* Top-right ambient orb */}
        <View style={styles.orbTopRight} />
        {/* Bottom-left subtle orb */}
        <View style={styles.orbBottomLeft} />

        {/* ── Top row: weather (right-aligned) ── */}
        <View style={styles.topRow}>
          <View style={styles.weatherPill}>
            <Text style={styles.weatherIcon}>🌧</Text>
            <Text style={styles.weatherText}>68°  Light rain</Text>
          </View>
        </View>

        {/* ── Main copy ── */}
        <View style={styles.copyBlock}>
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
            <LinearGradient
              colors={['rgba(160,98,255,0.55)', 'rgba(123,56,224,0.40)', 'rgba(96,40,190,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.startBtnIcon}>▶</Text>
            <Text style={styles.startBtnText}>Start Drive</Text>
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
    borderColor: 'rgba(123, 56, 224, 0.3)',
    minHeight: 280,
  },
  cardBg: {
    borderRadius: 26,
  },
  orbTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(110, 40, 220, 0.22)',
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(40, 10, 100, 0.3)',
  },
  // ── Top row ──
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 6,
  },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  weatherIcon: {
    fontSize: 13,
  },
  weatherText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  clock: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Fonts?.mono ?? 'monospace',
  },
  // ── Copy ──
  copyBlock: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  eyebrow: {
    color: Cruise.violetLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 8,
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
    borderColor: 'rgba(180,130,255,0.35)',
    shadowColor: Cruise.violet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
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
