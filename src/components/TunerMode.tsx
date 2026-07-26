import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, Platform,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Line, Rect, Stop } from 'react-native-svg';
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
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { DotMatrixGroup, DotMatrixText, dmAdvance, dmFit, dmHeight, dmWidth } from '@/components/DotMatrix';
import { ModeActionRow } from '@/components/ModeActionRow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
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

/** The dial needle. Deliberately fixed, never the station accent. */
const NEEDLE_RED = '#FF3B30';

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

/** The printed band plates at the left end of the scale. */
const FM_PLATE_W = 62;
const AM_PLATE_W = 54;

/** Would a centred scale number collide with the band plate? */
function underPlate(x: number, label: string, dot: number, gap: number, plateW: number): boolean {
  return x - dmWidth(label, dot, gap) / 2 < plateW - 6;
}

// ── The dial ruler — ticks slide under a fixed needle ──────────────────────────
function DialRuler({ freq, width, color, lock }: { freq: number; width: number; color: string; lock: number }) {
  const H = 132;
  const midX = width / 2;
  const baseY = 66;          // the bright band both scales hang off

  // FM ticks (0.1 MHz steps) with a little bleed off both edges.
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
    ticks.push({ x, h: whole ? 22 : half ? 15 : 9, major: whole, label: whole ? String(Math.round(f)) : undefined });
  }

  // A second, decorative AM scale — every dial worth looking at prints both
  // bands on one strip with a single needle crossing them. It's cosmetic
  // (Cruise FM only tunes the FM row), so it's simply mapped across the same
  // travel at its own rate, which is what makes it drift past at a different
  // speed as you tune. That mismatch is exactly what a real dial does.
  const AM_LO = 530, AM_HI = 1600, AM_PX_PER_KHZ = PX_PER_MHZ / 220;
  const amCentre = AM_LO + ((freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * (AM_HI - AM_LO);
  const amHalf = width / 2 / AM_PX_PER_KHZ + 40;
  const amTicks: { x: number; major: boolean; label?: string }[] = [];
  const amFrom = Math.ceil((amCentre - amHalf) / 20) * 20;
  const amTo = Math.floor((amCentre + amHalf) / 20) * 20;
  for (let a = amFrom; a <= amTo; a += 20) {
    if (a < AM_LO || a > AM_HI) continue;
    const x = midX + (a - amCentre) * AM_PX_PER_KHZ;
    const major = a % 200 === 0;
    amTicks.push({ x, major, label: major ? String(a) : undefined });
  }

  return (
    // pointerEvents none is CRITICAL: on iOS the Svg otherwise swallows
    // touches, so drags starting on the ruler never reach the tune gesture.
    <Svg width={width} height={H} pointerEvents="none">
      <Defs>
        {/* The band plates fade out on their right edge instead of ending in a
            hard line, so ticks dissolve under them the way ink does beneath a
            printed band marker rather than being sliced off. */}
        <SvgGradient id="dialPlate" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#050912" stopOpacity={0.96} />
          <Stop offset="0.62" stopColor="#050912" stopOpacity={0.94} />
          <Stop offset="1" stopColor="#050912" stopOpacity={0} />
        </SvgGradient>
      </Defs>

      {/* FM numbers, in the same matrix type as the head unit above. A number
          that would land under the band plate is dropped outright — half a
          number showing reads as a different, shorter number ("102" behind the
          plate became "FM02", "1000" became "000"), which is worse than a gap
          in the scale. */}
      {ticks.filter((t) => t.label && !underPlate(t.x, t.label, 2.1, 0.8, FM_PLATE_W)).map((t, i) => (
        <DotMatrixGroup key={`fl${i}`} text={t.label!} x={t.x} y={6} dot={2.1} gap={0.8}
          color="#CFE6FF" anchor="middle" opacity={0.85} />
      ))}
      {/* Band markers sit in a little printed plate at the left edge, exactly
          as a real dial prints them. */}
      <Rect x={0} y={0} width={FM_PLATE_W} height={30} fill="url(#dialPlate)" />
      <DotMatrixGroup text="FM" x={9} y={6} dot={2.1} gap={0.8} color={color} opacity={0.95} />

      {/* FM ticks hanging down onto the band */}
      {ticks.map((t, i) => (
        <Line key={i} x1={t.x} y1={baseY} x2={t.x} y2={baseY - t.h}
          stroke={t.major ? 'rgba(214,234,255,0.85)' : 'rgba(214,234,255,0.32)'}
          strokeWidth={t.major ? 2 : 1} />
      ))}

      {/* The lit band itself */}
      <Rect x={0} y={baseY} width={width} height={2.5} fill="#9FD8FF" opacity={0.55} />

      {/* AM ticks below the band, then its numbers */}
      {amTicks.map((t, i) => (
        <Line key={`a${i}`} x1={t.x} y1={baseY + 4} x2={t.x} y2={baseY + 4 + (t.major ? 14 : 8)}
          stroke={t.major ? 'rgba(214,234,255,0.6)' : 'rgba(214,234,255,0.22)'}
          strokeWidth={t.major ? 2 : 1} />
      ))}
      {amTicks.filter((t) => t.label && !underPlate(t.x, t.label, 1.7, 0.62, AM_PLATE_W)).map((t, i) => (
        <DotMatrixGroup key={`al${i}`} text={t.label!} x={t.x} y={baseY + 22} dot={1.7} gap={0.62}
          color="#9FD8FF" anchor="middle" opacity={0.5} />
      ))}
      <Rect x={0} y={baseY + 16} width={AM_PLATE_W} height={28} fill="url(#dialPlate)" />
      <DotMatrixGroup text="AM" x={8} y={baseY + 22} dot={1.7} gap={0.62} color="#9FD8FF" opacity={0.6} />

      {/* Station markers — glowing dots in each station's own colour */}
      {STATIONS.map((s) => {
        const f = STATION_FREQS[s.id];
        if (f === undefined) return null;
        const x = midX + (f - freq) * PX_PER_MHZ;
        if (x < -20 || x > width + 20) return null;
        const c = s.eqColors?.[1] ?? '#ffffff';
        return (
          <Fragment key={s.id}>
            <Circle cx={x} cy={baseY - 30} r={7} fill={c} opacity={0.18} />
            <Circle cx={x} cy={baseY - 30} r={3.2} fill={c} />
          </Fragment>
        );
      })}

      {/* The needle. Fixed neon red, NOT the station colour — on every dial
          worth copying the pointer is the one part that never changes hue,
          which is what lets your eye find it instantly against the scale. */}
      <Rect x={midX - 5} y={0} width={10} height={H} fill={NEEDLE_RED} opacity={0.13} rx={5} />
      <Rect x={midX - 1.6} y={0} width={3.2} height={H} fill={NEEDLE_RED} opacity={0.62} rx={1.6} />
      <Rect x={midX - 0.6} y={0} width={1.2} height={H} fill="#FFD9D4" opacity={0.85} />
      <Circle cx={midX} cy={baseY + 1} r={4} fill={NEEDLE_RED} opacity={0.55 + lock * 0.45} />
      <Circle cx={midX} cy={baseY + 1} r={1.5} fill="#FFE9E6" opacity={0.6 + lock * 0.4} />
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
// ── The head-unit display ────────────────────────────────────────────────────
// Laid out from the owner's two references: a car head unit and an FM
// receiver. Both are dot-matrix LCDs, so the readout is drawn as real dots
// (see DotMatrix) rather than set in a font — the visible UNLIT dots are what
// make it read as a piece of hardware.
//
//   [● ON AIR]              SONG TITLE
//                           ARTIST
//   STEREO                       TUNED
//   FM                           92.10

/** One line that scrolls when it doesn't fit, the way a real head unit does.
 *  A car display would simply cut the title off ("MIDNIGHT MEMO" in the
 *  owner's photo); scrolling keeps that character while still letting a long
 *  title be read in full. Transform-only, so it runs on the native driver. */
function DmLine({ text, width: raw, dot, gap, color, dim, align = 'right' }: {
  text: string; width: number; dot: number; gap: number; color: string; dim?: boolean;
  align?: 'left' | 'right';
}) {
  // Snap the window down to a whole number of characters. A dot-matrix display
  // has discrete cells, so a window ending mid-glyph — half an "O" against the
  // edge — instantly breaks the illusion.
  const cells = Math.max(1, dmFit(raw, dot, gap));
  const width = cells * dmAdvance(dot, gap) - gap;
  const full = dmWidth(text, dot, gap);
  const over = full > width;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    x.setValue(0);
    if (!over) return;
    const dist = full - width;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(x, { toValue: -dist, duration: Math.max(1200, dist * 34), easing: Easing.linear, useNativeDriver: true }),
      Animated.delay(1100),
      Animated.timing(x, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [text, over, full, width]);

  return (
    <View style={{
      width, height: dmHeight(dot, gap), overflow: 'hidden',
      alignItems: over || align === 'left' ? 'flex-start' : 'flex-end',
    }}>
      <Animated.View style={{ transform: [{ translateX: x }] }}>
        <DotMatrixText text={text} dot={dot} gap={gap} color={color} dim={dim} />
      </Animated.View>
    </View>
  );
}

function TunerReadout({ width, accent, freq, lock, playing, title, artist, hasTrack }: {
  width: number; accent: string; freq: number; lock: number; playing: boolean;
  title: string; artist: string; hasTrack: boolean;
}) {
  const onAir = playing && lock > 0.9;

  // The lamp breathes only while a station is locked AND the music is running.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!onAir) { Animated.timing(pulse, { toValue: 0, duration: 260, useNativeDriver: true }).start(); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [onAir]);

  const PAD = 22;
  const inner = width - PAD * 2;

  const LAMP = { dot: 1.7, gap: 0.62 };
  // The song gets the panel's whole width on its own line rather than sharing
  // a row with the lamp. Sharing left it about ten characters wide, which is
  // what kept the title small; full width buys both bigger dots AND more of
  // the name visible before it has to scroll.
  const TITLE = { dot: 3.5, gap: 1.15 };
  const ART = { dot: 2.1, gap: 0.78 };
  const SMALL = { dot: 1.7, gap: 0.62 };
  const BIG = { dot: 4.6, gap: 1.5 };

  const lampOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <View style={[fs.lcd, { width, borderColor: accent + '2E' }]}>
      {/* Row 1 — the ON AIR lamp, on its own line above the song */}
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: onAir ? lampOpacity : 0.34 }}>
        <View style={[fs.lamp, {
          backgroundColor: onAir ? ON_AIR_RED : 'rgba(255,255,255,0.22)',
          shadowColor: ON_AIR_RED, shadowOpacity: onAir ? 0.95 : 0, shadowRadius: 6,
        }]} />
        <DotMatrixText text="ON AIR" dot={LAMP.dot} gap={LAMP.gap} color={onAir ? '#FF6B5A' : '#9AA3B8'} dim={false} />
      </Animated.View>

      {/* Row 2 — what's playing, across the full panel */}
      <View style={{ marginTop: 18, gap: 11 }}>
        <DmLine text={hasTrack ? title : 'CRUISE FM'} width={inner} dot={TITLE.dot} gap={TITLE.gap} color={accent} align="left" />
        {hasTrack && !!artist && (
          <DmLine text={artist} width={inner} dot={ART.dot} gap={ART.gap} color={accent} dim={false} align="left" />
        )}
      </View>

      {/* Row 2 — the status lamps of a real receiver */}
      <View style={fs.lcdRow}>
        <DotMatrixText text="STEREO" dot={SMALL.dot} gap={SMALL.gap} color="#FFA24B" dim opacity={onAir ? 1 : 0.32} />
        <DotMatrixText text="TUNED" dot={SMALL.dot} gap={SMALL.gap} color={accent} dim opacity={0.3 + lock * 0.7} />
      </View>

      {/* Row 3 — band and frequency, the biggest thing on the panel */}
      <View style={[fs.lcdRow, { alignItems: 'flex-end', marginTop: 16 }]}>
        <DotMatrixText text="FM" dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
        <DotMatrixText text={freq.toFixed(2)} dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
      </View>
    </View>
  );
}

