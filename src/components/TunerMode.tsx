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
import { ModeSheet } from '@/components/ModeSheet';
import { DECK_FRAC, LandscapeChrome, restShiftFor, useChromeFade, useDeckScene, useRestScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { STATIONS, stationDial, type Band, type Station } from '@/constants/stations';
import { cachedCustomStations, customToStation, loadCustomStations, type CustomStation } from '@/utils/customStations';
import { confirmedPlaying } from '@/utils/confirmedPlaying';
import { resolveAnyStation } from '@/utils/customStations';
import { ModeScrim } from '@/components/ModeScrim';
import { StationBackdrop } from '@/components/StationBackdrop';
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
import { DotMatrixGroup, DotMatrixText, dmAdvance, dmFit, dmHeight, dmWidth } from '@/components/DotMatrix';
import { ModeActionRow } from '@/components/ModeActionRow';
import { RepeatButton, ShuffleButton } from '@/components/TransportToggle';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;

// ── The two bands ─────────────────────────────────────────────────────────────
//
// The dial is dual-band, matching the Stations page: AM carries the free
// stations, FM the premium ones. Frequencies live in constants/stations so the
// page, the dial and the share card can't drift apart.
//
// `px` is how many pixels a drag covers per unit of the band, and it's chosen
// so both bands take about the same amount of thumb to cross end to end:
// FM is 21 MHz at 110px each, AM is 1070 kHz at 2.2px each.
const BAND_CFG: Record<Band, {
  min: number; max: number; px: number; tick: number; lock: number;
  label: (v: number) => string;
}> = {
  // px loosened 110→72 / 2.2→1.45 and the lock window widened 0.45→0.65 /
  // 25→38 (owner, 30.07: "difficult to tune different stations... a little
  // loose") — a third less thumb travel between stations, and the needle
  // snaps onto a station from further away. The two bands move together so
  // end-to-end travel stays matched (~1500px each).
  FM: { min: 87.5, max: 108.5, px: 72, tick: 0.1, lock: 0.65, label: (v) => v.toFixed(2) },
  AM: { min: 530, max: 1600, px: 1.45, tick: 10, lock: 38, label: (v) => String(Math.round(v)) },
};

/**
 * How long a flick keeps coasting, in milliseconds of its release velocity.
 * 180 puts a brisk flick (~2 points/ms) about 360px down the dial, which is
 * two or three FM stations — enough that throwing the dial feels like throwing
 * something, while a slow drag is unaffected because its velocity is ~0.
 */
const GLIDE_MS = 180;

/** Every tenth tick is a labelled major in both bands — 1 MHz, 100 kHz. */
const MAJOR_EVERY = 10;

/**
 * Every station's band and dial position.
 *
 * THIS USED TO BE THE TEN BUILT-INS ONLY, and the fallbacks below are why that
 * was a real bug rather than a cosmetic gap: a station the map had never heard
 * of came back 'FM' at 92.1, which is After Hours FM. So opening the Tuner
 * from one of your OWN stations silently tuned you to somebody else's (owner,
 * 10.08). `stationDial` already gives any id a stable place — it hashes an
 * unknown one into the AM band — so the only thing missing was telling the
 * dial they exist.
 *
 * The earlier decision to leave custom stations off the dial (26.07) was
 * justified by the mood sheet not listing them either. That sheet was replaced
 * on 03.08 by one that DOES list them, under YOUR STATIONS, so the reasoning
 * expired with it.
 */
const DIAL = new Map(STATIONS.map((s) => [s.id, stationDial(s.id, s.premium)]));

/** Everything the needle can find. Extended once custom stations load. */
let DIAL_STATIONS: Station[] = [...STATIONS];

/** Fold the user's own stations into the dial. Idempotent; safe to re-run. */
function registerCustomOnDial(list: CustomStation[]): void {
  DIAL_STATIONS = [...STATIONS];
  for (const c of list) {
    const st = customToStation(c);
    DIAL.set(st.id, stationDial(st.id, false, st.dialAm));
    DIAL_STATIONS.push(st);
  }
}

function bandOf(id: string): Band {
  return DIAL.get(id)?.band ?? 'FM';
}

function dialValue(id: string): number {
  return DIAL.get(id)?.value ?? 92.1;
}

const DEMO_DURATION_MS = 214000; // 3:34

/**
 * Floor between two tuning haptics. A detent still has to be crossed to earn
 * one; this is the ceiling on how fast they can arrive, so a fast sweep feels
 * grainy instead of drowning the haptic queue. See tuneTo.
 */
const HAPTIC_MIN_MS = 45;

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

/** Nearest station ON THIS BAND, plus how locked-on we are (0..1). The other
 *  band's stations are invisible to the needle — that's what a band switch
 *  means on a real receiver. */
function nearestStation(band: Band, freq: number) {
  const cfg = BAND_CFG[band];
  let best: Station | null = null;
  let bestDist = Infinity;
  for (const s of DIAL_STATIONS) {
    const d = DIAL.get(s.id);
    if (!d || d.band !== band) continue;
    const dist = Math.abs(d.value - freq);
    if (dist < bestDist) { bestDist = dist; best = s; }
  }
  if (!best) return { station: DIAL_STATIONS[0], lock: 0 };
  return { station: best, lock: clamp(1 - bestDist / cfg.lock, 0, 1) };
}

/** The first station on a band, for when the listener flips over to it. */
function firstOnBand(band: Band) {
  const list = DIAL_STATIONS.filter((s) => DIAL.get(s.id)?.band === band)
    .sort((a, b) => dialValue(a.id) - dialValue(b.id));
  return list[0] ?? DIAL_STATIONS[0];
}

/** The printed band plates at the left end of the scale. */
const FM_PLATE_W = 62;
const AM_PLATE_W = 54;

/** Would a centred scale number collide with the band plate? */
function underPlate(x: number, label: string, dot: number, gap: number, plateW: number): boolean {
  return x - dmWidth(label, dot, gap) / 2 < plateW - 6;
}

// ── The dial ruler — ticks slide under a fixed needle ──────────────────────────
//
// The LIVE band is always the top scale, with the station markers on it. The
// other band is printed below and drifts past at its own rate, exactly as a
// real dual-band dial does: the needle crosses both, but only one is tuned.
/**
 * The dial's own face — a receiver's lit window sits on a dark one.
 *
 * IT NEEDS ITS OWN, and that is a fact about this mode rather than a taste:
 * the scale is fine printed type in the MIDDLE of the screen, which is exactly
 * the stretch ModeScrim deliberately leaves open for the photograph (every
 * other deck puts an object there, not words). Over a bright picture of the
 * user's own the scale numbers measured 1.45:1 — invisible — and no amount of
 * shading in the shared ramp can fix that without burying the picture for the
 * seven modes that do not need it. Measured on the '600' glyphs before and
 * after, this face puts them at 4.27:1 while they keep their own brightness
 * (0.690 -> 0.601, the printed scale being slightly transparent), and it
 * darkens nothing above or below — a dark built-in station is unchanged.
 *
 * SOFT AT BOTH ENDS, NEVER A BAR. A hard-edged dark band across the screen is
 * the one thing every light and shade layer in this app has eventually been
 * reported for, so it fades in and out rather than starting anywhere.
 */
function DialFace({ children }: { children: React.ReactNode }) {
  return (
    <View>
      <LinearGradient
        colors={['transparent', 'rgba(3,4,16,0.55)', 'rgba(3,4,16,0.55)', 'transparent']}
        locations={[0, 0.15, 0.88, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        // Reaches ABOVE the block, so the fade-in happens in the gap under the
        // display panel rather than across the AM numbers — those sit on the
        // very first row of the dial, and a fade starting at the block's own
        // top edge leaves them on bare picture.
        style={[StyleSheet.absoluteFill, { top: -30, bottom: -6 }]}
        pointerEvents="none"
      />
      {/* zIndex, NOT just source order. An absolutely-positioned sibling paints
          ABOVE in-flow content on web whatever the order in the tree, so the
          first attempt drew the face straight over the dial and dimmed the
          numbers by exactly as much as the background — measured, 0.690 ->
          0.144, i.e. no gain at all. Saying which is in front removes the
          question on both platforms. */}
      <View style={{ zIndex: 1 }}>{children}</View>
    </View>
  );
}

function DialRuler({ band, freq, width, color, lock }: {
  band: Band; freq: number; width: number; color: string; lock: number;
}) {
  const H = 132;
  const midX = width / 2;
  const baseY = 66;          // the bright band both scales hang off
  const cfg = BAND_CFG[band];

  // Live scale, with a little bleed off both edges.
  const half = width / 2 / cfg.px + cfg.tick * 4;
  const from = Math.ceil((freq - half) / cfg.tick);
  const to = Math.floor((freq + half) / cfg.tick);

  const ticks: { x: number; h: number; major: boolean; label?: string }[] = [];
  for (let k = from; k <= to; k++) {
    // k * tick accumulates float error at 0.1 steps (92.30000000000001), and
    // the label is what shows it.
    const f = Math.round(k * cfg.tick * 1000) / 1000;
    if (f < cfg.min || f > cfg.max) continue;
    const x = midX + (f - freq) * cfg.px;
    const whole = k % MAJOR_EVERY === 0;
    const halfTick = k % (MAJOR_EVERY / 2) === 0;
    ticks.push({
      x, h: whole ? 22 : halfTick ? 15 : 9, major: whole,
      label: whole ? String(Math.round(f)) : undefined,
    });
  }

  // The other band, printed. Its whole span is laid across roughly 2.2 screens
  // so the numbers sit far enough apart to read, and it travels at a different
  // rate from the live scale — which is exactly what makes a real dial feel
  // mechanical rather than drawn.
  const other: Band = band === 'FM' ? 'AM' : 'FM';
  const oc = BAND_CFG[other];
  const oPx = (width * 2.2) / (oc.max - oc.min);
  const t = (freq - cfg.min) / (cfg.max - cfg.min);
  const oCentre = oc.min + t * (oc.max - oc.min);
  const oHalf = width / 2 / oPx + oc.tick * 4;
  // Only label as often as the spacing allows — 78px apart at the least.
  const oLabelEvery = Math.max(1, Math.ceil(78 / (oc.tick * MAJOR_EVERY * oPx))) * MAJOR_EVERY;
  const oTicks: { x: number; major: boolean; label?: string }[] = [];
  const oFrom = Math.ceil((oCentre - oHalf) / oc.tick);
  const oTo = Math.floor((oCentre + oHalf) / oc.tick);
  for (let k = oFrom; k <= oTo; k++) {
    // Halves and majors only. The printed band is laid out much tighter than
    // the live one, so drawing every tick turned it into a solid grey mass
    // that out-shouted the scale actually being tuned.
    if (k % (MAJOR_EVERY / 2) !== 0) continue;
    const f = Math.round(k * oc.tick * 1000) / 1000;
    if (f < oc.min || f > oc.max) continue;
    const major = k % MAJOR_EVERY === 0;
    oTicks.push({
      x: midX + (f - oCentre) * oPx, major,
      label: k % oLabelEvery === 0 ? String(Math.round(f)) : undefined,
    });
  }

  // Band chips sit in a printed panel at the left edge. Without the backing
  // plate the scrolling numbers slide straight through the label — "FM" and
  // "102" collided into "FM02" — and a number half-hidden behind the plate
  // reads as a different, shorter number, so any number that would overlap it
  // is dropped outright rather than clipped.
  const underPlate = (x: number, text: string, dot: number, gap: number, right: number) =>
    x - dmWidth(text, dot, gap) / 2 < right + 6;

  return (
    // pointerEvents none is CRITICAL: on iOS the Svg otherwise swallows
    // touches, so drags starting on the ruler never reach the tune gesture.
    <Svg width={width} height={H} pointerEvents="none">
      {/* Live scale numbers */}
      {ticks.filter((t) => t.label && !underPlate(t.x, t.label!, 2.1, 0.8, 40)).map((t, i) => (
        <DotMatrixGroup key={`fl${i}`} text={t.label!} x={t.x} y={6} dot={2.1} gap={0.8}
          color="#CFE6FF" anchor="middle" opacity={0.85} />
      ))}
      <Rect x={0} y={0} width={40} height={30} fill="#050912" opacity={0.9} rx={6} />
      <DotMatrixGroup text={band} x={9} y={6} dot={2.1} gap={0.8} color={color} opacity={0.95} />

      {/* Live ticks hanging down onto the band */}
      {ticks.map((t, i) => (
        <Line key={i} x1={t.x} y1={baseY} x2={t.x} y2={baseY - t.h}
          stroke={t.major ? 'rgba(214,234,255,0.85)' : 'rgba(214,234,255,0.32)'}
          strokeWidth={t.major ? 2 : 1} />
      ))}

      {/* The lit band itself */}
      <Rect x={0} y={baseY} width={width} height={2.5} fill="#9FD8FF" opacity={0.55} />

      {/* The printed band below */}
      {oTicks.map((t, i) => (
        <Line key={`a${i}`} x1={t.x} y1={baseY + 4} x2={t.x} y2={baseY + 4 + (t.major ? 14 : 8)}
          stroke={t.major ? 'rgba(214,234,255,0.6)' : 'rgba(214,234,255,0.22)'}
          strokeWidth={t.major ? 2 : 1} />
      ))}
      {oTicks.filter((t) => t.label && !underPlate(t.x, t.label!, 1.7, 0.62, 34)).map((t, i) => (
        <DotMatrixGroup key={`al${i}`} text={t.label!} x={t.x} y={baseY + 22} dot={1.7} gap={0.62}
          color="#9FD8FF" anchor="middle" opacity={0.5} />
      ))}
      <Rect x={0} y={baseY + 18} width={34} height={26} fill="#050912" opacity={0.9} rx={6} />
      <DotMatrixGroup text={other} x={8} y={baseY + 22} dot={1.7} gap={0.62} color="#9FD8FF" opacity={0.6} />

      {/* Station markers — only this band's, in each station's own colour */}
      {DIAL_STATIONS.map((st) => {
        const d = DIAL.get(st.id);
        if (!d || d.band !== band) return null;
        const x = midX + (d.value - freq) * cfg.px;
        if (x < -20 || x > width + 20) return null;
        const c = st.eqColors?.[1] ?? '#ffffff';
        return (
          <Fragment key={st.id}>
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

/**
 * The band button, where a head unit keeps it: on the status row. Tapping a
 * band tunes to its first station, which is what a real receiver does — the
 * band and the music move together.
 *
 * Styled as two physical keys rather than two more labels. The first version
 * used the same flat dot-matrix type as STEREO and TUNED beside it, so it read
 * as printed text and nobody would think to press it: the keys now have a
 * raised bezel, the pressed one lights up with its own lamp, and the hint
 * under the dial names the gesture.
 */
function BandSwitch({ band, accent, onPick }: { band: Band; accent: string; onPick: (b: Band) => void }) {
  return (
    <View style={fs.bandSwitch}>
      {(['AM', 'FM'] as Band[]).map((b) => {
        const on = b === band;
        return (
          <TouchableOpacity
            key={b}
            onPress={() => onPick(b)}
            activeOpacity={0.65}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`${b} band`}
            accessibilityState={{ selected: on }}
            style={[
              fs.bandKey,
              on && {
                backgroundColor: accent + '33',
                borderColor: accent + 'AA',
                shadowColor: accent,
                shadowOpacity: 0.75,
              },
            ]}>
            {/* Top-edge catch — what makes a flat rectangle read as a key */}
            <View style={[fs.bandKeyBevel, on && { backgroundColor: 'rgba(255,255,255,0.34)' }]} />
            <View style={[fs.bandLamp, { backgroundColor: on ? accent : 'rgba(255,255,255,0.16)' }]} />
            <DotMatrixText text={b} dot={1.7} gap={0.62} color={on ? '#ffffff' : '#8A93AB'} dim={false} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TunerReadout({ width, accent, band, freq, lock, playing, title, artist, hasTrack, onBand, compact = false, wide = false }: {
  width: number; accent: string; band: Band; freq: number; lock: number; playing: boolean;
  title: string; artist: string; hasTrack: boolean; onBand: (b: Band) => void;
  /** Landscape: the panel's HEIGHT is fixed by its dot sizes, not its width,
   *  so making it narrower saves nothing. This trims the paddings and row
   *  gaps instead — about 40pt, which is what the readout + dial + hint stack
   *  needs to fit a 393pt-tall screen. */
  compact?: boolean;
  /**
   * WIDE AND SHORT, for landscape — owner, 18.08: "the tuner mode in
   * landscape should extend rather stay in the small box."
   *
   * The box was small because of HEIGHT, not width. Portrait stacks four rows
   * — lamp, song, status, frequency — and that stack is taller than a 393pt
   * screen once the dial and the hint are under it, so the panel had been
   * shrunk to 44% of the screen to fit. Shrinking a panel to make a stack fit
   * is treating the symptom: it left a wide pane with a small box floating in
   * the middle of it, and the panel still ran off the top.
   *
   * A real head unit in a wide slot does not stack; it puts the frequency
   * beside the rest. So the frequency moves into its own right-hand column,
   * which halves the height and spends the width — and the panel can then
   * fill its pane, which is what "extend" means here.
   */
  wide?: boolean;
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
  // How wide the song line may run. In the wide layout the frequency column
  // sits beside it, so the text has to give that space up or it would set the
  // row's width and push the frequency off the panel.
  const padV = compact ? 14 : 26;
  const rowGap = compact ? 14 : 24;

  const LAMP = { dot: 1.7, gap: 0.62 };
  // The song gets the panel's whole width on its own line rather than sharing
  // a row with the lamp. Sharing left it about ten characters wide, which is
  // what kept the title small; full width buys both bigger dots AND more of
  // the name visible before it has to scroll.
  // Wide trims both the song and the frequency a little, and every point it
  // saves goes to the song's window: at the full portrait sizes the panel had
  // room for about seven characters beside the frequency, so even "CRUISE FM"
  // had to scroll. The frequency stays the biggest thing on the panel, which
  // is what a head unit looks like.
  const TITLE = wide ? { dot: 3.1, gap: 1.0 } : { dot: 3.5, gap: 1.15 };
  const ART = { dot: 2.1, gap: 0.78 };
  const SMALL = { dot: 1.7, gap: 0.62 };
  const BIG = wide ? { dot: 4.0, gap: 1.3 } : { dot: 4.6, gap: 1.5 };

  // MEASURED, NOT GUESSED. A constant sized for AM's "AM 810" is 40pt too
  // narrow for FM's "FM 94.70", and the song line does not shrink — it has an
  // explicit width, so the row simply overflowed and the frequency printed
  // straight over the title (caught on the render, FM band). The frequency's
  // width is knowable, so take it.
  const FREQ_GAP = 20;
  const freqW = dmWidth(band, BIG.dot, BIG.gap)
    + FREQ_GAP
    + dmWidth(BAND_CFG[band].label(freq), BIG.dot, BIG.gap);
  const textW = width - PAD * 2 - (wide ? freqW + 24 : 0);

  const lampOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  // The lamp, the song and the status lamps — the panel's left-hand business,
  // and in portrait simply the top of the stack.
  const songBlock = (
    <>
      {/* The ON AIR lamp, on its own line above the song */}
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: onAir ? lampOpacity : 0.34 }}>
        <View style={[fs.lamp, {
          backgroundColor: onAir ? ON_AIR_RED : 'rgba(255,255,255,0.22)',
          shadowColor: ON_AIR_RED, shadowOpacity: onAir ? 0.95 : 0, shadowRadius: 6,
        }]} />
        <DotMatrixText text="ON AIR" dot={LAMP.dot} gap={LAMP.gap} color={onAir ? '#FF6B5A' : '#9AA3B8'} dim={false} />
      </Animated.View>

      {/* What's playing, across the panel's full text width */}
      <View style={{ marginTop: compact ? 10 : 18, gap: compact ? 7 : 11 }}>
        <DmLine text={hasTrack ? title : 'CRUISE FM'} width={textW} dot={TITLE.dot} gap={TITLE.gap} color={accent} align="left" />
        {hasTrack && !!artist && (
          <DmLine text={artist} width={textW} dot={ART.dot} gap={ART.gap} color={accent} dim={false} align="left" />
        )}
      </View>
    </>
  );

  /** Band button and the status lamps of a real receiver. */
  const statusRow = (
    <View style={[fs.lcdRow, { marginTop: wide ? 12 : rowGap }]}>
      <BandSwitch band={band} accent={accent} onPick={onBand} />
      <DotMatrixText text="STEREO" dot={SMALL.dot} gap={SMALL.gap} color="#FFA24B" dim opacity={onAir ? 1 : 0.32} />
      <DotMatrixText text="TUNED" dot={SMALL.dot} gap={SMALL.gap} color={accent} dim opacity={0.3 + lock * 0.7} />
    </View>
  );

  // Band and frequency — the biggest thing on the panel. Under the rest in
  // portrait, beside it in a wide slot.
  const readout = wide ? (
    // Its own column, so it needs a real gap rather than the stacked row's
    // space-between — with nothing to spread against, AM and 810 ran together
    // into "AM810".
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: FREQ_GAP }}>
      <DotMatrixText text={band} dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
      <DotMatrixText text={BAND_CFG[band].label(freq)} dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
    </View>
  ) : (
    <View style={[fs.lcdRow, { alignItems: 'flex-end', marginTop: compact ? 10 : 16 }]}>
      <DotMatrixText text={band} dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
      <DotMatrixText text={BAND_CFG[band].label(freq)} dot={BIG.dot} gap={BIG.gap} color={accent} dim opacity={0.55 + lock * 0.45} />
    </View>
  );

  if (wide) {
    return (
      <View style={[fs.lcd, { width, borderColor: accent + '2E', paddingVertical: padV }]}>
        {/* Song on the left, frequency on the right, and the status lamps on
            their own full-width row underneath — which is also where a real
            receiver puts them, beside nothing and reading straight across.
            Squeezing AM/FM, STEREO and TUNED into the left-hand column was
            the first attempt and they overlapped: three items on a
            space-between row need the panel's whole width, not a third of
            it. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
          {/* minWidth 0 is load-bearing on a flex row: without it the song
              line sets the row's minimum width and pushes the frequency off
              the panel's right edge instead of shrinking. */}
          <View style={{ flex: 1, minWidth: 0 }}>{songBlock}</View>
          {readout}
        </View>
        {statusRow}
      </View>
    );
  }

  return (
    <View style={[fs.lcd, { width, borderColor: accent + '2E', paddingVertical: padV }]}>
      {songBlock}
      {statusRow}
      {readout}
    </View>
  );
}

export function TunerFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const topPad = Math.max(insets.top, 20);

  // How far the dial sits below the head unit. The owner wanted it lower, but
  // the panel and the dial are both fixed-height blocks inside one centred
  // column, so a flat 52 would run off the bottom of a short phone. Scaled to
  // the screen: full separation on a big handset, tight on a small one.
  const dialGap = Math.round(clamp((winH - 640) * 0.18, 14, 56));

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const [band, setBand] = useState<Band>(() => bandOf(stationId ?? 'night-run'));
  const [freq, setFreq] = useState(() => dialValue(stationId ?? 'night-run'));
  const freqRef = useRef(freq);
  useEffect(() => { freqRef.current = freq; }, [freq]);
  // The pan handler is created once, so it reads the band through a ref rather
  // than closing over a stale value.
  const bandRef = useRef(band);
  useEffect(() => { bandRef.current = band; }, [band]);

  const lockedStation = resolveAnyStation(activeId);
  const { station: nearest, lock } = nearestStation(band, freq);
  const eq = (nearest.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as [string, string, string];
  const accent = eq[1];

  const spotify = useMusicPlayback(visible);

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

  // Noise flicker clock. GATED ON BEING OFF-STATION, which is the whole point:
  // the only thing `phase` drives is StaticNoise, drawn at `offAir` opacity, so
  // once the dial locks on there is nothing to animate — yet this used to keep
  // re-rendering the entire fullscreen Tuner 25 times a second for the whole
  // drive, dial and dot-matrix and all. Tuned in, it now stops dead.
  const noisy = lock < 0.98;
  useEffect(() => {
    if (!visible || !noisy) return;
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
  }, [visible, noisy]);

  // ── Drag-to-tune ─────────────────────────────────────────────────────────────
  const startFreqRef = useRef(0);
  const snapRaf = useRef(0);
  const lastTickRef = useRef(0);
  const lastHapticRef = useRef(0);
  // Bumped when custom stations join the dial, so the scale redraws with
  // their markers on it.
  const [, setDialVersion] = useState(0);

  const cancelSnap = () => { if (snapRaf.current) cancelAnimationFrame(snapRaf.current); snapRaf.current = 0; };

  const tuneTo = (f: number) => {
    const cfg = BAND_CFG[bandRef.current];
    const v = clamp(f, cfg.min, cfg.max);
    // Haptic tick every couple of ticks swept (native only).
    //
    // RATE-LIMITED, AND THE LIMIT IS LOAD-BEARING. A tick bucket is 0.2 MHz on
    // FM / 20 kHz on AM, and a brisk sweep crosses more than one per frame, so
    // the bucket check alone let this fire on essentially every touch move —
    // ~60 a second, unbounded. Saturating the haptic queue stalls the main
    // thread, during exactly the gesture that was reported as freezing the app
    // (23.08). The bucket stays as the coarse gate; the clock is the ceiling.
    const bucket = Math.round(v / (cfg.tick * 2));
    if (bucket !== lastTickRef.current) {
      lastTickRef.current = bucket;
      const now = Date.now();
      if (Platform.OS !== 'web' && now - lastHapticRef.current >= HAPTIC_MIN_MS) {
        lastHapticRef.current = now;
        Haptics.selectionAsync().catch(() => {});
      }
    }
    setFreq(v);
  };

  /**
   * Settle onto a station. `projected` is where a flick would have carried the
   * needle if it kept going — the snap picks its station from THERE, but the
   * animation still starts from where the finger actually left off, so a throw
   * reads as one continuous sweep rather than a jump.
   */
  const snapToNearest = (projected?: number) => {
    cancelSnap();
    const { station } = nearestStation(bandRef.current, projected ?? freqRef.current);
    const target = dialValue(station.id);
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
          tuneTo(startFreqRef.current - g.dx / BAND_CFG[bandRef.current].px);
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
        // MOMENTUM. Without this the release velocity was thrown away and the
        // needle snapped back to whichever station was nearest at the instant
        // the finger lifted — so unless one drag crossed the halfway point to
        // the next station, the dial pulled straight back. FM stations sit
        // 1.6-2.6 MHz apart, which is 115-187px at this rate, so that was most
        // drags. Owner, 10.08: "it feels like an elastic band where I have to
        // keep pulling to change stations."
        //
        // vx is points per millisecond, so carrying it for GLIDE_MS is the
        // distance a real dial would coast. A gentle drag has almost no
        // velocity and still lands on the nearest station, which keeps fine
        // tuning intact; a flick now travels several stations, as it should.
        const cfg = BAND_CFG[bandRef.current];
        const glided = freqRef.current - (g.vx * GLIDE_MS) / cfg.px;
        snapToNearest(clamp(glided, cfg.min, cfg.max));
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
    // Fold the user's own stations in BEFORE reading the dial position — the
    // cache is usually already warm (the stations page and the mini-player
    // both fill it), so this is normally synchronous in effect. The async
    // reload below covers a cold start, where the dial would otherwise place
    // a custom station at the 92.1 fallback for a frame.
    registerCustomOnDial(cachedCustomStations());
    const b = bandOf(id);
    setBand(b);
    bandRef.current = b;
    setFreq(dialValue(id));
    loadCustomStations().then((list) => {
      registerCustomOnDial(list);
      // Re-seat the needle in case this station only became known just now.
      setBand(bandOf(id));
      bandRef.current = bandOf(id);
      setFreq(dialValue(id));
      setDialVersion((v) => v + 1);
    }).catch(() => {});
    slideY.setValue(winH);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => cancelSnap();
  }, [visible]);

  /** Flipping bands tunes straight to that band's first station, the way a
   *  real receiver does — the band and what you're hearing move together. */
  const pickBand = (b: Band) => {
    if (b === bandRef.current) return;
    cancelSnap();
    const station = firstOnBand(b);
    bandRef.current = b;
    setBand(b);
    const v = dialValue(station.id);
    setFreq(v);
    freqRef.current = v;
    setActiveId(station.id);
    npSetStation(station.id);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleClose = () => {
    cancelSnap();
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };
  // The dial pan was created before handleClose exists — it reaches it here.
  closeRef.current = handleClose;

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

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    // BOTH orientations now — portrait rests the same way (useRestScene).
    active: visible, playing, sheetOpen: showMood || showPicker,
  });
  // Slide only, no scale: the dial is a full-width INSTRUMENT and shrinking
  // it just makes the frequencies unreadable. Sliding puts the needle at the
  // centre of the left pane while the deck is docked, and at true centre at
  // rest; the dial simply continues behind the panel, which is what a real
  // head unit's scale does anyway.
  const deckScene = useDeckScene(chrome, winW, 1, isLandscape);
  // The scene re-centres itself once the controls have gone. MEASURED rather
  // than assumed, so each mode's own deliberate offsets survive — see
  // restShiftFor in LandscapeChrome.
  const [contentH, setContentH] = useState(0);
  const [sceneBox, setSceneBox] = useState({ y: 0, h: 0 });
  const restScene = useRestScene(chrome, restShiftFor(contentH, sceneBox.y, sceneBox.h), !isLandscape);

  // Real song when connected, else the mood's own line — never a fake track.
  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? lockedStation.tagline;
  const artist = spotify.track?.artist ?? '';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const offAir = 1 - lock;

  // ── LANDSCAPE — the dial gets the whole width ─────────────────────────────
  // This was the one mode held back from landscape: turning it sideways with
  // the portrait column would have squashed the head-unit display, and the
  // dial deserved a composition of its own (owner, 30.07). Sideways is
  // actually the dial's natural shape — a receiver's scale is a wide strip —
  // so the readout sits above it and the scale runs edge to edge.
  if (isLandscape) {
    return (
      <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
        <Animated.View
          style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]}
          {...dismissPan.panHandlers}
          onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

          <StationBackdrop station={lockedStation} blurRadius={2.5} />
          <ModeScrim station={lockedStation} />
          <LinearGradient
            colors={['transparent', accent + '22', 'transparent']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: '20%', bottom: '25%' }}
            pointerEvents="none"
          />

          {/* Drag anywhere across this whole area to tune. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { justifyContent: 'center' }, deckScene]}
            {...pan.panHandlers}>
            {/* The readout FILLS ITS PANE. It used to be sized DOWN for
                landscape — 44% of the screen — because its height scales with
                its width, and the readout + dial + hint stack was taller than
                a 393pt screen. That fixed the overflow by shrinking the one
                thing the user came to look at, and left a small box adrift in
                a wide pane (owner, 18.08). The `wide` layout puts the
                frequency beside the song instead of under it, which halves
                the height, so the panel can take the pane the docked chrome
                leaves it. */}
            <View style={{ alignItems: 'center' }}>
              <TunerReadout
                width={Math.min(winW * (1 - DECK_FRAC) - 36, 560)}
                compact
                wide
                accent={accent}
                band={band}
                onBand={pickBand}
                freq={freq}
                lock={lock}
                playing={live}
                title={title}
                artist={artist}
                hasTrack={hasTrack}
              />
            </View>
            <View style={{ marginTop: 14 }}>
              <DialFace>
                <DialRuler band={band} freq={freq} width={winW} color={accent} lock={lock} />
                <StaticNoise width={winW} height={116} phase={phase} opacity={offAir * 0.55} />
                <Text style={[fs.dragHint, { fontFamily: Fonts.mono }]}>tap am / fm  ·  drag to tune</Text>
              </DialFace>
            </View>
          </Animated.View>

          <LandscapeChrome
            chrome={chrome}
            rested={chromeRested}
            station={lockedStation}
            track={spotify.track}
            playing={playing}
            tagline={lockedStation.tagline}
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

          <AmbientGlow active={visible && live} beat={visible && live} trackKey={spotify.track?.title ?? null} color={eq[1]} />
          <WakeSpotifyHint show={playing && !spotify.track && !handoff} connected={spotify.connected} />
          {handoff && !spotify.track && <HandoffOverlay />}
          <PreviewGate onSilence={spotify.pause} />

          <ModeSheet visible={showMood} onClose={() => setShowMood(false)} />

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

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        /* Passive touch sniffer — never claims the gesture, just brings the
           rested chrome back. Must sit on the root so it sees taps on the
           dial, the buttons and the empty scene alike. */
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

        {/* Locked station scene, darkened; mood tint follows the needle */}
        <StationBackdrop station={lockedStation} blurRadius={2.5} />
        <ModeScrim station={lockedStation} />
        <LinearGradient
          colors={['transparent', accent + '22', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: '25%', bottom: '30%' }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <Animated.View style={{ opacity: chrome, position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Animated.View>

        {/* Top bar */}
        <Animated.View style={[fs.topBar, { top: topPad + 14 }, { opacity: chrome }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>TUNER</Text>
        </Animated.View>

        {/* Content */}
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
          <Animated.View style={{ opacity: chrome, paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={lockedStation} />
          </Animated.View>

          {/* ── The dial — drag anywhere in this zone to tune ── */}
          <Animated.View
            style={[{ flex: 1, justifyContent: 'center' }, restScene]}
            onLayout={(e) => setSceneBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
            {...pan.panHandlers}>

            {/* The head-unit display */}
            <View style={{ alignItems: 'center' }}>
              <TunerReadout
                width={Math.min(winW - 32, 420)}
                accent={accent}
                band={band}
                onBand={pickBand}
                freq={freq}
                lock={lock}
                playing={live}
                title={title}
                artist={artist}
                hasTrack={hasTrack}
              />
            </View>

            {/* Ruler + static */}
            <View style={{ marginTop: dialGap }}>
              <DialFace>
                <DialRuler band={band} freq={freq} width={winW} color={accent} lock={lock} />
                <StaticNoise width={winW} height={116} phase={phase} opacity={offAir * 0.55} />
                {/* Notes only flow once the needle locks onto a station */}
                <FloatingNotes playing={live && lock > 0.9} color={accent} />
                <Text style={[fs.dragHint, { fontFamily: Fonts.mono }]}>tap am / fm  ·  drag to tune</Text>
              </DialFace>
            </View>
          </Animated.View>

          {/* EVERYTHING BELOW THE DIAL RESTS TOGETHER. pointerEvents goes
              off once it is invisible, or the tap meant to bring the controls
              back would press whatever button it landed on. */}
          <Animated.View
            style={{ alignSelf: 'stretch', opacity: chrome }}
            pointerEvents={chromeRested ? 'none' : 'auto'}>

          {/* With a song on the display there's nothing to repeat here — the
              mood line only appears when there's no track to show. */}
          {!hasTrack && (
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0 }} numberOfLines={2}>{title}</Text>
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

          {/* Left-aligned action pills — same row, same spot as every mode */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={lockedStation}
          />
          </Animated.View>
        </View>

        <ModeCloseButton onPress={handleClose} chrome={chrome} rested={chromeRested} />

        <AmbientGlow active={visible && live} beat={visible && live} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && !spotify.track && !handoff} connected={spotify.connected} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

        <ModeSheet visible={showMood} onClose={() => setShowMood(false)} />

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
  bandSwitch: { flexDirection: 'row', gap: 6 },
  bandKey: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)',
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 7,
    overflow: 'hidden',
  },
  bandKeyBevel: {
    position: 'absolute', top: 0, left: 4, right: 4, height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bandLamp: { width: 4, height: 4, borderRadius: 2 },
  dragHint: { color: 'rgba(255,255,255,0.26)', fontSize: 8, fontWeight: '600', letterSpacing: 1.6, textAlign: 'center', marginTop: 10 },
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
