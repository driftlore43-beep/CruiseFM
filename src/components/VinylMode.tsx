import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Circle as SvgCircle, G, Path, Rect as SvgRect } from 'react-native-svg';
import {
  Animated, Dimensions, Easing, Image, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWNER_MODE } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { LandscapeChrome, useChromeFade, useDeckScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { FloatingNotes } from '@/components/FloatingNotes';
import { getSavedPlatform, openMusicPlatform, PLATFORMS, PlatformId } from '@/utils/musicPlatform';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { seekTo } from '@/utils/spotify';
import { useMusicPlayback } from '@/utils/useMusicPlayback';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeActionRow } from '@/components/ModeActionRow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { ModeSheet } from '@/components/ModeSheet';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useAppActive } from '@/utils/useAppActive';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Retro disco palette ───────────────────────────────────────────────────────
const V = {
  bg:            '#0d0d0d',
  record:        '#0a0a0a',
  platter:       '#181818',
  platBorder:    '#2e2e2e',
  label:         '#8B0000',
  labelBorder:   '#6B0000',
  arm:           '#C4C4C4',
  armShine:      'rgba(255,255,255,0.45)',
  pivot:         '#AAAAAA',
  pivotBorder:   '#CCCCCC',
  gold:          '#C8960A',
  goldDim:       'rgba(200,150,10,0.18)',
  glow:          '#8B6914',
  violet:        '#9B5FFF',
  cream:         'rgba(255,255,255,0.9)',
  textDim:       'rgba(255,255,255,0.5)',
  textFaint:     'rgba(255,255,255,0.22)',
  surface:       'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.09)',
};

// ── Track data ────────────────────────────────────────────────────────────────
const VINYL_TRACKS = [
  { id: 'A1', title: 'Neon Autobahn',    artist: 'Kairo Club',     duration: '4:22' },
  { id: 'A2', title: 'Silver Freeway',   artist: 'Midnight Pilot', duration: '3:55' },
  { id: 'A3', title: 'Violet Dashboard', artist: 'Noir Turbo',     duration: '4:08' },
  { id: 'A4', title: 'Glass & Chrome',   artist: 'Low Glow',       duration: '5:02' },
] as const;

// Explicit vinyl accent per station — the disc rim, grooves and tonearm take
// this colour. Stations not listed fall back to their mid eq stop.
const VINYL_ACCENTS: Record<string, string> = {
  'sunset':         '#D84C8A', // dusk pink
  'mountain-pass':  '#FFFFFF', // crisp white
  'cars-coffee':    '#8B5A2B', // coffee brown
  'night-run':      '#2B4CFF', // deep blue
  'coastal':        '#FF7A3C', // golden-hour orange (matches the warm moods)
};

/** '#RRGGBB' → 'rgba(r,g,b,a)' — for animated colour interpolation. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

function parseTrackMs(d: string): number {
  const [m, s] = d.split(':').map(Number);
  return (m * 60 + s) * 1000;
}
function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Preview geometry — computed dynamically from container width inside VinylModePreview

// ── Disco sparkle field ───────────────────────────────────────────────────────
function SparkleField({ size }: { size: number }) {
  const dots = useMemo(() => {
    const out: { key: number; left: number; top: number; op: number; sz: number }[] = [];
    for (let i = 0; i < 32; i++) {
      const a = Math.sin(i * 127.1) * 43758.5453; const fa = a - Math.floor(a);
      const b = Math.sin(i * 311.7) * 43758.5453; const fb = b - Math.floor(b);
      const c = Math.sin(i * 74.9)  * 43758.5453; const fc = c - Math.floor(c);
      const e = Math.sin(i * 19.3)  * 43758.5453; const fe = e - Math.floor(e);
      const r     = (0.52 + fa * 0.4) * size / 2;
      const angle = fb * Math.PI * 2;
      out.push({ key: i, left: size / 2 + Math.cos(angle) * r, top: size / 2 + Math.sin(angle) * r, op: fc * 0.13 + 0.03, sz: fe * 2.5 + 0.5 });
    }
    return out;
  }, [size]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <View key={d.key} style={{ position: 'absolute', left: d.left, top: d.top, width: d.sz, height: d.sz, borderRadius: d.sz / 2, backgroundColor: V.gold, opacity: d.op }} />
      ))}
    </View>
  );
}

// ── Vinyl disc — clean bold design ───────────────────────────────────────────
function VinylDisc({ size, spin, accent = V.gold, showLabel = false }: { size: number; spin: Animated.AnimatedInterpolation<string>; accent?: string; showLabel?: boolean }) {
  // A touch over true-to-life (real label ≈ 33%) — matches the fullscreen deck.
  const cSize = Math.min(135, size * 0.40);
  const cR    = cSize / 2;

  const cx = size / 2;
  const r  = size / 2;

  // Point on the disc at `deg` degrees, `rad` px from centre — for glass highlights.
  const pt = (deg: number, rad: number) => {
    const a = (deg * Math.PI) / 180;
    return `${cx + rad * Math.cos(a)} ${cx + rad * Math.sin(a)}`;
  };
  // Pie wedge between two angles (sheen sector).
  const wedge = (a1: number, a2: number, rad: number) =>
    `M ${cx} ${cx} L ${pt(a1, rad)} A ${rad} ${rad} 0 0 1 ${pt(a2, rad)} Z`;
  // Arc along the rim (specular glint).
  const rimArc = (a1: number, a2: number, rad: number) =>
    `M ${pt(a1, rad)} A ${rad} ${rad} 0 0 1 ${pt(a2, rad)}`;

  return (
    <View style={{
      width: size, height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
    }}>
      {/* ── Spinning body — the physical disc ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
        {/* Clear pressing — glassy tint, sunlit accent rim, pressed grooves */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          {/* Glass body — barely-there so the scene glows through */}
          <SvgCircle cx={cx} cy={cx} r={r - 1} fill="rgba(255,255,255,0.08)" />
          {/* Sunlit rim — bright accent edge with a soft inner falloff */}
          <SvgCircle cx={cx} cy={cx} r={r - 2} fill="none" stroke={accent} strokeWidth={2.6} />
          <SvgCircle cx={cx} cy={cx} r={r - 5.5} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={5} />
          {/* Outer groove band catching the light */}
          <SvgCircle cx={cx} cy={cx} r={r * 0.82} fill="none" stroke={accent} strokeOpacity={0.10} strokeWidth={r * 0.22} />
          {/* Fine pressed grooves */}
          {[0.56, 0.62, 0.68, 0.73, 0.78, 0.86, 0.90].map((f, i) => (
            <SvgCircle key={i} cx={cx} cy={cx} r={r * f} fill="none" stroke={accent} strokeOpacity={i % 2 ? 0.24 : 0.14} strokeWidth={0.8} />
          ))}
          {/* Pressing marks — asymmetric surface texture, brighter than the
              grooves, so the spin reads at a glance instead of only the
              label appearing to turn */}
          <Path d={`M ${pt(37, r * 0.50)} L ${pt(37, r * 0.95)}`} stroke="rgba(255,255,255,0.20)" strokeWidth={1.3} strokeLinecap="round" />
          <Path d={`M ${pt(203, r * 0.58)} L ${pt(203, r * 0.90)}`} stroke="rgba(255,255,255,0.14)" strokeWidth={1} strokeLinecap="round" />
          <Path d={`M ${pt(130, r * 0.44)} L ${pt(130, r * 0.70)}`} stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} strokeLinecap="round" />
          <Path d={`M ${pt(305, r * 0.62)} L ${pt(305, r * 0.85)}`} stroke="rgba(255,255,255,0.10)" strokeWidth={0.8} strokeLinecap="round" />
          <SvgCircle cx={cx + r * 0.42} cy={cx - r * 0.31} r={1.6} fill="rgba(255,255,255,0.32)" />
          <SvgCircle cx={cx - r * 0.58} cy={cx + r * 0.22} r={1.3} fill="rgba(255,255,255,0.24)" />
          <SvgCircle cx={cx - r * 0.20} cy={cx - r * 0.66} r={1} fill="rgba(255,255,255,0.20)" />
          <SvgCircle cx={cx + r * 0.66} cy={cx + r * 0.14} r={0.9} fill="rgba(255,255,255,0.18)" />
          <SvgCircle cx={cx + r * 0.10} cy={cx + r * 0.72} r={1.1} fill="rgba(0,0,0,0.18)" />
          <SvgCircle cx={cx - r * 0.48} cy={cx - r * 0.48} r={0.9} fill="rgba(0,0,0,0.14)" />
        </Svg>
        {/* Center label — rendered inside disc when showLabel=true (preview card) */}
        {showLabel && (
        <View style={{
          position: 'absolute',
          width: cSize, height: cSize, borderRadius: cR,
          backgroundColor: '#8B0000', borderWidth: 1, borderColor: '#6B0000',
          top: size / 2 - cR, left: size / 2 - cR,
          overflow: 'hidden',
        }}>
          <Text style={{ position: 'absolute', top: cR * 0.18, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: Math.max(5, cSize * 0.075), fontWeight: '700', letterSpacing: 0.8 }}>COLUMBIA</Text>
          <Text style={{ position: 'absolute', top: cR * 0.50, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: Math.max(7, cSize * 0.145), fontWeight: '800', letterSpacing: 0.4 }}>CRUISE FM</Text>
          <Text style={{ position: 'absolute', top: cR * 1.22, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: Math.max(4, cSize * 0.065), letterSpacing: 0.3 }}>NIGHT RUN FM</Text>
          <View style={{ position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff', top: cR - 2.5, left: cR - 2.5 }} />
        </View>
      )}
      </Animated.View>

      {/* ── Fixed lighting — reflections belong to the light source, not the
          disc, so they hold their position while the record turns ── */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Broad sheen — top-right, with a hot streak inside it */}
        <Path d={wedge(-85, -20, r)} fill="rgba(255,255,255,0.12)" />
        <Path d={wedge(-68, -52, r)} fill="rgba(255,255,255,0.16)" />
        {/* Opposite sheen — dimmer, with its own faint streak */}
        <Path d={wedge(95, 160, r)} fill="rgba(255,255,255,0.07)" />
        <Path d={wedge(112, 126, r)} fill="rgba(255,255,255,0.10)" />
        {/* Specular rim glints — bright glass edge catching the light */}
        <Path d={rimArc(-150, -95, r - 3)} stroke="rgba(255,255,255,0.65)" strokeWidth={2} strokeLinecap="round" fill="none" />
        <Path d={rimArc(25, 60, r - 3)} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeLinecap="round" fill="none" />
        {/* Inner glass ring highlight */}
        <SvgCircle cx={cx} cy={cx} r={r * 0.50} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
      </Svg>
    </View>
  );
}