export function TunerFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  // How far the dial sits below the head unit. The owner wanted it lower, but
  // the panel and the dial are both fixed-height blocks inside one centred
  // column, so a flat 52 would run off the bottom of a short phone. Scaled to
  // the screen: full separation on a big handset, tight on a small one.
  const dialGap = Math.round(clamp((winH - 640) * 0.18, 14, 56));

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
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{lockedStation.name}</Text>
          </View>

          {/* ── The dial — drag anywhere in this zone to tune ── */}
          <View style={{ flex: 1, justifyContent: 'center' }} {...pan.panHandlers}>

            {/* The head-unit display */}
            <View style={{ alignItems: 'center' }}>
              <TunerReadout
                width={Math.min(winW - 32, 420)}
                accent={accent}
                freq={freq}
                lock={lock}
                playing={playing}
                title={title}
                artist={artist}
                hasTrack={hasTrack}
              />
            </View>

            {/* Ruler + static */}
            <View style={{ marginTop: dialGap }}>
              <DialRuler freq={freq} width={winW} color={accent} lock={lock} />
              <StaticNoise width={winW} height={116} phase={phase} opacity={offAir * 0.55} />
              {/* Notes only flow once the needle locks onto a station */}
              <FloatingNotes playing={playing && lock > 0.9} color={accent} />
            </View>

            <Text style={[fs.dragHint, { fontFamily: Fonts.mono }]}>drag to tune</Text>
          </View>

          {/* With a song on the display there's nothing to repeat here — the
              mood line only appears when there's no track to show. */}
          {!hasTrack && (
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>
            </View>
          )}

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
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            track={spotify.track}
            station={lockedStation}
          />
        </View>

        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && spotify.connected && !spotify.track && !handoff} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

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
  lcd: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(4,7,16,0.55)',
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  lcdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  lamp: { width: 7, height: 7, borderRadius: 3.5, shadowOffset: { width: 0, height: 0 } },
  dragHint: { color: 'rgba(255,255,255,0.18)', fontSize: 8, fontWeight: '600', letterSpacing: 2, textAlign: 'center', marginTop: 10 },
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
