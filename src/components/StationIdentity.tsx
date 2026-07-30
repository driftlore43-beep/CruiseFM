import { useFonts } from 'expo-font';
import { StyleSheet, Text, View } from 'react-native';

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

/** The seven-segment face, or the mono stand-in until the ttf resolves. */
export function useDsegFont(): string {
  const [loaded] = useFonts({
    'DSEG7Classic-Bold': require('../../assets/fonts/DSEG7Classic-Bold.ttf'),
  });
  return loaded ? 'DSEG7Classic-Bold' : Fonts.mono;
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

  const dial = stationDial(station.id, !!station.premium);
  const name = /\s(AM|FM)$/i.test(station.name) ? station.name : `${station.name} ${dial.band}`;
  const alignItems = align === 'center' ? 'center' as const : 'flex-start' as const;

  return (
    <View style={{ alignItems, gap: 3 }}>
      {eyebrow != null && <Text style={st.eyebrow}>{eyebrow}</Text>}
      <View style={st.row}>
        <Text style={[st.dial, compact && st.dialCompact, { fontFamily: dseg }]}>
          {dial.label}
        </Text>
        <Text style={[st.name, compact && st.nameCompact]} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  eyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8, minWidth: 0 },
  // The number sits a step quieter than the name — it's the station's dial
  // position, not its title.
  dial: { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 0.5 },
  dialCompact: { fontSize: 11 },
  name: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1 },
  nameCompact: { fontSize: 15 },
});
