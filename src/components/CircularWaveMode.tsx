import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, ImageBackground, Modal,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { STATIONS } from '@/constants/stations';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

const SCREEN_H = Dimensions.get('window').height;

// Orb geometry (SVG viewBox units)
const VB = 300;
const CX = VB / 2;
const CY = VB / 2;
const R0 = 86;          // sphere radius / inner ring
const MAXLEN = 46;      // outward EQ bar length
const NBARS = 64;

// Static latitude rings (flattened → wireframe-globe look)
const LAT = [-0.82, -0.55, -0.28, 0, 0.28, 0.55, 0.82].map((f) => {
  const off = R0 * f;
  const rx = Math.sqrt(Math.max(1, R0 * R0 - off * off));
  return { cy: off, rx, ry: rx * 0.2 };
});
const NMERID = 6;       // rotating meridians

const DEMO_DURATION_MS = 214000; // 3:34

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Radial spectrum value for a given angle+phase (0..~1.1).
function spectrum(a: number, phase: number): number {
  return (
    0.5 +
    0.28 * Math.sin(3 * a + phase) +
    0.20 * Math.sin(7 * a - phase * 1.3) +
    0.12 * Math.sin(13 * a + phase * 0.6)
  );
}

// All outward bars as one path.
function orbBars(phase: number, amp: number): string {
  let d = '';
  for (let i = 0; i < NBARS; i++) {
    const a = (i / NBARS) * Math.PI * 2 + phase * 0.22;   // slow rotation
    const len = MAXLEN * amp * Math.max(0.12, spectrum(a, phase));
    const c = Math.cos(a), s = Math.sin(a);
    d += `M${(CX + R0 * c).toFixed(1)} ${(CY + R0 * s).toFixed(1)}L${(CX + (R0 + len) * c).toFixed(1)} ${(CY + (R0 + len) * s).toFixed(1)}`;
  }
  return d;
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function CircularWaveFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
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

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);
  const playingRef = useRef(false);
  const ampRef = useRef(0.55);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setElapsedMs(value * DEMO_DURATION_MS));
    return () => progress.removeListener(id);
  }, []);

  // Orb animation loop — throttled to ~30fps.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 33) {
        last = now;
        const target = playingRef.current ? 1 : 0.55;
        ampRef.current += (target - ampRef.current) * 0.08;
        setPhase(((now - start) / 1000) * 1.5);
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
    setPlaying(false); progress.setValue(0); setElapsedMs(0); ampRef.current = 0.55;
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
  const orbSize = Math.min(winW * 0.94, winH * 0.47, 400);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#04060f' }, { transform: [{ translateY: slideY }] }]}>

        {/* Blurred station background */}
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={3.5}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            'rgba(2,3,14,0.34)', 'rgba(2,3,14,0.26)', 'rgba(2,3,14,0.44)',
            'rgba(2,3,14,0.58)', 'rgba(2,3,14,0.68)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', glowTint, 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.26, bottom: winH * 0.34 }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>CIRCULAR EQ</Text>
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

          {/* Orb */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={orbSize} height={orbSize} viewBox={`0 0 ${VB} ${VB}`}>
              <Defs>
                <RadialGradient id="cwStroke" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor="#EAF3FF" />
                  <Stop offset="0.5" stopColor={eq[0]} />
                  <Stop offset="0.75" stopColor={eq[1]} />
                  <Stop offset="1" stopColor={eq[2]} />
                </RadialGradient>
                <RadialGradient id="cwCore" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor={eq[1]} stopOpacity="0.30" />
                  <Stop offset="0.7" stopColor={eq[2]} stopOpacity="0.10" />
                  <Stop offset="1" stopColor={eq[2]} stopOpacity="0" />
                </RadialGradient>
                {/* Spherical shading — lit upper-left, shadowed lower-right */}
                <RadialGradient id="cwSphere" cx="0.36" cy="0.30" r="0.85">
                  <Stop offset="0" stopColor="#EAF3FF" stopOpacity="0.22" />
                  <Stop offset="0.5" stopColor={eq[1]} stopOpacity="0.10" />
                  <Stop offset="1" stopColor="#01030f" stopOpacity="0.44" />
                </RadialGradient>
              </Defs>

              {/* Outer halo */}
              <Circle cx={CX} cy={CY} r={R0 + MAXLEN} fill="url(#cwCore)" />
              {/* Shaded sphere body */}
              <Circle cx={CX} cy={CY} r={R0} fill="url(#cwSphere)" />
              {/* Latitude rings (flattened → globe) */}
              {LAT.map((l, i) => (
                <Ellipse key={`lat${i}`} cx={CX} cy={CY + l.cy} rx={l.rx} ry={l.ry} stroke={eq[1]} strokeOpacity={0.16} strokeWidth={0.9} fill="none" />
              ))}
              {/* Rotating meridians (spin the sphere) */}
              {Array.from({ length: NMERID }).map((_, k) => {
                const th = (k / NMERID) * Math.PI + phase * 0.6;
                const rx = Math.max(1, Math.abs(R0 * Math.cos(th)));
                return <Ellipse key={`mer${k}`} cx={CX} cy={CY} rx={rx} ry={R0} stroke={eq[1]} strokeOpacity={0.15} strokeWidth={0.9} fill="none" />;
              })}
              {/* Rim */}
              <Circle cx={CX} cy={CY} r={R0} stroke={eq[0]} strokeOpacity={0.55} strokeWidth={1.4} fill="none" />
              {/* EQ bars radiating from the surface */}
              <Path d={orbBars(phase, amp)} stroke="url(#cwStroke)" strokeWidth={2.4} strokeOpacity={0.95} fill="none" strokeLinecap="round" />
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
