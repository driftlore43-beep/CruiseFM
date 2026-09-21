import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSavedPlatform, PLATFORMS } from '@/utils/musicPlatform';
import { HANDOFF_APP_NAME, parsePlaylistLink, type HandoffPlatform } from '@/utils/playlistHandoff';
import { getUserPlaylists, isSpotifyConnected } from '@/utils/spotify';
import { type LinkedPlaylist } from '@/utils/stationPlaylists';

const SPOTIFY_GREEN = '#1DB954';

/** Accent per service, borrowed from the platform registry so there's one
 *  source of truth for the brand colours. */
const ACCENT: Record<HandoffPlatform, string> = {
  spotify:    PLATFORMS.spotify.color,
  appleMusic: PLATFORMS.appleMusic.color,
};
/** Readable text on top of each accent. */
const ON_ACCENT: Record<HandoffPlatform, string> = {
  spotify:    '#04220f',
  appleMusic: '#ffffff',
};

/**
 * Paste-a-link row: works for everyone, including accounts that can't browse
 * their library through the API (not connected / not allowlisted) and Apple
 * Music listeners, who have no API path at all.
 *
 * `platform` only decides the wording and the accent — a link from either
 * service is accepted whichever one the user picked at onboarding.
 */
function PasteLinkRow({ platform, onPick }: { platform: HandoffPlatform; onPick: (pl: LinkedPlaylist) => void }) {
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const app = HANDOFF_APP_NAME[platform];

  const link = () => {
    const parsed = parsePlaylistLink(text);
    if (!parsed) { setBad(true); return; }
    onPick({ uri: parsed.uri, name: `My ${HANDOFF_APP_NAME[parsed.platform]} playlist` });
  };

  return (
    <View style={ps.pasteWrap}>
      <View style={ps.pasteRow}>
        <TextInput
          value={text}
          onChangeText={(t) => { setText(t); setBad(false); }}
          placeholder={`Paste your ${app} playlist link…`}
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={[ps.pasteInput, bad && ps.pasteInputBad]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={[ps.pasteBtn, { backgroundColor: ACCENT[platform] }]} onPress={link}>
          <Text style={[ps.pasteBtnText, { color: ON_ACCENT[platform] }]}>Link</Text>
        </Pressable>
      </View>
      <Text style={ps.pasteHint}>
        {bad
          ? `That doesn't look like a playlist link — in ${app}: open a playlist → Share → Copy Link.`
          : `In ${app}: open a playlist → ⋯ → Share → Copy Link, then paste it here.`}
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
  // Which service to speak in. Apple Music only when they chose it and
  // there's no live Spotify session to contradict it.
  const [platform, setPlatform] = useState<HandoffPlatform>('spotify');

  useEffect(() => {
    (async () => {
      const isConn = await isSpotifyConnected();
      setConnected(isConn);
      if (isConn) {
        const data = await getUserPlaylists();
        const items: LinkedPlaylist[] =
          data?.items?.map((p: any) => ({ uri: p.uri, name: p.name })) ?? [];
        setPlaylists(items);
      } else if ((await getSavedPlatform()) === 'appleMusic') {
        setPlatform('appleMusic');
      }
      setLoading(false);
    })();
  }, []);

  const app = HANDOFF_APP_NAME[platform];

  return (
    <View style={ps.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[ps.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={ps.handle} />
        <Text style={ps.title}>Choose a playlist</Text>
        <Text style={ps.sub}>for {stationName}</Text>

        {loading ? (
          <ActivityIndicator color={ACCENT[platform]} style={{ marginVertical: 32 }} />
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
                No {app} login needed — link any playlist with its share link:
              </Text>
            )}
            <PasteLinkRow platform={platform} onPick={onPick} />
          </>
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
