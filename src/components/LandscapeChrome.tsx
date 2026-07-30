import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModeActionRow } from '@/components/ModeActionRow';
import { SeekBar } from '@/components/SeekBar';
import { StationIdentity, stationDisplayName } from '@/components/StationIdentity';
import type { Station } from '@/constants/stations';
import type { NowPlaying } from '@/utils/useMusicPlayback';
import type { ScrubApi } from '@/utils/useTrackClock';

/**
 * The landscape DECK — the owner's pick after living with the first grammar
 * on device (30.07, "Option C"): awake, a head-unit control panel docks on
 * the right and the scene sits clear of every control in the left pane;
 * after a few untouched seconds of playback the panel glides off the right
 * edge and the scene glides to centre stage at full size. One tap anywhere
 * brings the panel back to the same fixed spot — a driver's hand always
 * finds the controls where it left them.
 *
 * This replaced the bottom-strip layout (title/seek/transport along the
 * bottom): its rest state inherited the awake spacing, so the object sat
 * high and small over dead space, and its seek bar was a full-screen-wide
 * reach. The deck fixes both.
 *
 * The fade machinery is unchanged (`useChromeFade`) — the same `chrome`
 * value that used to drive opacity now ALSO drives the panel's slide and
 * the scene's glide (`useDeckScene`), so awake/rest stays one timeline.
 */

/** Fraction of the screen the docked panel occupies. */
export const DECK_FRAC = 0.40;

/** @deprecated The deck layout replaced the bottom strip; nothing should be
 *  spaced off this any more. Kept only so stale imports fail soft. */
export const LS_CHROME_CLEAR = 178;

// Same rest timing the Mirror Ball proved in portrait: long enough to read
// the song and reach skip, short enough that the drive is mostly pure scene.
const REST_MS = 6000;

export function useChromeFade({ active, playing, sheetOpen }: {
  /** Fade only runs while this is true (mode visible AND in landscape). */
  active: boolean;
  playing: boolean;
  /** A sheet on top means the user is mid-task — never rest under one. */
  sheetOpen: boolean;
}) {
  const chrome = useRef(new Animated.Value(1)).current;
  const [rested, setRested] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The wake is handed to a PanResponder capture callback that is created
  // once, so it must read the CURRENT gate through refs — a stale closure
  // here would rest the chrome from a paused drive's old state.
  const gate = useRef({ active, playing, sheetOpen });
  gate.current = { active, playing, sheetOpen };

  const wake = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setRested(false);
    // A shade slower than the old 170ms opacity pop: the panel now TRAVELS
    // in, and arriving instantly reads as teleporting.
    Animated.timing(chrome, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const g = gate.current;
    // Only rests during playback — hiding the play button from someone who
    // just paused is rude (the Mirror Ball lesson, verbatim).
    if (g.active && g.playing && !g.sheetOpen) {
      timer.current = setTimeout(() => {
        setRested(true);
        Animated.timing(chrome, {
          toValue: 0, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }).start();
      }, REST_MS);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setRested(false);
      chrome.setValue(1);
      return;
    }
    wake();
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [active, playing, sheetOpen, wake]);

  return { chrome, rested, wake };
}

/**
 * The scene's half of the dock: awake it glides left and shrinks to centre
 * itself in the pane beside the panel; at rest it glides back to centre
 * stage at full size. Transform-only (native driver), so the scene never
 * re-lays-out — it moves as one piece.
 *
 * `scale` is per-mode: floating objects (ball, cassette, disc) take the
 * default; the Equalizer's full-width meter needs ~0.62 to fit the pane;
 * Horizon's full-bleed scene passes 1 and only slides (shrinking a
 * full-bleed scene would reveal its edges).
 */
