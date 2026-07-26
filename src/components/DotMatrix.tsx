import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

/**
 * A 5×7 dot-matrix display, drawn as real dots.
 *
 * Both of the owner's tuner references are dot-matrix LCDs — a car head unit
 * and an FM receiver — and the thing that makes them read as hardware is that
 * you can see the UNLIT dots as well as the lit ones. A monospace font can't
 * do that at any size. This draws the actual grid, which also means no font
 * file to load and nothing new in the build: it ships over the air like
 * everything else.
 *
 * Anything not in the table renders as a space, so an unexpected character in
 * a song title can never crash a drive.
 */

const G: Record<string, string> = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'].join(''),
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'].join(''),
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'].join(''),
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'].join(''),
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'].join(''),
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'].join(''),
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'].join(''),
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'].join(''),
  'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'].join(''),
  'J': ['....#', '....#', '....#', '....#', '....#', '#...#', '.###.'].join(''),
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'].join(''),
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'].join(''),
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'].join(''),
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'].join(''),
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'].join(''),
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'].join(''),
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'].join(''),
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'].join(''),
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'].join(''),
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'].join(''),
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'].join(''),
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'].join(''),
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'].join(''),
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'].join(''),
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'].join(''),
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'].join(''),
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'].join(''),
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'].join(''),
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'].join(''),
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'].join(''),
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'].join(''),
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'].join(''),
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'].join(''),
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'].join(''),
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'].join(''),
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'].join(''),
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'].join(''),
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'].join(''),
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'].join(''),
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'].join(''),
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'].join(''),
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'].join(''),
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'].join(''),
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'].join(''),
  '&': ['.##..', '#..#.', '#..#.', '.##..', '#.#.#', '#..#.', '.##.#'].join(''),
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'].join(''),
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'].join(''),
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'].join(''),
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'].join(''),
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'].join(''),
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'].join(''),
};

// Every glyph must be exactly 5×7 = 35 cells. Anything malformed above would
// silently smear across rows, so it's normalised once at module load.
const GLYPHS: Record<string, string> = Object.fromEntries(
  Object.entries(G).map(([k, v]) => [k, (v + '.'.repeat(35)).slice(0, 35)]),
);

export const DM_COLS = 5;
export const DM_ROWS = 7;

/** Pixel advance from one character's left edge to the next. */
export function dmAdvance(dot: number, gap: number): number {
  return (DM_COLS + 1) * (dot + gap);
}

/** Total width a string will occupy. */
export function dmWidth(text: string, dot: number, gap: number): number {
  if (!text.length) return 0;
  const unit = dot + gap;
  return (text.length - 1) * dmAdvance(dot, gap) + DM_COLS * unit - gap;
}

export function dmHeight(dot: number, gap: number): number {
  return DM_ROWS * (dot + gap) - gap;
}

/** How many characters fit in `width`. Real head units simply cut the title
 *  off — the owner's own reference photo reads "MIDNIGHT MEMO / ONE DIRE" —
 *  so callers truncate rather than shrink. */
export function dmFit(width: number, dot: number, gap: number): number {
  return Math.max(0, Math.floor((width + gap) / dmAdvance(dot, gap)));
}

/**
 * One line of dot-matrix text as its own <Svg>, so it can sit in a normal
 * flex layout. `dim` draws the unlit dots too — that's the detail that makes
 * it look like a physical display rather than a stylised font.
 */
export const DotMatrixText = React.memo(function DotMatrixText({
  text, dot = 2.4, gap = 0.9, color = '#7FC7FF', dim = true, dimOpacity = 0.09, opacity = 1,
}: {
  text: string;
  dot?: number;
  gap?: number;
  color?: string;
  dim?: boolean;
  dimOpacity?: number;
  opacity?: number;
}) {
  const chars = useMemo(() => text.toUpperCase().split(''), [text]);
  const unit = dot + gap;
  const adv = dmAdvance(dot, gap);
  const w = Math.max(1, dmWidth(text, dot, gap));
  const h = dmHeight(dot, gap);

  const cells = useMemo(() => {
    const out: { x: number; y: number; on: boolean }[] = [];
    chars.forEach((ch, i) => {
      const g = GLYPHS[ch] ?? GLYPHS[' '];
      for (let r = 0; r < DM_ROWS; r++) {
        for (let c = 0; c < DM_COLS; c++) {
          const on = g[r * DM_COLS + c] === '#';
          if (!on && !dim) continue;
          out.push({ x: i * adv + c * unit, y: r * unit, on });
        }
      }
    });
    return out;
  }, [chars, adv, unit, dim]);

  return (
    <Svg width={w} height={h} opacity={opacity}>
      {cells.map((c, i) => (
        <Rect
          key={i}
          x={c.x} y={c.y} width={dot} height={dot} rx={dot * 0.22}
          fill={color}
          fillOpacity={c.on ? 1 : dimOpacity}
        />
      ))}
    </Svg>
  );
});
