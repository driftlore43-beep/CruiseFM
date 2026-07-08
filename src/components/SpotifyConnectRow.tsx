import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Cruise } from '@/constants/theme';
import {
  connectSpotify,
  isSpotifyConnected,
  disconnectSpotify,
} from '@/utils/spotify';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_GREEN = '#1DB954';

function SpotifyConnectRowNative() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isSpotifyConnected().then(setConnected);
  }, []);

  async function handleConnect() {
    setLoading(true);
    const ok = await connectSpotify();
    // The /auth deep-link route may have completed the exchange instead, so
    // re-check the stored token rather than trusting the return value alone.
    const isConnected = ok || (await isSpotifyConnected());
    setConnected(isConnected);
    setLoading(false);
  }

  async function handleDisconnect() {
    await disconnectSpotify();
    setConnected(false);
  }

  return (
    <Pressable
      style={[styles.row, styles.border]}
      onPress={connected ? handleDisconnect : handleConnect}
      disabled={loading}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: connected ? SPOTIFY_GREEN : Cruise.textMuted }]} />
        <View>
          <Text style={styles.label}>Spotify Connect</Text>
          <Text style={[styles.sub, connected && { color: SPOTIFY_GREEN }]}>
            {connected ? 'Connected — tap to disconnect' : 'Link for playback control'}
          </Text>
        </View>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
        : <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
      }
    </Pressable>
  );
}

function SpotifyConnectRowWeb() {
  return (
    <View style={[styles.row, styles.border]}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: Cruise.textMuted }]} />
        <View>
          <Text style={styles.label}>Spotify Connect</Text>
          <Text style={styles.sub}>Available in the native app</Text>
        </View>
      </View>
    </View>
  );
}

export function SpotifyConnectRow() {
  if (Platform.OS === 'web') return <SpotifyConnectRowWeb />;
  return <SpotifyConnectRowNative />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  border: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: Cruise.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  sub: {
    color: Cruise.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  arrow: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 22,
  },
});
