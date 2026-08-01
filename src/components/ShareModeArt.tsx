import {
  Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, Line,
  LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop,
  Text as SvgText,
} from 'react-native-svg';

import { DotMatrixGroup, dmFit } from '@/components/DotMatrix';

/**
 * The share card's HERO: a picture of the visual mode the drive is running in.
 *
 * ACCURACY IS THE POINT (owner, 02.08: "the image that renders from the mode —
 * it's much of a different depiction from what the modes actually look like").
 * Every hero here is drawn from the real mode component's own geometry, and
 * the single biggest correction is this: only VINYL and CD show album artwork
 * on screen. The other six never do — the cassette carries a printed paper
 * label, the mirror ball hangs in an empty room, the horizon's sun is a
 * gradient, the tuner is a dot-matrix readout, and both meters are just bars.
 * Pasting the cover into them was what made every hero look like a different
 * app. The cover now has a place of its own beside the song title.
 *
 * Rules for anything added here:
 *   • SVG primitives only. The card is rasterised with <Svg>.toDataURL(), so
 *     no Views, no expo-linear-gradient, no images that aren't <Image href>.
 *     That is what keeps the whole feature shippable over the air.
 *   • Everything is coloured from the STATION's eqColors. Mode gives the
 *     shape, mood gives the palette — no fixed neon set.
 *   • Nothing animates. This is a still.
 *   • When a mode changes, change its hero. A hero that has drifted from its
 *     mode is worse than no hero.
 */

// Card geometry lives here rather than in ShareCard so the hero can be written
// against it without the two files importing each other in a circle.
export const CARD_W = 1080;
export const CARD_H = 1350;
export const CARD_RATIO = CARD_H / CARD_W;

/** The band of the card the mode owns. */
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

