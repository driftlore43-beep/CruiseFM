import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';

import { CreateStationModal } from '@/components/CreateStationModal';
import { GlassPane, mixHex, smoke, specularSpot } from '@/components/GlassPane';
import { StationDetailModal } from '@/components/StationDetailModal';
import { GlossSheen } from '@/components/GlossSheen';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { Cruise, Fonts, TAB_SAFE_INSET } from '@/constants/theme';
import { STATIONS, stationDial, type Band, type Station } from '@/constants/stations';
import { useEntitlements } from '@/context/EntitlementsContext';
import { deleteCustomStation, loadCustomStations, type CustomStation } from '@/utils/customStations';
import { recordDriveStart } from '@/utils/driveStats';
import { defaultStationForNow, saveLastCruise } from '@/utils/lastCruise';

const FREE_CUSTOM_LIMIT = 3;

/**
 * The page is a lit head unit (design settled with the owner 28.07 after a
 * long prototype run — see AGENTS.md):
 *
 *   - every station is a photo-glass card: its own artwork under dark glass,
 *     deepest on the left where the number and name sit
 *   - dial numbers are a REAL seven-segment display face (DSEG7), premium
 *     white, with the unlit ghost segments behind them — the ghosts are what
 *     make it read as hardware, same lesson as the Equalizer's unlit lamps
 *   - the AM/FM band letters are the fourteen-segment face (DSEG14) in the
 *     accent amber, ghosted the same way ('~' is DSEG14's all-segments glyph)
 *   - names and icons are white; icons sit in a fixed column at the card's
 *     right edge, arrow/padlock outermost — everything on strict columns
 *   - ONE glow on the whole page: the tuned station (red full-height line on
 *     its left edge, station-colour rim, white-hot number)
 *   - locked FM cards keep their photo and colour, just dimmer behind a
 *     drawn padlock — the premium band stays a shop window, not a grey list
 *
 * The DSEG fonts ship as bundled assets (SIL OFL licence alongside them in
 * assets/fonts/), loaded with expo-font — no native change, normal OTA.
 */

// Every number shares one column so digits right-align down the whole page
// and every name starts at the same x — AM, YOUR STATIONS and FM as one dial.
const NUM_COL_W = 64;
const ICON_SLOT_W = 28;
const CTRL_SLOT_W = 16;

// Time-flavoured tagline for the station currently "on air".
const ON_AIR_LINES: Record<string, string> = {
  'after-midnight': 'After hours — the road is all yours.',
  'mountain-pass':  'Morning air — take the high road.',
  'coastal':        'Midday light — the coast is clear.',
  'sunset':         'Golden hour — catch it while it lasts.',
  'night-run':      'City lights on — the night is young.',
};

function stationById(id: string): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

/** Pulsing red "live" dot. */
function OnAirDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[styles.onAirDot, { opacity: pulse }]} />;
}

