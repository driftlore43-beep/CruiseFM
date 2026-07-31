import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Path,
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
const BEVEL = { u0: 0.0, u1: 1.0, v0: 0.03, v1: 0.955 };

/**
 * The directions a mirror's own little gradient can run in.
 *
 * On both reference balls the tiles do NOT all shade the same way — each
 * mirror sits at its own angle and catches the room differently, and that
 * disagreement is most of what stops the surface looking printed. One shared
 * direction (what round 15 shipped) made every facet lean the same way.
 *
 * Still only six gradient definitions for the whole ball: SVG gradients are
 * in objectBoundingBox units, so each one rescales to whichever facet uses
 * it. The pick is weighted toward the first two so the ball still reads as
 * lit from the upper left rather than as random noise.
 */
export const FACET_DIRS = [
  { x1: '0', y1: '0', x2: '1', y2: '1' },   // top-left -> bottom-right (key light)
  { x1: '1', y1: '0', x2: '0', y2: '1' },   // top-right -> bottom-left
  { x1: '0', y1: '0', x2: '1', y2: '0' },   // left -> right
  { x1: '0', y1: '0', x2: '0', y2: '1' },   // top -> bottom
  { x1: '0', y1: '1', x2: '1', y2: '0' },   // bottom-left -> top-right
  { x1: '1', y1: '1', x2: '0', y2: '0' },   // bottom-right -> top-left
];

