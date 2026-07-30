import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  appleMusicAvailable,
  canPlayAppleMusic,
  connectAppleMusic,
  isAppleMusicConnected,
} from '@/utils/appleMusic';
import { getSavedPlatform } from '@/utils/musicPlatform';

const APPLE_RED = '#FC3C44';

/**
 * The Apple Music front door — the peer of ConnectSpotifyCard, shown on the
 * home screen to listeners who chose Apple Music.
 *
 * THE PROMPT IS NEVER AUTOMATIC (owner decision, 29.07). Apple shows exactly
 * one system dialog, and a reflexive "Don't Allow" on app launch costs the
 * user a trip into iOS Settings to undo — so it fires here, on a deliberate
 * tap, after they've already seen what the app is.
 *
 * Two outcomes worth separating: access DENIED (they said no, or a device
 * restriction) and access granted but NO SUBSCRIPTION. The second is common
 * and not an error — the visuals still work, so it says so plainly instead
 * of leaving a dead button behind.
 */
export function ConnectMusicCard() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        // Only for Apple Music people, and only on builds that can actually
        // do it — everywhere else this card does not exist.
        if (!appleMusicAvailable()) { if (active) setShow(false); return; }
        const platform = await getSavedPlatform();
        if (platform !== 'appleMusic') { if (active) setShow(false); return; }
        const connected = await isAppleMusicConnected();
        if (active) setShow(!connected);
      })();
      return () => { active = false; };
    }, []),
  );

  if (!show) return null;

  const handleConnect = async () => {
    setLoading(true);
    const status = await connectAppleMusic();
    if (status === 'authorized') {
      // Authorised is not subscribed. Say which one they've got.
      const canPlay = await canPlayAppleMusic();
      if (canPlay) setShow(false);
      else setNote('Connected — but in-app playback needs an Apple Music subscription. The visuals work either way.');
    } else if (status === 'denied') {
      setNote('Access was declined. You can turn it on later in Settings › Cruise FM › Media & Apple Music.');
    } else if (status === 'restricted') {
      setNote('This device restricts Apple Music access. Cruise FM still runs the full visual experience.');
    }
    setLoading(false);
  };

  return (
    <Pressable
      style={({ pressed }) => [cm.card, pressed && { opacity: 0.9 }]}
      onPress={handleConnect}
      disabled={loading}>
      <View style={cm.iconRing}>
        <MaterialCommunityIcons name="apple" size={26} color={APPLE_RED} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cm.title}>Connect Apple Music</Text>
        <Text style={cm.sub}>Play your music right inside the drive — live titles and full control.</Text>
        {!!note && <Text style={cm.note}>{note}</Text>}
      </View>
      {loading
        ? <ActivityIndicator color={APPLE_RED} />
        : <View style={cm.btn}><Text style={cm.btnText}>Connect</Text></View>}
    </Pressable>
  );
}

const cm = StyleSheet.create({
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
    borderColor: 'rgba(252,60,68,0.28)',
  },
  iconRing: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(252,60,68,0.10)',
    borderWidth: 1, borderColor: 'rgba(252,60,68,0.28)',
  },
  title: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: -0.2 },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  note: { color: 'rgba(255,255,255,0.5)', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  btn: {
    backgroundColor: APPLE_RED,
    borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