/** Letterboxed banner for the station matching this hour — tap to open it. */
function OnAirBanner({ station, onPress }: { station: Station; onPress: () => void }) {
  const line = ON_AIR_LINES[station.id] ?? `${station.name} is calling.`;
  return (
    <Pressable
      style={({ pressed }) => [styles.onAirShadow, { shadowColor: station.glowColor }, pressed && styles.pressed]}
      onPress={onPress}>
      <View style={styles.onAirCard}>
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={1}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(3,3,12,0.66)', 'rgba(3,3,12,0.18)']}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <GlossSheen radius={22} />
        <View style={styles.onAirContent}>
          <View style={styles.onAirRow}>
            <OnAirDot />
            <Text style={[styles.onAirEyebrow, { fontFamily: Fonts.mono }]}>ON AIR THIS HOUR</Text>
          </View>
          <Text style={styles.onAirName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.onAirLine} numberOfLines={1}>{line}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * A dial number on the segment display: the unlit ghost behind, the lit
 * digits in front, both right-aligned to the shared column edge. AM ghosts
 * four whole digits; FM ghosts the 888.8 a real tuner shows.
 */
function LcdNumber({ label, band, tuned, lcd }: { label: string; band: Band; tuned: boolean; lcd: boolean }) {
  const family = lcd ? 'DSEG7' : Fonts.mono;
  return (
    <View style={styles.numCol}>
      {lcd && (
        <Text style={[styles.numGhost, { fontFamily: family }]}>{band === 'FM' ? '888.8' : '8888'}</Text>
      )}
      <Text style={[styles.numLit, { fontFamily: family }, tuned && styles.numLitTuned]}>{label}</Text>
    </View>
  );
}

/** The big segment-face band letters with the printed tick scale beside them. */
function BandHeader({ band, caption, lcd }: { band: Band; caption: string; lcd: boolean }) {
  return (
    <View style={styles.bandRow}>
      <View>
        {lcd && <Text style={[styles.bandGhost, { fontFamily: 'DSEG14' }]}>~~</Text>}
        <Text style={[styles.bandLetters, { fontFamily: lcd ? 'DSEG14' : Fonts.mono }]}>{band}</Text>
      </View>
      <View style={styles.bandTicks}>
        {Array.from({ length: 22 }).map((_, i) => (
          <View key={i} style={[styles.dialTick, i % 4 === 0 && styles.dialTickTall]} />
        ))}
      </View>
      <Text style={[styles.bandCaption, { fontFamily: Fonts.mono }]}>{caption}</Text>
    </View>
  );
}

/** Small printed label separating the user's own stations from the built-ins. */
function SubHeader({ label }: { label: string }) {
  return (
    <View style={styles.subheadRow}>
      <Text style={[styles.subheadText, { fontFamily: Fonts.mono }]}>{label}</Text>
      <View style={styles.subheadRule} />
    </View>
  );
}

/**
 * One station: photo under dark glass, number, name, white icon column.
 *
 * `mine` (custom stations) have no artwork — they get a quiet wash of their
 * own colour over the same dark base instead, so they sit on the dial looking
 * like everything else.
 */
function StationRow({
  station, dial, tuned, locked, lcd, onPress,
}: {
  station: Station | CustomStation;
  dial: { band: Band; label: string };
  tuned: boolean;
  locked?: boolean;
  lcd: boolean;
  onPress?: () => void;
}) {
  const custom = (station as CustomStation).image === null ? (station as CustomStation) : null;
  const mine = !!custom;
  const accent = station.eqColors?.[1] ?? (custom?.color ?? Cruise.amber);
  // Icon: built-ins store an MCI glyph name; custom stations store either an
  // MCI name (new) or an emoji (old ones).
  const iconName = mine ? custom!.icon : (station as Station).iconName;
  const isGlyph = /^[a-z]/.test(iconName);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.rowShadow,
        tuned && { shadowColor: accent, shadowOpacity: 0.55, shadowRadius: 16, elevation: 8 },
        pressed && onPress ? styles.pressed : null,
      ]}>
      <View
        style={[
          styles.rowCard,
          { borderColor: tuned ? accent + 'AA' : mine ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.14)' },
          locked && styles.rowLocked,
        ]}>
        {mine ? (
          <>
            {/* The Modes cards' glass finish, in the station's chosen colour
                (owner, 28.07): a smoked diagonal ramp under the shared
                GlassPane, full colour like the modes wear theirs. */}
            {/* The CHOSEN colour is the ramp's brightest stop — the glass
                sheen already adds white on top, and lightening the stop as
                well pushed every card toward pastel (owner, 28.07: "the
                colours are much brighter than the selected colours"). */}
            <LinearGradient
              colors={[
                smoke(custom!.color),
                smoke(mixHex(custom!.color, '#0b0d16', 0.22)),
                smoke(mixHex(custom!.color, '#0b0d16', 0.48)),
              ]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <GlassPane spot={specularSpot(station.name)} uid={`yst${station.id.replace(/\W/g, '')}`} />
          </>
        ) : (
          <>
            <ImageBackground
              source={(station as Station).image}
              style={StyleSheet.absoluteFill}
              imageStyle={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            {/* The photo glass: deepest on the left where the display sits,
                easing off so the photograph breathes on the right. */}
            <LinearGradient
              colors={locked
                ? ['rgba(8,8,14,0.92)', 'rgba(8,8,14,0.78)', 'rgba(8,8,14,0.6)']
                : ['rgba(8,8,14,0.88)', 'rgba(8,8,14,0.68)', 'rgba(8,8,14,0.46)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </>
        )}
        {/* The tuning needle: a red line standing the full height of the
            playing card's left edge — the page's single glowing marker. */}
        {tuned && <View style={styles.tunedLine} pointerEvents="none" />}

        <LcdNumber label={dial.label} band={dial.band} tuned={tuned} lcd={lcd} />
        <Text style={styles.rowName} numberOfLines={1}>{station.name}</Text>
        {mine && (
          <View style={styles.mineChip}>
            <Text style={styles.mineChipText}>MINE</Text>
          </View>
        )}
        <View style={styles.rowTrail}>
          <View style={styles.iconSlot}>
            {isGlyph ? (
              <MaterialCommunityIcons name={iconName as any} size={20} color="rgba(255,255,255,0.92)" style={styles.iconShadow} />
            ) : (
              <View style={styles.emojiBadge}>
                <Text style={styles.emojiText}>{iconName}</Text>
              </View>
            )}
          </View>
          <View style={styles.ctrlSlot}>
            {locked ? (
              <MaterialCommunityIcons name="lock" size={14} color="rgba(255,255,255,0.6)" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function StationsScreen() {
  const [customStations, setCustomStations] = useState<CustomStation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | CustomStation | null>(null);
  const [editingStation, setEditingStation] = useState<CustomStation | null>(null);
  const np = useNowPlaying();
  const { isPro } = useEntitlements();
  const insets = useSafeAreaInsets();

  // The segment-display faces, bundled in assets/fonts (OFL licence there
  // too). Until they're ready — a frame or two at most — numbers fall back to
  // the mono face and the ghost segments simply don't render.
  const [lcd] = useFonts({
    DSEG7: require('../../../assets/fonts/DSEG7Classic-Bold.ttf'),
    DSEG14: require('../../../assets/fonts/DSEG14Classic-Bold.ttf'),
  });

  const [onAirStation, setOnAirStation] = useState<Station>(() => stationById(defaultStationForNow()));

  async function fetchCustom() {
    const loaded = await loadCustomStations();
    setCustomStations(loaded);
  }

  useEffect(() => { fetchCustom(); }, []);
  useFocusEffect(useCallback(() => {
    fetchCustom();
    setOnAirStation(stationById(defaultStationForNow()));
  }, []));

  // AM = free + the user's own; FM = premium. Sorted up the dial within each
  // group; the user's creations sit in their own block under the defaults.
  const amDefaults = STATIONS.filter((s) => !s.premium)
    .map((s) => ({ station: s, dial: stationDial(s.id, false) }))
    .sort((a, b) => a.dial.value - b.dial.value);
  const amCustom = customStations
    .map((c) => ({ station: c, dial: stationDial(c.id, false) }))
    .sort((a, b) => a.dial.value - b.dial.value);

  const fmBand = STATIONS.filter((s) => s.premium)
    .map((s) => ({ station: s, dial: stationDial(s.id, true) }))
    .sort((a, b) => a.dial.value - b.dial.value);

  // The red line parks on whatever's playing, falling back to the station
  // that suits the hour when nothing is.
  const tunedId = np.session?.stationId ?? onAirStation.id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Now tuning</Text>
            <Pressable
              style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
              onPress={() => setShowCreate(true)}
              hitSlop={6}>
              <GlossSheen radius={17} />
              <Text style={styles.createBtnText}>Create</Text>
            </Pressable>
          </View>
          <OnAirBanner station={onAirStation} onPress={() => setSelectedStation(onAirStation)} />
        </View>

        <BandHeader band="AM" caption="FREE" lcd={lcd} />
        {amDefaults.map(({ station, dial }) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            lcd={lcd}
            onPress={() => setSelectedStation(station)}
          />
        ))}
        {amCustom.length > 0 && <SubHeader label="YOUR STATIONS" />}
        {amCustom.map(({ station, dial }) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            lcd={lcd}
            onPress={() => setSelectedStation(station)}
          />
        ))}

        <BandHeader band="FM" caption="PREMIUM" lcd={lcd} />
        {fmBand.map(({ station, dial }) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            locked={!isPro}
            lcd={lcd}
            onPress={isPro ? () => setSelectedStation(station) : undefined}
          />
        ))}

      </ScrollView>

      <CreateStationModal
        visible={showCreate}
        onClose={() => { setShowCreate(false); setEditingStation(null); }}
        onCreated={(s) => {
          setCustomStations((prev) => [...prev, s]);
          setShowCreate(false);
        }}
        editing={editingStation}
        onUpdated={(s) => {
          setCustomStations((prev) => prev.map((x) => (x.id === s.id ? s : x)));
          setShowCreate(false);
          setEditingStation(null);
        }}
        existingCount={customStations.length}
        maxFree={FREE_CUSTOM_LIMIT}
        isPro={isPro}
      />

      <StationDetailModal
        station={selectedStation}
        visible={!!selectedStation}
        onClose={() => setSelectedStation(null)}
        onStartDrive={(mode, preview) => {
          if (selectedStation) {
            if (!preview) {
              // A taste shouldn't overwrite the saved cruise or count as a drive.
              saveLastCruise({ stationId: selectedStation.id, mode });
              recordDriveStart(selectedStation.id);
            }
            np.open(mode, selectedStation.id, { preview });
          }
          setSelectedStation(null);
        }}
        isPro={isPro}
        onEdit={() => {
          const c = selectedStation as CustomStation;
          setSelectedStation(null);
          setEditingStation(c);
          setShowCreate(true);
        }}
        onDelete={async () => {
          if (selectedStation) await deleteCustomStation(selectedStation.id);
          setSelectedStation(null);
          fetchCustom();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    // Transparent like every other tab, so the shared near-black root shows
    // through — the opaque midnight fill read as an off purple-navy.
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerBlock: {
    paddingTop: 20,
    paddingBottom: 10,
    gap: 14,
  },
  title: {
    color: Cruise.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
  },

  // ── On Air banner ──
  onAirShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  onAirCard: {
    height: 112,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'flex-end',
  },
  onAirContent: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 2,
  },
  onAirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },
  onAirDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF453A',
    shadowColor: '#FF453A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  onAirEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  onAirName: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
  onAirLine: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    fontWeight: '500',
  },

  // ── Station rows ──────────────────────────────────────────────────────────
  rowShadow: {
    borderRadius: 18,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    shadowColor: '#000',
  },
  // Sized to sit alongside the Modes page's cards (both card families share an
  // exact 84pt minimum height and 18pt radius — keep them in step) — at the old 18px padding these read as
  // condensed strips next to them (owner, 28.07).
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 84,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  // Dimmer, not grey: the photo and colour stay visible behind the padlock
  // so the premium band still sells itself.
  rowLocked: {
    opacity: 0.72,
  },
  tunedLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  numCol: {
    width: NUM_COL_W,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  numGhost: {
    position: 'absolute',
    right: 0,
    fontSize: 17,
    color: 'rgba(255,255,255,0.15)',
  },
  numLit: {
    fontSize: 17,
    color: '#EDF0F5',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  numLitTuned: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 12,
  },
  // The modes page's original title spec, verbatim (owner's pick, 28.07) —
  // keep in step with compactTitle in modes.tsx. The shadow stays because
  // these names sit over photographs.
  rowName: {
    flexShrink: 1,
    color: '#fff',
    fontSize: 15.5,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 8,
  },
  mineChip: {
    borderWidth: 1,
    borderColor: 'rgba(180,195,255,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mineChipText: {
    color: '#cdd8ff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rowTrail: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSlot: {
    width: ICON_SLOT_W,
    alignItems: 'center',
  },
  // Keeps white icons legible when a bright photo sits behind them.
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  ctrlSlot: {
    width: CTRL_SLOT_W,
    alignItems: 'center',
  },
  emojiBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 13 },

  // ── Band headers ──
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  bandLetters: {
    color: Cruise.amber,
    fontSize: 19,
  },
  bandGhost: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 19,
    color: 'rgba(245,158,11,0.16)',
  },
  bandTicks: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 10,
  },
  bandCaption: {
    color: Cruise.amber,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  subheadText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subheadRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 10,
    marginRight: 2,
  },
  dialTick: {
    width: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dialTickTall: {
    height: 9,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Small clear glass pill — quiet until you need it.
  createBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
