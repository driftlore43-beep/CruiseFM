import { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * A tiny mirror ball, drawn rather than picked from an icon font.
 *
 * MaterialCommunityIcons has no disco/mirror-ball glyph (`mirror-variant` was
 * the nearest stand-in, and it reads as a mirror, not a ball), so the mode's
 * icon is the real thing in miniature: the same sphere projection as
 * DiscoBallMode — latitude/longitude quads, back-face culled, shaded from an
 * upper-left key light — just at a much coarser grid so it still reads at
 * 17px in the mini-player.
 *
 * Deliberately static: this appears in scrolling lists, so there is no
 * animation and the geometry is memoized per size.
 */

// Same viewing tilt as the full-size ball, so the icon and the mode agree.
const TILT = 0.3;
const ROWS = 7;
const COLS = 12;

type Facet = { d: string; fill: string; op: number };

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildFacets(size: number, r: number, cx: number, cy: number): Facet[] {
  const st = Math.sin(TILT), ct = Math.cos(TILT);
  const ln = Math.hypot(-0.42, 0.58, 0.7);
  const lx = -0.42 / ln, ly = 0.58 / ln, lz = 0.7 / ln;

  const project = (beta: number, lam: number) => {
    const cb = Math.cos(beta);
    const x0 = cb * Math.sin(lam), y0 = Math.sin(beta), z0 = cb * Math.cos(lam);
    const y1 = y0 * ct - z0 * st, z1 = y0 * st + z0 * ct;
    return { x: cx + r * x0, y: cy - r * y1, z: z1, nx: x0, ny: y1, nz: z1 };
  };

  const out: Facet[] = [];
  for (let j = 0; j < ROWS; j++) {
    const b0 = -Math.PI / 2 + (Math.PI * j) / ROWS;
    const b1 = -Math.PI / 2 + (Math.PI * (j + 1)) / ROWS;
    for (let k = 0; k < COLS; k++) {
      const l0 = (2 * Math.PI * k) / COLS;
      const l1 = (2 * Math.PI * (k + 1)) / COLS;
      const p00 = project(b0, l0), p01 = project(b0, l1);
      const p11 = project(b1, l1), p10 = project(b1, l0);
      if (p00.z <= 0.04 || p01.z <= 0.04 || p11.z <= 0.04 || p10.z <= 0.04) continue;

      // Shrink each quad slightly toward its own centre — the gap between
      // tiles IS the grid at this size, which is far crisper than hairline
      // strokes that vanish below 1px.
      const mx = (p00.x + p01.x + p11.x + p10.x) / 4;
      const my = (p00.y + p01.y + p11.y + p10.y) / 4;
      const s = 0.82;
      const pt = (p: { x: number; y: number }) =>
        `${(mx + (p.x - mx) * s).toFixed(2)} ${(my + (p.y - my) * s).toFixed(2)}`;

      // Plain white, like every other icon in the app — the tiles differ only
      // in how solid they are, never in hue. A silver/blue-tinted version read
      // as a coloured illustration sitting among flat white glyphs.
      const c = project((b0 + b1) / 2, (l0 + l1) / 2);
      const lambert = Math.max(0, c.nx * lx + c.ny * ly + c.nz * lz);
      const jitter = (hash01(j * 13.7 + k * 4.3) - 0.5) * 0.3;
      const t = Math.max(0, Math.min(1, lambert * 0.9 + 0.12 + jitter));
      out.push({
        d: `M ${pt(p00)} L ${pt(p01)} L ${pt(p11)} L ${pt(p10)} Z`,
        fill: '#ffffff',
        op: (0.34 + 0.66 * t) * (0.5 + 0.5 * Math.min(1, c.nz * 1.5)),
      });
    }
  }
  return out;
}

export function MirrorBallGlyph({ size = 22, hanger = true, color = '#ffffff' }: {
  size?: number;
  hanger?: boolean;
  /** Still monochrome — this only exists so the glyph can go DARK on a
   *  white surface (the active Change-Mode chip); it stays white everywhere
   *  else, per the plain-white rule above. */
  color?: string;
}) {
  // Leave headroom for the little hanging stem so the ball itself stays round
  // inside a square icon slot.
  const r = size * (hanger ? 0.42 : 0.48);
  const cx = size / 2;
  const cy = size * (hanger ? 0.56 : 0.5);
  const facets = useMemo(() => buildFacets(size, r, cx, cy), [size, r, cx, cy]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {hanger && (
        <>
          <Path
            d={`M ${cx} ${cy - r} L ${cx} ${size * 0.09}`}
            stroke={color} strokeOpacity={0.55} strokeWidth={Math.max(0.7, size * 0.045)}
          />
          <Circle cx={cx} cy={size * 0.075} r={Math.max(0.9, size * 0.055)} fill={color} fillOpacity={0.6} />
        </>
      )}

      {/* No body gradient and no specular: the tiles alone carry the shape.
          Anything darker underneath turned this into a picture of a ball
          rather than an icon of one. */}
      {facets.map((f, i) => (
        <Path key={i} d={f.d} fill={color} fillOpacity={f.op} />
      ))}
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={Math.max(0.5, size * 0.035)} />
    </Svg>
  );
}
