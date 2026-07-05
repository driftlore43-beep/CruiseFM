import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Cruise } from '@/constants/theme';
import { completeSpotifyAuth } from '@/utils/spotify';

// Handles the Spotify OAuth redirect: cruisefm://auth?code=...
// Completes the token exchange, then returns to the Profile tab.
export default function AuthRedirect() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState<'working' | 'done' | 'failed'>('working');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (params.error || !params.code) {
        if (!cancelled) setStatus('failed');
      } else {
        const ok = await completeSpotifyAuth(params.code);
        if (!cancelled) setStatus(ok ? 'done' : 'failed');
      }
      setTimeout(() => {
        if (!cancelled) router.replace('/profile');
      }, 900);
    }

    run();
    return () => { cancelled = true; };
  }, [params.code, params.error]);

  return (
    <View style={styles.root}>
      {status === 'working' && <ActivityIndicator size="large" color="#1DB954" />}
      <Text style={styles.text}>
        {status === 'working' && 'Connecting Spotify…'}
        {status === 'done' && 'Spotify connected ✓'}
        {status === 'failed' && 'Could not connect Spotify'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Cruise.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    color: Cruise.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