// ── Tonearm (shared between preview and fullscreen) ───────────────────────────
//
// THE SPINE, in fractions of armLen measured from the pivot. `a` is the tube's
// lean off the arm's own axis in degrees, POSITIVE = away from the spindle.
//
// A real S-arm leaves the bearing leaning slightly OUTWARD, bows back across
// the middle and straightens into the headshell. Two cubics joined with
// MATCHING tangents put that inflection exactly where it belongs; a single
// cubic bends wherever its control points happen to fall, which is how the old
// arm ended up a straight stick with one kink at the bottom.
const ARM_A = { x:  0.000, y: 0.075, a:  10 };  // leaves the bearing
const ARM_J = { x:  0.045, y: 0.450, a: -18 };  // inflection
const ARM_B = { x: -0.070, y: 0.845, a:  -8 };  // collar, where the shell bolts on
/** Headshell axis. ~18° off the tube's tangent at the collar — a cartridge's
 *  real offset angle, which is what finishes the S instead of fighting it. */
const ARM_HEAD_A = -26;
/** Collar → stylus, so the needle lands at ~1.03 armLen from the pivot and
 *  ~0.158 of it toward the spindle. Change these and it walks off the record. */
const ARM_HEAD_L = 0.20;

/** Unit vector for a lean angle. +y runs down the arm, +x away from the spindle.
 *  NOTE: SVG `rotate(a)` turns a downward vector toward −x, so a group that
 *  should point along armDir(θ) is rotated by −θ. */
function armDir(deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: Math.cos(r) };
}

/**
 * The arm, rebuilt from a reference photograph of a real one (owner, 02.08:
 * "it has the funky shape... let's start from scratch"). Three things carry it
 * and all three are structural, not decoration:
 *
 *  1. THE SPINE IS AN S (see the constants above), sized in fractions of the
 *     arm's own length so the same geometry serves the fullscreen deck and the
 *     little preview card.
 *  2. THE TUBE IS ROUND — stroked four times on the SAME path: outline, body,
 *     inner light, hot hairline offset to the lit side. One flat stroke is the
 *     whole difference between a tube and a drawn line.
 *  3. THE HARDWARE IS REAL — bearing housing with vents and a centre screw, a
 *     counterweight on a stub directly behind the pivot, a collar, an angular
 *     headshell with slots, screws and a finger lift, and the cartridge and
 *     stylus at the far tip.
 *
 * Silver and graphite whatever the station's mood: this is hi-fi kit, and the
 * colour on this deck belongs to the record.
 */
