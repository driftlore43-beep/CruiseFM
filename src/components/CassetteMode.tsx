import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, ImageBackground, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { OWNER_MODE } from '@/constants/config';
import { STATIONS } from '@/constants/stations';
import { PLATFORMS, PlatformId, getSavedPlatform, openMusicPlatform } from '@/utils/musicPlatform';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

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

// ── Grain overlay ─────────────────────────────────────────────────────────────
// Simulated film grain: a grid of tiny dots at random-but-stable positions
function GrainOverlay() {
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
        left:    (h1 - Math.floor(h1)) * SCREEN_W,
        top:     (h2 - Math.floor(h2)) * SCREEN_H,
        opacity: (h3 - Math.floor(h3)) * 0.04 + 0.01,
        size:    (h4 - Math.floor(h4)) * 1.5 + 0.5,
      });
    }
    return result;
  }, []);

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
              <Text style={ss.pillIcon}>{s.icon}</Text>
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
  platform: { name: string; color: string; emoji: string } | null;
  onPress: () => void;
}) {
  if (!platform) return null;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={pb.btn}>
      {/* Aged border effect — outer ring slightly lighter */}
      <View style={[StyleSheet.absoluteFill, pb.aged]} pointerEvents="none" />
      <Text style={pb.emoji}>{platform.emoji}</Text>
      <Text style={[pb.text, { fontFamily: Fonts.mono }]}>
        ▶  Play on {platform.name}
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
function Reel({ size }: { size: number }) {
  const hubR   = size * 0.18;
  const innerR = hubR + size * 0.025;
  const outerR = size * 0.43;
  const spokeL = outerR - innerR;
  const spokeW = Math.max(3, size * 0.08);   // thick, clearly visible
  // Each spoke's own center is (outerR + innerR)/2 above the reel center.
  // Rotating around reel center = translateY by that offset, rotate, translate back.
  const pivotY = (outerR + innerR) / 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Outer disc */}
      <View style={[sr.reelOuter, { width: size, height: size, borderRadius: size / 2, borderColor: C.reelMid }]} />
      {/* Groove ring */}
      <View style={[StyleSheet.absoluteFill, sr.centered]}>
        <View style={{ width: size * 0.86, height: size * 0.86, borderRadius: size * 0.43, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', position: 'absolute' }} />
      </View>
      {/* 3 spokes at 120° — amber, thick, obvious */}
      {[0, 120, 240].map((deg) => (
        <View key={deg} style={{
          position: 'absolute',
          width: spokeW,
          height: spokeL,
          left: (size - spokeW) / 2,
          top: size / 2 - outerR,
          backgroundColor: '#C8860A',
          borderRadius: spokeW / 2,
          transform: [
            { translateY: pivotY },
            { rotate: `${deg}deg` },
            { translateY: -pivotY },
          ],
        }} />
      ))}
      {/* Hub */}
      <View style={[StyleSheet.absoluteFill, sr.centered]}>
        <View style={{ width: hubR * 2 + size * 0.1, height: hubR * 2 + size * 0.1, borderRadius: hubR + size * 0.05, backgroundColor: C.reelDark, borderWidth: 1.5, borderColor: C.hub, position: 'absolute' }} />
        <View style={{ width: hubR * 1.4, height: hubR * 1.4, borderRadius: hubR * 0.7, backgroundColor: C.hub, position: 'absolute' }} />
        <View style={{ width: hubR * 0.55, height: hubR * 0.55, borderRadius: hubR * 0.275, backgroundColor: C.hubLight, position: 'absolute' }} />
      </View>
    </View>
  );
}
const sr = StyleSheet.create({
  reelOuter: { backgroundColor: C.reelDark, borderWidth: 1.5 },
  centered:  { alignItems: 'center', justifyContent: 'center' },
});

// ── Animated tape line — moving dots simulate tape feeding left ───────────────
const TAPE_DOT_SPACING = 13;
const TAPE_DOT_W = 3;
const TAPE_DOT_COUNT = 14; // enough to fill any width + bleed off edges

function AnimatedTapeLine({
  tapeFlow,
  playing,
}: {
  tapeFlow: Animated.Value;
  playing: boolean;
}) {
  // tapeFlow 0→1: dots shift left by one spacing, then loop
  const translateX = tapeFlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -TAPE_DOT_SPACING],
  });

  return (
    <View style={atl.track}>
      {/* Tape base */}
      <View style={atl.base} />
      {/* Moving highlight dots (tape feed illusion) */}
      {playing && (
        <Animated.View style={[atl.dotRow, { transform: [{ translateX }] }]}>
          {Array.from({ length: TAPE_DOT_COUNT }, (_, i) => (
            <View key={i} style={atl.dot} />
          ))}
        </Animated.View>
      )}
    </View>
  );
}
const atl = StyleSheet.create({
  track:  { flex: 1, height: 3, overflow: 'hidden', justifyContent: 'center' },
  base:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.tape, borderRadius: 1.5 },
  dotRow: { position: 'absolute', flexDirection: 'row', left: -TAPE_DOT_SPACING },
  dot: {
    width: TAPE_DOT_W, height: TAPE_DOT_W, borderRadius: TAPE_DOT_W / 2,
    backgroundColor: C.tapeLight,
    opacity: 0.75,
    marginRight: TAPE_DOT_SPACING - TAPE_DOT_W,
  },
});

