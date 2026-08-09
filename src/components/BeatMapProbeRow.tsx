import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cruise, Fonts } from '@/constants/theme';
import { probeBeatMap } from '@/utils/spotify';

/**
 * TEMPORARY — DELETE ME once the answer is in.
 *
 * A tester asked whether the visuals actually follow the music. They don't:
 * the bars are timed animations. Making them genuine needs a track's real
 * beat map, and whether Spotify will give us one depends on when our app was
 * registered with them — which cannot be worked out from here. So rather than
 * argue about it, this asks, once, on a real drive.
 *
 * Read the two statuses:
 *   200 — real beat-locked visuals are possible, and they ship over the air.
 *   403 — the route is closed, and the fallback is a narrow opt-in microphone
 *         mode, which is native and would batch with widgets.
 *
 * Shipped to the preview channel only, so nobody on the App Store sees it.
 * When the screenshot arrives, this file and its row in Profile come out.
 */
export function BeatMapProbeRow() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { setLines(await probeBeatMap()); }
    catch { setLines(['The check itself could not run.']); }
    finally { setBusy(false); }
  };

  return (
    <View>
      <Pressable onPress={run} style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
        <View style={st.left}>
          <View style={st.iconCol}>
            <MaterialCommunityIcons name="pulse" size={20} color={Cruise.textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.label}>Beat map check</Text>
            <Text style={st.sub}>
              {busy ? 'Asking Spotify…' : 'Play a song first, then tap and screenshot the result'}
            </Text>
          </View>
        </View>
        {busy && <ActivityIndicator size="small" color={Cruise.textMuted} />}
      </Pressable>
      {!!lines && (
        <View style={st.out}>
          {lines.map((l) => <Text key={l} style={st.line}>{l}</Text>)}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  // Matches the other Profile settings rows exactly: 22pt inset, 24pt icon
  // column, 16.5pt label — see the note in SpotifyConnectRow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 22,
    gap: 16,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 0 },
  iconCol: { width: 24, alignItems: 'center' },
  label: { color: '#fff', fontSize: 16.5, fontWeight: '500' },
  sub: { color: Cruise.textMuted, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  out: {
    marginHorizontal: 22, marginBottom: 14, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
  },
  line: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 19, fontFamily: Fonts.mono },
});
