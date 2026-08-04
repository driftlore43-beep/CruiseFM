import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path,
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
import { LandscapeChrome, useDeckScene, useIsoLayoutEffect } from '@/components/LandscapeChrome';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { buildFlipbook, FlipbookGrid } from '@/components/MirrorBallFlipbook';
import { ModeActionRow } from '@/components/ModeActionRow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;
const DEMO_DURATION_MS = 214000;
// One full turn of the ball. A real hanging mirror ball turns at roughly
// 3-5 RPM, and 15s per revolution is 4 — deliberately slow (owner, 28.07).
// Anything quicker reads as a toy spinning, and it also makes the light
// sweeping across the room look frantic rather than like stage lighting.
const BALL_SPIN_MS = 15000;
// How long the controls stay up after you last touched the screen. Long
// enough to read the song and reach the skip button; short enough that the
// ball is alone in the dark for most of a drive.
const CHROME_REST_MS = 6000;


function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── The mirror ball ───────────────────────────────────────────────────────────
// A "spinning globe" trick, not an in-plane rotate: the facet texture is
// built ONCE (useMemo) as a strip exactly one ball-width wide, rendered
// TWICE side by side, and the pair slides via a single native-driver
// translateX loop inside a circular clip. Because the two copies are
// identical, the loop wraps with zero seam, and it reads as the sphere's
// surface genuinely turning on a vertical axis — the old whole-circle
// `rotate` looked like a flat coin spinning in the picture plane, which is
// what prompted this rebuild. Everything suggesting light/depth (shading,
// rim, highlight, sparkle) is a SEPARATE layer that never moves — real
// light doesn't rotate with the ball, only the mirrors turning underneath it do.

// Deterministic pseudo-random 0..1 from an integer seed (no Math.random —
// the facet grid must render identically every time it's memoized).
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Cheap two-stop hex mix, used by the colour wash.
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

// THE BALL IS CHROME. This ramp is the mirror's own material and it is
// neutral silver on every station, by rule (owner, 28.07): "the mood should
// control the lighting, not the mirror ball itself". Rounds 11-19 kept
// pushing the station's colour into the material and the ball came out as a
// coloured sphere rather than a mirrored one — a real ball stays silver in a
// red room, it just carries red reflections.
//
// DEAD NEUTRAL, deliberately. The first chrome ramp was "slightly cool"
// silver — i.e. blue-tinted — and on a warm station's backdrop those
// blue-grey mirrors read as TEAL (owner screenshot, Sunset AM, 28.07).
// A hue that only shows on half the stations is worse than no hue. The
// metallic look comes from the WIDE range (near-black shadows, blown-white
// highlights) and the per-tile scatter, never from tinting the greys —
// a narrow ramp reads as matte plastic, a tinted one as coloured glass.
const SHADE_ANCHORS = ['#0a0a0b', '#191a1b', '#343537', '#646568', '#a2a3a5', '#dcdcde', '#ffffff'];

// NOTE (2026-07-26): this mode used to carry a fixed club-neon set
// (cyan/magenta/purple/blue) blended alongside the station's own colours.
// It was removed — it put pinks and teals on every ball regardless of mood,
// which read as random rather than deliberate. Everything coloured here now
// comes from stationPalette() below. Don't reintroduce a fixed palette.

/**
 * Everything coloured on this ball draws from here: the station's own three
 * mood stops, plus a lighter and a deeper version of each. That gives the
 * surface plenty of variety without ever introducing a hue the station
 * doesn't own — the ball reads as this station's ball, on every station.
 */
function stationPalette(eq: [string, string, string]): string[] {
  const out: string[] = [];
  for (const c of eq) {
    out.push(c);
    // Kept nearer the station's own stop than they used to be — the pale
    // version was mixed 42% into white, which is most of a pastel, and with
    // nine of these driving every mirror's cast the whole ball drifted toward
    // dusty. Light and dark, still obviously the same colour.
    out.push(mixHex(c, '#ffffff', 0.28));
    // Deepened toward a NEUTRAL dark. This used to mix toward #141726 — a
    // navy — which dragged every station's deep variant off-hue toward teal.
    out.push(mixHex(c, '#161617', 0.42));
  }
  return out;
}





// Viewing tilt — essentially HEAD ON (owner, 27.07). It used to be 0.30 (~17°)
// so we looked down on the ball and its top cap and rosette were on show.
//
// The old comment here warned that dead-level would make the latitude rings
// project to straight horizontal lines and read as a flat brick wall. That
// was true of the old build, which faked the surface with a scrolling texture
// strip. It is NOT true now: the tiles are a genuine sphere projection, so
// the columns still pinch toward the silhouette and the shading still falls
// off, and rendering it at 0.30 / 0.10 / 0.04 / 0 side by side showed no loss
// of roundness at all. A sliver of tilt is kept so the rings retain a whisper
// of arc and the poles never land exactly on the silhouette (z = 0 there,
// which is the degenerate case for the back-face cull).
const TILT = 0.05;                       // ~3°, effectively head on










// The one moving layer on the ball: soft light patches (plus a few tight hot
// spots that read as individual mirrors catching the beam) scrolling behind
// the static grid. Two identical copies, one native-driver translateX loop
// — the seam-tiling contract from the original build, unchanged.
type LightBlob = { x: number; y: number; r: number; g: string };


// One period of the light texture, exactly `size` wide. Each blob is drawn at
// its own position and one period either side, so the face is self-contained:
// two of them side by side tile with no seam.
function LightFace({ size, eq, blobs, sfx }: {
  size: number; eq: [string, string, string]; blobs: LightBlob[]; sfx: string;
}) {
  const gid = (n: string) => `${n}${sfx}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        {/* Hot and tight — these are what read as an individual mirror
            catching the beam as it comes round. Contrast against the dark
            base below is the whole effect; keep them near-white. */}
        <RadialGradient id={gid('lpHot')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="55%" stopColor="#ffffff" stopOpacity="0.55" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        {/* All held well down since round 13. This layer used to be the ball's
            main brightness, showing through semi-transparent tiles — which lit
            the WHOLE mosaic evenly and made the static pattern the loudest
            thing on screen. It is now just a broad underglow; the mirrors get
            their light from MirrorFlash, one at a time. */}
        <RadialGradient id={gid('lpSoft')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.44" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={gid('lpCool')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={eq[0]} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={eq[0]} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={gid('lpBig')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.50" />
          <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.19" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="#080809" />
      {[-1, 0, 1].map((k) =>
        blobs.map((b, i) => (
          <Circle key={`${k}_${i}`} cx={b.x + k * size} cy={b.y} r={b.r} fill={`url(#${gid(b.g)})`} />
        )),
      )}
    </Svg>
  );
}

/**
 * COLOURED LIGHT LANDING ON SILVER — not a tint over the whole ball.
 *
 * This replaced a stack of three full-ball colour slabs (ColorCycleWash).
 * A slab covering the entire sphere is exactly the thing that made the ball
 * read as a coloured ball rather than a mirrored one, and it also cancelled
 * the travelling light underneath it (measured back in round 6). What a real
 * ball shows is coloured lamps reaching PARTS of it, with bare chrome in
 * between — so these are soft patches, each fading in and out on its own slow
 * period, and at no moment do they cover more than a fraction of the surface.
 *
 * They do NOT ride the spin: a lamp is bolted to the room, so its reflection
 * stays put on the near face while the mirrors travel through it.
 */