// ── Cassette body ─────────────────────────────────────────────────────────────
function CassetteBody({
  size, leftSpin, rightSpin, playing, progress, tapeFlow,
}: {
  size: number;
  leftSpin: Animated.AnimatedInterpolation<string>;
  rightSpin: Animated.AnimatedInterpolation<string>;
  playing: boolean; progress: Animated.Value;
  tapeFlow: Animated.Value;
}) {
  const W = size;
  const H = size * 0.62;
  // Ensure reels are at least 80px so spin is clearly visible
  const reelSize = Math.max(80, W * 0.29);
  const leftScale  = progress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] });
  const rightScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.12, 0.88] });

  return (
    <View style={[cb.body, { width: W, height: H, borderRadius: W * 0.04 }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: W * 0.04, backgroundColor: C.body }]} />
      <View style={[cb.stripe, { height: H * 0.07, backgroundColor: C.stripeThin, top: 0, borderTopLeftRadius: W * 0.04, borderTopRightRadius: W * 0.04 }]} />
      <View style={[cb.stripe, { height: H * 0.18, backgroundColor: C.stripe, top: H * 0.07 }]} />
      <View style={[cb.stripe, { height: H * 0.05, backgroundColor: C.stripeThin, top: H * 0.25 }]} />
      <View style={[cb.labelArea, { top: H * 0.05, left: W * 0.1, right: W * 0.1, height: H * 0.26, borderRadius: W * 0.015 }]}>
        <Text style={[cb.labelTitle, { fontFamily: Fonts.mono, fontSize: W * 0.065 }]}>CRUISE FM</Text>
        <View style={cb.labelLine} />
        <Text style={[cb.labelSide, { fontFamily: Fonts.mono, fontSize: W * 0.038 }]}>SIDE A</Text>
      </View>
      <View style={[cb.window, { top: H * 0.33, left: W * 0.06, right: W * 0.06, height: H * 0.46, borderRadius: W * 0.025 }]}>
        <View style={[cb.tapeSpan, { top: '62%' }]}>
          <View style={[cb.guidePin, { width: W * 0.025, height: W * 0.025, borderRadius: W * 0.0125 }]} />
          <AnimatedTapeLine tapeFlow={tapeFlow} playing={playing} />
          <View style={[cb.guidePin, { width: W * 0.025, height: W * 0.025, borderRadius: W * 0.0125 }]} />
        </View>
        <View style={[StyleSheet.absoluteFill, cb.reelRow]}>
          <Animated.View style={{ transform: [{ rotate: leftSpin }, { scale: leftScale as any }] }}>
            <Reel size={reelSize} />
          </Animated.View>
          <Animated.View style={{ transform: [{ rotate: rightSpin }, { scale: rightScale as any }] }}>
            <Reel size={reelSize} />
          </Animated.View>
        </View>
      </View>
      <View style={[cb.bottomRow, { bottom: H * 0.04 }]}>
        <View style={[cb.hole, { width: W * 0.038, height: W * 0.038, borderRadius: W * 0.019 }]} />
        <Text style={[cb.bottomText, { fontFamily: Fonts.mono, fontSize: W * 0.032 }]}>TYPE II · 90 MIN</Text>
        <View style={[cb.hole, { width: W * 0.038, height: W * 0.038, borderRadius: W * 0.019 }]} />
      </View>
      {[0.15, 0.85].map((x) => (
        <View key={x} style={[cb.punchHole, { left: W * x - W * 0.02, bottom: H * 0.15, width: W * 0.04, height: W * 0.04, borderRadius: W * 0.02 }]} />
      ))}
      <View style={[StyleSheet.absoluteFill, { borderRadius: W * 0.04, borderWidth: 1.5, borderColor: C.bodyShad }]} pointerEvents="none" />
    </View>
  );
}
const cb = StyleSheet.create({
  body: { overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.7, shadowRadius: 20, elevation: 18 },
  stripe: { position: 'absolute', left: 0, right: 0 },
  labelArea: { position: 'absolute', backgroundColor: C.label, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.bodyShad },
  labelTitle: { color: C.labelText, fontWeight: '800', letterSpacing: 3 },
  labelLine:  { width: '70%', height: 1, backgroundColor: 'rgba(58,26,0,0.25)' },
  labelSide:  { color: C.labelText, fontWeight: '700', letterSpacing: 2, opacity: 0.7 },
  window: { position: 'absolute', backgroundColor: 'rgba(10,5,0,0.82)', borderWidth: 1, borderColor: C.brownDark, overflow: 'hidden' },
  reelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: '8%' },
  tapeSpan: { position: 'absolute', left: '8%', right: '8%', flexDirection: 'row', alignItems: 'center' },
  guidePin: { backgroundColor: C.tapeLight, borderWidth: 0.5, borderColor: C.tape },
  bottomRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '8%' },
  hole:      { backgroundColor: C.brownDark, borderWidth: 1, borderColor: '#1A0A00' },
  bottomText: { color: C.brown, fontWeight: '700', letterSpacing: 2 },
  punchHole: { position: 'absolute', backgroundColor: C.brownDark, borderWidth: 1, borderColor: '#1A0A00' },
});

