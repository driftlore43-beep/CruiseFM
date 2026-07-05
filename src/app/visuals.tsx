import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';

function SpinningRecord() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.record, style]}>
      <View style={styles.recordLabel}>
        <View style={styles.recordCenter} />
        <View style={styles.recordRing} />
        <View style={styles.recordRing2} />
      </View>
    </Animated.View>
  );
}

function CassetteReels() {
  const reel1 = useSharedValue(0);
  const reel2 = useSharedValue(0);

  useEffect(() => {
    reel1.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1,
      false,
    );
    reel2.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const s1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${reel1.value}deg` }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ rotate: `${reel2.value}deg` }] }));

  return (
    <View style={styles.reelsRow}>
      <Animated.View style={[styles.reel, s1]}>
        <View style={styles.reelHub} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '0deg' }] }]} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '60deg' }] }]} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '120deg' }] }]} />
      </Animated.View>
      <View style={styles.reelGap} />
      <Animated.View style={[styles.reel, s2]}>
        <View style={styles.reelHub} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '30deg' }] }]} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '90deg' }] }]} />
        <View style={[styles.reelSpoke, { transform: [{ rotate: '150deg' }] }]} />
      </Animated.View>
    </View>
  );
}

function FreqDisplay() {
  return (
    <View style={styles.freqDisplay}>
      <Text style={styles.freqText}>88.7 FM</Text>
      <View style={styles.freqBar}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.freqSegment,
              { backgroundColor: i < 14 ? Cruise.violet : Cruise.surfaceElevated },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function VisualCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.visualCard}>
      <View style={styles.visualPreview}>{children}</View>
      <View style={styles.visualInfo}>
        <Text style={styles.visualTitle}>{title}</Text>
        <Text style={styles.visualSub}>{subtitle}</Text>
      </View>
      <Pressable style={styles.unlockBtn}>
        <Text style={styles.unlockText}>🔒 Unlock Premium</Text>
      </Pressable>
    </View>
  );
}

export default function VisualsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Visual Modes</Text>
        <Text style={styles.pageSub}>Immersive displays for your night drive.</Text>

        <VisualCard
          title="Cassette Mode"
          subtitle="Watch the tape spin. Feel the analogue warmth.">
          <CassetteReels />
        </VisualCard>

        <VisualCard
          title="Vinyl Mode"
          subtitle="The needle drops. The groove spins. Pure ritual.">
          <SpinningRecord />
        </VisualCard>

        <VisualCard
          title="Retro Radio"
          subtitle="Old-school frequency dial. Glowing amber numbers.">
          <FreqDisplay />
        </VisualCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Cruise.midnight,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    color: Cruise.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
    marginLeft: 4,
    marginBottom: 4,
  },
  pageSub: {
    color: Cruise.textSecondary,
    fontSize: 14,
    marginLeft: 4,
    marginBottom: 20,
  },
  visualCard: {
    backgroundColor: Cruise.surface,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.2)',
  },
  visualPreview: {
    height: 160,
    backgroundColor: Cruise.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualInfo: {
    padding: 16,
    gap: 4,
  },
  visualTitle: {
    color: Cruise.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  visualSub: {
    color: Cruise.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  unlockBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Cruise.violetDim,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  unlockText: {
    color: Cruise.violetLight,
    fontSize: 14,
    fontWeight: '600',
  },
  // Record styles
  record: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2A2A2A',
  },
  recordLabel: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCenter: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Cruise.violet,
  },
  recordRing: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.3)',
  },
  recordRing2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.15)',
  },
  // Cassette styles
  reelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reel: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelHub: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Cruise.violet,
  },
  reelSpoke: {
    position: 'absolute',
    width: 2,
    height: 28,
    backgroundColor: '#444',
    borderRadius: 1,
  },
  reelGap: {
    width: 32,
    height: 12,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#333',
  },
  // Freq styles
  freqDisplay: {
    alignItems: 'center',
    gap: 12,
  },
  freqText: {
    color: Cruise.amber,
    fontSize: 32,
    fontWeight: '300',
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  freqBar: {
    flexDirection: 'row',
    gap: 3,
  },
  freqSegment: {
    width: 8,
    height: 16,
    borderRadius: 2,
  },
});
