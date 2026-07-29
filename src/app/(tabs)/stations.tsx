import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';

import { CreateStationModal } from '@/components/CreateStationModal';
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
const SCREEN_H = Dimensions.get('window').height;

/**
 * ONE HERO, THEN A QUIET LIST (owner's pick, 29.07 — chosen from renders as
 * "direction B", replacing the card grid settled on 28.07).
 *
 *   - the hour's station is a full-bleed photograph filling the top half of
 *     the screen, with the page title sitting on it and a Tune in button
 *   - every other station is a list row: dial number, name, its own colour on
 *     the icon, a hairline underneath. No card, no photo, no rim, no shadow
 *   - the AM/FM band letters are still the fourteen-segment face (DSEG14) in
 *     the accent amber, ghosted ('~' is DSEG14's all-segments glyph), and the
 *     dial numbers are still DSEG7 — the receiver identity lives in the type
 *     now rather than in eleven pieces of chrome
 *   - ONE glow on the whole page: the tuned station's red edge line and its
 *     white-hot number. Everything else is grey until you tune to it
 *   - locked FM rows are dimmed behind a padlock, never hidden
 *
 * WHY THE CARDS WENT: eleven photographs at row height were eleven small busy
 * rectangles competing with each other, and the page gave no clue which
 * station mattered. Apple Music's shape — one big thing, then a calm list —
 * is what "premium" turned out to mean here, and it is also more honest,
 * since the hour's station really is the recommendation.
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
  'daylight':       'Open road, open sky — go somewhere.',
  'rain-drive':     'Wipers on — slow roads and streetlight glass.',
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

/**
 * The hero: the station matching this hour, as a full-bleed photograph with
 * the page's title sitting on top of it.
 *
 * Design note (owner, 29.07 — "direction B"): the page used to give you
 * eleven equal cards and let you work out which mattered. One big thing and
 * then a calm list is the shape every app that feels expensive uses, and it
 * also happens to be honest — the hour's station IS the recommendation, so
 * it should look like one.
 *
 * The button says "Tune in", not "Start drive", because it opens the station
 * page rather than starting anything: that page is where the mode is chosen
 * and where the playlist gate lives. A button that doesn't do what it says
 * costs more trust than a plainer word costs excitement.
 */
