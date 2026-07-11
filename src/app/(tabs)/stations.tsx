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
import { STATIONS, type Station } from '@/constants/stations';
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

/** FM-dial section divider — ruler ticks with the label and a frequency. */
function DialDivider({ label, freq }: { label: string; freq: string }) {
  return (
    <View style={styles.dialRow}>
      <Text style={[styles.dialLabel, { fontFamily: Fonts.mono }]}>{label}</Text>
      <View style={styles.dialTicks}>
        {Array.from({ length: 25 }).map((_, i) => (
          <View key={i} style={[styles.dialTick, i % 4 === 0 && styles.dialTickTall]} />
        ))}
      </View>
      <Text style={[styles.dialFreq, { fontFamily: Fonts.mono }]}>{freq}</Text>
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

  const free = STATIONS.filter((s) => !s.premium);
  const premium = STATIONS.filter((s) => s.premium);

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

        {customStations.length > 0 && (
          <>
            <DialDivider label="MY STATIONS" freq="87.9" />
            {customStations.map((station) => (
              <CustomStationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
            ))}
          </>
        )}

        {free.length > 0 && (
          <>
            <DialDivider label="FREE" freq="92.1" />
            {free.map((station) => (
              <StationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
            ))}
          </>
        )}

        {premium.length > 0 && (
          <>
            <DialDivider label="PREMIUM" freq="101.3" />
            {premium.map((station) =>
              isPro ? (
                <StationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
              ) : (
                <View key={station.id} style={styles.lockedWrapper}>
                  <StationCard station={station} />
                  <View style={styles.lockOverlay}>
                    <PremiumShimmer />
                    <Ionicons name="lock-closed" size={20} color="#fff" style={styles.lockIcon} />
                    <Text style={styles.lockText}>Unlock with Premium</Text>
                  </View>
                </View>
              ),
            )}
          </>
        )}

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
      <View style={[styles.customCardInner, { borderColor: station.color + '33' }]}>
        <View style={[styles.customIcon, { backgroundColor: station.iconBg, borderColor: station.color + '66' }]}>
          {/* New stations store an icon name; older ones may still hold an emoji. */}
          {/^[a-z]/.test(station.icon) ? (
            <MaterialCommunityIcons name={station.icon as any} size={24} color="#fff" />
          ) : (
            <Text style={styles.customIconEmoji}>{station.icon}</Text>
          )}
        </View>
        <View style={styles.customText}>
          <Text style={styles.customName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.customTagline} numberOfLines={1}>{station.tagline}</Text>
        </View>
        <View style={styles.customChevronBlock}>
          <View style={[styles.myBadge, { backgroundColor: station.color + '22', borderColor: station.color + '55' }]}>
            <Text style={[styles.myBadgeText, { color: station.color }]}>MINE</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Cruise.midnight,
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

  // ── FM-dial section dividers ──
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  dialLabel: {
    color: Cruise.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dialTicks: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 10,
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
  dialFreq: {
    color: Cruise.amber,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  customCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Cruise.surface,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  customIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  customIconEmoji: { fontSize: 22 },
  customText: { flex: 1 },
  customName: {
    color: Cruise.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  customTagline: {
    color: Cruise.textSecondary,
    fontSize: 12,
  },
  customChevronBlock: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  myBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    borderRadius: 16,
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
