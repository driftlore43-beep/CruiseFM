import {
  Circle, ClipPath, Defs, G, Image as SvgImage, Line,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop,
} from 'react-native-svg';

import { DotMatrixGroup, dmFit } from '@/components/DotMatrix';

/**
 * The share card's HERO: a proper illustration of the visual mode the drive is
 * running in.
 *
 * The first version of the card drew the mode as a faint pattern behind the
 * album cover, which made every mode look like the same Spotify pin in a
 * different colour. The point of sharing a Cruise FM card is to show off the
 * mode — that's the part nobody else has — so the mode is now the picture and
 * the album art is a component INSIDE it: the record's label, the CD's face,
 * the cassette's inlay, the sun on the horizon.
 *
 * Rules for anything added here:
 *   • SVG primitives only. The card is rasterised with <Svg>.toDataURL(), so
 *     no Views, no expo-linear-gradient, no images that aren't <Image href>.
 *     That is what keeps the whole feature shippable over the air.
 *   • Everything is coloured from the STATION's eqColors. Mode gives the
 *     shape, mood gives the palette — no fixed neon set (the same mistake the
 *     Mirror Ball mode made and had to have swept out of it).
 *   • Nothing animates. This is a still.
 */

// Card geometry lives here rather than in ShareCard so the hero can be written
// against it without the two files importing each other in a circle.
export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_RATIO = CARD_H / CARD_W;

/** The band of the card the mode owns, between the eyebrow and the song title. */
export const STAGE_TOP = 150;
export const STAGE_H = 740;
export const STAGE_BOTTOM = STAGE_TOP + STAGE_H;   // 890
export const CX = CARD_W / 2;                      // 540
export const CY = STAGE_TOP + STAGE_H / 2;         // 520

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

/** Deterministic 0..1 from an integer. Never Math.random() — the preview and
 *  the exported PNG are two separate renders and must come out identical. */
function h01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

export type Eq = [string, string, string];

/** A colour sampled up the station's own three stops. */
function eqAt(eq: Eq, t: number): string {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? mixHex(eq[0], eq[1], u * 2) : mixHex(eq[1], eq[2], (u - 0.5) * 2);
}

/** Perceived brightness of a colour, 0..1. */
function lum(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}

/**
 * The colour for a big soft glow.
 *
 * Mountain Pass's eqColors are literally ['#FFFFFF','#F2F6FF','#FFFFFF'], and
 * a white haze over half the card turns the whole thing into light grey that
 * white text can't sit on. Pale stations therefore glow in a deepened version
 * of their own colour — still their hue, just not a floodlight.
 */
export function glowCol(eq: Eq): string {
  return mixHex(eq[1], '#0b0c16', Math.pow(lum(eq[1]), 1.5) * 0.62);
}

/** Palette for scattered detail: the three stops plus a lighter and deeper
 *  version of each, so there's variety with no foreign hue. */
function palette(eq: Eq): string[] {
  return eq.flatMap((c) => [mixHex(c, '#ffffff', 0.42), c, mixHex(c, '#0a0b14', 0.42)]);
}

// ── Album art, in the two shapes the modes need ───────────────────────────────

function CoverSquare({ art, x, y, size, rx, id, tint, opacity = 1 }: {
  art: string | null; x: number; y: number; size: number; rx: number; id: string; tint: string; opacity?: number;
}) {
  return (
    <>
      <Defs>
        <ClipPath id={id}><Rect x={x} y={y} width={size} height={size} rx={rx} ry={rx} /></ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`} opacity={opacity}>
        <Rect x={x} y={y} width={size} height={size} fill={tint} />
        {!!art && <SvgImage x={x} y={y} width={size} height={size} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
      </G>
    </>
  );
}

/** The letterbox variant. A cassette inlay is not square, and reusing
 *  CoverSquare for it drew an 804-wide SQUARE straight over the song title. */
function CoverRect({ art, x, y, w, h, rx, id, tint, opacity = 1 }: {
  art: string | null; x: number; y: number; w: number; h: number; rx: number; id: string; tint: string; opacity?: number;
}) {
  return (
    <>
      <Defs>
        <ClipPath id={id}><Rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} /></ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`} opacity={opacity}>
        <Rect x={x} y={y} width={w} height={h} fill={tint} />
        {!!art && <SvgImage x={x} y={y} width={w} height={h} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
      </G>
    </>
  );
}

