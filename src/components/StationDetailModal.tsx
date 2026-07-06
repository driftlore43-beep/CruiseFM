import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ImageBackground,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { type Station } from '@/constants/stations';
import { Cruise } from '@/constants/theme';
import { GlossSheen } from '@/components/GlossSheen';
import { useTheme } from '@/context/ThemeContext';
import { isSpotifyConnected, getUserPlaylists } from '@/utils/spotify';
import {
  getStationPlaylist,
  setStationPlaylist,
  type LinkedPlaylist,
} from '@/utils/stationPlaylists';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SPOTIFY_GREEN = '#1DB954';

/** Darken a hex colour toward black by `amount` (0–1) — used to build a
 * two-stop gradient from the user's chosen accent colour, whatever it is. */
function darken(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

type Mode = { id: string; label: string; pro: boolean };

const MODES: Mode[] = [
  { id: 'cassette',  label: 'Cassette',    pro: false },
  { id: 'equalizer', label: 'Equalizer',   pro: false },
  { id: 'vinyl',     label: 'Vinyl',       pro: true  },
  { id: 'radio',     label: 'Retro Radio', pro: true  },
  { id: 'ipod',      label: 'iPod',        pro: true  },
  { id: 'waves',     label: 'Sound Waves', pro: false },
  { id: 'orb',       label: 'Circular EQ', pro: true  },
];

type Props = {
  station: Station | null;
  visible: boolean;
  onClose: () => void;
  onStartDrive: (mode: string) => void;
  isPro: boolean;
};

export function StationDetailModal({ station, visible, onClose, onStartDrive, isPro }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [selectedMode, setSelectedMode] = useState('cassette');
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedMode('cassette');
      if (station) getStationPlaylist(station.id).then(setLinked);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
    }
  }, [visible, station?.id]);

  const dismissPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) handleClose();
        else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  function handleClose() {
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 300, useNativeDriver: true }).start(onClose);
  }

  function handleStartDrive() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartDrive(selectedMode);
  }

  if (!station) return null;

  const topPad = insets.top + 12;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.root, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        {/* Full-bleed blurred station image — fills the entire background */}
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={3.5}
          resizeMode="cover"
        />
        {/* Smooth multi-stop fade: clear scene up top, melts into dark
            behind the controls — no visible seam anywhere. */}
        <LinearGradient
          colors={[
            'rgba(2,2,12,0.25)',
            'rgba(2,2,12,0.10)',
            'rgba(2,2,12,0.32)',
            'rgba(2,2,12,0.48)',
            'rgba(2,2,12,0.60)',
          ]}
          locations={[0, 0.35, 0.62, 0.84, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.dragPill, { top: topPad - 8 }]}>
          <View style={styles.pillBar} />
        </View>
        <Pressable style={[styles.closeBtn, { top: topPad }]} onPress={handleClose} hitSlop={12}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>

          {/* Push the title block just below the hero image */}
          <View style={{ flex: 1, minHeight: SCREEN_H * 0.50 }} />

          <Text style={styles.stationName}>{station.name}</Text>
          <Text style={styles.stationTagline}>{station.tagline}</Text>

          {/* Add your playlist */}
          <Pressable
            style={({ pressed }) => [styles.playlistBtn, pressed && { opacity: 0.85 }]}
            onPress={() => setShowPicker(true)}>
            <Text style={styles.playlistBtnIcon}>♫</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.playlistBtnText}>
                {linked ? linked.name : 'Add your playlist'}
              </Text>
              <Text style={styles.playlistBtnSub}>
                {linked ? 'Tap to change' : 'Drop in your own Spotify playlist'}
              </Text>
            </View>
            <Text style={styles.playlistBtnArrow}>{linked ? '✎' : '＋'}</Text>
          </Pressable>

          {/* Mode picker */}
          <Text style={styles.sectionLabel}>VISUAL MODE</Text>
          <View style={styles.modeGrid}>
            {MODES.map((mode) => {
              const unlocked = isPro || !mode.pro;
              const active = selectedMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  style={[
                    styles.modeBtn,
                    active && { backgroundColor: theme.accentColor + '40', borderColor: theme.accentColor },
                    !unlocked && styles.modeBtnLocked,
                  ]}
                  onPress={() => unlocked && setSelectedMode(mode.id)}>
                  {mode.pro && <GlossSheen />}
                  <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{mode.label}</Text>
                  {!unlocked && <Text style={styles.modeLockIcon}>🔒</Text>}
                  {mode.pro && unlocked && (
                    <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Start Drive */}
          <Pressable
            style={({ pressed }) => [styles.startBtn, { shadowColor: theme.accentColor }, pressed && { opacity: 0.9 }]}
            onPress={handleStartDrive}>
            <LinearGradient
              colors={[theme.accentColor, darken(theme.accentColor, 0.35)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.startGradient}>
              <Text style={styles.startBtnText}>Start Drive</Text>
              <Text style={styles.startBtnArrow}>→</Text>
            </LinearGradient>
          </Pressable>

        </ScrollView>

        {showPicker && (
          <PlaylistPicker
            stationName={station.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(station.id, pl);
              setLinked(pl);
              setShowPicker(false);
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Playlist picker sheet ─────────────────────────────────────────────────────
function PlaylistPicker({
  stationName,
  current,
  onClose,
  onPick,
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
    <View style={styles.pickerBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pickerHandle} />
        <Text style={styles.pickerTitle}>Add a playlist</Text>
        <Text style={styles.pickerSub}>for {stationName}</Text>

        {loading ? (
          <ActivityIndicator color={SPOTIFY_GREEN} style={{ marginVertical: 32 }} />
        ) : !connected ? (
          <Text style={styles.pickerEmpty}>
            Connect Spotify in Profile → Settings to add your own playlists.
          </Text>
        ) : playlists.length === 0 ? (
          <Text style={styles.pickerEmpty}>No playlists found in your Spotify library.</Text>
        ) : (
          <ScrollView style={{ maxHeight: SCREEN_H * 0.5 }} showsVerticalScrollIndicator={false}>
            {playlists.map((pl) => {
              const active = current?.uri === pl.uri;
              return (
                <Pressable
                  key={pl.uri}
                  style={[styles.pickerRow, active && styles.pickerRowActive]}
                  onPress={() => onPick(pl)}>
                  <Text style={[styles.pickerRowText, active && { color: SPOTIFY_GREEN }]} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  {active && <Text style={styles.pickerCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02020c' },
  dragPill: { position: 'absolute', alignSelf: 'center', zIndex: 10, alignItems: 'center' },
  pillBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  closeBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 24 },

  stationName: {
    color: '#fff', fontSize: 40, fontWeight: '800',
    letterSpacing: -0.5, marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12,
  },
  stationTagline: {
    color: 'rgba(255,255,255,0.75)', fontSize: 15,
    lineHeight: 21, marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8,
  },

  playlistBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)',
    marginBottom: 26,
  },
  playlistBtnIcon: { fontSize: 20, color: SPOTIFY_GREEN, width: 24, textAlign: 'center' },
  playlistBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  playlistBtnSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  playlistBtnArrow: { color: SPOTIFY_GREEN, fontSize: 18, fontWeight: '700' },

  sectionLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700',
    letterSpacing: 2, marginBottom: 12,
  },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  modeBtn: {
    width: (SCREEN_W - 48 - 10) / 2,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    overflow: 'hidden',
  },
  modeBtnLocked: { opacity: 0.5 },
  modeLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '700' },
  modeLabelActive: { color: '#fff' },
  modeLockIcon: { fontSize: 12 },
  proBadge: {
    backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)',
  },
  proBadgeText: { color: '#D4AF37', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  startBtn: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: Cruise.violet, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  startGradient: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 18, gap: 10,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  startBtnArrow: { color: 'rgba(255,255,255,0.8)', fontSize: 18 },

  // Playlist picker
  pickerBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Cruise.midnight,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 14,
  },
  pickerTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
  pickerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2, marginBottom: 14 },
  pickerEmpty: {
    color: 'rgba(255,255,255,0.55)', fontSize: 14,
    lineHeight: 20, textAlign: 'center', marginVertical: 28, paddingHorizontal: 16,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pickerRowActive: { backgroundColor: 'rgba(29,185,84,0.12)', borderWidth: 1, borderColor: 'rgba(29,185,84,0.4)' },
  pickerRowText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', flex: 1 },
  pickerCheck: { color: SPOTIFY_GREEN, fontSize: 15, fontWeight: '800', marginLeft: 8 },
});
