import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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

import { stationDial, type Station } from '@/constants/stations';
import { useDsegFonts } from '@/components/StationIdentity';
import { isCustomStation, type CustomStation } from '@/utils/customStations';
import { Cruise } from '@/constants/theme';
import { GlossSheen } from '@/components/GlossSheen';
import { StationBackdrop } from '@/components/StationBackdrop';
import { useTheme } from '@/context/ThemeContext';
import { useMotion } from '@/context/MotionContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { appleMusicAvailable, isApplePlaylist } from '@/utils/appleMusic';
import { getSavedPlatform } from '@/utils/musicPlatform';
import {
  getStationPlaylist,
  setStationPlaylist,
  type LinkedPlaylist,
} from '@/utils/stationPlaylists';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const APPLE_MUSIC_RED = '#FA243C';
const SPOTIFY_GREEN = '#1DB954';

/**
 * The playlist card wears the platform's own mark — ALL of it, not just the
 * little note icon (owner, 04.08: "I still haven't got the Apple Music colour
 * on the playlists, they're still green"). A green card on an Apple Music
 * drive says Spotify at a glance, which is exactly the confusion that has her
 * linking the wrong thing.
 *
 * TRAP found fixing this: `styles.playlistBtnIcon` carried `color`, and
 * react-native-vector-icons applies `style` AFTER the `color` prop — so a
 * per-platform colour passed as a prop was being silently overridden by the
 * stylesheet. Colour for these icons must come from the style, or from a
 * style with no competing colour in it.
 */
const PLATFORM_TINT = {
  apple: {
    solid: APPLE_MUSIC_RED,
    wash: 'rgba(250,36,60,0.12)',
    washHero: 'rgba(250,36,60,0.30)',
    rim: 'rgba(250,36,60,0.40)',
    rimStrong: 'rgba(250,36,60,0.50)',
  },
  spotify: {
    solid: SPOTIFY_GREEN,
    wash: 'rgba(29,185,84,0.12)',
    washHero: 'rgba(29,185,84,0.30)',
    rim: 'rgba(29,185,84,0.40)',
    rimStrong: 'rgba(29,185,84,0.50)',
  },
};

/** Darken a hex colour toward black by `amount` (0–1) — used to build a
 * two-stop gradient from the user's chosen accent colour, whatever it is. */
