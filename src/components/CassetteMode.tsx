import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Rect as SvgRect, Circle as SvgCircle, Line as SvgLine, Path as SvgPath, Text as SvgText,
  Defs, ClipPath, G, LinearGradient as SvgLinearGradient, Stop,
} from 'react-native-svg';
import { Fonts } from '@/constants/theme';
import { OWNER_MODE } from '@/constants/config';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { StationIdentity } from '@/components/StationIdentity';
import { FloatingNotes } from '@/components/FloatingNotes';
import { PLATFORMS, PlatformId, getSavedPlatform, openMusicPlatform } from '@/utils/musicPlatform';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { ModeSheet } from '@/components/ModeSheet';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
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
import { LandscapeChrome, useChromeFade, useDeckScene } from '@/components/LandscapeChrome';
import { SeekBar } from '@/components/SeekBar';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Warm palette ──────────────────────────────────────────────────────────────
const C = {
  bg:          '#1a0f00',
  body:        '#E8D5A3',
  bodyShad:    '#C4B07A',
  stripe:      '#CC2200',
  stripeThin:  '#8B1800',
  label:       '#F5E8C0',
  labelText:   '#3A1A00',
  reelDark:    '#2A1A08',
  reelMid:     '#4A2E12',
  hub:         '#C0A060',
  hubLight:    '#E0C080',
  tape:        '#5C3A14',
  tapeLight:   '#7A5020',
  amber:       '#E8960A',
  amberDim:    'rgba(232,150,10,0.14)',
  cream:       '#F0DEB0',
  textDim:     'rgba(240,222,176,0.6)',
  textFaint:   'rgba(240,222,176,0.28)',
  brown:       '#8B5E2A',
  brownDark:   '#3A2010',
  surface:     'rgba(255,220,140,0.05)',
  surfaceBorder:'rgba(255,210,120,0.12)',
};

// ── Track data ────────────────────────────────────────────────────────────────
const SIDE_A_TRACKS = [
  { id: 'A1', title: 'Violet Overdrive',   artist: 'Kairo Club',    duration: '3:48' },
  { id: 'A2', title: 'Carbon Wing',        artist: 'Midnight Pilot', duration: '4:12' },
  { id: 'A3', title: 'After Hours Boost',  artist: 'Noir Turbo',    duration: '3:31' },
  { id: 'A4', title: 'Empty Expressway',   artist: 'Low Glow',      duration: '4:55' },
] as const;

function parseTrackMs(duration: string): number {
  const [m, s] = duration.split(':').map(Number);
  return (m * 60 + s) * 1000;
}

function fmtTapeMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Grain overlay ─────────────────────────────────────────────────────────────
// Simulated film grain: a grid of tiny dots at random-but-stable positions
function GrainOverlay() {
  // Live screen size, not the module-load one: seeded against a portrait
  // height the grain landed almost entirely below a sideways screen, and
  // what did show was crammed into the left half.
  const { width: w, height: h } = useWindowDimensions();
  const dots = useMemo(() => {
    const result: { key: number; left: number; top: number; opacity: number; size: number }[] = [];
    // 400 stable pseudo-random dots seeded by index
    for (let i = 0; i < 400; i++) {
      // cheap deterministic hash
      const h1 = Math.sin(i * 127.1) * 43758.5453;
      const h2 = Math.sin(i * 311.7) * 43758.5453;
      const h3 = Math.sin(i * 74.9)  * 43758.5453;
      const h4 = Math.sin(i * 19.3)  * 43758.5453;
      result.push({
        key: i,
        left:    (h1 - Math.floor(h1)) * w,
        top:     (h2 - Math.floor(h2)) * h,
        opacity: (h3 - Math.floor(h3)) * 0.04 + 0.01,
        size:    (h4 - Math.floor(h4)) * 1.5 + 0.5,
      });
    }
    return result;
  }, [w, h]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d) => (
        <View key={d.key} style={{
          position: 'absolute',
          left: d.left, top: d.top,
          width: d.size, height: d.size,
          borderRadius: d.size / 2,
          backgroundColor: '#F0DEB0',
          opacity: d.opacity,
        }} />
      ))}
    </View>
  );
}

// ── Section divider label ─────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sl.row}>
      <View style={sl.line} />
      <Text style={[sl.text, { fontFamily: Fonts.mono }]}>{label}</Text>
      <View style={sl.line} />
    </View>
  );
}
const sl = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  line: { flex: 1, height: 1, backgroundColor: C.surfaceBorder },
  text: { color: C.amber, fontSize: 8, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase' },
});

