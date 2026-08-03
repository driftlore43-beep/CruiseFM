import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Modal, PanResponder, ScrollView, StyleSheet, Text,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { useSheetOpen } from '@/context/NowPlayingContext';
import { connectSpotify, diagnoseSpotify, getPlaybackQueue, getPlaylistTracks, playTrackInContext, type FailReason, type PlaylistTrack } from '@/utils/spotify';

/**
 * Plain words for each way the read can fail, and — the part that matters —
 * what to DO about it. A message that only names the problem is a dead end;
 * the owner's first reply to the honest version was "how can I fix this?".
 *
 * `retry` is for causes that might pass on their own; `reconnect` offers the
 * actual one-tap fix where reconnecting is the fix.
 */
const TROUBLE: Record<FailReason, { text: string; retry?: boolean; reconnect?: boolean }> = {
  offline: { text: 'Couldn’t reach Spotify. Check your signal and try again.', retry: true },
  busy: { text: 'Spotify is asking us to slow down. Give it a moment.', retry: true },
  error: { text: 'Spotify didn’t answer properly. Worth another try.', retry: true },
  auth: { text: 'Your Spotify connection has expired. Reconnecting takes a moment and picks up where you left off.', reconnect: true },
  scope: {
    text: 'Cruise FM hasn’t been given permission to read your playlists yet. Reconnecting asks Spotify for it — your music keeps playing.',
    reconnect: true,
  },
  restricted: {
    text: 'This Spotify account isn’t on Cruise FM’s tester list, so Spotify blocks everything except playing. Nothing here can change that from your side.',
  },
  forbidden: {
    // Deliberately NOT a diagnosis. Two confident guesses at this 403 — a
    // missing permission, then an editorial playlist — were both wrong, and
    // each sent the owner to reconnect for nothing. Spotify's own words are
    // printed underneath instead; they are the only reliable answer.
    text: 'Spotify refused to hand over this playlist’s songs. Playing it still works — this only affects listing the tracks.',
  },
  notfound: { text: 'Spotify can’t find this playlist any more. It may have been deleted, or made private by whoever owns it.', retry: false },
};

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
  const [trouble, setTrouble] = useState<FailReason | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [checks, setChecks] = useState<string[] | null>(null);
  // Spotify will not give a development-tier app a playlist's contents (03.08,
  // measured every way there is). The player's QUEUE is a different thing and
  // still answers, so when the playlist is closed to us the sheet shows what
  // is coming up instead — clearly labelled as that, not passed off as the
  // playlist.
  const [queue, setQueue] = useState<PlaylistTrack[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  useSheetOpen(visible);

  // Pull the top of the sheet down to close it. The grabber has to DO
  // something: the owner reported pulling the card down and the app going
  // nowhere (03.08). Only the header block claims the gesture — the list
  // below it has to keep scrolling.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => { if (g.dy > 0) y.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 90 || g.vy > 0.7) closeRef.current();
      else Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
    onPanResponderTerminationRequest: () => false,
  }), [y]);

  const playlistId = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(contextUri ?? '')?.[1] ?? null;

  useEffect(() => {
    if (!visible || !playlistId) return;
    let live = true;
    setTracks(null);
    setTrouble(null);
    setDetail(null);
    setChecks(null);
    setQueue(null);
    getPlaylistTracks(playlistId)
      .then((r) => {
        if (!live) return;
        if (r.ok) { setTracks(r.tracks); }
        else {
          setTrouble(r.reason);
          setDetail(r.detail ?? null);
          getPlaybackQueue().then((q) => { if (live && q?.length) setQueue(q); }).catch(() => {});
        }
      })
      .catch(() => { if (live) setTrouble('error'); });
    return () => { live = false; };
  }, [visible, playlistId, attempt]);

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

  /**
   * Re-run the Spotify sign-in from right here. The permission Cruise FM asks
   * for is granted at sign-in, so a connection made before it was added keeps
   * being refused however many times you retry — reconnecting is the only
   * thing that changes the answer, and it should not mean hunting for it on
   * the home page mid-drive. The music is Spotify's, not ours, so it carries
   * on playing throughout.
   */
  const reconnect = async () => {
    if (linking) return;
    setLinking(true);
    try {
      const ok = await connectSpotify();
      if (ok) { setTrouble(null); setAttempt((a) => a + 1); }
    } catch {
      /* the sheet already says what is wrong; leave it saying so */
    } finally {
      setLinking(false);
    }
  };

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
        <View {...drag.panHandlers}>
        <View style={s.grabZone}><View style={s.handle} /></View>

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
        </View>

        <ScrollView style={{ maxHeight: winH * 0.46 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {!playlistId && (
            <Text style={s.empty}>
              Songs show up here once Spotify is playing one of your playlists.
            </Text>
          )}
          {playlistId && tracks === null && !trouble && (
            <View style={s.loading}><ActivityIndicator color="rgba(255,255,255,0.6)" /></View>
          )}
          {/* Spotify closes a playlist's contents to us but still answers
              for the player's queue, so what's coming up stands in. Labelled
              honestly — this is the queue, not the playlist. */}
          {playlistId && !!trouble && !!queue?.length && (
            <View style={s.queueHead}>
              <Text style={s.queueTitle}>Coming up</Text>
              <Text style={s.queueNote}>
                Spotify won’t share the full playlist, but these are queued next.
              </Text>
            </View>
          )}
          {playlistId && !!trouble && queue?.map((t, i) => (
            <TouchableOpacity
              key={t.uri + i} style={s.row} activeOpacity={0.75}
              onPress={() => jump(t)}>
              <View style={s.numWrap}><Text style={s.num}>{i + 1}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.song} numberOfLines={1}>{t.title}</Text>
                <Text style={s.artist} numberOfLines={1}>{t.artist}</Text>
              </View>
              {busy === t.uri
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                : <Text style={s.dur}>{fmt(t.durationMs)}</Text>}
            </TouchableOpacity>
          ))}
          {playlistId && !!trouble && (
            <View style={s.troubleWrap}>
              {!queue?.length && <Text style={s.empty}>{TROUBLE[trouble].text}</Text>}
              {!!detail && !queue?.length && <Text style={s.detail}>Spotify said: “{detail}”</Text>}

              {/* The refusal alone doesn't say WHY, and "Forbidden" says even
                  less. This asks Spotify the same question four ways and
                  prints each answer, so one screenshot settles it. */}
              {!checks && (
                <TouchableOpacity
                  onPress={async () => {
                    if (checking) return;
                    setChecking(true);
                    try { setChecks(await diagnoseSpotify(playlistId)); }
                    catch { setChecks(['The check itself could not run.']); }
                    finally { setChecking(false); }
                  }}
                  style={s.ghostBtn} activeOpacity={0.85}>
                  <Text style={s.ghostBtnText}>
                    {checking ? 'Checking…' : 'Run a quick check'}
                  </Text>
                </TouchableOpacity>
              )}
              {!!checks && (
                <View style={s.checks}>
                  {checks.map((line) => (
                    <Text key={line} style={s.checkLine}>{line}</Text>
                  ))}
                  <Text style={s.checkHint}>Screenshot this and send it over.</Text>
                </View>
              )}
              {TROUBLE[trouble].retry && (
                <TouchableOpacity onPress={() => setAttempt((a) => a + 1)} style={s.retry} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={14} color="#0a0a10" />
                  <Text style={s.retryText}>Try again</Text>
                </TouchableOpacity>
              )}
              {TROUBLE[trouble].reconnect && (
                <TouchableOpacity onPress={reconnect} disabled={linking} style={[s.retry, linking && s.retryBusy]} activeOpacity={0.8}>
                  {linking
                    ? <ActivityIndicator size="small" color="#0a0a10" />
                    : <Ionicons name="link" size={14} color="#0a0a10" />}
                  <Text style={s.retryText}>Reconnect Spotify</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {playlistId && !trouble && tracks?.length === 0 && (
            <Text style={s.empty}>There are no playable songs in this playlist.</Text>
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
  // The grabber is 4px tall and nobody can grab 4px — the zone around it is
  // what the finger actually lands on.
  grabZone: { paddingTop: 2, paddingBottom: 12, alignItems: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
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
  troubleWrap: { alignItems: 'flex-start', paddingBottom: 10 },
  // Spotify's own message, verbatim. Small, quiet, and the thing worth
  // screenshotting when something here needs explaining.
  queueHead: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 12 },
  queueTitle: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  queueNote: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 17, paddingTop: 4 },
  ghostBtn: {
    alignSelf: 'flex-start', marginTop: 4, marginBottom: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  ghostBtnText: { color: 'rgba(255,255,255,0.82)', fontSize: 13.5, fontWeight: '700' },
  checks: {
    alignSelf: 'stretch', marginBottom: 14, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  checkLine: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 19, fontFamily: Fonts.mono },
  checkHint: { color: 'rgba(255,255,255,0.38)', fontSize: 11.5, paddingTop: 8, fontStyle: 'italic' },
  detail: {
    color: 'rgba(255,255,255,0.34)', fontSize: 11.5, lineHeight: 16,
    paddingHorizontal: 6, paddingBottom: 14, fontStyle: 'italic',
  },
  retry: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginLeft: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, backgroundColor: '#fff',
  },
  retryBusy: { opacity: 0.7 },
  retryText: { color: '#0a0a10', fontSize: 13, fontWeight: '800' },
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
