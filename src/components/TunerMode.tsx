import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, Platform,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoodSheet } from '@/components/MoodSheet';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { FloatingNotes } from '@/components/FloatingNotes';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;

// ── The FM band ────────────────────────────────────────────────────────────────
const FREQ_MIN = 87.5;
const FREQ_MAX = 108.5;
const PX_PER_MHZ = 110;          // drag sensitivity: pixels per MHz
const LOCK_RANGE = 0.45;         // MHz within which a station "bleeds in"

// Every station lives at a frequency on the dial.
const STATION_FREQS: Record<string, number> = {
  'daylight':       90.5,
  'night-run':      92.1,
  'after-midnight': 94.7,
  'sunset':         96.3,
  'rain-drive':     98.9,
  'coastal':        101.3,
  'mountain-pass':  103.5,
  'downtown':       100.1,
  'cars-coffee':    105.1,
  'tunnel':         107.5,
};

const DEMO_DURATION_MS = 214000; // 3:34

// Classic broadcast-studio red for the ON AIR lamp.
const ON_AIR_RED = '#FF3B30';

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Nearest station to a frequency + how locked-on we are (0..1). */
function nearestStation(freq: number) {
  let best = STATIONS[0];
  let bestDist = Infinity;
  for (const s of STATIONS) {
    const f = STATION_FREQS[s.id];
    if (f === undefined) continue;
    const d = Math.abs(f - freq);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return { station: best, lock: clamp(1 - bestDist / LOCK_RANGE, 0, 1) };
}

// ── The dial ruler — ticks slide under a fixed needle ──────────────────────────
function DialRuler({ freq, width, color, lock }: { freq: number; width: number; color: string; lock: number }) {
  const H = 116;
  const midX = width / 2;
  const baseY = 78;

  // Visible tick range (0.1 MHz steps) with a little bleed off both edges.
  const halfMHz = width / 2 / PX_PER_MHZ + 0.3;
  const from = Math.ceil((freq - halfMHz) * 10);
  const to = Math.floor((freq + halfMHz) * 10);

  const ticks: { x: number; h: number; major: boolean; label?: string }[] = [];
  for (let k = from; k <= to; k++) {
    const f = k / 10;
    if (f < FREQ_MIN || f > FREQ_MAX) continue;
    const x = midX + (f - freq) * PX_PER_MHZ;
    const whole = k % 10 === 0;
    const half = k % 5 === 0;
    ticks.push({
      x,
      h: whole ? 34 : half ? 24 : 14,
      major: whole,
      label: whole ? String(Math.round(f)) : undefined,
    });
  }

  return (
    // pointerEvents none is CRITICAL: on iOS the Svg otherwise swallows
    // touches, so drags starting on the ruler never reach the tune gesture.
    <Svg width={width} height={H} pointerEvents="none">
      {/* Baseline */}
      <Line x1={0} y1={baseY} x2={width} y2={baseY} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

      {/* Ticks */}
      {ticks.map((t, i) => (
        <Line
          key={i}
          x1={t.x} y1={baseY} x2={t.x} y2={baseY - t.h}
          stroke={t.major ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.30)'}
          strokeWidth={t.major ? 1.8 : 1}
        />
      ))}
      {ticks.filter((t) => t.label).map((t, i) => (
        <SvgText key={`l${i}`} x={t.x} y={baseY + 22} fill="rgba(255,255,255,0.55)" fontSize={12} fontWeight="700" textAnchor="middle" fontFamily={Fonts.mono}>
          {t.label}
        </SvgText>
      ))}

      {/* Station markers — glowing dots in each station's own colour */}
      {STATIONS.map((s) => {
        const f = STATION_FREQS[s.id];
        if (f === undefined) return null;
        const x = midX + (f - freq) * PX_PER_MHZ;
        if (x < -20 || x > width + 20) return null;
        const c = s.eqColors?.[1] ?? '#ffffff';
        return (
          <Fragment key={s.id}>
            <Circle cx={x} cy={baseY - 46} r={8} fill={c} opacity={0.18} />
            <Circle cx={x} cy={baseY - 46} r={3.4} fill={c} />
          </Fragment>
        );
      })}

      {/* Fixed centre needle */}
      <Rect x={midX - 8} y={0} width={16} height={H - 26} fill={color} opacity={0.10} rx={8} />
      <Line x1={midX} y1={6} x2={midX} y2={baseY + 6} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={midX} cy={baseY + 6} r={4.5} fill={color} opacity={0.5 + lock * 0.5} />
    </Svg>
  );
}

// ── Static between stations — flickering noise dots ────────────────────────────
function StaticNoise({ width, height, phase, opacity }: { width: number; height: number; phase: number; opacity: number }) {
  if (opacity <= 0.02) return null;
  const seed = Math.floor(phase * 14);
  const dots = Array.from({ length: 70 }, (_, i) => {
    const a = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    const b = Math.sin(i * 269.5 + seed * 183.3) * 28001.8384;
    return {
      x: Math.abs(a - Math.floor(a)) * width,
      y: Math.abs(b - Math.floor(b)) * height,
      o: 0.15 + Math.abs(Math.sin(i * 7.7 + seed)) * 0.5,
      w: 1 + Math.abs(Math.sin(i * 3.1 + seed * 2)) * 2.4,
    };
  });
  return (
    <Svg width={width} height={height} style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {dots.map((d, i) => (
        <Rect key={i} x={d.x} y={d.y} width={d.w} height={1.4} fill="#ffffff" opacity={d.o} />
      ))}
    </Svg>
  );
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function TunerFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const [freq, setFreq] = useState(STATION_FREQS[stationId ?? 'night-run'] ?? 92.1);
  const freqRef = useRef(freq);
  useEffect(() => { freqRef.current = freq; }, [freq]);

  const lockedStation = resolveAnyStation(activeId);
  const { station: nearest, lock } = nearestStation(freq);
  const eq = (nearest.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];
  const accent = eq[1];

  const spotify = useSpotifyPlayback(visible);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);
  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  const [phase, setPhase] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(lockedStation.id).then(setLinked);
  }, [visible, lockedStation.id]);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });

  // Noise flicker clock (~30fps) — only really matters while off-station.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 40) { last = now; setPhase((now - start) / 1000); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // ── Drag-to-tune ─────────────────────────────────────────────────────────────
  const startFreqRef = useRef(0);
  const snapRaf = useRef(0);
  const lastTickRef = useRef(0);

  const cancelSnap = () => { if (snapRaf.current) cancelAnimationFrame(snapRaf.current); snapRaf.current = 0; };

  const tuneTo = (f: number) => {
    const v = clamp(f, FREQ_MIN, FREQ_MAX);
    // Haptic tick each 0.2 MHz swept (native only)
    const bucket = Math.round(v * 5);
    if (bucket !== lastTickRef.current) {
      lastTickRef.current = bucket;
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    }
    setFreq(v);
  };

  const snapToNearest = () => {
    cancelSnap();
    const { station } = nearestStation(freqRef.current);
    const target = STATION_FREQS[station.id] ?? freqRef.current;
    const from = freqRef.current;
    const t0 = Date.now();
    const DUR = 340;
    const step = () => {
      const t = clamp((Date.now() - t0) / DUR, 0, 1);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setFreq(from + (target - from) * e);
      if (t < 1) { snapRaf.current = requestAnimationFrame(step); }
      else {
        snapRaf.current = 0;
        setActiveId(station.id);
        npSetStation(station.id);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    };
    snapRaf.current = requestAnimationFrame(step);
  };

  // Change Mood from the sheet: reel the dial across to the chosen station
  // (a deliberate sweep, so the frequency visibly travels there) rather than
  // snapping instantly. The music + active station lock in when it arrives.
  const reelTo = (id: string) => {
    cancelSnap();
    const target = STATION_FREQS[id] ?? freqRef.current;
    const from = freqRef.current;
    if (Math.abs(target - from) < 0.05) { setActiveId(id); npSetStation(id); return; }
    const t0 = Date.now();
    const DUR = 720;
    const step = () => {
      const t = clamp((Date.now() - t0) / DUR, 0, 1);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setFreq(from + (target - from) * e);
      if (t < 1) { snapRaf.current = requestAnimationFrame(step); }
      else {
        snapRaf.current = 0;
        setActiveId(id);
        npSetStation(id);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    };
    snapRaf.current = requestAnimationFrame(step);
  };

  // The dial zone owns its touches outright. The old move-based negotiation
  // (claim only once the drag proves horizontal) kept losing on iOS — between
  // Svg subviews and modal touch quirks the claim never landed, so tuning
  // simply didn't respond. Claiming on touch-start always works; the first
  // few pixels of movement then decide the gesture ourselves: sideways tunes,
  // downward drags the player away — both, with no renegotiation to lose.
  const gestureModeRef = useRef<'tune' | 'dismiss' | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        gestureModeRef.current = null;
        cancelSnap();
        startFreqRef.current = freqRef.current;
      },
      onPanResponderMove: (_, g) => {
        if (!gestureModeRef.current && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6)) {
          gestureModeRef.current = Math.abs(g.dx) >= Math.abs(g.dy) ? 'tune' : 'dismiss';
        }
        if (gestureModeRef.current === 'tune') {
          tuneTo(startFreqRef.current - g.dx / PX_PER_MHZ);
        } else if (gestureModeRef.current === 'dismiss' && g.dy > 0) {
          slideY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        const mode = gestureModeRef.current;
        gestureModeRef.current = null;
        if (mode === 'dismiss') {
          if (g.dy > 120 || g.vy > 0.8) closeRef.current();
          else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
          return;
        }
        snapToNearest();
      },
      onPanResponderTerminate: () => { gestureModeRef.current = null; snapToNearest(); },
    })
  ).current;

  // Progress is driven by useTrackClock — real Spotify position when
  // connected, demo loop otherwise.

  useEffect(() => {
    if (!visible) return;
    const id = stationId ?? 'night-run';
    setActiveId(id);
    setFreq(STATION_FREQS[id] ?? 92.1);
    slideY.setValue(SCREEN_H);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => cancelSnap();
  }, [visible]);

  const handleClose = () => {
    cancelSnap();
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };
  // The dial pan was created before handleClose exists — it reaches it here.
  closeRef.current = handleClose;

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
  const title = spotify.track?.title ?? lockedStation.tagline;
  const artist = spotify.track?.artist ?? '';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const offAir = 1 - lock;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        {/* Locked station scene, darkened; mood tint follows the needle */}
        <StationBackdrop station={lockedStation} blurRadius={2.5} />
        <LinearGradient
          colors={[
            'rgba(3,4,16,0.62)', 'rgba(3,4,16,0.55)', 'rgba(3,4,16,0.62)',
            'rgba(3,4,16,0.75)', 'rgba(3,4,16,0.85)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', accent + '22', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: '25%', bottom: '30%' }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>TUNER</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          {/* No "Playing from" header here — the dial's big frequency + station
              name already say which station is on air. */}

          {/* ── The dial — drag anywhere in this zone to tune ── */}
          <View style={{ flex: 1, justifyContent: 'center' }} {...pan.panHandlers}>

            {/* ON AIR chip */}
            <View style={{ alignItems: 'center', marginBottom: 6, opacity: 0.25 + lock * 0.75 }}>
              <View style={[fs.onAirChip, { borderColor: ON_AIR_RED + '99', backgroundColor: ON_AIR_RED + '26' }]}>
                <View style={[fs.onAirDot, { backgroundColor: lock > 0.9 ? ON_AIR_RED : 'rgba(255,255,255,0.25)' }]} />
                <Text style={[fs.onAirText, { fontFamily: Fonts.mono, color: lock > 0.9 ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                  {lock > 0.9 ? 'ON AIR' : 'TUNING'}
                </Text>
              </View>
            </View>

            {/* Big frequency readout */}
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={[fs.freqBig, { fontFamily: Fonts.mono, color: accent, opacity: 0.55 + lock * 0.45 }]}>
                  {freq.toFixed(1)}
                </Text>
                <Text style={[fs.freqUnit, { fontFamily: Fonts.mono }]}>FM</Text>
              </View>
              <Text style={[fs.stationName, { opacity: lock, color: '#ffffff' }]} numberOfLines={1}>
                {nearest.name}
              </Text>
            </View>

            {/* Ruler + static */}
            <View style={{ marginTop: 10 }}>
              <DialRuler freq={freq} width={winW} color={accent} lock={lock} />
              <StaticNoise width={winW} height={116} phase={phase} opacity={offAir * 0.55} />
              {/* Notes only flow once the needle locks onto a station */}
              <FloatingNotes playing={playing && lock > 0.9} color={accent} />
            </View>

            <Text style={[fs.dragHint, { fontFamily: Fonts.mono }]}>DRAG TO TUNE</Text>
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

          {/* Left-aligned action pills — same row, same spot as every mode */}
          <View style={fs.actionRow}>
            <TouchableOpacity onPress={() => setShowMood(true)} style={fs.actionPill} activeOpacity={0.85}>
              <MaterialCommunityIcons name="tune-variant" size={15} color="#fff" />
              <Text style={fs.actionPillBold}>Change Mood</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={fs.actionPill} activeOpacity={0.85}>
              <Ionicons name="musical-notes-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={fs.actionPillText} numberOfLines={1}>
                {linked ? linked.name : 'Add Playlist'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && spotify.connected && !spotify.track && !handoff} />
        {handoff && !spotify.track && <HandoffOverlay />}

        <MoodSheet
          visible={showMood}
          activeId={activeId}
          onSelect={(id) => {
            setShowMood(false);
            reelTo(id);
          }}
          onClose={() => setShowMood(false)}
        />

        {showPicker && (
          <PlaylistSheet
            stationName={lockedStation.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(lockedStation.id, pl);
              setLinked(pl);
              setShowPicker(false);
              relinkStationPlaylist(lockedStation.id);
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
  onAirChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1,
  },
  onAirDot: { width: 7, height: 7, borderRadius: 3.5 },
  onAirText: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  freqBig: { fontSize: 76, fontWeight: '800', letterSpacing: -2, lineHeight: 82 },
  freqUnit: { color: 'rgba(255,255,255,0.45)', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  stationName: { fontSize: 17, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
  dragHint: { color: 'rgba(255,255,255,0.18)', fontSize: 8, fontWeight: '600', letterSpacing: 2, textAlign: 'center', marginTop: 10 },
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 22, alignSelf: 'stretch' },
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