function Tonearm({
  armLen, armW, headW, pivotX, pivotY, rotation,
}: {
  armLen: number; armW: number; headW: number;
  pivotX: number; pivotY: number;
  rotation: Animated.AnimatedInterpolation<string>;
}) {
  const L  = armLen;
  const A  = { x: ARM_A.x * L, y: ARM_A.y * L };
  const J  = { x: ARM_J.x * L, y: ARM_J.y * L };
  const B  = { x: ARM_B.x * L, y: ARM_B.y * L };
  const tA = armDir(ARM_A.a), tJ = armDir(ARM_J.a), tB = armDir(ARM_B.a);
  const hd = armDir(ARM_HEAD_A);
  const headLen = ARM_HEAD_L * L;
  const S = { x: B.x + hd.x * headLen, y: B.y + hd.y * headLen };

  // Counterweight — a stub straight back from the pivot with a machined
  // cylinder on it. Sized off the tube so it stays in proportion at both
  // scales, with a floor off armLen so it doesn't vanish on the preview card.
  // Keep the stub SHORT: set further back the weight reads as a lollipop.
  const stubLen = L * 0.10;
  const cwW = Math.max(armW * 3.4, L * 0.09);
  const cwH = Math.max(armW * 2.1, L * 0.058);
  const cwMid = stubLen + cwH * 0.5;

  // Canvas — room for the bow, the headshell and the counterweight.
  const minX = Math.min(S.x - headW * 0.8, -cwMid * 0.25 - cwW * 0.62) - armW;
  const maxX = Math.max(J.x + armW, cwW * 0.62) + armW;
  const minY = -(cwMid + cwH * 0.62 + armW);
  const maxY = S.y + armW * 1.8;
  const PX = -minX, PY = -minY;
  const svgW = maxX - minX, svgH = maxY - minY;

  const p = (q: { x: number; y: number }) => `${(PX + q.x).toFixed(2)} ${(PY + q.y).toFixed(2)}`;
  const d1 = 0.40 * Math.hypot(J.x - A.x, J.y - A.y);
  const d2 = 0.40 * Math.hypot(B.x - J.x, B.y - J.y);
  const tube =
    `M ${p(A)} ` +
    `C ${p({ x: A.x + tA.x * d1, y: A.y + tA.y * d1 })} ${p({ x: J.x - tJ.x * d1, y: J.y - tJ.y * d1 })} ${p(J)} ` +
    `C ${p({ x: J.x + tJ.x * d2, y: J.y + tJ.y * d2 })} ${p({ x: B.x - tB.x * d2, y: B.y - tB.y * d2 })} ${p(B)}`;

  // Headshell — drawn straight down from the collar, then swung onto its axis.
  // It is a WEDGE: narrow where it bolts to the tube, widening to the
  // cartridge face. A shell barely wider than the tube reads as a blob.
  const bx = PX + B.x, by = PY + B.y;
  const headRot = `rotate(${-ARM_HEAD_A} ${bx.toFixed(2)} ${by.toFixed(2)})`;
  const shellTop = by + armW * 0.50;
  const shellBot = by + headLen * 0.71;
  const wTop = armW * 1.15, wBot = headW;
  /** Half-width of the shell a fraction f down its length. */
  const edge = (f: number) => (wTop + (wBot - wTop) * f) / 2;
  const yAt  = (f: number) => shellTop + (shellBot - shellTop) * f;
  const shellPath =
    `M ${bx - wTop / 2} ${shellTop} L ${bx + wTop / 2} ${shellTop} ` +
    `L ${bx + wBot / 2} ${shellBot} L ${bx - wBot / 2} ${shellBot} Z`;
  const cartTop = shellBot;
  const cartBot = by + headLen * 0.90;
  const cartW   = wBot * 0.52;
  // The cartridge tapers to a nose with the stylus at its point. A separate
  // cantilever line plus a dot just reads as a little "T" hung off the end.
  const cartPath =
    `M ${bx - cartW / 2} ${cartTop} L ${bx + cartW / 2} ${cartTop} ` +
    `L ${bx + cartW * 0.32} ${cartBot} L ${bx - cartW * 0.32} ${cartBot} Z`;
  const styPath =
    `M ${bx - cartW * 0.13} ${cartBot} L ${bx + cartW * 0.13} ${cartBot} ` +
    `L ${bx} ${by + headLen} Z`;
  // Finger lift — anchored ALONG the shell's real edge, not floating beside it,
  // and TAPERED (the outer edge spans less than the attachment) so it reads as
  // a lift rather than a grey rectangle stuck on the side.
  const lfDX = wBot * 0.36, lfDY = armW * 0.34;
  const liftPath =
    `M ${bx + edge(0.54)} ${yAt(0.54)} L ${bx + edge(0.62) + lfDX} ${yAt(0.62) - lfDY} ` +
    `L ${bx + edge(0.80) + lfDX} ${yAt(0.80) - lfDY} L ${bx + edge(0.88)} ${yAt(0.88)} Z`;
  const screwR  = Math.max(1, headW * 0.075);
  const slotH   = Math.max(1, armW * 0.20);

  // Counterweight swings with the arm, so it lives in the same rotating Svg.
  const cwRot = `rotate(${-ARM_A.a} ${PX.toFixed(2)} ${PY.toFixed(2)})`;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: pivotY, left: pivotX - armW / 2 }}>
      {/* Whole arm (shadow + tube + headshell + counterweight) rotates about the pivot */}
      <Animated.View style={{
        width: armW, height: armLen,
        transform: [
          { translateY: -(armLen / 2) },
          { rotate: rotation },
          { translateY: armLen / 2 },
        ],
      }}>
        <Svg
          width={svgW} height={svgH}
          style={{ position: 'absolute', top: -PY, left: armW / 2 - PX }}
        >
          {/* Drop shadow — the tube and the shell, offset and darkened */}
          <G transform={`translate(${(armW * 0.34).toFixed(2)},${(armW * 0.56).toFixed(2)})`} opacity={0.42}>
            <Path d={tube} stroke="#000" strokeWidth={armW * 1.05} fill="none" strokeLinecap="round" />
            <G transform={headRot}>
              <Path d={shellPath} fill="#000" />
              <Path d={cartPath} fill="#000" />
            </G>
          </G>

          {/* Counterweight — stub, adjustment collar, machined cylinder */}
          <G transform={cwRot}>
            <SvgRect x={PX - armW * 0.33} y={PY - stubLen} width={armW * 0.66} height={stubLen + armW * 0.4} rx={armW * 0.3} fill="#5b5e69" />
            <SvgRect x={PX - armW * 0.24} y={PY - stubLen + armW * 0.1} width={armW * 0.17} height={stubLen - armW * 0.2} rx={armW * 0.08} fill="rgba(255,255,255,0.5)" />
            <SvgRect x={PX - armW * 0.66} y={PY - stubLen * 0.46} width={armW * 1.32} height={armW * 0.46} rx={armW * 0.16} fill="#3a3c45" />
            {/* Cylinder */}
            <SvgRect x={PX - cwW / 2} y={PY - cwMid - cwH / 2} width={cwW} height={cwH} rx={cwH * 0.34} fill="#25262d" stroke="#4a4d58" strokeWidth={1} />
            <SvgRect x={PX - cwW / 2} y={PY - cwMid - cwH / 2} width={cwW} height={cwH * 0.19} rx={cwH * 0.16} fill="#34363f" />
            <SvgRect x={PX - cwW / 2} y={PY - cwMid - cwH * 0.07} width={cwW} height={cwH * 0.13} fill="#7d818d" />
            {[-0.30, -0.20, 0.22, 0.32].map((f, i) => (
              <SvgRect key={i} x={PX - cwW / 2} y={PY - cwMid + cwH * f} width={cwW} height={Math.max(0.7, cwH * 0.045)} fill="rgba(0,0,0,0.42)" />
            ))}
            <SvgRect x={PX - cwW * 0.37} y={PY - cwMid - cwH * 0.34} width={cwW * 0.12} height={cwH * 0.68} rx={cwW * 0.06} fill="rgba(255,255,255,0.16)" />
          </G>

          {/* Tube — a round chrome pipe: outline, body, inner light, hot hairline */}
          <Path d={tube} stroke="#3c3e47" strokeWidth={armW + Math.max(1.2, armW * 0.18)} fill="none" strokeLinecap="round" />
          <Path d={tube} stroke="#8a8d99" strokeWidth={armW} fill="none" strokeLinecap="round" />
          <Path d={tube} stroke="#c9ccd6" strokeWidth={armW * 0.5} fill="none" strokeLinecap="round" transform={`translate(${(-armW * 0.13).toFixed(2)},0)`} />
          <Path d={tube} stroke="rgba(255,255,255,0.9)" strokeWidth={Math.max(0.9, armW * 0.15)} fill="none" strokeLinecap="round" transform={`translate(${(-armW * 0.27).toFixed(2)},0)`} />

          {/* Headshell — collar, graphite shell, slots, screws, finger lift, cartridge */}
          <G transform={headRot}>
            {/* Collar / bayonet coupling */}
            <SvgRect x={bx - armW * 0.86} y={by - armW * 0.6} width={armW * 1.72} height={armW * 1.2} rx={armW * 0.34} fill="#9aa0ad" stroke="#4a4d57" strokeWidth={0.8} />
            <SvgRect x={bx - armW * 0.86} y={by - armW * 0.06} width={armW * 1.72} height={armW * 0.22} fill="rgba(0,0,0,0.38)" />
            {/* Finger lift — under the shell so it reads as bolted on */}
            <Path d={liftPath} fill="#7f8592" stroke="#3d404a" strokeWidth={0.7} />
            {/* Shell body */}
            <Path d={shellPath} fill="#23252c" stroke="#0c0d11" strokeWidth={1} />
            <Path
              d={`M ${bx - wTop / 2} ${shellTop} L ${bx - wTop * 0.10} ${shellTop} L ${bx - wBot * 0.12} ${shellBot} L ${bx - wBot / 2} ${shellBot} Z`}
              fill="rgba(255,255,255,0.10)"
            />
            {/* Mount band under the collar */}
            <SvgRect x={bx - wTop * 0.72} y={shellTop - armW * 0.06} width={wTop * 1.44} height={armW * 0.42} rx={armW * 0.14} fill="#a7adba" />
            {/* Vent slots */}
            {[0.38, 0.58].map((f, i) => {
              const w = wBot * 0.40;
              return <SvgRect key={i} x={bx - w / 2} y={yAt(f)} width={w} height={slotH} rx={slotH / 2} fill="#0d0e12" />;
            })}
            {/* Cartridge mounting screws */}
            <SvgCircle cx={bx - wBot * 0.30} cy={shellBot - armW * 0.5} r={screwR} fill="#8d93a0" />
            <SvgCircle cx={bx + wBot * 0.30} cy={shellBot - armW * 0.5} r={screwR} fill="#8d93a0" />
            {/* The shell's front FACE, then the cartridge nose below it. Without
                the bright face the shell and the cartridge merge into one long
                dark wedge and only the needle reads. */}
            <Path d={cartPath} fill="#191b21" stroke="#0a0b0e" strokeWidth={0.8} />
            <SvgRect x={bx - wBot * 0.5} y={shellBot - Math.max(1, armW * 0.3)} width={wBot} height={Math.max(1, armW * 0.3)} fill="#aeb4c1" />
            <SvgRect x={bx - cartW * 0.34} y={cartTop + armW * 0.26} width={cartW * 0.2} height={(cartBot - cartTop) * 0.46} rx={armW * 0.07} fill="rgba(255,255,255,0.18)" />
            <Path d={styPath} fill="#e9edf5" />
          </G>
        </Svg>
      </Animated.View>

      {/* Pivot base — fixed round plate with vents, screws, bearing and
          anti-skate dial (does not swing with the arm) */}
      {(() => {
        const R = Math.max(11, armW * 1.7);
        const dialR = Math.max(3.5, R * 0.32);
        const bw = R * 2 + dialR * 2 + 8;
        const bcx = R;
        return (
          <Svg
            width={bw} height={R * 2 + 4}
            style={{ position: 'absolute', top: -R, left: armW / 2 - R, zIndex: 10 }}
            pointerEvents="none"
          >
            <SvgCircle cx={bcx} cy={R} r={R} fill="#212228" stroke="#3f414a" strokeWidth={1.5} />
            <SvgCircle cx={bcx} cy={R} r={R * 0.84} fill="none" stroke="#585b66" strokeWidth={Math.max(0.9, R * 0.07)} />
            {/* Radial vents around the bearing */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const t = (deg * Math.PI) / 180;
              const c = Math.cos(t), s = Math.sin(t);
              return (
                <Path
                  key={deg}
                  d={`M ${bcx + c * R * 0.56} ${R + s * R * 0.56} L ${bcx + c * R * 0.74} ${R + s * R * 0.74}`}
                  stroke="rgba(0,0,0,0.5)" strokeWidth={Math.max(0.8, R * 0.09)} strokeLinecap="round"
                />
              );
            })}
            {[[-0.52, -0.42], [0.52, -0.42], [-0.52, 0.42], [0.52, 0.42]].map(([fx, fy], i) => (
              <SvgCircle key={i} cx={bcx + R * fx} cy={R + R * fy} r={Math.max(1.2, R * 0.1)} fill="#6E6E78" />
            ))}
            {/* Anti-skate dial off the plate's shoulder */}
            <SvgCircle cx={bcx + R + dialR + 2} cy={R + R * 0.24} r={dialR} fill="#33333a" stroke="#55555e" strokeWidth={1.2} />
            <Path d={`M ${bcx + R + dialR + 2} ${R + R * 0.24 - dialR + 1.5} V ${R + R * 0.24}`} stroke="#9C9CA6" strokeWidth={1.3} />
            {/* Bearing housing + centre screw with a glint */}
            <SvgCircle cx={bcx} cy={R} r={R * 0.46} fill="#2c2e35" stroke="#4d505b" strokeWidth={1} />
            <SvgCircle cx={bcx} cy={R} r={R * 0.22} fill="#5c5f6a" />
            <Path d={`M ${bcx - R * 0.16} ${R} H ${bcx + R * 0.16}`} stroke="#26272d" strokeWidth={Math.max(0.8, R * 0.06)} />
            <SvgCircle cx={bcx - R * 0.30} cy={R - R * 0.30} r={Math.max(1, R * 0.09)} fill="#9AA0AC" />
          </Svg>
        );
      })()}
    </View>
  );
}

