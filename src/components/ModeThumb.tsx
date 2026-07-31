import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient as SvgLinearGradient, Path,
  RadialGradient, Rect, Stop,
} from 'react-native-svg';

/**
 * A small still portrait of what a mode actually looks like.
 *
 * WHY THIS EXISTS (owner, 29.07): the Modes page used to describe each mode
 * with a coloured slab and a sentence, which meant a new user had no idea
 * what "Horizon" or "Circular EQ" were until they opened them. The modes are
 * the part of Cruise FM nobody else has — showing them is worth more than
 * any amount of card styling, and it is the one thing Apple Music does that
 * this app was not: let the artwork be the interface.
 *
 * Rules for anything added here:
 *  - STATIC. These render at row size, eight at a time, on a scrolling page.
 *    Nothing animates; a still frame is what a thumbnail is.
 *  - Everything scales off `size`, so one component serves both the 62pt row
 *    thumbnails and the ~250pt hero.
 *  - Gradient ids are namespaced per instance via `uid`. Two Svg roots
 *    sharing an id is a known way to make one of them render blank.
 */

export type ModeThumbId =
  | 'equalizer' | 'orb' | 'cassette' | 'vinyl' | 'radio' | 'horizon' | 'cd' | 'disco';

type Props = {
  mode: ModeThumbId;
  size: number;
  /** Three stops, dark→light, usually the mode's own card gradient. */
  colors: [string, string, string];
  /** Unique per mounted instance — see the id note above. */
  uid: string;
};

