import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDsegFont } from '@/components/StationIdentity';
import { STATIONS, stationDial } from '@/constants/stations';
import { Fonts, TAB_SAFE_INSET } from '@/constants/theme';
import { customToStation, loadCustomStations, type CustomStation } from '@/utils/customStations';

type Row = { id: string; name: string; tagline: string; accent: string; icon: string; band: 'AM' | 'FM'; dial: string; mine: boolean };

function toRow(s: { id: string; name: string; tagline: string; eqColors?: readonly string[]; iconName?: string; premium?: boolean }, mine: boolean): Row {
  const d = stationDial(s.id, !!s.premium);
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    accent: s.eqColors?.[1] ?? '#8A7CFF',
    icon: s.iconName ?? 'radio',
    band: d.band,
    dial: d.label,
    mine,
  };
}

/**
 * The mood picker that opens when a mode is tapped on the Modes tab.
 *
 * WHY it exists (owner, 03.08): opening a mode from that tab always started
 * on Night Run, because `np.open` defaults its stationId to a hardcoded
 * 'night-run'. Wanting any other mood meant backing out to the Stations page
 * and coming in the other way. Choosing the mood at the moment you pick the
 * visual is the natural place for it.
 *
 * This does NOT reintroduce the old in-drive mood sheet, which was
 * deliberately dropped on 28.07 ("one pill, one job"). Changing the mood
 * mid-drive is still the Stations page's business — this is the doorway.
 */
export function StationSheet({
  visible, onClose, onPick, currentId, modeLabel, extraBottom = 0,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (stationId: string) => void;
  /** Ticked in the list — the mood this would otherwise have opened with. */
  currentId?: string;
  /** Shown in the header so it's clear what you're choosing a mood FOR. */
  modeLabel?: string;
  /** Extra room at the foot — the mini-player docks above the tab bar when a
   *  drive is running, and it floats over this sheet. */
  extraBottom?: number;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const seg7 = useDsegFont();
  // Parked off-screen using the LIVE window height, not a module-load
  // constant: if that constant is ever wrong the sheet stays parked below the
  // screen while its backdrop still swallows every touch, which reads as the
  // whole app freezing.
  const y = useRef(new Animated.Value(2000)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mine, setMine] = useState<CustomStation[]>([]);

  useEffect(() => {
    if (visible) loadCustomStations().then(setMine).catch(() => {});
  }, [visible]);

  // Kept mounted until the exit animation finishes, so the sheet slides back
  // down instead of vanishing the instant the Modal closes.
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    // Always start an open from a known off-screen position. Relying on
    // whatever the value happened to hold is how a sheet ends up parked below
    // the screen with a live backdrop over the app.
    if (visible) { setMounted(true); y.setValue(winH); }
    Animated.parallel([
      Animated.timing(y, {
        toValue: visible ? 0 : winH,
        duration: visible ? 300 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (!visible && finished) setMounted(false); });
  }, [visible]);

  // Same reading order as the Stations page: each band climbing its own dial,
  // the user's own stations in their own block underneath.
  const byDial = (a: Row, b: Row) => parseFloat(a.dial) - parseFloat(b.dial);
  const defaults = STATIONS.map((s) => toRow(s, false));
  const am = defaults.filter((r) => r.band === 'AM').sort(byDial);
  const fm = defaults.filter((r) => r.band === 'FM').sort(byDial);
  const custom = mine.map((c) => toRow(customToStation(c), true)).sort(byDial);

  const row = (r: Row) => {
    const active = r.id === currentId;
    return (
      <TouchableOpacity
        key={r.id}
        activeOpacity={0.8}
        onPress={() => { onPick(r.id); onClose(); }}
        style={[s.row, active && s.rowActive]}>
        <Text style={[s.dial, { fontFamily: seg7 }, active && s.dialActive]}>{r.dial}</Text>
        <View style={s.rowText}>
          <Text style={[s.name, active && s.nameActive]} numberOfLines={1}>{r.name}</Text>
          <Text style={s.tagline} numberOfLines={1}>{r.tagline}</Text>
        </View>
        {active
          ? <Ionicons name="checkmark" size={16} color="#0a0a10" />
          : <MaterialCommunityIcons name={r.icon as any} size={18} color={r.accent} />}
      </TouchableOpacity>
    );
  };

  const header = (label: string) => (
    <Text key={label} style={[s.band, { fontFamily: Fonts.mono }]}>{label}</Text>
  );

  if (!mounted) return null;

  // DELIBERATELY NOT A MODAL (owner, 03.08: "it just freezes"). The first cut
  // wrapped this in one so it could cover the floating tab bar — and on iOS a
  // second Modal will not stack over the one NowPlayingHost already holds for
  // the fullscreen player, so it presented an invisible, touch-swallowing
  // window over the app. Exactly the trap PreviewGate hit on 24.07, and the
  // fix is the same: stay in the page.
  //
  // The tab bar is a sibling drawn after this screen, so it floats over the
  // dimmed backdrop; the list simply pads past it so no row is ever hidden
  // underneath or stealing taps.
  return (
    <>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[s.sheet, { paddingBottom: TAB_SAFE_INSET + insets.bottom + extraBottom, transform: [{ translateY: y }] }]}>
        <View style={s.handle} />
        <View style={s.headerRow}>
          <Text style={[s.title, { fontFamily: Fonts.mono }]}>
            {modeLabel ? `MOOD FOR ${modeLabel.toUpperCase()}` : 'CHOOSE A MOOD'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ maxHeight: winH * 0.46 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {header('AM')}
          {am.map(row)}
          {header('FM')}
          {fm.map(row)}
          {custom.length > 0 && header('YOUR STATIONS')}
          {custom.map(row)}
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginBottom: 10,
  },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  band: {
    color: 'rgba(255,255,255,0.38)', fontSize: 10, fontWeight: '800', letterSpacing: 3,
    marginTop: 12, marginBottom: 6, marginLeft: 6,
  },
  // Dark glass rows; the ticked one is a solid white pill with dark type —
  // the app's primary-selection language, same as the mode chips.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  rowActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  // Fixed width so every name starts at the same x, like the Stations page.
  dial: { width: 54, color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },
  dialActive: { color: 'rgba(0,0,0,0.55)' },
  rowText: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  nameActive: { color: '#0a0a10' },
  tagline: { color: 'rgba(255,255,255,0.42)', fontSize: 11.5, marginTop: 1 },
});
