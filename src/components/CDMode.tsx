import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, {
  Circle, ClipPath, Defs, G, Image as SvgImage, LinearGradient as SvgLinearGradient, Path,
  RadialGradient, Rect, Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaylistSheet } from '@/components/PlaylistSheet';
import { LandscapeChrome, useChromeFade, useDeckScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { createScrubHaptics } from '@/utils/scrubHaptics';
import { confirmedPlaying } from '@/utils/confirmedPlaying';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { ModeScrim } from '@/components/ModeScrim';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useMusicPlayback, nextRepeat } from '@/utils/useMusicPlayback';
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
const DEMO_DURATION_MS = 214000;
// A CD spins far faster than a record — that contrast with Vinyl's slow turn
// is half the point of having both.
const CD_SPIN_MS = 3400;

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Deterministic pseudo-random 0..1 (no Math.random — the disc must come out
// identical on every render, or the scratches would crawl).
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ── The disc ─────────────────────────────────────────────────────────────────
// Layering here is the whole trick, and it's the Disco Ball lesson applied:
// a CD's rainbow is DIFFRACTION — it belongs to the light source, not to the
// plastic — so the iridescent fan is a STATIC layer and only the label,
// scratches, dust and hub rosette turn beneath and above it. That is both
// physically right and much cheaper than rotating a painted rainbow. The
// printed label sits ABOVE the fan because a printed face is matte: rainbow
// streaks across the artwork instantly kill the illusion.

const SPECTRUM = ['#6FE9C6', '#63C8F5', '#8AA6FF', '#C08CFF', '#FF8FD2', '#FF9F87', '#FFD98A', '#EBFF9C'];

type Wedge = { d: string; id: string; hue: string; a: number; b: number; c: number };

/** Two broad opposed sweeps, built from heavily overlapping low-opacity
 *  wedges so they blend into light rather than reading as spokes. */
function buildFan(size: number): Wedge[] {
  const R = size / 2, cx = R, cy = R;
  const N = 64, WIDTH = ((Math.PI * 2) / N) * 4.5;
  const pt = (ang: number, rad: number) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
  const out: Wedge[] = [];
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const strength = Math.pow(Math.abs(Math.cos(ang)), 3.0);   // peaks left & right
    if (strength < 0.04) continue;
    const d = `M ${cx} ${cy} L ${pt(ang - WIDTH / 2, R)} A ${R} ${R} 0 0 1 ${pt(ang + WIDTH / 2, R)} Z`;
    out.push({
      d, id: `cdIr${i}`, hue: SPECTRUM[i % SPECTRUM.length],
      a: 0.20 * strength, b: 0.13 * strength, c: 0,
    });
  }
  return out;
}

/** Concentric data rings. Rotation-invariant, so they live in the static
 *  layer — spinning them would cost frames and change nothing. */
function buildGrooves(size: number, inner: number): { r: number; op: number }[] {
  const R = size / 2;
  const out: { r: number; op: number }[] = [];
  for (let i = 0; i < 40; i++) {
    out.push({ r: inner + (R - inner) * (i / 40), op: i % 2 ? 0.026 : 0.013 });
  }
  return out;
}

type Marks = { arcs: { d: string; op: number; w: number }[]; scuffs: { d: string; op: number }[]; dust: { x: number; y: number; r: number; op: number }[]; text: string[] };

