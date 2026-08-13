import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { StationBackdrop } from '@/components/StationBackdrop';
import { useMotion } from '@/context/MotionContext';
import type { Station } from '@/constants/stations';

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

type HeroCardProps = {
  onStartDrive: () => void;
  /** e.g. "Tonight's pick: Sunset AM" or "Night Run AM · Vinyl mode" */
  cueLabel: string;
  /** The station the button will launch — its photo becomes the hero scene. */
  station: Station;
  /** "Start Drive" fresh, "Continue Drive" when resuming. */
  buttonLabel?: string;
  /** Is there something to pick up? Passed rather than sniffed out of
   *  buttonLabel — see the eyebrow below. */
  resuming?: boolean;
};

/**
 * The one big thing on the home page (owner's pick, 29.07 — "H2", the shape
 * Apple Music's Listen Now uses).
 *
 * WHAT CHANGED AND WHY: the old hero was 280pt tall with the title at the top,
 * a full-width glass button in the middle, and then two hundred pixels of
 * photograph doing nothing underneath — a gap, not space. The copy now sits at
 * the bottom where the scrim is deepest, and the button is a single white disc
 * beside it. Everything above that line is just the picture.
 *
 * The white disc also stops the page having two competing calls to action: the
 * old wide glass button was the loudest object on the screen, competing with
 * the mini player for attention. A disc reads as "play" without shouting.
 */
export function HeroCard({ onStartDrive, cueLabel, station, buttonLabel = 'Start Drive', resuming = false }: HeroCardProps) {
  const { dataSaver } = useMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 42, bounciness: 5 }).start();

  const handleStart = () => {
    triggerHaptic();
    onStartDrive();
  };

  // This used to read the word "continue" out of buttonLabel, which broke the
  // moment the label could say "Keep Listening" instead: a returning desk
  // listener was told TONIGHT'S PICK for a station they were halfway through.
  // Meaning comes from the caller now, not from parsing the copy.
  const eyebrow = resuming ? 'PICK UP WHERE YOU LEFT OFF' : 'TONIGHT’S PICK';

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handleStart}
        onPressIn={() => press(0.985)}
        onPressOut={() => press(1)}
        accessibilityLabel={buttonLabel}>
        <View style={styles.card}>
          <StationBackdrop station={station} blurRadius={1.2} motionAllowed={!dataSaver} />
          {/* Deep at the bottom where the type lives, barely there at the top
              so the photograph is actually visible. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0.92)']}
            locations={[0, 0.42, 0.76, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.foot}>
            <View style={styles.copy}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text style={styles.title}>Let’s cruise.</Text>
              <Text style={styles.cue} numberOfLines={1}>{cueLabel}</Text>
            </View>
            <View style={styles.play}>
              <Ionicons name="play" size={21} color="#08080c" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const HERO_H = 250;

const styles = StyleSheet.create({
  // The shadow lives out here: the card clips its own children for the rounded
  // photo, and on iOS that clips the shadow with them.
  wrap: {
    marginHorizontal: 22,
    marginBottom: 4,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },
  card: {
    height: HERO_H,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0A0A12',
    justifyContent: 'flex-end',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cue: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13.5,
    fontWeight: '500',
    marginTop: 3,
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
