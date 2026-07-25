import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaylistSheet } from '@/components/PlaylistSheet';
import { MoodSheet } from '@/components/MoodSheet';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;
const DEMO_DURATION_MS = 214000;
// One full turn of the ball. Fast enough to read as driven by the music,
// slow enough to still feel like a heavy hanging ball rather than a toy.
const BALL_SPIN_MS = 7000;


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

// Neutral, pale shading ramp — no baked hue. The moving ColorCycleWash
// (below) tints this at playback time, so the same tiles work for any station.
const SHADE_ANCHORS = ['#39405c', '#5d6786', '#8b96b6', '#bcc6e2', '#e8eeff', '#ffffff'];
// Facet brightness is quantised (cel-shaded, not smooth) but into FINER steps
// than the anchor list — brightness falls off fastest across the middle of the
// ball, so with coarse steps the band edge landed on one column and drew a
// hard vertical line straight down the centre. More steps + per-tile jitter
// dithers it away while keeping the stylised look.
const SHADE_STEPS = 10;
function shadeAt(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (SHADE_ANCHORS.length - 1);
  const i = Math.min(SHADE_ANCHORS.length - 2, Math.floor(x));
  return mixHex(SHADE_ANCHORS[i], SHADE_ANCHORS[i + 1], x - i);
}

// Fixed neon accent set for the moving reflections/bokeh — a deliberate
// departure from the "always the station's own eqColors" rule elsewhere:
// the brief calls for a specific club-neon identity (cyan/magenta/purple/
// blue) for this one mode. Each is nudged ~18% toward the station's own
// mid accent (eq[1]) wherever it's used, so it still feels station-tinted
// rather than a totally unrelated palette bolted on.
const NEON = { cyan: '#22E8FF', magenta: '#FF2FD1', purple: '#9B4DFF', blue: '#3D6BFF' } as const;

type Tile = { d: string; fill: string; op: number };

// How far the mirror face is inset from the tile's own outline — i.e. the
// frame showing round it. HAIRLINE on purpose: on both owner references the
// seams between mirrors are thin bright lines and the mirror is nearly the
// whole tile. A fat border (an earlier cut used a third of the tile) reads as
// small squares floating on a grey sphere.
//
// u0/u1 are 0 and 1, so the frame is the TOP AND BOTTOM edges only and has no
// vertical sides. That is not a shortcut — it is the fix for "the tiles don't
// move". Vertical frame edges are static meridian seams, and they directly
// contradict the meridians that rotate; drawn bright, they became the most
// legible structure on the ball and pinned the whole surface in place.
// Measured over a turn, they carried more than half of all the static
// vertical-edge energy (2.19 -> 0.99 with them gone), and the eye locks onto
// whatever doesn't move. Horizontal seams are correctly static (a sphere on
// its polar axis maps each latitude onto itself); vertical seams belong to
// RotatingMeridians and nowhere else. NEVER give this a horizontal inset.
const BEVEL = { u0: 0.0, u1: 1.0, v0: 0.06, v1: 0.90 };

// Viewing tilt — we look slightly DOWN on the ball. This matters: seen from
// dead level, the latitude rings project to perfectly straight horizontal
// lines and the ball reads as a flat brick wall (the old build's problem).
// A little tilt is what makes the rows arc and the columns converge at the
// top pole, exactly like the reference photo.
const TILT = 0.30;                       // ~17°

// Real sphere projection — every tile is a quad between two latitudes and
// two longitudes, projected through the sphere and back-face culled. That's
// what gives genuine 3D: rows compress toward the poles, columns pinch
// together at the top, and tiles squash to slivers at the silhouette. Built
// ONCE per size (useMemo) and never animated — a static grid costs nothing
// per frame, and on a real mirror ball the grid barely appears to move
// anyway; what you actually see travelling is the light across the facets
// (that's the scrolling LightPatches layer underneath).
// How many phase buckets the flashing-mirror wave is quantised into, and how
// wide the lit band is as a fraction of one turn.
const FLASH_GROUPS = 26;
const FLASH_WIDTH = 0.07;