// Deterministic 0..1 from a number — the same helper the Mirror Ball uses, so
// the scatter here has the same character as the scatter there.
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const ModeThumb = memo(function ModeThumb({ mode, size, colors, uid }: Props) {
  const S = size;
  const id = (name: string) => `mt${uid}${name}`;

  const body = () => {
    switch (mode) {
      // ── Segmented LED meter ─────────────────────────────────────────────
      case 'equalizer': {
        const N = 9;
        const heights = [0.34, 0.62, 0.44, 0.86, 0.68, 0.96, 0.52, 0.78, 0.40];
        const gap = S * 0.018;
        const bw = (S * 0.82 - gap * (N - 1)) / N;
        const seg = S * 0.055;          // lamp pitch
        const lamp = seg * 0.68;
        const x0 = S * 0.09;
        const base = S * 0.86;
        const out: React.ReactNode[] = [];
        for (let i = 0; i < N; i++) {
          const lamps = Math.max(1, Math.round((heights[i] * S * 0.66) / seg));
          for (let k = 0; k < lamps; k++) {
            const t = k / Math.max(1, lamps - 1);
            out.push(
              <Rect
                key={`${i}-${k}`}
                x={x0 + i * (bw + gap)}
                y={base - (k + 1) * seg}
                width={bw}
                height={lamp}
                rx={lamp * 0.25}
                fill={t < 0.4 ? colors[0] : t < 0.75 ? colors[1] : colors[2]}
                opacity={0.55 + t * 0.45}
              />,
            );
          }
          // The white peak cap that rides the top of each bar in the mode.
          out.push(
            <Rect key={`c${i}`} x={x0 + i * (bw + gap)} y={base - (lamps + 1) * seg}
              width={bw} height={lamp * 0.5} rx={1} fill="#fff" opacity={0.9} />,
          );
        }
        return <>{out}</>;
      }

      // ── Concentric rings around a glowing core ──────────────────────────
      case 'orb': {
        const c = S / 2;
        return (
          <>
            <Defs>
              <RadialGradient id={id('core')} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                <Stop offset="0.35" stopColor={colors[2]} stopOpacity="0.95" />
                <Stop offset="1" stopColor={colors[2]} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {[0.20, 0.29, 0.38, 0.46].map((r, i) => (
              <Circle key={i} cx={c} cy={c} r={S * r} stroke={colors[1]}
                strokeWidth={Math.max(0.6, S * 0.008)} fill="none" opacity={0.5 - i * 0.09} />
            ))}
            <Circle cx={c} cy={c} r={S * 0.20} fill={`url(#${id('core')})`} />
          </>
        );
      }

      // ── Cassette shell, two reels, the tape run ─────────────────────────
      case 'cassette': {
        const w = S * 0.80, h = S * 0.50;
        const x = (S - w) / 2, y = (S - h) / 2;
        const rr = h * 0.30, cy = y + h * 0.5;
        return (
          <>
            <Rect x={x} y={y} width={w} height={h} rx={S * 0.045} fill={colors[1]}
              stroke="rgba(255,255,255,0.32)" strokeWidth={Math.max(0.6, S * 0.008)} />
            <Rect x={x + w * 0.30} y={cy - S * 0.008} width={w * 0.40} height={S * 0.016}
              fill="rgba(255,255,255,0.30)" />
            {[x + w * 0.27, x + w * 0.73].map((cx, i) => (
              <G key={i}>
                <Circle cx={cx} cy={cy} r={rr} fill="#150c26"
                  stroke="rgba(255,255,255,0.55)" strokeWidth={Math.max(0.8, S * 0.011)} />
                <Circle cx={cx} cy={cy} r={rr * 0.34} fill="rgba(255,255,255,0.45)" />
              </G>
            ))}
          </>
        );
      }

      // ── Record on the deck, tonearm across it ───────────────────────────
      case 'vinyl': {
        const c = S / 2, R = S * 0.40;
        return (
          <>
            <Circle cx={c} cy={c} r={R} fill="#121214" />
            {[0.86, 0.74, 0.62, 0.50].map((f, i) => (
              <Circle key={i} cx={c} cy={c} r={R * f} stroke="rgba(255,255,255,0.10)"
                strokeWidth={Math.max(0.4, S * 0.005)} fill="none" />
            ))}
            <Circle cx={c} cy={c} r={R * 0.34} fill={colors[2]} />
            <Circle cx={c} cy={c} r={Math.max(1, S * 0.014)} fill="#000" />
            {/* The silver J arm, hinged off the top right */}
            <Line x1={S * 0.94} y1={S * 0.10} x2={S * 0.60} y2={S * 0.66}
              stroke="#cbcfd8" strokeWidth={Math.max(1, S * 0.020)} strokeLinecap="round" />
            <Circle cx={S * 0.94} cy={S * 0.10} r={S * 0.045} fill="#9aa0ac" />
          </>
        );
      }

      // ── Head-unit dial with the fixed red needle ────────────────────────
      case 'radio': {
        const bandY = S * 0.42, bandH = S * 0.24;
        return (
          <>
            <Defs>
              <SvgLinearGradient id={id('band')} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors[0]} />
                <Stop offset="1" stopColor={colors[2]} />
              </SvgLinearGradient>
            </Defs>
            <Rect x={S * 0.07} y={bandY} width={S * 0.86} height={bandH} rx={S * 0.02}
              fill={`url(#${id('band')})`} opacity={0.9} />
            {Array.from({ length: 17 }).map((_, i) => {
              const x = S * 0.07 + (S * 0.86 * i) / 16;
              const tall = i % 4 === 0;
              return (
                <Rect key={i} x={x} y={S * 0.24} width={Math.max(0.6, S * 0.008)}
                  height={tall ? S * 0.13 : S * 0.075} fill="rgba(255,255,255,0.45)" />
              );
            })}
            <Rect x={S * 0.56} y={S * 0.20} width={Math.max(1.2, S * 0.026)} height={S * 0.58}
              rx={1} fill="#FF3B30" />
          </>
        );
      }

      // ── Retrowave sun over a receding grid ──────────────────────────────
      case 'horizon': {
        const c = S / 2, R = S * 0.26, sunY = S * 0.38;
        // The sun is drawn WHOLE, then a few thin dark cuts are laid over its
        // lower half — clipped to the disc's chord width at each height. The
        // first version built the disc OUT of separate bands with wide gaps,
        // and at row size the circle came out shredded (owner, 30.07): the
        // silhouette must be one unbroken shape, the slats just a texture on
        // it.
        const cuts = [0.18, 0.42, 0.64, 0.84];
        return (
          <>
            <Defs>
              <SvgLinearGradient id={id('sun')} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffd979" />
                <Stop offset="1" stopColor={colors[2]} />
              </SvgLinearGradient>
            </Defs>
            <Circle cx={c} cy={sunY} r={R} fill={`url(#${id('sun')})`} />
            {cuts.map((f, i) => {
              const y = sunY + R * f;                       // lower half only
              const h = Math.max(0.8, S * (0.010 + i * 0.004)); // thicker downward
              const half = Math.sqrt(Math.max(0, 1 - Math.pow((y - sunY) / R, 2))) * R;
              return <Rect key={i} x={c - half - 0.5} y={y - h / 2} width={half * 2 + 1} height={h} fill="#07070c" />;
            })}
            {Array.from({ length: 6 }).map((_, i) => {
              const y = S * 0.68 + Math.pow(i / 5, 1.7) * S * 0.30;
              return <Rect key={`h${i}`} x={0} y={y} width={S} height={Math.max(0.5, S * 0.006)}
                fill="rgba(255,255,255,0.26)" />;
            })}
            {/* Verticals converge AT the horizon line, like real perspective —
                not at a point floating below the sun. */}
            {Array.from({ length: 7 }).map((_, i) => {
              const spread = (i - 3) / 3;
              return <Line key={`v${i}`} x1={c + spread * S * 0.06} y1={S * 0.68}
                x2={c + spread * S * 0.85} y2={S} stroke="rgba(255,255,255,0.18)"
                strokeWidth={Math.max(0.5, S * 0.006)} />;
            })}
          </>
        );
      }

      // ── Mirrored disc under jewel-case plastic ──────────────────────────
      case 'cd': {
        const c = S / 2, R = S * 0.40;
        // The diffraction fan: overlapping wedges, heavily overlapped so it
        // reads as a sheen rather than as spokes — the same rule as the mode.
        const HUES = ['#7fd6ff', '#a9b6ff', '#c9a6ff', '#ffc7a6', '#ffe9a6', '#a6ffd0'];
        return (
          <>
            <Circle cx={c} cy={c} r={R} fill="#0e0f16" />
            {Array.from({ length: 24 }).map((_, i) => {
              const a0 = (i / 24) * Math.PI * 2, a1 = a0 + Math.PI / 5;
              const p = `M ${c} ${c} L ${c + R * Math.cos(a0)} ${c + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${c + R * Math.cos(a1)} ${c + R * Math.sin(a1)} Z`;
              return <Path key={i} d={p} fill={HUES[i % HUES.length]} opacity={0.16} />;
            })}
            <Circle cx={c} cy={c} r={R * 0.34} fill="#0b0c12" opacity={0.85} />
            <Circle cx={c} cy={c} r={R * 0.34} stroke="rgba(255,255,255,0.28)"
              strokeWidth={Math.max(0.5, S * 0.006)} fill="none" />
            <Circle cx={c} cy={c} r={R * 0.15} fill="#05050a" />
            <Circle cx={c} cy={c} r={R} stroke="rgba(255,255,255,0.34)"
              strokeWidth={Math.max(0.6, S * 0.008)} fill="none" />
          </>
        );
      }

      // ── The ball, drawn the way the paywall showcase draws it ───────────
      // A UNIFORM grid of square mirrors clipped to a circle, alternate rows
      // offset by half a tile (how a real ball is built), a soft light band,
      // a top-left catch and a thick dark inner rim for roundness. The owner
      // compared this against the previous sphere-projection thumbnail and
      // preferred the paywall's version outright (30.07) — the projection's
      // pinched pole tiles read as noise at row size, where flat squares
      // read as mirrors.
      case 'disco': {
        // A REAL SPHERE, not a warped square grid.
        //
        // The previous thumbnail was a square lattice squeezed toward the
        // edges, and it read flat however it was shaded (owner, 31.07: "this
        // 2D mirror ball is not cooperating") — because every row was a
        // dead-straight horizontal line and every column a dead-straight
        // vertical one, and no sphere has those. Curvature has to be in the
        // GRID, not just the lighting.
        //
        // So each mirror is a genuine latitude/longitude quad on a unit
        // sphere, tilted ~17° so we look slightly down at it: latitude rows
        // then project to arcs that dip toward the viewer, columns converge
        // toward the poles, and back-facing tiles are dropped. That is the
        // same construction the full mode uses; the mode keeps its tilt near
        // zero because it is turning and has lighting to sell it, but a still
        // picture needs the tilt to say "ball" on sight.
        const c = S / 2, R = S * 0.42;
        // NEGATIVE = looking UP at the ball, which is how you actually meet
        // one — it hangs above you (owner, 31.07). Latitude rows then bow
        // UPWARD across the front and the columns converge at the BOTTOM
        // pole, since that is the end now facing us.
        const TILT = -0.30;                      // radians; negative = looking up
        const ct = Math.cos(TILT), stt = Math.sin(TILT);
        const big = S >= 120;
        const ROWS = big ? 13 : 8;               // latitude bands
        const COLS = big ? 24 : 14;              // mirrors around the equator
        const LAT_MAX = 1.38;                    // stop short of the poles
        const INSET = 0.90;                      // quad shrink = the seam
        // Light up, left and slightly toward us.
        const LX = -0.44, LY = 0.50, LZ = 0.75;
        const LN = Math.hypot(LX, LY, LZ);

        // Sphere point -> screen, plus the depth that decides visibility.
        const pt = (lat: number, lon: number) => {
          const cb = Math.cos(lat), sb = Math.sin(lat);
          const x = cb * Math.sin(lon), y = sb, z = cb * Math.cos(lon);
          const yr = y * ct - z * stt;
          const zr = y * stt + z * ct;
          return { x: c + R * x, y: c - R * yr, z: zr, nx: x, ny: yr, nz: zr };
        };

        const facets: React.ReactNode[] = [];
        for (let r = 0; r < ROWS; r++) {
          const b0 = -LAT_MAX + (2 * LAT_MAX * r) / ROWS;
          const b1 = -LAT_MAX + (2 * LAT_MAX * (r + 1)) / ROWS;
          const bm = (b0 + b1) / 2;
          const bond = (r % 2) * 0.5;            // brick bond, as a real ball is built
          for (let k = 0; k < COLS; k++) {
            const l0 = ((k + bond) / COLS) * Math.PI * 2 - Math.PI;
            const l1 = ((k + bond + 1) / COLS) * Math.PI * 2 - Math.PI;
            const lm = (l0 + l1) / 2;
            const mid = pt(bm, lm);
            if (mid.z <= 0.06) continue;         // back face / silhouette sliver
            // Shrink each quad toward its own centre so the dark body shows
            // between mirrors — the gap IS the grid.
            const sb0 = bm + (b0 - bm) * INSET, sb1 = bm + (b1 - bm) * INSET;
            const sl0 = lm + (l0 - lm) * INSET, sl1 = lm + (l1 - lm) * INSET;
            const q = [pt(sb0, sl0), pt(sb0, sl1), pt(sb1, sl1), pt(sb1, sl0)];
            const d = `M ${q[0].x.toFixed(2)} ${q[0].y.toFixed(2)}`
              + q.slice(1).map((v) => ` L ${v.x.toFixed(2)} ${v.y.toFixed(2)}`).join('')
              + ' Z';
            // Lambert off the tile's own normal — a real lit side, terminator
            // and shadow side, instead of a symmetric vignette.
            const lam = Math.max(0, (mid.nx * LX + mid.ny * LY + mid.nz * LZ) / LN);
            // Mirrors reflect different parts of the room, so the scatter is
            // pushed toward the ENDS of its range: a bright tile beside a dead
            // one is what reads as chrome.
            const roll = hash01(r * 12.9898 + k * 78.233) * 2 - 1;
            const scatter = Math.sign(roll) * Math.pow(Math.abs(roll), 0.62) * 0.26;
            const a = Math.max(0.03, Math.min(0.99, 0.06 + Math.pow(lam, 0.8) * 0.88 + scatter));
            facets.push(
              <Path key={`${r}-${k}`} d={d} fill={`rgba(228,238,255,${a.toFixed(3)})`} />,
            );
            facets.push(
              <Path key={`g${r}-${k}`} d={d} fill={`url(#${id('facet')})`} opacity={0.34} />,
            );
          }
        }

        return (
          <>
            <Defs>
              <ClipPath id={id('clip')}>
                <Circle cx={c} cy={c} r={R} />
              </ClipPath>
              {/* One gradient for every facet — SVG gradients are in bounding
                  box units, so a single def rescales to each quad. */}
              <SvgLinearGradient id={id('facet')} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
                <Stop offset="1" stopColor="#05060d" stopOpacity="0.4" />
              </SvgLinearGradient>
              {/* Shadow crowding the lower-right limb, opposite the key light
                  — the other half of the roundness. */}
              <RadialGradient id={id('rim')} cx="34%" cy="28%" r="80%">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="0.6" stopColor="#02030a" stopOpacity="0.14" />
                <Stop offset="1" stopColor="#02030a" stopOpacity="0.66" />
              </RadialGradient>
              <RadialGradient id={id('catch')} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <G clipPath={`url(#${id('clip')})`}>
              <Circle cx={c} cy={c} r={R} fill="#090a11" />
              {facets}
              <Circle cx={c} cy={c} r={R} fill={`url(#${id('rim')})`} />
              {/* Key highlight, sitting where the light actually is. */}
              <Circle cx={c + LX * R * 0.72} cy={c - LY * R * 0.72} r={R * 0.5} fill={`url(#${id('catch')})`} />
            </G>
            {/* The bottom fitting, drawn as a squashed ellipse because we are
                looking up at it. It also covers the one place this projection
                looks busy — the pole where the columns converge, which flipped
                to the bottom with the tilt. Inside the clip, so the part past
                the silhouette is trimmed. */}
            <G clipPath={`url(#${id('clip')})`}>
              <Ellipse cx={c} cy={c + R * 0.93} rx={R * 0.17} ry={R * 0.075} fill="#141824" />
            </G>
            {/* The stem runs to the ball's outline and stops: looking up, the
                top fitting is on the FAR side, hidden behind the sphere. */}
            <Rect x={c - Math.max(0.8, S * 0.010)} y={c - R - S * 0.10}
              width={Math.max(1.6, S * 0.020)} height={S * 0.105} fill="rgba(190,200,222,0.55)" />
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    // The backdrop is the wrapper's own background, NOT a child View. An
    // absolutely-positioned sibling paints ABOVE a statically-positioned one,
    // so a fill layer underneath the Svg covers it completely — which is
    // exactly what happened the first time this rendered.
    <View style={[st.wrap, { width: S, height: S }]}>
      <Svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>{body()}</Svg>
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#07070c' },
});
