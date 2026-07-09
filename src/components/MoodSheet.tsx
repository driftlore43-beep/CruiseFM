import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STATIONS } from '@/constants/stations';
import { Fonts } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Slide-up mood picker — the station list moved out of the mode view into a
 * compact tab so the visualiser stays the focus. Each mood shows in its own
 * accent gradient. Stays mounted so it can animate closed.
 */
export function MoodSheet({
  visible, activeId, onSelect, onClose,
}: {
  visible: boolean;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, {
        toValue: visible ? 0 : SCREEN_H,
        duration: visible ? 300 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <>
      {/* Dim backdrop — tap to dismiss */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[s.sheet, { paddingBottom: insets.bottom + 18, transform: [{ translateY: y }] }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={[s.title, { fontFamily: Fonts.mono }]}>CHANGE MOOD</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}>
          {STATIONS.map((station) => {
            const active = station.id === activeId;
            return (
              <TouchableOpacity
                key={station.id}
                activeOpacity={0.85}
                onPress={() => onSelect(station.id)}
                style={[s.card, active && s.cardActive]}>
                <LinearGradient
                  colors={station.cardGradient}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.cardIcon}>
                  <MaterialCommunityIcons name={station.iconName as any} size={20} color="#fff" />
                </View>
                <Text style={s.cardName} numberOfLines={2}>{station.name.replace(' FM', '')}</Text>
                {active && (
                  <View style={s.activeTick}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d0d16',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
    zIndex: 200,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginBottom: 14,
  },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  row: { paddingHorizontal: 18, gap: 12 },
  card: {
    width: 104, height: 104, borderRadius: 18, overflow: 'hidden',
    padding: 12, justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
  },
  cardActive: { borderColor: '#ffffff' },
  cardIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  activeTick: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
});