function ColourReflections({ size, eq, lit }: { size: number; eq: [string, string, string]; lit: Animated.Value }) {
  // Patch 5 is deliberately NEUTRAL — a cool-white ambient reflection of the
  // room itself, so the mood colours always sit alongside plain light and the
  // ball never reads as fully tinted (the owner's brief, 30.07: white light
  // stays dominant, theme colour tints only).
  const patches = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    cx: 18 + hash01(i * 4.13 + 0.7) * 64,
    cy: 16 + hash01(i * 7.91 + 1.3) * 66,
    // Small enough that several can be alight without covering the ball. At
    // r=40 (of a 100 viewBox) one patch is 80% of the diameter and you are
    // back to a tinted sphere.
    r: 13 + hash01(i * 3.37 + 2.9) * 15,
    // First and last stops weighted over the middle one — the outer stops
    // are where a station's character lives (Sunset: amber and magenta; its
    // middle coral mostly just averages them).
    color: i === 5 ? '#e9edf5' : eq[[0, 2, 1, 0, 2][i % 5]],
    peak: i === 5 ? 0.10 + hash01(i * 9.7) * 0.08 : 0.20 + hash01(i * 9.7) * 0.16,
    dur: 3800 + Math.floor(hash01(i * 5.5) * 4200),
    delay: Math.floor(hash01(i * 2.3) * 3600),
  })), [eq]);

  const fade = useRef(patches.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = patches.map((p, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(fade[i], { toValue: 1, duration: p.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(fade[i], { toValue: 0, duration: p.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [patches]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
      {patches.map((p, i) => (
        <Animated.View
          key={i}
          style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(fade[i].interpolate({ inputRange: [0, 1], outputRange: [0.02, p.peak] }), lit) }]}
        >
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`dbRef${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={p.color} stopOpacity="1" />
                <Stop offset="55%" stopColor={p.color} stopOpacity="0.42" />
                <Stop offset="100%" stopColor={p.color} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={p.cx} cy={p.cy} r={p.r} fill={`url(#dbRef${i})`} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}



// A single soft neon streak drifting down across the ball on its own slow
// yo-yo loop (opacity + translateY only — native driver). Four of these,
// one per station stop at staggered periods/phases, are what read as "coloured
// reflections moving across the surface" rather than another flat tint.
function NeonStreak({ size, color, angleDeg, widthPct, duration, delay, peak, pulse }: {
  size: number; color: string; angleDeg: number; widthPct: number; duration: number; delay: number; peak: number;
  pulse: Animated.Value;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const travel = size * 1.1;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  const baseOpacity = t.interpolate({ inputRange: [0, 0.15, 0.5, 0.85, 1], outputRange: [0, peak, peak * 0.45, peak, 0] });
  const pulseNudge = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.18] });
  const streakW = size * widthPct;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: size / 2 - streakW / 2, top: -size * 0.2, width: streakW, height: size * 1.4,
      opacity: Animated.multiply(baseOpacity, pulseNudge),
      transform: [{ rotate: `${angleDeg}deg` }, { translateY }],
    }}>
      <LinearGradient
        colors={['transparent', color, 'transparent']}
        locations={[0.2, 0.5, 0.8]}
        style={{ flex: 1, borderRadius: streakW / 2 }}
      />
    </Animated.View>
  );
}

// Four neon streaks (cyan/magenta/purple/blue), independent speeds and
// phases so they cross each other rather than moving in lockstep — clipped
// by the ball's own circular overflow:hidden, so they only ever show up
// where the sphere is.
function NeonSweep({ size, eq, pulse }: { size: number; eq: [string, string, string]; pulse: Animated.Value }) {
  // Station stops only — a fixed neon set here was part of what put foreign
  // hues on every ball.
  const light = (hex: string) => mixHex(hex, '#ffffff', 0.30);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Held back since the chrome rebuild: ColourReflections is now the
          main coloured-light layer, and two systems tinting the same surface
          adds up to the whole-ball wash both are meant to avoid. */}
      <NeonStreak size={size} color={light(eq[0])} angleDeg={18}  widthPct={0.30} duration={4200} delay={0}    peak={0.13} pulse={pulse} />
      <NeonStreak size={size} color={light(eq[2])} angleDeg={-24} widthPct={0.24} duration={5100} delay={900}  peak={0.11} pulse={pulse} />
      <NeonStreak size={size} color={light(eq[1])} angleDeg={10}  widthPct={0.20} duration={4700} delay={1700} peak={0.10} pulse={pulse} />
      <NeonStreak size={size} color={light(eq[2])} angleDeg={-14} widthPct={0.26} duration={5600} delay={2500} peak={0.12} pulse={pulse} />
    </View>
  );
}


// A soft radial halo bleeding OUTSIDE the ball's own circular clip — the
// cheap, established way to fake bloom in this codebase (layered translucent
// gradients, same trick as AmbientGlow's Haze) since RN has no blur filter.
// Sized well past the ball so it reads as light spilling into the room, not
// a rim on the sphere itself.
function BallBloom({ size, color, pulse }: { size: number; color: string; pulse: Animated.Value }) {
  const bloomSize = size * 2.3;
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.62] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.05] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: bloomSize, height: bloomSize,
      left: (size - bloomSize) / 2, top: (size - bloomSize) / 2,
      opacity, transform: [{ scale }],
    }}>
      <Svg width={bloomSize} height={bloomSize}>
        <Defs>
          <RadialGradient id="dbBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <Stop offset="45%" stopColor={color} stopOpacity="0.16" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={bloomSize / 2} cy={bloomSize / 2} r={bloomSize / 2} fill="url(#dbBloom)" />
      </Svg>
    </Animated.View>
  );
}


// The single soft specular where the key light hits strongest (owner's
// premium round, 30.07: "one or two bright specular highlights"). NOT a hard
// hotspot — round 4 proved a hard ellipse reads as a painted blob sitting on
// the ball. This is all falloff: a small radial gradient at the key light's
// upper-left, breathing slowly on its own period, and it goes out with the
// music like every other piece of light.
/**
 * A SPOTLIGHT PANNING ACROSS THE BALL.
 *
 * Replaces the diagonal sheen band, which swept corner to corner at a fixed
 * angle and read as a decorative streak laid over the picture rather than
 * light arriving from somewhere (owner, 31.07).
 *
 * This is built from the geometry instead. A light coming from direction L
 * lights the part of the sphere whose surface faces it, so the bright pool
 * sits at the screen point R·L — and because that patch is a disc on a
 * sphere seen at an angle, it projects to an ELLIPSE, squashed along the
 * line back to the ball's centre by exactly L.z and turned to face it. So as
 * the light swings toward the edge, its pool narrows and leans, the way a
 * real beam does on a real ball. A circle that merely slid about would read
 * as a sticker.
 *
 * The light's direction traces a slow Lissajous — the sideways swing and the
 * up-down drift run at different rates — so it arrives from a genuinely
 * different angle each pass instead of orbiting on rails.
 *
 * The ball's own fixed lamps stay: a room has lamps bolted to it AND a
 * moving spot, and the fixed ones are what make individual mirrors flare.
 */
