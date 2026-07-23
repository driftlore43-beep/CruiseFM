import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ConnectSpotifyCard } from '@/components/ConnectSpotifyCard';
import { SpotifyNudgeCard } from '@/components/SpotifyNudgeCard';
import { DriveStatsStrip } from '@/components/DriveStatsStrip';
import { EqualizerHeader } from '@/components/EqualizerHeader';
import { HeroCard } from '@/components/HeroCard';
import { StationCard } from '@/components/StationCard';
import { StationDetailModal } from '@/components/StationDetailModal';
import { isProMode } from '@/constants/modeCatalog';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';
import { RECOMMENDED_IDS, STATIONS, type Station } from '@/constants/stations';
import {
  loadLastCruise,
  saveLastCruise,
  defaultStationForNow,
  type LastCruise,
} from '@/utils/lastCruise';
import { recordDriveStart } from '@/utils/driveStats';
import { loadCustomStations, resolveAnyStation } from '@/utils/customStations';
import { DEFAULT_DRIVER_NAME, getDriverName } from '@/utils/driverName';

const recommended = STATIONS.filter((s) => RECOMMENDED_IDS.includes(s.id));

const MODE_LABELS: Record<string, string> = {
  cassette: 'Cassette',
  equalizer: 'Equalizer',
  vinyl: 'Vinyl',
  radio: 'Tuner',
  horizon: 'Horizon',
  waves: 'Sound Waves',
  orb: 'Circular EQ',
};

function stationById(id: string): Station {
  // Includes the user's own creations (cache primed on focus below).
  return resolveAnyStation(id);
}

export default function CruiseScreen() {
  const insets = useSafeAreaInsets();
  const np = useNowPlaying();
  const { isPro } = useEntitlements();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  // One smart hero: it becomes your last cruise if you have one, otherwise
  // tonight's time-of-day pick. Scene, cue and button all track it.
  const [tonightPick, setTonightPick] = useState<Station>(() => stationById(defaultStationForNow()));
  const [lastCruise, setLastCruise] = useState<LastCruise | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const [driverName, setDriverName] = useState(DEFAULT_DRIVER_NAME);

  // Refresh on every focus — the name, time of day, last cruise and stats move on.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTonightPick(stationById(defaultStationForNow()));
      setStatsKey((k) => k + 1);
      getDriverName().then((n) => { if (active) setDriverName(n); });
      loadCustomStations().then(() => loadLastCruise()).then((last) => { if (active) setLastCruise(last); });
      return () => { active = false; };
    }, []),
  );

  async function launchCruise(cruise: LastCruise) {
    // A free user resuming a saved premium-mode drive only gets a taste — it
    // shouldn't count as a drive or re-save the cruise. (The player enforces
    // the preview clock either way; this keeps the stats honest too.)
    const preview = !isPro && isProMode(cruise.mode);
    if (!preview) {
      await saveLastCruise(cruise);
      setLastCruise(cruise);
      recordDriveStart(cruise.stationId);
    }
    // np.open also kicks Spotify toward the station's linked playlist.
    np.open(cruise.mode, cruise.stationId, { preview });
  }

  const heroCruise: LastCruise = lastCruise ?? { stationId: tonightPick.id, mode: 'equalizer' };
  const heroStation = stationById(heroCruise.stationId);
  const heroCue = lastCruise
    ? `${heroStation.name} · ${MODE_LABELS[heroCruise.mode] ?? 'Equalizer'} mode`
    : `Tonight's pick: ${heroStation.name}`;

  const handleStartDrive = () => launchCruise(heroCruise);

  // The "NOW PLAYING" header follows the live drive if there is one, otherwise
  // it previews tonight's pick — never a stale hardcoded name.
  const nowStation = np.session ? stationById(np.session.stationId) : heroStation;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <EqualizerHeader
          stationName={nowStation.name}
          live={!!np.session}
          accent={nowStation.eqColors?.[1]}
        />
        <ConnectSpotifyCard />
        <SpotifyNudgeCard />
        <Text style={styles.greeting}>Welcome back, {driverName}</Text>
        <HeroCard
          onStartDrive={handleStartDrive}
          cueLabel={heroCue}
          station={heroStation}
          buttonLabel={lastCruise ? 'Continue Drive' : 'Start Drive'}
        />

        <DriveStatsStrip refreshKey={statsKey} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOMMENDED</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={264}
            decelerationRate="fast"
            contentContainerStyle={styles.horizontal}>
            {recommended.map((station) => (
              <StationCard key={station.id} station={station} compact onPress={() => setSelectedStation(station)} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <StationDetailModal
        station={selectedStation}
        visible={!!selectedStation}
        onClose={() => setSelectedStation(null)}
        onStartDrive={(mode, preview) => {
          if (selectedStation) {
            if (!preview) {
              // A taste shouldn't overwrite the saved cruise or count as a drive.
              const cruise = { stationId: selectedStation.id, mode };
              saveLastCruise(cruise);
              setLastCruise(cruise);
              recordDriveStart(selectedStation.id);
            }
            np.open(mode, selectedStation.id, { preview });
          }
          setSelectedStation(null);
        }}
        isPro={isPro}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingTop: 4 },
  greeting: {
    color: Cruise.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginHorizontal: 22,
    marginBottom: 10,
  },
  section: { marginBottom: 30, gap: 14 },
  sectionLabel: {
    color: Cruise.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginHorizontal: 22,
  },
  horizontal: { paddingHorizontal: 22, paddingBottom: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(123,56,224,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(123,56,224,0.35)',
    gap: 10,
  },
  bannerText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  bannerClose: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
  },
  spotifyWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    gap: 10,
  },
  spotifyWarnIcon: {
    fontSize: 15,
    color: Cruise.amber,
  },
  spotifyWarnText: {
    flex: 1,
    color: Cruise.amber,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
});
