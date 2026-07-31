import { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * THE FLIPBOOK — a prototype of a mirror ball whose MIRRORS actually turn.
 *
 * The shipping ball's tiles are ~1500 static paths and only light moves over
 * them, because a tile's screen position depends on both its latitude and its
 * longitude, so no single transform can carry a whole column (measured: a
 * best-fit affine per column is out by 89px on a 170px radius, and it does not
 * improve with more columns). This takes the other road.
 *
 * THE TRICK: a mirror ball is regular in longitude, so rotating the grid by
 * exactly one tile's width maps the whole tile set back onto itself. Six
 * frames covering that one tile-width therefore loop forever with no seam,
 * and the mirrors genuinely move between them. Six copies of the grid are
 * built once and never touched again; the only thing that animates is which
 * copy is showing, which is opacity on six views — one native-driver
 * animation for the entire surface.
 *
 * WHAT THAT FORCES, and it is an improvement rather than a compromise: the
 * shipping ball gives each tile a fixed random brightness, keyed to its
 * identity. That cannot survive the loop — at the wrap, tile k lands where
 * k+1 was and would arrive carrying the wrong brightness, so the pattern
 * would visibly jump. Brightness here is instead a function of where a mirror
 * is POINTING: each one reflects the room in its own direction, and as the
 * ball turns it sweeps through the room and brightens and dims accordingly.
 * That is both what makes the loop exact and what a real mirror actually
 * does — the shipping ball's separate flashing-mirror layer exists only to
 * fake this, and is not needed here.
 */

// ── Local copies of the ball's colour helpers ────────────────────────────
// Duplicated rather than imported: DiscoBallMode imports this file, so
// importing back would be a cycle. If the flipbook graduates, these move to a
// shared module and both sides take them from there.

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

// The chrome ramp, unchanged: the material is neutral silver on every
// station and the mood arrives as light.
const SHADE_ANCHORS = ['#0a0a0b', '#191a1b', '#343537', '#646568', '#a2a3a5', '#dcdcde', '#ffffff'];
function shadeAt(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (SHADE_ANCHORS.length - 1);
  const i = Math.min(SHADE_ANCHORS.length - 2, Math.floor(x));
  return mixHex(SHADE_ANCHORS[i], SHADE_ANCHORS[i + 1], x - i);
}

function stationPalette(eq: [string, string, string]): string[] {
  const out: string[] = [];
  for (const c of eq) {
    out.push(c);
    out.push(mixHex(c, '#ffffff', 0.28));
    out.push(mixHex(c, '#161617', 0.42));
  }
  return out;
}

// ── The room, as seen in a mirror ────────────────────────────────────────
//
// Smooth value noise over the REFLECTION direction. Two mirrors side by side
// point about 11° apart, and reflection doubles that, so at this scale they
// land in different cells and come out wildly different — the dark-beside-
// bright checkerboard that makes chrome read as chrome. The same mirror
// changes SMOOTHLY as it turns, because the field is continuous, which is
// what keeps the six frames from strobing.

function lattice(i: number, j: number, k: number): number {
  return hash01(i * 127.1 + j * 311.7 + k * 74.7);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function envNoise(x: number, y: number, z: number, scale: number): number {
  const X = x * scale, Y = y * scale, Z = z * scale;
  const i = Math.floor(X), j = Math.floor(Y), k = Math.floor(Z);
  const fx = smoothstep(X - i), fy = smoothstep(Y - j), fz = smoothstep(Z - k);
  let acc = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
        acc += w * lattice(i + dx, j + dy, k + dz);
      }
    }
  }
  return acc;
}

/** Bright fixed lamps in the room. A mirror pointing at one flares. */
const LAMPS = [
  { d: [-0.52, 0.62, 0.59], power: 1.00, sat: 0.06 },   // the key: essentially white
  { d: [0.66, 0.28, 0.70], power: 0.72, sat: 0.52 },    // mood
  { d: [-0.18, -0.55, 0.81], power: 0.58, sat: 0.40 },  // mood, from below
];