// ── Track list ────────────────────────────────────────────────────────────────
function TrackList({
  activeIdx,
  onSelect,
}: {
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={tl.container}>
      {SIDE_A_TRACKS.map((track, i) => {
        const active = i === activeIdx;
        return (
          <TouchableOpacity
            key={track.id}
            onPress={() => onSelect(i)}
            activeOpacity={0.65}
            style={[tl.row, i > 0 && tl.divider, active && tl.rowActive]}>
            {active && <View style={tl.activeBorder} />}
            <Text style={[tl.num, { fontFamily: Fonts.mono }]}>{track.id}</Text>
            <View style={tl.mid}>
              <Text style={tl.title} numberOfLines={1}>{track.title}</Text>
              <Text style={tl.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Text style={[tl.dur, { fontFamily: Fonts.mono }]}>{track.duration}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const tl = StyleSheet.create({
  container: { width: '100%' },
  row: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    minHeight: 72, paddingHorizontal: 24, paddingVertical: 18, gap: 14,
  },
  rowActive:    { backgroundColor: '#3a2000' },
  activeBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: C.amber },
  divider:      { borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.08)' },
  num:   { color: C.amber, fontSize: 16, fontWeight: '700', letterSpacing: 0.5, width: 28 },
  mid:   { flex: 1, gap: 3 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  artist:{ color: C.body, fontSize: 14, opacity: 0.7 },
  dur:   { color: C.amber, fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});

// ── Station switcher pills ────────────────────────────────────────────────────
function StationSwitcher({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={ss.container}>
      <View style={{ paddingHorizontal: 22, marginBottom: 10 }}>
        <SectionLabel label="FLIP THE TAPE" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ss.scroll}>
        {STATIONS.map((s) => {
          const active = s.id === activeId;
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => onSelect(s.id)}
              activeOpacity={0.7}
              style={[ss.pill, active && ss.pillActive]}>
              <MaterialCommunityIcons name={s.iconName as any} size={15} color="#fff" style={ss.pillIcon} />

              <Text
                style={[ss.pillText, { fontFamily: Fonts.mono }, active && ss.pillTextActive]}
                numberOfLines={1}>
                {s.name.replace(' FM', '')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const ss = StyleSheet.create({
  container: { width: '100%', alignSelf: 'stretch', marginTop: 28 },
  scroll:    { paddingHorizontal: 24, gap: 10, paddingVertical: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 48,
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1.5, borderColor: C.surfaceBorder,
  },
  pillActive: {
    backgroundColor: 'rgba(232,150,10,0.18)',
    borderColor: 'rgba(232,150,10,0.55)',
  },
  pillIcon: { fontSize: 15 },
  pillText: {
    color: C.textDim, fontSize: 13, fontWeight: '700',
    letterSpacing: 0.3, maxWidth: 90,
  },
  pillTextActive: { color: C.amber },
});

// ── Platform button ───────────────────────────────────────────────────────────
function PlatformButton({
  platform,
  onPress,
}: {
  platform: { id: PlatformId; name: string; color: string } | null;
  onPress: () => void;
}) {
  if (!platform) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={pb.btn}>
      {/* Aged border effect — outer ring slightly lighter */}
      <View style={[StyleSheet.absoluteFill, pb.aged]} pointerEvents="none" />
      <PlatformIcon id={platform.id} size={14} />
      <Text style={[pb.text, { fontFamily: Fonts.mono }]}>
        Play on {platform.name}
      </Text>
    </TouchableOpacity>
  );
}
const pb = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
    marginHorizontal: 22,
    paddingVertical: 15,
    backgroundColor: '#2A1A08',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.brown,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 5,
  },
  aged: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240,222,176,0.06)',
    margin: 2,
  },
  emoji: { fontSize: 18 },
  text:  { color: C.cream, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
});

// ── Reel component — static disc, rotation applied by parent wrapper ──────────
// A spinning neon reel hub — cog spokes radiating from a glowing centre.
// Deterministic scatter for the shell's dust/wear (no Math.random — the
// speckles must not crawl between renders).
function ch01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ── Clear-shell cassette ─────────────────────────────────────────────────────
// Same lesson as the CD: the shell is NEUTRAL clear polycarbonate and the only
// colour is the hardware inside it. Everything used to be neon line-art in the
// station hue, which read as a wireframe; now the station colour lives in the
// reel hubs and the tape tint, and the shell is glass you can see the road
// through. Thickness comes from PAIRED strokes — a lit outer edge, a dark line
// just behind it, then a faint inner highlight.
const VB_W = 340;
const VB_H = 210;
const LX = 118, RX = 224, RY = 118;
const PACK_BASE = 104;

/**
 * The reel hub, redrawn off the owner's close-up (02.08: "the inner tape
 * circles with the teeth look sort of cheap. Realistically they're not shaped
 * like that").
 *
 * They weren't: the old one was spokes RADIATING OUTWARD from a glowing
 * centre, which reads as an asterisk. A real cassette hub is the opposite —
 * a white plastic ring with a dark spindle hole punched through it, and six
 * square teeth projecting INWARD from the ring into that hole, which is what
 * the deck's spindle grips. The teeth are hub, not gaps.
 */
function ReelHub({ size, color }: { size: number; color: string }) {
  const teeth = [0, 60, 120, 180, 240, 300];
  const HUB = '#eef2fb';
  return (
    <Svg width={size} height={size} viewBox="-24 -24 48 48">
      {/* Clear flange, tinted by the station — the mood colour lives here */}
      <SvgCircle cx={0} cy={0} r={19} fill={color} fillOpacity={0.34} />
      <SvgCircle cx={0} cy={0} r={19} fill="none" stroke="#ffffff" strokeOpacity={0.34} strokeWidth={1} />
      {/* one bright arc so the flange reads as moulded, not printed */}
      <SvgPath d="M -13 -13 A 19 19 0 0 1 6 -18" fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />

      {/* White hub, with its moulding ring */}
      <SvgCircle cx={0} cy={0} r={14.5} fill={HUB} fillOpacity={0.92} />
      <SvgCircle cx={0} cy={0} r={14.5} fill="none" stroke="#05070e" strokeOpacity={0.20} strokeWidth={0.8} />
      <SvgCircle cx={0} cy={0} r={11.6} fill="none" stroke="#05070e" strokeOpacity={0.13} strokeWidth={0.7} />

      {/* The spindle hole, then the teeth standing INTO it */}
      <SvgCircle cx={0} cy={0} r={9.4} fill="#05070e" fillOpacity={0.94} />
      {teeth.map((deg) => (
        <SvgRect
          key={deg}
          x={-1.85} y={-9.9} width={3.7} height={5.4} rx={0.5}
          fill={HUB} fillOpacity={0.94}
          transform={`rotate(${deg})`}
        />
      ))}
      <SvgCircle cx={0} cy={0} r={4.3} fill="#05070e" />
      <SvgCircle cx={0} cy={0} r={9.4} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={0.6} />
    </Svg>
  );
}

// A recessed Phillips screw in neutral steel, each seated at its own angle.
function Screw({ cx, cy, r = 4, angle = 0 }: { cx: number; cy: number; r?: number; angle?: number }) {
  const s = r * 0.6;
  const a = (angle * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return (
    <>
      <SvgCircle cx={cx} cy={cy} r={r + 1.2} fill="#05070e" fillOpacity={0.40} />
      <SvgCircle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.1} />
      <SvgCircle cx={cx} cy={cy} r={r * 0.62} fill="#ffffff" fillOpacity={0.10} />
      <SvgLine x1={cx - s * cos} y1={cy - s * sin} x2={cx + s * cos} y2={cy + s * sin} stroke="#ffffff" strokeOpacity={0.62} strokeWidth={1.2} strokeLinecap="round" />
      <SvgLine x1={cx + s * sin} y1={cy - s * cos} x2={cx - s * sin} y2={cy + s * cos} stroke="#ffffff" strokeOpacity={0.62} strokeWidth={1.2} strokeLinecap="round" />
    </>
  );
}

/**
 * The sheen on the plastic. NEARLY NEUTRAL on purpose (03.08).
 *
 * This was a full rainbow — mint, sky, lilac, pink, peach, yellow — laid out
 * as six diagonal bands 44 apart at -18°. The two reels sit at the same
 * height but 106 apart horizontally, which at that angle is 34 units of
 * vertical shift: almost exactly one band. So each reel sat under a
 * DIFFERENT colour of the rainbow and the wound tape came out two-tone,
 * green on one hub and warm on the other. Measured on Daylight before the
 * fix: R-B of +36 on the left pack against +22 on the right.
 *
 * Same rule the mirror ball settled on: the material may not carry a hue.
 * These are all ~90% white, so the bands still read as light travelling
 * across plastic but no band can recolour what is underneath it. The mood
 * comes from the shell's station tint, which is applied evenly.
 */
const SHEEN = ['#EAF6FF', '#DEEAFF', '#E9E2FF', '#FFEAF7', '#FFF1E4', '#FFFBE9'];

function CassetteBody({
  size, leftSpin, rightSpin, progress,
  color = '#FF3DF0', accent = '#33E1FF',
  songName = 'YOUR SONG NAME', artist = 'CRUISE FM',
}: {
  size: number;
  leftSpin: Animated.AnimatedInterpolation<string>;
  rightSpin: Animated.AnimatedInterpolation<string>;
  playing?: boolean;
  progress?: Animated.Value;
  tapeFlow?: Animated.Value;
  color?: string; accent?: string;
  songName?: string; artist?: string;
}) {
  const scale = size / VB_W;
  const H = size * (VB_H / VB_W);
  const hubPx = 48 * scale;

  const fallbackProgress = useRef(new Animated.Value(0.4)).current;
  const prog = progress ?? fallbackProgress;
  const packBase = PACK_BASE * scale;
  const leftPackScale = prog.interpolate({ inputRange: [0, 1], outputRange: [1, 0.56] });
  const rightPackScale = prog.interpolate({ inputRange: [0, 1], outputRange: [0.56, 0.94] });

  const dust = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    x: 14 + ch01(i * 2.7) * (VB_W - 28),
    y: 14 + ch01(i * 5.9 + 3.1) * (VB_H - 28),
    r: 0.3 + ch01(i * 8.2) * 0.7,
    o: 0.06 + ch01(i * 4.4) * 0.14,
  })), []);
  const winds = useMemo(() => Array.from({ length: 9 }, (_, i) => (PACK_BASE / 2) * (0.42 + 0.065 * i)), []);

  // The wound tape: dark, faintly station-tinted, with fine winding rings.
  const pack = (cx: number, packScale: Animated.AnimatedInterpolation<number>) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: packBase, height: packBase,
        left: cx * scale - packBase / 2, top: RY * scale - packBase / 2,
        transform: [{ scale: packScale }],
      }}
    >
      <Svg width={packBase} height={packBase} viewBox={`0 0 ${PACK_BASE} ${PACK_BASE}`}>
        {/* Wound tape is OPAQUE and always dark brown — you cannot see the
            road through it, and real tape is the same colour whatever is
            playing. The mood arrives as a tint on top, the way the mirror
            ball's chrome works. (This alone did NOT fix the two-tone reels:
            measured before and after, the gap was 13.7 then 14.1. The cause
            was the rainbow SHEEN above — see the note there. Kept because it
            is correct, not because it moved the number.) */}
        <SvgCircle cx={PACK_BASE / 2} cy={PACK_BASE / 2} r={PACK_BASE / 2} fill="#17100a" fillOpacity={0.97} />
        <SvgCircle cx={PACK_BASE / 2} cy={PACK_BASE / 2} r={PACK_BASE / 2} fill={color} fillOpacity={0.10} />
        {winds.map((r, i) => (
          <SvgCircle key={i} cx={PACK_BASE / 2} cy={PACK_BASE / 2} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.075} strokeWidth={0.7} />
        ))}
        <SvgCircle cx={PACK_BASE / 2} cy={PACK_BASE / 2} r={PACK_BASE / 2} fill="none" stroke={color} strokeOpacity={0.42} strokeWidth={1} />
      </Svg>
    </Animated.View>
  );

  return (
    <View style={{ width: size, height: H, alignItems: 'center', justifyContent: 'center' }}>
      {/* ── Behind the tape: shell body, internals, the tape path ── */}
      <Svg width={size} height={H} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="csShell" x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0%" stopColor="#e8eeff" stopOpacity="0.20" />
            <Stop offset="45%" stopColor="#9fb0d4" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#dbe4ff" stopOpacity="0.17" />
          </SvgLinearGradient>
          <ClipPath id="csBody"><SvgRect x={8} y={8} width={324} height={194} rx={10} /></ClipPath>
        </Defs>
        <G clipPath="url(#csBody)">
          <SvgRect x={8} y={8} width={324} height={194} fill="url(#csShell)" />
          {/* internal chassis */}
          <SvgRect x={60} y={30} width={220} height={150} rx={6} fill="none" stroke="#ffffff" strokeOpacity={0.13} strokeWidth={1} />
          <SvgLine x1={171} y1={30} x2={171} y2={180} stroke="#ffffff" strokeOpacity={0.10} strokeWidth={1} />
          {/* tape path — drawn BEFORE the packs so it emerges from under them
              instead of crossing over the wound tape */}
          <SvgPath d={`M ${LX} ${RY} L 74 168 L 268 168 L ${RX} ${RY}`} fill="none" stroke="#0a0c14" strokeOpacity={0.62} strokeWidth={3.4} />
          <SvgLine x1={74} y1={168} x2={268} y2={168} stroke={color} strokeOpacity={0.34} strokeWidth={1} />
        </G>
      </Svg>

      {/* ── The tape itself, breathing with the song ── */}
      {pack(LX, leftPackScale)}
      {pack(RX, rightPackScale)}

      {/* ── Reels ── */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: hubPx, height: hubPx, left: LX * scale - hubPx / 2, top: RY * scale - hubPx / 2, transform: [{ rotate: leftSpin }] }}>
        <ReelHub size={hubPx} color={color} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: hubPx, height: hubPx, left: RX * scale - hubPx / 2, top: RY * scale - hubPx / 2, transform: [{ rotate: rightSpin }] }}>
        <ReelHub size={hubPx} color={color} />
      </Animated.View>

      {/* ── In front of the tape: the shell's own glass. Reflections belong to
             the surface nearest you, so they lie OVER the reels. ── */}
      <Svg width={size} height={H} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {SHEEN.map((hue, i) => (
            <SvgLinearGradient key={i} id={`csIr${i}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={hue} stopOpacity="0" />
              <Stop offset="35%" stopColor={hue} stopOpacity="0.085" />
              <Stop offset="65%" stopColor={SHEEN[(i + 3) % SHEEN.length]} stopOpacity="0.070" />
              <Stop offset="100%" stopColor={SHEEN[(i + 1) % SHEEN.length]} stopOpacity="0" />
            </SvgLinearGradient>
          ))}
          <SvgLinearGradient id="csEdge" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <Stop offset="30%" stopColor="#ffffff" stopOpacity="0.24" />
            <Stop offset="62%" stopColor="#ffffff" stopOpacity="0.62" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.22" />
          </SvgLinearGradient>
          <SvgLinearGradient id="csLabel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.50" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.32" />
          </SvgLinearGradient>
          <ClipPath id="csBody2"><SvgRect x={8} y={8} width={324} height={194} rx={10} /></ClipPath>
        </Defs>
        <G clipPath="url(#csBody2)">
          {/* iridescent sweeps — wide and heavily overlapped so they read as
              light on plastic rather than stripes */}
          {SHEEN.map((_, i) => (
            <SvgRect key={i} x={-60} y={-90 + i * 44} width={460} height={120} fill={`url(#csIr${i})`} transform="rotate(-18 170 105)" />
          ))}
          {/* left tape-guide assembly */}
          <SvgRect x={30} y={120} width={26} height={58} rx={4} fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.26} strokeWidth={1} />
          <SvgCircle cx={43} cy={134} r={4.4} fill="none" stroke="#ffffff" strokeOpacity={0.30} strokeWidth={1} />
          <SvgCircle cx={43} cy={150} r={3} fill="none" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={0.9} />
          <SvgRect x={37} y={160} width={12} height={12} rx={2} fill={color} fillOpacity={0.55} />
          {/* Guide rollers, on their posts */}
          {[74, 268].map((gx) => (
            <G key={`gr${gx}`}>
              <SvgCircle cx={gx} cy={168} r={5.4} fill="#ffffff" fillOpacity={0.05} stroke="#ffffff" strokeOpacity={0.42} strokeWidth={1.2} />
              <SvgCircle cx={gx} cy={168} r={2.6} fill="none" stroke="#ffffff" strokeOpacity={0.30} strokeWidth={0.8} />
              <SvgCircle cx={gx} cy={168} r={0.9} fill="#05070e" fillOpacity={0.6} />
            </G>
          ))}

          {/* ── THE BOTTOM EDGE ──────────────────────────────────────────────
              The end you actually hold, and the busiest part of a real shell
              (owner, 02.08). Head window with the felt pressure pad on its
              leaf spring, two pinch-roller openings with the rollers sitting
              in them, two capstan holes, locating holes either side, and the
              moulded lip running the full width. */}
          <SvgRect x={14} y={195} width={312} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.04} stroke="#ffffff" strokeOpacity={0.20} strokeWidth={0.8} />
          <SvgPath d="M108 180 L232 180 L222 200 L118 200 Z" fill="#ffffff" fillOpacity={0.04} stroke="#ffffff" strokeOpacity={0.32} strokeWidth={1.2} />
          {/* the shield behind the tape, and the tape itself crossing it */}
          <SvgRect x={120} y={183} width={100} height={5} rx={1} fill="#ffffff" fillOpacity={0.07} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={0.6} />
          {/* pressure pad on its leaf spring */}
          <SvgPath d="M158 197 L162 190 L178 190 L182 197" fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={0.8} />
          <SvgRect x={161} y={186} width={18} height={6} rx={1.4} fill="#05070e" fillOpacity={0.72} stroke="#ffffff" strokeOpacity={0.24} strokeWidth={0.7} />
          {/* pinch-roller openings, with the rollers in them */}
          {[[143, 1], [193, -1]].map(([px]) => (
            <G key={`pr${px}`}>
              <SvgRect x={px - 7.5} y={184} width={15} height={13} rx={3} fill="#05070e" fillOpacity={0.42} stroke="#ffffff" strokeOpacity={0.30} strokeWidth={1} />
              <SvgCircle cx={px} cy={190.5} r={4.4} fill="#ffffff" fillOpacity={0.06} stroke="#ffffff" strokeOpacity={0.34} strokeWidth={0.9} />
              <SvgCircle cx={px} cy={190.5} r={1.5} fill="#05070e" fillOpacity={0.7} />
            </G>
          ))}
          {/* capstan holes */}
          {[128, 208].map((cxx) => (
            <G key={`cp${cxx}`}>
              <SvgCircle cx={cxx} cy={190} r={4} fill="#05070e" fillOpacity={0.55} stroke="#ffffff" strokeOpacity={0.36} strokeWidth={1} />
              <SvgCircle cx={cxx} cy={190} r={1.7} fill="none" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={0.6} />
            </G>
          ))}
          {/* locating holes either side of the window */}
          <SvgCircle cx={92} cy={191} r={2.6} fill="#05070e" fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.30} strokeWidth={0.8} />
          <SvgCircle cx={248} cy={191} r={2.6} fill="#05070e" fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.30} strokeWidth={0.8} />
          {/* chamfer catching the light along the very bottom */}
          <SvgPath d="M20 199.5 L320 199.5" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={0.8} />
          {/* label — frosted, with the station colour as its spine */}
          <SvgRect x={30} y={24} width={280} height={40} rx={4} fill="url(#csLabel)" />
          <SvgRect x={30} y={24} width={280} height={13} rx={4} fill={color} fillOpacity={0.60} />
          <SvgRect x={30} y={24} width={280} height={40} rx={4} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1} />
          <SvgText x={40} y={34} fill="#0d1020" fontSize={7} fontWeight="800" fontFamily={Fonts.mono} letterSpacing={1.6}>A · STEREO · C90</SvgText>
          <SvgText x={40} y={52} fill="#0d1020" fontSize={11} fontWeight="800" fontFamily={Fonts.mono}>
            {songName.length > 22 ? songName.slice(0, 21) + '…' : songName}
          </SvgText>
          <SvgText x={300} y={60} fill="#0d1020" fillOpacity={0.66} fontSize={7} fontWeight="700" fontFamily={Fonts.mono} textAnchor="end">{artist}</SvgText>
          {/* embossed markings + running time */}
          {/* No counter on the tape. A real cassette hasn't got one — the
              counter lives on the DECK — so a big digital readout floating on
              the shell was the one element that read as app-on-object rather
              than object. It also printed straight over this line, and said
              exactly what the elapsed time under the seek bar already says
              (owner, 03.08). */}
          <SvgText x={300} y={176} fill="#ffffff" fillOpacity={0.20} fontSize={5} fontFamily={Fonts.mono} textAnchor="end">CR-02 · HIGH BIAS · MADE FOR THE ROAD</SvgText>
          {/* broad glass reflections across the whole face */}
          <SvgPath d="M 20 8 L 96 8 L 40 202 L 8 202 Z" fill="#ffffff" fillOpacity={0.045} />
          <SvgPath d="M 250 8 L 282 8 L 214 202 L 190 202 Z" fill="#ffffff" fillOpacity={0.025} />
          {dust.map((d, i) => <SvgCircle key={i} cx={d.x} cy={d.y} r={d.r} fill="#ffffff" fillOpacity={d.o} />)}
        </G>
        {/* moulded edge: lit outer, dark behind, faint inner */}
        <SvgRect x={8} y={8} width={324} height={194} rx={10} fill="none" stroke="url(#csEdge)" strokeWidth={2.4} />
        <SvgRect x={11} y={11} width={318} height={188} rx={8} fill="none" stroke="#05070e" strokeOpacity={0.45} strokeWidth={1.2} />
        <SvgRect x={13.5} y={13.5} width={313} height={183} rx={7} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={0.9} />
        <Screw cx={26} cy={24} angle={12} />
        <Screw cx={314} cy={24} angle={-31} />
        <Screw cx={26} cy={186} angle={57} />
        <Screw cx={314} cy={186} angle={-8} />
        <Screw cx={170} cy={16} r={2.8} angle={40} />
      </Svg>
    </View>
  );
}

