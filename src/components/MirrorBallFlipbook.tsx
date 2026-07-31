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
const ROWS = 23;
const COLS = 44;
export const FRAMES = 6;

// Below this a mirror is a sliver a pixel or two across at the silhouette,
// where it costs a shape and shows nothing. Culling on the tile's own drawn
// AREA rather than its angle is what pays for the denser grid.
const MIN_AREA = 1.6;

// Same near-head-on view as the shipping ball.
const TILT = 0.05;
// The mirror's face, inset from its tile on BOTH axes, so the ball's dark
// body shows all the way round every mirror.
//
// The shipping ball cannot do this — it insets top and bottom only, because
// its grid is static and a vertical inset would draw seams nailed to the
// screen, which is the round-12 mistake. Here the whole grid moves, so the
// seams move with the mirrors, and a real bevel all round is most of what
// separates chrome from a matte tile (owner, 31.07, comparing against the
// offline render: "currently the flipbook looks slightly matte").
const BEVEL = { u0: 0.08, u1: 0.92, v0: 0.07, v1: 0.93 };

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
        // TWO lobes per lamp, and keeping them apart matters. The BRIGHT one
        // is wide: a narrow highlight lit so few mirrors that the ball had no
        // blown-out anything, which is what reads as matte. The COLOUR one is
        // narrow: widening the highlight with a single lobe tinted half the
        // surface at the same time, and a ball that is broadly blue is a
        // coloured sphere, not a mirrored one.
        let flare = 0;                                   // brightness
        let cLobe = 0, flareHue = 0, flareSat = 0;       // colour
        for (let i = 0; i < LAMPS.length; i++) {
          const L = LAMPS[i];
          const dot = rx * L.d[0] + ry * L.d[1] + rz * L.d[2];
          if (dot <= 0) continue;
          const wide = Math.pow(dot, 15) * L.power;
          if (wide > flare) flare = wide;
          const narrow = Math.pow(dot, 40) * L.power;
          if (narrow > cLobe) { cLobe = narrow; flareHue = i; flareSat = L.sat; }
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
        // Wider range than the first cut: the brightest mirrors need to reach
        // near-white or the surface reads as painted metal rather than
        // polished. `spread` carries most of it — that is the mirror-to-
        // mirror difference, and it is the difference that sells chrome.
        // The resting surface can be brighter here than on the shipping ball.
        // That ball had to stay dark because its motion came from light
        // sliding over a still grid, and a bright resting surface swallowed
        // it (rounds 6 and 13). The flipbook's motion IS the grid, so the
        // old ceiling no longer binds and the mirrors can look polished.
        const t = Math.max(0, Math.min(1, 0.18 + lambert * 0.34 + spread * 0.80 + flare * 1.20));

        // Colour arrives as LIGHT: only a mirror actually catching a coloured
        // lamp carries a cast, so bare silver always shows between them.
        const hue = palette[(flareHue * 3 + Math.floor(env * palette.length)) % palette.length];
        const cast = cLobe > 0.10 ? Math.min(0.42, cLobe * flareSat * 1.5) : 0;
        const fill = cast > 0 ? mixHex(shadeAt(t), hue, cast) : shadeAt(t);

        const P = (u: number, v: number) => {
          const a = (1 - u) * (1 - v), b = u * (1 - v), cc = u * v, dd = (1 - u) * v;
          return {
            x: a * p00.x + b * p01.x + cc * p11.x + dd * p10.x,
            y: a * p00.y + b * p01.y + cc * p11.y + dd * p10.y,
          };
        };
        const f00 = P(BEVEL.u0, BEVEL.v0), f01 = P(BEVEL.u1, BEVEL.v0);
        const f11 = P(BEVEL.u1, BEVEL.v1), f10 = P(BEVEL.u0, BEVEL.v1);
        // Shoelace area — skip anything too small to see.
        const area = Math.abs(
          (f01.x - f00.x) * (f11.y - f00.y) - (f11.x - f00.x) * (f01.y - f00.y),
        );
        if (area < MIN_AREA) continue;
        tiles.push({
          d: `M ${f00.x.toFixed(2)} ${f00.y.toFixed(2)} `
           + `L ${f01.x.toFixed(2)} ${f01.y.toFixed(2)} `
           + `L ${f11.x.toFixed(2)} ${f11.y.toFixed(2)} `
           + `L ${f10.x.toFixed(2)} ${f10.y.toFixed(2)} Z`,
          fill,
          // A bright mirror sits fully opaque and a dull one lets the dark
          // body through, which widens the gap between the two — that
          // contrast is what reads as polished metal rather than paint.
          op: Math.min(1, (0.44 + 0.62 * t) * (0.78 + 0.22 * depth)),
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
 * TRAPEZOID, not a triangle. The first version cross-faded continuously —
 * every moment was a blend of two frames a fraction of a mirror apart, which
 * on the device read as permanent motion blur, as though the ball were
 * spinning much faster than it is (owner, 31.07). Each frame now HOLDS at
 * full strength across the middle of its slot and only cross-fades over the
 * last stretch, so the ball is sharp most of the time and the blend is a
 * short blur between steps rather than the ball's normal state.
 *
 * The two active weights always sum to one, so the surface never dims
 * between frames — that partition-of-unity property is what the plain
 * triangle bought and it has to survive the change.
 *
 * Every peak is derived from `spin` itself rather than run on its own timer,
 * so the frames stay locked to the ball however it is driven — including
 * while a finger is dragging it.
 */
/**
 * Fraction of each slot held perfectly sharp, either side of the frame's own
 * centre. Must stay UNDER 0.5: the two active weights have to sum to one at
 * every moment or the ball brightens and dims between frames, and that only
 * holds if a frame has fallen to zero by the time its neighbour's plateau
 * begins. 0.30 leaves the ball crisp for 60% of each step and blending for
 * the other 40%.
 */
const HOLD = 0.30;

function frameWeight(u: number): number {
  // u = distance from this frame's centre in slots; the cycle is FRAMES slots.
  const d = u - Math.round(u / FRAMES) * FRAMES;
  const a = Math.abs(d);
  if (a <= HOLD) return 1;
  if (a >= 1 - HOLD) return 0;
  return (1 - HOLD - a) / (1 - 2 * HOLD);
}

function frameOpacity(spin: Animated.Value, f: number): Animated.AnimatedInterpolation<number> {
  // Five samples per slot lands exactly on the plateau corners and both ramp
  // ends, so the piecewise-linear interpolation reproduces the trapezoid —
  // and because the sampled values sum to one at every sample, the sum stays
  // one between them too.
  const N = COLS * FRAMES * 5;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    xs.push(x);
    ys.push(frameWeight(x * COLS * FRAMES - f));
  }
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