/** Album art clipped to a circle — the only shape either of the two modes that
 *  actually shows artwork needs. */
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
// itself draws. One of only two modes that really shows artwork.
function VinylArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const R = 330;
  const grooves = [];
  for (let i = 0; i < 30; i++) {
    const r = 152 + i * 5.8;
    const major = i % 6 === 0;
    grooves.push(<Circle key={`gr${i}`} cx={CX} cy={CY} r={r} fill="none"
      stroke="#ffffff" strokeOpacity={major ? 0.10 : 0.045} strokeWidth={major ? 2 : 1.2} />);
  }
  // Asymmetric scuffs. The mode had to add these because a disc of perfectly
  // concentric circles gives the eye no cue that it is turning; without them
  // the record reads as a flat black hole.
  const scuffs = [];
  for (let i = 0; i < 16; i++) {
    const a = h01(i * 7.7) * Math.PI * 2;
    const rr = 168 + h01(i * 3.1) * 150;
    const len = 6 + h01(i * 5.5) * 22;
    scuffs.push(<Path key={`sc${i}`}
      d={`M ${CX + Math.cos(a) * rr} ${CY + Math.sin(a) * rr} l ${Math.cos(a + 1.4) * len} ${Math.sin(a + 1.4) * len}`}
      stroke="#ffffff" strokeOpacity={0.06 + h01(i * 2.3) * 0.08} strokeWidth={1.4} strokeLinecap="round" />);
  }
  // THE TONEARM. A real arm is a CURVE — it leaves the bearing going down,
  // bends left, and straightens into the headshell (owner's reference photo,
  // 02.08). Drawn as a straight line with a wedge on the end it reads as a
  // stick, which is the "funky line" she spotted.
  const pivot = { x: 982, y: 238 };
  // The stylus has to land on the GROOVES. Set further in, it sat on the
  // label, which is the one place a needle never is.
  const tip = { x: 806, y: 566 };
  const armPath = `M ${pivot.x - 4} ${pivot.y + 18} C ${pivot.x - 24} ${pivot.y + 172}, ${tip.x + 116} ${tip.y - 26}, ${tip.x} ${tip.y}`;
  // The headshell carries on from the tip, angled DOWN-LEFT: that offset angle
  // is what points the stylus in toward the spindle and completes the J.
  const HA = (170 * Math.PI) / 180;
  const dx = Math.cos(HA), dy = Math.sin(HA);
  const px = -dy, py = dx;                        // perpendicular
  const HL = 96, HW = 17;
  const hq = (t: number, u: number) => `${(tip.x + dx * t + px * u).toFixed(1)} ${(tip.y + dy * t + py * u).toFixed(1)}`;
  const stylusX = tip.x + dx * HL, stylusY = tip.y + dy * HL;

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
        {scuffs}
        <Circle cx={CX} cy={CY} r={R} fill={`url(#vnS${uid})`} />
      </G>
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke={eq[1]} strokeOpacity={0.38} strokeWidth={3} />

      <CoverCircle art={art} cx={CX} cy={CY} r={132} id={`vnL${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} />
      <Circle cx={CX} cy={CY} r={132} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={2} />
      <Circle cx={CX} cy={CY} r={13} fill="#05050a" />

      {/* Arm tube: a shadow, the chrome, then a hairline catch along the top.
          Three strokes on ONE path — a tube is round, and a single flat stroke
          is the difference between chrome and a drawn line. */}
      <Path d={armPath} fill="none" stroke="#05060b" strokeOpacity={0.55} strokeWidth={19} strokeLinecap="round" />
      <Path d={armPath} fill="none" stroke="#b9bfd0" strokeOpacity={0.95} strokeWidth={13} strokeLinecap="round" />
      <Path d={armPath} fill="none" stroke="#f2f5fb" strokeOpacity={0.75} strokeWidth={4} strokeLinecap="round" />

      {/* Bearing housing and counterweight */}
      <Circle cx={pivot.x} cy={pivot.y} r={40} fill="#1b1e2a" stroke="#c9cede" strokeOpacity={0.6} strokeWidth={4} />
      <Circle cx={pivot.x} cy={pivot.y} r={24} fill="#0c0e16" stroke="#c9cede" strokeOpacity={0.35} strokeWidth={2.5} />
      <Circle cx={pivot.x} cy={pivot.y} r={7} fill="#e4e8f2" fillOpacity={0.8} />
      <Rect x={pivot.x + 22} y={pivot.y - 62} width={26} height={44} rx={10} fill="#262b3a"
        stroke="#c9cede" strokeOpacity={0.45} strokeWidth={2.5} transform={`rotate(-28 ${pivot.x + 35} ${pivot.y - 40})`} />

      {/* Headshell, cartridge and stylus */}
      <Path d={`M ${hq(-6, HW)} L ${hq(HL, HW * 0.82)} L ${hq(HL, -HW * 0.82)} L ${hq(-6, -HW)} Z`}
        fill="#20242f" stroke="#c9cede" strokeOpacity={0.5} strokeWidth={2} />
      <Path d={`M ${hq(HL * 0.42, HW * 0.5)} L ${hq(HL * 0.9, HW * 0.45)} L ${hq(HL * 0.9, -HW * 0.45)} L ${hq(HL * 0.42, -HW * 0.5)} Z`}
        fill="#0b0d15" />
      <Circle cx={tip.x + dx * HL * 0.66 + px * 2} cy={tip.y + dy * HL * 0.66 + py * 2} r={5} fill={eq[0]} fillOpacity={0.9} />
      <Path d={`M ${stylusX} ${stylusY} L ${stylusX - 3} ${stylusY + 24}`} stroke="#dfe4f0" strokeOpacity={0.9} strokeWidth={3} strokeLinecap="round" />
      {/* Finger lift */}
      <Path d={`M ${hq(HL * 0.1, HW)} L ${hq(HL * 0.34, HW + 26)}`} stroke="#c9cede" strokeOpacity={0.6} strokeWidth={4} strokeLinecap="round" />
    </>
  );
}

// ── CD ────────────────────────────────────────────────────────────────────────
// The mode's own recipe, numbers and all: a TRANSLUCENT disc under clear jewel
// plastic, the album art ghosted across nearly the whole face under a pewter
// wash (etched, not a printed label), and a SMALL hub — 0.155R centre hole,
// gripper holes at 0.235R, hub ring 0.31R, stacking ring 0.62R.
function CdArt({ eq, art, uid }: { eq: Eq; art: string | null; uid: string }) {
  const R = 300;
  const pal = palette(eq);
  const wedges = [];
  for (let i = 0; i < 50; i++) {
    const a0 = (i / 50) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / 50 * 2.4;   // heavy overlap, or it reads as spokes
    wedges.push(
      <Path key={`w${i}`} fill={pal[i % pal.length]} fillOpacity={0.065}
        d={`M ${CX} ${CY} L ${CX + Math.cos(a0) * R} ${CY + Math.sin(a0) * R} A ${R} ${R} 0 0 1 ${CX + Math.cos(a1) * R} ${CY + Math.sin(a1) * R} Z`} />
    );
  }
  const rings = [];
  for (let i = 0; i < 18; i++) {
    rings.push(<Circle key={`dr${i}`} cx={CX} cy={CY} r={100 + i * 11} fill="none" stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1.3} />);
  }
  const CASE = 330;

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
      <Rect x={CX - CASE + 4} y={CY - CASE + 40} width={26} height={CASE * 2 - 80} fill="#ffffff" fillOpacity={0.05} />
      {[0, 1, 2].map((k) => (
        <Rect key={`hg${k}`} x={CX - CASE + 2} y={CY - 200 + k * 200} width={30} height={78} rx={8}
          fill="#ffffff" fillOpacity={0.09} />
      ))}

      {/* The disc is translucent — the drive shows through, which is what makes
          it read as an object rather than a printed circle. */}
      <Circle cx={CX} cy={CY} r={R} fill="#8f97a8" fillOpacity={0.16} />
      <Circle cx={CX} cy={CY} r={R} fill="#12141d" fillOpacity={0.45} />
      <G clipPath={`url(#cdC${uid})`}>{wedges}{rings}</G>

      {/* Art ghosted across nearly the whole face, then a pewter wash over it */}
      <CoverCircle art={art} cx={CX} cy={CY} r={R * 0.86} id={`cdA${uid}`} tint={mixHex(eq[1], '#101322', 0.45)} opacity={0.24} />
      <Circle cx={CX} cy={CY} r={R * 0.86} fill="#aab2c4" fillOpacity={0.17} />

      {/* Hub, small and to scale */}
      <Circle cx={CX} cy={CY} r={R * 0.62} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1.6} />
      <Circle cx={CX} cy={CY} r={R * 0.31} fill="#0e1018" fillOpacity={0.42} stroke="#ffffff" strokeOpacity={0.20} strokeWidth={1.8} />
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + 0.6;
        return <Circle key={`gp${k}`} cx={CX + Math.cos(a) * R * 0.235} cy={CY + Math.sin(a) * R * 0.235} r={11}
          fill="#05060c" fillOpacity={0.7} />;
      })}
      <Circle cx={CX} cy={CY} r={R * 0.155} fill="#05060c" />
      <Circle cx={CX} cy={CY} r={R * 0.155} fill="none" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={2} />
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke="#ffffff" strokeOpacity={0.26} strokeWidth={2.5} />
    </>
  );
}

