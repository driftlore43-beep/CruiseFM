import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, ImageBackground, Modal,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { STATIONS } from '@/constants/stations';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

const SCREEN_H = Dimensions.get('window').height;

// Waveform geometry (SVG viewBox units — scales to fit)
const VB_W = 360;
const VB_H = 240;
const POINTS = 56;

const DEMO_DURATION_MS = 214000; // 3:34

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Independent wave systems — each cluster has its own home, speed & motion ──
// Three overlapping wireframe waves (reference: layered mesh with a tall centre
// spike and smaller clusters either side), all sharing one horizontal core line.
type WaveGroup = {
  cx: number;      // cluster centre along the width (0..1)
  k: number;       // envelope tightness — higher = narrower cluster
  speed: number;   // phase speed multiplier
  dir: 1 | -1;     // travel direction
  f1: number; f2: number; f3: number;  // harmonic frequencies
  layers: number;  // mesh strands in this system
};
const GROUPS: WaveGroup[] = [
  { cx: 0.50, k: 5.6, speed: 1.00, dir: 1,  f1: 2.3, f2: 5.7, f3: 11.0, layers: 7 },
  { cx: 0.29, k: 7.2, speed: 1.45, dir: -1, f1: 3.1, f2: 7.3, f3: 13.0, layers: 6 },
  { cx: 0.73, k: 6.4, speed: 0.75, dir: 1,  f1: 1.9, f2: 4.9, f3:  9.0, layers: 6 },
];

