import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle, Defs, G, Line, LinearGradient as SvgLinearGradient, Path,
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

      // ── Sliced retrowave sun over a receding grid ───────────────────────
      case 'horizon': {
        const c = S / 2, R = S * 0.26, sunY = S * 0.40;
        const slices = 7;
        return (
          <>
            <Defs>
              <SvgLinearGradient id={id('sun')} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffd979" />
                <Stop offset="1" stopColor={colors[2]} />
              </SvgLinearGradient>
            </Defs>
            {/* Drawn as bands clipped to the circle's width at each height —
                cheaper than a real mask and reads identically at this size. */}
            {Array.from({ length: slices }).map((_, i) => {
              const t0 = i / slices, t1 = (i + 0.72) / slices;
              const y0 = sunY - R + 2 * R * t0;
              const yh = 2 * R * (t1 - t0);
              const half = Math.sqrt(Math.max(0, 1 - Math.pow((y0 + yh / 2 - sunY) / R, 2))) * R;
              return <Rect key={i} x={c - half} y={y0} width={half * 2} height={yh} fill={`url(#${id('sun')})`} />;
            })}
            {Array.from({ length: 6 }).map((_, i) => {
              const y = S * 0.66 + Math.pow(i / 5, 1.7) * S * 0.32;
              return <Rect key={`h${i}`} x={0} y={y} width={S} height={Math.max(0.5, S * 0.006)}
                fill="rgba(255,255,255,0.26)" />;
            })}
            {Array.from({ length: 7 }).map((_, i) => {
              const spread = (i - 3) / 3;
              return <Line key={`v${i}`} x1={c + spread * S * 0.12} y1={S * 0.66}
                x2={c + spread * S * 0.95} y2={S} stroke="rgba(255,255,255,0.20)"
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

      // ── The ball: the mode's own sphere projection, held still ──────────
      case 'disco': {
        const c = S / 2, R = S * 0.42;
        // Facet count follows the size. At row size a dozen rows is plenty and
        // more would just be mush; at hero size the same dozen reads as a
        // stack of chunky bands rather than a mirror ball, which is exactly
        // how the first hero render came out.
        const ROWS = Math.max(9, Math.min(23, Math.round(S / 11)));
        const COLS = Math.round(ROWS * 1.75);
        const tiles: React.ReactNode[] = [];
        for (let r = 0; r < ROWS; r++) {
          const b0 = -Math.PI / 2 + (Math.PI * r) / ROWS;
          const b1 = -Math.PI / 2 + (Math.PI * (r + 1)) / ROWS;
          const yTop = c - R * Math.sin(b1);
          const yBot = c - R * Math.sin(b0);
          const bm = (b0 + b1) / 2;
          const rr = R * Math.cos(bm);
          for (let k = 0; k < COLS; k++) {
            // Brick bond on alternate rows — how a real ball is built, and
            // what stops the columns stacking into hard vertical lines.
            const lam = ((k + (r % 2) * 0.5) / COLS) * Math.PI * 2 - Math.PI;
            const face = Math.cos(lam);
            if (face <= 0.05) continue;              // back-face cull
            const x = c + rr * Math.sin(lam);
            const w = Math.max(0.5, (rr * 2 * Math.PI / COLS) * face);
            const nx = Math.cos(bm) * Math.sin(lam);
            const ny = Math.sin(bm);
            const nz = Math.cos(bm) * face;
            const lambert = Math.max(0, -nx * 0.45 + ny * 0.5 + nz * 0.74);
            // Hard per-tile scatter is what makes it read as mirrors rather
            // than as a shaded ball — see the Mirror Ball notes in AGENTS.md.
            const jit = hash01(r * 7.3 + k * 3.1);
            const l = Math.min(1, 0.10 + lambert * 0.52 + jit * lambert * 0.58 + jit * 0.08);
            const g = Math.round(232 * l);
            tiles.push(
              <Rect key={`${r}-${k}`} x={x - w / 2} y={yTop} width={w}
                height={Math.max(0.6, (yBot - yTop) * 0.86)}
                fill={`rgb(${Math.round(222 * l)},${g},${Math.round(244 * l)})`} />,
            );
          }
        }
        return (
          <>
            <Defs>
              <RadialGradient id={id('ball')} cx="34%" cy="28%" r="76%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
                <Stop offset="0.55" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.62" />
              </RadialGradient>
            </Defs>
            <Circle cx={c} cy={c} r={R} fill="#0b0b0c" />
            {tiles}
            <Circle cx={c} cy={c} r={R} fill={`url(#${id('ball')})`} />
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
