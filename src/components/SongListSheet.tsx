import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { getPlaylistTracks, playTrackInContext, type PlaylistTrack } from '@/utils/spotify';

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The songs in whatever is playing — tap one to jump straight to it.
 *
 * WHY (owner, 03.08, after a real drive): "I wanted to change the song
 * without always hopping over to Spotify." Skip only walks forward and back,
 * so reaching a particular song meant leaving the app.
 *
 * WHERE IT LIVES, and this is the whole design: nowhere new. The middle pill
 * already names the playlist; tapping it now opens the playlist instead of a
 * picker of OTHER playlists, and switching playlists moves to one row at the
 * top of this sheet. No new pill, no sixth transport button — the card you
 * drive with is unchanged.
 *
 * DELIBERATELY PLAIN: a list and a tap. No search, no reordering, no drag.
 * Picking a song is already more interaction than skipping, and this is an
 * app used at the wheel.
 */
export function SongListSheet({
  visible, onClose, onChangePlaylist, contextUri, playlistName, currentUri, onPlayed,
}: {
  visible: boolean;
  onClose: () => void;
  /** Escape hatch to the old picker — the sheet's one secondary action. */
  onChangePlaylist: () => void;
  /** The playlist actually feeding the music, e.g. `spotify:playlist:37i9…`. */
  contextUri: string | null;
  playlistName: string;
  /** Track uri currently playing, so the list can mark it. */
  currentUri?: string | null;
  /** Fired after a successful jump, so the caller can refresh the transport. */
  onPlayed?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const y = useRef(new Animated.Value(2000)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [tracks, setTracks] = useState<PlaylistTrack[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const playlistId = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(contextUri ?? '')?.[1] ?? null;

  useEffect(() => {
    if (!visible || !playlistId) return;
    let live = true;
    setTracks(null);
    getPlaylistTracks(playlistId)
      .then((t) => { if (live) setTracks(t); })
      .catch(() => { if (live) setTracks([]); });
    return () => { live = false; };
  }, [visible, playlistId]);

  useEffect(() => {
    // Same rules as the mood sheet: start every open from a known off-screen
    // position, and stay mounted through the exit so it slides away.
    if (visible) { setMounted(true); y.setValue(winH); }
    Animated.parallel([
      Animated.timing(y, {
        toValue: visible ? 0 : winH,
        duration: visible ? 300 : 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (!visible && finished) setMounted(false); });
  }, [visible]);

  const jump = async (t: PlaylistTrack) => {
    if (!contextUri || busy) return;
    setBusy(t.uri);
    try {
      await playTrackInContext(contextUri, t.uri);
      onPlayed?.();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  if (!mounted) return null;

  // A Modal, and the distinction matters. The mood sheet on the Modes TAB
  // must NOT be one (iOS won't stack a second window over the player's), but
  // this sheet opens from INSIDE the player's own modal — the same place
  // ShareCardSheet lives, which has worked on device since July. Being a
  // Modal is also the only way out of the mode's own layer order: AmbientGlow
  // is a later sibling and painted its haze straight over the list.
  // supportedOrientations is required on anything that can present mid-drive.
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[s.sheet, { paddingBottom: insets.bottom + 14, transform: [{ translateY: y }] }]}>
        <View style={s.handle} />

        <View style={s.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.eyebrow, { fontFamily: Fonts.mono }]}>PLAYING FROM</Text>
            <Text style={s.title} numberOfLines={1}>{playlistName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => { onClose(); onChangePlaylist(); }} style={s.swap} activeOpacity={0.8}>
          <Ionicons name="albums-outline" size={15} color="rgba(255,255,255,0.75)" />
          <Text style={s.swapText}>Change playlist</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>

        <ScrollView style={{ maxHeight: winH * 0.46 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {!playlistId && (
            <Text style={s.empty}>
              Songs show up here once Spotify is playing one of your playlists.
            </Text>
          )}
          {playlistId && tracks === null && (
            <View style={s.loading}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>
          )}
          {playlistId && tracks?.length === 0 && (
            <Text style={s.empty}>Couldn&apos;t read this playlist&apos;s songs.</Text>
          )}
          {tracks?.map((t, i) => {
            const now = !!currentUri && t.uri === currentUri;
            return (
              <TouchableOpacity
                key={t.uri + i}
                activeOpacity={0.75}
                onPress={() => jump(t)}
                style={[s.row, now && s.rowNow]}>
                <View style={s.numWrap}>
                  {now
                    ? <Ionicons name="volume-medium" size={15} color="#0a0a10" />
                    : <Text style={s.num}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.song, now && s.songNow]} numberOfLines={1}>{t.title}</Text>
                  <Text style={[s.artist, now && s.artistNow]} numberOfLines={1}>{t.artist}</Text>
                </View>
                {busy === t.uri
                  ? <ActivityIndicator size="small" color={now ? '#0a0a10' : 'rgba(255,255,255,0.7)'} />
                  : <Text style={[s.dur, now && s.durNow]}>{fmt(t.durationMs)}</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#0d0d16',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
    zIndex: 300,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, marginBottom: 12 },
  eyebrow: { color: 'rgba(255,255,255,0.42)', fontSize: 9.5, fontWeight: '800', letterSpacing: 2.5 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  swap: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  swapText: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 13.5, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  loading: { paddingVertical: 30, alignItems: 'center' },
  empty: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19, paddingVertical: 18, paddingHorizontal: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12, marginBottom: 4,
  },
  // The playing song is a solid white pill with dark type — the same
  // primary-selection language as the mood sheet and the mode chips.
  rowNow: { backgroundColor: '#ffffff' },
  numWrap: { width: 22, alignItems: 'center' },
  num: { color: 'rgba(255,255,255,0.34)', fontSize: 12.5, fontWeight: '700' },
  song: { color: '#fff', fontSize: 14.5, fontWeight: '600' },
  songNow: { color: '#0a0a10', fontWeight: '800' },
  artist: { color: 'rgba(255,255,255,0.42)', fontSize: 12, marginTop: 1 },
  artistNow: { color: 'rgba(0,0,0,0.55)' },
  dur: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontVariant: ['tabular-nums'] },
  durNow: { color: 'rgba(0,0,0,0.45)' },
});