function buildSphereTiles(size: number, eq: [string, string, string]): { tiles: Tile[]; flashes: Tile[][] } {
  const R = size / 2, cx = R, cy = R;
  const ROWS = 17, COLS = 32;   // ~240 visible facets after back-face culling
  const st = Math.sin(TILT), ct = Math.cos(TILT);

  // Key light from the upper-left front, matching the fixed highlight below.
  const ln = Math.hypot(-0.42, 0.58, 0.70);
  const lx = -0.42 / ln, ly = 0.58 / ln, lz = 0.70 / ln;

  // lat/lon -> screen point + view-space normal (the sphere's own normal).
  const project = (beta: number, lam: number) => {
    const cb = Math.cos(beta);
    const x0 = cb * Math.sin(lam);
    const y0 = Math.sin(beta);
    const z0 = cb * Math.cos(lam);
    const y1 = y0 * ct - z0 * st;
    const z1 = y0 * st + z0 * ct;
    return { x: cx + R * x0, y: cy - R * y1, z: z1, nx: x0, ny: y1, nz: z1 };
  };

  const tiles: Tile[] = [];
  const flashes: Tile[][] = Array.from({ length: FLASH_GROUPS }, () => []);
  for (let j = 0; j < ROWS; j++) {
    const b0 = -Math.PI / 2 + (Math.PI * j) / ROWS;
    const b1 = -Math.PI / 2 + (Math.PI * (j + 1)) / ROWS;
    // Brick bond — every other row is offset half a tile. Real mirror balls
    // are built this way, and it also keeps the static tile edges from
    // stacking into continuous vertical lines, which would compete with the
    // rotating meridians for "the grid that turns".
    const bond = (j % 2) * 0.5;
    for (let k = 0; k < COLS; k++) {
      const l0 = (2 * Math.PI * (k + bond)) / COLS;
      const l1 = (2 * Math.PI * (k + bond + 1)) / COLS;
      const p00 = project(b0, l0), p01 = project(b0, l1);
      const p11 = project(b1, l1), p10 = project(b1, l0);
      // Back-face cull — anything past the horizon is on the far side.
      if (p00.z <= 0.02 || p01.z <= 0.02 || p11.z <= 0.02 || p10.z <= 0.02) continue;

      const d = `M ${p00.x.toFixed(2)} ${p00.y.toFixed(2)} `
              + `L ${p01.x.toFixed(2)} ${p01.y.toFixed(2)} `
              + `L ${p11.x.toFixed(2)} ${p11.y.toFixed(2)} `
              + `L ${p10.x.toFixed(2)} ${p10.y.toFixed(2)} Z`;

      const c = project((b0 + b1) / 2, (l0 + l1) / 2);
      const lambert = Math.max(0, c.nx * lx + c.ny * ly + c.nz * lz);

      // Two DIFFERENT brightness rules, and the split is the whole point of
      // this pass. On a real ball (both owner references) the frame between
      // the mirrors is continuous metal, so it shades smoothly — bright on
      // the lit side, dark on the shadow side, no speckle. The mirrors
      // themselves each reflect a different part of the room, so neighbours
      // land wildly apart in brightness. Driving both from one jittered
      // value, as this did before, made the whole surface speckle together
      // and lost the lit grid that gives the ball its structure.
      const frameStep = lambert * (SHADE_STEPS - 1) + 2.6;
      const faceStep = lambert * (SHADE_STEPS - 1) + (hash01(j * 31.7 + k * 7.31) - 0.5) * 5.2;

      // Colour lives on the mirrors, barely on the frame. The palette is the
      // station's own mood plus the club-neon set, so the ball still reads as
      // this station's ball rather than a fixed pink one — but with most
      // tiles carrying some cast, not the old 26% minority, which is what
      // left it looking like grey stone next to the references.
      const palette = [eq[0], eq[1], eq[2], NEON.cyan, NEON.magenta, NEON.purple, NEON.blue];
      const hue = palette[Math.floor(hash01(j * 2.71 + k * 3.97) * palette.length) % palette.length];
      const cast = 0.10 + hash01(j * 5.13 + k * 11.27) * 0.34;
      const tint = (s: number, amount: number) => {
        const base = shadeAt(Math.max(0, Math.min(1, s / (SHADE_STEPS - 1))));
        return amount > 0 ? mixHex(base, hue, amount) : base;
      };

      // Facets near the silhouette sit at a glancing angle — dimmer, so the
      // sphere's edge falls away instead of ending in a hard ring. Kept well
      // short of opaque: the travelling light below has to show through, or
      // the ball stops looking like it's turning.
      const depth = Math.min(1, c.nz * 1.35);

      // Each mirror is TWO paths: the face, and the frame AROUND it. The
      // frame is a genuine hole-in-the-middle border (even-odd fill), not a
      // full-tile quad sitting under the face — and that distinction is
      // load-bearing. The frame is bright, and as a full quad its opacity
      // would land on the entire ball and cancel the travelling light
      // underneath, which is the exact failure round 6 had to measure its way
      // out of. As a border it can be bright enough to read as a lit seam
      // while the ball's average coverage actually goes DOWN.
      const P = (u: number, v: number) => {
        const a = (1 - u) * (1 - v), b = u * (1 - v), cc = u * v, dd = (1 - u) * v;
        return {
          x: a * p00.x + b * p01.x + cc * p11.x + dd * p10.x,
          y: a * p00.y + b * p01.y + cc * p11.y + dd * p10.y,
        };
      };
      const f00 = P(BEVEL.u0, BEVEL.v0), f01 = P(BEVEL.u1, BEVEL.v0);
      const f11 = P(BEVEL.u1, BEVEL.v1), f10 = P(BEVEL.u0, BEVEL.v1);
      const face = `M ${f00.x.toFixed(2)} ${f00.y.toFixed(2)} `
                 + `L ${f01.x.toFixed(2)} ${f01.y.toFixed(2)} `
                 + `L ${f11.x.toFixed(2)} ${f11.y.toFixed(2)} `
                 + `L ${f10.x.toFixed(2)} ${f10.y.toFixed(2)} Z`;

      tiles.push({ d: `${d} ${face}`, fill: tint(frameStep, cast * 0.3), op: 0.24 + 0.30 * depth });
      tiles.push({ d: face, fill: tint(faceStep, cast), op: 0.16 + 0.22 * depth });

      // ...and a BRIGHT copy of the same face, filed into a phase bucket by
      // where it sits across the ball. MirrorFlash fades these in as a band
      // sweeping left to right, so what travels is individual mirrors
      // catching the light one after another. The soft light layer underneath
      // already sweeps, but it is smooth — it slides over the mosaic instead
      // of being carved up by it, which is why the mirrors themselves read as
      // dead still. This is the layer that makes them read as turning.
      const px = c.x / size + (hash01(j * 8.17 + k * 2.53) - 0.5) * 0.13;
      const g = ((Math.floor(px * FLASH_GROUPS) % FLASH_GROUPS) + FLASH_GROUPS) % FLASH_GROUPS;
      flashes[g].push({ d: face, fill: tint(faceStep + 4.5, cast * 0.35), op: 0.26 + 0.42 * depth });
    }
  }
  return { tiles, flashes };
}

