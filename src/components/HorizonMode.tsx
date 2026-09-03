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
import { LandscapeChrome, restShiftFor, useChromeFade, useDeckScene, useRestScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { STATIONS } from '@/constants/stations';
import { mmss } from '@/utils/formatTime';
import { confirmedPlaying } from '@/utils/confirmedPlaying';
import { resolveAnyStation } from '@/utils/customStations';
import { ModeScrim } from '@/components/ModeScrim';
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
import { RepeatButton, ShuffleButton } from '@/components/TransportToggle';
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

const formatMs = (ms: number) => mmss(ms);

/**
 * ── The outrun scene — REBUILT STATIC + NATIVE-DRIVER OVERLAYS (04.08) ──────
 *
 * The old scene re-rendered its entire SVG tree from React state 15 times a
 * second (a rAF loop calling setPhase). That re-rendered the WHOLE fullscreen
 * component — controls, action row, everything — through react-native-svg's
 * reconciler on the JS thread, and the owner felt it as Horizon "slowing down
 * the entire app": every tap and JS animation anywhere queued behind it. The
 * 25→15fps throttle (24.07) halved the burn but kept the architecture; this
 * removes it.
 *
 * The observation that makes it cheap: almost nothing in this scene moves.
 * Sky, sun, slats, spill, horizon line and rays are STATIC — they were being
 * repainted 15×/s for no reason. Only three things change:
 *   1. the rolling grid lines   → RollingLines: plain Views on ONE looping
 *      native Animated.Value, per-line keyframe interpolations
 *   2. the star twinkle         → TwinkleStars: Views on FIVE shared loops
 *      (the old math had exactly five distinct rates — i % 5)
 *   3. the sun's glow dimming while paused → one animated opacity wrapper
 * Everything else renders once per station/orientation. Zero JS-thread work
 * per frame, like every other mode.
 *
 * GEOMETRY RULE that makes the overlays possible: the Svg is always drawn
 * with a viewBox EQUAL to the window (`makeGeom(winW, winH)`), so viewBox
 * units ARE screen pixels and the overlay Views can share the scene's
 * numbers directly. Never pass a fixed-size geom (the old GEOM_WIDE) here —
 * `slice` would rescale the Svg but not the overlays, and the lines would
 * float off the grid.
 */

/** One looping 0→1 value; each line rides it through its own keyframes.
 *  A line's journey is fixed — q = frac(offset + t) — so translateY/opacity/
 *  scaleY are pure functions of the loop, sampled into interpolations. */
const LINE_H = 3;                 // drawn height; scaleY shrinks it to width
const ROLL_MS = 3300;             // one full cycle ≈ the old speed at amp=1
function lineKeyframes(offset: number, g: HzGeom) {
  const input: number[] = [];
  const y: number[] = [];
  const o: number[] = [];
  const w: number[] = [];
  const push = (t: number, q: number) => {
    const near = Math.max(0, (q - 0.34) / 0.66);
    input.push(t);
    y.push(g.HORIZON + Math.pow(q, 2.2) * (g.H - g.HORIZON) - LINE_H / 2);
    o.push(Math.min(1, q * 2.4) * 0.75 * (1 - near * near * 0.86));
    // scaleY of a 3px bar: 0.6..2.8px. Floor at 0.2 — scaleY 0 is degenerate.
    w.push(Math.max(0.2, (0.6 + q * 2.2) / LINE_H));
  };
  // Sample each continuous stretch of the loop; the wrap (q snapping 1→0)
  // becomes two samples a hair apart, which interpolate renders as a jump.
  // Opacity is ~0.1 at the bottom and 0 at the horizon, so the jump is quiet.
  const wrapT = offset === 0 ? 1 : 1 - offset;
  const SAMPLES = 11;
  for (let s = 0; s <= SAMPLES; s++) push((s / SAMPLES) * (wrapT - 0.0002), (offset + (s / SAMPLES) * (wrapT - 0.0002)) % 1);
  if (wrapT < 1) {
    for (let s = 0; s <= SAMPLES; s++) {
      const t = wrapT + (s / SAMPLES) * (1 - wrapT);
      push(Math.min(t, 1), (offset + t) % 1);
    }
  }
  return { input, y, o, w };
}

function RollingLines({ playing, color, geom }: { playing: boolean; color: string; geom: HzGeom }) {
  const roll = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!playing) { roll.stopAnimation(); return; }
    // Explicit restart, not Animated.loop: this loop RELIES on the value
    // snapping 1→0 between passes, and Animated.loop's reset was measured
    // (04.08, web probe) parking the value at 1 after the first pass. Every
    // proven loop in this app is a sequence that travels back down on its
    // own; a sawtooth needs its restart written out. No value read-backs —
    // the Mirror Ball's stall taught that.
    let alive = true;
    const run = () => {
      roll.setValue(0);
      Animated.timing(roll, { toValue: 1, duration: ROLL_MS, easing: Easing.linear, useNativeDriver: true })
        .start(({ finished }) => { if (finished && alive) run(); });
    };
    run();
    return () => { alive = false; roll.stopAnimation(); };
  }, [playing, roll]);

  const lines = useMemo(
    () => Array.from({ length: H_LINES }, (_, i) => lineKeyframes(i / H_LINES, geom)),
    [geom],
  );

  return (
    <>
      {lines.map((k, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: LINE_H,
            backgroundColor: color,
            opacity: roll.interpolate({ inputRange: k.input, outputRange: k.o }),
            transform: [
              { translateY: roll.interpolate({ inputRange: k.input, outputRange: k.y }) },
              { scaleY: roll.interpolate({ inputRange: k.input, outputRange: k.w }) },
            ],
          }}
        />
      ))}
    </>
  );
}

