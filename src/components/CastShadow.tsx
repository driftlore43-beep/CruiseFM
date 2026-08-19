import { memo, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The shadow an object casts on the scene behind it.
 *
 * WHY (owner, 19.08: "add some shading behind the vinyl and cassette mode
 * like how we did to the cd mode… add depth"). The CD's disc has had one
 * since 13.08 and it is what lifts it off its case; the record and the shell
 * were floating flat on the backdrop with nothing under them.
 *
 * THREE RULES, all learned the hard way and all load-bearing here.
 *
 * (1) IT MUST BE DRAWN ON A CANVAS BIGGER THAN THE OBJECT. A shadow falls
 *     BESIDE the thing casting it, and every mode's object sits on a canvas
 *     exactly its own size — anything drawn outside gets clipped, which is
 *     measurable rather than arguable (the CD's first attempt left the
 *     luminance either side of the disc identical to a tenth of a level). So
 *     this mounts as an oversized absolutely-positioned sibling.
 *
 * (2) AND THE PARENT MUST LET IT OUT. Both decks' root Views are exactly the
 *     object's box, so each needs `overflow: 'visible'`. The symptom when it
 *     is missing is diagnostic rather than subtle: the halo comes out
 *     STRONGEST on the lit side, because the shadow's own side is the one
 *     hanging outside the box. Below the cassette's shell it measured -0.3
 *     clipped against -8.9 free.
 *
 * (3) THE CORE IS TRANSPARENT, and that is not an optimisation. Both objects
 *     are deliberately TRANSLUCENT — the record is a clear pressing and the
 *     cassette a coloured shell, and in each the blurred station scene shows
 *     through, which is most of what makes them look like objects in a place
 *     rather than pictures pasted on one. A filled shadow behind either would
 *     show straight through the thing casting it and turn it opaque. What is
 *     wanted is the part you can actually see: the halo just outside the
 *     edge, thickest where the light is not.
 *
 * Gradient falloff throughout, never a hard-edged dark shape — a solid offset
 * disc peeping out from behind reads as a second disc, the rule the mirror
 * ball's rim and the share cards' fades both settled on. There is no blur
 * filter available to us, so the rectangle's softness is built from stacked
 * strokes instead: many thin rounded outlines, each a little larger and a
 * little fainter than the last.
 */

/** Light comes from the upper left everywhere in this app (the mirror ball's
 *  key light, the CD's cast shadow, the cassette's bevels), so every shadow
 *  falls down and to the right. Fractions of the object's own size, so one
 *  set of numbers serves every screen. */
const DX = 0.022;
const DY = 0.034;
/** How far the halo reaches past the object's edge. */
const SPREAD = 0.1;
/** Darkest point of the halo, sitting right against the edge. */
const PEAK = 0.55;
/** Stacked outlines in the rectangle's halo. Enough that the steps are not
 *  countable; each is one cheap static path, drawn once and never animated. */
const RINGS = 14;

let instances = 0;

export const CastShadow = memo(function CastShadow({
  width, height, radius, x = 0, y = 0, spread = SPREAD, peak = PEAK,
}: {
  /** The visible object's box, in pixels. */
  width: number;
  height: number;
  /** Corner radius. Pass half the width for a disc. */
  radius: number;
  /** Where the object's box sits inside its parent. The cassette's shell is
   *  inset from its own canvas, so its shadow must be too. */
  x?: number;
  y?: number;
  /** Reach past the edge, as a fraction of the larger side. */
  spread?: number;
  /** Opacity right against the edge. */
  peak?: number;
}) {
  // Gradient ids must be unique across every <Svg> on screen — duplicates are
  // a known way to get one of them rendering blank (the share cards' lesson).
  // Only the record uses the gradient today, but a second round object would
  // otherwise collide silently.
  const uid = useRef(`csd${++instances}`).current;
  const size = Math.max(width, height);
  const pad = size * spread;
  const dx = size * DX;
  const dy = size * DY;
  // The canvas is the object plus its reach in every direction, then shifted
  // so the object still sits where it did.
  const w = width + pad * 2;
  const h = height + pad * 2;
  const round = radius >= Math.min(width, height) / 2 - 0.5;

  // Where the object's own edge falls, as a percentage of the gradient's
  // radius. GET THIS WRONG BY A FACTOR OF TWO — `(width / w) * 50`, which
  // reads plausibly — and the halo peaks half way INSIDE the record and
  // darkens its whole outer half, which is the very thing rule (3) is about.
  // The gradient's radius is w / 2, so the edge sits at (width / 2) / (w / 2).
  const edge = (width / w) * 100;
  const tail = edge + (100 - edge) * 0.45;

  const rings = useMemo(() => {
    if (round) return [];
    const step = pad / RINGS;
    // Each outline is drawn wider than the gap to the next, so the steps blend
    // instead of banding — which means about OVERLAP of them stack at any one
    // distance, and each must therefore be fainter than the darkness wanted
    // there. Compositing n layers of alpha a gives 1-(1-a)^n, so invert it.
    // Getting this wrong is not a matter of taste: the first cut divided by a
    // guessed number and the cassette's halo measured a tenth of the record's.
    const OVERLAP = 2.1;
    return Array.from({ length: RINGS }, (_, i) => {
      // t: 0 hard against the object's edge, 1 at the far end of the reach.
      const t = i / (RINGS - 1);
      const out = pad * t;
      // Squared falloff: dense against the edge, a long thin tail. Linear
      // reads as a flat grey band with a visible outer boundary.
      const want = peak * Math.pow(1 - t, 2);
      return {
        x: pad - out, y: pad - out,
        w: width + out * 2, h: height + out * 2,
        r: radius + out,
        o: 1 - Math.pow(1 - want, 1 / OVERLAP),
        sw: step * OVERLAP,
      };
    });
  }, [round, pad, width, height, radius, peak]);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - pad + dx, top: y - pad + dy, width: w, height: h }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {round ? (
          <>
            <Defs>
              <RadialGradient id={`${uid}Halo`} cx="50%" cy="50%" r="50%">
                {/* Transparent out to the object's own edge — see rule (3) —
                    then the halo, then nothing. */}
                <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <Stop offset={`${edge - 3}%`} stopColor="#000000" stopOpacity="0" />
                <Stop offset={`${edge}%`} stopColor="#000000" stopOpacity={`${peak}`} />
                <Stop offset={`${tail}%`} stopColor="#000000" stopOpacity={`${peak * 0.28}`} />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${uid}Halo)`} />
          </>
        ) : rings.map((g, i) => (
          <Rect
            key={i}
            x={g.x} y={g.y} width={g.w} height={g.h} rx={g.r}
            fill="none" stroke="#000000" strokeOpacity={g.o} strokeWidth={g.sw}
          />
        ))}
      </Svg>
    </View>
  );
});
