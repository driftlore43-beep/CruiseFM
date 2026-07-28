import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

/**
 * The "F" glass finish (owner's pick, 28.07), shared by the Modes cards and
 * the YOUR STATIONS cards: drawn OVER a card's gradient, it reads as a lit
 * pane — light gathering at the top and a faint shadow grounding the bottom,
 * an ambient catch across the top-left corner, a hairline along the top edge
 * that burns brightest at one specular point, a soft bloom on that point,
 * and two cool glints near the bottom corners (from the owner's reference
 * photograph of a real glass pane).
 *
 * The host card supplies its own bright border (white ~0.30) as the rim, and
 * puts its drop shadow on a WRAPPER — iOS clips shadows on overflow-hidden
 * views.
 */

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
}

/**
 * The mute that sits under the glass. A LIGHT touch on purpose: the first
 * version (42% slate + a white lift) came out washed and pastel — white is
 * what pastels a colour — so this only takes the neon edge off.
 */
export const smoke = (c: string) => mixHex(c, '#4a4f62', 0.18);

/** A stable specular-point position (22-67) derived from any string. */
export function specularSpot(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 22 + (h % 46);
}

export function GlassPane({ spot, uid }: { spot: number; uid: string }) {
  return (
    <>
      {/* light gathers at the top, a hint of shadow grounds the bottom */}
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.16)']}
        locations={[0, 0.28, 0.6, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill} pointerEvents="none"
      />
      {/* ambient catch across the top-left corner */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.55, y: 0.55 }}
        style={StyleSheet.absoluteFill} pointerEvents="none"
      />
      {/* hairline along the very top edge, burning brightest at one point */}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.12)']}
        locations={[0, Math.max(0.05, Math.min(0.9, spot / 100)), Math.min(0.95, spot / 100 + 0.13), 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={gp.topline} pointerEvents="none"
      />
      {/* the specular bloom sitting on that point (no blur filter in RN — a
          small radial gradient stands in for it). Ids are namespaced per
          card: duplicate ids across Svg roots render blank. */}
      <Svg width={70} height={14} style={[gp.hotspot, { left: `${spot - 9}%` }]} pointerEvents="none">
        <Defs>
          <RadialGradient id={`ghs${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <Stop offset="0.7" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={35} cy={7} rx={35} ry={7} fill={`url(#ghs${uid})`} />
      </Svg>
      {/* cool glints near the bottom corners, from the reference pane */}
      <LinearGradient
        colors={['rgba(160,240,255,0)', 'rgba(160,240,255,0.55)', 'rgba(160,240,255,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={gp.glintL} pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(160,240,255,0)', 'rgba(190,245,255,0.45)', 'rgba(160,240,255,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={gp.glintR} pointerEvents="none"
      />
    </>
  );
}

const gp = StyleSheet.create({
  topline: {
    position: 'absolute',
    top: 0,
    left: '7%',
    right: '7%',
    height: 1.5,
    borderRadius: 1,
  },
  hotspot: {
    position: 'absolute',
    top: -6,
  },
  glintL: {
    position: 'absolute',
    bottom: 0,
    left: '6%',
    width: '26%',
    height: 2,
    borderRadius: 2,
  },
  glintR: {
    position: 'absolute',
    bottom: 0,
    right: '4%',
    width: '20%',
    height: 2,
    borderRadius: 2,
  },
});
