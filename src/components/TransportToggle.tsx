import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { nextRepeat, type RepeatMode } from '@/utils/useMusicPlayback';

/**
 * Shuffle and repeat, for all eight decks.
 *
 * ONE COMPONENT because there were eight near-identical copies, and the copy
 * is how they drift — the same reason ModeActionRow exists (26.07).
 *
 * ── WHY THIS WAS REBUILT (owner, 26.08) ──────────────────────────────────
 * "the shuffle playlists doesn't seem to highlight when i tap on it, so im
 * not sure if it does shuffle. the same goes for the repeat button."
 *
 * THE BUTTONS WERE WORKING. The commands reach the service, the state sticks,
 * and scripts/test-transport-toggles.mjs has covered the cycle since 18.08.
 * What failed was the SIGNAL: "on" was drawn by swapping the icon's colour
 * from white-at-85% to the station's accent — and an accent is almost always
 * DARKER than white. Measured across the whole palette, turning shuffle on
 * made the icon dimmer on 8 of the 10 built-in stations and on 23 of the 25
 * custom-station colours: 5.6x dimmer on the default Violet, 25x on "None",
 * which is invisible. Pressing it looked like nothing happened, or like the
 * control had gone away.
 *
 * AND COLOUR ALONE CAN NEVER FIX IT, which is why this is a rebuild rather
 * than a tuning pass: perceived brightness is ~0.21R + 0.72G + 0.07B, so a
 * saturated hue physically cannot out-brighten white without being washed
 * into a pastel — at which point it is no longer the station's colour. The
 * "on" state needs a change of SHAPE, not of shade.
 *
 * So an active toggle grows a filled PILL behind it — the app's own
 * selected-state language (ModeSheet's active chip, the play disc, the Tune-in
 * pill), which reads at a glance in a moving car.
 *
 * ── AND THE PILL WAS THEN THE WRONG COLOUR (owner, 01.09) ────────────────
 * "This is what the button looks like when it's on shuffle, can it be a bold
 * colour — whatever colour theme is selected — not a bubble which makes it
 * hard to see the shuffle arrows."
 *
 * She is right, and the first build contained the contradiction that caused
 * it. The pill was filled with `litAccent(accent)` — the accent LIFTED TOWARD
 * WHITE until it cleared a brightness floor, so that a dark accent would still
 * separate from the dark scene behind it — while the icon on top was
 * hardcoded `#fff`. Those two jobs pull in opposite directions: everything
 * done to make the pill stand out made the white arrows on it disappear.
 *
 * MEASURED across every colour the app can produce (10 stations + 25
 * swatches): the white arrows fell below 3:1 on **20 of 35**, and Mountain
 * Pass — whose eqColors are literally three whites — sat at **1.08:1**, which
 * is white on white. It was never one bad station; it was most of the palette.
 *
 * THE FIX SEPARATES THE TWO JOBS instead of trading them off:
 *
 *   FILL  is the station's accent EXACTLY as chosen. No lifting, no washing
 *         toward white. "Whatever colour theme is selected", which is both
 *         what was asked for and the honest thing for a control that exists
 *         to show the station's identity.
 *   INK   adapts to the fill — `inkOn` picks white or near-black by measured
 *         contrast, so the arrows are legible on a cream pill AND on a navy
 *         one. Worst case across the whole palette is now 4.31:1 (Slate),
 *         against a 3:1 bar for icon-sized graphics; 34 of 35 clear 4.5:1.
 *   RIM   carries the SHAPE, which is what the lifting was really for. A
 *         hairline is enough to read a pill against the deck even when the
 *         fill is nearly black ("None", #2A2E3D, is 1.36:1 against the scene
 *         and would otherwise be a dark blob on a dark scrim), and unlike
 *         lifting it costs the colour nothing.
 *
 * `litAccent` is retired. Do not reintroduce a brightness floor on the FILL:
 * it is the thing that made the arrows vanish, and the rim does its job
 * without touching the station's colour.
 */

/** WCAG relative luminance — the basis for a real contrast ratio, which is
 *  what actually decides whether the arrows can be seen. The old
 *  `perceived` approximation went with `litAccent`: it was only ever used to
 *  drive the brightness floor, and the floor is what this round removed. */
function relLum(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

function contrast(a: string, b: string): number {
  const la = relLum(a), lb = relLum(b);
  if (la == null || lb == null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Near-black rather than pure black: on a bright pill, #000 reads as a hole
 *  punched in it, while a very dark ink still looks like an icon. */
export const INK_DARK = '#12131a';

/**
 * The arrows' colour, chosen for whichever reads better on this fill.
 *
 * A hardcoded white icon is what put Mountain Pass at 1.08:1. Choosing by
 * MEASUREMENT rather than by assumption means a pale station gets dark arrows
 * and a deep one gets white, and no future swatch can reintroduce the fault.
 */
export function inkOn(fill: string): string {
  return contrast(fill, INK_DARK) > contrast(fill, '#ffffff') ? INK_DARK : '#ffffff';
}

type Props = {
  /** The station's accent — eqColors[1] at every call site. */
  accent: string;
  /** 24 on the compact decks, 26 on Cassette/Equalizer/Vinyl. */
  size?: number;
};

const PAD = 9;

function Pill({ on, accent, children }: { on: boolean; accent: string; children: React.ReactNode }) {
  return (
    <View
      style={[
        t.pill,
        // The accent as chosen — never lifted. The rim, not a brightness
        // floor, is what keeps a dark pill readable against the deck.
        on && { backgroundColor: accent, borderColor: 'rgba(255,255,255,0.34)' },
      ]}>
      {children}
    </View>
  );
}

export function ShuffleButton({ accent, size = 24, on, onPress }: Props & {
  on: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Shuffle on' : 'Shuffle off'}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Pill on={on} accent={accent}>
        <Ionicons name="shuffle" size={size} color={on ? inkOn(accent) : '#fff'} />
      </Pill>
    </TouchableOpacity>
  );
}

export function RepeatButton({ accent, size = 24, mode, onPress }: Props & {
  mode: RepeatMode;
  onPress: (next: RepeatMode) => void;
}) {
  const on = mode !== 'off';
  // `repeat-once` is the glyph carrying the "1" — the owner looked for it and
  // could not find it (26.08), because the first press lands on 'context'
  // (repeat the PLAYLIST) and its accent-coloured plain glyph was invisible
  // against the identical 'off' one. With the pill behind it the three states
  // are finally distinguishable: no pill / pill + plain / pill + "1".
  const glyph = mode === 'track' ? 'repeat-once' : 'repeat';
  return (
    <TouchableOpacity
      onPress={() => onPress(nextRepeat(mode))}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={
        mode === 'track' ? 'Repeat this song'
          : mode === 'context' ? 'Repeat the playlist'
            : 'Repeat off'}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Pill on={on} accent={accent}>
        <MaterialCommunityIcons name={glyph} size={size} color={on ? inkOn(accent) : '#fff'} />
      </Pill>
    </TouchableOpacity>
  );
}

const t = StyleSheet.create({
  // The pill is always laid out, even when off, so switching state cannot
  // shift the transport row sideways — a control that moves when you press it
  // is how a row of buttons ends up feeling loose.
  pill: {
    paddingHorizontal: PAD,
    paddingVertical: PAD - 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    // Always laid out, transparent when off — a border that appears on press
    // would nudge the whole transport row sideways.
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
