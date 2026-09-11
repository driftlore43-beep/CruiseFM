import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MirrorBallGlyph } from '@/components/MirrorBallGlyph';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import { Fonts } from '@/constants/theme';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { useSheetOpen } from '@/context/NowPlayingContext';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { applyModeOrder, getModeOrder } from '@/utils/modeOrder';

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

// Icons only since 30.07 — the chips wore coloured smoked-glass gradients
// from the pre-redesign Modes tab long after that tab went black rows with
// white glyphs (owner: "the pills have not updated since the redesign").
// One chip style now, matching the app: dark glass, white icon, white text.
const MODE_LOOK: Record<string, { icon: string | null }> = {
  cassette:  { icon: 'cassette' },
  equalizer: { icon: 'equalizer' },
  orb:       { icon: 'circle-slice-8' },
  vinyl:     { icon: 'record-player' },
  radio:     { icon: 'radio-tower' },
  horizon:   { icon: 'weather-sunset-up' },
  cd:        { icon: 'disc' },
  disco:     { icon: null }, // MirrorBallGlyph
};

// Free modes first, the same default shelf order as the Modes tab.
const DEFAULT_SHELF = [...MODE_CATALOG].sort((a, b) => Number(a.pro) - Number(b.pro));

export function ModeSheet({ visible, onClose, onPick, currentId, title = 'CHANGE MODE', extraBottom = 0 }: {
  visible: boolean;
  onClose: () => void;
  /**
   * Where the choice goes. By default it switches the RUNNING drive's visual,
   * which is what the in-drive pill wants. The home card passes its own
   * handler because there is no drive yet — it is choosing the look a drive
   * is about to open with, so `np.setMode` would have nothing to set.
   */
  onPick?: (mode: string) => void;
  /** Ticked in the shelf when there is no session to read it from. */
  currentId?: string;
  title?: string;
  /** Extra room at the foot — the tab bar floats over this sheet on a page. */
  extraBottom?: number;
}) {
  // While this sheet is up, the card's dismiss gesture stands down (04.08).
  useSheetOpen(visible);
  const insets = useSafeAreaInsets();
  const { isPro } = useEntitlements();
  const np = useNowPlaying();

  // The driver's own order from the Modes tab (25.08) — re-read on every open
  // rather than once, since it can change between drives and this sheet is
  // cheap to refresh.
  const [shelf, setShelf] = useState(DEFAULT_SHELF);
  useEffect(() => {
    if (!visible) return;
    getModeOrder().then((order) => setShelf(applyModeOrder(MODE_CATALOG, order))).catch(() => {});
  }, [visible]);
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

  const activeId = np.session?.mode ?? currentId;
  const s = useStyles(makeStyles);
  const pal = usePalette();
  // The selected chip is the app's primary pill: a solid fill in the OPPOSITE
  // of the page. On paper that means a dark pill with light type — a white
  // pill on near-white paper is not a button (the same call the create
  // sheet's save button makes).
  const onChip = pal.mode === 'light' ? '#F6F4EF' : '#0a0a10';
  const offChip = pal.text;

  return (
    <>
      {/* Dim backdrop — tap to dismiss */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: pal.mode === 'light' ? 'rgba(40,36,28,0.32)' : 'rgba(0,0,0,0.55)', opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[s.sheet, { paddingBottom: insets.bottom + 18 + extraBottom, transform: [{ translateY: y }] }]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={[s.title, { fontFamily: Fonts.mono }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={16} color={pal.ink(0.7)} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}>
          {shelf.map((m) => {
            const look = MODE_LOOK[m.id] ?? MODE_LOOK.equalizer;
            const active = m.id === activeId;
            // Locked modes still switch — they become the usual free taste,
            // with the in-mode gate handling the upsell — but say so.
            const locked = m.pro && !isPro;
            return (
              <TouchableOpacity
                key={m.id}
                activeOpacity={0.85}
                onPress={() => { if (onPick) onPick(m.id); else np.setMode(m.id); onClose(); }}
                style={[s.chip, active && s.chipActive]}>
                {look.icon
                  ? <MaterialCommunityIcons name={look.icon as any} size={17} color={active ? onChip : offChip} />
                  : <MirrorBallGlyph size={17} color={active ? onChip : offChip} />}
                <Text style={[s.chipLabel, active && s.chipLabelActive]}>{m.label}</Text>
                {active && <Ionicons name="checkmark" size={13} color={onChip} />}
                {locked && !active && <MaterialCommunityIcons name="lock" size={12} color={pal.ink(0.55)} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  );
}

/** Themed 19.08 alongside StationSheet — see the note there. */
const makeStyles = (p: Palette) => StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: p.mode === 'light' ? p.panel : '#0d0d16',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: p.ink(0.10),
    paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: p.mode === 'light' ? 0.18 : 0.5, shadowRadius: 20, elevation: 20,
    zIndex: 200,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: p.ink(0.22), alignSelf: 'center', marginBottom: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginBottom: 14,
  },
  title: { color: p.ink(0.7), fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: p.ink(0.08),
    alignItems: 'center', justifyContent: 'center',
  },
  row: { paddingHorizontal: 18, gap: 10, paddingVertical: 4 },
  // Dark glass, hairline rim; the ACTIVE mode is a solid white pill with
  // dark type — the same primary-button language as the play disc and the
  // Tune-in pill.
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: p.ink(0.06),
    borderWidth: 1, borderColor: p.ink(0.14),
  },
  chipActive: {
    backgroundColor: p.mode === 'light' ? p.text : '#ffffff',
    borderColor: p.mode === 'light' ? p.text : '#ffffff',
  },
  chipLabel: { color: p.text, fontSize: 13.5, fontWeight: '700' },
  chipLabelActive: { color: p.mode === 'light' ? '#F6F4EF' : '#0a0a10' },
});
