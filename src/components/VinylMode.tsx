import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';
import {
  Animated, Dimensions, Easing, ImageBackground, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWNER_MODE } from '@/constants/config';
import { Fonts } from '@/constants/theme';
import { STATIONS } from '@/constants/stations';
import { getSavedPlatform, openMusicPlatform, PLATFORMS, PlatformId } from '@/utils/musicPlatform';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

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

// ── Floating music notes ──────────────────────────────────────────────────────
type NoteItem = {
  id: number; x: number; y: number; icon: string;
  size: number; driftX: number; anim: Animated.Value;
};
const NOTE_ICONS = ['music-note-eighth', 'music-note-quarter', 'music-note-sixteenth', 'music'];
let _noteId = 0;

function FloatingNotes({ playing, containerSize, recordRadius, scrubbing, scrubDir, color = '#C8860A' }: {
  playing: boolean; containerSize: number; recordRadius: number;
  scrubbing: boolean; scrubDir: 'fwd' | 'bwd' | null;
  color?: string;
}) {
  const [notes, setNotes] = useState<NoteItem[]>([]);

  useEffect(() => {
    if (!playing) { setNotes([]); return; }
    const interval = scrubbing && scrubDir === 'fwd' ? 300 : 800;
    const spawn = () => {
      const angle = Math.random() * Math.PI * 2;
      const id    = _noteId++;
      const anim  = new Animated.Value(0);
      const bwd   = scrubbing && scrubDir === 'bwd';
      const note: NoteItem = {
        id,
        x:      containerSize / 2 + Math.cos(angle) * recordRadius,
        y:      containerSize / 2 + Math.sin(angle) * recordRadius,
        icon:   NOTE_ICONS[Math.floor(Math.random() * NOTE_ICONS.length)],
        size:   12 + Math.random() * 8,
        driftX: bwd ? (-10 + Math.random() * 20) * -1 : -30 + Math.random() * 60,
        anim,
      };
      setNotes((prev) => [...prev, note]);
      const tyEnd = bwd ? 60 : (scrubbing ? -160 : -120);
      const dur   = bwd ? 1400 : 2000;
      Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      });
    };
    spawn();
    const timer = setInterval(spawn, interval);
    return () => { clearInterval(timer); };
  }, [playing, scrubbing, scrubDir, containerSize, recordRadius]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {notes.map((note) => {
        const bwd   = scrubbing && scrubDir === 'bwd';
        const tyEnd = bwd ? 60 : (scrubbing ? -160 : -120);
        const ty      = note.anim.interpolate({ inputRange: [0, 1], outputRange: [0, tyEnd] });
        const tx      = note.anim.interpolate({ inputRange: [0, 1], outputRange: [0, note.driftX] });
        const opacity = note.anim.interpolate({ inputRange: [0, 0.08, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] });
        const scale   = note.anim.interpolate({ inputRange: [0, 1], outputRange: [1, bwd ? 1.4 : 0.4] });
        return (
          <Animated.View key={note.id} style={{
            position: 'absolute', left: note.x, top: note.y,
            transform: [{ translateX: tx }, { translateY: ty }, { scale }],
            opacity,
          }}>
            <MaterialCommunityIcons name={note.icon as any} size={note.size} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Vinyl disc — clean bold design ───────────────────────────────────────────
function VinylDisc({ size, spin, accent = V.gold, showLabel = false }: { size: number; spin: Animated.AnimatedInterpolation<string>; accent?: string; showLabel?: boolean }) {
  const cSize = Math.min(80, size * 0.30);
  const cR    = cSize / 2;

  const cx = size / 2;
  const r  = size / 2;

  return (
    <Animated.View style={{
      width: size, height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      transform: [{ rotate: spin }],
    }}>
      {/* Clear pressing — glassy tint, sunlit accent rim, pressed grooves */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Glass body — barely-there so the scene glows through */}
        <SvgCircle cx={cx} cy={cx} r={r - 1} fill="rgba(255,255,255,0.05)" />
        {/* Sunlit rim — bright accent edge with a soft inner falloff */}
        <SvgCircle cx={cx} cy={cx} r={r - 2} fill="none" stroke={accent} strokeWidth={2.6} />
        <SvgCircle cx={cx} cy={cx} r={r - 5.5} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={5} />
        {/* Outer groove band catching the light */}
        <SvgCircle cx={cx} cy={cx} r={r * 0.82} fill="none" stroke={accent} strokeOpacity={0.10} strokeWidth={r * 0.22} />
        {/* Fine pressed grooves */}
        {[0.56, 0.62, 0.68, 0.73, 0.78, 0.86, 0.90].map((f, i) => (
          <SvgCircle key={i} cx={cx} cy={cx} r={r * f} fill="none" stroke={accent} strokeOpacity={i % 2 ? 0.24 : 0.14} strokeWidth={0.8} />
        ))}
      </Svg>

      {/* Light reflections — inside spinning view so the spin reads on clear vinyl */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Primary reflection — soft, top-right quadrant */}
        <Path
          d={`M ${cx} ${cx} L ${size} 0 A ${r} ${r} 0 0 1 ${size} ${cx} Z`}
          fill="rgba(255,255,255,0.10)"
        />
        {/* Secondary reflection — dimmer, bottom-left quadrant, 180° opposite */}
        <Path
          d={`M ${cx} ${cx} L 0 ${size} A ${r} ${r} 0 0 1 0 ${cx} Z`}
          fill="rgba(255,255,255,0.05)"
        />
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
  );
}

// ── Tonearm (shared between preview and fullscreen) ───────────────────────────
function Tonearm({
  armLen, armW, headW, headH, pivotX, pivotY, rotation, color = '#222222',
}: {
  armLen: number; armW: number; headW: number; headH: number;
  pivotX: number; pivotY: number;
  rotation: Animated.AnimatedInterpolation<string>;
  /** Solid mood colour for the arm + headshell. */
  color?: string;
}) {
  const cwW = Math.max(16, armW * 2.2);
  const cwH = Math.max(10, armW * 1.4);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: pivotY, left: pivotX - armW / 2 }}>
      {/* Drop shadow — slightly offset clone of arm behind the real arm */}
      <Animated.View style={{
        position: 'absolute',
        width: armW, height: armLen,
        top: 5, left: 3,
        opacity: 0.45,
        transform: [
          { translateY: -(armLen / 2) },
          { rotate: rotation },
          { translateY: armLen / 2 },
        ],
      }}>
        <View style={{ position: 'absolute', top: 0, left: 0, width: armW, height: armLen - headH + 4, backgroundColor: '#000', borderRadius: 3 }} />
        <View style={{ position: 'absolute', bottom: -4, left: -(headW / 2 - armW / 2), width: headW + 2, height: headH + 2, backgroundColor: '#000', borderRadius: 3 }} />
      </Animated.View>

      {/* Main arm */}
      <Animated.View style={{
        width: armW, height: armLen,
        transform: [
          { translateY: -(armLen / 2) },
          { rotate: rotation },
          { translateY: armLen / 2 },
        ],
      }}>
        {/* Counterweight — at back end of arm */}
        <View style={{
          position: 'absolute',
          top: -cwH / 2 - 2,
          left: -(cwW / 2 - armW / 2),
          width: cwW, height: cwH,
          backgroundColor: '#1e1e1e',
          borderRadius: 4,
          borderWidth: 1, borderColor: '#3a3a3a',
        }} />
        {/* Arm body — solid mood colour */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: armW, height: armLen - headH, backgroundColor: color, borderRadius: 3 }} />
        {/* Highlight stripe */}
        <View style={{ position: 'absolute', top: 8, left: 1.5, width: 1.5, height: armLen - headH - 16, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 1 }} />
        {/* Headshell — wide flat block, mood colour */}
        <View style={{
          position: 'absolute', bottom: 0,
          left: -(headW / 2 - armW / 2),
          width: headW, height: headH,
          backgroundColor: color,
          borderRadius: 3,
          borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)',
        }}>
          <View style={{ position: 'absolute', top: 3, left: 3, right: 3, height: headH - 10, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 2 }} />
          {/* Stylus shank */}
          <View style={{ position: 'absolute', bottom: -6, left: headW / 2 - 1.5, width: 3, height: 7, backgroundColor: '#CCC', borderRadius: 1 }} />
          {/* Needle bright tip */}
          <View style={{ position: 'absolute', bottom: -11, left: headW / 2 - 1, width: 2, height: 5, backgroundColor: '#FFF', borderRadius: 1 }} />
        </View>
      </Animated.View>

      {/* Pivot base — flat illustration style: grey circle with lighter center */}
      <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444', top: -11, left: armW / 2 - 11, zIndex: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 6,
      }} />
      <View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#3e3e3e', top: -6, left: armW / 2 - 6, zIndex: 11 }} />
      <View style={{ position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#585858', top: -2.5, left: armW / 2 - 2.5, zIndex: 12 }} />
    </View>
  );
}