// ── Fullscreen turntable hero ─────────────────────────────────────────────────
function TurntableHero({
  platSize, spin, tonearmAnim, glowOpacity, ringShimmer, raysSpin, labelRotate, playing, panHandlers, scrubbing, scrubDir, accent = V.gold, labelText = 'NIGHT RUN FM', albumArt = null, progressAnim,
}: {
  platSize: number;
  spin: Animated.AnimatedInterpolation<string>;
  tonearmAnim: Animated.Value;
  glowOpacity: Animated.AnimatedInterpolation<number>;
  ringShimmer: Animated.Value;
  raysSpin: Animated.AnimatedInterpolation<string>;
  labelRotate: Animated.AnimatedInterpolation<string>;
  playing: boolean;
  panHandlers: any;
  scrubbing: boolean;
  scrubDir: 'fwd' | 'bwd' | null;
  /** Station mood colour — rim, ring, rays and notes all take it. */
  accent?: string;
  /** Album cover URL — fills the centre label like a picture disc. */
  albumArt?: string | null;
  /** Track progress 0..1 — the arm creeps toward the label as the song plays. */
  progressAnim?: Animated.Value;
  /** Station name printed on the red centre label. */
  labelText?: string;
}) {
  const recSize  = platSize * 0.865;
  const armLen   = platSize * 0.70;
  const armW     = 10;
  const headW    = 26;
  const pivotX   = platSize * 0.935;
  const pivotY   = platSize * 0.048;
  // 0 = parked clear of the record (negative swings right, off the platter),
  // 1 = stylus resting on the outer groove (small positive).
  // Parked at -16°; the stylus drops onto the outer grooves (6°, clearly
  // inside the rim — needles never sit on the edge), then creeps toward the
  // label as the song progresses, exactly like a real pressing. The creep is
  // gated by tonearmAnim so a parked arm never wanders.
  const armAngle = Animated.add(
    tonearmAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 6] }),
    progressAnim
      ? Animated.multiply(tonearmAnim, Animated.multiply(progressAnim, 5))
      : new Animated.Value(0),
  );
  const armRot = armAngle.interpolate({ inputRange: [-16, 11], outputRange: ['-16deg', '11deg'] });
  const platOff  = (platSize - recSize) / 2;
  const rayLen   = recSize / 2;
  const rayPivot = recSize / 2 - rayLen / 2;

  return (
    <View style={{ width: platSize, height: platSize }}>
      <SparkleField size={platSize} />
      {/* Platter disc — pan responder applied here for record scrub */}
      <View {...panHandlers} style={[th.platter, { width: platSize, height: platSize, borderRadius: platSize / 2, position: 'absolute', top: 0, left: 0 }]}>
        <VinylDisc size={recSize} spin={spin} accent={accent} />
      </View>
      {/* Disco light rays — rotate at half record speed */}
      <Animated.View style={{
        position: 'absolute',
        width: recSize, height: recSize,
        top: platOff, left: platOff,
        transform: [{ rotate: raysSpin }],
      }} pointerEvents="none">
        {Array.from({ length: 8 }, (_, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: 2, height: rayLen,
            left: recSize / 2 - 1, top: 0,
            backgroundColor: accent, opacity: 0.06,
            transform: [
              { translateY: rayPivot },
              { rotate: `${i * 45}deg` },
              { translateY: -rayPivot },
            ],
          }} />
        ))}
      </Animated.View>
      {/* Single thick pulsing mood ring — color interpolated, not opacity.
          pointerEvents none is LOAD-BEARING: this view covers the whole
          record, and without it every tap/scrub on the vinyl died here. */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        width: recSize + 20, height: recSize + 20, borderRadius: (recSize + 20) / 2,
        borderWidth: 10,
        borderColor: ringShimmer.interpolate({
          inputRange: [0.6, 1.0],
          outputRange: [withAlpha(accent, 0.6), withAlpha(accent, 1)],
        }),
        top: (platSize - recSize - 20) / 2, left: (platSize - recSize - 20) / 2,
      }} />
      {/* Center label — independent spin, sits above the record */}
      {(() => {
        // Well over true-to-life (real label ≈ 33%) — the album art is the
        // star, give it the room (owner calls, 23–24.07).
        const cSize = Math.min(170, recSize * 0.45);
        const cR    = cSize / 2;
        return (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            width: cSize, height: cSize, borderRadius: cR,
            backgroundColor: '#8B0000', borderWidth: 1, borderColor: albumArt ? 'rgba(0,0,0,0.55)' : '#6B0000',
            alignItems: 'center', justifyContent: 'center',
            top: platSize / 2 - cR, left: platSize / 2 - cR,
            transform: [{ rotate: labelRotate }],
            overflow: 'hidden',
          }}>
            {albumArt ? (
              // Album cover fills the label — picture-disc style, MD-free.
              <Image source={{ uri: albumArt }} style={{ position: 'absolute', width: cSize, height: cSize }} resizeMode="cover" />
            ) : (
              <>
                <Text style={{ position: 'absolute', top: cR * 0.18, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: Math.max(5, cSize * 0.075), fontWeight: '700', letterSpacing: 1.2 }}>COLUMBIA</Text>
                <Text style={{ position: 'absolute', top: cR * 0.50, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: Math.max(8, cSize * 0.145), fontWeight: '800', letterSpacing: 0.4 }}>CRUISE FM</Text>
                <Text style={{ position: 'absolute', top: cR * 1.22, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: Math.max(4, cSize * 0.075), letterSpacing: 0.4 }} numberOfLines={1}>{labelText}</Text>
              </>
            )}
            {/* Spindle hole stays on top of art and label alike */}
            <View style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', top: cR - 3, left: cR - 3, borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' }} />
          </Animated.View>
        );
      })()}
      {/* Floating music notes */}
      <FloatingNotes playing={playing} emitter="ring" ringRadius={recSize / 2} scrubbing={scrubbing} scrubDir={scrubDir} color={accent} />
      <Tonearm armLen={armLen} armW={armW} headW={headW} pivotX={pivotX} pivotY={pivotY} rotation={armRot} />
    </View>
  );
}
const th = StyleSheet.create({
  platter: {
    // Translucent — the blurred station scene shows through the clear pressing.
    backgroundColor: 'rgba(16,16,16,0.38)', borderWidth: 1.5, borderColor: V.platBorder,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.8, shadowRadius: 18, elevation: 14,
  },
});