const SPOT_MS = 11000;

/** The light's direction over one pass, sampled — shared by the pool ON the
 *  ball and the beam reaching it, so the two can never drift apart. */
function spotPath(R: number) {
  {
    const N = 72;
    const xs: number[] = [], tx: number[] = [], ty: number[] = [];
    const rot: string[] = [], sx: number[] = [], op: number[] = [], from: string[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = Math.sin(u * 2 * Math.PI) * 1.12;                    // swing, ±64°
      const e = 0.40 * Math.sin(u * 2 * Math.PI * 0.5 + 1.1);        // drift, slower
      const lx = Math.sin(a) * Math.cos(e);
      const ly = Math.sin(e);
      const lz = Math.cos(a) * Math.cos(e);
      xs.push(u);
      tx.push(R * lx);
      ty.push(-R * ly);
      // Turn the pool to face the ball's centre, then squash it along that
      // line by L.z — that pair IS the foreshortening.
      const bearing = (Math.atan2(-ly, lx) * 180) / Math.PI;
      rot.push(`${bearing.toFixed(2)}deg`);
      // The beam arrives FROM the light, i.e. from the opposite bearing.
      from.push(`${(bearing + 180).toFixed(2)}deg`);
      sx.push(Math.max(0.10, lz));
      // A beam raking the edge spreads over more surface and reads weaker.
      op.push(0.34 + 0.46 * lz);
    }
    return { xs, tx, ty, rot, sx, op, from };
  }
}


function SpotlightPan({ size, lit, pan, eq }: { size: number; lit: Animated.Value; pan: Animated.Value; eq: [string, string, string] }) {
  const R = size / 2;
  const tint = eq[1];
  const tintHi = mixHex(eq[0], '#ffffff', 0.35);
  const path = useMemo(() => spotPath(R), [R]);
  const i = (out: number[] | string[]) =>
    pan.interpolate({ inputRange: path.xs, outputRange: out as number[] });

  const pool = size * 0.40;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: R - pool, top: R - pool, width: pool * 2, height: pool * 2,
        opacity: Animated.multiply(lit, i(path.op)),
        transform: [
          { translateX: i(path.tx) },
          { translateY: i(path.ty) },
          { rotate: i(path.rot) as unknown as string },
          { scaleX: i(path.sx) },
        ],
      }}>
      <Svg width={pool * 2} height={pool * 2} viewBox="0 0 100 100">
        <Defs>
          {/* The spot carries the STATION's colour, so the mirrors it lands
              on go coloured and bright rather than the colour sitting behind
              the ball and in its shadows (owner, 31.07: "the colours are
              looking a bit unappreciated"). White at the very core, because
              the hottest part of any beam blows out to white whatever
              colour it is. */}
          <RadialGradient id="dbSpot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.44" />
            <Stop offset="0.22" stopColor={tintHi} stopOpacity="0.34" />
            <Stop offset="0.52" stopColor={tint} stopOpacity="0.16" />
            <Stop offset="1" stopColor={tint} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* The pool, and nothing else. A four-point star used to ride along
            inside it; on device that reads as a sticker sliding over the
            mirrors rather than light (owner, 02.08: "a light star moves across
            the ball making it look cheap"). The mirrors' own catch is the
            sparkle this mode needs. */}
        <Circle cx={50} cy={50} r={50} fill="url(#dbSpot)" />
      </Svg>
    </Animated.View>
  );
}

function KeySpecular({ size, lit }: { size: number; lit: Animated.Value }) {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 4400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, {
        opacity: Animated.multiply(breathe.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] }), lit),
      }]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="dbKeySpec" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <Stop offset="45%" stopColor="#ffffff" stopOpacity="0.30" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={33} cy={28} r={24} fill="url(#dbKeySpec)" />
      </Svg>
    </Animated.View>
  );
}