// One strand of one wave system.
function wavePath(phase: number, g: WaveGroup, layer: number, amp: number): string {
  const cy = VB_H / 2;
  const lp = (layer - (g.layers - 1) / 2) * 0.24;            // strand spread → wireframe mesh
  const layerAmp = amp * (1 - (Math.abs(layer - (g.layers - 1) / 2) / g.layers) * 0.75);
  const ph = phase * g.speed * g.dir;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= POINTS; i++) {
    const t = i / POINTS;
    const x = t * VB_W;
    const dx = (t - g.cx) * g.k;
    const env = Math.exp(-dx * dx);                          // this system's own bulge
    const wob =
      Math.sin(t * Math.PI * 2 * g.f1 + ph + lp) * 0.55 +
      Math.sin(t * Math.PI * 2 * g.f2 - ph * 1.3 + lp * 1.4) * 0.30 +
      Math.sin(t * Math.PI * 2 * g.f3 + ph * 0.7 - lp) * 0.15;
    xs.push(x);
    ys.push(cy + wob * env * layerAmp * VB_H * 0.78);        // amplified peaks
  }
  // Smooth through the points with quadratic curves (midpoint method) → silky line.
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 1; i < xs.length - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2;
    const my = (ys[i] + ys[i + 1]) / 2;
    d += ` Q${xs[i].toFixed(1)} ${ys[i].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += ` L${xs[xs.length - 1].toFixed(1)} ${ys[ys.length - 1].toFixed(1)}`;
  return d;
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function SoundWaveFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const station = STATIONS.find((s) => s.id === stationId) ?? STATIONS[0];
  const spotify = useSpotifyPlayback(visible);
  const eq = station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF'];

  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phase, setPhase] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(station.id).then(setLinked);
  }, [visible, station.id]);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);
  const playingRef = useRef(false);
  const ampRef = useRef(0.5);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setElapsedMs(value * DEMO_DURATION_MS));
    return () => progress.removeListener(id);
  }, []);

  // Waveform animation loop — throttled to ~30fps.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 33) {
        last = now;
        const target = playingRef.current ? 1 : 0.5;
        ampRef.current += (target - ampRef.current) * 0.08;
        setPhase(((now - start) / 1000) * 1.7);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const startProgress = (fromMs: number) => {
    const remaining = DEMO_DURATION_MS - fromMs;
    if (remaining <= 0) return;
    progressAnim.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    progressAnim.current.start(({ finished }) => {
      if (!finished) return;
      progress.setValue(0);
      if (playingRef.current) startProgress(0);
    });
  };

  useEffect(() => {
    if (playing) startProgress((progress as any)._value * DEMO_DURATION_MS);
    else progressAnim.current?.stop();
    return () => progressAnim.current?.stop();
  }, [playing]);

  useEffect(() => {
    if (!visible) return;
    slideY.setValue(SCREEN_H);
    setPlaying(false); progress.setValue(0); setElapsedMs(0); ampRef.current = 0.5;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => progressAnim.current?.stop();
  }, [visible]);

  const handleClose = () => {
    setPlaying(false);
    progressAnim.current?.stop();
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const resetTrack = () => { progress.setValue(0); setElapsedMs(0); };
  const togglePlay = () => setPlaying((p) => { if (p) spotify.pause(); else spotify.play(); return !p; });

  const title = spotify.track?.title ?? 'Neon Autobahn';
  const artist = spotify.track?.artist ?? 'Cruise FM';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const glowTint = eq[1] + '26';
  const amp = ampRef.current;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]}>

        {/* Blurred station background */}
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={2.5}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            'rgba(3,4,16,0.30)', 'rgba(3,4,16,0.22)', 'rgba(3,4,16,0.40)',
            'rgba(3,4,16,0.55)', 'rgba(3,4,16,0.66)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', glowTint, 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.30, bottom: winH * 0.30 }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>SOUND WAVES</Text>
          <TouchableOpacity style={fs.closeBtn} onPress={handleClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
          </View>

          {/* Waveform */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
              <Defs>
                <SvgGradient id="swStroke" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={eq[2]} />
                  <Stop offset="0.28" stopColor={eq[1]} />
                  <Stop offset="0.5" stopColor="#EAF3FF" />
                  <Stop offset="0.72" stopColor={eq[1]} />
                  <Stop offset="1" stopColor={eq[2]} />
                </SvgGradient>
                <RadialGradient id="swGlow" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
                  <Stop offset="0" stopColor={eq[0]} stopOpacity="0.30" />
                  <Stop offset="1" stopColor={eq[0]} stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Soft central glow */}
              <Ellipse cx={VB_W / 2} cy={VB_H / 2} rx={VB_W * 0.46} ry={VB_H * 0.34} fill="url(#swGlow)" />

              {/* Wireframe mesh — every system's strands, all reacting at once */}
              {GROUPS.map((g, gi) =>
                Array.from({ length: g.layers }).map((_, l) => (
                  <Path key={`${gi}-${l}`} d={wavePath(phase, g, l, amp)} stroke="url(#swStroke)" strokeWidth={1.4} fill="none" strokeOpacity={0.34} strokeLinecap="round" />
                ))
              )}
              {/* Bright core strand of each system */}
              {GROUPS.map((g, gi) => (
                <Path key={`core-${gi}`} d={wavePath(phase, g, (g.layers - 1) / 2, amp)} stroke="url(#swStroke)" strokeWidth={gi === 0 ? 2.6 : 2} fill="none" strokeOpacity={gi === 0 ? 1 : 0.88} strokeLinecap="round" />
              ))}
            </Svg>
          </View>

          {/* Song title */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>{title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{artist}</Text>
          </View>

          {/* Progress */}
          <View style={{ width: '100%', paddingHorizontal: 28, marginTop: 18 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <Animated.View style={{ height: 6, borderRadius: 3, width: fill, backgroundColor: '#fff' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
              <Text style={[fs.time, { fontFamily: Fonts.mono }]}>{formatMs(elapsedMs)}</Text>
              <Text style={[fs.time, { fontFamily: Fonts.mono }]}>{formatMs(DEMO_DURATION_MS)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={24} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetTrack(); spotify.prev(); }} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-previous" size={44} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={fs.playBtn} activeOpacity={0.9}>
              {playing ? (
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  <View style={fs.pauseBar} />
                  <View style={fs.pauseBar} />
                </View>
              ) : (
                <MaterialCommunityIcons name="play" size={42} color="#0a0a12" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetTrack(); spotify.next(); }} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-next" size={44} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="repeat" size={24} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>

          {/* Playlist */}
          <TouchableOpacity onPress={() => setShowPicker(true)} style={fs.playlistBtn} activeOpacity={0.75}>
            <Ionicons name="musical-notes-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={[fs.playlistBtnText, { fontFamily: Fonts.mono }]} numberOfLines={1}>
              {linked ? linked.name.toUpperCase() : 'ADD PLAYLIST'}
            </Text>
            <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {showPicker && (
          <PlaylistSheet
            stationName={station.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(station.id, pl);
              setLinked(pl);
              setShowPicker(false);
            }}
          />
        )}

      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  topBar: {
    position: 'absolute', left: 20, right: 20, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modeLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 30, marginTop: 18,
  },
  playBtn: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14,
  },
  pauseBar: { width: 8, height: 28, borderRadius: 2, backgroundColor: '#0a0a12' },
  playlistBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    alignSelf: 'center', marginTop: 18, maxWidth: '80%',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  playlistBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});