/** The asymmetric detail — this is what makes the spin legible. */
function buildMarks(size: number, inner: number): Marks {
  const R = size / 2, cx = R, cy = R;
  const pt = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const arcs = [], scuffs = [], dust = [], text: string[] = [];
  for (let i = 0; i < 18; i++) {
    const r = inner + (R - inner) * hash01(i * 3.1 + 0.4);
    const a0 = hash01(i * 7.7) * Math.PI * 2, sw = 0.10 + hash01(i * 2.3) * 0.40;
    arcs.push({ d: `M ${pt(a0, r)} A ${r} ${r} 0 0 1 ${pt(a0 + sw, r)}`, op: 0.05 + hash01(i * 5.5) * 0.07, w: 0.4 + hash01(i * 9.1) * 0.5 });
  }
  for (let i = 0; i < 8; i++) {
    const a = hash01(i * 4.9 + 2.2) * Math.PI * 2;
    const r0 = inner + (R - inner) * hash01(i * 6.3) * 0.6;
    const r1 = r0 + (R - r0) * (0.25 + hash01(i * 8.8) * 0.45);
    scuffs.push({ d: `M ${pt(a, r0)} L ${pt(a, r1)}`, op: 0.035 + hash01(i * 1.7) * 0.04 });
  }
  for (let i = 0; i < 18; i++) {
    const a = hash01(i * 11.3) * Math.PI * 2, r = inner + (R - inner) * Math.sqrt(hash01(i * 5.1 + 1.9));
    dust.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), r: 0.3 + hash01(i * 3.3) * 0.5, op: 0.10 + hash01(i * 6.6) * 0.14 });
  }
  for (let i = 0; i < 130; i++) {          // the ring of manufacturing micro-text
    const a = (i / 130) * Math.PI * 2, r = inner * 1.05;
    text.push(`M ${pt(a, r)} L ${pt(a + 0.016, r)}`);
  }
  return { arcs, scuffs, dust, text };
}