// ── Interactive progress bar ──────────────────────────────────────────────────
function ScrubProgressBar({ progress, isScrubbing, onLayout, panHandlers }: {
  progress: Animated.Value; isScrubbing: boolean;
  onLayout: (e: any) => void; panHandlers: any;
}) {
  const [barWidth, setBarWidth] = useState(300);
  const fillW      = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth] });
  const trackH     = isScrubbing ? 8 : 6;
  const DOT        = 14;
  const trackHalf  = trackH / 2;
  const dotOff     = DOT / 2;

  return (
    <View
      style={{ width: '100%', height: 36, justifyContent: 'center' }}
      onLayout={(e) => { setBarWidth(e.nativeEvent.layout.width); onLayout(e); }}
      {...panHandlers}
    >
      {/* Track — translucent unfilled */}
      <View style={{
        position: 'absolute', left: 0, right: 0,
        height: trackH, borderRadius: trackH / 2,
        backgroundColor: 'rgba(255,255,255,0.22)',
      }} />
      {/* White fill + dot at right edge */}
      <Animated.View style={{
        position: 'absolute', left: 0,
        height: trackH, borderRadius: trackH / 2,
        width: fillW, backgroundColor: '#ffffff',
      }}>
        {/* Dot sits at the fill end */}
        <View style={{
          position: 'absolute',
          right: -dotOff, top: trackHalf - dotOff,
          width: DOT, height: DOT, borderRadius: dotOff,
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOpacity: isScrubbing ? 0.6 : 0.4,
          shadowRadius: isScrubbing ? 8 : 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: isScrubbing ? 8 : 4,
        }} />
      </Animated.View>
    </View>
  );
}

