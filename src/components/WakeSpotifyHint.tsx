import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
export function WakeSpotifyHint({ show }: { show: boolean }) {
  const insets = useSafeAreaInsets();
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
    return () => clearTimeout(t);
  }, [show]);

  if (!visible) return null;

  return (
    <Animated.View style={[ws.wrap, { top: insets.top + 64, opacity: fade }]} pointerEvents="none">
      <View style={ws.pill}>
        <MaterialCommunityIcons name="spotify" size={16} color={SPOTIFY_GREEN} />
        <Text style={ws.text}>
          Spotify asleep? Open it, play any song for a second, then press play here.
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
  },
  text: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