function MirrorBall({ size, eq, spin, pulse, lit, spotPan }: { size: number; eq: [string, string, string]; spin: Animated.Value; pulse: Animated.Value; lit: Animated.Value; spotPan: Animated.Value }) {
  const flip = useMemo(() => buildFlipbook(size, eq), [size, eq]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0b0b0c' }}>
      {/* The moving layer: light travelling across the surface as it turns.
          Held right back under the flipbook — it exists to move light over
          a STATIC grid, and over mirrors that already carry their own it
          is just a veil, which is what read as matte (owner, 31.07). */}

      {/* The sphere itself: six pre-built copies of the grid a fraction of a
          mirror apart, swapped in step with the spin, so the MIRRORS travel
          rather than light travelling over a still surface. */}
      <FlipbookGrid size={size} frames={flip} spin={spin} />

      {/* NO MERIDIANS. The rotating vertical seams were added back in round 12
          as the one structure that visibly turned, because the tile grid is
          static and only the light used to travel. The flashing-mirror layer
          below has since taken that job — each mirror snaps on and off as the
          lit band sweeps past it — and on the device the drawn verticals read
          as a wire cage over the chrome (owner, 31.07: "try the mirror
          animating without the vertical lines"). `RotatingMeridians` and
          `Meridian` are kept in the file, unused, because the two are hard to
          judge apart from a still and this is a straight swap back if the
          rotation stops reading. */}

      {/* Coloured lamps reaching PARTS of the surface — never the whole of
          it, so bare chrome always shows between them. This is where the
          station's mood lives now; the mirrors themselves are silver. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.22 }]} pointerEvents="none">
        <ColourReflections size={size} eq={eq} lit={lit} />
      </Animated.View>

      {/* Neon reflections — four independent streaks drifting across the
          surface, above the patches so they read as light moving over
          the facets rather than another flat tint. Gated on the music like
          every other light layer: nothing may drift across a stopped ball. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: 0.24 }]} pointerEvents="none">
        <NeonSweep size={size} eq={eq} pulse={pulse} />
      </Animated.View>

      {/* Fixed lighting — never scrolls, so it reads as a real light source */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* NEUTRAL. This gradient used to carry a station-coloured stop,
              which put the mood over the entire sphere — the exact thing the
              chrome rebuild exists to undo. The dark outer stops stay: they
              are what make the ball read as round. */}
          <RadialGradient id="dbShade" cx="0.36" cy="0.3" r="0.9">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.03" />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity="0.01" />
            <Stop offset="0.78" stopColor="#040404" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#020202" stopOpacity="0.78" />
          </RadialGradient>
          {/* Rim light picks up the room, so it may be mood-coloured — it is
              a thin falloff at the silhouette, not a wash over the face. */}
          <RadialGradient id="dbRim" cx="50%" cy="50%" r="50%">
            <Stop offset="0.80" stopColor={eq[2]} stopOpacity="0" />
            <Stop offset="0.955" stopColor={eq[2]} stopOpacity="0.09" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
          </RadialGradient>
          {/* The broad soft bloom around where the key light strikes. Soft
              on purpose — the mirrors must still read through it instead of
              it sitting on the ball like a painted blob (round 4). */}
          <RadialGradient id="dbHot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#dbShade)" />
        <Ellipse cx={36} cy={30} rx={22} ry={15} fill="url(#dbHot)" />
        {/* Rim light — a GRADIENT that fades inward, not a stroke. A stroke of
            any weight sits on the silhouette as a drawn outline (the ball
            looked like a sticker); real rim light has no inner edge, it just
            falls off. Nothing here may be a hard ring. */}
        <Circle cx={50} cy={50} r={50} fill="url(#dbRim)" />
      </Svg>

      {/* The mirrors catching the light, ABOVE the shading and the patches.
          Layer order is the whole reason this reads: underneath them, the
          shade gradient and the wash were knocking the brightest mirror back
          from ~230 to 199, so nothing on the ball ever looked blown out. On a
          real ball a lit mirror is the brightest thing in the room — nothing
          may sit on top of it. Depth falloff is baked into each flash's own
          opacity instead, so it still obeys the sphere's curvature. */}
      {/* The hotspot's blown-out core and the lens glints go ABOVE the
          mirrors, because on a real ball both of them are the light itself
          rather than a surface being lit. Both fade with the music. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="dbCoreTop" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
              <Stop offset="0.4" stopColor="#ffffff" stopOpacity="0.42" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={37} cy={31} rx={11} ry={7.5} fill="url(#dbCoreTop)" />
        </Svg>
      </Animated.View>

      {/* Light PLAYING on the ball, so it belongs to the music like the
          mirrors' own flares do. Paused, the ball is a dull unlit object and
          nothing may still be sliding across it.
          The four-point stars and the diagonal sheen band that used to live
          here are gone: against a ball this detailed they read as stickers
          rather than light (owner, 31.07). The panning spotlight replaces
          them, and it is built from the sphere's geometry instead. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
        <KeySpecular size={size} lit={lit} />
        <SpotlightPan size={size} lit={lit} pan={spotPan} eq={eq} />
      </Animated.View>
    </View>
  );
}

// ── Scattered light dots that orbit the room ──────────────────────────────────
// A fixed field of dots; the whole field slowly rotates (one native transform)
// while each dot twinkles on its own native-driver opacity loop. Zero per-frame
// CPU — the "sweep" is staggered phases + the group rotation.

/**
 * GLITTER (owner, 02.08: "add some glitter, sparkles and fun. It's a mirror
 * ball! Place it all over!").
 *
 * Dozens of tiny lights scattered across the whole screen, each TWINKLING in
 * place — popping bright and sinking back on its own beat. They hold still:
 * the room's standing rule is that only the ball's own surface may move, and
 * glitter obeys it — a twinkle is brightness, not motion, which is also what
 * real glitter does.
 *
 * Every drawn thing here is gradient falloff. Each speck is a soft radial dot;
 * the brighter minority carry a pair of HAIRLINE cross-flares whose gradients
 * are transparent at both tips — the round-21 soft-glint recipe, the one
 * drawn-sparkle construction that has survived on device. No strokes, no
 * solid shapes.
 *
 * Cost: the twinkling is EIGHT shared Animated loops however many specks are
 * drawn — each speck borrows a phase and one of three response curves, so
 * neighbours sharing a phase still pop at different moments.
 */
const GLITTER_COUNT = 64;
const GLITTER_PHASES = 8;

function GlitterSpeck({ x, y, r, color, flare, opacity }: {
  x: number; y: number; r: number; color: string; flare: boolean;
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  const arm = r * 7;
  const box = flare ? arm * 2 : r * 6;
  const c = box / 2;
  const gid = `dbGl${Math.round(x)}x${Math.round(y)}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - c, top: y - c, width: box, height: box, opacity }}>
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <Stop offset="0.28" stopColor={color} stopOpacity="0.55" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
          {flare && (
            <>
              <SvgLinearGradient id={`${gid}h`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={color} stopOpacity="0" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.7" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </SvgLinearGradient>
              <SvgLinearGradient id={`${gid}v`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.7" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </SvgLinearGradient>
            </>
          )}
        </Defs>
        {flare && (
          <>
            <Rect x={c - arm} y={c - r * 0.35} width={arm * 2} height={r * 0.7} fill={`url(#${gid}h)`} />
            <Rect x={c - r * 0.35} y={c - arm} width={r * 0.7} height={arm * 2} fill={`url(#${gid}v)`} />
          </>
        )}
        <Circle cx={c} cy={c} r={r * 3} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

function GlitterField({ eq, lit, winW, winH }: {
  eq: [string, string, string]; lit: Animated.Value; winW: number; winH: number;
}) {
  const phases = useRef(Array.from({ length: GLITTER_PHASES }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = phases.map((v, i) => {
      const dur = 1500 + hash01(i * 7.7) * 1900;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur * 1.25, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      const start = setTimeout(() => loop.start(), i * 310);
      return { loop, start };
    });
    return () => { loops.forEach(({ loop, start }) => { clearTimeout(start); loop.stop(); }); };
  }, [phases]);

  const specks = useMemo(() => {
    const pal = [
      '#ffffff',
      mixHex(eq[0], '#ffffff', 0.55),
      mixHex(eq[1], '#ffffff', 0.5),
      mixHex(eq[2], '#ffffff', 0.55),
    ];
    return Array.from({ length: GLITTER_COUNT }, (_, i) => ({
      // All over the screen, with a slight pull toward the ball's half so the
      // sparkle feels thrown by it rather than wallpapered.
      x: hash01(i * 3.1) * winW,
      y: hash01(i * 7.9) * winH,
      r: 1.1 + Math.pow(hash01(i * 5.3), 1.6) * 2.4,
      color: pal[i % 4],
      flare: hash01(i * 9.7) > 0.72,
      phase: i % GLITTER_PHASES,
      curve: i % 3,
    }));
  }, [eq, winW, winH]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: lit }]}>
      {specks.map((sp, i) => {
        const v = phases[sp.phase];
        // Three response curves per phase, so bucket-mates pop at different
        // moments instead of blinking in unison.
        const opacity =
          sp.curve === 0 ? v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 1, 0.08] })
          : sp.curve === 1 ? v.interpolate({ inputRange: [0, 1], outputRange: [0.10, 1] })
          : v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.10] });
        return <GlitterSpeck key={i} x={sp.x} y={sp.y} r={sp.r} color={sp.color} flare={sp.flare} opacity={opacity} />;
      })}
    </Animated.View>
  );
}

/**
 * FIREFLIES (owner, 03.08: "go softly into the mirror ball… add more glitter
 * floating and moving around. It doesn't have to be moving in the same
 * direction as the spinning sphere. It can be as simple as moving fireflies
 * when music is playing").
 *
 * The room already had two still things — glitter that twinkles in place and
 * a static burst of rays — so the ball was the only thing that MOVED. These
 * wander. Deliberately NOT tied to the spin: the earlier rounds all tried to
 * make the room travel with the ball and every one of them ended up reading
 * as a second light system arguing with the first. A firefly answers to
 * nothing, which is exactly why it works here.
 *
 * COST: five shared loops however many are drawn. Each firefly picks one and
 * traces its OWN path from it, so bucket-mates never move in step; the path
 * returns to where it began at t=1, so a linear loop cycles seamlessly with
 * no retracing. Brightness reads the same value through different stops, so
 * a firefly does not dim at a fixed point on its journey.
 */