// Latitude rings. These are STATIC and that is not a shortcut: a sphere
// turning on its polar axis maps every latitude circle onto itself, so the
// horizontal seams genuinely do not move. Only the meridians do.
function buildLatitudeArcs(size: number): string[] {
  const R = size / 2, cx = R, cy = R;
  const st = Math.sin(TILT), ct = Math.cos(TILT);
  const ROWS = 17;
  const out: string[] = [];
  for (let j = 1; j < ROWS; j++) {
    const b = -Math.PI / 2 + (Math.PI * j) / ROWS;
    let d = '', pen = false;
    for (let i = 0; i <= 120; i++) {
      const lam = -Math.PI / 2 + (Math.PI * i) / 120;
      const cb = Math.cos(b);
      const y1 = Math.sin(b) * ct - cb * Math.cos(lam) * st;
      const z1 = Math.sin(b) * st + cb * Math.cos(lam) * ct;
      if (z1 <= 0.02) { pen = false; continue; }
      const x = cx + R * cb * Math.sin(lam), y = cy - R * y1;
      d += (pen ? ' L ' : ' M ') + x.toFixed(2) + ' ' + y.toFixed(2);
      pen = true;
    }
    if (d) out.push(d);
  }
  return out;
}

// The static part of the mirror grid: facet fills (the mirror colours) and
// the latitude rings. Semi-transparent on purpose so the scrolling light
// underneath shows through. The vertical seams are NOT here — they rotate,
// see RotatingMeridians.
// The mirrors catching the light in turn. Each bucket is a static Svg of
// bright faces whose whole layer just fades up and down — opacity only, native
// driver, so 22 groups cost about what one animation costs. The bump is
// computed on the CIRCULAR distance between the turn's phase and the bucket's,
// which makes the sweep wrap seamlessly: as the band leaves the right limb the
// left limb is already lighting up, exactly like the two-copy light strip
// below it.
function MirrorFlash({ size, groups, spin }: { size: number; groups: Tile[][]; spin: Animated.Value }) {
  const curves = useMemo(() => groups.map((_, g) => {
    const p = (g + 0.5) / groups.length;
    const inp: number[] = [], out: number[] = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const raw = ((s - p) % 1 + 1) % 1;
      const dist = Math.min(raw, 1 - raw);
      inp.push(s);
      out.push(dist >= FLASH_WIDTH ? 0 : 0.5 * (1 + Math.cos((Math.PI * dist) / FLASH_WIDTH)));
    }
    return { inp, out };
  }), [groups]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {groups.map((tiles, g) => (
        <Animated.View
          key={g}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            opacity: spin.interpolate({ inputRange: curves[g].inp, outputRange: curves[g].out }),
          }]}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {tiles.map((t, i) => <Path key={i} d={t.d} fill={t.fill} fillOpacity={t.op} />)}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function SphereGrid({ size, eq, spin }: { size: number; eq: [string, string, string]; spin: Animated.Value }) {
  const { tiles, flashes } = useMemo(() => buildSphereTiles(size, eq), [size, eq]);
  const arcs = useMemo(() => buildLatitudeArcs(size), [size]);
  const seam = Math.max(0.5, size * 0.0035);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        {tiles.map((t, i) => (
          // even-odd so the frame paths (outer tile + inner face in one `d`)
          // punch their own hole and paint only the border
          <Path key={i} d={t.d} fill={t.fill} fillOpacity={t.op} fillRule="evenodd" />
        ))}
        {arcs.map((d, i) => (
          // Light on the lit side now comes from the tile frames themselves, so
          // these only need to add a hairline of definition. At the old 0.45
          // they cut straight through the bright grid.
          <Path key={`a${i}`} d={d} fill="none" stroke="#07070f" strokeOpacity={0.26} strokeWidth={seam} />
        ))}
      </Svg>
      {/* Above the mirrors, below the seams: the mirrors themselves lighting
          up in sequence as the ball turns. */}
      <MirrorFlash size={size} groups={flashes} spin={spin} />
    </View>
  );
}

