import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaylistSheet } from '@/components/PlaylistSheet';
import { MoodSheet } from '@/components/MoodSheet';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;
const DEMO_DURATION_MS = 214000;

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── The mirror ball ───────────────────────────────────────────────────────────
// A "spinning globe" trick, not an in-plane rotate: the facet texture is
// built ONCE (useMemo) as a strip exactly one ball-width wide, rendered
// TWICE side by side, and the pair slides via a single native-driver
// translateX loop inside a circular clip. Because the two copies are
// identical, the loop wraps with zero seam, and it reads as the sphere's
// surface genuinely turning on a vertical axis — the old whole-circle
// `rotate` looked like a flat coin spinning in the picture plane, which is
// what prompted this rebuild. Everything suggesting light/depth (shading,
// rim, highlight, sparkle) is a SEPARATE layer that never moves — real
// light doesn't rotate with the ball, only the mirrors turning underneath it do.

// Deterministic pseudo-random 0..1 from an integer seed (no Math.random —
// the facet grid must render identically every time it's memoized).
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Cheap two-stop hex mix, used by the colour wash.
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

// Neutral, pale cel-shading palette — no baked hue. The moving ColorCycleWash
// (below) tints this at playback time, so the same tiles work for any station.
const ZONE_WHITE = '#ffffff';
const ZONE_LIGHT = '#e9eefa';
const ZONE_MID   = '#b7c1da';
const ZONE_DARK  = '#7a83a2';
const STROKE_COLOR = '#f6f8ff';

type Tile = { d: string; fill: string };

// Chunky geodesic tiles in curved latitude rows (soccer-ball taper — fewer,
// narrower tiles near the poles), each shaded into one of four HARD zones
// (no gradients) so the roundness reads at a glance, like a cel-shaded
// sticker rather than a photoreal mirror ball. One period, `size` wide —
// the seam-tiling contract below is unchanged from the original dot grid.
function buildDiscoTiles(size: number): Tile[] {
  const rows = 9, maxCols = 10, minCols = 3;
  const tiles: Tile[] = [];

  // Latitude bands compress near the poles, open up through the equator.
  const weights: number[] = [];
  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    const phi = (v - 0.5) * Math.PI;
    weights.push(Math.max(0.4, Math.cos(phi)));
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const rowTops: number[] = [];
  let cursor = 0;
  for (let r = 0; r < rows; r++) { rowTops.push(cursor); cursor += (weights[r] / weightSum) * size; }
  rowTops.push(size);

  for (let r = 0; r < rows; r++) {
    const yTop = rowTops[r], yBot = rowTops[r + 1], rowH = yBot - yTop;
    const v = (r + 0.5) / rows;
    const phi = (v - 0.5) * Math.PI;

    // Fewer, narrower tiles near the poles — the soccer-ball UV taper.
    const cols = Math.max(minCols, Math.round(maxCols * Math.cos(phi)));
    const cellW = size / cols;
    const stagger = r % 2 ? cellW / 2 : 0;

    // One sine period per `size`, shared phase across rows, so the dome
    // curvature lines up perfectly at the copy-to-copy seam.
    const bowAmp = rowH * (0.06 + 0.10 * (1 - Math.cos(phi)));
    const bow = (x: number) => bowAmp * Math.sin((2 * Math.PI * x) / size);

    // col runs -1..cols-1: the col=-1 tile is the seam-tiling trick that
    // made the original dot grid tile seamlessly, kept unchanged here.
    for (let c = -1; c < cols; c++) {
      const xLeft = c * cellW + stagger, xRight = xLeft + cellW, xMid = xLeft + cellW / 2;
      const topL = yTop + bow(xLeft), topR = yTop + bow(xRight), topM = yTop + bow(xMid) - rowH * 0.035;
      const botL = yBot + bow(xLeft), botR = yBot + bow(xRight), botM = yBot + bow(xMid) + rowH * 0.035;

      const d = `M ${xLeft.toFixed(2)} ${topL.toFixed(2)} `
              + `Q ${xMid.toFixed(2)} ${topM.toFixed(2)} ${xRight.toFixed(2)} ${topR.toFixed(2)} `
              + `L ${xRight.toFixed(2)} ${botR.toFixed(2)} `
              + `Q ${xMid.toFixed(2)} ${botM.toFixed(2)} ${xLeft.toFixed(2)} ${botL.toFixed(2)} Z`;

      // Shading keyed on (row, cMod) only — cMod wraps col=-1 onto the same
      // class as the true last column, so fill matches exactly at the seam.
      const cMod = ((c % cols) + cols) % cols;
      const frac = cols > 1 ? cMod / (cols - 1) : 0.5;

      // Hard zones, not a gradient: a left-bright/right-dark 3/4 key-light
      // tendency, a clumped hash so zones read as hand-placed blobs, and one
      // hotspot cluster pushed to pure white for the specular patch.
      let bias = 0.80 - frac * 0.95 + (0.5 - v) * 0.30;
      const clump = hash01(r * 12.9 + Math.floor(cMod / 2) * 5.7 + Math.floor(v * 3) * 2.1);
      bias += (clump - 0.5) * 0.6;
      const hotspot = Math.exp(-(((frac - 0.36) ** 2) / 0.045 + ((v - 0.32) ** 2) / 0.05));
      bias += hotspot * 0.95;

      const fill = bias > 0.80 ? ZONE_WHITE : bias > 0.44 ? ZONE_LIGHT : bias > 0.14 ? ZONE_MID : ZONE_DARK;
      tiles.push({ d, fill });
    }
  }
  return tiles;
}

