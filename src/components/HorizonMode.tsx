import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, ScrollView,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient as SvgGradient, Mask, Rect, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { LandscapeChrome, useChromeFade, useDeckScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { mixHex } from '@/components/GlassPane';
import { FloatingNotes } from '@/components/FloatingNotes';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useMusicPlayback } from '@/utils/useMusicPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeActionRow } from '@/components/ModeActionRow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;

// Scene geometry (SVG viewBox units — scales to fit)
const VB_W = 360;
const VB_H = 460;
const HORIZON_Y = 252;          // where sky meets the grid
const GRID_H = VB_H - HORIZON_Y;
const SUN_CX = VB_W / 2;
const SUN_R = 86;
const SUN_CY = HORIZON_Y - SUN_R * 0.42;  // sun sits low, rising out of the horizon
const H_LINES = 11;             // rolling horizontal grid lines
const V_RAYS = 15;              // static rays fanning from the vanishing point

const DEMO_DURATION_MS = 214000; // 3:34

// Star positions — random-but-stable so they don't twinkle on re-render.
const STARS = Array.from({ length: 22 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453;
  const b = Math.sin(i * 311.7) * 12543.8967;
  return {
    x: Math.abs(a - Math.floor(a)) * VB_W,
    y: Math.abs(b - Math.floor(b)) * (HORIZON_Y - SUN_R - 20),
    r: 0.6 + Math.abs(Math.sin(i * 3.3)) * 1.0,
    o: 0.18 + Math.abs(Math.sin(i * 7.7)) * 0.4,
  };
});

/** Slats through the sun's lower half. See `sunCuts` — this is the count. */
const SUN_SLATS = 7;

/**
 * The sun's own gradient, DERIVED rather than taken straight from the
 * station's three eq stops.
 *
 * WHY (owner screenshot, 03.08 — "the sun is a flat red shape"): a station's
 * ramp is tuned for equalizer bars and mirror facets, and several of them have
 * almost no internal contrast at all. After Hours is #FF4444 / #FF1111 /
 * #FF0000 — three near-identical reds — and Mountain Pass is three whites. Fed
 * straight into the sun that paints a flat disc, whatever the station.
 *
 * So the ramp is rebuilt: a hot near-white top, the station's own three stops
 * through the middle, and a deep bottom. Deepening goes toward a very dark
 * INDIGO rather than black — pure black flattens into a silhouette, and the
 * cool bias is what keeps a white station reading as ice instead of dirt.
 */
const SUN_TOP = '#FFFFFF';
const SUN_DEEP = '#140F2A';
function sunRamp(eq: [string, string, string]) {
  return [
    { o: 0,    c: mixHex(eq[0], SUN_TOP, 0.62) },
    { o: 0.22, c: mixHex(eq[0], SUN_TOP, 0.18) },
    { o: 0.5,  c: eq[1] },
    { o: 0.78, c: eq[2] },
    { o: 1,    c: mixHex(eq[2], SUN_DEEP, 0.55) },
  ];
}

// ── Aspect-aware geometry ────────────────────────────────────────────────────
// The scene was drawn in a portrait viewBox; "slice"-cropping that into a
// landscape window blows the sun up 2.4x and shows only its midriff (seen on
// device, 30.07). Instead the whole composition is rebuilt for the wide
// frame: same proportions, sun sized off the short edge, stars spread across
// the real width. Everything is derived, so the two variants can't drift.
type HzGeom = {
  W: number; H: number; HORIZON: number; SUN_CX: number; SUN_CY: number; SUN_R: number;
  stars: { x: number; y: number; r: number; o: number }[];
  cuts: { y: number; h: number }[];
};