// ── The turning part of the grid ──────────────────────────────────────────
// A meridian's projection is the ball's own profile curve scaled horizontally
// by sin(longitude), plus a vertical shear proportional to that scaled x.
// Both are plain transforms, so ONE fixed path per line can be driven round
// the sphere by the native driver — 24 animated views for the whole rotating
// grid, instead of animating hundreds of facets. Verified numerically against
// the true projection: exact everywhere except within ~0.3° of dead centre,
// where the meridian is a straight vertical line and the difference cannot be
// drawn anyway.
function buildMeridianBase(size: number, dx = 0): string {
  const R = size / 2, cx = R, cy = R, ct = Math.cos(TILT);
  let d = '';
  for (let i = 0; i <= 48; i++) {
    const b = -Math.PI / 2 + (Math.PI * i) / 48;
    d += (i ? ' L ' : 'M ') + (cx + dx + R * Math.cos(b)).toFixed(2) + ' ' + (cy - R * Math.sin(b) * ct).toFixed(2);
  }
  return d;
}

function Meridian({ size, path, litPath, lam0, spin, width }: {
  size: number; path: string; litPath: string; lam0: number; spin: Animated.Value; width: number;
}) {
  const { inp, sx, sk, op } = useMemo(() => {
    const st = Math.sin(TILT);
    const N = 72;
    const inp: number[] = [], sx: number[] = [], sk: string[] = [], op: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      inp.push(t);
      const lam = lam0 + 2 * Math.PI * t;
      const s = Math.sin(lam), c = Math.cos(lam);
      // Never exactly zero: a zero scaleX is a degenerate matrix.
      sx.push(Math.abs(s) < 0.002 ? (s < 0 ? -0.002 : 0.002) : s);
      const tan = Math.abs(s) < 1e-6 ? (c >= 0 ? 1e9 : -1e9) : (st * c) / s;
      const deg = Math.max(-89, Math.min(89, (Math.atan(tan) * 180) / Math.PI));
      sk.push(`${deg.toFixed(3)}deg`);
      // Full strength up to the silhouette, then gone as it passes behind.
      op.push(c >= 0 ? 1 : Math.max(0, 1 + c / 0.15));
    }
    return { inp, sx, sk, op };
  }, [lam0]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, top: 0, width: size, height: size,
        opacity: spin.interpolate({ inputRange: inp, outputRange: op }),
        transform: [
          { skewY: spin.interpolate({ inputRange: inp, outputRange: sk }) },
          { scaleX: spin.interpolate({ inputRange: inp, outputRange: sx }) },
        ],
      }}
    >
      <Svg width={size} height={size}>
        {/* Paired stroke — a pale line just off the dark one reads as the lit
            edge of a real seam rather than a wire drawn on the ball. It rides
            in the SAME animated view (offset in path space, so no second
            transform and no extra animated views); the scaleX shrinks the gap
            toward the front meridian, which is right — face-on you wouldn't
            see the edge of a seam anyway. */}
        <Path d={litPath} fill="none" stroke="#e8eeff" strokeOpacity={0.24} strokeWidth={width} />
        <Path d={path} fill="none" stroke="#07070f" strokeOpacity={0.5} strokeWidth={width} />
      </Svg>
    </Animated.View>
  );
}

// 32 to match the tile columns: the mirrors' own vertical boundaries are no
// longer drawn (see BEVEL), so these ARE the ball's vertical seams and they
// should sit at the same pitch as the mirrors they run between.
function RotatingMeridians({ size, spin, count = 32 }: { size: number; spin: Animated.Value; count?: number }) {
  const width = Math.max(0.6, size * 0.004);
  const path = useMemo(() => buildMeridianBase(size), [size]);
  const litPath = useMemo(() => buildMeridianBase(size, -Math.max(1, size * 0.0045)), [size]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, m) => (
        <Meridian key={m} size={size} path={path} litPath={litPath}
          lam0={(2 * Math.PI * m) / count} spin={spin} width={width} />
      ))}
    </View>
  );
}

// The one moving layer on the ball: soft light patches (plus a few tight hot
// spots that read as individual mirrors catching the beam) scrolling behind
// the static grid. Two identical copies, one native-driver translateX loop
// — the seam-tiling contract from the original build, unchanged.
type LightBlob = { x: number; y: number; r: number; g: string };

