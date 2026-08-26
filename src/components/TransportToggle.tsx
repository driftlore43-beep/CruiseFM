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
 * So an active toggle now grows a filled pill behind it, with a WHITE icon on
 * top. That is the app's own selected-state language (ModeSheet's active chip,
 * the play disc, the Tune-in pill: a solid fill in the opposite of its
 * ground), it reads at a glance in a moving car, and it survives any station
 * colour because the icon no longer depends on the accent to be legible. The
 * accent tints the pill, so the station's identity is still what lights up.
 */

/** Perceived brightness, 0-255. The eye weights green far above blue, so a
 *  plain average calls a saturated blue "mid" when it is nearly black. */
function perceived(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/**
 * The accent, lifted only as far as it must be to read as a lit pill on a
 * dark scene — the mirror of `readableOn`, which deepens pale colours for
 * paper. Hue survives (it mixes toward white rather than replacing), and a
 * colour already bright enough is returned untouched, so nothing that reads
 * well today can change.
 *
 * PILL_FLOOR is set from the measurement above: "None" (#2A2E3D) sits at 47
 * and is the darkest thing the palette can produce, while Midnight and
 * Espresso sit near 60-75. 110 lifts all of them clear of the scene behind
 * without turning the bright ones into pastels.
 */
export const PILL_FLOOR = 110;

export function litAccent(color: string): string {
  const lum = perceived(color);
  if (lum == null || lum >= PILL_FLOOR) return color;
  const n = parseInt(color.trim().replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // How far toward white this colour has to travel to clear the floor.
  const t = Math.min(0.72, (PILL_FLOOR - lum) / Math.max(255 - lum, 1));
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const hex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${hex(mix(r))}${hex(mix(g))}${hex(mix(b))}`;
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
    <View style={[t.pill, on && { backgroundColor: litAccent(accent) }]}>
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
        <Ionicons name="shuffle" size={size} color="#fff" />
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
        <MaterialCommunityIcons name={glyph} size={size} color="#fff" />
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
  },
});
