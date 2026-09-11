import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSpotifyConnected } from '@/utils/spotify';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

const SPOTIFY_GREEN = '#1DB954';
const DISMISS_KEY = 'cruise_spotify_nudge_dismissed';

/**
 * One-time heads-up for connected drivers: Spotify only lets Cruise FM take
 * over once its app is already awake, so the very first drive can look "dead"
 * unless you play a second of music in Spotify first. This surfaces that up
 * front instead of leaving people to discover it through a silent player.
 *
 * Shows only while Spotify is connected and the tip hasn't been dismissed;
 * tapping the ✕ remembers the dismissal for good. The transient failure notice
 * over the player is still the backstop if they skip it.
 */
export function SpotifyNudgeCard() {
  const sn = useStyles(make_sn);
  const pal = usePalette();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      isSpotifyConnected().then((c) => { if (active) setConnected(c); });
      AsyncStorage.getItem(DISMISS_KEY).then((v) => { if (active) setDismissed(v === 'true'); });
      return () => { active = false; };
    }, []),
  );

  // Wait until both checks are in; only show for connected, undismissed drivers.
  if (connected !== true || dismissed !== false) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, 'true').catch(() => {});
  };

  return (
    <View style={sn.card}>
      <View style={sn.iconRing}>
        <MaterialCommunityIcons name="spotify" size={20} color={SPOTIFY_GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sn.title}>Wake Spotify first</Text>
        <Text style={sn.sub}>
          Open Spotify and play any song for a second, then come back and Start Drive — Cruise FM takes over the music from there.
        </Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} style={sn.close}>
        <Ionicons name="close" size={16} color={pal.ink(0.55)} />
      </Pressable>
    </View>
  );
}

const make_sn = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(29,185,84,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.38)',
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(29,185,84,0.16)',
    borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)',
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', letterSpacing: 0 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  close: { alignSelf: 'flex-start', padding: 2 },
});