export type FlipTile = { d: string; fill: string; op: number };

/** Grid size. Fewer, larger mirrors than the shipping ball — six copies have
 *  to fit in roughly the path budget of one. COLS also sets the loop: the
 *  frames span exactly one tile's width of turn. */
const ROWS = 17;
const COLS = 32;
export const FRAMES = 6;

// Same near-head-on view as the shipping ball.
const TILT = 0.05;
// The mirror's face, inset from the tile so the dark body shows between them.
// Top and bottom edges only — a horizontal inset would draw static vertical
// seams, which is the mistake the shipping ball spent a whole round undoing.
const BEVEL = { v0: 0.03, v1: 0.955 };

/**
 * Builds all six frames. `turn` is in revolutions; frame f sits at
 * f / (FRAMES * COLS), i.e. the frames divide ONE tile's width of rotation.
 */
export function buildFlipbook(size: number, eq: [string, string, string]): FlipTile[][] {
  const R = size / 2, cx = R, cy = R;
  const st = Math.sin(TILT), ct = Math.cos(TILT);
  const palette = stationPalette(eq);

  const project = (beta: number, lam: number) => {
    const cb = Math.cos(beta);
    const x0 = cb * Math.sin(lam);
    const y0 = Math.sin(beta);
    const z0 = cb * Math.cos(lam);
    const y1 = y0 * ct - z0 * st;
    const z1 = y0 * st + z0 * ct;
    return { x: cx + R * x0, y: cy - R * y1, z: z1, nx: x0, ny: y1, nz: z1 };
  };

  const frames: FlipTile[][] = [];
  for (let f = 0; f < FRAMES; f++) {
    const turn = (f / FRAMES) * ((2 * Math.PI) / COLS);
    const tiles: FlipTile[] = [];
    for (let j = 0; j < ROWS; j++) {
      const b0 = -Math.PI / 2 + (Math.PI * j) / ROWS;
      const b1 = -Math.PI / 2 + (Math.PI * (j + 1)) / ROWS;
      // Brick bond, as a real ball is built. It survives the wrap because a
      // whole-column step leaves each row's bond unchanged.
      const bond = (j % 2) * 0.5;
      for (let k = 0; k < COLS; k++) {
        const l0 = (2 * Math.PI * (k + bond)) / COLS + turn;
        const l1 = (2 * Math.PI * (k + bond + 1)) / COLS + turn;
        const p00 = project(b0, l0), p01 = project(b0, l1);
        const p11 = project(b1, l1), p10 = project(b1, l0);
        if (p00.z <= 0.02 || p01.z <= 0.02 || p11.z <= 0.02 || p10.z <= 0.02) continue;

        const c = project((b0 + b1) / 2, (l0 + l1) / 2);
        // Where this mirror throws the view: r = 2(n·v)n − v, with the eye
        // looking straight down −z. Everything below is a function of r, so
        // everything below repeats exactly when the ball has turned one tile.
        const rx = 2 * c.nx * c.nz, ry = 2 * c.ny * c.nz, rz = 2 * c.nz * c.nz - 1;

        // Room texture — the scatter of light and dark mirrors.
        const env = envNoise(rx, ry, rz, 3.1);
        // Lamps: a sharp lobe, so a mirror flares only while it points at one.
        let flare = 0, flareHue = 0, flareSat = 0;
        for (let i = 0; i < LAMPS.length; i++) {
          const L = LAMPS[i];
          const dot = rx * L.d[0] + ry * L.d[1] + rz * L.d[2];
          const lobe = dot > 0 ? Math.pow(dot, 26) * L.power : 0;
          if (lobe > flare) { flare = lobe; flareHue = i; flareSat = L.sat; }
        }
        // Broad shading so the sphere still reads as a lit ball underneath.
        const key = LAMPS[0].d;
        const lambert = Math.max(0, c.nx * key[0] + c.ny * key[1] + c.nz * key[2]);
        // Facets at the silhouette sit at a glancing angle and fall away.
        const depth = Math.min(1, c.nz * 1.35);

        // 0..1 brightness. The env term is pushed toward the ends of its
        // range for the same reason the shipping ball pushes its scatter:
        // a genuinely dark mirror beside a genuinely bright one is the cue.
        const spread = Math.sign(env - 0.5) * Math.pow(Math.abs(env - 0.5) * 2, 0.68) * 0.5;
        const t = Math.max(0, Math.min(1, 0.16 + lambert * 0.34 + spread * 0.62 + flare * 0.9));

        // Colour arrives as LIGHT: only a mirror actually catching a coloured
        // lamp carries a cast, so bare silver always shows between them.
        const hue = palette[(flareHue * 3 + Math.floor(env * palette.length)) % palette.length];
        const cast = flare > 0.06 ? Math.min(0.55, flare * flareSat * 1.6) : 0;
        const fill = cast > 0 ? mixHex(shadeAt(t), hue, cast) : shadeAt(t);

        const P = (u: number, v: number) => {
          const a = (1 - u) * (1 - v), b = u * (1 - v), cc = u * v, dd = (1 - u) * v;
          return {
            x: a * p00.x + b * p01.x + cc * p11.x + dd * p10.x,
            y: a * p00.y + b * p01.y + cc * p11.y + dd * p10.y,
          };
        };
        const f00 = P(0, BEVEL.v0), f01 = P(1, BEVEL.v0);
        const f11 = P(1, BEVEL.v1), f10 = P(0, BEVEL.v1);
        tiles.push({
          d: `M ${f00.x.toFixed(2)} ${f00.y.toFixed(2)} `
           + `L ${f01.x.toFixed(2)} ${f01.y.toFixed(2)} `
           + `L ${f11.x.toFixed(2)} ${f11.y.toFixed(2)} `
           + `L ${f10.x.toFixed(2)} ${f10.y.toFixed(2)} Z`,
          fill,
          op: 0.62 + 0.34 * depth,
        });
      }
    }
    frames.push(tiles);
  }
  return frames;
}

