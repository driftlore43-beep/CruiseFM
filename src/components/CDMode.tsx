import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
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
                preserveAspectRatio="xMidYMid slice" opacity={0.44}
              />
              {/* pewter wash — etched into the disc rather than pasted on */}
              <Circle cx={R} cy={R} r={ART_OUT} fill="#9fb0d4" fillOpacity={0.13} />
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
  const caseSize = Math.min(winW * 0.93, winH * 0.44, 410);
  const discSize = caseSize * 0.85;
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);
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
  const spin = useRef(new Animated.Value(0)).current;

  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });

  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

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
  const progressBaseRef = useRef(0);
  const scrubPctRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });
  const lastAngleRef = useRef<number | null>(null);
  const tapStartRef = useRef(0);
  const hapticAccumRef = useRef(0);
  const durMsRef = useRef(1);
  durMsRef.current = Math.max(1, durationMs);
  // togglePlay is defined further down; the responder is built once, so it
  // reaches it through a ref.
  const togglePlayRef = useRef<() => void>(() => {});

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

  const discPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        (evt.target as any).measure?.((_x: number, _y: number, w: number, h: number, pX: number, pY: number) => {
          centerRef.current = { x: pX + w / 2, y: pY + h / 2 };
        });
        tapStartRef.current = Date.now();
        hapticAccumRef.current = 0;
        progressBaseRef.current = readAnim(progress);
        scrubPctRef.current = progressBaseRef.current;
        scrub.begin();
        setScrubbing(true);
        const at = readPhase();
        phaseRef.current = at;
        turningRef.current = false;
        spin.stopAnimation();
        spin.setValue(at);
        lastAngleRef.current = angleAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt) => {
        if (lastAngleRef.current === null) return;
        const a = angleAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const diff = angleDiff(a, lastAngleRef.current);
        lastAngleRef.current = a;
        // The disc follows the finger exactly...
        const at = wrap01(phaseRef.current + diff / 360);
        spin.setValue(at);
        phaseRef.current = at;
        // ...and the song winds with it: 360° = 5 seconds, like the record.
        const pct = Math.max(0, Math.min(1, scrubPctRef.current + ((diff / 360) * 5000) / durMsRef.current));
        scrubPctRef.current = pct;
        scrub.move(pct);
        // A soft tick every five wound seconds — the record's habit.
        hapticAccumRef.current += Math.abs((diff / 360) * 5000);
        if (hapticAccumRef.current >= 5000) {
          hapticAccumRef.current = 0;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
      onPanResponderRelease: (_evt, g) => {
        lastAngleRef.current = null;
        setScrubbing(false);
        // Judged by finger travel in PIXELS, not degrees — near the centre a
        // tiny wobble reads as many degrees (the vinyl lesson).
        if (Math.hypot(g.dx, g.dy) < 12 && Date.now() - tapStartRef.current < 450) {
          // A tap must NOT go through scrub.end — that always seeks, and
          // seeking to a stale position on every play/pause stutters the
          // song. togglePlay flips `playing`, and the clock effect re-syncs.
          togglePlayRef.current();
          return;
        }
        scrub.end(scrubPctRef.current);
      },
      onPanResponderTerminate: () => {
        lastAngleRef.current = null;
        setScrubbing(false);
        scrub.end(scrubPctRef.current);
      },
    }),
  ).current;

  const lightsOn = playing && !musicSwitching;
  const spinning = lightsOn && (spotify.track?.isPlaying ?? true);

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
  togglePlayRef.current = togglePlay;

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#04040c' }, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        <StationBackdrop station={station} blurRadius={3} />
        <LinearGradient
          colors={['rgba(3,3,10,0.58)', 'rgba(3,3,10,0.44)', 'rgba(3,3,10,0.6)', 'rgba(3,3,10,0.72)', 'rgba(3,3,10,0.82)']}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>CD</Text>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={fs.caseShadow} {...discPan.panHandlers}>
              <JewelCase size={caseSize}>
                <CDDisc size={discSize} spin={spin} albumArt={spotify.track?.albumArt ?? null} />
              </JewelCase>
            </View>
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

          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            track={spotify.track}
            station={station}
          />
        </View>

        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
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