function facetDir(j: number, k: number): number {
  const r = hash01(j * 6.71 + k * 13.37);
  return r < 0.34 ? 0 : r < 0.56 ? 1 : r < 0.72 ? 2 : r < 0.86 ? 3 : r < 0.95 ? 4 : 5;
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
// The band's phase is the tile's own LONGITUDE, folded into a half-turn.
//
// This is what keeps the highlights moving at the ball's own pace. A mirror
// only spends half a revolution on the visible face, so anything travelling
// with the surface crosses the face in HALF a turn — which is what the seams
// do, since they are a true sphere projection. The band used to be keyed to
// screen x over a WHOLE turn, so it crawled across at half the speed of the
// spinning grid, and the two visibly disagreed. Longitude also gives the band
// the right screen speed for free: quick across the middle, slowing into each
// limb, exactly like the surface. Folding into half a turn means two lit
// bands, one either side of the ball, so the visible face is never dark.
const FLASH_PERIOD = 0.5;
// The lit band is a TRAPEZOID, not a soft bump: full brightness out to
// FLASH_CORE, then falling to nothing by FLASH_WIDTH. A pure raised cosine
// only ever put a couple of mirrors at full brightness at any instant — the
// reference clip has roughly a fifth of the ball blazing at once, and the flat
// top is what delivers that without widening the band into a vague glow.
// Both are in turns, so they scale with FLASH_PERIOD, not with 1.
const FLASH_CORE = 0.012;
const FLASH_WIDTH = 0.052;

/**
 * The lamps pointed at the ball.
 *
 * A real mirror ball is lit from a few FIXED directions and each mirror
 * flashes as it swings through a beam — the owner's reference clip shows the
 * bright zone staying put while individual mirrors wink on and off inside it.
 *
 * A static tile grid cannot literally do that (see the note on
 * buildSphereTiles), but assigning each mirror to ONE lamp gets most of the
 * way there for free: `tilt` shifts a lamp's timing by latitude, so its lit
 * mirrors form a DIAGONAL patch rather than a full-height stripe, and three
 * lamps at different tilts means three separate patches catching at different
 * moments in different colours instead of one band sweeping past. It costs
 * nothing — the mirrors simply land in different buckets of the same set.
 *
 * `hue` indexes stationPalette(), so the lamps are always the station's own
 * colours. `sat` is how much of that colour survives in the flash; a mirror
 * catching a beam head-on is mostly white, which is what the reference shows.
 */
const LAMPS = [
  // The beams carry most of the station's colour. A dead mirror shows almost
  // nothing of its own, so tinting the unlit surface harder only makes the
  // ball muddy — it's the CAUGHT mirrors that have to be amber and hot pink.
  // One lamp stays near-white, because a mirror facing a beam head-on is.
  // The two coloured lamps use the station's FIRST and LAST stops at full
  // strength, not the lightened palette variants (hue 4/7) they started on —
  // lightened stops made Sunset's lit mirrors a washed coral when the owner
  // wanted its actual amber and magenta (28.07). Index 0 and 6 are the raw
  // eq[0] and eq[2] in stationPalette's layout.
  { tilt:  0.085, phase: 0.000, hue: 1, sat: 0.05 },   // the KEY light: white, and it stays white
  { tilt: -0.055, phase: 0.167, hue: 0, sat: 0.58 },   // low and to the right, first stop (Sunset: amber)
  { tilt:  0.020, phase: 0.333, hue: 6, sat: 0.46 },   // near the equator, last stop (Sunset: magenta)
];

function buildSphereTiles(size: number, eq: [string, string, string]): { tiles: Tile[]; flashes: Tile[][] } {
  const R = size / 2, cx = R, cy = R;
  // Denser than it was (17 x 32) — the owner's reference balls carry many
  // more, smaller mirrors, and at this count a front-face tile is ~8px wide,
  // which is small enough to read as a mosaic rather than a tiling.
  const ROWS = 25, COLS = 48;   // ~380 visible facets after back-face culling
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

      // The frame between mirrors is continuous metal, so it shades smoothly
      // with no speckle; each mirror reflects its own bit of the room, so
      // neighbours land wildly apart. Both are held DOWN, though — see the
      // note on `depth` below. On the owner's reference clip of a real ball
      // the unlit mirrors are nearly black and there is no bright grid at all.
      const frameStep = lambert * (SHADE_STEPS - 1) - 3.0;
      // Each mirror is a flat plane pointing its own way, so it reflects a
      // completely different part of the room from the one beside it. That is
      // why a real ball looks like a scatter of light and dark squares rather
      // than a smoothly shaded sphere, and it is what sells chrome:
      //
      //     ◼︎◻︎◻︎◼︎
      //     ◻︎⬜◼︎◻︎
      //     ◼︎◻︎⬜◼︎
      //
      // The exponent below 1 pushes the roll toward the ENDS of its range, so
      // genuinely dark mirrors land next to genuinely bright ones instead of
      // everything clustering around the average. Lambert still sets where the
      // ball is broadly lit; this is the scatter on top of it.
      const roll = hash01(j * 31.7 + k * 7.31) * 2 - 1;
      const scatter = Math.sign(roll) * Math.pow(Math.abs(roll), 0.68) * 4.6;
      const faceStep = lambert * (SHADE_STEPS - 1) - 0.7 + scatter;

      // THE MATERIAL IS SILVER. The mood colour is LIGHT falling on it, and
      // light only reaches SOME of the mirrors — the ones angled to catch a
      // coloured lamp. So roughly a quarter of them carry a colour cast and
      // the rest are left as bare chrome, which is what keeps silver visible
      // underneath everything. A cast on every tile is a tinted sphere, not a
      // mirrored one, and that is the thing this round exists to undo.
      const palette = stationPalette(eq);
      const hue = palette[Math.floor(hash01(j * 2.71 + k * 3.97) * palette.length) % palette.length];
      const catchesColour = hash01(j * 5.13 + k * 11.27);
      const cast = catchesColour > 0.74 ? 0.16 + (catchesColour - 0.74) * 1.1 : 0;
      const tint = (s: number, amount: number) => {
        const t = Math.max(0, Math.min(1, s / (SHADE_STEPS - 1)));
        const neutral = shadeAt(t);
        return amount > 0 ? mixHex(neutral, hue, amount) : neutral;
      };

      // Facets near the silhouette sit at a glancing angle — dimmer, so the
      // sphere's edge falls away instead of ending in a hard ring.
      const depth = Math.min(1, c.nz * 1.35);

      // Each mirror is TWO paths: the face, and the frame AROUND it. The frame
      // is a genuine hole-in-the-middle border (even-odd fill), not a full-tile
      // quad sitting under the face — as a full quad its opacity would land on
      // the entire ball and flatten everything beneath it.
      //
      // Both are now DARK and fairly opaque, which is the round-13 rebalance:
      // the resting ball is a dark object, and essentially all of its
      // brightness arrives from MirrorFlash. Before this, every mirror sat at
      // a mid pastel and the mosaic was the most visible thing on screen — so
      // the eye read a static painted pattern with lights sliding over it,
      // which is precisely what the owner kept seeing. Anything that makes the
      // RESTING surface brighter brings that back.
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

      // Each mirror carries its own little gradient — light falling from its
      // top-left corner toward the bottom-right, which is what makes a mirror
      // tile read as glass rather than a coloured square.
      //
      // It is a REAL ramp, and it costs six gradient definitions for the
      // whole ball: SVG gradients default to objectBoundingBox units, so each
      // `dbFacetN` rescales itself to whichever path references it. Per-tile
      // defs (~380 of them) were the obvious approach and the wrong one. A
      // flat two-tone split was tried first and read as a triangle drawn on
      // every tile, not as a falloff. Which of the six a mirror uses is its
      // own — see FACET_DIRS.
      tiles.push({ d: face, fill: tint(faceStep - 0.55, cast), op: 0.55 + 0.35 * depth });
      tiles.push({ d: face, fill: `url(#dbFacet${facetDir(j, k)})`, op: 0.42 + 0.30 * depth });

      // MICRO-BEVEL (owner's premium-detail round, 30.07): a hairline lit lip
      // along each mirror's TOP edge and a shadow lip along its BOTTOM — one
      // shared vertical gradient (`dbLip`, objectBoundingBox) serving every
      // tile, so it costs one def and one path per tile, not per-tile defs.
      // Horizontal edges ONLY: vertical edges are static meridian seams and
      // drawing them is the round-12 mistake (bright regular verticals pin
      // the whole surface). Opacity is jittered per tile — uniform lips read
      // as stamped; scattered ones read as hand-set mirrors. Skipped at the
      // silhouette where tiles are slivers and the lip would just be noise.
      if (depth > 0.35) {
        const lipRoll = hash01(j * 6.29 + k * 13.7);
        tiles.push({ d: face, fill: 'url(#dbLip)', op: (0.16 + lipRoll * 0.26) * depth });
      }

      // ...and a BRIGHT copy of the same face, filed into a phase bucket by
      // where it sits across the ball. MirrorFlash fades these in as a band
      // sweeping left to right, so what travels is individual mirrors catching
      // the light one after another. This layer is now the ball's main source
      // of light, not a highlight on top of a lit surface.
      //
      // The per-mirror amplitude varies hugely and a third of mirrors barely
      // catch at all: on the reference, a lit mirror sits next to a dead one,
      // and that contrast is what makes each read as a separate mirror rather
      // than part of a glowing region.
      const catchRoll = hash01(j * 4.63 + k * 9.11);
      // Below this the mirror's catch is invisible, and with the denser grid
      // that's a couple of hundred paths for nothing.
      if (catchRoll <= 0.12) continue;

      // Which lamp is this mirror angled to catch? Its `tilt` skews the timing
      // by latitude, so each lamp's lit mirrors sweep as a diagonal patch.
      const lamp = LAMPS[Math.floor(hash01(j * 15.73 + k * 4.19) * LAMPS.length) % LAMPS.length];
      const lamTurn = (l0 + l1) / 2 / (2 * Math.PI);
      const jit = (hash01(j * 8.17 + k * 2.53) - 0.5) * 0.010;
      // `phase` staggers the lamps a third of a cycle apart, so their lit
      // patches peak at different moments. Without it all three caught the
      // ball's face at once and then all three slid to the limb together,
      // and the whole ball throbbed from 22% bright down to 4% twice a turn —
      // a beam on the front of a sphere lights a wide area, the same beam at
      // the edge lights a sliver. Staggered, the total stays steady while
      // each patch still sweeps.
      const raw = lamTurn + lamp.tilt * Math.sin((b0 + b1) / 2) + lamp.phase + jit;
      const pl = ((raw % FLASH_PERIOD) + FLASH_PERIOD) % FLASH_PERIOD;
      const g = Math.min(FLASH_GROUPS - 1, Math.floor((pl / FLASH_PERIOD) * FLASH_GROUPS));

      // Brutal contrast, per the reference: a caught mirror goes essentially
      // pure white, and the one beside it stays dead. A gentle spread of
      // mid-brightnesses is what made this read as a glow rather than as
      // separate mirrors.
      flashes[g].push({
        d: face,
        fill: mixHex('#ffffff', palette[lamp.hue % palette.length], lamp.sat),
        op: (catchRoll > 0.42 ? 0.94 + 0.06 * catchRoll : 0.02 + 0.12 * catchRoll) * (0.55 + 0.45 * depth),
      });
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
  const ROWS = 25;   // must match buildSphereTiles
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
function MirrorFlash({ size, groups, spin, lit }: { size: number; groups: Tile[][]; spin: Animated.Value; lit: Animated.Value }) {
  const curves = useMemo(() => groups.map((_, g) => {
    const p = ((g + 0.5) / groups.length) * FLASH_PERIOD;
    const inp: number[] = [], out: number[] = [];
    const N = 60;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const raw = ((s - p) % FLASH_PERIOD + FLASH_PERIOD) % FLASH_PERIOD;
      const dist = Math.min(raw, FLASH_PERIOD - raw);
      inp.push(s);
      const t = dist <= FLASH_CORE ? 1
        : dist >= FLASH_WIDTH ? 0
        : 0.5 * (1 + Math.cos((Math.PI * (dist - FLASH_CORE)) / (FLASH_WIDTH - FLASH_CORE)));
      out.push(t);
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
            // Multiplied by `lit`, so pause takes the flashes with it. Without
            // this the spin simply stops and whichever mirrors were caught
            // stay caught — a paused ball frozen mid-sparkle.
            opacity: Animated.multiply(
              spin.interpolate({ inputRange: curves[g].inp, outputRange: curves[g].out }),
              lit,
            ),
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

function SphereGrid({ size, tiles }: { size: number; tiles: Tile[] }) {
  const arcs = useMemo(() => buildLatitudeArcs(size), [size]);
  const seam = Math.max(0.5, size * 0.0035);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* The per-mirror sheen, in six directions. objectBoundingBox units
              (the SVG default) means each definition stretches to fit every
              facet that references it — real gradients on ~380 tiles for the
              price of six nodes. */}
          {/* The micro-bevel's shared lip gradient — lit top edge, shadow
              bottom edge, nothing in between. objectBoundingBox units, so it
              rescales to whichever tile references it. */}
          <SvgLinearGradient id="dbLip" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <Stop offset="0.10" stopColor="#ffffff" stopOpacity="0" />
            <Stop offset="0.88" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.65" />
          </SvgLinearGradient>
          {FACET_DIRS.map((g, i) => (
            <SvgLinearGradient key={i} id={`dbFacet${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              {/* Six stops, not three. The old ramp fell from white 0.66 to
                  0.10 across the first 46% and then re-darkened — two steep
                  segments meeting at a corner, which is the "harsh gradient
                  line" you can see on the tiles. Easing it through the middle
                  and softening both ends turns the corner into a curve. */}
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.50" />
              <Stop offset="0.18" stopColor="#ffffff" stopOpacity="0.34" />
              <Stop offset="0.40" stopColor="#ffffff" stopOpacity="0.15" />
              <Stop offset="0.58" stopColor="#ffffff" stopOpacity="0.04" />
              <Stop offset="0.78" stopColor="#060606" stopOpacity="0.14" />
              <Stop offset="1" stopColor="#060606" stopOpacity="0.30" />
            </SvgLinearGradient>
          ))}
        </Defs>
        {tiles.map((t, i) => (
          // even-odd so the frame paths (outer tile + inner face in one `d`)
          // punch their own hole and paint only the border
          <Path key={i} d={t.d} fill={t.fill} fillOpacity={t.op} fillRule="evenodd" />
        ))}
        {arcs.map((d, i) => (
          // Light on the lit side now comes from the tile frames themselves, so
          // these only need to add a hairline of definition. At the old 0.45
          // they cut straight through the bright grid.
          <Path key={`a${i}`} d={d} fill="none" stroke="#08080a" strokeOpacity={0.26} strokeWidth={seam} />
        ))}
      </Svg>
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
        <Path d={litPath} fill="none" stroke="#eeeff2" strokeOpacity={0.24} strokeWidth={width} />
        <Path d={path} fill="none" stroke="#08080a" strokeOpacity={0.5} strokeWidth={width} />
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

/**
 * LENS GLINTS — the four-point stars a mirror throws when it lines up with a
 * lamp. This is the single strongest "that's a mirror" cue there is, and the
 * old floating dots did not read as one.
 *
 * Each glint sits at a fixed spot on the ball and flashes for about half a
 * second on its own long period. The periods are all different and none is a
 * multiple of another, so they never fall into step and the pops look random
 * without anything actually being random at runtime. Weighted toward the lit
 * upper-left, because that is where the key light is.
 */
function MirrorGlints({ size, lit }: { size: number; lit: Animated.Value }) {
  const glints = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    // Polar placement keeps them on the ball's face rather than in the corners
    // of its bounding box, and biases them toward the key light.
    const a = hash01(i * 3.11 + 0.5) * Math.PI * 2;
    const rr = Math.pow(hash01(i * 6.37 + 1.7), 0.6) * 0.40;
    return {
      x: size * (0.46 + Math.cos(a) * rr - 0.03),
      y: size * (0.46 + Math.sin(a) * rr - 0.04),
      span: size * (0.13 + hash01(i * 8.9) * 0.13),
      peak: 0.5 + hash01(i * 4.7) * 0.4,
      // Slow shine, not a camera flash (owner, 28.07 — the first cut popped
      // in 170ms and read as strobing). Each glint blooms over ~a second,
      // lingers by the shape of the sine easing, and takes even longer to
      // let go; the long period between shines is what keeps them special.
      period: 3600 + Math.floor(hash01(i * 2.9) * 4600),
      delay: Math.floor(hash01(i * 5.3) * 5200),
    };
  }), [size]);

  const t = useRef(glints.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = glints.map((g, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(g.delay),
        Animated.timing(t[i], { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t[i], { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(g.period),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [glints]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {glints.map((g, i) => {
        const opacity = Animated.multiply(t[i].interpolate({ inputRange: [0, 1], outputRange: [0, g.peak] }), lit);
        const scale = t[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
        const armH = Math.max(1.5, g.span * 0.014);
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', left: g.x - g.span / 2, top: g.y - g.span / 2,
              width: g.span, height: g.span, opacity, transform: [{ scale }],
            }}
          >
            {/* EVERYTHING here is falloff — that is the whole fix. The first
                version was two hard 1px lines and a solid white dot, which on
                device read as a plus sign drawn on the mirrors (owner
                screenshot, 28.07). On the reference flare nothing has an
                edge: the core sits inside a wide soft halo and the arms fade
                to nothing before they end. So the halo+core is one radial
                gradient (per-glint id — 11 separate Svg roots, and duplicate
                ids across roots render blank), and each arm is a gradient
                that is transparent at both tips, inset from the box so its
                reach stays inside the halo's. */}
            <Svg width={g.span} height={g.span} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id={`dbGlintHalo${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                  <Stop offset="0.14" stopColor="#ffffff" stopOpacity="0.6" />
                  <Stop offset="0.4" stopColor="#ffffff" stopOpacity="0.18" />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={g.span / 2} cy={g.span / 2} r={g.span / 2} fill={`url(#dbGlintHalo${i})`} />
            </Svg>
            {/* Vertical arm reaches further than the horizontal one, like the
                reference — a perfectly even cross reads as a marker. */}
            <View style={{ position: 'absolute', left: g.span / 2 - armH / 2, top: g.span * 0.02, width: armH, height: g.span * 0.96 }}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={{ position: 'absolute', top: g.span / 2 - armH / 2, left: g.span * 0.16, height: armH, width: g.span * 0.68 }}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function LightStreaks({ live, winW, winH }: {
  live: Animated.Value; winW: number; winH: number;
}) {
  const streaks = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    // Long enough to run off both edges, so no end is ever visible.
    len: winW * (1.25 + hash01(i * 3.7) * 0.6),
    thick: 1 + hash01(i * 9.1) * 1.4,
    x: winW * (0.1 + hash01(i * 5.3) * 0.8),
    // Stratified down the screen rather than seven independent rolls — those
    // put two beams within ten pixels of each other at similar angles, which
    // reads as one accidental double line.
    y: winH * (0.10 + ((i + hash01(i * 2.9)) / 7) * 0.74),
    // Shallow angles only. Steep ones read as scratches on the screen.
    deg: (hash01(i * 6.7) > 0.5 ? 1 : -1) * (14 + hash01(i * 8.3) * 22),
    peak: 0.05 + hash01(i * 4.9) * 0.09,
    dur: 2600 + Math.floor(hash01(i * 7.1) * 3400),
    delay: Math.floor(hash01(i * 1.9) * 2600),
  })), [winW, winH]);

  const breath = useRef(streaks.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = streaks.map((st, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(st.delay),
        Animated.timing(breath[i], { toValue: 1, duration: st.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath[i], { toValue: 0, duration: st.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [streaks]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {streaks.map((st, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: st.x - st.len / 2,
            top: st.y,
            width: st.len,
            height: st.thick,
            opacity: Animated.multiply(
              breath[i].interpolate({ inputRange: [0, 1], outputRange: [0.012, st.peak] }),
              live,
            ),
            transform: [{ rotate: `${st.deg}deg` }],
          }}
        >
          {/* Faded at both ends. A flat white bar has two hard stops, and if
              either ever lands on screen it reads as a drawn line rather than
              light in the air. */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
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

// A broad glossy shine sweeping across the ball — the highlight you get when
// a light source tracks over a polished sphere. Deliberately a WIDE, soft
// diagonal band rather than a small hotspot: a hotspot reads as a painted
// blob (round 4 already learned that), whereas a band travelling over the
// mirrors reads as light genuinely moving on the surface. Transform +
// opacity only, native driver, clipped by the ball's own circle.
function BallSheen({ size, pulse }: { size: number; pulse: Animated.Value }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(t, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(1000),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const bandW = size * 0.52;
  const travel = size * 0.95;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  const base = t.interpolate({ inputRange: [0, 0.2, 0.5, 0.8, 1], outputRange: [0, 0.85, 0.55, 0.85, 0] });
  const beat = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: size / 2 - bandW / 2, top: -size * 0.3,
        width: bandW, height: size * 1.6,
        opacity: Animated.multiply(base, beat),
        transform: [{ rotate: '22deg' }, { translateX }],
      }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0.10)', 'transparent']}
        locations={[0, 0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

// The single soft specular where the key light hits strongest (owner's
// premium round, 30.07: "one or two bright specular highlights"). NOT a hard
// hotspot — round 4 proved a hard ellipse reads as a painted blob sitting on
// the ball. This is all falloff: a small radial gradient at the key light's
// upper-left, breathing slowly on its own period, and it goes out with the
// music like every other piece of light.
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

// The soft glow BENEATH the ball (owner's premium round, 30.07) — the pool
// of light a hanging mirror ball throws at whatever is under it. Mood-tinted
// because it is LIGHT leaving the ball, not material (the chrome rule); goes
// out with the music like everything else. Sits behind the ball, wider than
// it, fading on its own gradient — no hard edges anywhere near it.
function UnderGlow({ size, color, lit }: { size: number; color: string; lit: Animated.Value }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -size * 0.3, top: size * 0.72,
        width: size * 1.6, height: size * 0.8,
        opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [0, 0.42] }),
      }}
    >
      {/* Explicit size, never "100%" — a percentage canvas is what left the
          ambient hazes drawn at their old proportions after a turn. */}
      <Svg width={size * 1.6} height={size * 0.8} viewBox="0 0 160 80" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="dbUnder" cx="50%" cy="38%" rx="50%" ry="55%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <Stop offset="55%" stopColor={color} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={80} cy={30} rx={78} ry={28} fill="url(#dbUnder)" />
      </Svg>
    </Animated.View>
  );
}

function MirrorBall({ size, eq, spin, pulse, lit }: { size: number; eq: [string, string, string]; spin: Animated.Value; pulse: Animated.Value; lit: Animated.Value }) {
  const { tiles, flashes } = useMemo(() => buildSphereTiles(size, eq), [size, eq]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: '#0b0b0c' }}>
      {/* The moving layer: light travelling across the surface as it turns */}
      <LightPatches size={size} spin={spin} eq={eq} />

      {/* The sphere itself — facet colours and latitude rings, which under an
          axial turn genuinely don't move */}
      <SphereGrid size={size} tiles={tiles} />

      {/* ...and the seams that DO move: the meridians sweep round with the
          turn, so the grid itself is visibly rotating rather than only the
          light travelling across it */}
      <RotatingMeridians size={size} spin={spin} />

      {/* Coloured lamps reaching PARTS of the surface — never the whole of
          it, so bare chrome always shows between them. This is where the
          station's mood lives now; the mirrors themselves are silver. */}
      <ColourReflections size={size} eq={eq} lit={lit} />

      {/* Neon reflections — four independent streaks drifting across the
          surface, above the patches so they read as light moving over
          the facets rather than another flat tint. Gated on the music like
          every other light layer: nothing may drift across a stopped ball. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
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
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
            <Stop offset="0.4" stopColor="#ffffff" stopOpacity="0.04" />
            <Stop offset="0.78" stopColor="#040404" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#020202" stopOpacity="0.78" />
          </RadialGradient>
          {/* Rim light picks up the room, so it may be mood-coloured — it is
              a thin falloff at the silhouette, not a wash over the face. */}
          <RadialGradient id="dbRim" cx="50%" cy="50%" r="50%">
            <Stop offset="0.80" stopColor={eq[2]} stopOpacity="0" />
            <Stop offset="0.955" stopColor={eq[2]} stopOpacity="0.18" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
          </RadialGradient>
          {/* The broad soft bloom around where the key light strikes. Soft
              on purpose — the mirrors must still read through it instead of
              it sitting on the ball like a painted blob (round 4). */}
          <RadialGradient id="dbHot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
            <Stop offset="0.45" stopColor="#ffffff" stopOpacity="0.13" />
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
      <MirrorFlash size={size} groups={flashes} spin={spin} lit={lit} />

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
        <MirrorGlints size={size} lit={lit} />
      </Animated.View>

      {/* The glossy shine and the flare are both light PLAYING on the ball, so
          they belong to the music like the flashes do. Paused, the ball is a
          dull unlit object and nothing may still be sliding across it. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]} pointerEvents="none">
        <KeySpecular size={size} lit={lit} />
        <BallSheen size={size} pulse={pulse} />
        <LensFlare size={size} pulse={pulse} />
      </Animated.View>
    </View>
  );
}

// ── Scattered light dots that orbit the room ──────────────────────────────────
// A fixed field of dots; the whole field slowly rotates (one native transform)
// while each dot twinkles on its own native-driver opacity loop. Zero per-frame
// CPU — the "sweep" is staggered phases + the group rotation.
function LightField({ count, eq, live, winW, winH, offsetX = 0 }: {
  count: number; eq: [string, string, string]; live: Animated.Value; winW: number; winH: number;
  offsetX?: number;
}) {
  const dots = useMemo(() => Array.from({ length: count }, (_, i) => {
    // Deterministic pseudo-scatter (no Math.random — banned & keeps it stable).
    const a = (i * 137.508) % 360;               // golden-angle spread
    const rad = 0.16 + ((i * 53) % 100) / 100 * 0.42;
    const ar = (a * Math.PI) / 180;
    // Spread across the WHOLE room, not just a halo round the ball. The ball
    // is meant to be the source, not the brightest object — what should catch
    // the eye is its light landing on everything else (owner, 28.07).
    const x = 0.5 + Math.cos(ar) * rad * 1.35;
    const y = 0.46 + Math.sin(ar) * rad * 1.25;
    // Small and bright, with a wide soft shadow around them — a reflection
    // thrown onto a wall is a sharp speck inside a soft pool. Rendered fat
    // they read as coloured bubbles floating in front of the ball; the big
    // soft shapes are BokehField's job, not this layer's.
    const size = 5 + (i % 5) * 4;
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
            left: d.x * winW - d.size / 2 + offsetX,
            top: d.y * winH - d.size / 2,
            width: d.size, height: d.size, borderRadius: d.size / 2,
            backgroundColor: d.color,
            opacity: Animated.multiply(twinkles[i], live),
            // A generous shadow radius is what turns a hard dot into a patch
            // of light lying on the room. Without it these read as confetti.
            shadowColor: d.color, shadowOpacity: 1, shadowRadius: d.size * 1.6, shadowOffset: { width: 0, height: 0 },
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
    const palette = stationPalette(eq);
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
/**
 * The beams the ball throws into the room.
 *
 * The old version was two fat opaque triangles, which read as a drawn cone
 * rather than light. On the owner's reference photograph a mirror ball throws
 * DOZENS of thin shafts at every angle, each a slightly different length and
 * brightness, all of them soft-edged and fading out as they travel — so this
 * is 22 hairline shafts radiating from the ball's centre, each breathing on
 * its own period, with the whole fan turning slowly like stage lighting.
 *
 * Every shaft is a full-diameter view rotated about its own centre, with the
 * gradient drawn in its top half only. RN has no transform-origin, so this is
 * the way to pivot a beam at the ball rather than at its midpoint.
 */
function LightShafts({ size, color, winW }: { size: number; color: string; winW: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 74000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  // Long enough to reach the far corners of the screen, so no shaft ever ends
  // in mid-air — they leave the frame instead.
  const reach = Math.max(winW * 1.5, size * 3.4);
  const shafts = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    deg: (360 / 22) * i + (hash01(i * 3.7) - 0.5) * 7,
    // HAIRLINES. Rendered at the first cut these were up to 24px wide and
    // read as flat wedges radiating out — a drawn starburst, not light. A
    // beam from a mirror tile is a couple of pixels across with a soft bloom
    // either side; the widest here is about 6px and most are nearer 1.
    width: size * (0.004 + Math.pow(hash01(i * 5.3), 2.6) * 0.020),
    len: reach * (0.55 + hash01(i * 8.1) * 0.45),
    peak: 0.10 + hash01(i * 2.9) * 0.26,
    dur: 3200 + Math.floor(hash01(i * 6.7) * 5200),
    delay: Math.floor(hash01(i * 4.1) * 4600),
  })), [size, reach]);

  const breath = useRef(shafts.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = shafts.map((sh, i) => {
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(sh.delay),
        Animated.timing(breath[i], { toValue: 1, duration: sh.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath[i], { toValue: 0, duration: sh.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach((l) => l.stop());
  }, [shafts]);

  const box = reach * 2;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: box, height: box,
      left: (size - box) / 2, top: (size - box) / 2,
      transform: [{ rotate }],
    }}>
      {shafts.map((sh, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: box / 2 - sh.width * 3, top: 0,
            width: sh.width * 6, height: box,
            opacity: breath[i].interpolate({ inputRange: [0, 1], outputRange: [0.03, sh.peak] }),
            transform: [{ rotate: `${sh.deg}deg` }],
          }}
        >
          {/* Two gradients, not one. There is no blur filter available, so the
              soft edge is faked: a WIDE, very faint copy standing in for the
              bloom, and the thin bright core inside it. A single hard-edged
              bar reads as a drawn line however thin you make it. Both run
              from the ball outward and are gone by the end of their throw. */}
          <View style={{ position: 'absolute', left: 0, top: box / 2 - sh.len, width: sh.width * 6, height: sh.len }}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', color, color]}
              locations={[0, 0.72, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, { opacity: 0.22 }]}
            />
          </View>
          <View style={{ position: 'absolute', left: sh.width * 2.5, top: box / 2 - sh.len, width: sh.width, height: sh.len }}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', color, 'rgba(255,255,255,0.9)']}
              locations={[0, 0.66, 1]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>
      ))}
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

  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  // One screen-width of travel per turn of the ball, in the direction its
  // surface travels (right). Same Animated.Value, so they can never drift
  // apart or keep moving after the ball has stopped.
  const fieldDrift = spin.interpolate({ inputRange: [0, 1], outputRange: [0, winW] });
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
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: fieldDrift }] }]} pointerEvents="none">
          <LightField count={16} eq={eq} live={live} winW={winW} winH={winH} offsetX={0} />
          <LightField count={16} eq={eq} live={live} winW={winW} winH={winH} offsetX={-winW} />
        </Animated.View>

        {/* Faint diagonal beams — light in the air, the way a shaft shows when
            it crosses a dark room. These replaced the little twinkling stars,
            which read as 2D sparkles pasted over the picture. They sit behind
            the ball and do NOT travel with it: a beam comes from a fixed lamp,
            so it holds still while the ball's reflections move past it. */}
        <LightStreaks live={live} winW={winW} winH={winH} />

        {/* Floating bokeh — soft out-of-focus particles drifting in the room */}
        <BokehField count={9} eq={eq} live={live} winW={winW} winH={winH} />

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
                <UnderGlow size={ballSize} color={bloomColor} lit={live} />
                {/* Bloom and beams are light LEAVING the ball, so they fade
                    out with the music exactly as the flashes do. */}
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: live }]} pointerEvents="none">
                  <LightShafts size={ballSize} color={bloomColor} winW={winW} />
                  <BallBloom size={ballSize} color={bloomColor} pulse={pulse} />
                </Animated.View>
                <MirrorBall size={ballSize} eq={eq} spin={spin} pulse={pulse} lit={live} />
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
