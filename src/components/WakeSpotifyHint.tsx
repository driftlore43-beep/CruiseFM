import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DECK_FRAC } from '@/components/LandscapeChrome';

const SPOTIFY_GREEN = '#1DB954';

/**
 * The in-player "wake Spotify" hint. Shows inside every mode whenever a drive
 * is meant to be playing, Spotify is connected, but no song has appeared —
 * the signature of Spotify's app being asleep. Unlike a transient popup, this
 * sits quietly until the situation resolves: the moment a track arrives it
 * fades away on its own.
 *
 * Waits a couple of seconds before appearing so the normal case (music starts
 * quickly) never flashes it.
 */
export function WakeSpotifyHint({ show, connected = true }: { show: boolean; connected?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!show) {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setVisible(false));
      return;
    }
    const t = setTimeout(() => {
      setVisible(true);
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 2200);
    // The visuals-only note (stranger walkthrough, 28.07: a silent first
    // drive never says what it is) informs and then leaves — unlike the wake
    // nudge there is nothing to resolve, so it must not sit there all drive.
    let out: ReturnType<typeof setTimeout> | null = null;
    if (!connected) {
      out = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => setVisible(false));
      }, 9500);
    }
    return () => { clearTimeout(t); if (out) clearTimeout(out); };
  }, [show, connected]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        ws.wrap,
        // Sideways there is no room to hang below the header: the scene owns
        // the middle and the deck panel owns the right. So the hint tucks
        // into the top strip of the LEFT pane — past the close chevron,
        // stopping short of where the panel docks — instead of lying across
        // the object.
        isLandscape
          ? { top: insets.top + 8, left: Math.max(insets.left, 22) + 46, right: winW * DECK_FRAC + 14 }
          : { top: insets.top + 64 },
        { opacity: fade },
      ]}
      pointerEvents="none">
      <View style={[ws.pill, !connected && ws.pillNeutral]}>
        <MaterialCommunityIcons
          name={connected ? 'spotify' : 'music'}
          size={16}
          color={connected ? SPOTIFY_GREEN : 'rgba(255,255,255,0.8)'}
        />
        <Text style={ws.text}>
          {connected
            ? 'Spotify asleep? Open it, play any song for a second, then press play here.'
            : 'Visuals only for now — play music in any app and cruise on. Connect Spotify from the home page for full control.'}
        </Text>
      </View>
    </Animated.View>
  );
}

const ws = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 45 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    maxWidth: 420,
    backgroundColor: 'rgba(8,10,18,0.92)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(29,185,84,0.45)',
  },
  pillNeutral: {
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  text: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
