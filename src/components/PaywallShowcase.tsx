import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Live looping preview of the four premium modes for the paywall.
 * Pure View miniatures driven by one rAF clock (the same pattern the real
 * modes use — RN Animated stalls on web) — no audio, no station wiring, so
 * the paywall shows motion the instant it opens. Cycles Vinyl → Tuner →
 * Horizon → Orb with a crossfade.
 */

const AMBER = '#F59E0B';
const SCENE_S = 4.2; // seconds each mode is on stage
const FADE_S = 0.45; // crossfade at scene edges
const LOOP_S = 3.6; // one motion cycle within a scene

const SCENES = [
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'radio', label: 'Tuner' },
  { id: 'horizon', label: 'Horizon' },
  { id: 'orb', label: 'Circular EQ' },
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

// The real Circular EQ: a hollow ring of chunky bars with bursts sweeping
// around it — miniaturised (24 bars vs the mode's 64).
const ORB_BARS = 24;
const ORB_BASE_R = 40;

function OrbScene({ clock }: { clock: number }) {
  const sweep = clock * Math.PI * 2;
  const size = 132;
  return (
    <View style={sc.center}>
      <View style={{ width: size, height: size }}>
        {Array.from({ length: ORB_BARS }).map((_, i) => {
          const angle = (i / ORB_BARS) * Math.PI * 2;
          // Two bursts chasing each other around the ring; everything else
          // rests as chunky dots — same read as the real mode.
          const burst =
            Math.pow(Math.max(0, Math.cos(angle - sweep)), 6) +
            Math.pow(Math.max(0, Math.cos(angle - sweep + Math.PI)), 6) * 0.6;
          const len = 4 + 18 * burst;
          return (
            <View
              key={i}
              style={[sc.orbBarArm, { transform: [{ rotate: `${(i / ORB_BARS) * 360}deg` }] }]}>
              <View
                style={[
                  sc.orbBar,
                  { height: len, marginTop: size / 2 - ORB_BASE_R - len },
                ]}
              />
            </View>
          );
        })}
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
        {scene.id === 'orb' && <OrbScene clock={clock} />}
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
  horizonRay: {
    position: 'absolute',
    top: -20,
    width: 1,
    height: 140,
    backgroundColor: 'rgba(245,158,11,0.28)',
  },
  horizonRow: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(245,158,11,0.35)',
  },

  // Orb (Circular EQ) — one absolutely-positioned arm per bar, rotated into place
  orbBarArm: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
  },
  orbBar: {
    width: 4.5,
    borderRadius: 2.5,
    backgroundColor: AMBER,
  },
});