const FIREFLY_COUNT = 14;
const FIREFLY_PHASES = 5;
/**
 * SOFTENED 04.08 (owner: "float over more softly… it has a pattern they
 * follow, but has this bounce back motion, can we ease the animation"). The
 * bounce was structural: the old path was FOUR STRAIGHT LINES between random
 * waypoints, so every firefly snapped direction at each corner and again at
 * the loop's return home. The flight is now two sine harmonics per axis,
 * sampled densely into keyframes — position AND velocity are continuous
 * everywhere, including across the loop seam (whole periods wrap by
 * construction), so there is no corner left to bounce off. Brightness rides
 * the same curve family. Loops are explicit-restart sawtooths, not
 * Animated.loop — see the Horizon rebuild note for why.
 */
const FF_SAMPLES = 18;

function Firefly({ x, y, r, color, drift, input, px, py, op }: {
  x: number; y: number; r: number; color: string;
  drift: Animated.Value; input: number[]; px: number[]; py: number[]; op: number[];
}) {
  const box = r * 7;
  const c = box / 2;
  const gid = `dbFf${Math.round(x)}x${Math.round(y)}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x - c, top: y - c, width: box, height: box,
        opacity: drift.interpolate({ inputRange: input, outputRange: op }),
        transform: [
          { translateX: drift.interpolate({ inputRange: input, outputRange: px }) },
          { translateY: drift.interpolate({ inputRange: input, outputRange: py }) },
        ],
      }}>
      <Svg width={box} height={box}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.92" />
            <Stop offset="0.22" stopColor={color} stopOpacity="0.62" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

function Fireflies({ eq, live, winW, winH }: {
  eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
}) {
  const phases = useRef(Array.from({ length: FIREFLY_PHASES }, () => new Animated.Value(0))).current;
  useEffect(() => {
    // Explicit sawtooth restarts (the Horizon lesson: Animated.loop's reset
    // parked a bare timing at 1 after one pass). Linear timing — the easing
    // lives in the sampled path, never in the clock.
    let alive = true;
    const timers = phases.map((v, i) => {
      const dur = 15000 + hash01(i * 4.4) * 9000;
      const run = () => {
        v.setValue(0);
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true })
          .start(({ finished }) => { if (finished && alive) run(); });
      };
      return setTimeout(run, i * 700);
    });
    return () => { alive = false; timers.forEach(clearTimeout); phases.forEach((v) => v.stopAnimation()); };
  }, [phases]);

  const flies = useMemo(() => {
    // About half the flies carry the station's colour nearly neat (owner,
    // 04.08: "enhance the stations' accent colour on some of the fireflies");
    // the rest stay warm-white so the swarm still reads as light, not confetti.
    const pal = [
      '#fff6e0',
      mixHex(eq[0], '#ffffff', 0.18),
      mixHex(eq[1], '#ffffff', 0.16),
      '#ffffff',
      mixHex(eq[2], '#ffffff', 0.30),
      mixHex(eq[1], '#ffffff', 0.45),
    ];
    const TAU = Math.PI * 2;
    return Array.from({ length: FIREFLY_COUNT }, (_, i) => {
      const amp = 24 + hash01(i * 5.9) * 50;
      // Two harmonics per axis: one slow circuit plus a smaller second-order
      // wobble, different phases per axis so the path is a wandering loop
      // rather than a circle. Whole periods, so t=1 rejoins t=0 seamlessly.
      const a1x = amp, a2x = amp * (0.25 + hash01(i * 1.7) * 0.3);
      const a1y = amp * (0.6 + hash01(i * 2.9) * 0.5), a2y = amp * 0.28;
      const q1 = hash01(i * 3.3) * TAU, q2 = hash01(i * 4.1) * TAU;
      const q3 = hash01(i * 6.2) * TAU, q4 = hash01(i * 7.5) * TAU;
      const glow = 0.5 + hash01(i * 9.4) * 0.35;
      const blink = 1 + (i % 2);              // 1 or 2 gentle breaths per circuit
      const qb = hash01(i * 8.8) * TAU;
      const input: number[] = [], px: number[] = [], py: number[] = [], op: number[] = [];
      for (let k = 0; k <= FF_SAMPLES; k++) {
        const t = k / FF_SAMPLES;
        input.push(t);
        px.push(a1x * Math.sin(TAU * t + q1) + a2x * Math.sin(2 * TAU * t + q2));
        py.push(a1y * Math.sin(TAU * t + q3) + a2y * Math.sin(2 * TAU * t + q4));
        op.push(0.14 + (glow - 0.14) * (0.5 + 0.5 * Math.sin(TAU * blink * t + qb)));
      }
      return {
        x: winW * (0.06 + hash01(i * 2.1) * 0.88),
        y: winH * (0.10 + hash01(i * 6.7 + 1.4) * 0.76),
        r: 2.4 + hash01(i * 8.2) * 2.6,
        color: pal[i % pal.length],
        input, px, py, op,
        phase: i % FIREFLY_PHASES,
      };
    });
  }, [eq, winW, winH]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: live }]}>
      {flies.map((f, i) => (
        <Firefly key={i} x={f.x} y={f.y} r={f.r} color={f.color}
          input={f.input} px={f.px} py={f.py} op={f.op} drift={phases[f.phase]} />
      ))}
    </Animated.View>
  );
}

/**
 * A dark vignette pulling the corners down (owner's lighting brief, 31.07):
 * the room reads as a deep studio rather than a flat backdrop, and the ball
 * — the one bright thing — gains depth for free. Static, costs nothing.
 */
function Vignette({ winW, winH }: { winW: number; winH: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={winW} height={winH} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="dbVign" cx="50%" cy="46%" r="72%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0" />
            <Stop offset="0.62" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#020208" stopOpacity="0.52" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#dbVign)" />
      </Svg>
    </View>
  );
}

/**
 * THE RAYS (owner's reference photograph, 02.08: a real ball in a lit room
 * throwing a dense burst of fine beams in every direction).
 *
 * They do NOT rotate. The last version turned the fan with the ball, and with
 * nothing else moving in the room the rays read as travelling against their
 * own light — "the rays move the opposite direction of the reflections". A
 * real beam is bolted to the geometry of lamp and mirror; on a slowly turning
 * ball it holds its line and its BRIGHTNESS wanders. So the fan is static and
 * each ray breathes slowly instead, on one of six staggered loops — alive
 * without motion, and six animations however many rays are drawn.
 *
 * FINE is the whole character: many thin filaments at uneven angles and
 * uneven lengths, a few longer heroes among them, every one pure gradient
 * falloff — soft along its length, across its width and at its far end.
 */
const RAY_COUNT = 44;
const RAY_PHASES = 6;

function LightRays({ size, eq, winW, winH, lit }: {
  size: number; eq: [string, string, string]; winW: number; winH: number;
  lit: Animated.Value;
}) {
  const R = size / 2;
  const len = Math.max(winW, winH) * 0.98;
  const box = len * 2;

  // Six shared breathing values — every ray borrows one, so the whole burst
  // costs six native-driver opacity loops.
  const phases = useRef(Array.from({ length: RAY_PHASES }, () => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = phases.map((v, i) => {
      const dur = 2600 + i * 640;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur * 1.18, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      const start = setTimeout(() => loop.start(), i * 430);
      return { loop, start };
    });
    return () => { loops.forEach(({ loop, start }) => { clearTimeout(start); loop.stop(); }); };
  }, [phases]);

  const rays = useMemo(() => {
    const pal = [mixHex(eq[0], '#ffffff', 0.55), mixHex(eq[1], '#ffffff', 0.6), '#eef3ff'];
    return Array.from({ length: RAY_COUNT }, (_, i) => {
      const hero = hash01(i * 9.3) > 0.8;          // the few long bright shafts
      return {
        // Uneven spacing: a machined fan reads as a drawing, the photo's
        // burst clusters and gaps.
        deg: (i / RAY_COUNT) * 360 + (hash01(i * 4.7) - 0.5) * (360 / RAY_COUNT) * 1.2,
        w: size * (hero ? 0.045 : 0.014 + hash01(i * 3.7) * 0.026),
        reach: len * (hero ? 0.78 + hash01(i * 5.3) * 0.22 : 0.34 + hash01(i * 2.9) * 0.5),
        color: pal[i % 3],
        op: hero ? 0.16 + hash01(i * 6.1) * 0.10 : 0.06 + hash01(i * 6.1) * 0.09,
        phase: i % RAY_PHASES,
      };
    });
  }, [size, len, eq]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: R - len, top: R - len, width: box, height: box,
        opacity: lit,
      }}>
      {rays.map((ray, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: len, top: len - ray.w / 2,
            width: ray.reach, height: ray.w,
            transform: [{ rotate: `${ray.deg}deg` }],
            transformOrigin: 'left center',
            // Breathes between 55% and 100% of its own brightness.
            opacity: phases[ray.phase].interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          }}>
          <Svg width={ray.reach} height={ray.w} viewBox="0 0 100 12" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id={`dbRay${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={ray.color} stopOpacity={String(ray.op)} />
                <Stop offset="0.5" stopColor={ray.color} stopOpacity={String(ray.op * 0.45)} />
                <Stop offset="1" stopColor={ray.color} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {/* Centred at the ray's ROOT: only the outward half is inside the
                canvas, so it is brightest at the ball and dissolves in every
                direction from there. */}
            <Ellipse cx={0} cy={6} rx={100} ry={6} fill={`url(#dbRay${i})`} />
          </Svg>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function DustMote({ x, y, size, tint, dur, delay, driftX }: {
  x: number; y: number; size: number; tint: string; dur: number; delay: number; driftX: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2,
        backgroundColor: tint,
        opacity: t.interpolate({ inputRange: [0, 0.35, 0.5, 0.65, 1], outputRange: [0.02, 0.08, 0.20, 0.08, 0.02] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -winHDrift] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
        ],
      }}
    />
  );
}
const winHDrift = 64;