// One period of the facet texture — drawn once, never touched again.
function MirrorBallFace({ size }: { size: number }) {
  const tiles = useMemo(() => buildDiscoTiles(size), [size]);
  const strokeW = Math.max(1, size * 0.007);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} fill="#0a0912" />
      {tiles.map((t, i) => (
        <Path key={i} d={t.d} fill={t.fill} stroke={STROKE_COLOR} strokeWidth={strokeW} strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

const WASH_CYCLE_MS = 15000; // full first-hue -> second -> third -> first loop
const WASH_PEAK_OPACITY = 0.6;

// The station's own eqColors, cycled as three translucent washes over the
// pale tiles — this is what reads as "the ball's colour shifting" in the
// reference, without needing a CSS hue-rotate RN doesn't have. Sits ABOVE
// the scrolling tiles but BELOW the fixed highlight, so the white specular
// patch stays clean regardless of which hue is currently peaking.
function ColorCycleWash({ size, eq }: { size: number; eq: [string, string, string] }) {
  const cycle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(cycle, { toValue: 1, duration: WASH_CYCLE_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const stops = [0, 1 / 3, 2 / 3, 1];
  const hue1 = cycle.interpolate({ inputRange: stops, outputRange: [WASH_PEAK_OPACITY, 0, 0, WASH_PEAK_OPACITY] });
  const hue2 = cycle.interpolate({ inputRange: stops, outputRange: [0, WASH_PEAK_OPACITY, 0, 0] });
  const hue3 = cycle.interpolate({ inputRange: stops, outputRange: [0, 0, WASH_PEAK_OPACITY, 0] });

  const layer = { position: 'absolute' as const, width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={{ width: size, height: size, position: 'absolute' }}>
      <Animated.View style={[layer, { backgroundColor: eq[0], opacity: hue1 }]} />
      <Animated.View style={[layer, { backgroundColor: mixHex(eq[1], '#D23AE0', 0.4), opacity: hue2 }]} />
      <Animated.View style={[layer, { backgroundColor: eq[2], opacity: hue3 }]} />
    </View>
  );
}

// A static 4-point sparkle path + glow, drawn once — only opacity/scale animate.
function SparklePath({ boxSize }: { boxSize: number }) {
  return (
    <Svg width={boxSize} height={boxSize} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="dbGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={50} fill="url(#dbGlow)" />
      <Path fill="#ffffff" d="M50 2 C55 33 67 45 98 50 C67 55 55 67 50 98 C45 67 33 55 2 50 C33 45 45 33 50 2 Z" />
    </Svg>
  );
}

function GlintStar({ size, leftPct, topPct, boxPct, period, phase = 0, minScale = 0.7, minOpacity = 0.35 }: {
  size: number; leftPct: number; topPct: number; boxPct: number; period: number; phase?: number; minScale?: number; minOpacity?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  const boxSize = size * boxPct;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(phase),
      Animated.timing(t, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [minOpacity, 1] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [minScale, 1] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: size * leftPct - boxSize / 2, top: size * topPct - boxSize / 2,
      width: boxSize, height: boxSize, opacity, transform: [{ scale }],
    }}>
      <SparklePath boxSize={boxSize} />
    </Animated.View>
  );
}

// Two prominent glints sitting right at the edge of the highlight patch —
// positions/sizes measured off the reference (a big one + a smaller companion
// just above-left), replacing the old four small twinkle dots.
function OnBallGlints({ size }: { size: number }) {
  return (
    <>
      <GlintStar size={size} leftPct={0.64} topPct={0.42} boxPct={0.19} period={3000} phase={0} minScale={0.7} minOpacity={0.35} />
      <GlintStar size={size} leftPct={0.575} topPct={0.30} boxPct={0.10} period={3600} phase={700} minScale={0.6} minOpacity={0.25} />
    </>
  );
}

function MirrorBall({ size, eq, spin }: { size: number; eq: [string, string, string]; spin: Animated.Value }) {
  const scrollX = spin.interpolate({ inputRange: [0, 1], outputRange: [0, -size] });

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0a0912' }}>
      {/* Scrolling surface — two identical copies, one continuous loop */}
      <Animated.View style={{ flexDirection: 'row', width: size * 2, height: size, transform: [{ translateX: scrollX }] }}>
        <MirrorBallFace size={size} />
        <MirrorBallFace size={size} />
      </Animated.View>

      {/* Colour cycle — the station's own mood colours washing through,
          above the tiles, below the fixed highlight so it stays clean */}
      <ColorCycleWash size={size} eq={eq} />

      {/* Fixed lighting — never scrolls, so it reads as a real light source */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="dbShade" cx="0.36" cy="0.3" r="0.9">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <Stop offset="0.4" stopColor={eq[1]} stopOpacity="0.1" />
            <Stop offset="0.78" stopColor="#050208" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#020104" stopOpacity="0.75" />
          </RadialGradient>
          <RadialGradient id="dbWarm" cx="0.74" cy="0.8" r="0.55">
            <Stop offset="0" stopColor="#FFA83C" stopOpacity="0.3" />
            <Stop offset="1" stopColor="#FFA83C" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#dbShade)" />
        <Circle cx={50} cy={50} r={50} fill="url(#dbWarm)" />
        <Ellipse cx={36} cy={30} rx={14} ry={9} fill="#ffffff" fillOpacity={0.42} />
        <Circle cx={50} cy={50} r={49} fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1} />
      </Svg>

      {/* On-ball sparkle — two prominent glints at the highlight's edge */}
      <OnBallGlints size={size} />
    </View>
  );
}

// ── Scattered light dots that orbit the room ──────────────────────────────────
// A fixed field of dots; the whole field slowly rotates (one native transform)
// while each dot twinkles on its own native-driver opacity loop. Zero per-frame
// CPU — the "sweep" is staggered phases + the group rotation.
function LightField({ count, eq, live, winW, winH }: {
  count: number; eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
}) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Deterministic pseudo-scatter (no Math.random — banned & keeps it stable).
    const a = (i * 137.508) % 360;               // golden-angle spread
    const rad = 0.16 + ((i * 53) % 100) / 100 * 0.42;
    const ar = (a * Math.PI) / 180;
    const x = 0.5 + Math.cos(ar) * rad;
    const y = 0.42 + Math.sin(ar) * rad * 0.9;
    const size = 6 + (i % 5) * 5;
    const color = [eq[0], eq[1], eq[2], '#EAF2FF'][i % 4];
    const delay = (i * 213) % 1800;
    const dur = 1100 + (i % 6) * 260;
    return { x, y, size, color, delay, dur };
  }), [count, eq]);

  const twinkles = useRef(dots.map(() => new Animated.Value(0.15))).current;

  useEffect(() => {
    const loops = dots.map((d, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(d.delay),
        Animated.timing(twinkles[i], { toValue: 1, duration: d.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(twinkles[i], { toValue: 0.12, duration: d.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: d.x * winW - d.size / 2,
            top: d.y * winH - d.size / 2,
            width: d.size, height: d.size, borderRadius: d.size / 2,
            backgroundColor: d.color,
            opacity: Animated.multiply(twinkles[i], live),
            shadowColor: d.color, shadowOpacity: 0.9, shadowRadius: d.size * 0.9, shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}

export function DiscoBallFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useSpotifyPlayback(visible);
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const spin = useRef(new Animated.Value(0)).current;       // ball surface scroll (axis spin)
  const fieldSpin = useRef(new Animated.Value(0)).current;  // dot-field orbit
  const bob = useRef(new Animated.Value(0)).current;        // gentle hang/float
  const live = useRef(new Animated.Value(0)).current;       // 0 idle → 1 dancing

  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });

  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  // Continuous native-driver rotations — GPU only, no CPU per frame.
  useEffect(() => {
    if (!visible) return;
    const ballLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    const fieldLoop = Animated.loop(Animated.timing(fieldSpin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true }));
    const bobLoop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    ballLoop.start();
    fieldLoop.start();
    bobLoop.start();
    return () => { ballLoop.stop(); fieldLoop.stop(); bobLoop.stop(); };
  }, [visible]);

  // The room lights up while the music plays, dims between/at rest.
  const lightsOn = playing && !musicSwitching;
  useEffect(() => {
    Animated.timing(live, { toValue: lightsOn ? 1 : 0.15, duration: lightsOn ? 900 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [lightsOn]);

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    slideY.setValue(SCREEN_H);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 0.8) handleClose();
      else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const resetTrack = () => progress.setValue(0);
  const togglePlay = () => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); };

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  const ballSize = Math.min(winW * 0.62, winH * 0.34, 300);
  const bobY = bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });
  const fieldRotate = fieldSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowTint = eq[1] + '26';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#04040c' }, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        <StationBackdrop station={station} blurRadius={2.5} />
        {/* Club-dark wash — deeper than other modes so the light dots pop */}
        <LinearGradient
          colors={['rgba(2,2,10,0.55)', 'rgba(2,2,10,0.42)', 'rgba(2,2,10,0.6)', 'rgba(2,2,10,0.72)', 'rgba(2,2,10,0.8)']}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Orbiting light field — behind the ball, over the whole room */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: fieldRotate }] }]} pointerEvents="none">
          <LightField count={26} eq={eq} live={live} winW={winW} winH={winH} />
        </Animated.View>

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>DISCO BALL</Text>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
          </View>

          {/* The ball, hanging from a mount, genuinely turning on its axis */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ alignItems: 'center', transform: [{ translateY: bobY }] }}>
              <View style={{ width: 2, height: ballSize * 0.22, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: -3 }} />
              <MirrorBall size={ballSize} eq={eq} spin={spin} />
            </Animated.View>
          </View>

          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>}
            {hasTrack && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{artist}</Text>}
          </View>

          {hasTrack && (
          <View style={{ width: '100%', paddingHorizontal: 28, marginTop: 18 }}>
            <SeekBar progress={progress} scrub={scrub} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
              <Text style={fs.time}>{formatMs(elapsedMs)}</Text>
              <Text style={fs.time}>{formatMs(durationMs)}</Text>
            </View>
          </View>
          )}

          <View style={fs.controls}>
            <TouchableOpacity onPress={() => { const ns = !shuffle; setShuffle(ns); if (spotify.connected) spotify.shuffle(ns); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={24} color={shuffle ? eq[1] : 'rgba(255,255,255,0.85)'} />
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
            <TouchableOpacity onPress={() => { const nr = !repeat; setRepeat(nr); if (spotify.connected) spotify.repeat(nr ? 'track' : 'off'); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat ? 'repeat-once' : 'repeat'} size={24} color={repeat ? eq[1] : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
          </View>

          <View style={fs.actionRow}>
            <TouchableOpacity onPress={() => setShowMood(true)} style={fs.actionPill} activeOpacity={0.85}>
              <MaterialCommunityIcons name="tune-variant" size={15} color="#fff" />
              <Text style={fs.actionPillBold}>Change Mood</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={fs.actionPill} activeOpacity={0.85}>
              <Ionicons name="musical-notes-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={fs.actionPillText} numberOfLines={1}>
                {spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && spotify.connected && !spotify.track && !handoff} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

        <MoodSheet
          visible={showMood}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); npSetStation(id); setShowMood(false); }}
          onClose={() => setShowMood(false)}
        />

        {showPicker && (
          <PlaylistSheet
            stationName={station.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(station.id, pl);
              setLinked(pl);
              setShowPicker(false);
              relinkStationPlaylist(station.id);
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 22 },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: '58%',
  },
  actionPillBold: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  actionPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
});