function LightPatches({ size, spin, eq }: { size: number; spin: Animated.Value; eq: [string, string, string] }) {
  // spin 0..1 slides the strip left→right across one texture width. Rightward
  // is deliberate: a rightward drag scrubs forward, and the surface following
  // the finger in that same direction is what makes the scrub feel physical.
  const scrollX = spin.interpolate({ inputRange: [0, 1], outputRange: [-size, 0] });
  const blobs = useMemo(() => {
    const out = Array.from({ length: 14 }, (_, i) => {
      const tight = hash01(i * 1.97 + 0.4) > 0.44;
      return {
        x: hash01(i * 3.71 + 0.37) * size,
        y: hash01(i * 8.13 + 2.11) * size,
        r: size * (tight ? 0.05 + hash01(i * 4.31) * 0.045 : 0.15 + hash01(i * 6.73) * 0.13),
        g: tight ? 'lpHot' : (i % 2 ? 'lpSoft' : 'lpCool'),
      };
    });
    // Four big soft washes on top of the small stuff. The little hot spots
    // give per-mirror sparkle, but they're too fine to carry the rotation on
    // their own — these are the broad bright regions sweeping round that let
    // you see the ball turning from across the car.
    for (let i = 0; i < 4; i++) {
      out.push({
        x: hash01(i * 13.7 + 5.1) * size,
        y: hash01(i * 11.3 + 3.9) * size,
        r: size * (0.34 + hash01(i * 17.1) * 0.14),
        g: 'lpBig',
      });
    }
    return out;
  }, [size]);

  return (
    // STRUCTURE IS LOAD-BEARING — do not "tidy" this into one wide absolutely
    // positioned Svg. That rewrite (round 4) is exactly when the ball stopped
    // appearing to turn: the value animated fine and a native transform on a
    // plain View moved fine, but this layer never budged on device. A
    // flexDirection row of two same-width faces, laid out in normal flow, is
    // the arrangement that demonstrably moves.
    <Animated.View
      pointerEvents="none"
      style={{ flexDirection: 'row', width: size * 2, height: size, transform: [{ translateX: scrollX }] }}
    >
      <LightFace size={size} eq={eq} blobs={blobs} sfx="a" />
      <LightFace size={size} eq={eq} blobs={blobs} sfx="b" />
    </Animated.View>
  );
}

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
        <RadialGradient id={gid('lpSoft')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={gid('lpCool')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={eq[0]} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={eq[0]} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={gid('lpBig')} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.34" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill="#08070f" />
      {[-1, 0, 1].map((k) =>
        blobs.map((b, i) => (
          <Circle key={`${k}_${i}`} cx={b.x + k * size} cy={b.y} r={b.r} fill={`url(#${gid(b.g)})`} />
        )),
      )}
    </Svg>
  );
}

const WASH_CYCLE_MS = 15000; // full first-hue -> second -> third -> first loop
// Held WAY back on purpose. This is a flat colour slab over the whole ball,
// so every point of opacity here directly cancels the travelling light
// underneath. At 0.44 a quarter-turn only moved the median pixel by 6/255 —
// the ball was genuinely rotating and simply could not be seen to. Measured
// again at 0.22 it's ~17/255, which reads clearly.
const WASH_PEAK_OPACITY = 0.22;

// The station's own eqColors, cycled as three translucent washes over the
// pale tiles — this is what reads as "the ball's colour shifting" in the
// reference, without needing a CSS hue-rotate RN doesn't have. Sits ABOVE
// the scrolling tiles but BELOW the fixed highlight, so the white specular
// patch stays clean regardless of which hue is currently peaking.
function ColorCycleWash({ size, eq }: { size: number; eq: [string, string, string] }) {
  const cycle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(cycle, { toValue: 1, duration: WASH_CYCLE_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const stops = [0, 1 / 3, 2 / 3, 1];
  const hue1 = cycle.interpolate({ inputRange: stops, outputRange: [WASH_PEAK_OPACITY, 0, 0, WASH_PEAK_OPACITY] });
  const hue2 = cycle.interpolate({ inputRange: stops, outputRange: [0, WASH_PEAK_OPACITY, 0, 0] });
  const hue3 = cycle.interpolate({ inputRange: stops, outputRange: [0, 0, WASH_PEAK_OPACITY, 0] });

  const layer = { position: 'absolute' as const, width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={{ width: size, height: size, position: 'absolute' }}>
      <Animated.View style={[layer, { backgroundColor: eq[0], opacity: hue1 }]} />
      <Animated.View style={[layer, { backgroundColor: mixHex(eq[1], '#D23AE0', 0.4), opacity: hue2 }]} />
      <Animated.View style={[layer, { backgroundColor: eq[2], opacity: hue3 }]} />
    </View>
  );
}

// One twinkling speck of glitter. The cross-flare (two hairline bars) is what
// separates "glitter" from "a dot" — it's the bit that reads as light
// catching an edge. Opacity + scale only, native driver.
function Glint({ x, y, r, cross, dur, delay, color, maxOpacity = 0.95 }: {
  x: number; y: number; r: number; cross: boolean; dur: number; delay: number; color: string; maxOpacity?: number;
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
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.06, maxOpacity] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const box = r * (cross ? 7 : 2);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x - box / 2, top: y - box / 2, width: box, height: box,
      alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }],
    }}>
      {cross && <View style={{ position: 'absolute', width: box, height: 1, backgroundColor: color, opacity: 0.45 }} />}
      {cross && <View style={{ position: 'absolute', width: 1, height: box, backgroundColor: color, opacity: 0.45 }} />}
      <View style={{
        width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color,
        shadowColor: color, shadowOpacity: 0.9, shadowRadius: r * 2.4, shadowOffset: { width: 0, height: 0 },
      }} />
    </Animated.View>
  );
}

// Fine glitter ON the ball — individual mirrors catching the light. Sits
// inside the highlight's half of the sphere where a real key light would
// actually produce flashes, rather than scattered evenly.
function BallGlitter({ size }: { size: number }) {
  const specks = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    x: size * (0.26 + hash01(i * 4.11 + 1.3) * 0.52),
    y: size * (0.18 + hash01(i * 7.53 + 0.7) * 0.5),
    r: 1 + hash01(i * 2.9) * 1.8,
    cross: hash01(i * 6.1) > 0.45,
    dur: 900 + Math.floor(hash01(i * 3.3) * 1100),
    delay: Math.floor(hash01(i * 8.7) * 2200),
  })), [size]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specks.map((s, i) => <Glint key={i} {...s} color="#ffffff" />)}
    </View>
  );
}