// ── Fullscreen turntable hero ─────────────────────────────────────────────────
function TurntableHero({
  platSize, spin, tonearmAnim, glowOpacity, ringShimmer, raysSpin, labelRotate, playing, panHandlers, scrubbing, scrubDir, accent = V.gold, labelText = 'NIGHT RUN FM',
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
  /** Station mood colour — rim, ring, rays, notes and tonearm all take it. */
  accent?: string;
  /** Station name printed on the red centre label. */
  labelText?: string;
}) {
  const recSize  = platSize * 0.865;
  const armLen   = platSize * 0.70;
  const armW     = 9;
  const headW    = 18;
  const headH    = 24;
  const pivotX   = platSize * 0.935;
  const pivotY   = platSize * 0.048;
  const armRot   = tonearmAnim.interpolate({ inputRange: [0, 1], outputRange: ['28deg', '-22deg'] });
  const platOff  = (platSize - recSize) / 2;
  const rayLen   = recSize / 2;
  const rayPivot = recSize / 2 - rayLen / 2;

  return (
    <View style={{ width: platSize, height: platSize }}>
      {/* Ambient glow */}
      <Animated.View style={{
        position: 'absolute',
        width: platSize * 0.92, height: platSize * 0.32,
        borderRadius: platSize * 0.46,
        backgroundColor: accent,
        bottom: -platSize * 0.04, left: platSize * 0.04,
        opacity: glowOpacity,
      }} />
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
      {/* Single thick pulsing mood ring — color interpolated, not opacity */}
      <Animated.View style={{
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
        const cSize = Math.min(80, recSize * 0.27);
        const cR    = cSize / 2;
        return (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            width: cSize, height: cSize, borderRadius: cR,
            backgroundColor: '#8B0000', borderWidth: 1, borderColor: '#6B0000',
            alignItems: 'center', justifyContent: 'center',
            top: platSize / 2 - cR, left: platSize / 2 - cR,
            transform: [{ rotate: labelRotate }],
            overflow: 'hidden',
          }}>
            <Text style={{ position: 'absolute', top: cR * 0.18, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: Math.max(5, cSize * 0.075), fontWeight: '700', letterSpacing: 1.2 }}>COLUMBIA</Text>
            <Text style={{ position: 'absolute', top: cR * 0.50, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: Math.max(8, cSize * 0.145), fontWeight: '800', letterSpacing: 0.4 }}>CRUISE FM</Text>
            <Text style={{ position: 'absolute', top: cR * 1.22, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: Math.max(4, cSize * 0.075), letterSpacing: 0.4 }} numberOfLines={1}>{labelText}</Text>
            <View style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', top: cR - 3, left: cR - 3 }} />
          </Animated.View>
        );
      })()}
      {/* Floating music notes */}
      <FloatingNotes playing={playing} containerSize={platSize} recordRadius={recSize / 2} scrubbing={scrubbing} scrubDir={scrubDir} color={accent} />
      <Tonearm armLen={armLen} armW={armW} headW={headW} headH={headH} pivotX={pivotX} pivotY={pivotY} rotation={armRot} color={accent} />
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
      style={{ flex: 1, height: 36, justifyContent: 'center' }}
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

  const [playing,       setPlaying]       = useState(false);
  const [activeId,      setActiveId]      = useState(stationId ?? 'night-run');
  const [activeTrack,   setActiveTrack]   = useState(0);
  const [platform,      setPlatform]      = useState<{ id: PlatformId; name: string; color: string } | null>(null);
  const [isScrubbing,   setIsScrubbing]   = useState(false);
  const [scrubDir,      setScrubDir]      = useState<'fwd' | 'bwd' | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [shuffle,       setShuffle]       = useState(false);
  const [repeat,        setRepeat]        = useState(false);
  const [showTracks,    setShowTracks]    = useState(false);

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
        (evt.target as any).measure((_x: number, _y: number, w: number, h: number, pX: number, pY: number) => {
          recordCenterX.current = pX + w / 2;
          recordCenterY.current = pY + h / 2;
        });
        const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
        scrubStartPosRef.current = progressValue.current * trackMs;
        progressAnimRef.current?.stop();
        stopSpin();
        accumulatedRotation.current = spinCurrentRef.current * 360;
        lastAngle.current = _getAngleFromCenter(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        lastHapticAccumRef.current = 0;
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

        // 360° = 5 seconds of track
        const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
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
      onPanResponderRelease: () => {
        lastAngle.current = null;
        setIsScrubbing(false);
        setScrubDir(null);
        if (scrubFadeTimerRef.current) clearTimeout(scrubFadeTimerRef.current);
        scrubFadeTimerRef.current = setTimeout(() => {
          Animated.timing(scrubIndicatorAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
        }, 1000);
        if (playingRef.current) {
          startSpin();
          const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
          _restartProgressFrom(progressValue.current * trackMs, trackMs);
        }
      },
      onPanResponderTerminate: () => {
        lastAngle.current = null;
        setIsScrubbing(false);
        setScrubDir(null);
      },
    })
  ).current;

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
      const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
      setCurrentTimeMs(Math.round(value * trackMs));
    });
    return () => progress.removeListener(id);
  }, []);

  // Spin — never reset value while playing; guard against double-start
  const startSpin = () => {
    if (isSpinning.current) return;
    isSpinning.current = true;
    spinRef.current = Animated.loop(
      Animated.timing(spinValue, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    );
    spinRef.current.start((result: { finished: boolean }) => {
      if (result.finished) {
        isSpinning.current = false;
        if (playingRef.current) startSpin();
      }
    });
  };
  const stopSpin = () => {
    isSpinning.current = false;
    spinRef.current?.stop();
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
      startSpin();
      startLabelSpin();
      shimmerLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(ringShimmer, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(ringShimmer, { toValue: 0.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]));
      shimmerLoopRef.current.start();
    } else {
      stopSpin();
      stopLabelSpin();
      shimmerLoopRef.current?.stop();
      ringShimmer.setValue(0.6);
    }
    return () => { stopSpin(); stopLabelSpin(); shimmerLoopRef.current?.stop(); };
  }, [playing]);

  // Safety net — restart spin if it stopped unexpectedly
  useEffect(() => {
    const interval = setInterval(() => {
      if (playingRef.current && !isSpinning.current) startSpin();
    }, 3000);
    return () => clearInterval(interval);
  }, [playing]);

  // Tonearm
  useEffect(() => {
    Animated.timing(tonearmVal, {
      toValue: playing ? 1 : 0,
      duration: playing ? 1200 : 900,
      easing: playing ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease),
      useNativeDriver: true,
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
      const remaining = (1 - progressValue.current) * parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
      progressAnimRef.current = Animated.timing(progress, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false });
      progressAnimRef.current.start(({ finished }) => {
        if (finished) setActiveTrack((t) => { const n = Math.min(VINYL_TRACKS.length - 1, t + 1); if (n === t) setPlaying(false); return n; });
      });
    } else {
      pulseLoopRef.current?.stop();
      progressAnimRef.current?.stop();
      Animated.timing(glowPulse, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    }
    return () => { pulseLoopRef.current?.stop(); progressAnimRef.current?.stop(); };
  }, [playing]);

  // Track change
  useEffect(() => {
    progressAnimRef.current?.stop();
    progress.setValue(0); progressValue.current = 0;
    if (playing) {
      progressAnimRef.current = Animated.timing(progress, { toValue: 1, duration: parseTrackMs(VINYL_TRACKS[activeTrack].duration), easing: Easing.linear, useNativeDriver: false });
      progressAnimRef.current.start(({ finished }) => {
        if (finished) setActiveTrack((t) => { const n = Math.min(VINYL_TRACKS.length - 1, t + 1); if (n === t) setPlaying(false); return n; });
      });
    }
  }, [activeTrack]);

  // Visibility
  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') { const p = PLATFORMS[id as Exclude<PlatformId, 'none'>]; if (p) setPlatform({ id: id as PlatformId, name: p.name, color: p.color }); } else setPlatform(null);
    });
    slideY.setValue(SCREEN_H); setPlaying(true); setActiveTrack(0);
    progress.setValue(0); progressValue.current = 0; setCurrentTimeMs(0);
    setShowTracks(false); showTracksAnim.setValue(0);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => {
      stopSpin(); stopLabelSpin(); shimmerLoopRef.current?.stop(); pulseLoopRef.current?.stop(); progressAnimRef.current?.stop();
    };
  }, [visible]);

  const handleClose = () => {
    setPlaying(false);
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const station      = STATIONS.find((s) => s.id === activeId) ?? STATIONS[0];
  const currentTrack = VINYL_TRACKS[activeTrack];
  const spotify = useSpotifyPlayback(visible);
  const platSize     = Math.min(winW * 0.9, winH * 0.46);

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

  const _restartProgressFrom = (posMs: number, trackMs: number) => {
    const remaining = trackMs - posMs;
    if (remaining <= 0) return;
    progressAnimRef.current = Animated.timing(progress, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false });
    progressAnimRef.current.start(({ finished }) => {
      if (finished) setActiveTrack((t) => { const n = Math.min(VINYL_TRACKS.length - 1, t + 1); if (n === t) setPlaying(false); return n; });
    });
  };

  pbHandlerRef.current.onGrant = (x: number) => {
    const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
    progressAnimRef.current?.stop();
    setIsScrubbing(true);
    const pct = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    progress.setValue(pct);
    progressValue.current = pct;
    setCurrentTimeMs(Math.round(pct * trackMs));
  };
  pbHandlerRef.current.onMove = (x: number) => {
    const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
    const pct     = Math.max(0, Math.min(1, x / progressBarWidthRef.current));
    progress.setValue(pct);
    progressValue.current = pct;
    setCurrentTimeMs(Math.round(pct * trackMs));
  };
  pbHandlerRef.current.onRelease = () => {
    setIsScrubbing(false);
    if (playingRef.current) {
      const trackMs = parseTrackMs(VINYL_TRACKS[activeTrackRef.current].duration);
      _restartProgressFrom(progressValue.current * trackMs, trackMs);
    }
  };

  const spin        = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.36] });
  const raysSpin    = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const labelRotate = labelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[fs.container, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={2.5}
          resizeMode="cover"
        />
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
          style={{ position: 'absolute', left: 0, right: 0, top: SCREEN_H * 0.40, bottom: 0 }}
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
        <View style={[fs.floatingTop, { top: topPad + 4, zIndex: 10 }]}>
          <View style={fs.dragPill} />
          <TouchableOpacity style={[fs.closeBtn, { position: 'absolute', right: 22, top: 0 }]} onPress={handleClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color={V.textDim} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, alignItems: 'center' }}>

          {/* ── Header — small top-center, Spotify style ── */}
          <View style={fs.header}>
            <Text style={fs.headerEyebrow}>PLAYING FROM</Text>
            <Text style={fs.headerStation}>{station.name}</Text>
          </View>

          <View style={fs.turntableWrap}>
            <TurntableHero
              platSize={platSize} spin={spin} tonearmAnim={tonearmVal} glowOpacity={glowOpacity}
              ringShimmer={ringShimmer} raysSpin={raysSpin} labelRotate={labelRotate} playing={playing}
              panHandlers={recordPanRef.panHandlers} scrubbing={isScrubbing} scrubDir={scrubDir}
              accent={station.eqColors?.[1] ?? V.gold}
              labelText={station.name.toUpperCase()}
            />
          </View>

          {/* Song title — bottom-left, Spotify style */}
          <View style={fs.trackBlock}>
            <Text style={fs.trackTitle} numberOfLines={1}>{spotify.track?.title ?? currentTrack.title}</Text>
            <Text style={fs.trackArtist} numberOfLines={1}>{spotify.track?.artist ?? currentTrack.artist}</Text>
          </View>

          <View style={fs.progressWrap}>
            <View style={fs.progressRow}>
              <Text style={[fs.timeText, { fontFamily: Fonts.mono }]}>{formatMs(currentTimeMs)}</Text>
              <ScrubProgressBar
                progress={progress} isScrubbing={isScrubbing}
                onLayout={(e) => { progressBarWidthRef.current = e.nativeEvent.layout.width; }}
                panHandlers={progressPanRef.panHandlers}
              />
              <Text style={[fs.timeText, { fontFamily: Fonts.mono, textAlign: 'right' }]}>{currentTrack.duration}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity onPress={() => setShuffle((s) => !s)} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={26} color={shuffle ? V.gold : '#ffffff'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setActiveTrack((t) => Math.max(0, t - 1)); spotify.prev(); }} style={fs.skipBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-previous" size={48} color="#fff" />
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <TouchableOpacity
                onPress={() => setPlaying((p) => { if (p) spotify.pause(); else spotify.play(); return !p; })}
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
            <TouchableOpacity onPress={() => setRepeat((r) => !r)} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="repeat" size={26} color={repeat ? V.gold : '#ffffff'} />
            </TouchableOpacity>
          </View>

          {/* Playlist button */}
          <TouchableOpacity
            onPress={() => {
              const next = !showTracks;
              setShowTracks(next);
              drawerY.setValue(0);
              Animated.timing(showTracksAnim, { toValue: next ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
            }}
            style={fs.tracksBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="musical-notes-outline" size={14} color={V.textDim} />
            <Text style={[fs.tracksBtnText, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>
            <Ionicons name={showTracks ? 'chevron-up' : 'chevron-down'} size={14} color={V.textDim} />
          </TouchableOpacity>

        </View>

        {/* Dark overlay — tap to close drawer */}
        {showTracks && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setShowTracks(false);
              Animated.timing(showTracksAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
            }}
            activeOpacity={1}
          />
        )}

        {/* Bottom sheet — track list */}
        <Animated.View
          {...drawerPanRef.panHandlers}
          style={[fs.bottomSheet, {
            transform: [
              { translateY: showTracksAnim.interpolate({ inputRange: [0, 1], outputRange: [winH * 0.52, 0] }) },
              { translateY: drawerY },
            ],
            height: winH * 0.50,
          }]}
        >
          <View style={fs.sheetHandle} />
          {/* Sheet header row */}
          <View style={fs.sheetHeader}>
            <Text style={[fs.sheetTitle, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>
            <TouchableOpacity
              onPress={() => {
                setShowTracks(false);
                Animated.timing(showTracksAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={V.textDim} />
            </TouchableOpacity>
          </View>
          <TrackList activeIdx={activeTrack} onSelect={(i) => {
            setActiveTrack(i);
            setShowTracks(false);
            Animated.timing(showTracksAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
          }} />

          {/* Change station */}
          <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
            <Text style={{ color: '#ffffff', fontSize: 10.5, fontWeight: '800', letterSpacing: 3, marginBottom: 8 }}>CHANGE STATION</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 4 }}>
            {STATIONS.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => { setActiveId(s.id); setShowTracks(false); Animated.timing(showTracksAnim, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0)); }}
                style={[fs.stationPill, s.id === activeId && fs.stationPillActive]}
                activeOpacity={0.75}>
                <LinearGradient
                  colors={s.cardGradient}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialCommunityIcons name={s.iconName as any} size={16} color="#ffffff" />
                <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', maxWidth: 80 }, s.id === activeId && { color: '#ffffff', fontWeight: '800' }]} numberOfLines={1}>
                  {s.name.replace(' FM', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {platform && (
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <TouchableOpacity onPress={() => openMusicPlatform(station.name)} activeOpacity={0.75} style={fs.platformBtn}>
                <PlatformIcon id={platform.id} size={14} />
                <Text style={[fs.platformText, { fontFamily: Fonts.mono }]}>Play on {platform.name}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  container:    { flex: 1 },
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
  turntableWrap:{ alignItems: 'center', width: '100%' },
  progressWrap: { width: '100%', paddingHorizontal: 28, marginTop: 22, marginBottom: 0 },
  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText:     { color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 0.2, width: 38 },
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
  const armRot       = tonearmAngle.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '-34deg'] });

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
        <Tonearm armLen={PV_ARM_LEN} armW={2} headW={9} headH={13} pivotX={PV_PIVOT_X} pivotY={PV_PIVOT_Y} rotation={armRot} />
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