function CDDisc({ size, spin, albumArt }: {
  size: number; spin: Animated.Value; albumArt: string | null;
}) {
  const R = size / 2;
  // Hub proportions measured off the owner's reference: a small dark centre
  // with four gripper holes, NOT the big printed label the first cut had.
  const HUB_HOLE = R * 0.155, GRIP_R = R * 0.235, GRIP = R * 0.037;
  const HUB_RING = R * 0.31, STACK = R * 0.62;
  // The album sits in the OUTER band, out where the silver and the rainbow
  // are — not as a disc through the middle. Anything filled across the centre
  // reads as a big dark circle against a dark scene, which is exactly what
  // the printed-label version got wrong.
  const ART_OUT = R * 0.95, ART_IN = R * 0.34;
  // Inner circle is wound the OPPOSITE way (sweep flag 1 vs 0), so it punches
  // a hole under the non-zero rule as well as even-odd — belt and braces,
  // rather than depending on clipRule surviving the SVG bridge.
  const ringPath = `M ${R - ART_OUT} ${R} a ${ART_OUT} ${ART_OUT} 0 1 0 ${ART_OUT * 2} 0 a ${ART_OUT} ${ART_OUT} 0 1 0 ${-ART_OUT * 2} 0 Z `
                 + `M ${R - ART_IN} ${R} a ${ART_IN} ${ART_IN} 0 1 1 ${ART_IN * 2} 0 a ${ART_IN} ${ART_IN} 0 1 1 ${-ART_IN * 2} 0 Z`;

  const fan = useMemo(() => buildFan(size), [size]);
  const grooves = useMemo(() => buildGrooves(size, HUB_RING), [size, HUB_RING]);
  const marks = useMemo(() => buildMarks(size, HUB_RING), [size, HUB_RING]);
  const grips = useMemo(() => Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return { x: R + GRIP_R * Math.cos(a), y: R + GRIP_R * Math.sin(a) };
  }), [R, GRIP_R]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size }}>
      {/* Static: the polycarbonate itself and the diffraction. The disc is
          deliberately TRANSLUCENT — the drive behind it shows through, which
          is what sells it as a real object rather than a printed sticker. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="cdGlass" cx="40%" cy="32%" r="74%">
            <Stop offset="0%" stopColor="#dfe8ff" stopOpacity="0.40" />
            <Stop offset="40%" stopColor="#9fb0d4" stopOpacity="0.26" />
            <Stop offset="74%" stopColor="#6d7c9e" stopOpacity="0.30" />
            <Stop offset="100%" stopColor="#c9d6f2" stopOpacity="0.44" />
          </RadialGradient>
          <SvgLinearGradient id="cdEdge" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <Stop offset="40%" stopColor="#ffffff" stopOpacity="0.18" />
            <Stop offset="72%" stopColor="#ffffff" stopOpacity="0.40" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.10" />
          </SvgLinearGradient>
          {fan.map((w) => (
            <RadialGradient key={w.id} id={w.id} cx="50%" cy="50%" r="50%">
              <Stop offset="18%" stopColor={w.hue} stopOpacity="0" />
              <Stop offset="42%" stopColor={w.hue} stopOpacity={w.a} />
              <Stop offset="72%" stopColor={w.hue} stopOpacity={w.b} />
              <Stop offset="100%" stopColor={w.hue} stopOpacity="0" />
            </RadialGradient>
          ))}
          <ClipPath id="cdClip"><Circle cx={R} cy={R} r={R} /></ClipPath>
        </Defs>
        <G clipPath="url(#cdClip)">
          <Circle cx={R} cy={R} r={R} fill="url(#cdGlass)" />
          {grooves.map((g, i) => (
            <Circle key={i} cx={R} cy={R} r={g.r} fill="none" stroke="#ffffff" strokeOpacity={g.op} strokeWidth={(R - HUB_RING) / 40 * 0.9} />
          ))}
          {fan.map((w) => <Path key={w.id} d={w.d} fill={`url(#${w.id})`} />)}
        </G>
      </Svg>

      {/* Turning: the album ghosted onto the disc, the wear, the hub. The art
          is faint and covers nearly the whole face rather than sitting in a
          printed label — and because it turns, it's also what makes the spin
          readable at a glance. */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]} pointerEvents="none">
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* one path, two circles, even-odd — a true ring, so the middle
                of the disc stays clear glass instead of being filled in */}
            <ClipPath id="cdArtRing"><Path d={ringPath} clipRule="evenodd" /></ClipPath>
          </Defs>
          {albumArt && (
            <G clipPath="url(#cdArtRing)">
              <SvgImage
                href={{ uri: albumArt }}
                x={R - ART_OUT} y={R - ART_OUT} width={ART_OUT * 2} height={ART_OUT * 2}
                preserveAspectRatio="xMidYMid slice" opacity={0.82}
              />
              {/* pewter wash — etched into the disc rather than pasted on.
                  Lifted twice now (03.08 "so each song feels more personal",
                  then 13.08 for more again), so the wash comes down with it:
                  the two are a pair, and leaving the wash where it was would
                  just fog the artwork the extra opacity was buying. */}
              <Circle cx={R} cy={R} r={ART_OUT} fill="#9fb0d4" fillOpacity={0.05} />
            </G>
          )}
          {marks.arcs.map((a, i) => <Path key={`a${i}`} d={a.d} fill="none" stroke="#ffffff" strokeOpacity={a.op} strokeWidth={a.w} />)}
          {marks.scuffs.map((sc, i) => <Path key={`s${i}`} d={sc.d} stroke="#ffffff" strokeOpacity={sc.op} strokeWidth={0.5} />)}
          {marks.dust.map((d, i) => <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" fillOpacity={d.op} />)}
          {marks.text.map((d, i) => <Path key={`t${i}`} d={d} stroke="#e6ecff" strokeOpacity={0.30} strokeWidth={1.4} />)}
          <Circle cx={R} cy={R} r={STACK} fill="none" stroke="#ffffff" strokeOpacity={0.13} strokeWidth={0.8} />
          <Circle cx={R} cy={R} r={HUB_RING} fill="none" stroke="#ffffff" strokeOpacity={0.34} strokeWidth={1} />
          {grips.map((g, i) => <Circle key={`g${i}`} cx={g.x} cy={g.y} r={GRIP} fill="#05060c" fillOpacity={0.82} />)}
          <Circle cx={R} cy={R} r={HUB_HOLE} fill="#05060c" fillOpacity={0.88} />
          <Circle cx={R} cy={R} r={HUB_HOLE} fill="none" stroke="#ffffff" strokeOpacity={0.42} strokeWidth={0.9} />
        </Svg>
      </Animated.View>

      {/* Polished edge, above everything so the disc reads as one solid piece */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={R} cy={R} r={R - 0.8} fill="none" stroke="url(#cdEdge)" strokeWidth={1.6} />
        <Circle cx={R} cy={R} r={R - 4} fill="none" stroke="#ffffff" strokeOpacity={0.10} strokeWidth={2} />
      </Svg>
    </View>
  );
}

/** How much of the case the disc fills. Shared, because the case draws the
 *  disc's cast shadow and has to know how big the thing casting it is. */
const DISC_FRACTION = 0.85;

/** The clear case. Thickness is faked with paired strokes — a lit outer edge,
 *  a dark inner line just behind it, then a faint inner highlight — which is
 *  what reads as moulded plastic rather than a drawn rectangle. */
function JewelCase({ size, children }: { size: number; children: React.ReactNode }) {
  const dust = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    x: hash01(i * 2.7) * size, y: hash01(i * 5.9 + 3.1) * size,
    r: 0.3 + hash01(i * 8.2) * 0.6, op: 0.06 + hash01(i * 4.4) * 0.14,
  })), [size]);
  const clips = [0.20, 0.5, 0.80];
  const corners = [[20, 20, 1, 1], [size - 20, 20, -1, 1], [20, size - 20, 1, -1], [size - 20, size - 20, -1, -1]] as const;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* THE DISC'S CAST SHADOW (owner, 13.08: "add some shadowing from the
          CD"). It lives in the CASE rather than in the disc, and that is the
          only place it can: a shadow has to fall BESIDE the thing casting it,
          and the disc's own canvas is exactly disc-sized — anything drawn
          outside it gets clipped, which was measurable (luminance either side
          of the disc identical to a tenth of a level). The case is bigger than
          the disc, so here there is room.

          Gradient falloff, not a solid offset circle: there is no blur filter
          available, and a hard-edged dark disc peeping out from behind reads
          as a second disc — the rule the mirror ball's rim and the share
          cards' fades both settled on. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="cdCast" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="72%" stopColor="#000000" stopOpacity="0.5" />
            <Stop offset="88%" stopColor="#000000" stopOpacity="0.24" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={size / 2 + size * 0.03} cy={size / 2 + size * 0.038}
          r={size * DISC_FRACTION * 0.56} fill="url(#cdCast)"
        />
      </Svg>
      {children}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="cdCaseEdge" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
            <Stop offset="28%" stopColor="#ffffff" stopOpacity="0.24" />
            <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.58" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.20" />
          </SvgLinearGradient>
          <SvgLinearGradient id="cdSpine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.26" />
            <Stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.20" />
          </SvgLinearGradient>
        </Defs>
        <Rect x={7} y={7} width={size - 14} height={size - 14} rx={14} fill="none" stroke="url(#cdCaseEdge)" strokeWidth={2.6} />
        <Rect x={11.5} y={11.5} width={size - 23} height={size - 23} rx={11} fill="none" stroke="#000000" strokeOpacity={0.45} strokeWidth={1.4} />
        <Rect x={14} y={14} width={size - 28} height={size - 28} rx={10} fill="none" stroke="#ffffff" strokeOpacity={0.20} strokeWidth={1} />
        <Rect x={7} y={7} width={26} height={size - 14} rx={13} fill="url(#cdSpine)" />
        <Rect x={33} y={9} width={1.6} height={size - 18} fill="#ffffff" fillOpacity={0.30} />
        {clips.map((f, i) => (
          <G key={`h${i}`}>
            <Rect x={11} y={size * f - 21} width={18} height={42} rx={4} fill="#ffffff" fillOpacity={0.07} stroke="#ffffff" strokeOpacity={0.52} strokeWidth={1.2} />
            <Rect x={14} y={size * f - 13} width={12} height={26} rx={3} fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.20} strokeWidth={0.8} />
          </G>
        ))}
        {corners.map(([x, y, sx, sy], i) => (
          <G key={`c${i}`}>
            <Path d={`M ${x} ${y + 30 * sy} L ${x} ${y} L ${x + 30 * sx} ${y}`} fill="none" stroke="#ffffff" strokeOpacity={0.52} strokeWidth={2} strokeLinecap="round" />
            <Path d={`M ${x + 5 * sx} ${y + 30 * sy} L ${x + 5 * sx} ${y + 5 * sy} L ${x + 30 * sx} ${y + 5 * sy}`} fill="none" stroke="#ffffff" strokeOpacity={0.13} strokeWidth={1} strokeLinecap="round" />
          </G>
        ))}
        {/* one broad diagonal reflection across the whole face */}
        <Path d={`M ${size * 0.12} 8 L ${size * 0.52} 8 L ${size * 0.20} ${size - 8} L 8 ${size - 8} Z`} fill="#ffffff" fillOpacity={0.030} />
        {dust.map((d, i) => <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" fillOpacity={d.op} />)}
      </Svg>
    </View>
  );
}