/** The five twinkle rates the old per-frame math used (0.7 + (i%5)·0.23
 *  rad/s), each now one shared native loop; a star picks its bucket and
 *  reads the loop through its own sine keyframes, so bucket-mates still
 *  breathe out of step. Five animations however many stars are drawn. */
const TWINKLE_BUCKETS = 5;
function TwinkleStars({ playing, geom }: { playing: boolean; geom: HzGeom }) {
  const loops = useRef(
    Array.from({ length: TWINKLE_BUCKETS }, () => new Animated.Value(0)),
  ).current;
  useEffect(() => {
    if (!playing) { loops.forEach((v) => v.stopAnimation()); return; }
    // Explicit sawtooth restarts — same reason as RollingLines above.
    let alive = true;
    loops.forEach((v, k) => {
      const rate = 0.7 + k * 0.23;                       // rad/s, as before
      const periodMs = (2 * Math.PI * 1000) / rate;
      const run = () => {
        v.setValue(0);
        Animated.timing(v, { toValue: 1, duration: periodMs, easing: Easing.linear, useNativeDriver: true })
          .start(({ finished }) => { if (finished && alive) run(); });
      };
      run();
    });
    return () => { alive = false; loops.forEach((v) => v.stopAnimation()); };
  }, [playing, loops]);

  const stars = useMemo(() => geom.stars.map((s, i) => {
    const input: number[] = [];
    const out: number[] = [];
    const K = 12;
    for (let k = 0; k <= K; k++) {
      const t = k / K;
      input.push(t);
      out.push(s.o * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t + i * 2.4))));
    }
    return { ...s, bucket: i % TWINKLE_BUCKETS, input, out };
  }), [geom]);

  return (
    <>
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: s.x - s.r, top: s.y - s.r,
            width: s.r * 2, height: s.r * 2, borderRadius: s.r,
            backgroundColor: '#ffffff',
            opacity: loops[s.bucket].interpolate({ inputRange: s.input, outputRange: s.out }),
          }}
        />
      ))}
    </>
  );
}