export function useDeckScene(chrome: Animated.Value, winW: number, scale = 0.86) {
  return useMemo(() => ({
    transform: [
      { translateX: chrome.interpolate({ inputRange: [0, 1], outputRange: [0, -winW * DECK_FRAC * 0.5] }) },
      { scale: chrome.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
    ],
  }), [chrome, winW, scale]);
}

export function LandscapeChrome({
  chrome, rested, station, track, playing, tagline,
  progress, scrub, seekBar,
  onPlayPause, onPrev, onNext, onClose,
  onChangeMood, onPickPlaylist, playlistLabel,
}: {
  chrome: Animated.Value;
  rested: boolean;
  station: Station;
  track: NowPlaying | null;
  playing: boolean;
  /** Shown as the title when there is no live track — never a fake song. */
  tagline: string;
  progress?: Animated.Value;
  scrub?: ScrubApi;
  /** Vinyl predates the shared clock and carries its own scrub-capable bar —
   *  passing it here replaces the standard SeekBar outright. */
  seekBar?: React.ReactNode;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onChangeMood: () => void;
  onPickPlaylist: () => void;
  playlistLabel: string;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Landscape safe areas live on the SIDES (the notch), not the top.
  const sideL = Math.max(insets.left, 22);
  const sideR = Math.max(insets.right, 22);
  const top = Math.max(insets.top, 14);
  const bottom = Math.max(insets.bottom, 14);

  const panelW = Math.round(winW * DECK_FRAC);
  // +40 so the panel's shadow leaves with it.
  const slideX = chrome.interpolate({ inputRange: [0, 1], outputRange: [panelW + 40, 0] });

  return (
    <>
      {/* The rest-state whisper — fades IN exactly as the panel departs. */}
      <Animated.View
        pointerEvents="none"
        style={[st.whisperWrap, { bottom: bottom + 2, opacity: chrome.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Text style={st.whisper}>{stationDisplayName(station).toUpperCase()}</Text>
      </Animated.View>

      {/* The way out — top-left over the scene, resting with everything else. */}
      <Animated.View
        style={{ position: 'absolute', top, left: sideL, zIndex: 30, opacity: chrome }}
        pointerEvents={rested ? 'none' : 'auto'}>
        <Pressable onPress={onClose} hitSlop={14} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </Animated.View>

      {/* The docking panel. Slides, never fades — leaving the screen is its
          exit. pointerEvents goes off once rested so the first tap anywhere
          only wakes it. */}
      <Animated.View
        pointerEvents={rested ? 'none' : 'auto'}
        style={[st.panel, { width: panelW, transform: [{ translateX: slideX }] }]}>
        <LinearGradient
          colors={['rgba(23,24,38,0.96)', 'rgba(11,11,19,0.98)']}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[st.panelInner, { paddingRight: sideR, paddingTop: top + 8, paddingBottom: bottom + 6 }]}>
          <StationIdentity station={station} align="left" compact />

          <View style={{ flex: 1 }} />

          <View>
            <Text style={st.title} numberOfLines={1}>{track?.title ?? tagline}</Text>
            {!!track && <Text style={st.artist} numberOfLines={1}>{track.artist}</Text>}
          </View>

          {seekBar !== undefined
            ? <View style={st.seekWrap}>{seekBar}</View>
            : !!track && progress && scrub && (
              <View style={st.seekWrap}>
                <SeekBar progress={progress} scrub={scrub} />
              </View>
            )}

          <View style={st.transport}>
            <TouchableOpacity onPress={onPrev} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="skip-previous" size={36} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onPlayPause} style={st.playBtn} activeOpacity={0.9}>
              {playing ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={st.pauseBar} />
                  <View style={st.pauseBar} />
                </View>
              ) : (
                <MaterialCommunityIcons name="play" size={32} color="#0a0a12" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="skip-next" size={36} color="#fff" />
            </TouchableOpacity>
          </View>

          <ModeActionRow
            onChangeMood={onChangeMood}
            onPickPlaylist={onPickPlaylist}
            playlistLabel={playlistLabel}
            track={track}
            station={station}
            style={st.pillsOverride}
          />
        </View>
      </Animated.View>
    </>
  );
}

const st = StyleSheet.create({
  whisperWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  whisper: { color: 'rgba(255,255,255,0.26)', fontSize: 10, fontWeight: '700', letterSpacing: 3 },

  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },

  panel: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 16,
  },
  panelInner: { flex: 1, paddingLeft: 24 },

  title: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, fontWeight: '500', marginTop: 2 },
  seekWrap: { marginTop: 10 },

  transport: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 26, marginTop: 8, marginBottom: 14,
  },
  playBtn: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  pauseBar: { width: 7, height: 24, borderRadius: 2, backgroundColor: '#0a0a12' },

  // ModeActionRow's own styles carry portrait spacing — zeroed for the panel.
  pillsOverride: { marginTop: 0, paddingHorizontal: 0, alignSelf: 'stretch', justifyContent: 'center' },
});