function makeGeom(W: number, H: number): HzGeom {
  const HORIZON = Math.round(H * (HORIZON_Y / VB_H));
  const SUN_R2 = Math.round(Math.min(W * (SUN_R / VB_W), H * 0.20));
  const SUN_CY2 = HORIZON - SUN_R2 * 0.42;
  const s = SUN_R2 / SUN_R;                 // slats scale with the sun
  const nStars = Math.round(22 * (W / VB_W));
  return {
    W, H, HORIZON, SUN_CX: W / 2, SUN_CY: SUN_CY2, SUN_R: SUN_R2,
    stars: Array.from({ length: nStars }, (_, i) => {
      const a = Math.sin(i * 127.1) * 43758.5453;
      const b = Math.sin(i * 311.7) * 12543.8967;
      return {
        x: Math.abs(a - Math.floor(a)) * W,
        y: Math.abs(b - Math.floor(b)) * (HORIZON - SUN_R2 - 20),
        r: 0.6 + Math.abs(Math.sin(i * 3.3)) * 1.0,
        o: 0.18 + Math.abs(Math.sin(i * 7.7)) * 0.4,
      };
    }),
    cuts: sunCuts(SUN_CY2, SUN_R2, HORIZON),
  };
}

/**
 * The slats, spread across the sun's VISIBLE lower half and thickening
 * downward so it dissolves into the horizon.
 *
 * The old set was spaced in flat viewBox units from the sun's centre, which
 * ignored two things: the sun is masked at the horizon, so only its top ~70%
 * is ever on screen, and the whole slatted band is therefore just 0.42 of a
 * radius tall. Three of the six cuts landed underneath the horizon and were
 * never drawn at all — which is why the owner's screenshot shows a solid dome
 * with a couple of thin slots near the bottom instead of the outrun look.
 * Everything here is a fraction of the sun's radius, so it holds at any size.
 */
function sunCuts(cy: number, r: number, horizon: number) {
  // Start from the middle of the VISIBLE disc, not from the sun's own centre:
  // the centre sits only 0.42 of a radius above the horizon, so "from the
  // centre down" is the bottom third of what you can actually see, and the
  // slats bunch into a stripe (first render of this round).
  const top = cy - r * 0.36;
  const bot = horizon - r * 0.05;         // last full slat before the horizon
  return Array.from({ length: SUN_SLATS }, (_, i) => {
    const f = i / (SUN_SLATS - 1);
    return {
      y: top + Math.pow(f, 1.25) * (bot - top),
      h: r * (0.022 + 0.075 * Math.pow(f, 1.5)),
    };
  });
}

