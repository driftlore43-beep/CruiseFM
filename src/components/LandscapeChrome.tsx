import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModeActionRow } from '@/components/ModeActionRow';
import { SeekBar } from '@/components/SeekBar';
import { StationIdentity, stationDisplayName } from '@/components/StationIdentity';
import type { Station } from '@/constants/stations';
import type { NowPlaying } from '@/utils/useMusicPlayback';
import type { ScrubApi } from '@/utils/useTrackClock';

/**
 * The landscape overlay every mode shares — the owner's pick from the
 * L1/L2/L3 prototype round (30.07): "L1+L3 together, that fade feels right
 * for driving."
 *
 * L1 is the AWAKE state: the scene keeps the whole screen and the portrait
 * grammar redistributes along the bottom — song title bottom-left, pills
 * bottom-right, seek bar across, transport centred, station eyebrow top-left
 * beside a back chevron.
 *
 * L3 is the RESTING state: after a few untouched seconds of playback all of
 * it fades away and leaves the scene alone with a whisper of the station
 * name. Any touch brings it back. This is the Mirror Ball's portrait
 * chrome-fade generalised — in a car mount the mode is an artwork, not an app.
 *
 * The fade machinery lives in `useChromeFade` below; the mode owns the hook
 * (the wake must sit on the mode's ROOT view as a capture sniffer, where it
 * can see taps on the scene, the buttons and the empty dark alike) and this
 * component just renders whatever state it is handed. The Mirror Ball reuses
 * its own existing portrait machinery instead — same behaviour, one timer.
 */

/** How much vertical room the awake chrome needs. Scenes keep their object's
 *  centre above this so the fade never reveals something half-hidden. */
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
    Animated.timing(chrome, { toValue: 1, duration: 170, useNativeDriver: true }).start();
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

export function LandscapeChrome({
  chrome, rested, station, track, playing, tagline,
  progress, scrub,
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
  progress: Animated.Value;
  scrub: ScrubApi;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onChangeMood: () => void;
  onPickPlaylist: () => void;
  playlistLabel: string;
}) {
  const insets = useSafeAreaInsets();
  // Landscape safe areas live on the SIDES (the notch), not the top.
  const sideL = Math.max(insets.left, 24);
  const sideR = Math.max(insets.right, 24);
  const top = Math.max(insets.top, 14);
  const bottom = Math.max(insets.bottom, 16);

  return (
    <>
      {/* The L3 whisper — fades IN exactly as the chrome fades out, so the
          resting scene still says where you are, barely. */}
      <Animated.View
        pointerEvents="none"
        style={[st.whisperWrap, { bottom: bottom + 2, opacity: chrome.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Text style={st.whisper}>{stationDisplayName(station).toUpperCase()}</Text>
      </Animated.View>

      {/* Everything below rests together. pointerEvents goes off once it's
          invisible so the first tap only wakes it — you can't hit a skip
          button you can't see. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: chrome }]}
        pointerEvents={rested ? 'none' : 'box-none'}>

        {/* Top-left: the way out + the station identity, reading left-to-right
            the way the L1 mock drew it. */}
        <View style={[st.topRow, { top, left: sideL }]}>
          <Pressable onPress={onClose} hitSlop={14} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <StationIdentity station={station} align="left" compact />
        </View>

        {/* Bottom block: title + pills on one line, seek across, transport
            centred beneath. */}
        <View style={[st.foot, { left: sideL, right: sideR, bottom }]}>
          <View style={st.titleRow}>
            <View style={st.titleBlock}>
              <Text style={st.title} numberOfLines={1}>{track?.title ?? tagline}</Text>
              {!!track && <Text style={st.artist} numberOfLines={1}>{track.artist}</Text>}
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

          {!!track && (
            <View style={{ marginTop: 4 }}>
              <SeekBar progress={progress} scrub={scrub} />
            </View>
          )}

          <View style={st.transport}>
            <TouchableOpacity onPress={onPrev} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="skip-previous" size={38} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onPlayPause} style={st.playBtn} activeOpacity={0.9}>
              {playing ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={st.pauseBar} />
                  <View style={st.pauseBar} />
                </View>
              ) : (
                <MaterialCommunityIcons name="play" size={34} color="#0a0a12" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="skip-next" size={38} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const st = StyleSheet.create({
  whisperWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  whisper: { color: 'rgba(255,255,255,0.26)', fontSize: 10, fontWeight: '700', letterSpacing: 3 },

  topRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 20 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  eyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  station: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2, marginTop: 2 },

  foot: { position: 'absolute' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500', marginTop: 1 },
  // ModeActionRow's own styles carry portrait spacing (marginTop 26, side
  // padding 22, full-width stretch) — in this row it is one flex child among
  // two, so all of that gets zeroed here.
  pillsOverride: { marginTop: 0, paddingHorizontal: 0, alignSelf: 'auto', flexShrink: 0 },

  transport: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 30, marginTop: 6,
  },
  playBtn: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  pauseBar: { width: 7, height: 24, borderRadius: 2, backgroundColor: '#0a0a12' },
});
