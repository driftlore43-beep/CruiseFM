import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNowPlaying } from '@/context/NowPlayingContext';

const SPOTIFY_GREEN = '#1DB954';

/**
 * The honest handoff panel.
 *
 * When a drive's music is playing in the Spotify app (no in-app control —
 * the no-login fallback for accounts that can't use the Web API), the visual
 * modes have nothing real to drive: title, progress and the transport buttons
 * would all be dead. Rather than pretend, each mode drops this panel over that
 * bottom zone. It sits inside the mode's own layer (absolute, bottom-anchored)
 * so it stacks correctly above the Modal, and a dark gradient hides the inert
 * controls beneath it. The one live action is "Open Spotify".
 */
export function HandoffOverlay() {
  const np = useNowPlaying();
  const insets = useSafeAreaInsets();

  return (
    <View style={[st.wrap, { paddingBottom: insets.bottom + 26 }]} pointerEvents="box-none">
      {/* Scrim goes fully solid over the lower zone so the inert title,
          progress bar and transport buttons are hidden, not ghosting through. */}
      <LinearGradient
        colors={['transparent', 'rgb(8,8,14)']}
        locations={[0, 0.28]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={st.body} pointerEvents="box-none">
        <View style={st.ring}>
          <MaterialCommunityIcons name="spotify" size={24} color={SPOTIFY_GREEN} />
        </View>
        <Text style={st.title}>Playing in Spotify</Text>
        <Text style={st.sub}>
          Pause, skip and shuffle live in Spotify — Cruise FM brings the drive.
        </Text>
        <Pressable
          onPress={np.returnToSpotify}
          style={({ pressed }) => [st.btn, pressed && { opacity: 0.85 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="open-in-new" size={17} color="#04220f" />
          <Text style={st.btnText}>Open Spotify</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 330,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  body: { alignItems: 'center', paddingHorizontal: 32, gap: 8 },
  ring: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(29,185,84,0.14)',
    borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)',
    marginBottom: 2,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  sub: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18,
    textAlign: 'center', maxWidth: 300,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12,
    marginTop: 8,
  },
  btnText: { color: '#04220f', fontSize: 15, fontWeight: '800' },
});
