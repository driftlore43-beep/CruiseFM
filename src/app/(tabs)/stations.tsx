import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { StationCard } from '@/components/StationCard';
import { CreateStationModal } from '@/components/CreateStationModal';
import { StationDetailModal } from '@/components/StationDetailModal';
import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { CassetteFullscreen } from '@/components/CassetteMode';
import { RetroRadioFullscreen } from '@/components/RetroRadioMode';
import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';
import { STATIONS, type Station } from '@/constants/stations';
import { OWNER_MODE } from '@/constants/config';
import { loadCustomStations, type CustomStation } from '@/utils/customStations';
import { saveLastCruise } from '@/utils/lastCruise';

const FREE_CUSTOM_LIMIT = 3;
const IS_PRO = OWNER_MODE;

export default function StationsScreen() {
  const [query, setQuery] = useState('');
  const [customStations, setCustomStations] = useState<CustomStation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  async function fetchCustom() {
    const loaded = await loadCustomStations();
    setCustomStations(loaded);
  }

  useEffect(() => { fetchCustom(); }, []);
  useFocusEffect(useCallback(() => { fetchCustom(); }, []));

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return STATIONS;
    return STATIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query]);

  const filteredCustom = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return customStations;
    return customStations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q),
    );
  }, [query, customStations]);

  const free = filtered.filter((s) => !s.premium);
  const premium = filtered.filter((s) => s.premium);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>STATIONS</Text>
            <Text style={styles.title}>What's the mood?</Text>
          </View>
          <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stations, vibes..."
            placeholderTextColor={Cruise.textMuted}
            value={query}
            onChangeText={setQuery}
            selectionColor={Cruise.violet}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>

        {filteredCustom.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>MY STATIONS</Text>
            {filteredCustom.map((station) => (
              <CustomStationCard key={station.id} station={station} />
            ))}
          </>
        )}

        {free.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>FREE</Text>
            {free.map((station) => (
              <StationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
            ))}
          </>
        )}

        {premium.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PREMIUM</Text>
            {premium.map((station) =>
              OWNER_MODE ? (
                <StationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
              ) : (
                <View key={station.id} style={styles.lockedWrapper}>
                  <StationCard station={station} />
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.lockText}>Unlock with Premium</Text>
                  </View>
                </View>
              ),
            )}
          </>
        )}

        {filtered.length === 0 && filteredCustom.length === 0 && (
          <Text style={styles.empty}>No stations match "{query}"</Text>
        )}
      </ScrollView>

      <CreateStationModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(s) => {
          setCustomStations((prev) => [...prev, s]);
          setShowCreate(false);
        }}
        existingCount={customStations.length}
        maxFree={FREE_CUSTOM_LIMIT}
        isPro={IS_PRO}
      />

      <StationDetailModal
        station={selectedStation}
        visible={!!selectedStation}
        onClose={() => setSelectedStation(null)}
        onStartDrive={(mode) => {
          if (selectedStation) {
            saveLastCruise({ stationId: selectedStation.id, mode });
            setActiveStationId(selectedStation.id);
          }
          setSelectedStation(null);
          setActiveMode(mode);
        }}
        isPro={IS_PRO}
      />

      <EqualizerFullscreen
        visible={activeMode === 'equalizer'}
        onClose={() => setActiveMode(null)}
        stationId={activeStationId}
      />
      <VinylFullscreen
        visible={activeMode === 'vinyl'}
        onClose={() => setActiveMode(null)}
        stationId={activeStationId}
      />
      <CassetteFullscreen
        visible={activeMode === 'cassette'}
        onClose={() => setActiveMode(null)}
        stationId={activeStationId}
      />
      <RetroRadioFullscreen
        visible={activeMode === 'radio'}
        onClose={() => setActiveMode(null)}
        stationId={activeStationId}
      />
    </SafeAreaView>
  );
}

function CustomStationCard({ station }: { station: CustomStation }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.customCard,
        { shadowColor: station.glowColor },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.customCardInner, { borderColor: station.color + '33' }]}>
        <View style={[styles.customIcon, { backgroundColor: station.iconBg, borderColor: station.color + '66' }]}>
          <Text style={styles.customIconEmoji}>{station.icon}</Text>
        </View>
        <View style={styles.customText}>
          <Text style={styles.customName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.customTagline} numberOfLines={1}>{station.tagline}</Text>
        </View>
        <View style={styles.customChevronBlock}>
          <View style={[styles.myBadge, { backgroundColor: station.color + '22', borderColor: station.color + '55' }]}>
            <Text style={[styles.myBadgeText, { color: station.color }]}>MINE</Text>
          </View>
          <Text style={styles.customChevron}>›</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: Cruise.violetLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 4,
  },
  title: {
    color: Cruise.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  createBtn: {
    backgroundColor: Cruise.violet,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Cruise.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(123, 56, 224, 0.15)',
    gap: 8,
  },
  searchIcon: {
    color: Cruise.textMuted,
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    color: Cruise.textPrimary,
    fontSize: 15,
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