function darken(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

import { MODE_CATALOG as MODES } from '@/constants/modeCatalog';

type Props = {
  station: Station | CustomStation | null;
  visible: boolean;
  onClose: () => void;
  onStartDrive: (mode: string, preview: boolean) => void;
  isPro: boolean;
  /** Custom stations only — owner powers behind the corner menu. */
  onEdit?: () => void;
  onDelete?: () => void;
};

export function StationDetailModal({ station, visible, onClose, onStartDrive, isPro, onEdit, onDelete }: Props) {
  const { seg7: dseg, seg14 } = useDsegFonts();
  // The modal renders with station null while closed.
  const dial = station ? stationDial(station.id, !!station.premium) : { band: 'AM' as const, label: '', value: 0 };
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { dataSaver } = useMotion();
  const { relinkStationPlaylist } = useNowPlaying();
  // The station page pushes in from the RIGHT, like turning to a page rather
  // than pulling up a sheet. slideY stays because the downward pull-to-dismiss
  // is muscle memory and the drag pill at the top still promises it.
  const slideX = useRef(new Animated.Value(SCREEN_W)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const [selectedMode, setSelectedMode] = useState('cassette');
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [linkToast, setLinkToast] = useState<string | null>(null);
  const [spotifyPlatform, setSpotifyPlatform] = useState(true);
  const [applePlatform, setApplePlatform] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedMode('cassette');
      setShowMenu(false);
      setConfirmDelete(false);
      if (station) getStationPlaylist(station.id).then(setLinked);
      getSavedPlatform().then((p) => {
        setSpotifyPlatform(p === 'spotify' || p == null);
        setApplePlatform(p === 'appleMusic');
      });
      slideY.setValue(0);
      slideX.setValue(SCREEN_W);
      // Timing rather than a spring: a page push wants to arrive and stop, not
      // wobble at the end.
      Animated.timing(slideX, {
        toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    }
  }, [visible, station?.id]);

  // Two ways out, each leaving the way it would have come in: swipe back from
  // the left edge and it slides off to the right, pull down and it drops.
  // Claiming on MOVE, never on start — capture-on-start is what killed the
  // back button on the settings pages.
  const swipeAxis = useRef<'x' | 'y' | null>(null);
  const closeRef = useRef<(down?: boolean) => void>(() => {});
  const dismissPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx)) return true;
        // Edge-only, or a rightward drag would fight the horizontal mode strip.
        return g.x0 < 44 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
      },
      onPanResponderGrant: () => { swipeAxis.current = null; },
      onPanResponderMove: (_, g) => {
        if (!swipeAxis.current) swipeAxis.current = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
        if (swipeAxis.current === 'x') { if (g.dx > 0) slideX.setValue(g.dx); }
        else if (g.dy > 0) slideY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        const axis = swipeAxis.current;
        swipeAxis.current = null;
        if (axis === 'x') {
          if (g.dx > SCREEN_W * 0.3 || g.vx > 0.7) closeRef.current(false);
          else Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
          return;
        }
        if (g.dy > 120 || g.vy > 0.8) closeRef.current(true);
        else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        swipeAxis.current = null;
        Animated.spring(slideX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  /** `down` sends it out of the bottom; everything else slides it off right. */
  function handleClose(down = false) {
    const [value, target] = down ? [slideY, SCREEN_H] : [slideX, SCREEN_W];
    Animated.timing(value, {
      toValue: target, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(onClose);
  }
  // The pan responder is built once, so it reaches handleClose through a ref
  // rather than closing over the first render's copy.
  closeRef.current = handleClose;

  const selectedIsLocked = !isPro && !!MODES.find((m) => m.id === selectedMode)?.pro;

  function handleStartDrive() {
    // Strict rule: no playlist, no drive. Starting anyway used to inherit
    // whatever Spotify was already playing, which made stations feel broken.
    // Instead the button routes straight into the playlist picker.
    if (needsPlaylist) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowPicker(true);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Locked mode selected? Launch it anyway as a free preview.
    onStartDrive(selectedMode, selectedIsLocked);
  }

  if (!station) return null;

  // The sheet's accent follows the station's own mood (its mid EQ colour —
  // the same hue the Tuner and cards use), not the app's fixed violet, so the
  // Visual Mode chips and Start Drive button match the station you're opening.
  // A station the user made stores its chosen colour on `color` and reaches
  // this sheet RAW — customToStation (which fills in eqColors) only runs when
  // a mode resolves it. Without the `color` fallback every custom station's
  // chips and Start Drive button came out the app's default violet instead of
  // the colour the user picked.
  const stationAccent =
    (station as Station).eqColors?.[1]
    ?? (station as CustomStation).color
    ?? theme.accentColor;

  // Floored, like every mode's header. Identical on any notched phone; it only
  // bites if the inset ever reads zero inside the Modal, which is exactly how
  // the settings header ended up alongside the clock (09.08).
  const topPad = Math.max(insets.top, 20) + 12;
  // NOT `!station.image` — see isCustomStation. Custom stations can have a
  // photo since 10.08, and that shortcut hid the ⋯ menu the moment one did.
  const isCustom = isCustomStation(station);
  const custom = isCustom ? (station as CustomStation) : null;
  // Every station — built-in or custom — needs its own playlist before a
  // drive makes sound. The glowing playlist button + quiet Start Drive make
  // that the obvious first step. Spotify people only: YouTube Music / Apple
  // Music / other listeners run music in their own app, so Cruise FM is the
  // visual companion and Start Drive always proceeds.
  // Apple Music listeners get the same strict rule, but ONLY on builds that
  // can actually play in-app — without MusicKit they're a visual-companion
  // listener like any other, and gating them would block a drive we could
  // have shown them.
  /**
   * A playlist saved for the OTHER platform is not a linked playlist.
   *
   * The station kept showing a Spotify list while the listener was on Apple
   * Music (owner, 04.08) — it looked linked, Start Drive went ahead, and
   * playStationMusic then refused it because an Apple player cannot open a
   * Spotify uri. Judge it the way playback does, so the card and the drive
   * agree: a link only counts if it belongs to the platform in use.
   */
  const appleActive = applePlatform && appleMusicAvailable();
  const linkUsable = !!linked && (appleActive ? isApplePlaylist(linked.uri) : !isApplePlaylist(linked.uri));
  const needsPlaylist = !linkUsable && (spotifyPlatform || appleActive);
  const tint = appleActive ? PLATFORM_TINT.apple : PLATFORM_TINT.spotify;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => handleClose()}>
      <Animated.View
        style={[styles.root, { transform: [{ translateX: slideX }, { translateY: slideY }] }]}
        {...dismissPan.panHandlers}>

        {/* Full-bleed blurred station background — motion is a Premium unlock */}
        <StationBackdrop station={station as Station} blurRadius={1.5} motionAllowed={isPro && !dataSaver} />
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

        {/* Now that the page slides in from the right it needs the control that
            goes with that: a back arrow where every pushed page keeps one. The
            sheet had no visible way out at all before — only the gesture. */}
        <Pressable style={[styles.backBtn, { top: topPad }]} onPress={() => handleClose()} hitSlop={14}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.92)" />
        </Pressable>

        {/* Custom stations: their icon becomes the hero, glowing in their colour */}
        {custom && (
          <View style={[styles.customHero, { top: SCREEN_H * 0.16 }]} pointerEvents="none">
            <View
              style={[
                styles.customHeroIcon,
                { backgroundColor: custom.iconBg, borderColor: custom.color, shadowColor: custom.color },
              ]}>
              {/^[a-z]/.test(custom.icon) ? (
                <MaterialCommunityIcons name={custom.icon as any} size={52} color="#fff" />
              ) : (
                <Text style={{ fontSize: 46 }}>{custom.icon}</Text>
              )}
            </View>
            <View style={[styles.mineBadge, { borderColor: custom.color + '88', backgroundColor: custom.color + '26' }]}>
              <Text style={[styles.mineBadgeText, { color: '#fff' }]}>MY STATION</Text>
            </View>
          </View>
        )}

        {/* Owner menu (custom stations only) */}
        {custom && (onEdit || onDelete) && (
          <Pressable
            style={[styles.menuBtn, { top: topPad }]}
            onPress={() => { setShowMenu((v) => !v); setConfirmDelete(false); }}
            hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        )}
        {showMenu && (
          <>
            <Pressable style={styles.menuBackdrop} onPress={() => { setShowMenu(false); setConfirmDelete(false); }} />
            <View style={[styles.menuSheet, { top: topPad + 42 }]}>
              {onEdit && (
                <Pressable style={styles.menuRow} onPress={() => { setShowMenu(false); onEdit(); }}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#fff" />
                  <Text style={styles.menuRowText}>Edit station</Text>
                </Pressable>
              )}
              {onEdit && onDelete && <View style={styles.menuDivider} />}
              {onDelete && (
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    if (!confirmDelete) { setConfirmDelete(true); return; }
                    setShowMenu(false);
                    onDelete();
                  }}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FF5C5C" />
                  <Text style={[styles.menuRowText, { color: '#FF5C5C' }]}>
                    {confirmDelete ? 'Tap again to delete' : 'Delete station'}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}>

          {/* Push the title block just below the hero image */}
          <View style={{ flex: 1, minHeight: SCREEN_H * 0.50 }} />

          {/* The dial position in the seven-segment face, above the title —
              the receiver identity, same as the Stations page. */}
          <Text style={[styles.dialLine, { fontFamily: dseg }]}>
            {dial.label}
            <Text style={[styles.dialBand, { fontFamily: seg14 }]}>  {dial.band}</Text>
          </Text>
          <Text style={styles.stationName}>{station.name}</Text>
          <Text style={styles.stationTagline}>{station.tagline}</Text>

          {/* Add your playlist */}
          <Pressable
            style={({ pressed }) => [
              styles.playlistBtn,
              { backgroundColor: tint.wash, borderColor: tint.rim },
              needsPlaylist && styles.playlistBtnHero,
              needsPlaylist && { backgroundColor: tint.washHero, borderColor: tint.solid, shadowColor: tint.solid },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setShowPicker(true)}>
            {/* Apple's mark is red, Spotify's green — showing the wrong one
                is half of why a stale link read as usable. */}
            <MaterialCommunityIcons
              name="music" size={20}
              style={[styles.playlistBtnIcon, { color: tint.solid }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.playlistBtnText}>
                {linkUsable ? linked!.name : 'Add your playlist'}
              </Text>
              <Text style={styles.playlistBtnSub}>
                {linkUsable
                  ? 'Tap to change'
                  : linked
                    // Saved for the other platform: say so, rather than
                    // silently showing a name that cannot play.
                    ? (appleActive
                        ? `“${linked.name}” is a Spotify playlist — pick an Apple Music one`
                        : `“${linked.name}” is an Apple Music playlist — pick a Spotify one`)
                    : needsPlaylist
                      ? 'Give your station its sound'
                      : appleActive
                        ? 'Drop in your own Apple Music playlist'
                        : 'Drop in your own Spotify playlist'}
              </Text>
            </View>
            <MaterialCommunityIcons name={linked ? 'pencil' : 'plus'} size={18} style={{ color: tint.solid }} />
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
                    active && { backgroundColor: stationAccent + '40', borderColor: stationAccent },
                    !unlocked && styles.modeBtnLocked,
                  ]}
                  onPress={() => setSelectedMode(mode.id)}>
                  {mode.pro && <GlossSheen />}
                  <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{mode.label}</Text>
                  {!unlocked && <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.7)" style={styles.modeLockIcon} />}
                  {mode.pro && unlocked && (
                    <View style={styles.proBadge}><Text style={styles.proBadgeText}>PREMIUM</Text></View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Start Drive */}
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              { shadowColor: needsPlaylist ? 'transparent' : stationAccent },
              needsPlaylist && styles.startBtnQuiet,
              pressed && { opacity: 0.9 },
            ]}
            onPress={handleStartDrive}>
            <LinearGradient
              colors={
                needsPlaylist
                  ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.09)']
                  : [stationAccent, darken(stationAccent, 0.35)]
              }
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.startGradient}>
              <Text style={styles.startBtnText}>
                {needsPlaylist
                  ? 'Add a Playlist to Start'
                  : selectedIsLocked
                    ? `Preview ${MODES.find((m) => m.id === selectedMode)?.label}`
                    : 'Start Drive'}
              </Text>
              <Ionicons name={needsPlaylist ? 'musical-notes' : 'arrow-forward'} size={18} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </Pressable>

        </ScrollView>

        {linkToast && (
          <View style={[styles.linkToast, { bottom: insets.bottom + 24, borderColor: tint.rimStrong }]} pointerEvents="none">
            <MaterialCommunityIcons name="check-circle" size={16} style={{ color: tint.solid }} />
            <Text style={styles.linkToastText} numberOfLines={1}>{linkToast}</Text>
          </View>
        )}

        {showPicker && (
          <PlaylistSheet
            stationName={station.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              const changed = linked?.uri !== pl.uri;
              await setStationPlaylist(station.id, pl);
              setLinked(pl);
              setShowPicker(false);
              if (changed) {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // If this station is the drive playing right now, switch to it
                // live; otherwise it's queued for the next Start Drive.
                relinkStationPlaylist(station.id);
                setLinkToast(`Playlist set: ${pl.name}`);
                setTimeout(() => setLinkToast(null), 2600);
              }
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#02020c' },
  dragPill: { position: 'absolute', alignSelf: 'center', zIndex: 10, alignItems: 'center' },
  pillBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  content: { paddingHorizontal: 24 },

  // ── Custom-station chrome ──
  customHero: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 14, zIndex: 5 },
  customHeroIcon: {
    width: 108, height: 108, borderRadius: 54,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 30, elevation: 14,
  },
  mineBadge: {
    borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1,
  },
  mineBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  backBtn: {
    position: 'absolute', left: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  // Right-hand side: the left slot belongs to the back button now.
  menuBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 },
  menuSheet: {
    position: 'absolute', right: 20, zIndex: 20,
    minWidth: 190, borderRadius: 14, paddingVertical: 4,
    backgroundColor: 'rgba(16,16,30,0.97)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 16,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  // 15/700, not 14/600 — owner, 10.08: the menu "should slightly have bolder
  // lettering, it's not as clear as I like". It sits on a small dark panel
  // over a photograph, which is the least forgiving place for thin type.
  menuRowText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 10 },
  playlistBtnHero: {
    paddingVertical: 20,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  startBtnQuiet: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  linkToast: {
    position: 'absolute', alignSelf: 'center', zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    maxWidth: '86%',
    backgroundColor: 'rgba(16,16,26,0.96)',
    borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 12,
  },
  linkToastText: { color: '#fff', fontSize: 13.5, fontWeight: '600', flexShrink: 1 },

  dialLine: { color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 10 },
  dialBand: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
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

  // Colours here are placeholders — the card is tinted per platform at the
  // call site (PLATFORM_TINT), which always wins over these.
  playlistBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16,
    borderWidth: 1,
    marginBottom: 26,
  },
  playlistBtnIcon: { fontSize: 20, width: 24, textAlign: 'center' },
  playlistBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  playlistBtnSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },

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
});
