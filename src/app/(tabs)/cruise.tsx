import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { EqualizerHeader } from '@/components/EqualizerHeader';
import { HeroCard } from '@/components/HeroCard';
import { StationCard } from '@/components/StationCard';
import { StationDetailModal } from '@/components/StationDetailModal';
import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { CassetteFullscreen } from '@/components/CassetteMode';
import { RetroRadioFullscreen } from '@/components/RetroRadioMode';
import { IpodClassicFullscreen } from '@/components/IpodMode';
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
  resolveCruiseToStart,
} from '@/utils/lastCruise';
import { isSpotifyConnected, startPlayback } from '@/utils/spotify';

const recommended = STATIONS.filter((s) => RECOMMENDED_IDS.includes(s.id));

function stationName(id: string): string {
  return STATIONS.find((s) => s.id === id)?.name ?? STATIONS[0].name;
}

function SkipBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>🎵  Connect your music platform in Profile → Settings</Text>
      <Pressable onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.bannerClose}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function CruiseScreen() {
  const insets = useSafeAreaInsets();
  const [showBanner, setShowBanner] = useState(false);
  const [cueLabel, setCueLabel] = useState('Tap to start your drive');
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | undefined>(undefined);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  useEffect(() => {
    getPlatformSkipped().then((skipped) => { if (skipped) setShowBanner(true); });
  }, []);

  // Refresh the cue label each time the screen is focused (last cruise may change).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLastCruise().then((last) => {
        if (!active) return;
        if (last) setCueLabel(`Resuming ${stationName(last.stationId)}`);
        else setCueLabel(`Tonight's pick: ${stationName(defaultStationForNow())}`);
      });
      return () => { active = false; };
    }, []),
  );

  async function handleStartDrive() {
    const cruise = await resolveCruiseToStart();
    await saveLastCruise(cruise);
    setActiveStationId(cruise.stationId);

    if (await isSpotifyConnected()) {
      // Resume only if Spotify already has a live device. If not, we do NOT
      // yank the user to Spotify — just open the visual.
      await startPlayback().catch(() => {});
    }
    setActiveMode(cruise.mode);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_SAFE_INSET + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <EqualizerHeader />
        {showBanner && <SkipBanner onDismiss={() => setShowBanner(false)} />}
        <HeroCard onStartDrive={handleStartDrive} cueLabel={cueLabel} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOMMENDED</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontal}>
            {recommended.map((station) => (
              <StationCard key={station.id} station={station} compact onPress={() => setSelectedStation(station)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALL STATIONS</Text>
          <View style={styles.stationList}>
            {STATIONS.map((station) => (
              <StationCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
            ))}
          </View>
        </View>
      </ScrollView>

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
        isPro={OWNER_MODE}
      />

      <EqualizerFullscreen visible={activeMode === 'equalizer'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <VinylFullscreen visible={activeMode === 'vinyl'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <CassetteFullscreen visible={activeMode === 'cassette'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <RetroRadioFullscreen visible={activeMode === 'radio'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <IpodClassicFullscreen visible={activeMode === 'ipod'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <SoundWaveFullscreen visible={activeMode === 'waves'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
      <CircularWaveFullscreen visible={activeMode === 'orb'} onClose={() => setActiveMode(null)} stationId={activeStationId} />
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
  stationList: { paddingHorizontal: 16 },
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