function HorizonScene({ playing, eq, geom }: { playing: boolean; eq: [string, string, string]; geom: HzGeom }) {
  const g = geom;
  const ramp = useMemo(() => sunRamp(eq), [eq]);

  // The glow's only motion was dimming while paused (the old `amp` swung
  // between 1 playing and 0.4 paused, constant in between) — one animated
  // opacity on the glow layer, nothing per-frame.
  const glow = useRef(new Animated.Value(playing ? 1 : 0.72)).current;
  useEffect(() => {
    Animated.timing(glow, { toValue: playing ? 1 : 0.72, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  }, [playing, glow]);

  // Rays fan from the vanishing point, spaced evenly by viewing angle (real
  // perspective): the outermost rays flatten toward the horizon, so the grid
  // reaches the side edges all the way up — no bare corners.
  const rays = useMemo(() => {
    const RAY_SPREAD = (85 * Math.PI) / 180; // ±85° either side of straight down
    return Array.from({ length: V_RAYS }, (_, i) => {
      const a = (i / (V_RAYS - 1) - 0.5) * 2 * RAY_SPREAD;
      return g.SUN_CX + Math.tan(a) * (g.H + 30 - g.HORIZON);
    });
  }, [g]);

  // The canvas is sized in real pixels rather than "100%": a percentage
  // canvas does not reliably re-resolve when the window changes shape.
  // viewBox === window, so nothing is cropped and overlay pixels line up.
  const svgProps = { width: g.W, height: g.H, viewBox: `0 0 ${g.W} ${g.H}` } as const;

  return (
    <>
      {/* Sky warming down toward the horizon */}
      <Svg {...svgProps} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="hzSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={eq[2]} stopOpacity="0" />
            <Stop offset="0.62" stopColor={eq[1]} stopOpacity="0.05" />
            <Stop offset="1" stopColor={ramp[1].c} stopOpacity="0.16" />
          </SvgGradient>
        </Defs>
        <Rect x="0" y="0" width={g.W} height={g.HORIZON} fill="url(#hzSky)" />
      </Svg>

      {/* Stars — native-driver Views, five shared loops */}
      <TwinkleStars playing={playing} geom={g} />

      {/* Sun bloom: wide haze + tighter glow, dimming as one while paused.
          Its own layer because opacity has to animate without touching the
          rest of the scene. Two-stage on purpose — one gradient can't give
          both a hot core and a wide soft haze. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]} pointerEvents="none">
        <Svg {...svgProps}>
          <Defs>
            <RadialGradient id="hzSunGlow" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
              <Stop offset="0" stopColor={ramp[1].c} stopOpacity="0.55" />
              <Stop offset="0.45" stopColor={eq[1]} stopOpacity="0.22" />
              <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="hzSunHaze" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
              <Stop offset="0" stopColor={eq[1]} stopOpacity="0.20" />
              <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={g.SUN_CX} cy={g.SUN_CY} rx={g.SUN_R * 3.4} ry={g.SUN_R * 2.6} fill="url(#hzSunHaze)" />
          <Ellipse cx={g.SUN_CX} cy={g.SUN_CY} rx={g.SUN_R * 1.9} ry={g.SUN_R * 1.55} fill="url(#hzSunGlow)" />
        </Svg>
      </Animated.View>

      {/* Everything solid: the slatted sun, its spill, the horizon, the rays */}
      <Svg {...svgProps} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="hzSun" x1="0" y1="0" x2="0" y2="1">
            {ramp.map((s) => <Stop key={s.o} offset={s.o} stopColor={s.c} />)}
          </SvgGradient>
          <RadialGradient id="hzSpill" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
            <Stop offset="0" stopColor={ramp[1].c} stopOpacity="0.30" />
            <Stop offset="1" stopColor={eq[1]} stopOpacity="0" />
          </RadialGradient>
          {/* The grid fades into the foreground. Without this the lines are
              at their BRIGHTEST exactly where the song title and transport
              sit. userSpaceOnUse so one gradient serves every ray. */}
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
      </Svg>

      {/* Rolling grid lines — native-driver Views on one shared loop */}
      <RollingLines playing={playing} color={eq[1]} geom={g} />
    </>
  );
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function HorizonFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  // Geometry derived from the REAL window in BOTH orientations, so the
  // drawing never has to be cropped to fit, the sun stays the size it was
  // designed to be at any screen shape, and — since the rebuild — the
  // native-driver overlays can share the scene's pixel coordinates.
  const geom = useMemo(() => makeGeom(winW, winH), [winW, winH]);
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);

  // Shuffle and repeat are READ STRAIGHT OFF THE PLAYER, not mirrored into
  // local state. Each mode used to keep its own copy and sync it in an effect
  // — eight copies of the same two lines, and the copy is what let the button
  // disagree with the music. The player already flips optimistically and holds
  // its answer against a stale poll, so there is nothing left for a mirror to
  // do but drift.
  const shuffle = spotify.shuffleOn;
  const repeat = spotify.repeatMode;
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  // The SCENE waits for the service's own verdict; the transport keeps the
  // optimistic `playing`, because a button that hesitates reads as broken.
  // See utils/confirmedPlaying for why, and for the clip that proved it.
  const live = confirmedPlaying(playing, spotify.track, musicSwitching);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(station.id).then(setLinked);
  }, [visible, station.id]);

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    // BOTH orientations now — portrait rests the same way (useRestScene).
    active: visible, playing, sheetOpen: showMood || showPicker,
  });
  // Slide only — shrinking a full-bleed scene would reveal its edges. The
  // sun (drawn at centre) lands at the left pane's centre while the panel
  // is docked, and glides back to true centre at rest.
  const deckScene = useDeckScene(chrome, winW, 1, isLandscape);
  // The scene re-centres itself once the controls have gone. MEASURED rather
  // than assumed, so each mode's own deliberate offsets survive — see
  // restShiftFor in LandscapeChrome.
  const [contentH, setContentH] = useState(0);
  const [sceneBox, setSceneBox] = useState({ y: 0, h: 0 });
  const restScene = useRestScene(chrome, restShiftFor(contentH, sceneBox.y, sceneBox.h), !isLandscape);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });
  // NO scene loop here any more. The scene's motion lives entirely on the
  // native driver inside HorizonScene (see the rebuild note above it) — the
  // old rAF/setPhase loop re-rendered this whole component 15×/s and was
  // reported as lagging the entire app (owner, 04.08).

  // Progress is driven by useTrackClock — real Spotify position when
  // connected, demo loop otherwise.

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    slideY.setValue(winH);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  // Swipe down anywhere to drop back to the mini-player — the one exit
  // gesture shared by every mode (the mini-player's X ends the music).
  /**
   * The dismiss gesture reaches handleClose through a ref because the
   * responder below is built once — closing over the first render's copy
   * would leave it using a stale window height after a rotation.
   */
  const dismissCloseRef = useRef(handleClose);
  dismissCloseRef.current = handleClose;

  /** Where the card ends up when the finger leaves — or is taken away. */
  const settleDismiss = (g: { dy: number; vy: number }) => {
    if (g.dy > 120 || g.vy > 0.8) dismissCloseRef.current();
    else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
  };

  /**
   * A sheet above the card owns every gesture. Without this, a FAST flick
   * that the song list declined bubbled down here (the sheet's React tree
   * lives inside the mode's), the card dismissed UNDER the open sheet, and
   * tearing down both iOS windows at once froze the whole screen (owner,
   * 04.08: "the card collapses to the bottom and then whole screen
   * freezes"). While any sheet is up, the dismiss gesture stands down.
   */
  const npSheetCount = useNowPlaying().sheetCount;
  const sheetUpRef = useRef(false);
  sheetUpRef.current = npSheetCount > 0;

  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => !sheetUpRef.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => settleDismiss(g),
    /**
     * iOS CANCELS a touch that leaves the bottom edge of the screen — which
     * is exactly how you drag a card away. With no terminate handler the
     * gesture just stopped: `slideY` stayed parked wherever the finger left
     * it, so the mode was still "open" with its content off-screen and its
     * modal window still over the app. Taps fell through to the page beneath
     * (which is why the tab bar kept working) but scrolling did not, and the
     * only ways out were to swipe again — re-grabbing the stranded card —
     * or to kill the app. Terminating settles it exactly like a release.
     */
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: (_, g) => settleDismiss(g),
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

        {/* Blurred station background under the shared scrim. This mode used to
            darken it hard "so the scene reads like dusk" — but the dusk comes from
            the scene drawn on top, and all that shading did was bury the
            photograph. */}
        <StationBackdrop station={station} blurRadius={2.5} />
        <ModeScrim station={station} />

        {/* Landscape: the scene IS the screen — the outrun sun and grid run
            edge to edge under the chrome, which is what turning this mode
            sideways is FOR. Same window-derived geometry as portrait (the
            geometry rule on HorizonScene: viewBox must equal the window or
            the native-driver overlays drift off the drawing). */}
        {isLandscape && (
          <Animated.View style={[StyleSheet.absoluteFill, deckScene]} pointerEvents="none">
            <HorizonScene playing={live} eq={eq} geom={geom} />
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
            <HorizonScene playing={live} eq={eq} geom={geom} />
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
        <Animated.View style={{ opacity: chrome, position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Animated.View>
        )}

        {!isLandscape && (
        <Animated.View style={[fs.topBar, { top: topPad + 14 }, { opacity: chrome }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>HORIZON</Text>
        </Animated.View>
        )}

        {/* Content */}
        {!isLandscape && (
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
          <Animated.View style={{ opacity: chrome, paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </Animated.View>

          {/* The scene itself is the full-bleed layer above; this slot just
              holds the column's shape and carries the floating notes. */}
          <View
            style={{ flex: 1 }}
            onLayout={(e) => setSceneBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
            <FloatingNotes playing={live} color={eq[1]} />
          </View>

          {/* EVERYTHING BELOW THE SCENE RESTS TOGETHER. pointerEvents goes
              off once it is invisible, or the tap meant to bring the controls
              back would press whatever button it landed on. */}
          <Animated.View
            style={{ alignSelf: 'stretch', opacity: chrome }}
            pointerEvents={chromeRested ? 'none' : 'auto'}>
          {/* Song title / mood line */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0 }} numberOfLines={2}>{title}</Text>}
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
            <ShuffleButton accent={eq[1]} size={24} on={shuffle}
              onPress={() => spotify.shuffle(!shuffle)} />
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
            <RepeatButton accent={eq[1]} size={24} mode={repeat}
              onPress={(next) => spotify.repeat(next)} />
          </View>

          {/* Left-aligned action pills — keep the visual the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={station}
          />
          </Animated.View>
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
            contextUri={spotify.contextUri}
          />
        )}

        {!isLandscape && <ModeCloseButton onPress={handleClose} chrome={chrome} rested={chromeRested} />}

        <AmbientGlow active={visible && live} beat={visible && live} trackKey={spotify.track?.title ?? null} hero={false} color={eq[1]} />
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