// A single soft neon streak drifting down across the ball on its own slow
// yo-yo loop (opacity + translateY only — native driver). Four of these,
// one per NEON hue at staggered periods/phases, are what read as "coloured
// reflections moving across the surface" rather than the ColorCycleWash's
// uniform mood-colour crossfade underneath them.
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
  const tint = (hex: string) => mixHex(hex, eq[1], 0.18);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <NeonStreak size={size} color={tint(NEON.cyan)}    angleDeg={18}  widthPct={0.30} duration={4200} delay={0}    peak={0.22} pulse={pulse} />
      <NeonStreak size={size} color={tint(NEON.magenta)} angleDeg={-24} widthPct={0.24} duration={5100} delay={900}  peak={0.18} pulse={pulse} />
      <NeonStreak size={size} color={tint(NEON.purple)}  angleDeg={10}  widthPct={0.20} duration={4700} delay={1700} peak={0.16} pulse={pulse} />
      <NeonStreak size={size} color={tint(NEON.blue)}    angleDeg={-14} widthPct={0.26} duration={5600} delay={2500} peak={0.20} pulse={pulse} />
    </View>
  );
}

// A whisper-quiet lens flare along the highlight's light axis — a thin
// streak plus a few shrinking ghost rings, the classic subtle "premium
// camera" touch. Static geometry; only its overall opacity breathes with
// the music pulse.
function LensFlare({ size, pulse }: { size: number; pulse: Animated.Value }) {
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] });
  const axis: [number, number][] = [[0.58, 0.5], [0.78, 0.72], [0.90, 0.86]];
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d="M 26 24 L 46 24" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={0.9} strokeLinecap="round" />
        {axis.map(([fx, fy], i) => (
          <Circle key={i} cx={fx * 100} cy={fy * 100} r={2.4 - i * 0.5} fill="none" stroke="#ffffff" strokeOpacity={0.13 - i * 0.03} strokeWidth={0.6} />
        ))}
      </Svg>
    </Animated.View>
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

function MirrorBall({ size, eq, spin, pulse }: { size: number; eq: [string, string, string]; spin: Animated.Value; pulse: Animated.Value }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0a0912' }}>
      {/* The moving layer: light travelling across the surface as it turns */}
      <LightPatches size={size} spin={spin} eq={eq} />

      {/* The sphere itself — facet colours and latitude rings, which under an
          axial turn genuinely don't move */}
      <SphereGrid size={size} eq={eq} spin={spin} />

      {/* ...and the seams that DO move: the meridians sweep round with the
          turn, so the grid itself is visibly rotating rather than only the
          light travelling across it */}
      <RotatingMeridians size={size} spin={spin} />

      {/* Colour cycle — the station's own mood colours washing through,
          above the tiles, below the fixed highlight so it stays clean */}
      <ColorCycleWash size={size} eq={eq} />

      {/* Neon reflections — four independent streaks drifting across the
          surface, above the mood wash so they read as light moving over
          the facets rather than another flat tint */}
      <NeonSweep size={size} eq={eq} pulse={pulse} />

      {/* Fixed lighting — never scrolls, so it reads as a real light source */}
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* The dark outer stops are what make the ball read as round, so
              they stay. The inner WHITE stop does not — it was a flat 50%
              wash sitting exactly where the travelling light lives, and it
              was a big part of why the turn was invisible. */}
          <RadialGradient id="dbShade" cx="0.36" cy="0.3" r="0.9">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
            <Stop offset="0.4" stopColor={eq[1]} stopOpacity="0.1" />
            <Stop offset="0.78" stopColor="#050208" stopOpacity="0.32" />
            <Stop offset="1" stopColor="#020104" stopOpacity="0.75" />
          </RadialGradient>
          <RadialGradient id="dbWarm" cx="0.74" cy="0.8" r="0.55">
            <Stop offset="0" stopColor="#FFA83C" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FFA83C" stopOpacity="0" />
          </RadialGradient>
          {/* Soft-edged, so the mirrors still read through the hotspot
              instead of it sitting on the ball like a painted blob */}
          <RadialGradient id="dbRim" cx="50%" cy="50%" r="50%">
            <Stop offset="0.80" stopColor={eq[2]} stopOpacity="0" />
            <Stop offset="0.955" stopColor={eq[2]} stopOpacity="0.16" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.10" />
          </RadialGradient>
          <RadialGradient id="dbHot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.11" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill="url(#dbShade)" />
        <Circle cx={50} cy={50} r={50} fill="url(#dbWarm)" />
        <Ellipse cx={36} cy={30} rx={19} ry={13} fill="url(#dbHot)" />
        {/* Rim light — a GRADIENT that fades inward, not a stroke. A stroke of
            any weight sits on the silhouette as a drawn outline (the ball
            looked like a sticker); real rim light has no inner edge, it just
            falls off. Nothing here may be a hard ring. */}
        <Circle cx={50} cy={50} r={50} fill="url(#dbRim)" />
      </Svg>

      {/* Lens flare — subtle, along the same light axis as the highlight */}
      <LensFlare size={size} pulse={pulse} />

      {/* Fine glitter on the mirrors themselves */}
      <BallGlitter size={size} />
    </View>
  );
}