function OnAirHero({
  station, height, topPad, onPress, onCreate,
}: {
  station: Station;
  height: number;
  topPad: number;
  onPress: () => void;
  onCreate: () => void;
}) {
  const line = ON_AIR_LINES[station.id] ?? `${station.name} is calling.`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ height }, pressed && styles.pressedHero]}>
      <ImageBackground
        source={station.image}
        style={StyleSheet.absoluteFill}
        imageStyle={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      {/* Two scrims, both needed: the bottom one carries the type, the top one
          exists purely so "Now tuning" survives a bright sky. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.26)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.74)', 'rgba(0,0,0,0.94)', '#000000']}
        locations={[0, 0.22, 0.44, 0.72, 0.9, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.heroTitleRow, { top: topPad + 10 }]}>
        <Text style={styles.title}>Now tuning</Text>
        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
          onPress={onCreate}
          hitSlop={6}>
          <GlossSheen radius={17} />
          <Text style={styles.createBtnText}>Create</Text>
        </Pressable>
      </View>
      <View style={styles.heroFoot}>
        <View style={styles.onAirRow}>
          <OnAirDot />
          <Text style={[styles.onAirEyebrow, { fontFamily: Fonts.mono }]}>ON AIR THIS HOUR</Text>
        </View>
        <Text style={styles.heroName} numberOfLines={2}>{station.name}</Text>
        <Text style={styles.heroLine} numberOfLines={1}>{line}</Text>
        <View style={styles.heroBtn}>
          <Text style={styles.heroBtnText}>Tune in</Text>
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
function LcdNumber({ label, tuned, lcd }: { label: string; tuned: boolean; lcd: boolean }) {
  const family = lcd ? 'DSEG7' : Fonts.mono;
  // No ghost segments on the list rows. They earned their place on the old
  // photo cards, where a lit panel needed unlit siblings to read as hardware;
  // over plain black they are just grey noise beside every name, and the
  // brightness difference between the tuned station and the rest is doing
  // that job now.
  return (
    <Text
      style={[styles.numLit, { fontFamily: family }, tuned && styles.numLitTuned]}
      numberOfLines={1}>
      {label}
    </Text>
  );
}

/** Segment-face band letters with their caption. */
function BandHeader({ band, caption, lcd }: { band: Band; caption: string; lcd: boolean }) {
  return (
    <View style={styles.bandRow}>
      <View>
        {lcd && <Text style={[styles.bandGhost, { fontFamily: 'DSEG14' }]}>~~</Text>}
        <Text style={[styles.bandLetters, { fontFamily: lcd ? 'DSEG14' : Fonts.mono }]}>{band}</Text>
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
 * One station on the dial: number, name, its own colour as the icon, and a
 * hairline underneath. No card, no photograph, no rim.
 *
 * The photograph now lives in exactly one place on this page — the hero — and
 * that is the point: eleven photographs at row size were eleven small busy
 * rectangles, and none of them was legible enough to be worth the noise. What
 * survives per row is the station's own colour on its icon, which is enough
 * to tell them apart at a glance.
 *
 * `mine` (custom stations) have no artwork anyway, so they finally sit in the
 * list looking exactly like everything else — just with their MINE chip.
 */
function StationRow({
  station, dial, tuned, locked, lcd, last, onPress,
}: {
  station: Station | CustomStation;
  dial: { band: Band; label: string };
  tuned: boolean;
  locked?: boolean;
  lcd: boolean;
  /** Last row in its group — no hairline under it. */
  last?: boolean;
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
        styles.row,
        !last && styles.rowRule,
        locked && styles.rowLocked,
        pressed && onPress ? styles.rowPressed : null,
      ]}>
      {/* The tuning needle: the page's one glowing mark, on the tuned row. */}
      {tuned && <View style={styles.tunedLine} pointerEvents="none" />}

      <View style={styles.numCol}>
        <LcdNumber label={dial.label} tuned={tuned} lcd={lcd} />
      </View>
      <Text style={[styles.rowName, tuned && styles.rowNameTuned]} numberOfLines={1}>{station.name}</Text>
      {mine && (
        <View style={styles.mineChip}>
          <Text style={styles.mineChipText}>MINE</Text>
        </View>
      )}
      <View style={styles.rowTrail}>
        <View style={styles.iconSlot}>
          {isGlyph ? (
            <MaterialCommunityIcons name={iconName as any} size={20} color={accent} />
          ) : (
            <View style={[styles.emojiBadge, { borderColor: accent + '99' }]}>
              <Text style={styles.emojiText}>{iconName}</Text>
            </View>
          )}
        </View>
        <View style={styles.ctrlSlot}>
          {locked ? (
            <MaterialCommunityIcons name="lock" size={14} color="rgba(255,255,255,0.45)" />
          ) : (
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.28)" />
          )}
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

  // The hero fills the top half of the phone. Clamped so it stays generous on
  // a small screen without eating a tall one whole.
  const heroH = Math.max(340, Math.min(SCREEN_H * 0.52, 470));

  return (
    <View style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        <OnAirHero
          station={onAirStation}
          height={heroH}
          topPad={insets.top}
          onPress={() => setSelectedStation(onAirStation)}
          onCreate={() => setShowCreate(true)}
        />

        <BandHeader band="AM" caption="FREE" lcd={lcd} />
        {amDefaults.map(({ station, dial }, i) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            lcd={lcd}
            last={i === amDefaults.length - 1 && amCustom.length === 0}
            onPress={() => setSelectedStation(station)}
          />
        ))}
        {amCustom.length > 0 && <SubHeader label="YOUR STATIONS" />}
        {amCustom.map(({ station, dial }, i) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            lcd={lcd}
            last={i === amCustom.length - 1}
            onPress={() => setSelectedStation(station)}
          />
        ))}

        <BandHeader band="FM" caption="PREMIUM" lcd={lcd} />
        {fmBand.map(({ station, dial }, i) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            locked={!isPro}
            lcd={lcd}
            last={i === fmBand.length - 1}
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    // Transparent like every other tab, so the shared near-black root shows
    // through — the opaque midnight fill read as an off purple-navy.
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: { flex: 1 },
  // No horizontal padding here: the hero runs edge to edge, so the inset is
  // applied by the rows and headers instead.
  content: { paddingBottom: 32 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  title: {
    color: Cruise.textPrimary,
    // 34, not 30. Big type in a lot of space is most of what "expensive"
    // means — this is the loudest thing on the page and it should be.
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.1,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 12,
  },
  heroTitleRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroFoot: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    gap: 2,
  },
  heroName: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.3,
    lineHeight: 41,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 14,
  },
  heroLine: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14.5,
    fontWeight: '500',
    marginTop: 4,
  },
  heroBtn: {
    alignSelf: 'flex-start',
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  heroBtnText: {
    color: '#08080c',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  onAirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
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

  // ── Station rows ──────────────────────────────────────────────────────────
  // A list, not a card stack: the only furniture is a hairline, and it stops
  // at the last row of each group so the group reads as one block.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 19,
    paddingHorizontal: 20,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  // Dimmer, not grey — the premium band still has to sell itself.
  rowLocked: {
    opacity: 0.6,
  },
  // Press feedback: the row takes a beat of light rather than shrinking.
  // Scaling a full-width list row looks like the page flexing; scaling a
  // card looks like the card being pushed. Different shapes, different rule.
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tunedLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },
  numCol: {
    width: NUM_COL_W,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  numLit: {
    fontSize: 16,
    // Unplayed stations sit well back so the tuned one reads instantly —
    // this contrast replaced the old ghost-segment trick.
    color: 'rgba(255,255,255,0.42)',
  },
  numLitTuned: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rowName: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.94)',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  rowNameTuned: {
    color: '#fff',
    fontWeight: '700',
  },
  mineChip: {
    borderWidth: 1,
    borderColor: 'rgba(180,195,255,0.45)',
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
  ctrlSlot: {
    width: CTRL_SLOT_W,
    alignItems: 'center',
  },
  emojiBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 13 },

  // ── Band headers ──────────────────────────────────────────────────────────
  // The printed tick ruler went with the cards. It was the head unit's fascia,
  // and a fascia needs something bolted to it; over a plain list it was one
  // more grey texture competing with the names.
  bandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 11,
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 10,
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
  bandCaption: {
    color: 'rgba(245,158,11,0.7)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  subheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
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

  // ── Create pill ───────────────────────────────────────────────────────────
  createBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  pressedHero: { opacity: 0.94 },
});
