import { useFonts } from 'expo-font';
import { StyleSheet, Text, View } from 'react-native';

import { useDaylight } from '@/context/MotionContext';

import type { Station } from '@/constants/stations';
import { stationDial } from '@/constants/stations';
import { Fonts } from '@/constants/theme';

/**
 * How a station introduces itself, everywhere (owner, 30.07):
 *
 *     YOU’RE LISTENING TO
 *     1010  Sunset AM
 *
 * The dial number renders in the same seven-segment type as the Stations
 * page, so the receiver identity follows the station out of that page and
 * into the modes. Every mode header used to carry its own two-line copy of
 * this block — one component now, the ModeActionRow lesson again.
 *
 * The names already end in their band ("Sunset AM", "Rain Drive FM");
 * custom stations don't, so the band is appended for them — the dial number
 * means nothing without knowing which dial it's on.
 */

/**
 * The two segment faces, or the mono stand-in until the ttfs resolve.
 *
 * SEVEN segments for the numbers, FOURTEEN for the band letters, and that
 * split is not decoration: a seven-segment cell has no diagonals, so it
 * genuinely cannot draw an M — set in DSEG7 the band came out as "AN" / "FN"
 * (owner, 31.07). Fourteen segments add the diagonals and the vertical
 * centre bar, which is what real receivers use for their lettering. The
 * Stations page has always set its band headers this way; everywhere else
 * that prints a band must too.
 */
export function useDsegFonts(): { seg7: string; seg14: string } {
  const [loaded] = useFonts({
    'DSEG7Classic-Bold': require('../../assets/fonts/DSEG7Classic-Bold.ttf'),
    'DSEG14Classic-Bold': require('../../assets/fonts/DSEG14Classic-Bold.ttf'),
  });
  return loaded
    ? { seg7: 'DSEG7Classic-Bold', seg14: 'DSEG14Classic-Bold' }
    : { seg7: Fonts.mono, seg14: Fonts.mono };
}

/** Just the seven-segment face — for callers that only print digits. */
export function useDsegFont(): string {
  return useDsegFonts().seg7;
}

export function stationDisplayName(station: Station): string {
  const dial = stationDial(station.id, !!station.premium);
  const name = /\s(AM|FM)$/i.test(station.name) ? station.name : `${station.name} ${dial.band}`;
  return `${dial.label} ${name}`;
}

export function StationIdentity({
  station, eyebrow = 'YOU’RE LISTENING TO', align = 'center', compact = false,
}: {
  station: Station;
  /** null hides the top line entirely. */
  eyebrow?: string | null;
  align?: 'center' | 'left';
  /** Slightly smaller type — the landscape header. */
  compact?: boolean;
}) {
  // Same asset the Stations page loads; expo-font caches globally so this is
  // free after the first mount.
  const dseg = useDsegFont();
  const day = useDaylight();

  const dial = stationDial(station.id, !!station.premium);
  const name = /\s(AM|FM)$/i.test(station.name) ? station.name : `${station.name} ${dial.band}`;
  const alignItems = align === 'center' ? 'center' as const : 'flex-start' as const;

  return (
    <View style={{ alignItems, gap: 3 }}>
      {eyebrow != null && <Text style={[st.eyebrow, compact && st.eyebrowCompact, day && st.eyebrowDay]}>{eyebrow}</Text>}
      <View style={st.row}>
        <Text style={[st.dial, compact && st.dialCompact, day && st.dialDay, { fontFamily: dseg }]}>
          {dial.label}
        </Text>
        <Text style={[st.name, compact && st.nameCompact, day && st.nameDay]} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  eyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  // COMPACT is the landscape deck's only caller, and there the station's name
  // is a caption at the top of a panel whose subject is the SONG — so it
  // steps back to let the title lead (owner, 19.08: "slightly make the top
  // text smaller"). It used to shrink nothing but the dial: `nameCompact` was
  // byte-identical to `name`.
  eyebrowCompact: { fontSize: 9, letterSpacing: 1.7 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  // The number sits a step quieter than the name — it's the station's dial
  // position, not its title.
  dial: { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 0.5 },
  dialCompact: { fontSize: 11 },
  name: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1 },
  nameCompact: { fontSize: 13.5 },
  // Daylight: the quiet steps go to full strength. Half-opacity white on a
  // photograph is the first thing the sun takes.
  eyebrowDay: { color: 'rgba(255,255,255,0.88)' },
  dialDay: { color: '#ffffff' },
  nameDay: { color: '#ffffff' },
});