// ── Scattered light dots that orbit the room ──────────────────────────────────
// A fixed field of dots; the whole field slowly rotates (one native transform)
// while each dot twinkles on its own native-driver opacity loop. Zero per-frame
// CPU — the "sweep" is staggered phases + the group rotation.
function LightField({ count, eq, live, winW, winH }: {
  count: number; eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
}) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Deterministic pseudo-scatter (no Math.random — banned & keeps it stable).
    const a = (i * 137.508) % 360;               // golden-angle spread
    const rad = 0.16 + ((i * 53) % 100) / 100 * 0.42;
    const ar = (a * Math.PI) / 180;
    const x = 0.5 + Math.cos(ar) * rad;
    const y = 0.42 + Math.sin(ar) * rad * 0.9;
    const size = 6 + (i % 5) * 5;
    const color = [eq[0], eq[1], eq[2], '#EAF2FF'][i % 4];
    const delay = (i * 213) % 1800;
    const dur = 1100 + (i % 6) * 260;
    return { x, y, size, color, delay, dur };
  }), [count, eq]);

  const twinkles = useRef(dots.map(() => new Animated.Value(0.15))).current;

  useEffect(() => {
    const loops = dots.map((d, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(d.delay),
        Animated.timing(twinkles[i], { toValue: 1, duration: d.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(twinkles[i], { toValue: 0.12, duration: d.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: d.x * winW - d.size / 2,
            top: d.y * winH - d.size / 2,
            width: d.size, height: d.size, borderRadius: d.size / 2,
            backgroundColor: d.color,
            opacity: Animated.multiply(twinkles[i], live),
            shadowColor: d.color, shadowOpacity: 0.9, shadowRadius: d.size * 0.9, shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}

// ── Floating bokeh — soft out-of-focus circles drifting in the room ─────────
// Distinct from LightField's small hard twinkle dots: these are big, blurred
// (a RadialGradient falloff, not a solid fill), and drift on a slow yo-yo
// float rather than orbiting — read as an out-of-focus foreground/background
// layer, the classic "premium visualizer" touch. One native-driver loop per
// particle; nothing recomputed per frame.
function BokehDot({ x, y, size, color, driftY, driftX, dur, delay }: {
  x: number; y: number; size: number; color: string; driftY: number; driftX: number; dur: number; delay: number;
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
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -driftY] });
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] });
  const opacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.30, 0.10] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size,
      opacity, transform: [{ translateX }, { translateY }],
    }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="dbBokeh" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <Stop offset="55%" stopColor={color} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#dbBokeh)" />
      </Svg>
    </Animated.View>
  );
}

function BokehField({ count, eq, live, winW, winH }: {
  count: number; eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
}) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => {
    const x = hash01(i * 7.31 + 1.7) * winW;
    const y = winH * 0.10 + hash01(i * 3.13 + 9.4) * winH * 0.72;
    const size = 16 + hash01(i * 5.5 + 2.2) * 30;
    const palette = [eq[0], eq[1], eq[2], NEON.cyan, NEON.magenta, NEON.purple, NEON.blue];
    const color = palette[i % palette.length];
    const driftY = 20 + hash01(i * 9.9) * 26;
    const driftX = (hash01(i * 4.4) - 0.5) * 24;
    const dur = 3600 + Math.floor(hash01(i * 2.1) * 2400);
    const delay = Math.floor(hash01(i * 6.6) * 2000);
    return { x, y, size, color, driftY, driftX, dur, delay };
  }), [count, eq, winW, winH]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: live }]} pointerEvents="none">
      {dots.map((d, i) => <BokehDot key={i} {...d} />)}
    </Animated.View>
  );
}

// ── Star dust — a fine glitter haze hanging in the room ─────────────────────
// Deliberately different from the bokeh (big, soft, out-of-focus) and the
// light field (bigger coloured dots that orbit): these are tiny, sharp and
// numerous, most of them with a hairline cross-flare, densest around the
// ball and thinning out toward the edges of the screen.
function StarDust({ count, live, winW, winH, tint }: {
  count: number; live: Animated.Value; winW: number; winH: number; tint: string;
}) {
  const specks = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Polar scatter around the ball's centre so the dust crowds the light
    // source, with a golden-angle spread that never clumps.
    const ang = ((i * 137.508) % 360) * (Math.PI / 180);
    const rad = 0.10 + Math.sqrt(hash01(i * 2.77 + 0.9)) * 0.62;
    return {
      x: winW * (0.5 + Math.cos(ang) * rad * 0.95),
      y: winH * (0.42 + Math.sin(ang) * rad * 0.72),
      r: 0.8 + hash01(i * 5.31) * 1.6,
      cross: hash01(i * 3.97) > 0.62,
      dur: 800 + Math.floor(hash01(i * 6.19) * 1500),
      delay: Math.floor(hash01(i * 9.41) * 2600),
      color: hash01(i * 7.07) > 0.78 ? tint : '#ffffff',
    };
  }), [count, winW, winH, tint]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: live }]} pointerEvents="none">
      {specks.map((s, i) => <Glint key={i} {...s} maxOpacity={0.85} />)}
    </Animated.View>
  );
}

