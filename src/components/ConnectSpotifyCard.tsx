import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { getSavedPlatform } from '@/utils/musicPlatform';
import { connectSpotify, isSpotifyConnected } from '@/utils/spotify';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_GREEN = '#1DB954';

/**
 * Prominent, one-tap Spotify connect — lives on the home screen so linking
 * your music is an obvious front-door action, not something buried in Profile.
 *
 * Atmosphere-first: Cruise FM works without it. But connecting is the upgrade
 * that turns on the real now-playing (live title + progress) and working
 * shuffle / repeat / skip. Shows only while disconnected; once linked it's
 * gone. Re-checks on every focus so it disappears the moment you connect.
 */
export function ConnectSpotifyCard() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // Apple Music listeners get their own card — two connect prompts on
        // one screen is noise, and only one of them is theirs.
        const platform = await getSavedPlatform();
        if (platform === 'appleMusic') { if (active) setConnected(true); return; }
        const c = await isSpotifyConnected();
        if (active) setConnected(c);
      })();
      return () => { active = false; };
    }, []),
  );

  // Hide while we don't yet know, and once connected.
  if (connected !== false) return null;

  const handleConnect = async () => {
    setLoading(true);
    const ok = await connectSpotify();
    // The /auth deep-link may have completed the exchange, so re-check.
    setConnected(ok || (await isSpotifyConnected()));
    setLoading(false);
  };

  return (
    <Pressable
      style={({ pressed }) => [cs.card, pressed && { opacity: 0.9 }]}
      onPress={handleConnect}
      disabled={loading}>
      <View style={cs.iconRing}>
        <MaterialCommunityIcons name="spotify" size={26} color={SPOTIFY_GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cs.title}>Connect Spotify</Text>
        <Text style={cs.sub}>See what’s playing and control it right from your drive.</Text>
        {/* Honest about the developer-mode ceiling (stranger walkthrough,
            28.07): a failed sign-in should read as a known limit, not a
            broken app. */}
        <Text style={cs.beta}>Connections are in limited beta — if sign-in doesn’t complete, you still get the full visual experience.</Text>
      </View>
      {loading
        ? <ActivityIndicator color={SPOTIFY_GREEN} />
        : <View style={cs.btn}><Text style={cs.btnText}>Connect</Text></View>}
    </Pressable>
  );
}

const cs = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(18,18,24,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(29,185,84,0.30)',
  },
  iconRing: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(29,185,84,0.10)',
    borderWidth: 1, borderColor: 'rgba(29,185,84,0.30)',
  },
  title: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  btn: {
    backgroundColor: SPOTIFY_GREEN,
    borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  btnText: { color: '#04220f', fontSize: 14, fontWeight: '800' },
  beta: { color: 'rgba(255,255,255,0.42)', fontSize: 11, lineHeight: 15, marginTop: 3 },
});
