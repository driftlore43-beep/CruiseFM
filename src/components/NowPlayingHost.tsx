import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotion } from '@/context/MotionContext';

import { GlossSheen } from '@/components/GlossSheen';

import { CassetteFullscreen } from '@/components/CassetteMode';
import { DriveCheckCard } from '@/components/DriveCheckCard';
import { CircularWaveFullscreen } from '@/components/CircularWaveMode';
import { DiscoBallFullscreen } from '@/components/DiscoBallMode';
import { CDFullscreen } from '@/components/CDMode';
import { EqualizerFullscreen } from '@/components/EqualizerMode';
import { HorizonFullscreen } from '@/components/HorizonMode';
import { MirrorBallGlyph } from '@/components/MirrorBallGlyph';
import { TunerFullscreen } from '@/components/TunerMode';
import { VinylFullscreen } from '@/components/VinylMode';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { TAB_BAR_BOTTOM, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { isSpotifyConnected, pause as pauseSpotify } from '@/utils/spotify';
import { useMusicPlayback } from '@/utils/useMusicPlayback';

// `icon` is a MaterialCommunityIcons glyph; `glyph: true` means the mode has
// a drawn icon instead (no icon font has a mirror ball).
const MODE_META: Record<string, { label: string; icon: string; glyph?: boolean }> = {
  cassette:  { label: 'Cassette',    icon: 'cassette' },
  equalizer: { label: 'Equalizer',   icon: 'equalizer' },
  vinyl:     { label: 'Vinyl',       icon: 'album' },
  radio:     { label: 'Tuner',       icon: 'radio-tower' },
  horizon:   { label: 'Horizon',     icon: 'weather-sunset-up' },
  orb:       { label: 'Circular EQ', icon: 'chart-donut' },
  disco:     { label: 'Mirror Ball', icon: 'mirror-variant', glyph: true },
  cd:        { label: 'CD',          icon: 'disc' },
};

// ── Spotify-style mini-player — docks above the floating tab bar ──────────────
function MiniPlayer() {
  const np = useNowPlaying();
  const insets = useSafeAreaInsets();
  const visible = !!np.session && !np.expanded;
  // Minimized = less detail on screen → poll Spotify at a relaxed pace.
  const spotify = useMusicPlayback(visible, { pollMs: 12000 });

  if (!visible || !np.session) return null;

  const station = resolveAnyStation(np.session!.stationId);
  const meta = MODE_META[np.session.mode] ?? { label: 'Now Playing', icon: 'music' };
  const bottom =
    (Platform.OS === 'ios' ? Math.max(insets.bottom, TAB_BAR_BOTTOM) : TAB_BAR_BOTTOM) +
    TAB_BAR_HEIGHT + 10;

  const togglePlay = () => {
    // Handoff drives have no in-app control — send the user back to Spotify.
    // But if we actually have live playback (a real track), controls work.
    if (np.handoff && !spotify.track) { np.returnToSpotify(); return; }
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
          {meta.glyph
            ? <MirrorBallGlyph size={19} />
            : <MaterialCommunityIcons name={meta.icon as any} size={17} color="#fff" />}
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

// How long without a touch before the screen eases down, and how low it goes.
// 0.35 keeps the visuals clearly readable in daylight while still saving
// meaningful battery (0.22 proved too dark outside night drives).
const DIM_AFTER_MS = 30000;
const DIM_LEVEL = 0.35;

/**
 * Auto-dim — like a car head unit: mid-drive, after ~30s without a touch,
 * the screen brightness eases down (the visuals keep glowing); the first tap
 * anywhere wakes it back to full and nothing underneath gets pressed by
 * accident. The screen is the biggest battery cost of a drive, so this is
 * the single largest saver in the app. Profile toggle, default ON.
 *
 * Brightness is always restored — on touch, on pause, on minimize, when the
 * app backgrounds, and on unmount — so the phone never gets stuck dim.
 */
function AutoDim() {
  const np = useNowPlaying();
  const { autoDim } = useMotion();
  const [dimmed, setDimmed] = useState(false);
  const origRef = useRef<number | null>(null);

  const eligible = autoDim && !!np.session && np.expanded && np.playing && Platform.OS !== 'web';

  const restore = useCallback(async () => {
    setDimmed(false);
    const orig = origRef.current;
    origRef.current = null;
    if (orig == null) return;
    try {
      if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
      else await Brightness.setBrightnessAsync(orig);
    } catch { /* never leave the user stuck — but nothing more we can do */ }
  }, []);

  // The countdown: any playback-control touch (activityTick) restarts it.
  //
  // `cancelled` matters more than it looks. The timer fires and then AWAITS
  // the brightness calls; if the user closes the mode during that gap,
  // clearTimeout is far too late and the continuation still ran setDimmed(true)
  // — mounting the invisible full-screen catch layer OVER the app the user had
  // just returned to. It cleared itself a render later, but for that moment
  // taps and swipes went nowhere.
  useEffect(() => {
    if (!eligible || dimmed) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const orig = await Brightness.getBrightnessAsync();
        if (cancelled) return;
        await Brightness.setBrightnessAsync(DIM_LEVEL);
        if (cancelled) { Brightness.setBrightnessAsync(orig).catch(() => {}); return; }
        origRef.current = orig;
        setDimmed(true);
      } catch { /* no brightness control — skip silently */ }
    }, DIM_AFTER_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [eligible, dimmed, np.activityTick]);

  // Losing eligibility (pause, minimize, stop, toggle off) wakes the screen.
  useEffect(() => {
    if (!eligible && dimmed) restore();
  }, [eligible, dimmed, restore]);

  // Leaving the app must never leave the phone stuck dim.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') restore(); });
    return () => { sub.remove(); restore(); };
  }, [restore]);

  if (!dimmed) return null;
  // Invisible catch layer: the wake tap lands here, not on the controls.
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={restore}>
      <Pressable style={{ flex: 1 }} onPress={restore} />
    </Modal>
  );
}

/**
 * "Why is my drive silent?" — when a start attempt fails, Spotify's verdict
 * surfaces here in plain words instead of dying in a log. Its own Modal so it
 * stacks above whichever mode is presenting; a tap anywhere dismisses it, and
 * it bows out on its own after a few seconds.
 */
function PlaybackNotice() {
  const np = useNowPlaying();
  const notice = np.playbackNotice;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(np.clearPlaybackNotice, 8000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={np.clearPlaybackNotice}>
      <Pressable style={pn.scrim} onPress={np.clearPlaybackNotice}>
        <View style={pn.card}>
          <View style={pn.iconRing}>
            <MaterialCommunityIcons name="spotify" size={22} color="#1DB954" />
          </View>
          <Text style={pn.text}>{notice}</Text>
          <Text style={pn.hint}>Tap anywhere to dismiss</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const pn = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(2,2,10,0.45)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 120,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 8,
    backgroundColor: 'rgba(10,14,10,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.4)',
  },
  iconRing: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(29,185,84,0.14)',
  },
  text: { color: 'rgba(255,255,255,0.92)', fontSize: 14.5, lineHeight: 21, textAlign: 'center', fontWeight: '600' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' },
});


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
      {mode === 'orb' && <CircularWaveFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'disco' && <DiscoBallFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      {mode === 'cd' && <CDFullscreen visible={np.expanded} onClose={np.minimize} stationId={sid} />}
      <MiniPlayer />
      <DriveCheckCard />
      <PlaybackNotice />
      <AutoDim />
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
