import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import {
  Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { smoke } from '@/components/GlassPane';
import { MirrorBallGlyph } from '@/components/MirrorBallGlyph';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import { Fonts } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useNowPlaying } from '@/context/NowPlayingContext';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Slide-up MODE picker — replaces the old mood sheet (owner, 28.07: one pill,
 * one job; changing the visual is the thing you want mid-drive, and changing
 * the mood is what the stations page is for). Switching is purely visual:
 * np.setMode leaves the music playing exactly where it was.
 *
 * Chips wear the Modes tab's glass finish. Colours/icons mirror the cards in
 * modes.tsx — keep the two in step when a mode is added.
 */

const MODE_LOOK: Record<string, { icon: string | null; g: [string, string] }> = {
  cassette:  { icon: 'cassette',          g: ['#7a4fd0', '#4a2a90'] },
  equalizer: { icon: 'equalizer',         g: ['#164a6a', '#0a1a2a'] },
  orb:       { icon: 'circle-slice-8',    g: ['#b23ae6', '#2a1550'] },
  vinyl:     { icon: 'record-player',     g: ['#c05a20', '#3a180a'] },
  radio:     { icon: 'radio-tower',       g: ['#6a3ae0', '#1a8a9a'] },
  horizon:   { icon: 'weather-sunset-up', g: ['#b02a8a', '#200a45'] },
  cd:        { icon: 'disc',              g: ['#5a6f9a', '#141a2e'] },
  disco:     { icon: null,                g: ['#c8d2e2', '#5a6274'] }, // MirrorBallGlyph
};

// Free modes first, the same shelf order as the Modes tab.
const SHELF = [...MODE_CATALOG].sort((a, b) => Number(a.pro) - Number(b.pro));

export function ModeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { isPro } = useEntitlements();
  const np = useNowPlaying();
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

  const activeId = np.session?.mode;

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
          <Text style={[s.title, { fontFamily: Fonts.mono }]}>CHANGE MODE</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}>
          {SHELF.map((m) => {
            const look = MODE_LOOK[m.id] ?? MODE_LOOK.equalizer;
            const active = m.id === activeId;
            // Locked modes still switch — they become the usual free taste,
            // with the in-mode gate handling the upsell — but say so.
            const locked = m.pro && !isPro;
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onPress={() => { np.setMode(m.id); onClose(); }}
                style={[s.chip, active && s.chipActive]}>
                <LinearGradient
                  colors={[smoke(look.g[0]), smoke(look.g[1])]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* the glass: sheen + hairline top edge */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'transparent', 'rgba(0,0,0,0.14)']}
                  locations={[0, 0.4, 0.65, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.1)']}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={s.chipTopline}
                />
                {look.icon
                  ? <MaterialCommunityIcons name={look.icon as any} size={17} color="#fff" />
                  : <MirrorBallGlyph size={17} />}
                <Text style={s.chipLabel}>{m.label}</Text>
                {active && <Ionicons name="checkmark" size={13} color="#fff" />}
                {locked && !active && <MaterialCommunityIcons name="lock" size={12} color="rgba(255,255,255,0.75)" />}
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
  row: { paddingHorizontal: 18, gap: 10, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 15, paddingVertical: 12,
    borderRadius: 15, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  chipActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 12,
  },
  chipTopline: {
    position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.2, borderRadius: 1,
  },
  chipLabel: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