// ── Amber progress bar (Spotify-style) ───────────────────────────────────────
function AmberProgressBar({ progress }: { progress: Animated.Value }) {
  const [barW, setBarW] = useState(260);
  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });
  const DOT = 14;
  return (
    <View
      style={{ width: '100%', height: 36, justifyContent: 'center' }}
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <Animated.View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, width: fillW, backgroundColor: '#ffffff' }}>
        <View style={{
          position: 'absolute', right: -DOT / 2, top: -(DOT / 2 - 3),
          width: DOT, height: DOT, borderRadius: DOT / 2,
          backgroundColor: '#ffffff',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }} />
      </Animated.View>
    </View>
  );
}

// ── Retro control button ──────────────────────────────────────────────────────
function RetroBtn({ onPress, size = 56, children, primary = false }: {
  onPress: () => void; size?: number; children: React.ReactNode; primary?: boolean;
}) {
  const pressed = useRef(new Animated.Value(0)).current;
  const onIn  = () => Animated.timing(pressed, { toValue: 1, duration: 60,  useNativeDriver: true }).start();
  const onOut = () => Animated.timing(pressed, { toValue: 0, duration: 100, useNativeDriver: true }).start();
  const translateY = pressed.interpolate({ inputRange: [0, 1], outputRange: [0, 2] });
  const shadowOp   = pressed.interpolate({ inputRange: [0, 1], outputRange: [primary ? 0.8 : 0.4, 0.1] });
  return (
    <TouchableOpacity onPressIn={onIn} onPressOut={onOut} onPress={onPress} activeOpacity={1}>
      <Animated.View style={[rb.btn, primary ? rb.primary : rb.secondary, { width: size, height: size, borderRadius: size * 0.2, transform: [{ translateY }] }]}>
        <Animated.View style={[rb.shadow, { width: size, height: size * 0.12, borderRadius: size * 0.2, bottom: -(size * 0.07), opacity: shadowOp }]} />
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
const rb = StyleSheet.create({
  btn:     { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6 },
  primary: { backgroundColor: '#CC2200', borderColor: '#FF4422', shadowColor: '#CC2200' },
  secondary: { backgroundColor: '#2A1A08', borderColor: C.brown, shadowColor: '#000' },
  shadow:  { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)' },
});

// ── Full-screen component ─────────────────────────────────────────────────────
export function CassetteFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
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
  const [activeId,    setActiveId]    = useState(stationId ?? 'night-run');
  const [activeTrack, setActiveTrack] = useState(1);   // A2 default (index 1)
  const [platform,    setPlatform]    = useState<{ id: PlatformId; name: string; color: string } | null>(null);
  const [shuffle,     setShuffle]     = useState(false);
  const [repeat,      setRepeat]      = useState(false);
  const [elapsedTxt,  setElapsedTxt]  = useState('00:00');
  const [showMood,    setShowMood]    = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [linked,      setLinked]      = useState<LinkedPlaylist | null>(null);
  const playBtnScale = useRef(new Animated.Value(1)).current;

  // ── Animated values ─────────────────────────────────────────────────────────
  const leftReelAnim  = useRef(new Animated.Value(0)).current;
  const rightReelAnim = useRef(new Animated.Value(0)).current;
  const progress      = useRef(new Animated.Value(0)).current;
  const slideY        = useRef(new Animated.Value(SCREEN_H)).current;
  const glowPulse     = useRef(new Animated.Value(0)).current;
  const tapeFlow      = useRef(new Animated.Value(0)).current;

  // ── Loop refs ───────────────────────────────────────────────────────────────
  const leftLoopRef     = useRef<any>(null);
  const rightLoopRef    = useRef<any>(null);
  const pulseLoop       = useRef<Animated.CompositeAnimation | null>(null);
  const tapeFlowLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Reel spin interpolations ──────────────────────────────────────────────
  const leftSpin  = leftReelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rightSpin = rightReelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const startRolling = () => {
    leftReelAnim.setValue(0);
    rightReelAnim.setValue(0);
    // Real transport physics: the take-up reel (right) starts near-empty, so
    // it spins faster than the fat supply reel.
    leftLoopRef.current = Animated.loop(
      Animated.timing(leftReelAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    rightLoopRef.current = Animated.loop(
      Animated.timing(rightReelAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    );
    leftLoopRef.current.start();
    rightLoopRef.current.start();
  };
  const stopRolling = () => {
    leftLoopRef.current?.stop();
    rightLoopRef.current?.stop();
  };

  useEffect(() => {
    if (playing) {
      startRolling();
    } else {
      stopRolling();
    }
    return () => stopRolling();
  }, [playing]);

  // Ref shadows so startReels/stopReels always read latest values without stale closures
  const progressValue   = useRef(0);
  const activeTrackRef  = useRef(activeTrack);

  // ── Real-track layer — same contract as VinylMode: true duration from
  // Spotify when connected, position re-synced from every poll; the demo
  // tape below runs unchanged otherwise. ─────────────────────────────────────
  const realMs = spotify.track?.durationMs ?? null;
  const trackMs = realMs ?? parseTrackMs(SIDE_A_TRACKS[activeTrack].duration);
  const trackMsRef = useRef(trackMs);
  trackMsRef.current = trackMs;
  const realTrackRef = useRef(false);
  realTrackRef.current = realMs != null;

  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValue.current = value; });
    return () => progress.removeListener(id);
  }, []);

  // Ticking cassette counter — update only when the whole second changes.
  const lastSecRef = useRef(-1);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      const s = Math.floor((value * trackMsRef.current) / 1000);
      if (s !== lastSecRef.current) {
        lastSecRef.current = s;
        setElapsedTxt(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
      }
    });
    return () => progress.removeListener(id);
  }, []);

  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);

  const station      = resolveAnyStation(activeId);

  // ── Start secondary animations (tape flow, glow, progress) ──────────────────
  const startReels = () => {
    tapeFlow.setValue(0);
    tapeFlowLoop.current = Animated.loop(
      Animated.timing(tapeFlow, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true })
    );
    tapeFlowLoop.current.start();

    const remaining = (1 - progressValue.current) * trackMsRef.current;
    progressAnimRef.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    progressAnimRef.current.start(({ finished }) => {
      // Demo tape advances itself; a real track ends on Spotify's side and
      // the next poll re-syncs us onto whatever plays next.
      if (finished && !realTrackRef.current) {
        setActiveTrack((t) => {
          const next = Math.min(SIDE_A_TRACKS.length - 1, t + 1);
          if (next === t) setPlaying(false);
          return next;
        });
      }
    });
  };

  const stopReels = () => {
    tapeFlowLoop.current?.stop();
    progressAnimRef.current?.stop();

    tapeFlow.stopAnimation();
  };

  useEffect(() => {
    if (playing) { startReels(); } else { stopReels(); }
    return () => stopReels();
  }, [playing]);

  // ── Reset progress when track changes (demo tape only) ─────────────────────
  useEffect(() => {
    if (realTrackRef.current) return;
    progressAnimRef.current?.stop();
    progress.setValue(0);
    progressValue.current = 0;
    if (playing) {
      const demoMs = parseTrackMs(SIDE_A_TRACKS[activeTrack].duration);
      progressAnimRef.current = Animated.timing(progress, {
        toValue: 1, duration: demoMs, easing: Easing.linear, useNativeDriver: false,
      });
      progressAnimRef.current.start(({ finished }) => {
        if (finished && !realTrackRef.current) {
          setActiveTrack((t) => {
            const next = Math.min(SIDE_A_TRACKS.length - 1, t + 1);
            if (next === t) setPlaying(false);
            return next;
          });
        }
      });
    }
  }, [activeTrack]);

  // Follow the real song: on every poll (and after skips) snap the tape to
  // Spotify's reported position.
  useEffect(() => {
    const t = spotify.track;
    if (!visible || !t || t.progressMs == null || t.durationMs == null || t.durationMs <= 0) return;
    const base = Math.min(t.durationMs, t.progressMs + (playing ? Date.now() - t.syncedAt : 0));
    progressAnimRef.current?.stop();
    const pct = base / t.durationMs;
    progress.setValue(pct);
    progressValue.current = pct;
    if (playing) {
      const remaining = t.durationMs - base;
      if (remaining > 0) {
        progressAnimRef.current = Animated.timing(progress, {
          toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
        });
        progressAnimRef.current.start();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, playing, spotify.track?.progressMs, spotify.track?.syncedAt, spotify.track?.title]);

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') {
        const p = PLATFORMS[id as Exclude<PlatformId, 'none'>];
        if (p) setPlatform({ id: id as PlatformId, name: p.name, color: p.color });
      } else { setPlatform(null); }
    });
    slideY.setValue(winH);
    // Play state belongs to the session — a Modes-tab browse opens paused.
    progress.setValue(0);
    progressValue.current = 0;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    // Re-opening from the mini-player: the reel loops die while the modal is
    // hidden, and `playing` hasn't changed so the [playing] effects never
    // rekick them — restart everything explicitly if music is going.
    if (playing) {
      stopRolling(); stopReels();
      startRolling(); startReels();
    }
    return () => { stopReels(); };
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

  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
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


  useEffect(() => {
    if (visible) getStationPlaylist(activeId).then(setLinked);
  }, [visible, activeId]);


  const togglePlay = () => {
    if (playing) spotify.pause(); else spotify.play();
    setPlaying(!playing);
  };

  // Drag-to-seek adapter for the cassette's own progress animation — freeze
  // the tape while scrubbing, seek the real song on release, then let the
  // timing (and the next poll) carry on from there.
  const cassetteScrub = {
    begin: () => progressAnimRef.current?.stop(),
    move: (pct: number) => { progress.setValue(pct); progressValue.current = pct; },
    end: (pct: number) => {
      progressValue.current = pct;
      if (realTrackRef.current) seekTo(pct * trackMsRef.current).catch(() => {});
      const remaining = (1 - pct) * trackMsRef.current;
      if (playing && remaining > 0) {
        progressAnimRef.current = Animated.timing(progress, {
          toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
        });
        progressAnimRef.current.start();
      }
    },
  };

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    active: visible && isLandscape, playing, sheetOpen: showMood || showPicker,
  });
  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  // Glow: 0.3 → 0.6 range, gentle amber pulse

  const topPad    = Math.max(insets.top, 20);
  const bottomPad = Math.max(insets.bottom, 24) + 24;
  // Landscape: the shell is the whole show — winH*0.72 was the OLD branch's
  // side-column size and reads small alone on a full screen.
  // Landscape had room left over: the deck docks at 0.86 scale beside the
  // panel, so 1.30/0.60 was leaving a band of empty table on both sides.
  const cassetteW = isLandscape ? Math.min(winH * 1.46, winW * 0.66) : winW * 0.92;
  const cassetteH = cassetteW * 0.62;


  const stationImg = resolveAnyStation(activeId).image;

  // Plain JSX, not an inline component — an inline component remounts the
  // blurred image on every render (background twitching).
  const currentEq = resolveAnyStation(activeId).eqColors;
  // The shell wears the station's ACCENT stop (eq[1]) — the same slot the
  // mini-player edge and glow bands use — not the last stop. The last stop
  // put Sunset's cassette in hot pink when everything else about that
  // station is orange (owner, 30.07); the middle stop is where each
  // station's app-wide accent lives.
  const neonColor  = currentEq?.[1] ?? '#FF3DF0';
  const neonAccent = currentEq?.[0] ?? '#33E1FF';
  const background = (
    <>
      <StationBackdrop station={resolveAnyStation(activeId)} blurRadius={2.5} />
      <LinearGradient
        colors={[
          'rgba(2,2,10,0.55)',
          'rgba(2,2,10,0.48)',
          'rgba(2,2,10,0.60)',
          'rgba(2,2,10,0.72)',
          'rgba(2,2,10,0.82)',
        ]}
        locations={[0, 0.4, 0.65, 0.85, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', (currentEq?.[1] ?? '#C8860A') + '26', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.40, bottom: 0 }}
        pointerEvents="none"
      />
    </>
  );

  // ── Landscape — the owner's L1+L3 grammar (30.07) ──────────────────────────
  // The cassette alone on the full-bleed scene, the shared chrome along the
  // bottom, everything fading out mid-drive. This REPLACES the original
  // early-development landscape (two columns, a FAKE track list, a
  // Play-on-Spotify button) which predated every shared piece and every
  // honesty rule — it shipped by accident the day rotation unlocked.
  if (isLandscape) {
    return (
      <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent>
        <Animated.View
          style={[fs.container, { backgroundColor: C.bg, transform: [{ translateY: slideY }] }]}
          {...dismissPan.panHandlers}
          onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>
          {background}
          <GrainOverlay />

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={deckScene}>
            <CassetteBody size={cassetteW} leftSpin={leftSpin} rightSpin={rightSpin} progress={progress} color={neonColor} accent={neonAccent} songName={spotify.track?.title ?? station.name} artist={spotify.track?.artist ?? 'CRUISE FM'} />
            </Animated.View>
          </View>

          <LandscapeChrome
            chrome={chrome}
            rested={chromeRested}
            station={station}
            track={spotify.track}
            playing={playing}
            tagline={station.tagline}
            progress={progress}
            scrub={cassetteScrub}
            onPlayPause={togglePlay}
            onPrev={() => setActiveTrack((t) => Math.max(0, t - 1))}
            onNext={() => setActiveTrack((t) => Math.min(SIDE_A_TRACKS.length - 1, t + 1))}
            onClose={handleClose}
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
          />

          <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} hero={false} color={currentEq?.[1] ?? C.amber} />
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

  // ── Portrait ───────────────────────────────────────────────────────────────
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[fs.container, { backgroundColor: C.bg, transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>
        {background}
        <GrainOverlay />

        {/* Top vignette */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent']}
          style={[StyleSheet.absoluteFill, { height: SCREEN_H * 0.2, zIndex: 1 }]}
          pointerEvents="none"
        />

        {/* Floating chrome */}
        <View style={[fs.floatingTop, { top: topPad + 8, zIndex: 10 }]}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Mode name — top-left corner tag, same treatment as every other mode */}
        <View style={{ position: 'absolute', top: topPad + 14, left: 20, zIndex: 10 }} pointerEvents="none">
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 3, fontFamily: Fonts.mono }}>CASSETTE</Text>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: bottomPad }}>

          {/* Header — small top-center, Spotify style */}
          <View style={fs.header}>
            <StationIdentity station={station} />
          </View>

          {/* Cassette hero — flex:1 so it grows to fill available space */}
          <View style={[fs.cassetteWrap, { flex: 1 }]}>
            {/* Notes BEHIND the shell. Drawn after it they landed on the
                plastic — between the reels, on the top edge — and on a
                physical object that reads as dirt rather than atmosphere. */}
            <FloatingNotes playing={playing} color={neonColor} />
            <TouchableOpacity onPress={togglePlay} activeOpacity={0.92}>
              <CassetteBody size={cassetteW} leftSpin={leftSpin} rightSpin={rightSpin} progress={progress} color={neonColor} accent={neonAccent} songName={spotify.track?.title ?? station.name} artist={spotify.track?.artist ?? 'CRUISE FM'} />
            </TouchableOpacity>
          </View>

          {/* Song title when connected, else the mood's own line — never a fake track */}
          <View style={fs.trackBlock}>
            {spotify.track
              ? <MarqueeText text={spotify.track.title} style={fs.trackTitle} />
              : <Text style={[fs.trackTitle, { fontSize: 20 }]} numberOfLines={2}>{station.tagline}</Text>}
            {spotify.track && <Text style={fs.trackArtist} numberOfLines={1}>{spotify.track.artist}</Text>}
          </View>

          {/* Tape progress — only when a real song is playing through */}
          {spotify.track && (
          <View style={fs.progressWrap}>
            <SeekBar progress={progress} scrub={cassetteScrub} />
            <View style={fs.timesBelow}>
              <Text style={fs.timeText}>{elapsedTxt}</Text>
              <Text style={fs.timeText}>{fmtTapeMs(trackMs)}</Text>
            </View>
          </View>
          )}

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity
              onPress={() => { const ns = !shuffle; setShuffle(ns); if (spotify.connected) spotify.shuffle(ns); }}
              style={fs.shuffleRepeatBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={26} color={shuffle ? (currentEq?.[1] ?? '#C8860A') : '#ffffff'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setActiveTrack((t) => Math.max(0, t - 1)); spotify.prev(); }}
              style={fs.skipBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-previous" size={48} color="#fff" />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <TouchableOpacity
                onPress={togglePlay}
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

            <TouchableOpacity
              onPress={() => { setActiveTrack((t) => Math.min(SIDE_A_TRACKS.length - 1, t + 1)); spotify.next(); }}
              style={fs.skipBtn} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-next" size={48} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { const nr = !repeat; setRepeat(nr); if (spotify.connected) spotify.repeat(nr ? 'track' : 'off'); }}
              style={fs.shuffleRepeatBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat ? 'repeat-once' : 'repeat'} size={26} color={repeat ? (currentEq?.[1] ?? '#C8860A') : '#ffffff'} />
            </TouchableOpacity>
          </View>

          {/* Left-aligned action pills — keeps the tape the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={station}
          />

        </View>

        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} hero={false} color={currentEq?.[1] ?? C.amber} />
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

// ── Card preview ──────────────────────────────────────────────────────────────
export function CassettePreview() {
  const leftReelAnim  = useRef(new Animated.Value(0)).current;
  const rightReelAnim = useRef(new Animated.Value(0)).current;
  const leftLoopRef   = useRef<any>(null);
  const rightLoopRef  = useRef<any>(null);
  const progress = useRef(new Animated.Value(0.22)).current;
  const tapeFlow = useRef(new Animated.Value(0)).current;
  const [active, setActive]       = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const leftSpin  = leftReelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rightSpin = rightReelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const startRolling = () => {
    leftReelAnim.setValue(0);
    rightReelAnim.setValue(0);
    // Real transport physics: the take-up reel (right) starts near-empty, so
    // it spins faster than the fat supply reel.
    leftLoopRef.current = Animated.loop(
      Animated.timing(leftReelAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    rightLoopRef.current = Animated.loop(
      Animated.timing(rightReelAnim, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })
    );
    leftLoopRef.current.start();
    rightLoopRef.current.start();
  };
  const stopRolling = () => {
    leftLoopRef.current?.stop();
    rightLoopRef.current?.stop();
  };

  // Idle spin always running in preview
  useEffect(() => {
    leftLoopRef.current = Animated.loop(
      Animated.timing(leftReelAnim, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })
    );
    rightLoopRef.current = Animated.loop(
      Animated.timing(rightReelAnim, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    leftLoopRef.current.start();
    rightLoopRef.current.start();
    return () => { leftLoopRef.current?.stop(); rightLoopRef.current?.stop(); };
  }, []);

  const handleOpen  = () => { stopRolling(); setActive(false); setModalOpen(true); };
  const handleClose = () => { setModalOpen(false); };

  return (
    <View style={pv.shell}>
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.9} style={pv.scene}>
        <LinearGradient colors={['#0c0c16', '#0a0a12', '#060609']} style={StyleSheet.absoluteFill} />
        <View style={pv.glow} />
        <View style={pv.tapHint}>
          <Ionicons name="play" size={9} color={C.textFaint} />
          <Text style={[pv.tapHintText, { fontFamily: Fonts.mono }]}>tap to open</Text>
        </View>
        <CassetteBody size={275} leftSpin={leftSpin} rightSpin={rightSpin} color="#FF3DF0" accent="#33E1FF" songName="YOUR SONG NAME" artist="CRUISE FM" />
        {OWNER_MODE && (
          <View style={pv.devBadge} pointerEvents="none">
            <Text style={pv.devBadgeText}>DEV</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={pv.bottomSection}>
        <View style={pv.footer}>
          <View style={pv.titleRow}>
            <Text style={pv.title}>Cassette Mode</Text>
            <View style={pv.badge}><Text style={pv.badgeText}>PREMIUM</Text></View>
          </View>
          <Text style={pv.sub}>Transparent neon. Reels spin. Glows to your mood.</Text>
        </View>
        {!OWNER_MODE && (
          <View style={[pv.unlockBtn, { marginTop: 'auto' }]}>
            <Ionicons name="lock-closed" size={14} color={C.amber} />
            <Text style={pv.unlockText}>Unlock Premium</Text>
          </View>
        )}
      </View>
      <CassetteFullscreen visible={modalOpen} onClose={handleClose} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { flex: 1 },
  scrollContent: { alignItems: 'center' },

  floatingTop: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 22 },
  closeBtn: {
    position: 'absolute',
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(240,222,176,0.08)',
    borderWidth: 1, borderColor: 'rgba(240,222,176,0.12)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },

  header:        { alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 14 },
  headerEyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  headerStation: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  trackBlock:  { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 4, alignItems: 'flex-start' },
  trackTitle:  { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  trackArtist: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 },

  cassetteWrap: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  glowOrb:     { position: 'absolute', alignSelf: 'center' },

  playlistBtn: {
    marginTop: 20, marginHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  playlistBtnText: { color: C.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 2.5 },

  playlistSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#111111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: '#222', paddingTop: 12, paddingBottom: 36,
  },
  sheetHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { color: C.amber, fontSize: 9, fontWeight: '700', letterSpacing: 3, paddingHorizontal: 22, marginBottom: 4 },
  sheetSubLabel: { color: C.textFaint, fontSize: 8, fontWeight: '700', letterSpacing: 3, marginBottom: 2 },
  stationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, height: 44,
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
  },
  stationPillActive: { borderColor: '#ffffff' },
  stationPillIcon: { fontSize: 14 },
  stationPillText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', maxWidth: 80 },
  sheetPlatformRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 22, marginTop: 16, paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16,
  },
  sheetPlatformEmoji: { fontSize: 16 },
  sheetPlatformText: { flex: 1, fontSize: 13, fontWeight: '600' },

  progressWrap: { width: '100%', paddingHorizontal: 28, marginTop: 22, marginBottom: 0 },
  timesBelow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText:     { color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  controls:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 28, marginTop: 10, marginBottom: 8, paddingVertical: 4 },
  shuffleRepeatBtn:{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipBtn:         { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  playBtn:         { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14 },
  pauseBar:        { width: 8, height: 30, borderRadius: 2, backgroundColor: '#0a0a12' },

  // Section wrapper — adds consistent vertical rhythm
  section: { width: '100%', alignSelf: 'stretch', marginTop: 24 },

  footer:  { width: '100%', alignItems: 'center', paddingHorizontal: 28, marginTop: 20, paddingBottom: 8 },
  tagline: { color: C.textFaint, fontSize: 13, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
});

const ls = StyleSheet.create({
  leftCol:  { paddingRight: 12, paddingTop: 16 },
  rightCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nowPlaying: { color: C.amber, fontSize: 9, fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 3 },
  lsStation:  { color: C.cream, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  lsTrack:    { color: C.textDim, fontSize: 11, marginBottom: 0 },
  ctrlRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  lsSkipBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a0f00', borderWidth: 1.5, borderColor: '#C8860A', alignItems: 'center', justifyContent: 'center' },
  lsPlayBtn:  { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
  progressRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniTrack:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 6 },
  miniTrackActive: { backgroundColor: 'rgba(232,150,10,0.08)', marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 5 },
  miniNum:    { color: C.textFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, width: 20 },
  miniTitle:  { flex: 1, color: C.textDim, fontSize: 11, fontWeight: '600' },
  miniDur:    { color: C.textFaint, fontSize: 9 },
});

const pv = StyleSheet.create({
  shell: {
    backgroundColor: '#1a0f00', borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(200,134,10,0.50)',
    overflow: 'hidden',
    shadowColor: '#C8860A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  scene:         { height: 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bottomSection: { minHeight: 160 },
  glow:  { position: 'absolute', width: 240, height: 130, borderRadius: 120, backgroundColor: 'rgba(255,61,240,0.16)' },
  tapHint: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(240,222,176,0.07)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  tapHintText: { color: C.textFaint, fontSize: 9, fontWeight: '600' },
  footer:   { padding: 16, paddingBottom: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { color: '#E8D5A3', fontSize: 17, fontWeight: '700' },
  sub:      { color: 'rgba(200,134,10,0.85)', fontSize: 13, lineHeight: 18 },
  badge: {
    backgroundColor: 'rgba(200,134,10,0.18)', borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(200,134,10,0.50)',
  },
  badgeText: { color: '#C8860A', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  devBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(16,185,129,0.85)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    zIndex: 10,
  },
  devBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  unlockBtn: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(204,102,0,0.2)', borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderColor: 'rgba(204,102,0,0.35)',
  },
  unlockText: { color: C.amber, fontSize: 14, fontWeight: '600' },
});