// ── Amber progress bar (Spotify-style) ───────────────────────────────────────
function AmberProgressBar({ progress }: { progress: Animated.Value }) {
  const [barW, setBarW] = useState(260);
  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });
  const DOT = 14;
  return (
    <View
      style={{ flex: 1, height: 36, justifyContent: 'center' }}
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

  const [playing,     setPlaying]     = useState(false);
  const [activeId,    setActiveId]    = useState(stationId ?? 'night-run');
  const [activeTrack, setActiveTrack] = useState(1);   // A2 default (index 1)
  const [platform,    setPlatform]    = useState<{ name: string; color: string; emoji: string } | null>(null);
  const [shuffle,     setShuffle]     = useState(false);
  const [repeat,      setRepeat]      = useState(false);
  const [showTracks,  setShowTracks]  = useState(false);
  const showTracksAnim = useRef(new Animated.Value(0)).current;
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
    leftLoopRef.current = Animated.loop(
      Animated.timing(leftReelAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    );
    rightLoopRef.current = Animated.loop(
      Animated.timing(rightReelAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
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

  useEffect(() => {
    const id = progress.addListener(({ value }) => { progressValue.current = value; });
    return () => progress.removeListener(id);
  }, []);

  useEffect(() => { activeTrackRef.current = activeTrack; }, [activeTrack]);

  const station      = STATIONS.find((s) => s.id === activeId) ?? STATIONS[0];
  const currentTrack = SIDE_A_TRACKS[activeTrack];

  // ── Start secondary animations (tape flow, glow, progress) ──────────────────
  const startReels = () => {
    tapeFlow.setValue(0);
    tapeFlowLoop.current = Animated.loop(
      Animated.timing(tapeFlow, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true })
    );
    tapeFlowLoop.current.start();

    pulseLoop.current = Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(glowPulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    pulseLoop.current.start();

    const trackMs   = parseTrackMs(SIDE_A_TRACKS[activeTrackRef.current].duration);
    const remaining = (1 - progressValue.current) * trackMs;
    progressAnimRef.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    progressAnimRef.current.start(({ finished }) => {
      if (finished) {
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
    pulseLoop.current?.stop();
    progressAnimRef.current?.stop();

    Animated.timing(glowPulse, {
      toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();

    tapeFlow.stopAnimation();
  };

  useEffect(() => {
    if (playing) { startReels(); } else { stopReels(); }
    return () => stopReels();
  }, [playing]);

  // ── Reset progress when track changes ──────────────────────────────────────
  useEffect(() => {
    progressAnimRef.current?.stop();
    progress.setValue(0);
    progressValue.current = 0;
    if (playing) {
      const trackMs = parseTrackMs(SIDE_A_TRACKS[activeTrack].duration);
      progressAnimRef.current = Animated.timing(progress, {
        toValue: 1, duration: trackMs, easing: Easing.linear, useNativeDriver: false,
      });
      progressAnimRef.current.start(({ finished }) => {
        if (finished) {
          setActiveTrack((t) => {
            const next = Math.min(SIDE_A_TRACKS.length - 1, t + 1);
            if (next === t) setPlaying(false);
            return next;
          });
        }
      });
    }
  }, [activeTrack]);

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') {
        const p = PLATFORMS[id as Exclude<PlatformId, 'none'>];
        if (p) setPlatform({ name: p.name, color: p.color, emoji: p.emoji });
      } else { setPlatform(null); }
    });
    slideY.setValue(SCREEN_H);
    setPlaying(true);
    progress.setValue(0);
    progressValue.current = 0;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => { stopReels(); };
  }, [visible]);

  const handleClose = () => {
    setPlaying(false);
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const spotify = useSpotifyPlayback(visible);

  const togglePlay = () => setPlaying((p) => {
    if (p) spotify.pause(); else spotify.play();
    return !p;
  });

  const toggleTracks = () => {
    if (showTracks) {
      Animated.timing(showTracksAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => setShowTracks(false));
    } else {
      setShowTracks(true);
      showTracksAnim.setValue(0);
      Animated.timing(showTracksAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  };

  // Glow: 0.3 → 0.6 range, gentle amber pulse
  const glowOpacity = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
  const glowScale   = glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  const topPad    = Math.max(insets.top, 20);
  const bottomPad = Math.max(insets.bottom, 24) + 24;
  const cassetteW = isLandscape ? winH * 0.72 : winW * 0.92;
  const cassetteH = cassetteW * 0.62;


  const stationImg = STATIONS.find((s) => s.id === activeId)?.image ?? STATIONS[0].image;

  // Plain JSX, not an inline component — an inline component remounts the
  // blurred image on every render (background twitching).
  const currentEq = STATIONS.find((s) => s.id === activeId)?.eqColors;
  const background = (
    <>
      <ImageBackground
        source={stationImg}
        style={StyleSheet.absoluteFill}
        imageStyle={{ width: '100%', height: '100%' }}
        blurRadius={3.5}
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
        colors={['transparent', (currentEq?.[1] ?? '#C8860A') + '26', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: SCREEN_H * 0.40, bottom: 0 }}
        pointerEvents="none"
      />
    </>
  );

  // ── Landscape ──────────────────────────────────────────────────────────────
  if (isLandscape) {
    const leftW = winW * 0.44;
    const safeL = insets.left  || 0;
    const safeR = insets.right || 0;

    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={[fs.container, { backgroundColor: C.bg }]}>
          {background}
          <GrainOverlay />

          <TouchableOpacity
            style={[fs.closeBtn, { top: Math.max(insets.top, 8) + 2, right: safeR + 14 }]}
            onPress={handleClose}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color={C.textDim} />
          </TouchableOpacity>

          <View style={{ flex: 1, flexDirection: 'row' }}>
            {/* Left column */}
            <ScrollView
              style={{ flex: 0, width: leftW }}
              contentContainerStyle={[ls.leftCol, { paddingLeft: safeL + 22, paddingBottom: 16 }]}
              showsVerticalScrollIndicator={false}>
              <Text style={[ls.nowPlaying, { fontFamily: Fonts.mono }]}>NOW PLAYING</Text>
              <Text style={ls.lsStation} numberOfLines={1}>{station.name}</Text>
              <Text style={ls.lsTrack} numberOfLines={1}>
                {currentTrack.title} — {currentTrack.artist}
              </Text>

              <View style={{ height: 14 }} />

              {/* Controls */}
              <View style={ls.ctrlRow}>
                <TouchableOpacity onPress={() => setActiveTrack((t) => Math.max(0, t - 1))} style={ls.lsSkipBtn} activeOpacity={0.75}>
                  <Ionicons name="play-skip-back" size={20} color="#fff" />
                </TouchableOpacity>
                <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
                  <TouchableOpacity
                    onPress={togglePlay}
                    onPressIn={() => Animated.spring(playBtnScale, { toValue: 1.05, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                    onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                    style={ls.lsPlayBtn} activeOpacity={0.9}>
                    <Ionicons name={playing ? 'pause' : 'play'} size={26} color="#0a0a12" style={playing ? undefined : { marginLeft: 3 }} />
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity onPress={() => setActiveTrack((t) => Math.min(SIDE_A_TRACKS.length - 1, t + 1))} style={ls.lsSkipBtn} activeOpacity={0.75}>
                  <Ionicons name="play-skip-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={[ls.progressRow, { marginBottom: 14 }]}>
                <AmberProgressBar progress={progress} />
              </View>

              {/* Compact track list */}
              <View style={{ marginBottom: 12 }}>
                <SectionLabel label="SIDE A" />
                {SIDE_A_TRACKS.map((track, i) => (
                  <TouchableOpacity
                    key={track.id}
                    onPress={() => setActiveTrack(i)}
                    style={[ls.miniTrack, i === activeTrack && ls.miniTrackActive]}>
                    <Text style={[ls.miniNum, { fontFamily: Fonts.mono }, i === activeTrack && { color: C.amber }]}>
                      {track.id}
                    </Text>
                    <Text style={[ls.miniTitle, i === activeTrack && { color: C.amber }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={[ls.miniDur, { fontFamily: Fonts.mono }]}>{track.duration}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {platform && (
                <PlatformButton platform={platform} onPress={() => openMusicPlatform(station.name)} />
              )}
            </ScrollView>

            {/* Right column — cassette */}
            <View style={[ls.rightCol, { paddingRight: safeR }]}>
              <Animated.View style={[fs.glowOrb, {
                width: cassetteW * 0.9, height: cassetteH * 1.4,
                borderRadius: cassetteW * 0.45,
                opacity: playing ? glowOpacity : 0.2,
                transform: [{ scale: glowScale }],
              }]} />
              <CassetteBody size={cassetteW} leftSpin={leftSpin} rightSpin={rightSpin} playing={playing} progress={progress} tapeFlow={tapeFlow} />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Portrait ───────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[fs.container, { backgroundColor: C.bg, transform: [{ translateY: slideY }] }]}>
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
          <TouchableOpacity
            style={[fs.closeBtn, { position: 'absolute', right: 22, top: 0 }]}
            onPress={handleClose}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color={C.textDim} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: bottomPad }}>

          {/* Header — small top-center, Spotify style */}
          <View style={fs.header}>
            <Text style={fs.headerEyebrow}>PLAYING FROM</Text>
            <Text style={fs.headerStation}>{station.name}</Text>
          </View>

          {/* Cassette hero — flex:1 so it grows to fill available space */}
          <View style={[fs.cassetteWrap, { flex: 1 }]}>
            <Animated.View style={[fs.glowOrb, {
              width: cassetteW * 0.85, height: cassetteH * 1.3,
              borderRadius: cassetteW * 0.42,
              opacity: playing ? glowOpacity : 0.2,
              transform: [{ scale: glowScale }],
            }]} />
            <TouchableOpacity onPress={togglePlay} activeOpacity={0.92}>
              <CassetteBody size={cassetteW} leftSpin={leftSpin} rightSpin={rightSpin} playing={playing} progress={progress} tapeFlow={tapeFlow} />
            </TouchableOpacity>
          </View>

          {/* Song title — bottom-left, Spotify style */}
          <View style={fs.trackBlock}>
            <Text style={fs.trackTitle} numberOfLines={1}>{spotify.track?.title ?? currentTrack.title}</Text>
            <Text style={fs.trackArtist} numberOfLines={1}>{spotify.track?.artist ?? currentTrack.artist}</Text>
          </View>

          {/* Tape progress */}
          <View style={fs.progressWrap}>
            <View style={fs.progressRow}>
              <Text style={[fs.timeText, { fontFamily: Fonts.mono }]}>00:00</Text>
              <AmberProgressBar progress={progress} />
              <Text style={[fs.timeText, { fontFamily: Fonts.mono, textAlign: 'right' }]}>90:00</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity
              onPress={() => setShuffle((s) => !s)}
              style={fs.shuffleRepeatBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={26} color={shuffle ? '#C8860A' : '#ffffff'} />
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
              onPress={() => setRepeat((r) => !r)}
              style={fs.shuffleRepeatBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="repeat" size={26} color={repeat ? '#C8860A' : '#ffffff'} />
            </TouchableOpacity>
          </View>

          {/* PLAYLIST BUTTON */}
          <TouchableOpacity onPress={toggleTracks} style={fs.playlistBtn} activeOpacity={0.7}>
            <Ionicons name="musical-notes-outline" size={14} color={C.textDim} />
            <Text style={[fs.playlistBtnText, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>
            <Ionicons name={showTracks ? 'chevron-up' : 'chevron-down'} size={14} color={C.textDim} />
          </TouchableOpacity>

        </View>

        {/* Overlay */}
        {showTracks && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={toggleTracks}
            activeOpacity={1}
          />
        )}

        {/* Playlist bottom sheet — tracks + station switcher + platform */}
        <Animated.View style={[fs.playlistSheet, {
          transform: [{ translateY: showTracksAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.6, 0] }) }],
        }]}>
          <View style={fs.sheetHandle} />
          <Text style={[fs.sheetTitle, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>

          <TrackList activeIdx={activeTrack} onSelect={(i) => { setActiveTrack(i); toggleTracks(); }} />

          {/* Station switcher inside sheet */}
          <View style={{ marginTop: 16, paddingHorizontal: 22 }}>
            <Text style={{ color: '#ffffff', fontSize: 10.5, fontWeight: '800', letterSpacing: 3 }}>CHANGE STATION</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 8 }}>
            {STATIONS.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => { setActiveId(s.id); toggleTracks(); }}
                style={[fs.stationPill, s.id === activeId && fs.stationPillActive]}
                activeOpacity={0.75}>
                <LinearGradient
                  colors={s.cardGradient}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
                <MaterialCommunityIcons name={s.iconName as any} size={16} color="#ffffff" />
                <Text style={[fs.stationPillText, s.id === activeId && { color: '#ffffff', fontWeight: '800' }]} numberOfLines={1}>
                  {s.name.replace(' FM', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {platform && (
            <TouchableOpacity style={fs.sheetPlatformRow} onPress={() => openMusicPlatform(station.name)} activeOpacity={0.75}>
              <Text style={fs.sheetPlatformEmoji}>{platform.emoji}</Text>
              <Text style={[fs.sheetPlatformText, { color: platform.color }]}>Open in {platform.name}</Text>
              <Ionicons name="arrow-forward" size={13} color={platform.color} style={{ opacity: 0.7 }} />
            </TouchableOpacity>
          )}
        </Animated.View>

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
    leftLoopRef.current = Animated.loop(
      Animated.timing(leftReelAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    );
    rightLoopRef.current = Animated.loop(
      Animated.timing(rightReelAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
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
        <LinearGradient colors={['#2A1200', '#1a0f00', '#0D0700']} style={StyleSheet.absoluteFill} />
        <View style={pv.glow} />
        <View style={pv.tapHint}>
          <Text style={[pv.tapHintText, { fontFamily: Fonts.mono }]}>▶ tap to open</Text>
        </View>
        <CassetteBody size={275} leftSpin={leftSpin} rightSpin={rightSpin} playing={active} progress={progress} tapeFlow={tapeFlow} />
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
          <Text style={pv.sub}>Vintage warm. Reels spin. The tape feeds through.</Text>
        </View>
        {!OWNER_MODE && (
          <View style={[pv.unlockBtn, { marginTop: 'auto' }]}>
            <Text style={pv.unlockText}>🔒 Unlock Premium</Text>
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

  cassetteWrap: { alignItems: 'center', gap: 10 },
  glowOrb:     { position: 'absolute', backgroundColor: C.amber, alignSelf: 'center' },

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
  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText:     { color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 0.2, width: 38 },

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
  glow:  { position: 'absolute', width: 240, height: 120, borderRadius: 120, backgroundColor: 'rgba(200,134,10,0.28)' },
  tapHint: {
    position: 'absolute', top: 12, right: 12,
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
    paddingVertical: 11, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(204,102,0,0.35)',
  },
  unlockText: { color: C.amber, fontSize: 14, fontWeight: '600' },
});