// ── Volumetric light shafts — a couple of very faint cone gradients falling
// from above the ball, slowly counter-rotating against the light field for
// parallax. Pure static SVG under one native rotate loop — the "haze in a
// beam of light" cue, kept deliberately subtle so it reads as atmosphere,
// not a stage effect.
function VolumetricRays({ size, color }: { size: number; color: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 46000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const raySize = size * 3.2;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: raySize, height: raySize,
      left: -(raySize - size) / 2, top: -(raySize - size) / 2 - size * 0.5,
      opacity: 0.16, transform: [{ rotate }],
    }}>
      <Svg width={raySize} height={raySize} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="dbRay" cx="50%" cy="18%" r="70%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d="M50 4 L22 96 L78 96 Z" fill="url(#dbRay)" />
        <Path d="M50 4 L38 96 L62 96 Z" fill="url(#dbRay)" opacity="0.65" />
      </Svg>
    </Animated.View>
  );
}

export function DiscoBallFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  // Declared up here because the scrub gesture needs the ball's size, and
  // the PanResponder is built before the render body reaches the ball.
  const ballSize = Math.min(winW * 0.71, winH * 0.39, 340);
  const ballSizeRef = useRef(ballSize);
  ballSizeRef.current = ballSize;
  const station = resolveAnyStation(activeId);
  const spotify = useSpotifyPlayback(visible);
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
  const fieldSpin = useRef(new Animated.Value(0)).current;  // dot-field orbit
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

  // Ambient loop that runs the whole time the mode is open. The ball itself
  // does NOT bob — it hangs dead still from its mount, like the real thing;
  // all of its life comes from the turn and the light.
  useEffect(() => {
    if (!visible) return;
    const fieldLoop = Animated.loop(Animated.timing(fieldSpin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true }));
    fieldLoop.start();
    return () => fieldLoop.stop();
  }, [visible]);

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
      // Power cut to the motor — coast a fraction of a turn and settle.
      const to = Math.min(1, phase + 0.03);
      current = Animated.timing(spin, {
        toValue: to, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true,
      });
      current.start(({ finished }) => { if (finished) phaseRef.current = to % 1; });
      return () => { current?.stop(); };
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
    Animated.timing(live, { toValue: lightsOn ? 1 : 0.15, duration: lightsOn ? 900 : 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
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

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  const fieldRotate = fieldSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const bloomColor = mixHex(eq[1], NEON.cyan, 0.3);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#04040c' }, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        <StationBackdrop station={station} blurRadius={2.5} />
        {/* Club-dark wash — deeper than other modes so the light dots pop */}
        <LinearGradient
          colors={['rgba(2,2,10,0.55)', 'rgba(2,2,10,0.42)', 'rgba(2,2,10,0.6)', 'rgba(2,2,10,0.72)', 'rgba(2,2,10,0.8)']}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Orbiting light field — behind the ball, over the whole room */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: fieldRotate }] }]} pointerEvents="none">
          <LightField count={12} eq={eq} live={live} winW={winW} winH={winH} />
        </Animated.View>

        {/* Floating bokeh — soft out-of-focus particles drifting in the room */}
        <BokehField count={7} eq={eq} live={live} winW={winW} winH={winH} />

        {/* Star dust — the fine glitter haze, densest around the ball */}
        <StarDust count={30} live={live} winW={winW} winH={winH} tint={eq[0]} />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>MIRROR BALL</Text>
        </View>

        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
          </View>

          {/* The ball, hanging from a mount, genuinely turning on its axis */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 2, height: ballSize * 0.22, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: -3 }} />
              {/* A ball-sized anchor box — the bloom/ray layers below position
                  themselves relative to it, not the taller pole+ball stack.
                  Also the scrub target: swipe left/right anywhere on the ball. */}
              <View style={{ width: ballSize, height: ballSize }} {...ballPan.panHandlers}>
                <VolumetricRays size={ballSize} color={bloomColor} />
                <BallBloom size={ballSize} color={bloomColor} pulse={pulse} />
                <MirrorBall size={ballSize} eq={eq} spin={spin} pulse={pulse} />
              </View>
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

          <View style={fs.actionRow}>
            <TouchableOpacity onPress={() => setShowMood(true)} style={fs.actionPill} activeOpacity={0.85}>
              <MaterialCommunityIcons name="tune-variant" size={15} color="#fff" />
              <Text style={fs.actionPillBold}>Change Mood</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={fs.actionPill} activeOpacity={0.85}>
              <Ionicons name="musical-notes-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={fs.actionPillText} numberOfLines={1}>
                {spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>


        <ModeCloseButton onPress={handleClose} />

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && spotify.connected && !spotify.track && !handoff} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

        <MoodSheet
          visible={showMood}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); npSetStation(id); setShowMood(false); }}
          onClose={() => setShowMood(false)}
        />

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
    width: '100%', paddingHorizontal: 30, marginTop: 18,
  },
  playBtn: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14,
  },
  pauseBar: { width: 8, height: 28, borderRadius: 2, backgroundColor: '#0a0a12' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 22 },
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