/**
 * Which frame is showing, as a function of the ball's own `spin` value.
 *
 * Frames CROSS-FADE rather than cutting: at any moment the two nearest are
 * mixed, which reads as motion blur across a step of under two degrees
 * instead of a slide show. The three weights always sum to one, so the ball
 * never dims between frames.
 *
 * Every peak is derived from `spin` itself rather than run on its own timer,
 * so the frames stay locked to the ball however it is driven — including
 * while a finger is dragging it.
 */
function frameOpacity(spin: Animated.Value, f: number): Animated.AnimatedInterpolation<number> {
  const w = 1 / (COLS * FRAMES);      // half-width of one frame's slot
  const at = (x: number) => {
    const d = x * COLS - f / FRAMES;
    const dd = d - Math.round(d);
    return Math.max(0, 1 - Math.abs(dd) * FRAMES);
  };
  const xs: number[] = [0];
  const ys: number[] = [at(0)];
  for (let m = 0; m <= COLS; m++) {
    const peak = (m + f / FRAMES) / COLS;
    for (const [x, v] of [[peak - w, 0], [peak, 1], [peak + w, 0]] as [number, number][]) {
      if (x > xs[xs.length - 1] + 1e-6 && x < 1 - 1e-6) { xs.push(x); ys.push(v); }
    }
  }
  xs.push(1); ys.push(at(1));
  return spin.interpolate({ inputRange: xs, outputRange: ys, extrapolate: 'clamp' });
}

export function FlipbookGrid({ size, frames, spin }: {
  size: number; frames: FlipTile[][]; spin: Animated.Value;
}) {
  const ops = useMemo(() => frames.map((_, f) => frameOpacity(spin, f)), [frames, spin]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {frames.map((tiles, f) => (
        <Animated.View key={f} style={[StyleSheet.absoluteFill, { opacity: ops[f] }]} pointerEvents="none">
          <Svg width={size} height={size} pointerEvents="none">
            {tiles.map((t, i) => (
              <Path key={i} d={t.d} fill={t.fill} fillOpacity={t.op} />
            ))}
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}