export function CDFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  // Bigger than the ball (0.62w / 0.34h) on purpose: the ball is a circle in
  // open space, this is a square object, so it needs more of the frame to
  // carry the same weight. Height-capped at 0.44 so the smallest phones don't
  // squeeze the title and transport below it.
  // Width is what limits this, not height — at 0.93 the case plus its drop
  // shadow is about as wide as it can go before touching the screen edges.
  // The height term is deliberately left where it was: on a small phone
  // (SE-sized) height binds instead, and raising it would push the case into
  // the controls below.
  const isLandscape = winW > winH;
  // Landscape sizes off HEIGHT alone — the portrait formula's winH*0.44 term
  // shrinks a sideways case to a coaster (the "squish", owner 30.07).
  const caseSize = isLandscape
    ? Math.min(winH * 0.94, 384)
    : Math.min(winW * 0.97, winH * 0.47, 430);
  const discSize = caseSize * DISC_FRACTION;
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];

  // Shuffle and repeat are READ STRAIGHT OFF THE PLAYER, not mirrored into
  // local state. Each mode used to keep its own copy and sync it in an effect
  // — eight copies of the same two lines, and the copy is what let the button
  // disagree with the music. The player already flips optimistically and holds
  // its answer against a stale poll, so there is nothing left for a mirror to
  // do but drift.
  const shuffle = spotify.shuffleOn;
  const repeat = spotify.repeatMode;

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  // The SCENE waits for the service's own verdict; the transport keeps the
  // optimistic `playing`, because a button that hesitates reads as broken.
  // See utils/confirmedPlaying for why, and for the clip that proved it.
  const live = confirmedPlaying(playing, spotify.track, musicSwitching);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });

  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    active: visible && isLandscape, playing, sheetOpen: showMood || showPicker,
  });
  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  const wrap01 = (v: number) => ((v % 1) + 1) % 1;
  const readAnim = (a: Animated.Value) => (a as unknown as { __getValue?: () => number }).__getValue?.() ?? 0;

  // Phase from the wall clock, never read back from the animation. See the
  // long note in DiscoBallMode: asking a native-driven value where it got to
  // answers asynchronously, and when that answer goes missing the disc stops
  // dead with nothing scheduled to restart it. Cost four rounds to find once.
  const phaseRef = useRef(0);
  const runStartRef = useRef(0);
  const turningRef = useRef(false);
  const readPhase = () => (turningRef.current
    ? wrap01(phaseRef.current + (Date.now() - runStartRef.current) / CD_SPIN_MS)
    : wrap01(phaseRef.current));

  // ── Turn the disc to scrub — the record's own gesture (owner, 28.07:
  // "the CD should respond to the full turn like how the vinyl performs").
  // Drag the disc around its centre and the song winds with it, one full
  // turn = five seconds, exactly the vinyl convention; a still, quick touch
  // is play/pause, matching a tap on the record. The disc claims its touches
  // outright — on the platter, the disc IS the control.
  const [scrubbing, setScrubbing] = useState(false);
  // How far the wind has moved the song, in seconds — shown in the same
  // centre pill the record uses, so a turn reads identically on both
  // spinning objects (owner, 30.07).
  const [scrubDeltaSec, setScrubDeltaSec] = useState(0);
  const scrubPillAnim = useRef(new Animated.Value(0)).current;
  const scrubPillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBaseRef = useRef(0);
  const scrubPctRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });
  const lastAngleRef = useRef<number | null>(null);
  const tapStartRef = useRef(0);
  const scrubHaptics = useRef(createScrubHaptics()).current;
  const durMsRef = useRef(1);
  durMsRef.current = Math.max(1, durationMs);
  // togglePlay is defined further down; the responder is built once, so it
  // reaches it through a ref.
  const togglePlayRef = useRef<() => void>(() => {});
  const closeRef = useRef<() => void>(() => {});

  /**
   * What a drag that started on the disc turned out to be. Undecided until
   * the finger has travelled far enough to tell.
   *
   * WHY THIS EXISTS (owner, 03.08 — "the app keeps pausing… and preventing me
   * from swiping, when I pull a card down"): giving the disc the rotational
   * gesture on 03.08 also had it claim touches on START and refuse to give
   * them up, so a pull-down on the disc could never reach the mode's own
   * dismiss. Worse, a short pull fell under the tap threshold on release and
   * toggled playback — the pull-down PAUSED the music instead of closing the
   * mode.
   *
   * The rule is deliberately the blunt one: a drag within ~35 degrees of
   * straight DOWN is a pull-down, and everything else winds the disc.
   *
   * A physical discriminator was built first and measured (scratchpad
   * classify.mjs, real 393x852 geometry) — how much ARC the drag had actually
   * wound, since pulling down through a disc's middle is radial and winds
   * nothing. It is right about the middle of the disc and wrong everywhere
   * else: 90px right of a 150px disc, a straight-down drag genuinely IS
   * mostly tangential and wound 0.86 pixels of arc per pixel travelled. So
   * physics says scrub while the person plainly meant to leave, and where the
   * two disagree the person wins.
   *
   * What that trades away, knowingly: you cannot wind the disc by dragging
   * straight down. You wind it the way anyone actually would — a circular
   * sweep or a drag across — and pull-down-to-dismiss stays true everywhere
   * on the screen, which is worth more than one redundant winding direction.
   */
  const dragRef = useRef<null | 'scrub' | 'dismiss'>(null);
  /** Pixels of travel before the gesture is judged. Below this it is a tap. */
  const DECIDE_PX = 16;
  /** |dy| must beat |dx| by this much to count as a pull-down (~35 degrees). */
  const DOWN_BIAS = 1.4;

  const angleAt = (x: number, y: number) =>
    Math.atan2(y - centerRef.current.y, x - centerRef.current.x) * (180 / Math.PI);
  // Shortest way round the circle, so crossing the ±180° seam doesn't read
  // as a whole spin in the other direction.
  const angleDiff = (cur: number, last: number) => {
    let d = cur - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  /** The pill sits for a second after you let go, then fades — the record's
   *  timing exactly, so the two objects behave as one family. */
  const fadeScrubPill = () => {
    if (scrubPillTimer.current) clearTimeout(scrubPillTimer.current);
    scrubPillTimer.current = setTimeout(() => {
      Animated.timing(scrubPillAnim, {
        toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start();
    }, 1000);
  };
  useEffect(() => () => { if (scrubPillTimer.current) clearTimeout(scrubPillTimer.current); }, []);

  const settleDismissRef = useRef<(g: { dy: number; vy: number }) => void>(() => {});

  const discPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        (evt.target as any).measure?.((_x: number, _y: number, w: number, h: number, pX: number, pY: number) => {
          centerRef.current = { x: pX + w / 2, y: pY + h / 2 };
          // Same as the record: measure answers a frame late, so re-anchor
          // the starting angle to the fresh centre or the first move jumps.
          if (lastAngleRef.current !== null) lastAngleRef.current = angleAt(pageX, pageY);
        });
        tapStartRef.current = Date.now();
        scrubHaptics.reset();
        dragRef.current = null;
        progressBaseRef.current = readAnim(progress);
        scrubPctRef.current = progressBaseRef.current;
        // The scrub does NOT begin here. Until the drag has been judged this
        // might be a tap or a pull-down, and neither should wind the song or
        // raise the scrub pill.
        const at = readPhase();
        phaseRef.current = at;
        turningRef.current = false;
        spin.stopAnimation();
        spin.setValue(at);
        lastAngleRef.current = angleAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt, g) => {
        if (lastAngleRef.current === null) return;
        const a = angleAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const diff = angleDiff(a, lastAngleRef.current);
        lastAngleRef.current = a;

        if (dragRef.current === null) {
          if (Math.hypot(g.dx, g.dy) < DECIDE_PX) return; // still a maybe-tap
          if (g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx) * DOWN_BIAS) {
            dragRef.current = 'dismiss';
          } else {
            dragRef.current = 'scrub';
            scrub.begin();
            setScrubbing(true);
            setScrubDeltaSec(0);
            if (scrubPillTimer.current) clearTimeout(scrubPillTimer.current);
            scrubPillAnim.setValue(1);
          }
        }

        if (dragRef.current === 'dismiss') {
          if (g.dy > 0) slideY.setValue(g.dy);
          return;
        }

        // The disc follows the finger exactly...
        const at = wrap01(phaseRef.current + diff / 360);
        spin.setValue(at);
        phaseRef.current = at;
        // ...and the song winds with it: 360° = 5 seconds, like the record.
        const pct = Math.max(0, Math.min(1, scrubPctRef.current + ((diff / 360) * 5000) / durMsRef.current));
        scrubPctRef.current = pct;
        scrub.move(pct);
        setScrubDeltaSec(Math.round(((pct - progressBaseRef.current) * durMsRef.current) / 1000));
        // Grain under the thumb — the record's habit, shared code.
        scrubHaptics.turn(diff);
      },
      onPanResponderRelease: (_evt, g) => {
        lastAngleRef.current = null;
        const kind = dragRef.current;
        dragRef.current = null;

        if (kind === 'dismiss') {
          // Same thresholds as the mode's own dismiss, so a pull-down feels
          // identical whether it starts on the disc or beside it.
          if (g.dy > 120 || g.vy > 0.8) closeRef.current();
          else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
          return;
        }

        setScrubbing(false);
        // Never judged = never travelled DECIDE_PX, i.e. a tap. It must NOT go
        // through scrub.end — that always seeks, and seeking to a stale
        // position on every play/pause stutters the song. togglePlay flips
        // `playing`, and the clock effect re-syncs.
        if (kind === null && Date.now() - tapStartRef.current < 450) {
          scrubPillAnim.setValue(0);
          togglePlayRef.current();
          return;
        }
        if (kind === null) { scrubPillAnim.setValue(0); return; } // slow press, no wind
        scrub.end(scrubPctRef.current);
        fadeScrubPill();
      },
      onPanResponderTerminate: (_evt, g) => {
        lastAngleRef.current = null;
        const kind = dragRef.current;
        dragRef.current = null;
        if (kind === 'dismiss') {
          // Settle exactly as a release would. Springing back unconditionally
          // meant a pull-down that ran off the bottom edge — where iOS cancels
          // the touch rather than releasing it — left the card half-open with
          // nothing to grab.
          settleDismissRef.current(g);
          return;
        }
        setScrubbing(false);
        if (kind === null) return;
        scrub.end(scrubPctRef.current);
        fadeScrubPill();
      },
    }),
  ).current;

  // Both now go through the one shared rule — `spinning` already asked the
  //  service, and the lights had no reason not to.
  const lightsOn = live;
  const spinning = live;

  useEffect(() => {
    if (!visible) return;
    if (scrubbing) return;

    const phase = readPhase();
    spin.setValue(phase);
    phaseRef.current = phase;

    let cancelled = false;
    let current: Animated.CompositeAnimation | null = null;

    if (!spinning) {
      turningRef.current = false;
      // The motor cuts and the disc coasts down — heavier than a mirror ball,
      // so it carries a little further.
      const to = phase + 0.07;
      // Bank the destination NOW, not on completion: if the effect re-runs
      // mid-coast the disc should pick up where it was heading rather than
      // snap back to where the coast began.
      phaseRef.current = wrap01(to);
      current = Animated.timing(spin, { toValue: to, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true });
      current.start();
      return () => { current?.stop(); };
    }

    turningRef.current = true;
    runStartRef.current = Date.now();
    const finishTurn = Animated.timing(spin, {
      toValue: 1, duration: CD_SPIN_MS * (1 - phase), easing: Easing.linear, useNativeDriver: true,
    });
    current = finishTurn;
    finishTurn.start(({ finished }) => {
      if (!finished || cancelled) return;
      spin.setValue(0);
      phaseRef.current = 0;
      runStartRef.current = Date.now();
      const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: CD_SPIN_MS, easing: Easing.linear, useNativeDriver: true }));
      current = loop;
      loop.start();
    });

    return () => {
      cancelled = true;
      phaseRef.current = readPhase();
      turningRef.current = false;
      current?.stop();
    };
  }, [visible, spinning, scrubbing]);

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    slideY.setValue(winH);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

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
  // The disc's own responder is built above this, so it reaches the same
  // settling rule through a ref — one definition of "where does the card go".
  settleDismissRef.current = settleDismiss;

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
  togglePlayRef.current = togglePlay;
  closeRef.current = handleClose;

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#04040c' }, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

        <StationBackdrop station={station} blurRadius={3} />
        <ModeScrim station={station} />

        {!isLandscape && (
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>
        )}

        {!isLandscape && (
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>CD</Text>
        </View>
        )}

        <View style={{ flex: 1, paddingTop: isLandscape ? 8 : topPad + 52, paddingBottom: isLandscape ? 8 : Math.max(insets.bottom, 24) + 16 }}>
          {!isLandscape && (
          <View style={{ paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </View>
          )}

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={deckScene}>
            <View style={fs.caseShadow} {...discPan.panHandlers}>
              <JewelCase size={caseSize}>
                <CDDisc size={discSize} spin={spin} albumArt={spotify.track?.albumArt ?? null} />
              </JewelCase>
            </View>
            </Animated.View>
          </View>

          {/* Wind marker — the record's pill, in the station's own colour
              rather than the vinyl's gold, so it belongs to this deck. */}
          <Animated.View pointerEvents="none" style={[fs.scrubPillWrap, { opacity: scrubPillAnim }]}>
            <View style={[fs.scrubPill, { borderColor: eq[1] + '80' }]}>
              <Ionicons name={scrubDeltaSec >= 0 ? 'play-forward' : 'play-back'} size={14} color={eq[1]} />
              <Text style={[fs.scrubPillText, { color: eq[1] }]}>
                {scrubDeltaSec >= 0 ? `+${scrubDeltaSec}s` : `${scrubDeltaSec}s`}
              </Text>
            </View>
          </Animated.View>

          {!isLandscape && (
          <>
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0 }} numberOfLines={2}>{title}</Text>}
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
            <TouchableOpacity onPress={() => spotify.shuffle(!shuffle)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
            <TouchableOpacity onPress={() => spotify.repeat(nextRepeat(repeat))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat === 'track' ? 'repeat-once' : 'repeat'} size={24} color={repeat !== 'off' ? eq[1] : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
          </View>

          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={station}
          />
          </>
          )}
        </View>

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

        {!isLandscape && <ModeCloseButton onPress={handleClose} />}

        <AmbientGlow active={visible && live} beat={visible && live} trackKey={spotify.track?.title ?? null} color={eq[1]} />
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
  scrubPillWrap: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', zIndex: 200 },
  scrubPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1,
  },
  scrubPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 2.5 },
  caseShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45, shadowRadius: 26, elevation: 14,
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
});