// ── Cassette ──────────────────────────────────────────────────────────────────
// Ported straight off CassetteMode's own 340x210 drawing, coordinate for
// coordinate: translucent colour shell, the CREAM PAPER LABEL along the top
// (this is where the song is written — the mode has never shown album art
// here), two tape packs on hubs at LX/RX, the ribbon running down to the
// capstans, the window frame, pinch rollers, the bottom lip and its screws.
const CS_VB_W = 340, CS_VB_H = 210;
const CS_LX = 118, CS_RX = 224, CS_RY = 118, CS_PACK_R = 52;

function CassetteArt({ eq, uid, title, artist }: {
  eq: Eq; uid: string; title: string; artist: string;
}) {
  const k = 1000 / CS_VB_W;                       // deck 1000 wide
  const X0 = CX - 500, Y0 = CY - (CS_VB_H * k) / 2;
  const X = (u: number) => X0 + u * k;
  const Y = (v: number) => Y0 + v * k;
  const L = (n: number) => n * k;
  // eqColors[1] is the app-wide accent slot; the shell wears it, as the mode does.
  const shell = eq[1];

  const pack = (cx: number) => (
    <G key={`pk${cx}`}>
      <Circle cx={X(cx)} cy={Y(CS_RY)} r={L(CS_PACK_R)} fill="#0a0c14" fillOpacity={0.8} />
      <Circle cx={X(cx)} cy={Y(CS_RY)} r={L(CS_PACK_R)} fill={shell} fillOpacity={0.13} />
      {Array.from({ length: 9 }, (_, i) => (
        <Circle key={i} cx={X(cx)} cy={Y(CS_RY)} r={L(CS_PACK_R * (0.42 + 0.065 * i))} fill="none"
          stroke="#ffffff" strokeOpacity={0.06} strokeWidth={1.4} />
      ))}
      <Circle cx={X(cx)} cy={Y(CS_RY)} r={L(CS_PACK_R)} fill="none" stroke={shell} strokeOpacity={0.42} strokeWidth={2} />
      {/* Hub: cog spokes round a glowing centre */}
      <Circle cx={X(cx)} cy={Y(CS_RY)} r={L(11)} fill="#0b0d16" stroke={shell} strokeOpacity={0.8} strokeWidth={2.4} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + (cx === CS_LX ? 0.3 : 0);
        return <Path key={`sp${i}`}
          d={`M ${X(cx) + Math.cos(a) * L(11)} ${Y(CS_RY) + Math.sin(a) * L(11)} L ${X(cx) + Math.cos(a) * L(22)} ${Y(CS_RY) + Math.sin(a) * L(22)}`}
          stroke={shell} strokeOpacity={0.75} strokeWidth={L(3.4)} strokeLinecap="round" />;
      })}
    </G>
  );

  return (
    <>
      <Defs>
        <ClipPath id={`csB${uid}`}>
          <Rect x={X(8)} y={Y(8)} width={L(324)} height={L(194)} rx={L(10)} />
        </ClipPath>
        <SvgLinearGradient id={`csS${uid}`} x1="0" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor={mixHex(shell, '#ffffff', 0.16)} stopOpacity="0.55" />
          <Stop offset="1" stopColor={mixHex(shell, '#05070e', 0.55)} stopOpacity="0.75" />
        </SvgLinearGradient>
        <SvgLinearGradient id={`csL${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8EFD2" />
          <Stop offset="1" stopColor="#E7D6A8" />
        </SvgLinearGradient>
      </Defs>

      <Rect x={X(8)} y={Y(8)} width={L(324)} height={L(194)} rx={L(10)} fill={`url(#csS${uid})`} />
      <G clipPath={`url(#csB${uid})`}>
        {/* Window frame — an outline only; the shell is glass you see through */}
        <Rect x={X(60)} y={Y(30)} width={L(220)} height={L(150)} rx={L(6)} fill="none"
          stroke="#ffffff" strokeOpacity={0.13} strokeWidth={1.6} />
        {pack(CS_LX)}
        {pack(CS_RX)}
        {/* Tape ribbon: hub, down to the capstans, across, back up */}
        <Path d={`M ${X(CS_LX)} ${Y(CS_RY)} L ${X(74)} ${Y(168)} L ${X(268)} ${Y(168)} L ${X(CS_RX)} ${Y(CS_RY)}`}
          fill="none" stroke="#0a0c14" strokeOpacity={0.62} strokeWidth={L(3.4)} />
        {/* Pinch rollers and capstans */}
        <Circle cx={X(43)} cy={Y(134)} r={L(4.4)} fill="none" stroke="#ffffff" strokeOpacity={0.30} strokeWidth={1.6} />
        <Circle cx={X(43)} cy={Y(150)} r={L(3)} fill="none" stroke="#ffffff" strokeOpacity={0.24} strokeWidth={1.4} />
        <Circle cx={X(74)} cy={Y(168)} r={L(4.6)} fill="none" stroke="#ffffff" strokeOpacity={0.42} strokeWidth={1.8} />
        <Circle cx={X(268)} cy={Y(168)} r={L(4.6)} fill="none" stroke="#ffffff" strokeOpacity={0.42} strokeWidth={1.8} />
        {/* Bottom lip */}
        <Path d={`M ${X(112)} ${Y(182)} L ${X(228)} ${Y(182)} L ${X(218)} ${Y(200)} L ${X(122)} ${Y(200)} Z`}
          fill="#ffffff" fillOpacity={0.04} stroke="#ffffff" strokeOpacity={0.30} strokeWidth={1.6} />
        <Circle cx={X(136)} cy={Y(190)} r={L(3.6)} fill="#05070e" fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.34} strokeWidth={1.4} />
        <Circle cx={X(204)} cy={Y(190)} r={L(3.6)} fill="#05070e" fillOpacity={0.5} stroke="#ffffff" strokeOpacity={0.34} strokeWidth={1.4} />
        <Rect x={X(30)} y={Y(120)} width={L(26)} height={L(58)} rx={L(4)} fill="#ffffff" fillOpacity={0.05}
          stroke="#ffffff" strokeOpacity={0.26} strokeWidth={1.4} />
        <Rect x={X(37)} y={Y(160)} width={L(12)} height={L(12)} rx={L(2)} fill={shell} fillOpacity={0.55} />

        {/* The paper label. THIS is where the cassette writes the song. */}
        <Rect x={X(30)} y={Y(24)} width={L(280)} height={L(40)} rx={L(4)} fill={`url(#csL${uid})`} />
        <Rect x={X(30)} y={Y(24)} width={L(280)} height={L(13)} rx={L(4)} fill={shell} fillOpacity={0.6} />
        <Rect x={X(30)} y={Y(24)} width={L(280)} height={L(40)} rx={L(4)} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.6} />
        <SvgText x={X(40)} y={Y(34)} fill="#0d1020" fontSize={L(7)} fontWeight="800" letterSpacing={L(1.6)}>
          A · STEREO · C90
        </SvgText>
        <SvgText x={X(40)} y={Y(53)} fill="#0d1020" fontSize={L(11)} fontWeight="800">
          {title.length > 30 ? `${title.slice(0, 29)}…` : title}
        </SvgText>
        <SvgText x={X(300)} y={Y(60)} fill="#0d1020" fillOpacity={0.66} fontSize={L(7)} fontWeight="700" textAnchor="end">
          {artist.length > 34 ? `${artist.slice(0, 33)}…` : artist}
        </SvgText>
        <SvgText x={X(300)} y={Y(176)} fill="#ffffff" fillOpacity={0.20} fontSize={L(5)} textAnchor="end">
          CR-02 · HIGH BIAS · MADE FOR THE ROAD
        </SvgText>
        {/* Angled highlights across the shell */}
        <Path d={`M ${X(20)} ${Y(8)} L ${X(96)} ${Y(8)} L ${X(40)} ${Y(202)} L ${X(8)} ${Y(202)} Z`} fill="#ffffff" fillOpacity={0.045} />
        <Path d={`M ${X(250)} ${Y(8)} L ${X(282)} ${Y(8)} L ${X(214)} ${Y(202)} L ${X(190)} ${Y(202)} Z`} fill="#ffffff" fillOpacity={0.025} />
      </G>
      {/* Screws and the moulded edge */}
      {[[26, 24], [314, 24], [26, 186], [314, 186]].map(([u, v], i) => (
        <Circle key={`scw${i}`} cx={X(u)} cy={Y(v)} r={L(4)} fill="#05070e" fillOpacity={0.5}
          stroke="#ffffff" strokeOpacity={0.26} strokeWidth={1.4} />
      ))}
      <Rect x={X(8)} y={Y(8)} width={L(324)} height={L(194)} rx={L(10)} fill="none" stroke="#ffffff" strokeOpacity={0.42} strokeWidth={3} />
      <Rect x={X(11)} y={Y(11)} width={L(318)} height={L(188)} rx={L(8)} fill="none" stroke="#05070e" strokeOpacity={0.45} strokeWidth={1.6} />
    </>
  );
}

