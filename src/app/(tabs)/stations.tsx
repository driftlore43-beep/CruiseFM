import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { StationCard } from '@/components/StationCard';
import { CreateStationModal } from '@/components/CreateStationModal';
import { StationDetailModal } from '@/components/StationDetailModal';
import { GlossSheen } from '@/components/GlossSheen';
import { PremiumShimmer } from '@/components/PremiumShimmer';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { Cruise, Fonts, TAB_SAFE_INSET } from '@/constants/theme';
import { STATIONS, stationDial, type Band, type Station } from '@/constants/stations';
import { useEntitlements } from '@/context/EntitlementsContext';
import { deleteCustomStation, loadCustomStations, type CustomStation } from '@/utils/customStations';
import { recordDriveStart } from '@/utils/driveStats';
import { defaultStationForNow, saveLastCruise } from '@/utils/lastCruise';

const FREE_CUSTOM_LIMIT = 3;

// One line of road poetry per visit, rotating on each focus.
const POETRY = [
  'Pick a feeling, not a genre.',
  'Every road has a frequency.',
  'The city sounds different after midnight.',
  'Somewhere, a road is waiting.',
  'Tune the drive to the mood.',
];

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
 * The page is laid out like a receiver, not a list of cards.
 *
 * AM carries the free stations and the ones you make yourself; FM carries the
 * premium ones. A hairline rail runs down the left with a red marker parked on
 * whatever's playing, and each station's dial number sits in its own column —
 * so the number reads first, then the name, exactly like a head unit.
 */

/** The big band letters, with the printed scale a real dial has beside them. */
function BandHeader({ band, caption }: { band: Band; caption: string }) {
  return (
    <View style={styles.bandRow}>
      <View style={styles.railCol} />
      <Text style={[styles.bandLetters, { fontFamily: Fonts.mono }]}>{band}</Text>
      <View style={styles.bandTicks}>
        {Array.from({ length: 22 }).map((_, i) => (
          <View key={i} style={[styles.dialTick, i % 4 === 0 && styles.dialTickTall]} />
        ))}
      </View>
      <Text style={[styles.bandCaption, { fontFamily: Fonts.mono }]}>{caption}</Text>
    </View>
  );
}

/**
 * One station on the dial: rail, number, then the card.
 *
 * The rail line is drawn inside every row rather than once behind the list, so
 * the rows stack into one continuous line on their own and the red marker
 * lands on the right station with nothing to measure. It stops 14px short at
 * the bottom because that's the card's own margin — otherwise the marker
 * centres on the gap instead of the card.
 */
