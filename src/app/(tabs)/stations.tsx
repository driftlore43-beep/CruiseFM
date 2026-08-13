import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useFonts } from 'expo-font';

import { CreateStationModal } from '@/components/CreateStationModal';
import { useDaylight } from '@/context/MotionContext';
import { StationDetailModal } from '@/components/StationDetailModal';
import { GlossSheen } from '@/components/GlossSheen';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { Cruise, Fonts, TAB_SAFE_INSET, PAGE_GUTTER } from '@/constants/theme';
import { STATIONS, stationDial, type Band, type Station } from '@/constants/stations';
import { useEntitlements } from '@/context/EntitlementsContext';
import { deleteCustomStation, isCustomStation, loadCustomStations, type CustomStation } from '@/utils/customStations';
import { clockLabel, isScheduled, onAirNow, upNext } from '@/constants/schedule';
import { consumeCreateRequest } from '@/utils/createStationRequest';
import { stationImageSource } from '@/utils/stationImage';
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
  station, height, topPad, upNextLine, onPress, onCreate,
}: {
  station: Station;
  height: number;
  topPad: number;
  /** "Sunset AM at 4pm" — what comes on next, or null when nothing is queued. */
  upNextLine: string | null;
  onPress: () => void;
  onCreate: () => void;
}) {
  const line = ON_AIR_LINES[station.id] ?? `${station.name} is calling.`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ height }, pressed && styles.pressedHero]}>
      <ImageBackground
        source={stationImageSource(station.image) ?? undefined}
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
          <MaterialCommunityIcons name="plus" size={15} color="#0a0a10" />
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
        {/* What's on later — the half of a schedule that gives anyone a reason
            to look again. Printed small, under the button, so it informs
            without competing with the station that is on now. */}
        {!!upNextLine && (
          <Text style={[styles.upNext, { fontFamily: Fonts.mono }]} numberOfLines={1}>
            UP NEXT · {upNextLine}
          </Text>
        )}
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
  const day = useDaylight();
  // No ghost segments on the list rows. They earned their place on the old
  // photo cards, where a lit panel needed unlit siblings to read as hardware;
  // over plain black they are just grey noise beside every name, and the
  // brightness difference between the tuned station and the rest is doing
  // that job now.
  return (
    <Text
      style={[styles.numLit, { fontFamily: family }, day && styles.numLitDay, tuned && styles.numLitTuned]}
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
 * The empty slot on the dial, shown only while the driver has no stations of
 * their own.
 *
 * Making a station was previously discoverable only through the small Create
 * button on the hero, so someone scrolling the dial had no way of learning the
 * feature exists at all. A vacant frequency in the AM band says it in the
 * page's own language — and it disappears the moment it stops being true,
 * replaced by the YOUR STATIONS block.
 */
function EmptySlotRow({ onPress }: { onPress: () => void }) {
  const day = useDaylight();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.emptySlot, pressed && styles.rowPressed]}>
      <View style={styles.numCol}>
        <Text style={[styles.emptySlotDash, day && styles.emptySlotDashDay]}>— —</Text>
      </View>
      <Text style={[styles.rowName, styles.emptySlotName, day && styles.rowNameDay]} numberOfLines={1}>
        Your own station
      </Text>
      <View style={styles.rowTrail}>
        <View style={styles.iconSlot}>
          <MaterialCommunityIcons name="plus" size={20} color={Cruise.amber} />
        </View>
        <View style={styles.ctrlSlot}>
          <Ionicons name="chevron-forward" size={16} color={day ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.28)'} />
        </View>
      </View>
    </Pressable>
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
  station, dial, tuned, locked, lcd, last, onAir, onPress,
}: {
  station: Station | CustomStation;
  dial: { band: Band; label: string };
  tuned: boolean;
  locked?: boolean;
  lcd: boolean;
  /** Last row in its group — no hairline under it. */
  last?: boolean;
  /**
   * Broadcasting right now. PRESENTATION ONLY — an off-air station is still
   * fully playable, because a listener who wants Night Run at two in the
   * afternoon must never be told no. See constants/schedule.ts.
   */
  onAir?: boolean;
  onPress?: () => void;
}) {
  const day = useDaylight();
  // Same trap as the detail page: this used to read `.image === null`, which
  // stopped identifying a custom station the moment one could carry a photo.
  const custom = isCustomStation(station) ? (station as CustomStation) : null;
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
        !last && day && styles.rowRuleDay,
        locked && styles.rowLocked,
        // Nothing is taken away when a station is off air — it simply sits
        // back, the way a quiet frequency does.
        onAir === false && !tuned && styles.rowOffAir,
        pressed && onPress ? styles.rowPressed : null,
      ]}>
      {/* The tuning needle: the page's one glowing mark, on the tuned row. */}
      {tuned && <View style={styles.tunedLine} pointerEvents="none" />}

      <View style={styles.numCol}>
        <LcdNumber label={dial.label} tuned={tuned} lcd={lcd} />
      </View>
      {/* The broadcast lamp. A receiver shows which frequencies are live with
          a lit dot, not with a word — and a dot costs no row height, which
          this dial cannot spare (every row must stay the same height). */}
      {onAir && <View style={[styles.onAirLamp, { backgroundColor: accent }]} pointerEvents="none" />}
      <Text style={[styles.rowName, tuned && styles.rowNameTuned, day && styles.rowNameDay]} numberOfLines={1}>{station.name}</Text>
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
            <Ionicons name="chevron-forward" size={16} color={day ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.28)'} />
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
  // Which frequencies are actually broadcasting, and what comes on next.
  // Recomputed on focus rather than on a timer: the page is looked at, not
  // watched, and a repeating timer here would be one more thing to gate on
  // AppState (see the SIGKILL note in AGENTS.md).
  const [live, setLive] = useState<string[]>(() => onAirNow());
  const [next, setNext] = useState(() => upNext());

  async function fetchCustom() {
    const loaded = await loadCustomStations();
    setCustomStations(loaded);
  }

  useEffect(() => { fetchCustom(); }, []);
  useFocusEffect(useCallback(() => {
    fetchCustom();
    setOnAirStation(stationById(defaultStationForNow()));
    setLive(onAirNow());
    setNext(upNext());
    // Someone pressed "make a station" on the home page and was sent here.
    // Reading the request clears it, so arriving again later is quiet.
    if (consumeCreateRequest()) setShowCreate(true);
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
          upNextLine={next
            ? `${stationById(next.id).name} at ${clockLabel(new Date(Date.now() + next.minutes * 60000).getHours())}`
            : null}
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
            onAir={isScheduled(station.id) ? live.includes(station.id) : undefined}
            lcd={lcd}
            // Never the last row of the band any more: either YOUR STATIONS
            // follows, or the empty slot does.
            onPress={() => setSelectedStation(station)}
          />
        ))}
        {amCustom.length > 0 && <SubHeader label="YOUR STATIONS" />}
        {amCustom.length === 0 && <EmptySlotRow onPress={() => setShowCreate(true)} />}
        {amCustom.map(({ station, dial }, i) => (
          <StationRow
            key={station.id}
            station={station}
            dial={dial}
            tuned={station.id === tunedId}
            // Deliberately unscheduled: nobody puts their own station off air,
            // and a lamp on every one of them would be noise rather than news.
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
            onAir={isScheduled(station.id) ? live.includes(station.id) : undefined}
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
    letterSpacing: 0,
  },
  upNext: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10.5,
    letterSpacing: 1.4,
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
    paddingHorizontal: PAGE_GUTTER,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  // Dimmer, not grey — the premium band still has to sell itself.
  rowLocked: {
    opacity: 0.6,
  },
  // Off air: a step back, never a wall. Anything heavier reads as disabled,
  // and these rows are fully playable.
  rowOffAir: { opacity: 0.62 },
  // The broadcast lamp, in the 16pt gutter between the dial number and the
  // name. ABSOLUTELY POSITIONED on purpose: in the flex row it would push
  // every on-air station's name across, and the whole page depends on names
  // starting at the same x whether or not the station is live.
  onAirLamp: {
    position: 'absolute',
    left: PAGE_GUTTER + NUM_COL_W + 5,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
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
  // Daylight: the dial numbers sit at 42% so the tuned one can stand out —
  // in sun that whole scale simply vanishes, so it comes up to near-full and
  // the tuned one keeps its glow to stay distinguishable.
  numLitDay: { color: 'rgba(255,255,255,0.86)' },
  rowNameDay: { color: '#ffffff' },
  rowRuleDay: { borderBottomColor: 'rgba(255,255,255,0.30)' },
  numLitTuned: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rowName: {
    flexShrink: 1,
    // Full white and 700, matching the share sheet's buttons — which is the
    // treatment the owner picked out as "bolder and more spaced out" against
    // these names at 600 with -0.3 tracking (11.08).
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
  rowNameTuned: {
    color: '#fff',
    fontWeight: '700',
  },
  // The vacant frequency: no hairline (it is the last row of the band) and a
  // quieter name than a real station's, so it reads as an offer rather than as
  // something already on air.
  emptySlot: { opacity: 0.92 },
  emptySlotName: { color: 'rgba(255,255,255,0.72)', fontWeight: '600' },
  emptySlotDash: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -1,
  },
  emptySlotDashDay: { color: 'rgba(255,255,255,0.70)' },
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
    paddingHorizontal: PAGE_GUTTER,
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
    paddingHorizontal: PAGE_GUTTER,
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
  // The page's one call to action, so it wears the app's primary button:
  // a solid white pill with dark type. As grey glass on a photograph it read
  // as another piece of chrome rather than the thing to press.
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingLeft: 11,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  createBtnText: {
    color: '#0a0a10',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  pressedHero: { opacity: 0.94 },
});
