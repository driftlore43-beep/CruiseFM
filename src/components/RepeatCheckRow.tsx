import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { appleMusicAvailable, diagnoseAppleMusic } from '@/utils/appleMusic';
import { getSavedPlatform } from '@/utils/musicPlatform';
import { diagnoseSpotifyRepeat, isSpotifyConnected } from '@/utils/spotify';

/**
 * TEMPORARY — an instrument, not a feature. DELETE IT once the repeat
 * question is answered, the way the beat-map probe was deleted on 09.08 the
 * day Spotify said no: a permanent button for a settled question is clutter,
 * and an unused one that looks like working machinery is its own trap.
 *
 * WHY IT EXISTS: the owner has now reported "the repeat button doesn't
 * repeat" three times, and each round answered it by reasoning about which
 * of Apple's two player surfaces really drives the Music app. None of those
 * guesses moved the symptom, which is precisely the point at which this
 * project's own rule says to stop theorising and go and read the actual
 * output (the build-37 wall, the Spotify playlist 403, the murky title bar —
 * the same lesson three times over). None of it can be read from here: there
 * is no Swift compiler in this environment, no device, and the behaviour
 * lives entirely inside iOS. So the answer has to come off her phone, and
 * this is the one tap that fetches it.
 *
 * It sends a REAL repeat command and reports what the player said before
 * and after — so "did it land" is a measurement rather than another opinion.
 * It puts the setting back afterwards.
 *
 * AND THE FIRST ANSWER IT GAVE WAS THAT ALL THREE ROUNDS HAD BEEN SPENT ON
 * THE WRONG SERVICE (15.09): it printed Apple Music state — "Subscription:
 * not found · Now playing: nothing" — on a phone whose own Profile page read
 * Spotify, connected, with a track playing. So it now follows the saved
 * platform and NAMES the path it measured on its first line.
 */
export function RepeatCheckRow() {
  const st = useStyles(makeSt);
  const pal = usePalette();
  const [lines, setLines] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Never gated on the saved platform — that was the first version, and it is
  // one more way for the only instrument that can answer this to be invisible
  // on the only phone that can run it. But WHICH probe it runs follows the
  // saved platform, because the previous round un-gated the row and then went
  // on printing Apple Music state to a listener on Spotify: "Subscription: not
  // found · Now playing: nothing" while a track was audibly playing. A reading
  // taken on the wrong path is worse than no reading, because it is believed.
  // Hence the first line of the output NAMES the path it measured.

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const platform = await getSavedPlatform();
      const spotify = platform === 'spotify' || (platform == null && await isSpotifyConnected());
      if (spotify) {
        setLines(['Checking: Spotify', ...await diagnoseSpotifyRepeat()]);
      } else if (appleMusicAvailable()) {
        setLines(['Checking: Apple Music', ...await diagnoseAppleMusic(null)]);
      } else {
        setLines([`Checking: ${platform ?? 'no service'} — nothing here to test.`]);
      }
    } catch {
      setLines(['The check itself failed — nothing to report.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={st.border}>
      <Pressable style={st.row} onPress={run} disabled={busy}>
        <View style={st.left}>
          <View style={st.iconCol}>
            <MaterialCommunityIcons name="repeat" size={21} color={pal.ink(0.62)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Check the repeat button</Text>
            <Text style={st.sub}>Play something first, then tap · send me the result</Text>
          </View>
        </View>
        {busy
          ? <ActivityIndicator size="small" color={pal.ink(0.62)} />
          : <Ionicons name="chevron-forward" size={16} color={pal.ink(0.34)} />}
      </Pressable>
      {lines && (
        <View style={st.out}>
          {lines.map((l, i) => <Text key={i} style={st.line}>{l}</Text>)}
        </View>
      )}
    </View>
  );
}

const makeSt = (p: Palette) => StyleSheet.create({
  // Matches the other Profile settings rows exactly — see UpdateCheckRow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 22,
    gap: 16,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.ink(0.12),
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 0 },
  iconCol: { width: 24, alignItems: 'center' },
  label: { color: p.text, fontSize: 16.5, fontWeight: '500' },
  sub: { color: p.ink(0.55), fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  out: { paddingHorizontal: 22, paddingBottom: 16, gap: 4 },
  // Monospaced, because these are raw values being read off a screenshot and
  // a proportional face makes 0 and O the reader's problem.
  line: { color: p.ink(0.72), fontSize: 11.5, lineHeight: 17, fontFamily: 'monospace' },
});
