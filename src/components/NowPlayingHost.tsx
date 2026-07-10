import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CassetteFullscreen } from '@/components/CassetteMode';
import { CircularWaveFullscreen } from '@/components/CircularWaveMode';
import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { HorizonFullscreen } from '@/components/HorizonMode';
import { SoundWaveFullscreen } from '@/components/SoundWaveMode';
import { TunerFullscreen } from '@/components/TunerMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

const MODE_META: Record<string, { label: string; icon: string }> = {
  cassette:  { label: 'Cassette',    icon: 'cassette' },
  equalizer: { label: 'Equalizer',   icon: 'equalizer' },
  vinyl:     { label: 'Vinyl',       icon: 'album' },
  radio:     { label: 'Tuner',       icon: 'radio-tower' },
  horizon:   { label: 'Horizon',     icon: 'weather-sunset-up' },
  waves:     { label: 'Sound Waves', icon: 'waveform' },
  orb:       { label: 'Circular EQ', icon: 'chart-donut' },
};

// ── Spotify-style mini-player — docks above the floating tab bar ──────────────
function MiniPlayer() {
  const np = useNowPlaying();
  const insets = useSafeAreaInsets();
  const visible = !!np.session && !np.expanded;
  const spotify = useSpotifyPlayback(visible);

  if (!visible || !np.session) return null;

  const station = resolveAnyStation(np.session!.stationId);
  const meta = MODE_META[np.session.mode] ?? { label: 'Now Playing', icon: 'music' };
  const bottom =
    (Platform.OS === 'ios' ? Math.max(insets.bottom, TAB_BAR_BOTTOM) : TAB_BAR_BOTTOM) +
    TAB_BAR_HEIGHT + 10;

  const togglePlay = () => {
    if (np.playing) spotify.pause(); else spotify.play();
    np.setPlaying(!np.playing);
  };

  return (
    <View style={[mp.wrap, { bottom }]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={0.92} onPress={np.expand} style={mp.bar}>
        <LinearGradient
          colors={station.cardGradient}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={mp.iconChip}>
          <MaterialCommunityIcons name={meta.icon as any} size={17} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={mp.title} numberOfLines={1}>{spotify.track?.title ?? station.name}</Text>
          <Text style={mp.sub} numberOfLines={1}>{station.name} · {meta.label}</Text>
        </View>
        <TouchableOpacity
          onPress={togglePlay}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={mp.playBtn}>
          <Ionicons name={np.playing ? 'pause' : 'play'} size={19} color="#0a0a12" style={np.playing ? undefined : { marginLeft: 2 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={np.stop}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
          style={mp.stopBtn}>
          <Ionicons name="close" size={15} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Single home for every mode fullscreen + the mini-player.
 * Mounted once in the tab layout; screens just call useNowPlaying().open().
 * Modes "close" by minimizing — the session (and the music) keeps going
 * until the mini-player's ✕ ends it.
 */
export function NowPlayingHost() {
  const np = useNowPlaying();
  const mode = np.session?.mode;
  const sid = np.session?.stationId;

  // Only the session's mode is mounted — it stays alive while minimized so
  // re-expanding resumes instantly, and idle modes cost nothing.
  return (
    <>
      {mode === 'equalizer' && <EqualizerFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'cassette' && <CassetteFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'vinyl' && <VinylFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'radio' && <TunerFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'horizon' && <HorizonFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'waves' && <SoundWaveFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'orb' && <CircularWaveFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      <MiniPlayer />
    </>
  );
}

const mp = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 16,
  },
  iconChip: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  sub:   { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600' },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  stopBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center', justifyContent: 'center',
  },
});