// ── Mirror Ball ───────────────────────────────────────────────────────────────
// The ball hangs in an empty room. NO album cover — the mode has never shown
// one, and the floating square under the ball was the single most obviously
// wrong thing on the old card.
const SHADE = ['#1b1c1e', '#2e3033', '#4b4e53', '#767a80', '#a9adb4', '#dcdfe4', '#ffffff'];
const MB_TILT = 0.06;

function MirrorBallArt({ eq, uid }: { eq: Eq; uid: string }) {
  const R = 258;
  const bcx = CX, bcy = CY - 8;
  const ROWS = 21, COLS = 40;
  const ct = Math.cos(MB_TILT), st = Math.sin(MB_TILT);
  const pal = palette(eq);

  const proj = (b: number, l: number) => {
    const x = Math.cos(b) * Math.sin(l);
    const y = Math.sin(b);
    const z = Math.cos(b) * Math.cos(l);
    const y2 = y * ct - z * st;
    const z2 = y * st + z * ct;
    return { sx: bcx + R * x, sy: bcy - R * y2, nx: x, ny: y2, nz: z2 };
  };

  // Three fixed lamps, as the mode has: one near-white key and two carrying
  // the station's colour. A mirror's brightness comes from where it POINTS.
  const LAMPS: { d: [number, number, number]; power: number; sat: number; hue: string }[] = [
    { d: [-0.52, 0.62, 0.59], power: 1.0, sat: 0.06, hue: '#ffffff' },
    { d: [0.66, 0.28, 0.70], power: 0.74, sat: 0.55, hue: eq[0] },
    { d: [-0.18, -0.55, 0.81], power: 0.6, sat: 0.44, hue: eq[2] },
  ];

  const tiles: React.ReactElement[] = [];
  for (let i = 0; i < ROWS; i++) {
    const b0 = -Math.PI / 2 + (i * Math.PI) / ROWS;
    const b1 = -Math.PI / 2 + ((i + 1) * Math.PI) / ROWS;
    const bond = (i % 2) * 0.5;                       // brick bond, as a real ball is built
    for (let j = 0; j < COLS; j++) {
      const l0 = ((j + bond) * 2 * Math.PI) / COLS;
      const l1 = ((j + bond + 1) * 2 * Math.PI) / COLS;
      const c = proj((b0 + b1) / 2, (l0 + l1) / 2);
      if (c.nz <= 0.04) continue;                     // back-face cull
      const p00 = proj(b0, l0), p01 = proj(b0, l1), p11 = proj(b1, l1), p10 = proj(b1, l0);
      // Reflection direction, the way the mode shades it.
      const rx = 2 * c.nx * c.nz, ry = 2 * c.ny * c.nz, rz = 2 * c.nz * c.nz - 1;
      let flare = 0, hue = '#ffffff', sat = 0;
      for (const L of LAMPS) {
        const dot = rx * L.d[0] + ry * L.d[1] + rz * L.d[2];
        if (dot <= 0) continue;
        const lobe = Math.pow(dot, 22) * L.power;
        if (lobe > flare) { flare = lobe; hue = L.hue; sat = L.sat; }
      }
      const lam = Math.max(0, c.nx * -0.52 + c.ny * 0.62 + c.nz * 0.59);
      // Scatter pushed to the ENDS of its range: a real mirror reflects a
      // completely different part of the room from its neighbour, and that
      // dark-beside-bright checkerboard is most of what sells chrome.
      const roll = h01(i * 31.7 + j * 7.3) - 0.5;
      const spread = Math.sign(roll) * Math.pow(Math.abs(roll) * 2, 0.68) * 0.36;
      const t = clamp(0.30 + lam * 0.40 + spread + flare * 1.1, 0, 1);
      let col = SHADE[clamp(Math.round(t * (SHADE.length - 1)), 0, SHADE.length - 1)];
      if (flare > 0.05) col = mixHex(col, mixHex(hue, '#ffffff', 0.3), Math.min(0.6, flare * sat * 2.2));
      else if (h01(i * 5.1 + j * 19.7) > 0.76) col = mixHex(col, pal[Math.floor(h01(i * 3.3 + j * 11.1) * pal.length) % pal.length], 0.22);
      // A hairline gap top and bottom only. Vertical insets would draw static
      // seams down the ball, which is the one thing the mode may never have.
      const shrink = (a: { sx: number; sy: number }, b: { sx: number; sy: number }, f: number) =>
        `${(a.sx + (b.sx - a.sx) * f).toFixed(1)} ${(a.sy + (b.sy - a.sy) * f).toFixed(1)}`;
      tiles.push(
        <Path key={`t${i}_${j}`} fill={col} fillOpacity={0.96}
          d={`M ${shrink(p00, p10, 0.03)} L ${shrink(p01, p11, 0.03)} L ${shrink(p11, p01, 0.045)} L ${shrink(p10, p00, 0.045)} Z`} />
      );
    }
  }

  // Beams thrown off the mirrors near the limb — a mirror square-on throws its
  // beam down the lens, so the shafts you see come off the edges.
  const beams: React.ReactElement[] = [];
  for (let k = 0; k < 16; k++) {
    const a = h01(k * 4.3) * Math.PI * 2;
    const len = 300 + h01(k * 9.1) * 420;
    const w = 10 + h01(k * 2.7) * 34;
    const x0 = bcx + Math.cos(a) * R * 0.94, y0 = bcy + Math.sin(a) * R * 0.94;
    const x1 = bcx + Math.cos(a) * (R + len), y1 = bcy + Math.sin(a) * (R + len);
    beams.push(
      <Path key={`bm${k}`} fill={pal[(k * 2) % pal.length]} fillOpacity={0.08 + h01(k * 6.1) * 0.07}
        d={`M ${x0} ${y0} L ${x1 - Math.sin(a) * w} ${y1 + Math.cos(a) * w} L ${x1 + Math.sin(a) * w} ${y1 - Math.cos(a) * w} Z`} />
    );
  }

  return (
    <>
      <Defs>
        <RadialGradient id={`mbG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.30" stopColor={glowCol(eq)} stopOpacity="0.30" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`mbR${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.80" stopColor="#ffffff" stopOpacity="0" />
          <Stop offset="0.965" stopColor="#ffffff" stopOpacity="0.10" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
        </RadialGradient>
      </Defs>

      <Circle cx={bcx} cy={bcy} r={R * 2.0} fill={`url(#mbG${uid})`} />
      {beams}

      {/* Hanging stem */}
      <Rect x={bcx - 3} y={STAGE_TOP - 6} width={6} height={bcy - R - STAGE_TOP + 14} fill="#79839c" fillOpacity={0.6} />
      <Circle cx={bcx} cy={bcy - R + 6} r={14} fill="#6d7691" fillOpacity={0.8} />

      <Circle cx={bcx} cy={bcy} r={R} fill="#0a0a0c" />
      {tiles}
      {/* Fades inward, never a hard ring — a stroke at the silhouette reads as
          a drawn outline, which is exactly what the mode had to remove. */}
      <Circle cx={bcx} cy={bcy} r={R} fill={`url(#mbR${uid})`} />
    </>
  );
}

// ── Equalizer ─────────────────────────────────────────────────────────────────
// Exactly what the mode is: 30 segmented bars standing on a baseline over the
// station's own backdrop, lamps 5px with 3px gaps, per-lamp colour sampled up
// the palette, a white peak cap riding each bar. No artwork anywhere.
function EqualizerArt({ eq, uid }: { eq: Eq; uid: string }) {
  const N = 30;
  const BASE = STAGE_BOTTOM - 58;
  const PAD = 44;
  const span = CARD_W - PAD * 2;
  const PITCH = span / N;
  const BAR_W = PITCH - 4;
  const LAMP_H = 14, GAP = 8, UNIT = LAMP_H + GAP;
  const MAX = 16, MIN = 2;

  const lamps: React.ReactElement[] = [];
  for (let i = 0; i < N; i++) {
    // The mode's own bell: tallest in the middle, falling away to the edges.
    const t = (i - (N - 1) / 2) / (N / 3.4);
    const bell = Math.exp(-0.5 * t * t);
    const segs = Math.max(MIN, Math.round((MIN + (MAX - MIN) * bell) * (0.66 + h01(i * 17.3) * 0.34)));
    const x = PAD + i * PITCH + (PITCH - BAR_W) / 2;
    for (let k = 0; k < segs; k++) {
      const y = BASE - (k + 1) * UNIT + GAP;
      lamps.push(<Rect key={`l${i}_${k}`} x={x} y={y} width={BAR_W} height={LAMP_H} rx={3}
        fill={eqAt(eq, k / (MAX - 1))} fillOpacity={0.94} />);
    }
    const capY = BASE - (segs + 1) * UNIT + GAP - 5;
    lamps.push(<Rect key={`c${i}`} x={x} y={capY} width={BAR_W} height={6} rx={3} fill="#ffffff" fillOpacity={0.88} />);
  }

  return (
    <>
      <Defs>
        <RadialGradient id={`eqG${uid}`} cx="50%" cy="90%" r="70%">
          <Stop offset="0" stopColor={glowCol(eq)} stopOpacity="0.30" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={CX} cy={BASE} rx={CARD_W * 0.6} ry={340} fill={`url(#eqG${uid})`} />
      {lamps}
    </>
  );
}

// ── Circular EQ ───────────────────────────────────────────────────────────────
// A ring of radial bars with a HOLLOW centre — the mode says so in its own
// comment ("centre stays hollow"), and the scene shows through it. The old
// hero put the album cover in the middle, which is the opposite.
function OrbArt({ eq, uid }: { eq: Eq; uid: string }) {
  const cy = CY;
  const R0 = 196, MAXLEN = 132;
  const spokes: React.ReactElement[] = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const amp = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.7) * 0.6 + Math.sin(i * 0.23) * 0.4);
    const len = 44 + amp * MAXLEN;
    spokes.push(<Line key={`sp${i}`}
      x1={CX + Math.cos(a) * R0} y1={cy + Math.sin(a) * R0}
      x2={CX + Math.cos(a) * (R0 + len)} y2={cy + Math.sin(a) * (R0 + len)}
      stroke={`url(#cwS${i % 3}${uid})`} strokeOpacity={0.9} strokeWidth={10} strokeLinecap="round" />);
  }
  return (
    <>
      <Defs>
        {[0, 1, 2].map((k) => (
          <SvgLinearGradient key={k} id={`cwS${k}${uid}`} x1="0" y1="0" x2={k === 1 ? '1' : '0.6'} y2="1">
            <Stop offset="0" stopColor={eq[0]} />
            <Stop offset="0.55" stopColor={eq[1]} />
            <Stop offset="1" stopColor={eq[2]} />
          </SvgLinearGradient>
        ))}
        <RadialGradient id={`cwG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.52" stopColor={eq[1]} stopOpacity="0.16" />
          <Stop offset="0.82" stopColor={eq[2]} stopOpacity="0.07" />
          <Stop offset="1" stopColor={eq[2]} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* Halo so the ring reads over the scene — the middle stays empty */}
      <Circle cx={CX} cy={cy} r={R0 + MAXLEN} fill={`url(#cwG${uid})`} />
      {spokes}
    </>
  );
}

// ── Tuner ─────────────────────────────────────────────────────────────────────
// The head unit as the mode draws it: a dot-matrix display with the ON AIR
// lamp on its own row, the song scrolling underneath, STEREO/TUNED, the band
// keys and the big frequency — then the dual-band dial with its fixed red
// needle. No album art; the mode has none.
const NEEDLE_RED = '#FF3B30';

function TunerArt({ eq, uid, title, artist, freq }: {
  eq: Eq; uid: string; title: string; artist: string; freq: number;
}) {
  const PX = 84, PW = CARD_W - PX * 2;
  const PY = STAGE_TOP + 44, PH = 356;
  const colX = PX + 40, colR = PX + PW - 40, colW = colR - colX;
  const lit = mixHex(eq[1], '#ffffff', 0.25);

  const cut = (s: string, dot: number, gap: number) => {
    const n = Math.max(1, dmFit(colW, dot, gap));
    return s.length > n ? s.slice(0, n) : s;
  };

  const DY = STAGE_TOP + 618;                      // the dial's own rail
  const ticks: React.ReactElement[] = [];
  for (let i = -24; i <= 24; i++) {
    const x = CX + i * 22;
    if (x < 40 || x > CARD_W - 40) continue;
    const major = i % 5 === 0;
    ticks.push(<Rect key={`tk${i}`} x={x - (major ? 2 : 1.2)} y={DY - (major ? 40 : 22)}
      width={major ? 4 : 2.4} height={major ? 40 : 22} fill="#D6EAFF" fillOpacity={major ? 0.8 : 0.3} />);
  }
  const nums: React.ReactElement[] = [];
  for (let i = -2; i <= 2; i++) {
    const v = Math.round(freq) + i * 2;
    if (v < 88 || v > 108) continue;
    nums.push(<DotMatrixGroup key={`nm${i}`} text={String(v)} x={CX + i * 240} y={DY - 106}
      dot={3.4} gap={1.3} color="#CFE6FF" anchor="middle" opacity={0.85} />);
  }

  return (
    <>
      {/* Display panel */}
      <Rect x={PX} y={PY} width={PW} height={PH} rx={26}
        fill="#040710" fillOpacity={0.80} stroke={eq[1]} strokeOpacity={0.30} strokeWidth={2.5} />
      <Rect x={PX + 10} y={PY + 10} width={PW - 20} height={PH - 20} rx={20}
        fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1.5} />

      {/* ON AIR, alone on its row */}
      <Circle cx={colX + 10} cy={PY + 44} r={10} fill={NEEDLE_RED} fillOpacity={0.95} />
      <Circle cx={colX + 10} cy={PY + 44} r={19} fill={NEEDLE_RED} fillOpacity={0.22} />
      <DotMatrixGroup text="ON AIR" x={colX + 34} y={PY + 32} dot={3.4} gap={1.3} color="#FF6B5A" opacity={0.95} />

      {/* Song, full width and large — the mode gave it its own row for exactly
          this reason: sharing one with the lamp is what kept it small. */}
      <DotMatrixGroup text={cut(title.toUpperCase(), 5.0, 1.9)} x={colX} y={PY + 80}
        dot={5.0} gap={1.9} color={lit} dim opacity={1} />
      {!!artist && (
        <DotMatrixGroup text={cut(artist.toUpperCase(), 3.2, 1.2)} x={colX} y={PY + 146}
          dot={3.2} gap={1.2} color={lit} opacity={0.7} />
      )}

      {/* STEREO · band keys · TUNED all share one row, which is where the
          mode itself puts the band button. */}
      <DotMatrixGroup text="STEREO" x={colX} y={PY + 202} dot={3.0} gap={1.2} color="#9FD8FF" opacity={0.55} />
      <DotMatrixGroup text="TUNED" x={colR} y={PY + 202} dot={3.0} gap={1.2} color="#9FD8FF" anchor="end" opacity={0.55} />
      {['AM', 'FM'].map((b, i) => {
        const on = b === 'FM';
        const bx = CX - 98 + i * 104;
        return (
          <G key={b}>
            <Rect x={bx} y={PY + 182} width={92} height={54} rx={11}
              fill="#ffffff" fillOpacity={on ? 0.15 : 0.05} stroke="#ffffff" strokeOpacity={on ? 0.45 : 0.18} strokeWidth={1.6} />
            <Rect x={bx + 3} y={PY + 185} width={86} height={3} rx={1.5} fill="#ffffff" fillOpacity={0.24} />
            <Circle cx={bx + 18} cy={PY + 210} r={5} fill={on ? NEEDLE_RED : '#ffffff'} fillOpacity={on ? 0.95 : 0.2} />
            <DotMatrixGroup text={b} x={bx + 34} y={PY + 196} dot={4.2} gap={1.6} color="#CFE6FF" opacity={on ? 0.95 : 0.5} />
          </G>
        );
      })}
      <DotMatrixGroup text="FM" x={colX} y={PY + 276} dot={5.0} gap={1.8} color={lit} dim opacity={0.85} />
      <DotMatrixGroup text={freq.toFixed(2)} x={colR} y={PY + 258} dot={8.0} gap={2.7} color={lit} dim anchor="end" opacity={0.95} />

      {/* Dial */}
      {nums}
      {ticks}
      <Rect x={40} y={DY} width={CARD_W - 80} height={3.5} fill="#9FD8FF" fillOpacity={0.55} />
      {Array.from({ length: 5 }, (_, k) => {
        const x = CX + (k - 2) * 168 + 40;
        return <Circle key={`st${k}`} cx={x} cy={DY - 62} r={7} fill={palette(eq)[(k * 3) % 9]} fillOpacity={0.9} />;
      })}
      <Rect x={CX - 7} y={DY - 126} width={14} height={200} fill={NEEDLE_RED} fillOpacity={0.14} rx={7} />
      <Rect x={CX - 2.4} y={DY - 126} width={4.8} height={200} fill={NEEDLE_RED} fillOpacity={0.75} rx={2.4} />
      <Rect x={CX - 0.9} y={DY - 126} width={1.8} height={200} fill="#FFD9D4" fillOpacity={0.9} />
      <Circle cx={CX} cy={DY + 2} r={9} fill={NEEDLE_RED} />
    </>
  );
}