function DustField({ count, eq, live, winW, winH }: {
  count: number; eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
}) {
  const motes = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: hash01(i * 5.17 + 0.9) * winW,
    y: winH * 0.12 + hash01(i * 8.31 + 3.3) * winH * 0.66,
    size: 1.5 + hash01(i * 3.9) * 2.2,
    tint: i % 3 === 0 ? mixHex(eq[1], '#ffffff', 0.55) : '#e8eef8',
    dur: 5200 + Math.floor(hash01(i * 6.1) * 5200),
    delay: Math.floor(hash01(i * 2.7) * 6000),
    driftX: (hash01(i * 9.7) - 0.5) * 30,
  })), [count, eq, winW, winH]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: live }]} pointerEvents="none">
      {motes.map((m, i) => <DustMote key={i} {...m} />)}
    </Animated.View>
  );
}




export function DiscoBallFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const isLandscape = winW > winH;
  // Declared up here because the scrub gesture needs the ball's size, and
  // the PanResponder is built before the render body reaches the ball.
  //
  // Landscape sizes off the HEIGHT alone: the portrait formula's winH*0.39
  // term was written for a tall window and turns a sideways ball into a
  // grapefruit. 0.62 of a 393pt-high screen ≈ 244 — big enough to be the
  // whole show, small enough that the chrome never touches it.
  const ballSize = isLandscape
    ? Math.min(winH * 0.74, 330)
    : Math.min(winW * 0.71, winH * 0.39, 340);
  const ballSizeRef = useRef(ballSize);
  ballSizeRef.current = ballSize;
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
  const spin = useRef(new Animated.Value(0)).current;       // ball surface scroll (axis spin)
  const live = useRef(new Animated.Value(0)).current;       // 0 idle → 1 dancing
  const pulse = useRef(new Animated.Value(0)).current;      // 0 rest → 1 on-beat (bloom/reflections)

  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });

  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  // ── Swipe the ball to scrub ────────────────────────────────────────────
  // Drag right and the surface follows your finger while the song moves
  // forward — the same direction it turns during playback, so pushing the
  // ball along feels like winding the track on. Only horizontal drags are
  // claimed; a downward swipe on the ball still dismisses the mode.
  const [scrubbing, setScrubbing] = useState(false);
  const spinBaseRef = useRef(0);        // spin value when the finger landed
  const progressBaseRef = useRef(0);    // song position when the finger landed
  const scrubPctRef = useRef(0);        // latest scrubbed position

  const wrap01 = (v: number) => ((v % 1) + 1) % 1;
  const readAnim = (a: Animated.Value) => (a as unknown as { __getValue?: () => number }).__getValue?.() ?? 0;

  // Where the turn has got to, derived from the clock rather than read back
  // from the animation — see the long note on the rotation effect below.
  const phaseRef = useRef(0);       // phase banked when the current run began
  const runStartRef = useRef(0);    // Date.now() at the start of that run
  const turningRef = useRef(false); // is a steady turn currently running?
  const readPhase = () => (turningRef.current
    ? wrap01(phaseRef.current + (Date.now() - runStartRef.current) / BALL_SPIN_MS)
    : wrap01(phaseRef.current));

  const ballPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        progressBaseRef.current = readAnim(progress);
        scrubPctRef.current = progressBaseRef.current;
        scrub.begin();
        setScrubbing(true);
        // Where the turn currently sits, so the ball carries on from its
        // present angle instead of jumping. Synchronous — no native read.
        const at = readPhase();
        spinBaseRef.current = at;
        phaseRef.current = at;
        turningRef.current = false;
        spin.stopAnimation();
        spin.setValue(at);
      },
      onPanResponderMove: (_, g) => {
        const size = ballSizeRef.current;
        if (size <= 0) return;
        // The surface tracks the finger 1:1 — drag a ball-width, turn a
        // ball-width. Wrapped, because the scroll only has one texture
        // width to play with.
        const at = wrap01(spinBaseRef.current + g.dx / size);
        spin.setValue(at);
        phaseRef.current = at;   // so the turn resumes from where the finger left it
        // A ball-width of drag covers a fifth of the song: fast enough to
        // cross a track in a few swipes, slow enough to land on a chorus.
        const pct = Math.max(0, Math.min(1, progressBaseRef.current + g.dx / (size * 5)));
        scrubPctRef.current = pct;
        scrub.move(pct);
      },
      onPanResponderRelease: () => {
        scrub.end(scrubPctRef.current);
        setScrubbing(false);
      },
      onPanResponderTerminate: () => {
        scrub.end(scrubPctRef.current);
        setScrubbing(false);
      },
    }),
  ).current;

  // The room lights up while the music plays, dims between/at rest.
  const lightsOn = playing && !musicSwitching;
  // The ball only turns while audio is genuinely playing — pause the music
  // and it coasts to a stop, exactly like the power being cut to the motor.
  const spinning = lightsOn && (spotify.track?.isPlaying ?? true);

  // The ball does NOT bob — it hangs dead still from its mount, like the real
  // thing; all of its life comes from the turn and the light. The room's light
  // dots used to orbit on their own 26s loop; they now ride `spin`, so there
  // is nothing left running independently of the music.

  // Ball rotation — starts and stops with the music, and picks up where it
  // left off rather than snapping back to zero.
  //
  // The phase is tracked HERE, from the wall clock, and never read back from
  // the animation. That is the whole point of this design. The obvious way
  // to resume — ask `spin.stopAnimation(cb)` where the value got to — hands
  // you the answer ASYNCHRONOUSLY for a native-driven value, and if that
  // answer never arrives, the callback that would have started the next
  // animation never runs and the ball silently stops forever. That is
  // exactly what happened on device: measured frozen at phase 0.851 for
  // four seconds while the gate said it should be turning, and a play/pause
  // tap was the only thing that revived it. The turn is perfectly linear at
  // a known duration, so elapsed time gives the phase exactly, with no round
  // trip and nothing to go missing. Every path below starts an animation
  // SYNCHRONOUSLY — there is no longer any way to land in a state where the
  // ball is stopped and nothing is scheduled to move it.
  //
  // `spin` must stay within 0..1: the surface scroll maps that range onto
  // exactly one texture width, so letting it drift past 1 would scroll the
  // ball off the end of its own two-copy strip.
  useEffect(() => {
    if (!visible) return;
    // While a finger is on the ball the drag owns the rotation — don't fight
    // it. Releasing re-runs this effect, which resumes from the angle the
    // user left the ball at.
    if (scrubbing) return;

    const phase = readPhase();
    spin.setValue(phase);
    phaseRef.current = phase;

    let cancelled = false;
    let current: Animated.CompositeAnimation | null = null;

    if (!spinning) {
      turningRef.current = false;
      // Stops exactly where it is (owner, 28.07). This used to coast a
      // fraction of a turn on release, which looked like momentum but meant
      // pausing and resuming never landed on the same angle you paused at.
      // `spin` is already set to the current phase above, so there is simply
      // nothing left to animate — the ball holds its angle until the music
      // starts again, and picks up from there.
      spin.setValue(phase);
      phaseRef.current = phase;
      return;
    }

    turningRef.current = true;
    runStartRef.current = Date.now();
    const finishTurn = Animated.timing(spin, {
      toValue: 1, duration: BALL_SPIN_MS * (1 - phase), easing: Easing.linear, useNativeDriver: true,
    });
    current = finishTurn;
    finishTurn.start(({ finished }) => {
      if (!finished || cancelled) return;
      spin.setValue(0);
      phaseRef.current = 0;
      runStartRef.current = Date.now();
      const loop = Animated.loop(Animated.timing(spin, {
        toValue: 1, duration: BALL_SPIN_MS, easing: Easing.linear, useNativeDriver: true,
      }));
      current = loop;
      loop.start();
    });

    return () => {
      cancelled = true;
      // Bank the phase before killing the animation, so the next run resumes
      // from the right angle without having to ask anyone.
      phaseRef.current = readPhase();
      turningRef.current = false;
      current?.stop();
    };
  }, [visible, spinning, scrubbing]);

  useEffect(() => {
    // All the way to 0 when the music stops, not 0.15 (owner, 28.07): paused
    // should be a dull, unlit ball in a dark room — no twinkles, no streaks,
    // no light dancing on the walls. The light show belongs to the music.
    Animated.timing(live, { toValue: lightsOn ? 1 : 0, duration: lightsOn ? 900 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [lightsOn]);

  // Glow intensity + reflections nudge gently on the beat — same simulated
  // ~100BPM attack/release convention as AmbientGlow elsewhere in the app
  // (no real audio analysis; gated on Spotify actually reporting playback so
  // it never pulses over silence), kept subtle since this is a lighting
  // accent, not the main show.
  useEffect(() => {
    if (!spinning) {
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [spinning]);

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

  const resetTrack = () => progress.setValue(0);
  const togglePlay = () => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); };

  // ── The controls rest ──────────────────────────────────────────────────
  // After a few untouched seconds of playback the header, transport and pills
  // fade out and leave the ball alone in the dark. That is the shot this mode
  // was built for and nobody could ever see it, because the buttons sat on
  // top of it for the whole drive. Any touch anywhere brings them back.
  //
  // Deliberately opacity-only: nothing moves, so the ball does not shift when
  // the chrome comes and goes, and the fade runs on the native driver.
  const chrome = useRef(new Animated.Value(1)).current;
  const [chromeRested, setChromeRested] = useState(false);
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetOpen = showMood || showPicker;

  // `arriving` — the phone has just been turned. In landscape this value also
  // slides the docking deck, so the wake is given the shared component's
  // arrival timing: a beat for the rotation to settle, then the panel travels
  // in. A plain tap-to-wake stays quick.
  const wakeChrome = (arriving = false) => {
    if (restTimer.current) { clearTimeout(restTimer.current); restTimer.current = null; }
    setChromeRested(false);
    Animated.timing(chrome, {
      toValue: 1,
      duration: arriving ? 340 : 170,
      delay: arriving ? 160 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Only ever rests during playback: a paused drive is one you are looking
    // at, and hiding the play button from someone who just paused is rude.
    //
    // ...and only SIDEWAYS. Portrait resting was this mode's own invention
    // and no other mode does it, so the Mirror Ball was the one screen where
    // the controls vanished while you were holding the phone normally
    // (owner, 30.07). The landscape deck still docks and rests — that is the
    // agreed grammar and every mode shares it.
    if (playing && !sheetOpen && isLandscape) {
      restTimer.current = setTimeout(() => {
        setChromeRested(true);
        Animated.timing(chrome, {
          toValue: 0, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }).start();
      }, CHROME_REST_MS);
    }
  };

  useEffect(() => {
    if (!visible) return;
    wakeChrome();
    return () => { if (restTimer.current) { clearTimeout(restTimer.current); restTimer.current = null; } };
  }, [visible, playing, sheetOpen]);

  // TURNING THE PHONE RE-DOCKS THE DECK. Without this, rotating into landscape
  // after the PORTRAIT chrome had already rested arrives at chrome = 0 — the
  // panel parked off-screen and no controls anywhere until you tap. This mode
  // keeps its own fade machinery (one value serves the portrait fade and the
  // landscape dock), so it needs the orientation re-wake spelled out; the
  // shared useChromeFade does the same thing via its own active flag.
  // Layout effect for the same reason the shared hook uses one: the turn
  // renders the scene as landscape while chrome is still at 1, so a plain
  // effect leaves one frame with the deck glide already applied.
  useIsoLayoutEffect(() => {
    if (!visible) return;
    chrome.setValue(0);
    wakeChrome(true);
  }, [isLandscape]);

  // One clock for the spotlight, shared by the pool on the ball and the beam
  // reaching it — two loops of the same length would drift apart eventually,
  // and a beam that misses its own pool is worse than no beam.
  const spotPan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spotPan, { toValue: 1, duration: SPOT_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  // One screen-width of travel per turn of the ball, in the direction its
  // surface travels (right). Same Animated.Value, so they can never drift
  // apart or keep moving after the ball has stopped.
  // The reflections ORBIT the ball rather than sliding across the screen.
  //
  // Sliding was ambiguous — half of them looked like they were going the
  // other way to the surface (owner, 31.07: "white specks that... move in the
  // opposite direction of the ball"), and a sideways slide has to wrap, which
  // is what made them read as floating about. An orbit cannot be read
  // backwards and it is what actually happens: the spots a mirror ball throws
  // sweep around the room in the same sense as the ball.
  //
  // TWICE the ball's rate, which is the real physics — reflecting off a
  // turning mirror doubles the angle, so the spots travel twice as fast as
  // the surface that made them.
  const bloomColor = mixHex(eq[1], eq[0], 0.35);

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#04040c' }, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        /* A passive touch sniffer: it never claims the gesture (always false),
           it just notices that a finger landed anywhere on the screen and
           brings the rested controls back. Must sit on the root so it sees
           taps on the ball, the buttons and the empty dark alike. */
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

        {/* THE ROOM IS DARK (owner, 29.07). Every mirror ball worth copying is
            photographed in a black room, and that is not decoration — a beam
            only reads as a beam if there is darkness for it to cross. This
            mode used to sit on the station photograph at the same strength as
            the other seven, so the ball was competing with a lit picture and
            the light shafts read as pale lines drawn on top of it.
            The photograph survives at a whisper, purely as the mood's colour
            temperature; the dark falls off from behind the ball outwards, so
            the middle of the screen still has some depth to it rather than
            being flat black. */}
        <View style={[StyleSheet.absoluteFill, { opacity: 0.16 }]} pointerEvents="none">
          <StationBackdrop station={station} blurRadius={2.5} />
        </View>
        {/* Explicit width/height, not just absoluteFill: an Svg with no size
            falls back to an intrinsic one and the wash lands as a black box
            in the top-left corner. */}
        <Svg width={winW} height={winH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="dbRoom" cx="50%" cy="30%" r="78%">
              <Stop offset="0" stopColor="#14162a" stopOpacity="0.52" />
              <Stop offset="0.62" stopColor="#020206" stopOpacity="0.92" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={winW} height={winH} fill="url(#dbRoom)" />
        </Svg>

        {/* The light the ball throws around the room. Driven by the SAME spin
            value as the ball, so the dots travel in the same direction and at
            the same rate, and stop dead when the ball does — they are its
            reflections, so they cannot have a life of their own. Two copies a
            screen apart make the wrap seamless: as one leaves to the right the
            other is already arriving. */}
        <DustField count={14} eq={eq} live={live} winW={winW} winH={winH} />

        {/* The static diagonal streaks that used to hang here are gone
            (owner, 01.08: "awkward light streak on the right hand side").
            They were hired to make the empty room feel lit; now that the
            ball's own cast reflections fill it, fixed lines crossing the
            scene read as scratches on the picture. */}

        {/* The vignette sits over the room but under the chrome: the studio
            darkens toward its corners, the scene keeps its depth, the type
            stays on top of everything. */}
        <Vignette winW={winW} winH={winH} />

        {/* Glitter over everything in the room (under the chrome): the
            specks must sparkle in the corners too, so they sit above the
            vignette rather than being dimmed by it. */}
        <GlitterField eq={eq} lit={live} winW={winW} winH={winH} />
        <Fireflies eq={eq} live={live} winW={winW} winH={winH} />

        {/* Drag pill + mode label + centred header are portrait furniture —
            in landscape LandscapeChrome carries the identity at top-left. */}
        {!isLandscape && (
        <Animated.View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10, opacity: chrome }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Animated.View>
        )}

        {!isLandscape && (
        <Animated.View style={[fs.topBar, { top: topPad + 14, opacity: chrome }]} pointerEvents="none">
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>MIRROR BALL</Text>
        </Animated.View>
        )}

        <View style={{ flex: 1, paddingTop: isLandscape ? 8 : topPad + 52, paddingBottom: isLandscape ? 8 : Math.max(insets.bottom, 24) + 16 }}>
          {!isLandscape && (
          <Animated.View style={{ alignItems: 'center', paddingHorizontal: 32, paddingBottom: 10, opacity: chrome }} pointerEvents="none">
            <StationIdentity station={station} />
          </Animated.View>
          )}

          {/* The ball, hanging from a mount, genuinely turning on its axis */}
          {/* paddingBottom lifts the ball off the dead centre of its box —
              it hangs from above, so sitting slightly high reads better.
              Landscape lifts by a chrome-derived amount instead: verified at
              852x393, anything less sinks the ball's bottom edge into the
              seek bar and play disc. */}
          {/* paddingBottom lifts the ball off dead centre — it hangs from
              above, so sitting high is what reads right (owner, 30.07). */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: isLandscape ? ballSize * 0.16 : ballSize * 0.30 }}>
            <Animated.View style={[{ alignItems: 'center' }, deckScene]}>
              <View style={{ width: 2, height: ballSize * 0.22, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: -3 }} />
              {/* A ball-sized anchor box — the bloom/ray layers below position
                  themselves relative to it, not the taller pole+ball stack.
                  Also the scrub target: swipe left/right anywhere on the ball. */}
              <View style={{ width: ballSize, height: ballSize }} {...ballPan.panHandlers}>
                {/* The rays first, so the ball draws over their roots. */}
                <LightRays size={ballSize} eq={eq} winW={winW} winH={winH} lit={live} />
                {/* Bloom is light LEAVING the ball, so it fades out with the
                    music exactly as the flashes do. `MirrorBeams` used to draw
                    here too and is GONE (owner, 02.08: "the light rays that
                    live on the right is stubborn and won't be removed") —
                    three rounds of tuning never stopped a beam parked near the
                    limb reading as a streak laid over the picture. The room's
                    light is the cast reflections now, which is what a mirror
                    ball actually throws. */}
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: live }]} pointerEvents="none">
                  <BallBloom size={ballSize} color={bloomColor} pulse={pulse} />
                </Animated.View>
                <MirrorBall size={ballSize} eq={eq} spin={spin} pulse={pulse} lit={live} spotPan={spotPan} />
              </View>
            </Animated.View>
          </View>

          {/* Everything below the ball rests together. pointerEvents goes off
              once it's invisible so the first tap only wakes it — you can't
              hit a skip button you can't see. */}
          {!isLandscape && (
          <Animated.View style={{ opacity: chrome }} pointerEvents={chromeRested ? 'none' : 'auto'}>
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
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={station}
          />
          </Animated.View>
          )}
        </View>

        {/* Landscape: the shared L1+L3 overlay, riding this mode's own
            chrome-fade machinery — same value, same timer, one behaviour. */}
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

        {/* absoluteFill, not an auto-sized wrapper: the close button positions
            itself absolutely against its parent, so anything smaller than the
            screen would move it. */}
        {!isLandscape && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: chrome, zIndex: 60 }]}
          pointerEvents={chromeRested ? 'none' : 'box-none'}>
          <ModeCloseButton onPress={handleClose} />
        </Animated.View>
        )}

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
