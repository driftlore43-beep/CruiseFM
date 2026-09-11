import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import {
  connectSpotify,
  isSpotifyConnected,
  disconnectSpotify,
} from '@/utils/spotify';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_GREEN = '#1DB954';

function SpotifyConnectRowNative() {
  const styles = useStyles(makeStyles);
  const pal = usePalette();
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
        <View style={[styles.dot, { backgroundColor: connected ? SPOTIFY_GREEN : pal.ink(0.35) }]} />
        <View>
          <Text style={styles.label}>Spotify Connect</Text>
          <Text style={[styles.sub, connected && { color: SPOTIFY_GREEN }]}>
            {connected ? 'Connected — tap to disconnect' : 'Link for playback control'}
          </Text>
        </View>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
        : <Ionicons name="chevron-forward" size={18} color={pal.ink(0.4)} />
      }
    </Pressable>
  );
}

function SpotifyConnectRowWeb() {
  const styles = useStyles(makeStyles);
  const pal = usePalette();
  return (
    <View style={[styles.row, styles.border]}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: pal.ink(0.35) }]} />
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

/**
 * THEMED, and it was the last row on this page that wasn't (owner, 14.08, off
 * a screenshot of the page on paper: white "Spotify Connect" on a light ground,
 * i.e. invisible). It sat on hardcoded `Cruise.textPrimary` — the one style of
 * bug a light theme causes silently, since white on white throws nothing and
 * shows up in no diff. Its neighbour UpdateCheckRow was already converted; the
 * numbers below match it exactly so the two rows stay indistinguishable.
 *
 * Spotify's green stays literal in both themes — it is a brand mark, not page
 * furniture, and it reads on paper as well as on black.
 */
const makeStyles = (p: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    // 22 to match the Profile page's other settings rows, and the status dot
    // sits in a 24pt column so this label starts at the same x as theirs.
    paddingHorizontal: 22,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.ink(0.12),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  label: {
    color: p.text,
    fontSize: 16.5,
    fontWeight: '500',
  },
  sub: {
    color: p.ink(0.55),
    fontSize: 12,
    marginTop: 2,
  },
});
