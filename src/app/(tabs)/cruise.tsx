import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ConnectMusicCard } from '@/components/ConnectMusicCard';
import { ConnectSpotifyCard } from '@/components/ConnectSpotifyCard';
import { SpotifyNudgeCard } from '@/components/SpotifyNudgeCard';
import { DriveStatsStrip } from '@/components/DriveStatsStrip';
import { EqualizerHeader } from '@/components/EqualizerHeader';
import { HeroCard } from '@/components/HeroCard';
import { ShelfCard, SHELF_CARD_W } from '@/components/ShelfCard';
import { StationDetailModal } from '@/components/StationDetailModal';
import { isProMode } from '@/constants/modeCatalog';
import { useEntitlements } from '@/context/EntitlementsContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { Cruise, PAGE_GUTTER, TAB_SAFE_INSET } from '@/constants/theme';
import { RECOMMENDED_IDS, STATIONS, type Station } from '@/constants/stations';
import {
  loadLastCruise,
  saveLastCruise,
  defaultStationForNow,
  type LastCruise,
} from '@/utils/lastCruise';
import { recordDriveStart } from '@/utils/driveStats';
import { useMusicPlayback } from '@/utils/useMusicPlayback';
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

/**
 * The page title. Time-aware, because "Welcome back" said the same thing at
 * 7am and midnight — and on a first launch it was simply untrue, which is why
 * a driver with no saved cruise gets welcomed in rather than back.
 */
function greetingFor(hour: number, returning: boolean): string {
  if (!returning) return 'Welcome';
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setFocused(true);
      setTonightPick(stationById(defaultStationForNow()));
      setStatsKey((k) => k + 1);
      getDriverName().then((n) => { if (active) setDriverName(n); });
      loadCustomStations().then(() => loadLastCruise()).then((last) => { if (active) setLastCruise(last); });
      return () => { active = false; setFocused(false); };
    }, []),
  );

  // Light Spotify pulse-check (slow poll, only while this tab is focused) so
  // the header equalizer wakes up when music is playing — even before any
  // Cruise drive has started.
  const spotify = useMusicPlayback(focused, { pollMs: 15000 });

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
  // The hero's eyebrow already says TONIGHT'S PICK / PICK UP WHERE YOU LEFT
  // OFF, so the line underneath just names the station and mode. It used to
  // read "Tonight's pick: <station>", which said the same words twice inside
  // one card.
  const heroCue = lastCruise
    ? `${heroStation.name} · ${MODE_LABELS[heroCruise.mode] ?? 'Equalizer'} mode`
    : heroStation.name;

  const handleStartDrive = () => launchCruise(heroCruise);

  // The "NOW PLAYING" header follows the live drive if there is one, otherwise
  // it previews tonight's pick — never a stale hardcoded name.
  const nowStation = np.session ? stationById(np.session.stationId) : heroStation;

  return (
    <View style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: TAB_SAFE_INSET + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Shown whenever there is a drive open or music genuinely playing —
            and its bars move only while the audio does. Opening a station or
            mode card creates the session, so the meter is up and running for
            the whole drive and rests the moment it's paused. */}
        {(!!np.session || !!spotify.track?.isPlaying) && (
          <EqualizerHeader
            stationName={nowStation.name}
            live={!!spotify.track?.isPlaying || (!!np.session && np.playing)}
            accent={nowStation.eqColors?.[1]}
          />
        )}

        {/* The title, then the one big thing. The connect cards used to sit
            above this and pushed the greeting clean off the screen, so the
            first thing a returning driver saw was a beta warning about
            somebody else's service. They come after the hero now. */}
        <Text style={styles.greeting}>
          {greetingFor(new Date().getHours(), !!lastCruise)},{'\n'}{driverName}
        </Text>

        <HeroCard
          onStartDrive={handleStartDrive}
          cueLabel={heroCue}
          station={heroStation}
          buttonLabel={lastCruise ? 'Continue Drive' : 'Start Drive'}
        />

        <View style={styles.connects}>
          <ConnectSpotifyCard />
          <ConnectMusicCard />
          <SpotifyNudgeCard />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Recommended</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SHELF_CARD_W + 14}
            decelerationRate="fast"
            contentContainerStyle={styles.shelf}>
            {recommended.map((station) => (
              <ShelfCard key={station.id} station={station} onPress={() => setSelectedStation(station)} />
            ))}
          </ScrollView>
        </View>

        <DriveStatsStrip refreshKey={statsKey} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: {},
  // The page title, at the same weight and size as "Now tuning" and "Modes".
  // It was 15pt — smaller than the station names underneath it.
  greeting: {
    color: Cruise.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.3,
    lineHeight: 39,
    marginHorizontal: PAGE_GUTTER,
    marginBottom: 22,
  },
  connects: { marginTop: 18 },
  section: { marginTop: 30, marginBottom: 30, gap: 14 },
  // Sentence case at 21pt, not letterspaced small caps: the eyebrow style is
  // reserved for labels inside artwork now, so section headings can be read
  // rather than deciphered.
  sectionHeading: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginHorizontal: PAGE_GUTTER,
  },
  shelf: { paddingHorizontal: PAGE_GUTTER, gap: 14, paddingBottom: 2 },
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