function DialRow({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.dialRow}>
      <View style={styles.railCol}>
        <View style={styles.railLine} />
        {active && (
          <View style={styles.railMarkBox} pointerEvents="none">
            <View style={styles.railMark} />
          </View>
        )}
      </View>
      <Text style={[styles.freq, active && styles.freqActive, { fontFamily: Fonts.mono }]}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
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

  const [onAirStation, setOnAirStation] = useState<Station>(() => stationById(defaultStationForNow()));
  const [poetry, setPoetry] = useState(POETRY[0]);

  async function fetchCustom() {
    const loaded = await loadCustomStations();
    setCustomStations(loaded);
  }

  useEffect(() => { fetchCustom(); }, []);
  useFocusEffect(useCallback(() => {
    fetchCustom();
    setOnAirStation(stationById(defaultStationForNow()));
    setPoetry(POETRY[Math.floor(Math.random() * POETRY.length)]);
  }, []));

  // AM = free + the user's own; FM = premium. Both sorted up the dial, the way
  // a receiver's scale runs, so the numbers on the left always ascend.
  const amBand = [
    ...customStations.map((c) => ({ kind: 'custom' as const, station: c, dial: stationDial(c.id, false) })),
    ...STATIONS.filter((s) => !s.premium).map((s) => ({ kind: 'station' as const, station: s, dial: stationDial(s.id, false) })),
  ].sort((a, b) => a.dial.value - b.dial.value);

  const fmBand = STATIONS.filter((s) => s.premium)
    .map((s) => ({ station: s, dial: stationDial(s.id, true) }))
    .sort((a, b) => a.dial.value - b.dial.value);

  // The red marker parks on whatever's playing, and falls back to the station
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
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>What's the mood?</Text>
              <Text style={styles.poetry}>{poetry}</Text>
            </View>
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

        <BandHeader band="AM" caption="FREE" />
        {amBand.map(({ kind, station, dial }) => (
          <DialRow key={station.id} label={dial.label} active={station.id === tunedId}>
            {kind === 'custom' ? (
              <CustomStationCard station={station as CustomStation} onPress={() => setSelectedStation(station)} />
            ) : (
              <StationCard station={station as Station} onPress={() => setSelectedStation(station)} />
            )}
          </DialRow>
        ))}

        <BandHeader band="FM" caption="PREMIUM" />
        {fmBand.map(({ station, dial }) => (
          <DialRow key={station.id} label={dial.label} active={station.id === tunedId}>
            {isPro ? (
              <StationCard station={station} onPress={() => setSelectedStation(station)} />
            ) : (
              <View style={styles.lockedWrapper}>
                <StationCard station={station} />
                <View style={styles.lockOverlay}>
                  <PremiumShimmer />
                  <Ionicons name="lock-closed" size={20} color="#fff" style={styles.lockIcon} />
                  <Text style={styles.lockText}>Unlock with Premium</Text>
                </View>
              </View>
            )}
          </DialRow>
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

function CustomStationCard({ station, onPress }: { station: CustomStation; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.customCard,
        { shadowColor: station.glowColor },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.customCardInner, { borderColor: station.color + '5C' }]}>
        <LinearGradient
          colors={[station.color + '82', station.color + '46', station.color + '1A']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.customIcon, { backgroundColor: station.color + '38', borderColor: station.color + '99' }]}>
          {/* New stations store an icon name; older ones may still hold an emoji. */}
          {/^[a-z]/.test(station.icon) ? (
            <MaterialCommunityIcons name={station.icon as any} size={24} color="#fff" />
          ) : (
            <Text style={styles.customIconEmoji}>{station.icon}</Text>
          )}
        </View>
        {/* Centred to match the station cards beside it on the dial */}
        <View style={styles.customText}>
          <Text style={styles.customName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.customTagline} numberOfLines={1}>{station.tagline}</Text>
        </View>
        <View style={styles.customChevronBlock}>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
        </View>
        <View style={[styles.myBadge, { backgroundColor: station.color + '22', borderColor: station.color + '55' }]}>
          <Text style={[styles.myBadgeText, { color: station.color }]}>MINE</Text>
        </View>
      </View>
    </Pressable>
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
  },
  poetry: {
    color: Cruise.textSecondary,
    fontSize: 13.5,
    fontStyle: 'italic',
    marginTop: 5,
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

  // ── The dial ──────────────────────────────────────────────────────────────
  // Rail column, then the number, then the card. RAIL_W + FREQ_W is what the
  // cards give up, so keep both tight.
  railCol: {
    width: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // Full height on purpose: the rows butt up against each other so their rails
  // join into one unbroken line down the page.
  railLine: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  // Stops 14 short of the bottom — that's the card's own margin, so the marker
  // centres on the card rather than on the gap below it.
  railMarkBox: {
    position: 'absolute',
    top: 0,
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railMark: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 7,
    elevation: 4,
  },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freq: {
    width: 46,
    textAlign: 'right',
    color: '#FF9A2E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    // The card carries a 14 bottom margin, so lift the number by half of it to
    // sit level with the card's middle rather than the row's.
    marginBottom: 14,
  },
  // The tuned station's number burns brighter, the way a lit segment does —
  // the red marker on the rail already says WHERE, this says HOW LOUD.
  freqActive: {
    color: '#FFD79B',
    textShadowColor: '#FF9A2E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },

  // ── Band headers ──
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  bandLetters: {
    color: Cruise.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
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
  sectionLabel: {
    color: Cruise.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  customCard: {
    marginBottom: 14,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 9,
  },
  customCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(13,15,26,0.58)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
  },
  customIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  customIconEmoji: { fontSize: 20 },
  customText: { flex: 1, alignItems: 'flex-start' },
  customName: {
    color: Cruise.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  customTagline: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11.5,
  },
  customChevronBlock: {
    width: 26,
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  // Corner-mounted for the same reason the PREMIUM badge is: nothing may share
  // the name's row, or the name stops being centred.
  myBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
  },
  myBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  customChevron: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 26,
    lineHeight: 28,
  },
  lockedWrapper: { position: 'relative' },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    // Stop 14 short: that's the card's own bottom margin, and without this the
    // lock panel hangs below the card it's covering.
    bottom: 14,
    borderRadius: 20,
    overflow: 'hidden',          // clip the shimmer sweep to the card's rounded rect
    backgroundColor: 'rgba(8, 15, 51, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockIcon: { fontSize: 22 },
  lockText: {
    color: Cruise.amber,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    color: Cruise.textMuted,
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
  },
});