const GEOM_PORTRAIT = makeGeom(VB_W, VB_H);
const GEOM_WIDE = makeGeom(800, 370);

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── The outrun scene ────────────────────────────────────────────────────────────
function HorizonScene({ phase, amp, eq, geom = GEOM_PORTRAIT }: { phase: number; amp: number; eq: [string, string, string]; geom?: HzGeom }) {
  // The canvas is sized in real pixels rather than "100%": a percentage
  // canvas does not reliably re-resolve when the window changes shape, and
  // with `slice` cropping that would crop the scene for the OLD screen.
  const { width: winW, height: winH } = useWindowDimensions();
  const g = geom;
  const ramp = useMemo(() => sunRamp(eq), [eq]);
  // Rolling grid: each line loops from the horizon toward the viewer,
  // accelerating as it approaches (q^2.2 ≈ perspective).
  const speed = 0.16 + amp * 0.14;
  const lines = Array.from({ length: H_LINES }, (_, i) => {
    const q = ((i / H_LINES + phase * speed) % 1 + 1) % 1;
    // Fade back out in the near foreground, where the song title and the
    // transport row sit. The lines are widest there (perspective) so they
    // read as travelling even at a fraction of the brightness.
    const near = Math.max(0, (q - 0.34) / 0.66);
    return {
      y: g.HORIZON + Math.pow(q, 2.2) * (g.H - g.HORIZON),
      o: Math.min(1, q * 2.4) * 0.75 * (1 - near * near * 0.86),
      w: 0.6 + q * 2.2,
    };
  });

  // Rays fan from the vanishing point, spaced evenly by viewing angle (real
  // perspective): the outermost rays flatten toward the horizon, so the grid
  // reaches the side edges all the way up — no bare corners.
  const RAY_SPREAD = (85 * Math.PI) / 180;   // ±85° either side of straight down
  const rays = Array.from({ length: V_RAYS }, (_, i) => {
    const a = (i / (V_RAYS - 1) - 0.5) * 2 * RAY_SPREAD;
    return g.SUN_CX + Math.tan(a) * (g.H + 30 - g.HORIZON);
  });

  return (
    <Svg width={winW} height={winH} viewBox={`0 0 ${g.W} ${g.H}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgGradient id="hzSun" x1="0" y1="0" x2="0" y2="1">
          {ramp.map((s) => <Stop key={s.o} offset={s.o} stopColor={s.c} />)}
        </SvgGradient>
        {/* Two-stage bloom: a tight hot core plus a wide soft haze. One
            gradient can't do both — widen it and the core washes out, tighten
            it and the sun sits on the sky with a hard edge. */}
        <RadialGradient id="hzSunGlow" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor={ramp[1].c} stopOpacity="0.55" />
          <Stop offset="0.45" stopColor={eq[1]} stopOpacity="0.22" />
          <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="hzSunHaze" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor={eq[1]} stopOpacity="0.20" />
          <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
        </RadialGradient>
        {/* The sky warms toward the horizon instead of staying dead black,
            and the sun's light spills down the grid the way it would on a
            wet road. Both fade to nothing at their far edge — a band with a
            visible boundary just reads as a drawn rectangle. */}
        <SvgGradient id="hzSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={eq[2]} stopOpacity="0" />
          <Stop offset="0.62" stopColor={eq[1]} stopOpacity="0.05" />
          <Stop offset="1" stopColor={ramp[1].c} stopOpacity="0.16" />
        </SvgGradient>
        <RadialGradient id="hzSpill" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
          <Stop offset="0" stopColor={ramp[1].c} stopOpacity="0.30" />
          <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
        </RadialGradient>
        {/* The grid fades into the foreground. Without this the lines are at
            their BRIGHTEST exactly where the song title and the transport sit
            — `o` grows with `q`, which is right for perspective and wrong for
            legibility. userSpaceOnUse so one gradient serves every ray. */}
        <SvgGradient id="hzRay" x1="0" y1={g.HORIZON} x2="0" y2={g.H} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={eq[1]} stopOpacity="0.34" />
          <Stop offset="0.45" stopColor={eq[1]} stopOpacity="0.26" />
          <Stop offset="1" stopColor={eq[1]} stopOpacity="0.04" />
        </SvgGradient>
        <Mask id="hzSunMask">
          <Rect x="0" y="0" width={g.W} height={g.H} fill="#000" />
          {/* Visible only above the horizon */}
          <Rect x="0" y="0" width={g.W} height={g.HORIZON} fill="#fff" />
          {/* Slat cuts */}
          {g.cuts.map((c, i) => (
            <Rect key={i} x="0" y={c.y} width={g.W} height={c.h} fill="#000" />
          ))}
        </Mask>
      </Defs>

      {/* Sky warming down toward the horizon */}
      <Rect x="0" y="0" width={g.W} height={g.HORIZON} fill="url(#hzSky)" />

      {/* Stars, twinkling. Each one breathes on its own period driven by the
          phase the scene already advances every frame, so this costs nothing
          — and a sky of perfectly steady dots is the one thing that gives a
          drawn night away. */}
      {g.stars.map((s, i) => (
        <Circle
          key={i}
          cx={s.x} cy={s.y} r={s.r}
          fill="#ffffff"
          opacity={s.o * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(phase * (0.7 + (i % 5) * 0.23) + i * 2.4)))}
        />
      ))}

      {/* Sun: wide haze, tighter bloom, then the slatted disc */}
      <Ellipse cx={g.SUN_CX} cy={g.SUN_CY} rx={g.SUN_R * 3.4} ry={g.SUN_R * 2.6} fill="url(#hzSunHaze)" opacity={0.6 + amp * 0.4} />
      <Ellipse cx={g.SUN_CX} cy={g.SUN_CY} rx={g.SUN_R * 1.9} ry={g.SUN_R * 1.55} fill="url(#hzSunGlow)" opacity={0.5 + amp * 0.5} />
      <Circle cx={g.SUN_CX} cy={g.SUN_CY} r={g.SUN_R} fill="url(#hzSun)" mask="url(#hzSunMask)" />

      {/* The sun's light spilling down the grid. An ELLIPSE, not a band: a
          rectangle of glow has two hard vertical edges and on the first
          render they showed as seams down the sides of the road. */}
      <Ellipse
        cx={g.SUN_CX} cy={g.HORIZON}
        rx={g.SUN_R * 2.4} ry={(g.H - g.HORIZON) * 0.8}
        fill="url(#hzSpill)"
      />

      {/* Horizon line — bright accent edge */}
      <Rect x="0" y={g.HORIZON - 3} width={g.W} height={6} fill={eq[1]} opacity={0.16} />
      <Rect x="0" y={g.HORIZON - 0.8} width={g.W} height={1.6} fill={eq[1]} opacity={0.9} />

      {/* Static rays from the vanishing point */}
      {rays.map((x, i) => (
        <Line
          key={i}
          x1={g.SUN_CX} y1={g.HORIZON}
          x2={x} y2={g.H + 30}
          stroke="url(#hzRay)" strokeWidth={1}
        />
      ))}

      {/* Rolling horizontal lines */}
      {lines.map((l, i) => (
        <Line
          key={i}
          x1={0} y1={l.y} x2={g.W} y2={l.y}
          stroke={eq[1]} strokeWidth={l.w} strokeOpacity={l.o}
        />
      ))}
    </Svg>
  );
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function HorizonFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  // Portrait geometry derived from the REAL window, the same way the wide
  // one is — so the drawing never has to be cropped to fit and the sun
  // stays the size it was designed to be at any screen shape.
  const geomPortrait = useMemo(() => makeGeom(winW, winH), [winW, winH]);
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  const [phase, setPhase] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(station.id).then(setLinked);
  }, [visible, station.id]);

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    active: visible && isLandscape, playing, sheetOpen: showMood || showPicker,
  });
  // Slide only — shrinking a full-bleed scene would reveal its edges. The
  // sun (drawn at centre) lands at the left pane's centre while the panel
  // is docked, and glides back to true centre at rest.
  const deckScene = useDeckScene(chrome, winW, 1, isLandscape);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });
  const playingRef = useRef(false);
  const ampRef = useRef(0.5);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Scene animation loop — throttled to ~15fps — each tick re-renders the whole SVG scene on the CPU, and 25fps measured 53-59% sustained CPU (iOS resource reports, 24.07); 15fps looks identical for these slow drifts and halves the burn.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 66) {
        last = now;
        const target = playingRef.current ? 1 : 0.4;
        ampRef.current += (target - ampRef.current) * 0.08;
        // Battery: once paused and fully wound down, freeze the scene —
        // zero re-renders until play flips it live again.
        if (playingRef.current || Math.abs(ampRef.current - target) > 0.01) {
          setPhase((now - start) / 1000);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Progress is driven by useTrackClock — real Spotify position when
  // connected, demo loop otherwise.

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    slideY.setValue(winH);
    ampRef.current = playingRef.current ? 1 : 0.5;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  // Swipe down anywhere to drop back to the mini-player — the one exit
  // gesture shared by every mode (the mini-player's X ends the music).
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

  // Real song when connected, else the mood's own line — never a fake track.
  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

        {/* Blurred station background — darkened hard so the scene reads like dusk */}
        <StationBackdrop station={station} blurRadius={2.5} />
        <LinearGradient
          colors={[
            'rgba(3,4,16,0.72)', 'rgba(3,4,16,0.62)', 'rgba(3,4,16,0.68)',
            'rgba(3,4,16,0.78)', 'rgba(3,4,16,0.86)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Landscape: the scene IS the screen — the outrun sun and grid run
            edge to edge under the chrome, which is what turning this mode
            sideways is FOR. Its Svg crops to fill (preserveAspectRatio
            "slice"), so no redrawing needed, just a bigger window. */}
        {isLandscape && (
          <Animated.View style={[StyleSheet.absoluteFill, deckScene]} pointerEvents="none">
            <HorizonScene phase={phase} amp={ampRef.current} eq={eq} geom={GEOM_WIDE} />
          </Animated.View>
        )}

        {/* PORTRAIT: also full-bleed, and derived from the real window.
            It used to be a fixed 360x460 drawing dropped into the middle
            flex slot, which had two consequences: `slice` had to crop that
            shape into a much taller screen, magnifying the sun to nearly the
            full width; and the oversized canvas spilled out of its box, which
            is the only reason the scene appeared behind the controls at all.
            The owner likes it behind the controls (31.07), so that is now
            deliberate rather than an overflow — and with the viewBox matching
            the screen there is no crop and no magnification left, so the sun
            comes back to a sane size and the sky above it fills with stars
            instead of sitting empty. */}
        {!isLandscape && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <HorizonScene phase={phase} amp={ampRef.current} eq={eq} geom={geomPortrait} />
          </View>
        )}

        {/* Scrim ABOVE the scene. The backdrop's own scrim (further up) sits
            UNDER the scene, so it does nothing here — which is why the grid
            was drawing straight across the song title, the seek bar and the
            transport row (owner screenshot, 03.08). The scene deliberately
            runs behind the controls (31.07), so this doesn't hide it: it
            starts at nothing well above the type and only reaches full
            strength at the very bottom, so the grid still recedes underneath
            while the words sit on something solid. Fading to zero at the top
            edge is load-bearing — any hard boundary reads as a drawn band. */}
        {!isLandscape && (
          <LinearGradient
            colors={[
              'rgba(4,5,14,0)', 'rgba(4,5,14,0.34)',
              'rgba(4,5,14,0.70)', 'rgba(4,5,14,0.88)',
            ]}
            locations={[0, 0.36, 0.66, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: '46%', bottom: 0 }}
            pointerEvents="none"
          />
        )}

        {!isLandscape && (
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>
        )}

        {!isLandscape && (
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>HORIZON</Text>
        </View>
        )}

        {/* Content */}
        {!isLandscape && (
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </View>

          {/* The scene itself is the full-bleed layer above; this slot just
              holds the column's shape and carries the floating notes. */}
          <View style={{ flex: 1 }}>
            <FloatingNotes playing={playing} color={eq[1]} />
          </View>

          {/* Song title / mood line */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>}
            {hasTrack && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{artist}</Text>}
          </View>

          {/* Progress — only when a real song is playing through */}
          {hasTrack && (
          <View style={{ width: '100%', paddingHorizontal: 28, marginTop: 18 }}>
            <SeekBar progress={progress} scrub={scrub} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
              <Text style={fs.time}>{formatMs(elapsedMs)}</Text>
              <Text style={fs.time}>{formatMs(durationMs)}</Text>
            </View>
          </View>
          )}

          {/* Controls */}
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

          {/* Left-aligned action pills — keep the visual the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            track={spotify.track}
            station={station}
          />
        </View>
        )}

        {isLandscape && (
          <LandscapeChrome
            chrome={chrome}
            rested={chromeRested}
            station={station}
            track={spotify.track}
            playing={playing}
            tagline={station.tagline}
            progress={progress}
            scrub={scrub}
            onPlayPause={togglePlay}
            onPrev={() => { resetTrack(); spotify.prev(); }}
            onNext={() => { resetTrack(); spotify.next(); }}
            onClose={handleClose}
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
          />
        )}

        {!isLandscape && <ModeCloseButton onPress={handleClose} />}

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} hero={false} color={eq[1]} />
        <WakeSpotifyHint show={playing && !spotify.track && !handoff} connected={spotify.connected} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

        <ModeSheet visible={showMood} onClose={() => setShowMood(false)} />

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
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // 14, not 18: the transport sits a touch higher so the pills below get
    // real breathing room (their own marginTop went 18 -> 26). Don't take it
    // much lower — the progress bar is directly above.
    width: '100%', paddingHorizontal: 30, marginTop: 14,
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
