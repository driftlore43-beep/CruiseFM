import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cruise } from '@/constants/theme';

const SCREEN_W = Dimensions.get('window').width;

export function SettingsPageShell({
  title, onBack, children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  // Settings live in a modal, so the iOS edge-swipe-back doesn't exist here —
  // recreate it. Move-based claiming loses to the native ScrollView on iOS
  // (the same lesson as the Tuner dial), so a swipe STARTING at the left edge
  // is claimed outright in the capture phase — the ScrollView never sees it —
  // while swipes elsewhere still get the move-based fallback when available.
  // onBack changes as sub-pages open, so the once-created responder reads it
  // through a ref.
  const slideX = useRef(new Animated.Value(0)).current;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const EDGE = 36;
  const backPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX < EDGE,
      onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.pageX < EDGE,
      onMoveShouldSetPanResponder: (_, g) => g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { if (g.dx > 0) slideX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 70 || g.vx > 0.5) {
          Animated.timing(slideX, { toValue: SCREEN_W, duration: 180, useNativeDriver: true }).start(() => {
            slideX.setValue(0);
            onBackRef.current();
          });
        } else {
          Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: slideX }] }]} {...backPan.panHandlers}>
      <LinearGradient
        colors={[Cruise.deepNavy, Cruise.charcoal, '#08080f']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={onBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

// ── Shared row/section building blocks for settings pages ────────────────────
export function SettingsSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 28 }}>
      {label && <Text style={sectionStyles.label}>{label}</Text>}
      <View style={sectionStyles.card}>{children}</View>
    </View>
  );
}

export function SettingsInfoRow({
  label, value, last,
}: {
  label: string; value?: string; last?: boolean;
}) {
  return (
    <View style={[sectionStyles.row, !last && sectionStyles.rowBorder]}>
      <Text style={sectionStyles.rowLabel}>{label}</Text>
      {value != null && <Text style={sectionStyles.rowValue} numberOfLines={1}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Cruise.charcoal },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
});

const sectionStyles = StyleSheet.create({
  label: {
    color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700',
    letterSpacing: 2, marginBottom: 10, marginLeft: 4,
  },
  card: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowLabel: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  rowValue: { color: 'rgba(255,255,255,0.5)', fontSize: 13.5, maxWidth: '55%' },
});
