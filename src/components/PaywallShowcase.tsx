import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Live looping preview of premium modes for the paywall.
 * Pure View miniatures driven by one rAF clock (the same pattern the real
 * modes use — RN Animated stalls on web) — no audio, no station wiring, so
 * the paywall shows motion the instant it opens. Cycles Vinyl → Tuner →
 * Mirror Ball → Horizon with a crossfade.
 *
 * Circular EQ used to be the fourth scene; it became FREE on 25.07, so
 * showing it here was advertising something the viewer already has. Anything
 * on this stage must be `pro: true` in MODE_CATALOG.
 */

const AMBER = '#F59E0B';
const SCENE_S = 4.2; // seconds each mode is on stage
const FADE_S = 0.45; // crossfade at scene edges
const LOOP_S = 3.6; // one motion cycle within a scene

// All FIVE premium modes — the feature list under this stage says "5 Premium
// Visual Modes", and a showcase that previews four of them reads as a missing
// one, which the owner spotted immediately (30.07). Keep this list and that
// copy in step.
const SCENES = [
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'radio', label: 'Tuner' },
  { id: 'disco', label: 'Mirror Ball' },
  { id: 'horizon', label: 'Horizon' },
  { id: 'cd', label: 'CD' },
] as const;

/** -cos wave mapped to [lo, hi]: starts at lo, peaks mid-cycle, seamless loop. */
function wave(clock: number, lo: number, hi: number) {
  return lo + (hi - lo) * (0.5 - 0.5 * Math.cos(clock * Math.PI * 2));
}

function VinylScene({ clock }: { clock: number }) {
  return (
    <View style={sc.center}>
      <View style={[sc.vinylDisc, { transform: [{ rotate: `${clock * 360}deg` }] }]}>
        <View style={[sc.vinylGroove, { width: 108, height: 108, borderRadius: 54 }]} />
        <View style={[sc.vinylGroove, { width: 84, height: 84, borderRadius: 42 }]} />
        <View style={[sc.vinylGroove, { width: 60, height: 60, borderRadius: 30 }]} />
        <View style={sc.vinylLabel}>
          <View style={sc.vinylHole} />
        </View>
        <View style={sc.vinylSheen} />
      </View>
    </View>
  );
}

function TunerScene({ clock }: { clock: number }) {
  const drift = -64 * Math.cos(clock * Math.PI * 2); // glide left → right → left
  return (
    <View style={sc.center}>
      <Text style={sc.tunerFreq}>104.7 FM</Text>
      <View style={sc.tunerRuler}>
        {Array.from({ length: 21 }).map((_, i) => (
          <View key={i} style={[sc.tunerTick, i % 5 === 0 && sc.tunerTickMajor]} />
        ))}
        <View style={[sc.tunerNeedle, { transform: [{ translateX: drift }] }]} />
      </View>
      <Text style={sc.tunerHint}>drag to retune</Text>
    </View>
  );
}

// Static star field for the Horizon sky (deterministic, no re-randomising).
const HZ_STARS = Array.from({ length: 14 }, (_, i) => ({
  left: ((i * 71) % 97) / 97,
  top: ((i * 37) % 53) / 53,
  size: 1 + (i % 3) * 0.5,
}));

