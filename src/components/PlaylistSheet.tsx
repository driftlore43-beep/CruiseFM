import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserPlaylists, isSpotifyConnected } from '@/utils/spotify';
import { parseSpotifyPlaylistLink } from '@/utils/spotifyHandoff';
import { type LinkedPlaylist } from '@/utils/stationPlaylists';

const SPOTIFY_GREEN = '#1DB954';

/**
 * Paste-a-link fallback: works for everyone, including accounts that can't
 * browse their library through the API (not connected / not allowlisted).
 * In Spotify: playlist → ⋯ → Share → Copy link.
 */
function PasteLinkRow({ onPick }: { onPick: (pl: LinkedPlaylist) => void }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);

  const link = () => {
    const uri = parseSpotifyPlaylistLink(text);
    if (!uri) { setBad(true); return; }
    onPick({ uri, name: 'My Spotify playlist' });
  };

  return (
    <View style={ps.pasteWrap}>
      <View style={ps.pasteRow}>
        <TextInput
          value={text}
          onChangeText={(t) => { setText(t); setBad(false); }}
          placeholder="Paste a Spotify playlist link…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={[ps.pasteInput, bad && ps.pasteInputBad]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={ps.pasteBtn} onPress={link}>
          <Text style={ps.pasteBtnText}>Link</Text>
        </Pressable>
      </View>
      <Text style={ps.pasteHint}>
        {bad
          ? "That doesn't look like a playlist link — in Spotify: playlist → Share → Copy link."
          : 'In Spotify: open a playlist → ⋯ → Share → Copy link, then paste it here.'}
      </Text>
    </View>
  );
}

/**
 * Bottom-sheet playlist picker shared by every visual mode.
 *
 * Lists the user's Spotify playlists when the API allows; the paste-a-link
 * row underneath works for everyone else. The parent owns persistence
 * (setStationPlaylist) via `onPick`.
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
      {/* Lifts the sheet above the keyboard so the paste-a-link bar stays
          visible while typing — without this the keyboard covered it. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[ps.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ps.handle} />
        <Text style={ps.title}>Choose a playlist</Text>
        <Text style={ps.sub}>for {stationName}</Text>

        {loading ? (
          <ActivityIndicator color={SPOTIFY_GREEN} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {connected && playlists.length > 0 && (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {playlists.map((pl) => {
                  const active = current?.uri === pl.uri;
                  return (
                    <Pressable key={pl.uri} style={[ps.row, active && ps.rowActive]} onPress={() => onPick(pl)}>
                      <Text style={[ps.rowText, active && { color: SPOTIFY_GREEN }]} numberOfLines={1}>{pl.name}</Text>
                      {active && <MaterialCommunityIcons name="check" size={15} color={SPOTIFY_GREEN} style={ps.check} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {connected && playlists.length === 0 && (
              <Text style={ps.empty}>
                Your Spotify library isn't reachable from here — but any playlist can still be linked with its share link:
              </Text>
            )}
            {!connected && (
              <Text style={ps.empty}>
                No Spotify login needed — link any playlist with its share link:
              </Text>
            )}
            <PasteLinkRow onPick={onPick} />
          </>
        )}
      </View>
      </KeyboardAvoidingView>
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

  pasteWrap: { marginTop: 10 },
  pasteRow: { flexDirection: 'row', gap: 8 },
  pasteInput: {
    flex: 1, color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  pasteInputBad: { borderColor: 'rgba(255,120,120,0.7)' },
  pasteBtn: {
    backgroundColor: SPOTIFY_GREEN, borderRadius: 12,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  pasteBtnText: { color: '#04220f', fontSize: 14.5, fontWeight: '800' },
  pasteHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 16, marginTop: 8, marginBottom: 2 },
});