function CoverCircle({ art, cx, cy, r, id, tint, opacity = 1 }: {
  art: string | null; cx: number; cy: number; r: number; id: string; tint: string; opacity?: number;
}) {
  return (
    <>
      <Defs>
        <ClipPath id={id}><Circle cx={cx} cy={cy} r={r} /></ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`} opacity={opacity}>
        <Circle cx={cx} cy={cy} r={r} fill={tint} />
        {!!art && <SvgImage x={cx - r} y={cy - r} width={r * 2} height={r * 2} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
      </G>
    </>
  );
}

// ── Vinyl ─────────────────────────────────────────────────────────────────────
// A record with the album art as its label, and the silver J tonearm the mode
// itself draws. The label is what makes the cover feel placed rather than
// pasted on.
function VinylArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const R = 322;
  const grooves = [];
  for (let i = 0; i < 30; i++) {
    const r = 152 + i * 5.65;
    const major = i % 6 === 0;
    grooves.push(<Circle key={`gr${i}`} cx={CX} cy={CY} r={r} fill="none"
      stroke="#ffffff" strokeOpacity={major ? 0.10 : 0.045} strokeWidth={major ? 2 : 1.2} />);
  }
  const armEnd = { x: 694, y: 470 };
  const pivot = { x: 986, y: 212 };

  return (
    <>
      <Defs>
        <RadialGradient id={`vnS${uid}`} cx="34%" cy="26%" r="76%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.13" />
          <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0.02" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.30" />
        </RadialGradient>
        <ClipPath id={`vnC${uid}`}><Circle cx={CX} cy={CY} r={R} /></ClipPath>
      </Defs>

      <Circle cx={CX} cy={CY} r={R + 22} fill={glowCol(eq)} fillOpacity={0.10} />
      <Circle cx={CX} cy={CY} r={R} fill="#0a0a11" />
      <G clipPath={`url(#vnC${uid})`}>
        {grooves}
        <Circle cx={CX} cy={CY} r={R} fill={`url(#vnS${uid})`} />
      </G>
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke={eq[1]} strokeOpacity={0.38} strokeWidth={3} />

      <CoverCircle art={art} cx={CX} cy={CY} r={126} id={`vnL${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Circle cx={CX} cy={CY} r={126} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />
      <Circle cx={CX} cy={CY} r={13} fill="#05050a" />

      {/* Tonearm — silver, counterweighted, needle down on the grooves */}
      <Line x1={pivot.x - 8} y1={pivot.y + 10} x2={armEnd.x} y2={armEnd.y} stroke="#0a0a11" strokeOpacity={0.55} strokeWidth={17} strokeLinecap="round" />
      <Line x1={pivot.x - 8} y1={pivot.y + 10} x2={armEnd.x} y2={armEnd.y} stroke="#c9cede" strokeOpacity={0.9} strokeWidth={11} strokeLinecap="round" />
      <Circle cx={pivot.x} cy={pivot.y} r={34} fill="#1b1e2a" stroke="#c9cede" strokeOpacity={0.6} strokeWidth={4} />
      <Circle cx={pivot.x + 30} cy={pivot.y - 34} r={26} fill="#262b3a" stroke="#c9cede" strokeOpacity={0.45} strokeWidth={3} />
      <Path d={`M ${armEnd.x + 26} ${armEnd.y - 30} L ${armEnd.x - 22} ${armEnd.y + 22} L ${armEnd.x + 2} ${armEnd.y + 44} L ${armEnd.x + 50} ${armEnd.y - 8} Z`}
        fill="#dfe4f0" fillOpacity={0.85} />
      <Circle cx={armEnd.x - 12} cy={armEnd.y + 34} r={6} fill={eq[0]} />
    </>
  );
}

// ── CD ────────────────────────────────────────────────────────────────────────
// Mirrored disc under clear jewel-case plastic. The diffraction fan is drawn
// UNDER the album art, exactly as in the mode: a printed face is matte, and
// rainbow streaking across the artwork kills it.
function CdArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const R = 300;
  const pal = palette(eq);
  const wedges = [];
  for (let i = 0; i < 46; i++) {
    const a0 = (i / 46) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 46 * 2.4;   // heavy overlap, or it reads as spokes
    const col = pal[i % pal.length];
    wedges.push(
      <Path key={`w${i}`} fill={col} fillOpacity={0.13}
        d={`M ${CX} ${CY} L ${CX + Math.cos(a0) * R} ${CY + Math.sin(a0) * R} A ${R} ${R} 0 0 1 ${CX + Math.cos(a1) * R} ${CY + Math.sin(a1) * R} Z`} />
    );
  }
  const rings = [];
  for (let i = 0; i < 16; i++) {
    rings.push(<Circle key={`dr${i}`} cx={CX} cy={CY} r={104 + i * 12.5} fill="none" stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1.4} />);
  }
  const CASE = 352;

  return (
    <>
      <Defs>
        <ClipPath id={`cdC${uid}`}><Circle cx={CX} cy={CY} r={R} /></ClipPath>
      </Defs>

      {/* Jewel case: paired strokes are what read as moulded plastic */}
      <Rect x={CX - CASE} y={CY - CASE} width={CASE * 2} height={CASE * 2} rx={18}
        fill="#ffffff" fillOpacity={0.04} stroke="#ffffff" strokeOpacity={0.34} strokeWidth={3.5} />
      <Rect x={CX - CASE + 9} y={CY - CASE + 9} width={CASE * 2 - 18} height={CASE * 2 - 18} rx={13}
        fill="none" stroke="#000000" strokeOpacity={0.30} strokeWidth={2} />
      <Rect x={CX - CASE + 16} y={CY - CASE + 16} width={CASE * 2 - 32} height={CASE * 2 - 32} rx={10}
        fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={1.5} />
      {/* hinge spine */}
      <Rect x={CX - CASE + 4} y={CY - CASE + 40} width={26} height={CASE * 2 - 80} fill="#ffffff" fillOpacity={0.05} />
      {[0, 1, 2].map((k) => (
        <Rect key={`hg${k}`} x={CX - CASE + 2} y={CY - 200 + k * 200} width={30} height={78} rx={8}
          fill="#ffffff" fillOpacity={0.09} />
      ))}

      <Circle cx={CX} cy={CY} r={R} fill="#12141d" fillOpacity={0.82} />
      <G clipPath={`url(#cdC${uid})`}>{wedges}{rings}</G>

      <CoverCircle art={art} cx={CX} cy={CY} r={212} id={`cdA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} opacity={0.66} />
      <Circle cx={CX} cy={CY} r={212} fill="#aab2c4" fillOpacity={0.12} />
      <Circle cx={CX} cy={CY} r={212} fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={2} />

      {/* Hub, small and to scale — the mode learned this the hard way */}
      <Circle cx={CX} cy={CY} r={172} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={2} />
      <Circle cx={CX} cy={CY} r={98} fill="#0e1018" fillOpacity={0.55} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={2} />
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.6;
        return <Circle key={`gp${k}`} cx={CX + Math.cos(a) * 74} cy={CY + Math.sin(a) * 74} r={13} fill="#05060c" fillOpacity={0.75} />;
      })}
      <Circle cx={CX} cy={CY} r={49} fill="#05060c" />
      <Circle cx={CX} cy={CY} r={49} fill="none" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={2} />
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke="#ffffff" strokeOpacity={0.26} strokeWidth={2.5} />
    </>
  );
}

// ── Cassette ──────────────────────────────────────────────────────────────────
// The shell with the album art as its printed inlay, two tape packs and the
// ribbon running between them.
function CassetteArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const SX0 = 92, SY0 = 238, SW = 896, SH = 564;
  const LX = 138, LY = 268, LW = 804, LH = 260;
  const reelY = 650, reelR = 104, reelDX = 182;

  return (
    <>
      <Rect x={SX0} y={SY0} width={SW} height={SH} rx={40}
        fill={mixHex(eq[1], '#0d0f18', 0.74)} fillOpacity={0.94}
        stroke="#ffffff" strokeOpacity={0.20} strokeWidth={3} />
      <Rect x={SX0 + 12} y={SY0 + 12} width={SW - 24} height={SH - 24} rx={32}
        fill="none" stroke="#000000" strokeOpacity={0.28} strokeWidth={2} />

      <CoverRect art={art} x={LX} y={LY} w={LW} h={LH} rx={12} id={`csL${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Rect x={LX} y={LY} width={LW} height={LH} rx={12} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={2} />

      {/* Reels */}
      {[CX - reelDX, CX + reelDX].map((x, i) => (
        <G key={`rl${i}`}>
          <Circle cx={x} cy={reelY} r={reelR} fill="#07080f" fillOpacity={0.82} stroke={eq[0]} strokeOpacity={0.35} strokeWidth={3} />
          <Circle cx={x} cy={reelY} r={reelR - 22} fill="none" stroke="#ffffff" strokeOpacity={0.10} strokeWidth={1.6} />
          <Circle cx={x} cy={reelY} r={42} fill="none" stroke={eq[1]} strokeOpacity={0.55} strokeWidth={3} />
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k / 6) * Math.PI * 2 + i * 0.5;
            return <Path key={k} d={`M ${x + Math.cos(a) * 30} ${reelY + Math.sin(a) * 30} L ${x + Math.cos(a) * 44} ${reelY + Math.sin(a) * 44}`}
              stroke={eq[1]} strokeOpacity={0.6} strokeWidth={7} strokeLinecap="round" />;
          })}
        </G>
      ))}
      {/* Tape between the packs */}
      <Rect x={CX - reelDX} y={reelY + reelR - 5} width={reelDX * 2} height={7} fill={mixHex(eq[2], '#2a1a10', 0.55)} fillOpacity={0.9} />

      {/* Bottom lip: capstan holes and shell screws */}
      <Circle cx={CX - 96} cy={reelY + 132} r={15} fill="#05060c" fillOpacity={0.8} />
      <Circle cx={CX + 96} cy={reelY + 132} r={15} fill="#05060c" fillOpacity={0.8} />
      {[[SX0 + 36, SY0 + SH - 34], [SX0 + SW - 36, SY0 + SH - 34], [SX0 + 36, SY0 + 34], [SX0 + SW - 36, SY0 + 34]].map(([x, y], k) => (
        <Circle key={`sc${k}`} cx={x} cy={y} r={11} fill="#000000" fillOpacity={0.35} stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />
      ))}
    </>
  );
}

// ── Mirror Ball ───────────────────────────────────────────────────────────────
// A genuine sphere projection, the same model the mode uses: each mirror is a
// quad between two latitudes and longitudes, back-face culled, Lambert-shaded
// off its own normal. Static, so it costs nothing here.
const SHADE = ['#131625', '#252a3c', '#464e6c', '#7a85a2', '#b3bed8', '#e6ecfb', '#ffffff'];
const TILT = 0.30;

function MirrorBallArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const R = 228;
  const bcx = CX, bcy = STAGE_TOP + 250;
  const ROWS = 14, COLS = 24;
  const ct = Math.cos(TILT), st = Math.sin(TILT);
  const pal = palette(eq);

  const proj = (b: number, l: number) => {
    const x = Math.cos(b) * Math.sin(l);
    const y = Math.sin(b);
    const z = Math.cos(b) * Math.cos(l);
    const y2 = y * ct - z * st;
    const z2 = y * st + z * ct;
    return { sx: bcx + R * x, sy: bcy - R * y2, nx: x, ny: y2, nz: z2 };
  };

  // Light from the upper left, in front of the ball.
  const LL = 1 / Math.sqrt(0.42 * 0.42 + 0.60 * 0.60 + 0.68 * 0.68);
  const lx = -0.42 * LL, ly = 0.60 * LL, lz = 0.68 * LL;

  const tiles: React.ReactElement[] = [];
  for (let i = 0; i < ROWS; i++) {
    const b0 = -Math.PI / 2 + (i * Math.PI) / ROWS;
    const b1 = -Math.PI / 2 + ((i + 1) * Math.PI) / ROWS;
    const bond = (i % 2) * 0.5;
    for (let j = 0; j < COLS; j++) {
      const l0 = ((j + bond) * 2 * Math.PI) / COLS;
      const l1 = ((j + bond + 1) * 2 * Math.PI) / COLS;
      const bm = (b0 + b1) / 2, lm = (l0 + l1) / 2;
      const c = proj(bm, lm);
      if (c.nz <= 0.05) continue;                       // back-face cull
      const p00 = proj(b0, l0), p01 = proj(b0, l1), p11 = proj(b1, l1), p10 = proj(b1, l0);
      const lam = Math.max(0, c.nx * lx + c.ny * ly + c.nz * lz);
      const jit = (h01(i * 31.7 + j * 7.3) - 0.5) * 0.26;
      const t = clamp(0.10 + lam * 0.95 + jit, 0, 1);
      let col = SHADE[clamp(Math.round(t * (SHADE.length - 1)), 0, SHADE.length - 1)];
      // Most mirrors pick up a little of the room's colour — the station's.
      const cast = h01(i * 5.1 + j * 19.7);
      if (cast < 0.62) col = mixHex(col, pal[Math.floor(h01(i * 3.3 + j * 11.1) * pal.length) % pal.length], 0.14 + cast * 0.34);
      tiles.push(
        <Path key={`t${i}_${j}`} fill={col} fillOpacity={0.94}
          d={`M ${p00.sx.toFixed(1)} ${p00.sy.toFixed(1)} L ${p01.sx.toFixed(1)} ${p01.sy.toFixed(1)} L ${p11.sx.toFixed(1)} ${p11.sy.toFixed(1)} L ${p10.sx.toFixed(1)} ${p10.sy.toFixed(1)} Z`} />
      );
    }
  }

  // Beams falling from the ball onto the cover below.
  const beams = [];
  for (let k = 0; k < 7; k++) {
    const a = -0.9 + (k / 6) * 1.8;
    const x0 = bcx + Math.sin(a) * R * 0.6;
    const spread = 60 + h01(k * 3.7) * 90;
    beams.push(
      <Path key={`bm${k}`} fill={pal[(k * 2) % pal.length]} fillOpacity={0.09}
        d={`M ${x0} ${bcy} L ${bcx + Math.sin(a) * 900 - spread} ${STAGE_BOTTOM + 60} L ${bcx + Math.sin(a) * 900 + spread} ${STAGE_BOTTOM + 60} Z`} />
    );
  }

  const COVER = 240, coverX = CX - COVER / 2, coverY = 636;

  return (
    <>
      <Defs>
        <RadialGradient id={`mbG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.62" stopColor={glowCol(eq)} stopOpacity="0.34" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {beams}
      <Circle cx={bcx} cy={bcy} r={R * 1.9} fill={`url(#mbG${uid})`} />

      {/* Hanging stem */}
      <Rect x={bcx - 3} y={STAGE_TOP - 10} width={6} height={bcy - R - STAGE_TOP + 16} fill="#79839c" fillOpacity={0.6} />
      <Circle cx={bcx} cy={bcy - R + 6} r={16} fill="#6d7691" fillOpacity={0.8} />

      <Circle cx={bcx} cy={bcy} r={R} fill="#0d0f18" />
      {tiles}
      {/* Fades inward, never a hard ring — a stroke at the silhouette reads as
          a drawn outline, which is exactly what the mode had to remove. */}
      <Defs>
        <RadialGradient id={`mbR${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.80" stopColor={eq[1]} stopOpacity="0" />
          <Stop offset="0.96" stopColor={eq[1]} stopOpacity="0.20" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
        </RadialGradient>
      </Defs>
      <Circle cx={bcx} cy={bcy} r={R} fill={`url(#mbR${uid})`} />

      {/* Star dust round the ball */}
      {Array.from({ length: 26 }, (_, k) => {
        const a = h01(k * 9.1) * Math.PI * 2;
        const rr = R * (1.18 + h01(k * 4.4) * 0.62);
        const x = bcx + Math.cos(a) * rr, y = bcy + Math.sin(a) * rr * 0.86;
        const s = 2.5 + h01(k * 2.2) * 4.5;
        return <Circle key={`sd${k}`} cx={x} cy={y} r={s} fill="#ffffff" fillOpacity={0.18 + h01(k * 6.6) * 0.35} />;
      })}

      <CoverSquare art={art} x={coverX} y={coverY} size={COVER} rx={20} id={`mbA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Rect x={coverX} y={coverY} width={COVER} height={COVER} rx={20} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={2} />
    </>
  );
}

// ── Equalizer ─────────────────────────────────────────────────────────────────
// The station's artwork with the segmented LED meter standing in front of it,
// which is literally what the mode is.
function EqualizerArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const COVER = 540, coverX = CX - COVER / 2, coverY = 156;
  // The meter has to sit IN FRONT of the artwork (that's the mode) without
  // burying it, so it's shorter here than on screen and starts lower down.
  const BASE = 856;
  const N = 20, PITCH = CARD_W / N, LAMP_W = PITCH * 0.72;
  const LAMP_H = 22, GAP = 10, UNIT = LAMP_H + GAP;
  const MAX = 12;

  const lamps = [];
  for (let i = 0; i < N; i++) {
    const t = (i - (N - 1) / 2) / (N / 3.4);
    const bell = Math.exp(-0.5 * t * t);
    const segs = Math.max(2, Math.round((0.30 + bell * 0.70) * (0.62 + h01(i * 17.3) * 0.38) * MAX));
    const x = i * PITCH + (PITCH - LAMP_W) / 2;
    for (let k = 0; k < segs; k++) {
      const y = BASE - (k + 1) * UNIT + GAP;
      lamps.push(<Rect key={`l${i}_${k}`} x={x} y={y} width={LAMP_W} height={LAMP_H} rx={4}
        fill={eqAt(eq, k / (MAX - 1))} fillOpacity={0.92} />);
    }
    // Peak cap riding the top, the way a hi-fi meter holds its last peak.
    const capY = BASE - (segs + 1) * UNIT + GAP - 8;
    lamps.push(<Rect key={`c${i}`} x={x} y={capY} width={LAMP_W} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.85} />);
  }

  return (
    <>
      <CoverSquare art={art} x={coverX} y={coverY} size={COVER} rx={26} id={`eqA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Rect x={coverX} y={coverY} width={COVER} height={COVER} rx={26} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />
      <Defs>
        <SvgLinearGradient id={`eqF${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#05060d" stopOpacity="0" />
          <Stop offset="1" stopColor="#05060d" stopOpacity="0.58" />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={coverY + COVER * 0.55} width={CARD_W} height={STAGE_BOTTOM - (coverY + COVER * 0.55)} fill={`url(#eqF${uid})`} />
      {lamps}
    </>
  );
}

// ── Circular EQ ───────────────────────────────────────────────────────────────
function OrbArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const cy = CY - 20;
  const RI = 208;
  const spokes = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const len = 48 + (0.35 + 0.65 * Math.abs(Math.sin(i * 0.7) * 0.6 + Math.sin(i * 0.23) * 0.4)) * 132;
    const x0 = CX + Math.cos(a) * RI, y0 = cy + Math.sin(a) * RI;
    const x1 = CX + Math.cos(a) * (RI + len), y1 = cy + Math.sin(a) * (RI + len);
    spokes.push(<Line key={`sp${i}`} x1={x0} y1={y0} x2={x1} y2={y1}
      stroke={eqAt(eq, (i % 12) / 11)} strokeOpacity={0.85} strokeWidth={11} strokeLinecap="round" />);
  }
  return (
    <>
      <Defs>
        <RadialGradient id={`orG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.45" stopColor={glowCol(eq)} stopOpacity="0.30" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={CX} cy={cy} r={380} fill={`url(#orG${uid})`} />
      {spokes}
      <Circle cx={CX} cy={cy} r={RI - 14} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} />
      <CoverCircle art={art} cx={CX} cy={cy} r={184} id={`orA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Circle cx={CX} cy={cy} r={184} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={3} />
    </>
  );
}

// ── Tuner ─────────────────────────────────────────────────────────────────────
// The head unit itself: the dot-matrix panel with the album art beside it, and
// the dual-band dial with its fixed red needle underneath.
const NEEDLE_RED = '#FF3B30';

function TunerArt({ eq, art, uid, title, artist, freq }: {
  eq: Eq; art: string | null; uid: string; title: string; artist: string; freq: number;
}) {
  const PX = 96, PY = 196, PW = CARD_W - PX * 2, PH = 384;
  const COVER = 230, coverX = PX + 34, coverY = PY + 78;
  const colX = coverX + COVER + 40;
  const colR = PX + PW - 40;
  const colW = colR - colX;

  const T = { dot: 5.0, gap: 1.9 };
  const A = { dot: 3.6, gap: 1.4 };
  const B = { dot: 8.4, gap: 2.8 };
  const L = { dot: 3.4, gap: 1.3 };

  const cut = (s: string, w: number, d: number, g: number) => {
    const n = Math.max(1, dmFit(w, d, g));
    return s.length > n ? s.slice(0, n) : s;
  };
  const fLabel = freq.toFixed(2);

  // Dial
  const DY = 712;
  const ticks = [];
  for (let i = -22; i <= 22; i++) {
    const x = CX + i * 24;
    if (x < 40 || x > CARD_W - 40) continue;
    const whole = i % 5 === 0;
    ticks.push(<Rect key={`tk${i}`} x={x - (whole ? 2 : 1.2)} y={DY - (whole ? 40 : 22)}
      width={whole ? 4 : 2.4} height={whole ? 40 : 22} fill="#D6EAFF" fillOpacity={whole ? 0.8 : 0.3} />);
  }
  const nums = [];
  for (let i = -2; i <= 2; i++) {
    const v = Math.round(freq) + i * 2;
    if (v < 88 || v > 108) continue;
    nums.push(<DotMatrixGroup key={`nm${i}`} text={String(v)} x={CX + i * 240} y={DY - 108}
      dot={3.4} gap={1.3} color="#CFE6FF" anchor="middle" opacity={0.85} />);
  }

  return (
    <>
      {/* Panel */}
      <Rect x={PX} y={PY} width={PW} height={PH} rx={28}
        fill="#040710" fillOpacity={0.78} stroke={eq[1]} strokeOpacity={0.30} strokeWidth={2.5} />
      <Rect x={PX + 10} y={PY + 10} width={PW - 20} height={PH - 20} rx={22}
        fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1.5} />

      <CoverSquare art={art} x={coverX} y={coverY} size={COVER} rx={14} id={`tnA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Rect x={coverX} y={coverY} width={COVER} height={COVER} rx={14} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />

      {/* ON AIR lamp */}
      <Circle cx={colX + 10} cy={coverY + 12} r={10} fill={NEEDLE_RED} fillOpacity={0.95} />
      <Circle cx={colX + 10} cy={coverY + 12} r={19} fill={NEEDLE_RED} fillOpacity={0.22} />
      <DotMatrixGroup text="ON AIR" x={colX + 34} y={coverY} dot={L.dot} gap={L.gap} color="#FF6B5A" opacity={0.95} />

      <DotMatrixGroup text={cut(title.toUpperCase(), colW, T.dot, T.gap)} x={colX} y={coverY + 56}
        dot={T.dot} gap={T.gap} color={eq[1]} dim opacity={1} />
      {!!artist && (
        <DotMatrixGroup text={cut(artist.toUpperCase(), colW, A.dot, A.gap)} x={colX} y={coverY + 122}
          dot={A.dot} gap={A.gap} color={eq[1]} opacity={0.7} />
      )}

      <DotMatrixGroup text="FM" x={colX} y={coverY + 176} dot={B.dot} gap={B.gap} color={eq[1]} dim opacity={0.9} />
      <DotMatrixGroup text={fLabel} x={colR} y={coverY + 176} dot={B.dot} gap={B.gap} color={eq[1]} dim anchor="end" opacity={0.95} />

      {/* Dial */}
      {nums}
      {ticks}
      <Rect x={40} y={DY} width={CARD_W - 80} height={3.5} fill="#9FD8FF" fillOpacity={0.55} />
      {Array.from({ length: 5 }, (_, k) => {
        const x = CX + (k - 2) * 168 + 40;
        return <Circle key={`st${k}`} cx={x} cy={DY - 62} r={7} fill={palette(eq)[(k * 3) % 9]} fillOpacity={0.9} />;
      })}
      <Rect x={CX - 7} y={DY - 128} width={14} height={210} fill={NEEDLE_RED} fillOpacity={0.14} rx={7} />
      <Rect x={CX - 2.4} y={DY - 128} width={4.8} height={210} fill={NEEDLE_RED} fillOpacity={0.75} rx={2.4} />
      <Rect x={CX - 0.9} y={DY - 128} width={1.8} height={210} fill="#FFD9D4" fillOpacity={0.9} />
      <Circle cx={CX} cy={DY + 2} r={9} fill={NEEDLE_RED} />
    </>
  );
}

// ── Horizon ───────────────────────────────────────────────────────────────────
// The album art becomes the sun, sliced by the classic retrowave bands, over a
// receding grid.
function HorizonArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const scx = CX, scy = 452, R = 240;
  const HZ = 706;
  const GEND = STAGE_BOTTOM + 2;

  // The sliced sun is drawn as a clip made of the upper half plus a stack of
  // bars, each bar trimmed to the circle's own chord — so no second clip and
  // no <Mask>, which is the flakiest thing to rasterise.
  const bars: React.ReactElement[] = [];
  let y = scy - 4;
  let bh = 26;
  while (y < scy + R) {
    const dy = Math.max(Math.abs(y - scy), Math.abs(Math.min(y + bh, scy + R) - scy));
    const half = Math.sqrt(Math.max(0, R * R - dy * dy));
    if (half > 2) bars.push(<Rect key={`b${y}`} x={scx - half} y={y} width={half * 2} height={Math.min(bh, scy + R - y)} />);
    y += bh + Math.max(6, bh * 0.42);
    bh = Math.max(7, bh - 3.2);
  }

  const grid = [];
  for (let i = -9; i <= 9; i++) {
    grid.push(<Path key={`gv${i}`} d={`M ${scx + i * 26} ${HZ} L ${scx + i * 300} ${GEND}`}
      stroke={eq[1]} strokeOpacity={0.30} strokeWidth={2.5} />);
  }
  let gy = HZ, step = 6;
  const glines = [];
  while (gy < GEND) {
    glines.push(<Rect key={`gh${gy}`} x={0} y={gy} width={CARD_W} height={2.4} fill={eq[1]} fillOpacity={0.26} />);
    gy += step; step *= 1.46;
  }

  return (
    <>
      <Defs>
        <ClipPath id={`hzC${uid}`}>
          <Path d={`M ${scx - R} ${scy} A ${R} ${R} 0 0 1 ${scx + R} ${scy} Z`} />
          {bars}
        </ClipPath>
        <SvgLinearGradient id={`hzS${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={eq[0]} stopOpacity="0.55" />
          <Stop offset="0.55" stopColor={eq[1]} stopOpacity="0.40" />
          <Stop offset="1" stopColor={eq[2]} stopOpacity="0.62" />
        </SvgLinearGradient>
        <RadialGradient id={`hzG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.5" stopColor={glowCol(eq)} stopOpacity="0.34" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Stars */}
      {Array.from({ length: 34 }, (_, k) => {
        const x = h01(k * 7.7) * CARD_W;
        const yy = STAGE_TOP + h01(k * 3.1) * 320;
        return <Circle key={`sr${k}`} cx={x} cy={yy} r={1.6 + h01(k * 11.3) * 3.4} fill="#ffffff" fillOpacity={0.20 + h01(k * 5.5) * 0.45} />;
      })}

      <Circle cx={scx} cy={scy} r={R * 1.8} fill={`url(#hzG${uid})`} />
      <G clipPath={`url(#hzC${uid})`}>
        <Rect x={scx - R} y={scy - R} width={R * 2} height={R * 2} fill={mixHex(eq[1], '#101322', 0.45)} />
        {!!art && <SvgImage x={scx - R} y={scy - R} width={R * 2} height={R * 2} href={{ uri: art }} preserveAspectRatio="xMidYMid slice" />}
        <Rect x={scx - R} y={scy - R} width={R * 2} height={R * 2} fill={`url(#hzS${uid})`} />
      </G>

      <Rect x={0} y={HZ} width={CARD_W} height={4} fill={eq[0]} fillOpacity={0.75} />
      <G>{glines}</G>
      <G>{grid}</G>
    </>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/** Every mode's hero, plus a safe fallback for anything unrecognised. */
export function ModeHero(props: {
  modeId: string; eq: Eq; art: string | null; uid: string;
  title: string; artist: string; freq: number;
}) {
  const { modeId, eq, art, uid, title, artist, freq } = props;
  switch (modeId) {
    case 'vinyl': return <VinylArt eq={eq} art={art} uid={uid} />;
    case 'cd': return <CdArt eq={eq} art={art} uid={uid} />;
    case 'cassette': return <CassetteArt eq={eq} art={art} uid={uid} />;
    case 'disco': return <MirrorBallArt eq={eq} art={art} uid={uid} />;
    case 'orb': return <OrbArt eq={eq} art={art} uid={uid} />;
    case 'radio': return <TunerArt eq={eq} art={art} uid={uid} title={title} artist={artist} freq={freq} />;
    case 'horizon': return <HorizonArt eq={eq} art={art} uid={uid} />;
    case 'equalizer':
    default: return <EqualizerArt eq={eq} art={art} uid={uid} />;
  }
}