function HorizonScene({ clock }: { clock: number }) {
  // Rows are 11px apart and the stack slides exactly one gap per cycle,
  // so the scroll toward the viewer loops seamlessly.
  const scroll = (clock * 11) % 11;
  const glow = wave(clock, 0.55, 1);
  return (
    <View style={sc.horizonWrap}>
      {/* Stars in the sky, like the real mode */}
      {HZ_STARS.map((s, i) => (
        <View
          key={i}
          style={[
            sc.horizonStar,
            {
              left: `${8 + s.left * 84}%`,
              top: 4 + s.top * 52,
              width: s.size, height: s.size, borderRadius: s.size,
              opacity: 0.35 + 0.4 * ((i % 4) / 3),
            },
          ]}
        />
      ))}
      {/* Slatted outrun sun rising out of the horizon — cuts clipped to the disc */}
      <View style={[sc.horizonSunWrap, { opacity: glow }]}>
        <View style={sc.horizonSunDisc}>
          {[26, 34, 41, 47, 52].map((top, i) => (
            <View key={top} style={[sc.horizonSunCut, { top, height: 2 + i * 0.6 }]} />
          ))}
        </View>
      </View>
      <View style={sc.horizonGround}>
        {/* Perspective verticals. Each ray is twice the ground's height with
            its centre ON the horizon line, so rotating it pivots about the
            horizon and the fan converges exactly there — real vanishing-point
            behaviour. The old rays pivoted about a point mid-ground, so the
            lines crossed each other in an X below the sun (owner: "the
            vertical lines are kind of awkward" — that X was what they saw). */}
        {[-52, -32, -15, 0, 15, 32, 52].map((deg) => (
          <View key={deg} style={[sc.horizonRay, { transform: [{ rotate: `${deg}deg` }] }]} />
        ))}
        <View style={{ alignSelf: 'stretch', transform: [{ translateY: scroll - 11 }] }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={[sc.horizonRow, { marginTop: 10 }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// Mirror Ball, miniaturised. A uniform grid of tiles clipped to a circle with
// alternate rows offset — which is how a real ball is actually built, and the
// cheapest thing that reads as one at 130px. The light travels across the
// mirrors rather than the grid turning: same trick the full mode uses, and
// the reason it survives being this small.
const MB_ROWS = 9;
const MB_COLS = 11;
const MB_TILE = 13;

function MirrorBallScene({ clock }: { clock: number }) {
  const size = 130;
  const sweep = -size * 0.7 + clock * size * 1.9;
  return (
    <View style={sc.center}>
      <View style={sc.mbStem} />
      <View style={[sc.mbBall, { width: size, height: size, borderRadius: size / 2 }]}>
        {Array.from({ length: MB_ROWS }).map((_, r) => (
          <View key={r} style={[sc.mbRow, { marginLeft: r % 2 ? MB_TILE / 2 : 0 }]}>
            {Array.from({ length: MB_COLS }).map((__, c) => {
              // Deterministic per-tile brightness, so neighbouring mirrors
              // land wildly apart the way real ones do.
              const j = Math.abs(Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
              return (
                <View
                  key={c}
                  style={[sc.mbTile, { backgroundColor: `rgba(226,236,255,${0.16 + j * 0.46})` }]}
                />
              );
            })}
          </View>
        ))}
        {/* The travelling light, soft-edged by stacking two bands */}
        <View style={[sc.mbLightWide, { transform: [{ translateX: sweep }] }]} />
        <View style={[sc.mbLightCore, { transform: [{ translateX: sweep }] }]} />
        {/* Roundness: a bright catch top-left, a dark rim all round */}
        <View style={sc.mbCatch} />
        <View style={[sc.mbRim, { borderRadius: size / 2 }]} />
      </View>
      {/* A couple of specks of light thrown into the room */}
      <View style={[sc.mbSpark, { top: 18, left: 22, opacity: wave(clock, 0.15, 0.85) }]} />
      <View style={[sc.mbSpark, { bottom: 26, right: 26, opacity: wave(clock, 0.8, 0.2) }]} />
    </View>
  );
}

// CD, miniaturised: the mirrored disc with its diffraction fan. The fan is
// STATIC (diffraction belongs to the light, not the plastic — the mode's own
// rule) while a sheen streak rides the spin, which is what makes the turn
// legible on a face that is otherwise rotation-invariant.
const CD_HUES = ['#7fd6ff', '#a9b6ff', '#c9a6ff', '#ffc7a6', '#ffe9a6', '#a6ffd0'];

function CDScene({ clock }: { clock: number }) {
  const size = 122;
  return (
    <View style={sc.center}>
      <View style={[sc.cdDisc, { width: size, height: size, borderRadius: size / 2 }]}>
        {/* Diffraction petals. Rotate about the disc centre, THEN translate
            outward along the rotated axis — each bar occupies the outer ring
            on one side only. The first cut let the bars cross the centre and
            six crossings made a pinwheel star, which is exactly the "reads
            as spokes" failure the CD mode itself avoids. */}
        {/* Twelve narrow ones fusing into a ring — six wide ones rendered as
            chunky gem facets, verified on the burst screenshots. */}
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[sc.cdWedge, {
              backgroundColor: CD_HUES[i % CD_HUES.length],
              transform: [{ rotate: `${i * 30 + 8}deg` }, { translateY: -33 }],
            }]}
          />
        ))}
        {/* The sheen that carries the rotation */}
        <View style={[sc.cdSheen, { transform: [{ rotate: `${clock * 360}deg` }] }]}>
          <View style={sc.cdSheenBar} />
        </View>
        <View style={sc.cdHubRing} />
        <View style={sc.cdHub} />
        <View style={[sc.cdEdge, { borderRadius: size / 2 }]} />
      </View>
    </View>
  );
}

export function PaywallShowcase() {
  const [t, setT] = useState(0);

  // One clock for everything — throttled to ~30fps like the real modes.
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 33) {
        last = now;
        setT((now - start) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const active = Math.floor(t / SCENE_S) % SCENES.length;
  const sceneAge = t % SCENE_S;
  // Fade in at the start of a scene, out at the end.
  const stageOpacity = Math.min(1, sceneAge / FADE_S, (SCENE_S - sceneAge) / FADE_S);
  const clock = (t % LOOP_S) / LOOP_S;
  const scene = SCENES[active];

  return (
    <View style={sc.card}>
      <View style={sc.liveBadge}>
        <View style={sc.liveDot} />
        <Text style={sc.liveText}>LIVE PREVIEW</Text>
      </View>

      <View style={[sc.stage, { opacity: stageOpacity }]}>
        {scene.id === 'vinyl' && <VinylScene clock={clock} />}
        {scene.id === 'radio' && <TunerScene clock={clock} />}
        {scene.id === 'horizon' && <HorizonScene clock={clock} />}
        {scene.id === 'disco' && <MirrorBallScene clock={clock} />}
        {scene.id === 'cd' && <CDScene clock={clock} />}
      </View>

      <View style={sc.chipRow}>
        {SCENES.map((s, i) => (
          <View key={s.id} style={[sc.chip, i === active && sc.chipActive]}>
            <Text style={[sc.chipText, i === active && sc.chipTextActive]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    overflow: 'hidden',
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 26,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginBottom: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER },
  liveText: {
    color: 'rgba(245,158,11,0.85)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2,
  },
  stage: { height: 150, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },

  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: {
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  chipText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: AMBER },

  // Vinyl
  vinylDisc: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: '#141210',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGroove: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  vinylLabel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylHole: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#141210' },
  vinylSheen: {
    position: 'absolute',
    top: 10,
    left: 22,
    width: 26,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ rotate: '-36deg' }],
  },
  // Tuner
  tunerFreq: { color: AMBER, fontSize: 26, fontWeight: '800', letterSpacing: 2, marginBottom: 14 },
  tunerRuler: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: 26,
  },
  tunerTick: { width: 1.5, height: 12, backgroundColor: 'rgba(255,255,255,0.22)' },
  tunerTickMajor: { height: 22, backgroundColor: 'rgba(255,255,255,0.45)' },
  tunerNeedle: {
    position: 'absolute',
    left: '50%',
    bottom: -4,
    width: 2.5,
    height: 36,
    borderRadius: 2,
    backgroundColor: AMBER,
    shadowColor: AMBER,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tunerHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 12,
    textTransform: 'uppercase',
  },

  // Horizon
  horizonWrap: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'flex-end' },
  horizonStar: { position: 'absolute', backgroundColor: '#fff' },
  horizonSunWrap: {
    width: 64,
    height: 64,
    marginBottom: -30,
  },
  horizonSunDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AMBER,
    overflow: 'hidden',
    // Glow lives on the circle itself — on a square wrapper the web
    // renders a square halo.
    shadowColor: AMBER,
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  horizonSunCut: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#151009',
  },
  horizonGround: {
    alignSelf: 'stretch',
    height: 62,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.6)',
    alignItems: 'center',
  },
  // Height = 2x the ground's 62, top = -62: the view's CENTRE (the rotation
  // pivot) lands exactly on the horizon line, and the sky half is clipped by
  // the ground's overflow:hidden. Change the ground's height and these two
  // numbers must follow (height = 2*groundH, top = -groundH).
  horizonRay: {
    position: 'absolute',
    top: -62,
    width: 1,
    height: 124,
    backgroundColor: 'rgba(245,158,11,0.28)',
  },
  horizonRow: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(245,158,11,0.35)',
  },

  // Mirror Ball — a tile grid clipped to a circle, with the light travelling
  // over it. overflow hidden on mbBall is what does the clipping.
  mbStem: { width: 2.5, height: 16, backgroundColor: 'rgba(190,200,222,0.55)' },
  mbBall: {
    overflow: 'hidden',
    backgroundColor: '#141828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mbRow: { flexDirection: 'row' },
  mbTile: { width: MB_TILE - 2, height: MB_TILE - 2, margin: 1, borderRadius: 1.5 },
  mbLightWide: {
    position: 'absolute', top: 0, bottom: 0, width: 54,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  mbLightCore: {
    position: 'absolute', top: 0, bottom: 0, width: 22,
    marginLeft: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  mbCatch: {
    position: 'absolute', top: 12, left: 16, width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  // A thick inner border reads as the ball curving away at the silhouette.
  mbRim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 9, borderColor: 'rgba(4,6,14,0.34)',
  },
  mbSpark: {
    position: 'absolute', width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#ffffff',
  },

  // CD
  cdDisc: {
    backgroundColor: '#0e0f16',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  cdWedge: {
    position: 'absolute',
    left: '50%', top: '50%',
    marginLeft: -13, marginTop: -33,
    width: 26,
    height: 66,
    borderRadius: 12,
    opacity: 0.12,
  },
  cdSheen: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
  },
  cdSheenBar: {
    width: 10,
    height: 52,
    marginTop: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cdHubRing: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0b0c12',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  cdHub: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#05050a',
  },
  // The same thick dark inner rim trick the mirror ball uses for roundness.
  cdEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 5, borderColor: 'rgba(4,6,14,0.30)',
  },
});