// ── Track list ────────────────────────────────────────────────────────────────
function TrackList({ activeIdx, onSelect }: { activeIdx: number; onSelect: (i: number) => void }) {
  return (
    <View style={{ width: '100%', paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: V.surfaceBorder }} />
        <Text style={{ color: V.gold, fontSize: 8, fontWeight: '700', letterSpacing: 3 }}>SIDE A</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: V.surfaceBorder }} />
      </View>
      {VINYL_TRACKS.map((track, i) => {
        const active = i === activeIdx;
        return (
          <TouchableOpacity
            key={track.id} onPress={() => onSelect(i)} activeOpacity={0.7}
            style={[
              { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
              i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' } as any,
              active && { backgroundColor: V.goldDim, marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 6 },
            ]}>
            <Text style={{ color: active ? V.gold : V.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, width: 22, fontFamily: Fonts.mono }}>{track.id}</Text>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ color: active ? V.gold : V.textDim, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{track.title}</Text>
              <Text style={{ color: V.textFaint, fontSize: 10, fontFamily: Fonts.mono }} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Text style={{ color: active ? V.gold : V.textFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.3, fontFamily: Fonts.mono }}>{track.duration}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Fullscreen modal ──────────────────────────────────────────────────────────
export function VinylFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  const spotify = useMusicPlayback(visible);

  // Reflect Spotify's real shuffle/repeat when connected — honest buttons.
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);
  const [activeId,      setActiveId]      = useState(stationId ?? 'night-run');
  const [activeTrack,   setActiveTrack]   = useState(0);
  const [platform,      setPlatform]      = useState<{ id: PlatformId; name: string; color: string } | null>(null);
  const [isScrubbing,   setIsScrubbing]   = useState(false);
  const [scrubDir,      setScrubDir]      = useState<'fwd' | 'bwd' | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [shuffle,       setShuffle]       = useState(false);
  const [repeat,        setRepeat]        = useState(false);
  const [showTracks,    setShowTracks]    = useState(false);
  const [linked,        setLinked]        = useState<LinkedPlaylist | null>(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [showMood,      setShowMood]      = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(activeId).then(setLinked);
  }, [visible, activeId]);

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    active: visible && isLandscape, playing, sheetOpen: showMood || showPicker,
  });
  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  // ── Real-track layer ────────────────────────────────────────────────────────
  // With Spotify connected the deck runs on the REAL song: true duration,
  // position re-synced from every poll, and scrubs seek the actual track.
  // Without it, the demo deck below behaves exactly as before. Refs so the
  // once-created pan handlers always see fresh values.
  const realMs = spotify.track?.durationMs ?? null;
  const trackMs = realMs ?? parseTrackMs(VINYL_TRACKS[activeTrack].duration);
  const trackMsRef = useRef(trackMs);
  trackMsRef.current = trackMs;
  const realTrackRef = useRef(false);
  realTrackRef.current = realMs != null;
  const scrubbingRef = useRef(false);

  const spinValue      = useRef(new Animated.Value(0)).current;
  const labelSpin      = useRef(new Animated.Value(0)).current;
  const tonearmVal     = useRef(new Animated.Value(0)).current;
  const slideY         = useRef(new Animated.Value(SCREEN_H)).current;
  const glowPulse      = useRef(new Animated.Value(0)).current;
  const progress       = useRef(new Animated.Value(0)).current;
  const ringShimmer    = useRef(new Animated.Value(0.6)).current;
  const scrubIndicatorAnim  = useRef(new Animated.Value(0)).current;
  const showTracksAnim      = useRef(new Animated.Value(0)).current;
  const drawerY             = useRef(new Animated.Value(0)).current;

  const spinRef           = useRef<any>(null);
  const speedAnimRef      = useRef<Animated.CompositeAnimation | null>(null);
  const labelSpinRef      = useRef<any>(null);
  const isSpinning        = useRef(false);
  const pulseLoopRef      = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnimRef   = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoopRef    = useRef<any>(null);
  const scrubFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressValue     = useRef(0);
  const activeTrackRef    = useRef(activeTrack);
  const playingRef        = useRef(false);
  const scrubStartPosRef  = useRef(0);
  const lastHapticAccumRef = useRef(0);
  const progressBarWidthRef = useRef(300);
  const spinCurrentRef    = useRef(0);
  const pbHandlerRef      = useRef({ onGrant: (_x: number) => {}, onMove: (_x: number) => {}, onRelease: () => {} });
  const playBtnScale      = useRef(new Animated.Value(1)).current;

  // Rotational scrub — absolute screen coords
  const recordCenterX     = useRef(0);
  const recordCenterY     = useRef(0);
  const lastAngle         = useRef<number | null>(null);
  const accumulatedRotation = useRef(0);
  // Tap detection: a still, quick touch on the record toggles play/pause
  // (like tapping the cassette body) instead of registering as a zero scrub.
  const tapStartRef       = useRef(0);
  const movedDegRef       = useRef(0);
  const togglePlayRef     = useRef(() => {});

  const _getAngleFromCenter = (touchX: number, touchY: number) =>
    Math.atan2(touchY - recordCenterY.current, touchX - recordCenterX.current) * (180 / Math.PI);

  const _angleDiff = (current: number, last: number) => {
    let d = current - last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  const recordPanRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderTerminationRequest:    () => false,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        // `measure?.` — optional because a detached node has none, and a
        // throw in here kills the whole gesture.
        (evt.target as any).measure?.((_x: number, _y: number, w: number, h: number, pX: number, pY: number) => {
          recordCenterX.current = pX + w / 2;
          recordCenterY.current = pY + h / 2;
          // measure answers a frame late, so the angle this gesture started
          // from has to be recomputed against the FRESH centre. Without
          // this, the first move is measured from the old one and the record
          // jumps — which happens any time the centre has moved since the
          // last touch: after turning the phone, or mid deck-glide.
          if (lastAngle.current !== null) lastAngle.current = _getAngleFromCenter(pageX, pageY);
        });
        tapStartRef.current = Date.now();
        movedDegRef.current = 0;
        scrubStartPosRef.current = progressValue.current * trackMsRef.current;
        progressAnimRef.current?.stop();
        stopSpin();
        accumulatedRotation.current = spinCurrentRef.current * 360;
        lastAngle.current = _getAngleFromCenter(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        lastHapticAccumRef.current = 0;
        scrubbingRef.current = true;
        setIsScrubbing(true);
        if (scrubFadeTimerRef.current) clearTimeout(scrubFadeTimerRef.current);
        scrubIndicatorAnim.setValue(1);
      },
      onPanResponderMove: (evt) => {
        if (lastAngle.current === null) return;
        const angle = _getAngleFromCenter(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const diff  = _angleDiff(angle, lastAngle.current);
        lastAngle.current = angle;
        accumulatedRotation.current += diff;
        movedDegRef.current += Math.abs(diff);

        // 360° = 5 seconds of track
        const trackMs = trackMsRef.current;
        const deltaMs = (diff / 360) * 5000;
        const newMs   = Math.max(0, Math.min(trackMs, progressValue.current * trackMs + deltaMs));
        progress.setValue(newMs / trackMs);
        progressValue.current = newMs / trackMs;
        setCurrentTimeMs(Math.round(newMs));
        setScrubDir(diff >= 0 ? 'fwd' : 'bwd');

        spinValue.setValue(((accumulatedRotation.current % 360) + 360) % 360 / 360);

        lastHapticAccumRef.current += Math.abs(deltaMs);
        if (lastHapticAccumRef.current >= 5000) {
          lastHapticAccumRef.current = 0;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderRelease: (_evt, g) => {
        lastAngle.current = null;
        scrubbingRef.current = false;
        setIsScrubbing(false);
        setScrubDir(null);
        if (scrubFadeTimerRef.current) clearTimeout(scrubFadeTimerRef.current);
        // A still, quick touch is a TAP: the record doubles as a play/pause
        // button, matching the cassette body. Judged by FINGER TRAVEL in
        // pixels (not rotation degrees — near the record's centre a tiny
        // wobble reads as many degrees and taps kept registering as scrubs).
        if (Math.hypot(g.dx, g.dy) < 12 && Date.now() - tapStartRef.current < 450) {
          scrubIndicatorAnim.setValue(0);
          togglePlayRef.current();
          return;
        }
        scrubFadeTimerRef.current = setTimeout(() => {
          Animated.timing(scrubIndicatorAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
        }, 1000);
        // Real track: the spin you gave the record seeks the actual song.
        if (realTrackRef.current) seekTo(progressValue.current * trackMsRef.current).catch(() => {});
        if (playingRef.current) {
          startSpin();
          _restartProgressFrom(progressValue.current * trackMsRef.current, trackMsRef.current);
        }
      },
      onPanResponderTerminate: () => {
        lastAngle.current = null;
        scrubbingRef.current = false;
        setIsScrubbing(false);
        setScrubDir(null);
      },
    })
  ).current;

  // Re-bound every render so the tap always sees fresh play state.
  togglePlayRef.current = () => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); };

  const progressPanRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant:    (evt) => pbHandlerRef.current.onGrant(evt.nativeEvent.locationX),
      onPanResponderMove:     (evt) => pbHandlerRef.current.onMove(evt.nativeEvent.locationX),
      onPanResponderRelease:  ()    => pbHandlerRef.current.onRelease(),
      onPanResponderTerminate: ()   => { setIsScrubbing(false); setScrubDir(null); },
    })
  ).current;

  const drawerPanRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 0,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drawerY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          setShowTracks(false);
          Animated.timing(showTracksAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
        } else {
          Animated.spring(drawerY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  // Track spinValue position so we can manually setValue during rotational scrub
  useEffect(() => {
    const id = spinValue.addListener(({ value }) => { spinCurrentRef.current = value; });
    return () => spinValue.removeListener(id);
  }, []);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValue.current = value;
      setCurrentTimeMs(Math.round(value * trackMsRef.current));
    });
    return () => progress.removeListener(id);
  }, []);

  // One slow revolution (~23 rpm) — relaxed, not a fast blur.
  const SPIN_MS = 2600;

  // Steady loop. Each cycle is a FULL revolution measured from wherever the
  // record currently sits — a plain Animated.loop(0→1) only spins correctly
  // when starting at 0; after a pause/scrub it would animate just the
  // leftover sliver and snap back, which looked like the spin dying.
  const startSpin = () => {
    speedAnimRef.current?.stop(); speedAnimRef.current = null;
    if (isSpinning.current) return;
    isSpinning.current = true;
    const run = () => {
      const from = ((spinCurrentRef.current % 1) + 1) % 1;
      spinValue.setValue(from);
      spinRef.current = Animated.timing(spinValue, {
        toValue: from + 1, duration: SPIN_MS, easing: Easing.linear, useNativeDriver: true,
      });
      spinRef.current.start((result: { finished: boolean }) => {
        if (result.finished && playingRef.current && isSpinning.current) run();
        else isSpinning.current = false;
      });
    };
    run();
  };
  const stopSpin = () => {
    isSpinning.current = false;
    spinRef.current?.stop();
    speedAnimRef.current?.stop(); speedAnimRef.current = null;
  };

  // Ease up to speed on play, then hand off to the steady loop.
  const spinUp = () => {
    speedAnimRef.current?.stop();
    if (isSpinning.current) return;
    isSpinning.current = true;   // claim it so the safety net won't barge in mid-ramp
    const from = spinCurrentRef.current;
    spinValue.setValue(from);
    speedAnimRef.current = Animated.timing(spinValue, {
      toValue: from + 0.28, duration: 900, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    });
    speedAnimRef.current.start(({ finished }) => {
      speedAnimRef.current = null;
      isSpinning.current = false;
      if (finished && playingRef.current) {
        spinValue.setValue((((from + 0.28) % 1) + 1) % 1);
        startSpin();
      }
    });
  };

  // Coast down to a smooth halt on pause instead of a hard stop.
  const coastToStop = () => {
    spinRef.current?.stop();
    speedAnimRef.current?.stop();
    isSpinning.current = false;
    const from = spinCurrentRef.current;
    spinValue.setValue(from);
    speedAnimRef.current = Animated.timing(spinValue, {
      toValue: from + 0.5, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    speedAnimRef.current.start(({ finished }) => {
      speedAnimRef.current = null;
      if (finished) spinValue.setValue((((from + 0.5) % 1) + 1) % 1);
    });
  };

  const startLabelSpin = () => {
    labelSpinRef.current = Animated.loop(
      Animated.timing(labelSpin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    );
    labelSpinRef.current.start();
  };
  const stopLabelSpin = () => { labelSpinRef.current?.stop(); };

  useEffect(() => {
    if (playing) {
      spinUp();
      shimmerLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(ringShimmer, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(ringShimmer, { toValue: 0.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]));
      shimmerLoopRef.current.start();
    } else {
      coastToStop();
      shimmerLoopRef.current?.stop();
      ringShimmer.setValue(0.6);
    }
    return () => { stopSpin(); shimmerLoopRef.current?.stop(); };
  }, [playing]);

  // Safety net — restart spin if it stopped unexpectedly. Stops dead when the
  // app is backgrounded: a repeating timer is one of the things iOS kills a
  // background app for, and there is nothing to keep spinning off-screen.
  const appActive = useAppActive();
  useEffect(() => {
    if (!appActive) return;
    const interval = setInterval(() => {
      if (playingRef.current && !isSpinning.current) startSpin();
    }, 3000);
    return () => clearInterval(interval);
  }, [playing, appActive]);

  // Tonearm
  useEffect(() => {
    Animated.timing(tonearmVal, {
      toValue: playing ? 1 : 0,
      duration: playing ? 1200 : 900,
      easing: playing ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease),
      // JS driver: the arm angle is combined with the (JS-driven) track
      // progress for the inward creep — Animated can't mix drivers.
      useNativeDriver: false,
    }).start();
  }, [playing]);

  // Glow + progress
  useEffect(() => {
    if (playing) {
      pulseLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowPulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]));
      pulseLoopRef.current.start();
      _restartProgressFrom(progressValue.current * trackMsRef.current, trackMsRef.current);
    } else {
      pulseLoopRef.current?.stop();
      progressAnimRef.current?.stop();
      Animated.timing(glowPulse, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    }
    return () => { pulseLoopRef.current?.stop(); progressAnimRef.current?.stop(); };
  }, [playing]);

  // Track change (demo deck only — real tracks change on Spotify's side)
  useEffect(() => {
    if (realTrackRef.current) return;
    progressAnimRef.current?.stop();
    progress.setValue(0); progressValue.current = 0;
    if (playing) _restartProgressFrom(0, parseTrackMs(VINYL_TRACKS[activeTrack].duration));
  }, [activeTrack]);

  // Visibility
  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') { const p = PLATFORMS[id as Exclude<PlatformId, 'none'>]; if (p) setPlatform({ id: id as PlatformId, name: p.name, color: p.color }); } else setPlatform(null);
    });
    // Play state belongs to the session — a Modes-tab browse opens paused.
    slideY.setValue(winH); setActiveTrack(0);
    progress.setValue(0); progressValue.current = 0; setCurrentTimeMs(0);
    setShowTracks(false); showTracksAnim.setValue(0);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => {
      stopSpin(); stopLabelSpin(); shimmerLoopRef.current?.stop(); pulseLoopRef.current?.stop(); progressAnimRef.current?.stop();
    };
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const station      = resolveAnyStation(activeId);
  const currentTrack = VINYL_TRACKS[activeTrack];
  // Landscape sizes off HEIGHT alone — the portrait formula shrinks a
  // sideways platter to a saucer (the "squish", owner 30.07).
  const platSize     = isLandscape ? Math.min(winH * 0.86, 350) : Math.min(winW * 0.9, winH * 0.46);

  // Swipe-down to dismiss
  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove:  (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 0.8) handleClose();
      else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const topPad       = Math.max(insets.top, 20);
  const bottomPad    = Math.max(insets.bottom, 24) + 24;

  const _restartProgressFrom = (posMs: number, trackMs: number) => {
    const remaining = trackMs - posMs;
    if (remaining <= 0) return;
    progressAnimRef.current = Animated.timing(progress, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false });
    progressAnimRef.current.start(({ finished }) => {
      // Demo deck advances itself; a real track ends on Spotify's side and
      // the next poll re-syncs us onto whatever plays next.
      if (finished && !realTrackRef.current) {
        setActiveTrack((t) => { const n = Math.min(VINYL_TRACKS.length - 1, t + 1); if (n === t) setPlaying(false); return n; });
      }
    });
  };

  // Follow the real song: on every poll (and after skips) snap the deck to
  // Spotify's reported position — unless the user's hand is on the record.
  useEffect(() => {
    const t = spotify.track;
    if (!visible || !t || t.progressMs == null || t.durationMs == null || t.durationMs <= 0) return;
    if (scrubbingRef.current) return;
    const base = Math.min(t.durationMs, t.progressMs + (playing ? Date.now() - t.syncedAt : 0));
    progressAnimRef.current?.stop();
    const pct = base / t.durationMs;
    progress.setValue(pct);
    progressValue.current = pct;
    setCurrentTimeMs(Math.round(base));
    if (playing) _restartProgressFrom(base, t.durationMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, playing, spotify.track?.progressMs, spotify.track?.syncedAt, spotify.track?.title]);

  pbHandlerRef.current.onGrant = (x: number) => {
    progressAnimRef.current?.stop();
    scrubbingRef.current = true;
    setIsScrubbing(true);
    const pct = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    progress.setValue(pct);
    progressValue.current = pct;
    setCurrentTimeMs(Math.round(pct * trackMsRef.current));
  };
  pbHandlerRef.current.onMove = (x: number) => {
    const pct = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    progress.setValue(pct);
    progressValue.current = pct;
    setCurrentTimeMs(Math.round(pct * trackMsRef.current));
  };
  pbHandlerRef.current.onRelease = () => {
    scrubbingRef.current = false;
    setIsScrubbing(false);
    if (realTrackRef.current) seekTo(progressValue.current * trackMsRef.current).catch(() => {});
    if (playingRef.current) {
      _restartProgressFrom(progressValue.current * trackMsRef.current, trackMsRef.current);
    }
  };

  const spin        = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.36] });
  const raysSpin    = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const labelRotate = labelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        style={[fs.container, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>
        <StationBackdrop station={station} blurRadius={2.5} />
        <LinearGradient
          colors={[
            'rgba(2,2,12,0.20)',
            'rgba(2,2,12,0.15)',
            'rgba(2,2,12,0.30)',
            'rgba(2,2,12,0.46)',
            'rgba(2,2,12,0.58)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', (station.eqColors?.[1] ?? V.gold) + '26', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.40, bottom: 0 }}
          pointerEvents="none"
        />

        {/* Scrub indicator — center overlay, fades 1s after release */}
        <Animated.View pointerEvents="none" style={[fs.scrubIndicatorWrap, { opacity: scrubIndicatorAnim }]}>
          {(() => {
            const deltaSec = Math.round((currentTimeMs - scrubStartPosRef.current) / 1000);
            const fwd = deltaSec >= 0;
            return (
              <View style={fs.scrubIndicatorBox}>
                <Ionicons name={fwd ? 'play-forward' : 'play-back'} size={14} color={V.gold} />
                <Text style={fs.scrubIndicatorText}>{fwd ? `+${deltaSec}s` : `${deltaSec}s`}</Text>
              </View>
            );
          })()}
        </Animated.View>

        {/* Floating header */}
        {!isLandscape && (
        <View style={[fs.floatingTop, { top: topPad + 4, zIndex: 10 }]}>
          <View style={fs.dragPill} />
        </View>
        )}

        {/* Mode name — top-left corner tag, same treatment as every other mode */}
        {!isLandscape && (
        <View style={{ position: 'absolute', top: topPad + 14, left: 20, zIndex: 10 }} pointerEvents="none">
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 3, fontFamily: Fonts.mono }}>VINYL</Text>
        </View>
        )}

        <View style={{ flex: 1, paddingTop: isLandscape ? 8 : topPad + 52, paddingBottom: isLandscape ? 8 : bottomPad, alignItems: 'center' }}>

          {!isLandscape && (
          <View style={fs.header}>
            <StationIdentity station={station} />
          </View>
          )}

          <Animated.View style={[fs.turntableWrap, isLandscape && { flex: 1, justifyContent: 'center' }, deckScene]}>
            <TurntableHero
              platSize={platSize} spin={spin} tonearmAnim={tonearmVal} glowOpacity={glowOpacity}
              ringShimmer={ringShimmer} raysSpin={raysSpin} labelRotate={spin} playing={playing}
              panHandlers={recordPanRef.panHandlers} scrubbing={isScrubbing} scrubDir={scrubDir}
              accent={VINYL_ACCENTS[station.id] ?? station.eqColors?.[1] ?? V.gold}
              labelText={station.name.toUpperCase()}
              albumArt={spotify.track?.albumArt ?? null}
              progressAnim={progress}
            />
          </Animated.View>

          {!isLandscape && (
          <>
          {/* Song title when connected, else the mood's own line — never a fake track */}
          <View style={fs.trackBlock}>
            {spotify.track
              ? <MarqueeText text={spotify.track.title} style={fs.trackTitle} />
              : <Text style={[fs.trackTitle, { fontSize: 20 }]} numberOfLines={2}>{station.tagline}</Text>}
            {spotify.track && <Text style={fs.trackArtist} numberOfLines={1}>{spotify.track.artist}</Text>}
          </View>

          {spotify.track && (
          <View style={fs.progressWrap}>
            <ScrubProgressBar
              progress={progress} isScrubbing={isScrubbing}
              onLayout={(e) => { progressBarWidthRef.current = e.nativeEvent.layout.width; }}
              panHandlers={progressPanRef.panHandlers}
            />
            <View style={fs.timesBelow}>
              <Text style={fs.timeText}>{formatMs(currentTimeMs)}</Text>
              <Text style={fs.timeText}>{formatMs(trackMs)}</Text>
            </View>
          </View>
          )}

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity onPress={() => { const ns = !shuffle; setShuffle(ns); if (spotify.connected) spotify.shuffle(ns); }} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={26} color={shuffle ? (station.eqColors?.[1] ?? V.gold) : '#ffffff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setActiveTrack((t) => Math.max(0, t - 1)); spotify.prev(); }} style={fs.skipBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-previous" size={48} color="#fff" />
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <TouchableOpacity
                onPress={() => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); }}
                onPressIn={() => Animated.spring(playBtnScale, { toValue: 1.05, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                style={fs.playBtn} activeOpacity={0.9}>
                {playing ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={fs.pauseBar} />
                    <View style={fs.pauseBar} />
                  </View>
                ) : (
                  <MaterialCommunityIcons name="play" size={46} color="#0a0a12" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity onPress={() => { setActiveTrack((t) => Math.min(VINYL_TRACKS.length - 1, t + 1)); spotify.next(); }} style={fs.skipBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-next" size={48} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const nr = !repeat; setRepeat(nr); if (spotify.connected) spotify.repeat(nr ? 'track' : 'off'); }} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat ? 'repeat-once' : 'repeat'} size={26} color={repeat ? (station.eqColors?.[1] ?? V.gold) : '#ffffff'} />
            </TouchableOpacity>
          </View>

          {/* Left-aligned action pills — keep the record the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
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
            seekBar={spotify.track ? (
              <ScrubProgressBar
                progress={progress} isScrubbing={isScrubbing}
                onLayout={(e) => { progressBarWidthRef.current = e.nativeEvent.layout.width; }}
                panHandlers={progressPanRef.panHandlers}
              />
            ) : null}
            onPlayPause={() => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); }}
            onPrev={() => { setActiveTrack((t) => Math.max(0, t - 1)); spotify.prev(); }}
            onNext={() => { setActiveTrack((t) => Math.min(VINYL_TRACKS.length - 1, t + 1)); spotify.next(); }}
            onClose={handleClose}
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
          />
        )}

        {!isLandscape && <ModeCloseButton onPress={handleClose} />}

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={station.eqColors?.[1] ?? V.gold} />
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
              await setStationPlaylist(activeId, pl);
              setLinked(pl);
              setShowPicker(false);
              relinkStationPlaylist(activeId);
            }}
          />
        )}

      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#05060f' },
  floatingTop:  { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 22 },
  dragPill:     { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 10 },
  modeLabel:    { color: V.violet, fontSize: 9, fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase' },
  closeBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: V.surfaceBorder, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  header:        { alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 14 },
  headerEyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  headerStation: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  trackBlock:  { alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 4, alignItems: 'flex-start' },
  trackTitle:  { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  trackArtist: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 },
  turntableWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  progressWrap: { width: '100%', paddingHorizontal: 28, marginTop: 22, marginBottom: 0 },
  timesBelow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText:     { color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  controls:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 28, marginTop: 10, marginBottom: 8, paddingVertical: 4 },
  shuffleRepeatBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipBtn:      { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  playBtn:      { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14 },
  pauseBar:     { width: 8, height: 30, borderRadius: 2, backgroundColor: '#0a0a12' },

  tracksBtn:     { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: V.surfaceBorder, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tracksBtnText: { color: V.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  stationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, height: 42,
    borderRadius: 21, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
  },
  stationPillActive: { borderColor: '#ffffff' },

  bottomSheet:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#111111', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: '#2a2a2a', paddingTop: 12, paddingBottom: 32 },
  sheetHandle:   { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 12 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 10 },
  sheetTitle:    { color: V.gold, fontSize: 9, fontWeight: '700', letterSpacing: 3 },

  platformBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, backgroundColor: V.surface, borderRadius: 8, borderWidth: 1, borderColor: V.surfaceBorder },
  platformEmoji:{ fontSize: 18 },
  platformText: { color: V.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },

  scrubIndicatorWrap: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center', zIndex: 200 },
  scrubIndicatorBox:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(200,150,10,0.5)' },
  scrubIndicatorText: { color: V.gold, fontSize: 11, fontWeight: '700', letterSpacing: 2.5 },
});

// Preview geometry — fixed so record fits fully inside the 260px preview container
const PV_PLATTER = 232;
const PV_RECORD  = 216;  // PV_PLATTER - 16 (8px visual gap each side inside gold ring)
const PV_ARM_LEN = 138;
const PV_PIVOT_X = 224;  // PV_PLATTER - 8 (near top-right of platter)
const PV_PIVOT_Y = 8;

// ── Preview card ──────────────────────────────────────────────────────────────
export function VinylModePreview() {
  const idleSpin     = useRef(new Animated.Value(0)).current;
  const tonearmAngle = useRef(new Animated.Value(0)).current;
  const [modalOpen,  setModalOpen] = useState(false);
  const idleRef      = useRef<any>(null);

  // Zero-rotation passed to VinylDisc so the disc is static relative to the
  // platter — the outer Animated.View provides the actual idle spin,
  // keeping the entire record (grooves + label) spinning as one unit.
  const idleRotate   = idleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const staticRotate = idleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0deg'] });
  const armRot       = tonearmAngle.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '4deg'] });

  const startIdleSpin = () => {
    idleRef.current = Animated.loop(
      Animated.timing(idleSpin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    );
    idleRef.current.start();
  };

  useEffect(() => {
    startIdleSpin();
    return () => idleRef.current?.stop();
  }, []);

  const handlePress = () => {
    idleRef.current?.stop();
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    startIdleSpin();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={pv.scene}>
      <View style={pv.glowOrb} />
      <View style={pv.tapHint}>
        <Ionicons name="play" size={9} color="rgba(255,255,255,0.4)" />
        <Text style={pv.tapHintText}>tap to open</Text>
      </View>

      {/* Shared positioning container — tonearm sits here, static, while platter spins */}
      <View style={{ width: PV_PLATTER, height: PV_PLATTER }}>
        {/* Spinning platter — entire record (gold ring + disc + label) rotates as one */}
        <Animated.View style={[pv.platter, {
          width: PV_PLATTER, height: PV_PLATTER, borderRadius: PV_PLATTER / 2,
          transform: [{ rotate: idleRotate }],
        }]}>
          <VinylDisc size={PV_RECORD} spin={staticRotate} showLabel />
        </Animated.View>
        {/* Tonearm — positioned in same container but outside spinning view */}
        <Tonearm armLen={PV_ARM_LEN} armW={3} headW={13} pivotX={PV_PIVOT_X} pivotY={PV_PIVOT_Y} rotation={armRot} />
      </View>

      <VinylFullscreen visible={modalOpen} onClose={handleModalClose} />
    </TouchableOpacity>
  );
}

const pv = StyleSheet.create({
  scene: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  glowOrb: {
    position: 'absolute',
    width: PV_PLATTER + 80, height: PV_PLATTER + 80,
    borderRadius: (PV_PLATTER + 80) / 2,
    backgroundColor: 'rgba(200,134,10,0.09)',
  },
  tapHint: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  tapHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600' },
  platter: {
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: '#C8960A',
    shadowColor: '#C8960A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
});
