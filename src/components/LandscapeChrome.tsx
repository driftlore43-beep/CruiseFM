import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModeActionRow } from '@/components/ModeActionRow';
import { useDaylight } from '@/context/MotionContext';
import { SeekBar } from '@/components/SeekBar';
import { StationBackdrop } from '@/components/StationBackdrop';
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

/** `useLayoutEffect` on device, plain `useEffect` under the web build's
 *  server render (where there is no layout phase and React warns). Anything
 *  that resets the deck on a turn must use this — see the note on the effect
 *  inside useChromeFade. */
export const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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

  /** `arriving` = the phone has just been turned into landscape (or a mode
   *  opened already sideways), as opposed to a tap waking a rested deck. The
   *  dock then slides in from off-screen just AFTER the rotation settles, so
   *  the deck reads as arriving with the turn instead of appearing fully
   *  formed the instant the screen flips. */
  const wake = useCallback((arriving = false) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setRested(false);
    // A shade slower than the old 170ms opacity pop: the panel now TRAVELS
    // in, and arriving instantly reads as teleporting.
    Animated.timing(chrome, {
      toValue: 1,
      duration: arriving ? 340 : 260,
      // iOS takes about 400ms to turn the screen. Waiting a beat means the
      // slide plays on a settled screen rather than racing the rotation.
      delay: arriving ? 160 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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

  // Distinguishes "just turned sideways" from "playback state changed while
  // already sideways" — this effect re-runs for both, and only the first
  // should replay the dock's arrival.
  const wasActive = useRef(false);

  // LAYOUT effect, not a plain one. The turn re-renders the scene as
  // landscape while `chrome` is still parked at 1 from portrait, so for one
  // frame the deck glide would already be applied — the scene flashing
  // small-and-shifted before this hook resets it to 0 and slides it in. A
  // layout effect lands the reset in the same frame, so the arrival starts
  // from a clean full-size scene every time. (`window` is defined in React
  // Native; the fallback is only for the web build's server render, which
  // has no layout phase to be early for.)
  useIsoLayoutEffect(() => {
    if (!active) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setRested(false);
      // Portrait parks it at 1 so nothing downstream sees a half-docked value.
      chrome.setValue(1);
      wasActive.current = false;
      return;
    }
    const arriving = !wasActive.current;
    wasActive.current = true;
    // Start the dock off-screen so it slides in rather than blinking on.
    if (arriving) chrome.setValue(0);
    wake(arriving);
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
 *
 * `active` (portrait = false) FLATTENS the glide to an identity transform
 * instead of the caller dropping the style. That difference is the whole
 * reason the flag exists, and it was a real bug (owner, 30.07: the record
 * left half off the screen in portrait after a turn). A native-driven
 * transform lives on the native view; removing it from the style prop sends
 * no transform at all, so the view simply KEEPS the last one it was given —
 * the scene stayed shrunk and pushed left forever. Always render the style;
 * never write `isLandscape ? deckScene : null` again.
 */
export function useDeckScene(chrome: Animated.Value, winW: number, scale = 0.86, active = true) {
  return useMemo(() => ({
    transform: [
      { translateX: chrome.interpolate({ inputRange: [0, 1], outputRange: [0, active ? -winW * DECK_FRAC * 0.5 : 0] }) },
      { scale: chrome.interpolate({ inputRange: [0, 1], outputRange: [1, active ? scale : 1] }) },
    ],
  }), [chrome, winW, scale, active]);
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
  const day = useDaylight();
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
        {/* The panel wears the STATION, not a fixed navy slab (owner, 30.07)
            — the same blurred photograph as the scene, so the deck belongs to
            the mood it's controlling. Custom stations have no photo and fall
            through to their own palette gradient inside StationBackdrop.
            A scrim over it keeps the type legible: deepest on the left where
            the panel meets the scene, so the join reads as a soft edge rather
            than a cut. */}
        <StationBackdrop station={station} blurRadius={3} />
        <LinearGradient
          colors={day
            ? ['rgba(3,4,10,0.985)', 'rgba(4,5,12,0.95)', 'rgba(3,4,10,0.98)']
            : ['rgba(6,7,14,0.94)', 'rgba(8,9,16,0.80)', 'rgba(6,7,14,0.90)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[st.panelInner, { paddingRight: sideR, paddingTop: top + 8, paddingBottom: bottom + 6 }]}>
          <StationIdentity station={station} align="left" compact />

          <View style={{ flex: 1 }} />

          <View>
            <Text style={st.title} numberOfLines={1}>{track?.title ?? tagline}</Text>
            {!!track && <Text style={[st.artist, day && { color: 'rgba(255,255,255,0.92)' }]} numberOfLines={1}>{track.artist}</Text>}
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
    // Clips the station photo to the panel.
    overflow: 'hidden',
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