// ── Horizon ───────────────────────────────────────────────────────────────────
// The mode's own makeGeom, ported: horizon at 252/460 of the height, a
// GRADIENT sun (not the album cover) sliced by six widening cuts, its centre
// riding 0.42 of a radius above the line, stars in the sky and a grid
// receding to a vanishing point.
function HorizonArt({ eq, uid }: { eq: Eq; uid: string }) {
  const W = CARD_W, H = STAGE_H;
  const HZ = STAGE_TOP + Math.round(H * (252 / 460));
  // The mode caps the sun at 0.20 of the screen HEIGHT; a phone is tall and
  // this stage is wide, so that cap alone leaves a small sun in a lot of sky.
  const R = Math.round(Math.min(W * (86 / 360), H * 0.27));
  const scx = CX, scy = HZ - R * 0.42;
  const s = R / 86;
  const GEND = STAGE_BOTTOM;

  const cuts: React.ReactElement[] = [];
  for (let i = 0; i < 6; i++) {
    const y = scy + 6 * s + i * (10 + i * 1.6) * s;
    const h = (2.2 + i * 0.9) * s;
    const dy = Math.max(Math.abs(y - scy), Math.abs(y + h - scy));
    const half = Math.sqrt(Math.max(0, R * R - dy * dy));
    if (half > 2) cuts.push(<Rect key={`ct${i}`} x={scx - half} y={y} width={half * 2} height={h} fill="#05060d" fillOpacity={0.85} />);
  }

  const grid: React.ReactElement[] = [];
  for (let i = -9; i <= 9; i++) {
    grid.push(<Path key={`gv${i}`} d={`M ${scx + i * 26} ${HZ} L ${scx + i * 300} ${GEND}`}
      stroke={eq[1]} strokeOpacity={0.30} strokeWidth={2.5} />);
  }
  let gy = HZ, step = 6;
  const glines: React.ReactElement[] = [];
  while (gy < GEND) {
    glines.push(<Rect key={`gh${gy}`} x={0} y={gy} width={W} height={2.4} fill={eq[1]} fillOpacity={0.26} />);
    gy += step; step *= 1.46;
  }

  return (
    <>
      <Defs>
        <SvgLinearGradient id={`hzS${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mixHex(eq[0], '#ffffff', 0.35)} />
          <Stop offset="0.5" stopColor={eq[1]} />
          <Stop offset="1" stopColor={eq[2]} />
        </SvgLinearGradient>
        <RadialGradient id={`hzG${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.42" stopColor={glowCol(eq)} stopOpacity="0.36" />
          <Stop offset="1" stopColor={glowCol(eq)} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {Array.from({ length: 26 }, (_, k) => {
        const x = h01(k * 7.7) * W;
        const yy = STAGE_TOP + h01(k * 3.1) * Math.max(20, HZ - R - 20 - STAGE_TOP);
        return <Circle key={`sr${k}`} cx={x} cy={yy} r={0.9 + h01(k * 11.3) * 2.4} fill="#ffffff" fillOpacity={0.18 + h01(k * 5.5) * 0.4} />;
      })}

      <Circle cx={scx} cy={scy} r={R * 2.0} fill={`url(#hzG${uid})`} />
      <Circle cx={scx} cy={scy} r={R} fill={`url(#hzS${uid})`} />
      {cuts}

      <Rect x={0} y={HZ} width={W} height={4} fill={eq[0]} fillOpacity={0.75} />
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
    case 'cassette': return <CassetteArt eq={eq} uid={uid} title={title} artist={artist} />;
    case 'disco': return <MirrorBallArt eq={eq} uid={uid} />;
    case 'orb': return <OrbArt eq={eq} uid={uid} />;
    case 'radio': return <TunerArt eq={eq} uid={uid} title={title} artist={artist} freq={freq} />;
    case 'horizon': return <HorizonArt eq={eq} uid={uid} />;
    case 'equalizer':
    default: return <EqualizerArt eq={eq} uid={uid} />;
  }
}
