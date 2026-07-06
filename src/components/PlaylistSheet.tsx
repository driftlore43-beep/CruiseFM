import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserPlaylists, isSpotifyConnected } from '@/utils/spotify';
import { type LinkedPlaylist } from '@/utils/stationPlaylists';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Bottom-sheet playlist picker shared by every visual mode.
 *
 * Lists the user's Spotify playlists so they can link one to the station.
 * The parent owns persistence (setStationPlaylist) via `onPick`.
 */
export function PlaylistSheet({
  stationName, current, onClose, onPick,
}: {
  stationName: string;
  current: LinkedPlaylist | null;
  onClose: () => void;
  onPick: (pl: LinkedPlaylist) => void;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [playlists, setPlaylists] = useState<LinkedPlaylist[]>([]);

  useEffect(() => {
    (async () => {
      const isConn = await isSpotifyConnected();
      setConnected(isConn);
      if (isConn) {
        const data = await getUserPlaylists();
        const items: LinkedPlaylist[] =
          data?.items?.map((p: any) => ({ uri: p.uri, name: p.name })) ?? [];
        setPlaylists(items);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <View style={ps.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[ps.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ps.handle} />
        <Text style={ps.title}>Choose a playlist</Text>
        <Text style={ps.sub}>for {stationName}</Text>

        {loading ? (
          <ActivityIndicator color={SPOTIFY_GREEN} style={{ marginVertical: 32 }} />
        ) : !connected ? (
          <Text style={ps.empty}>Connect Spotify in Profile → Settings to add your own playlists.</Text>
        ) : playlists.length === 0 ? (
          <Text style={ps.empty}>No playlists found in your Spotify library.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {playlists.map((pl) => {
              const active = current?.uri === pl.uri;
              return (
                <Pressable key={pl.uri} style={[ps.row, active && ps.rowActive]} onPress={() => onPick(pl)}>
                  <Text style={[ps.rowText, active && { color: SPOTIFY_GREEN }]} numberOfLines={1}>{pl.name}</Text>
                  {active && <Text style={ps.check}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#12121c', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 14 },
  title: { color: '#fff', fontSize: 19, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2, marginBottom: 14 },
  empty: { color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 28, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowActive: { backgroundColor: 'rgba(29,185,84,0.12)', borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)' },
  rowText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', flex: 1 },
  check: { color: SPOTIFY_GREEN, fontSize: 15, fontWeight: '800', marginLeft: 8 },
});
