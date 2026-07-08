import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { DriveStatsStrip } from '@/components/DriveStatsStrip';
import { EqualizerHeader } from '@/components/EqualizerHeader';
import { HeroCard } from '@/components/HeroCard';
import { StationCard } from '@/components/StationCard';
import { StationDetailModal } from '@/components/StationDetailModal';
import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { CassetteFullscreen } from '@/components/CassetteMode';
import { RetroRadioFullscreen } from '@/components/RetroRadioMode';
import { SoundWaveFullscreen } from '@/components/SoundWaveMode';
import { CircularWaveFullscreen } from '@/components/CircularWaveMode';
import { OWNER_MODE } from '@/constants/config';
import { Cruise, TAB_SAFE_INSET } from '@/constants/theme';
import { RECOMMENDED_IDS, STATIONS, type Station } from '@/constants/stations';
import { getPlatformSkipped } from '@/utils/musicPlatform';
import {
  loadLastCruise,
  saveLastCruise,
  defaultStationForNow,
  type LastCruise,
} from '@/utils/lastCruise';
import { recordDriveStart, recordDriveEnd } from '@/utils/driveStats';
import { isSpotifyConnected, startPlayback } from '@/utils/spotify';

const recommended = STATIONS.filter((s) => RECOMMENDED_IDS.includes(s.id));

const MODE_LABELS: Record<string, string> = {
  cassette: 'Cassette',
  equalizer: 'Equalizer',
  vinyl: 'Vinyl',
  radio: 'Retro Radio',
  waves: 'Sound Waves',
  orb: 'Circular EQ',
};

function stationById(id: string): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

function SkipBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.banner}>
      <Ionicons name="musical-notes" size={16} color="rgba(255,255,255,0.75)" />
      <Text style={styles.bannerText}>Connect your music platform in Profile settings</Text>
      <Pressable onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
      </Pressable>
    </View>
  );
}


export default function CruiseScreen() {
  const insets = useSafeAreaInsets();
  const [showBanner, setShowBanner] = useState(false);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | undefined>(undefined);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  // One smart hero: it becomes your last cruise if you have one, otherwise
  // tonight's time-of-day pick. Scene, cue and button all track it.
  const [tonightPick, setTonightPick] = useState<Station>(() => stationById(defaultStationForNow()));
  const [lastCruise, setLastCruise] = useState<LastCruise | null>(null);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    getPlatformSkipped().then((skipped) => { if (skipped) setShowBanner(true); });
  }, []);

  // Refresh on every focus — the time of day, last cruise and stats move on.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setTonightPick(stationById(defaultStationForNow()));
      setStatsKey((k) => k + 1);
      loadLastCruise().then((last) => { if (active) setLastCruise(last); });
      return () => { active = false; };
    }, []),
  );

  async function launchCruise(cruise: LastCruise) {
    await saveLastCruise(cruise);
    setLastCruise(cruise);
    setActiveStationId(cruise.stationId);
    recordDriveStart(cruise.stationId);

    if (await isSpotifyConnected()) {
      // Resume only if Spotify already has a live device. If not, we do NOT
      // yank the user to Spotify — just open the visual.
      await startPlayback().catch(() => {});
    }
    // iPod mode was retired — resume any old saved iPod cruise in Equalizer.
    setActiveMode(cruise.mode === 'ipod' ? 'equalizer' : cruise.mode);
  }

  // Closing a mode banks the drive's minutes, then the strip refreshes.
  const closeMode = () => {
    setActiveMode(null);
    recordDriveEnd().then(() => setStatsKey((k) => k + 1));
  };

  const heroCruise: LastCruise = lastCruise ?? { stationId: tonightPick.id, mode: 'equalizer' };
  const heroStation = stationById(heroCruise.stationId);
  const heroCue = lastCruise
    ? `${heroStation.name} · ${MODE_LABELS[heroCruise.mode] ?? 'Equalizer'} mode`
    : `Tonight's pick: ${heroStation.name}`;

  const handleStartDrive = () => launchCruise(heroCruise);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <EqualizerHeader />
        {showBanner && <SkipBanner onDismiss={() => setShowBanner(false)} />}
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
        onStartDrive={(mode) => {
          if (selectedStation) {
            const cruise = { stationId: selectedStation.id, mode };
            saveLastCruise(cruise);
            setLastCruise(cruise);
            setActiveStationId(selectedStation.id);
            recordDriveStart(selectedStation.id);
          }
          setSelectedStation(null);
          setActiveMode(mode);
        }}
        isPro={OWNER_MODE}
      />

      <EqualizerFullscreen visible={activeMode === 'equalizer'} onClose={closeMode} stationId={activeStationId} />
      <VinylFullscreen visible={activeMode === 'vinyl'} onClose={closeMode} stationId={activeStationId} />
      <CassetteFullscreen visible={activeMode === 'cassette'} onClose={closeMode} stationId={activeStationId} />
      <RetroRadioFullscreen visible={activeMode === 'radio'} onClose={closeMode} stationId={activeStationId} />
      <SoundWaveFullscreen visible={activeMode === 'waves'} onClose={closeMode} stationId={activeStationId} />
      <CircularWaveFullscreen visible={activeMode === 'orb'} onClose={closeMode} stationId={activeStationId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { paddingTop: 4 },
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
