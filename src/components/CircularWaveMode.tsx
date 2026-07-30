import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, ScrollView,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { LandscapeChrome, useChromeFade, useDeckScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { FloatingNotes } from '@/components/FloatingNotes';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useMusicPlayback } from '@/utils/useMusicPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { PreviewGate } from '@/components/PreviewGate';
import { WakeSpotifyHint } from '@/components/WakeSpotifyHint';
import { AmbientGlow } from '@/components/AmbientGlow';
import { ModeActionRow } from '@/components/ModeActionRow';
import { ModeCloseButton } from '@/components/ModeCloseButton';
import { MarqueeText } from '@/components/MarqueeText';
import { SeekBar } from '@/components/SeekBar';

const SCREEN_H = Dimensions.get('window').height;

// Ring geometry (SVG viewBox units)
const VB = 300;
const CX = VB / 2;
const CY = VB / 2;
const R0 = 102;         // hollow ring radius — the bars' base circle
const MAXLEN = 40;      // outward EQ bar length at full burst
const MINLEN = 3;       // resting bars read as chunky dots
const NBARS = 64;

const DEMO_DURATION_MS = 214000; // 3:34

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Radial spectrum value for a given angle+phase (0..~1.1).
function spectrum(a: number, phase: number): number {
  return (
    0.5 +
    0.28 * Math.sin(3 * a + phase) +
    0.20 * Math.sin(7 * a - phase * 1.3) +
    0.12 * Math.sin(13 * a + phase * 0.6)
  );
}

// All outward bars as one path. Peaks are sharpened so the ring reads as
// resting dots with wave bursts sweeping around it (reference-clip look).
function ringBars(phase: number, amp: number): string {
  let d = '';
  for (let i = 0; i < NBARS; i++) {
    const a = (i / NBARS) * Math.PI * 2;
    const burst = Math.pow(Math.max(0, spectrum(a, phase)), 2.6);
    const len = MINLEN + MAXLEN * amp * burst;
    const c = Math.cos(a), s = Math.sin(a);
    d += `M${(CX + R0 * c).toFixed(1)} ${(CY + R0 * s).toFixed(1)}L${(CX + (R0 + len) * c).toFixed(1)} ${(CY + (R0 + len) * s).toFixed(1)}`;
  }
  return d;
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function CircularWaveFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);
  const eq = station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF'];

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  const [phase, setPhase] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const { progress, elapsedMs, durationMs, scrub } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });
  const playingRef = useRef(false);
  const ampRef = useRef(0.55);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  // Landscape rest-and-wake (L3) — the shared machinery from LandscapeChrome.
  const { chrome, rested: chromeRested, wake: wakeChrome } = useChromeFade({
    active: visible && isLandscape, playing, sheetOpen: showMood || showPicker,
  });
  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);

  // Orb animation loop — throttled to ~15fps — each tick re-renders the whole SVG scene on the CPU, and 25fps measured 53-59% sustained CPU (iOS resource reports, 24.07); 15fps looks identical for these slow drifts and halves the burn.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 66) {
        last = now;
        const target = playingRef.current ? 1 : 0.55;
        ampRef.current += (target - ampRef.current) * 0.08;
        // Battery: once paused and fully wound down, freeze the scene —
        // zero re-renders until play flips it live again.
        if (playingRef.current || Math.abs(ampRef.current - target) > 0.01) {
          setPhase(((now - start) / 1000) * 1.5);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Progress is driven by useTrackClock — real Spotify position when
  // connected, demo loop otherwise.

  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveId(stationId);
    slideY.setValue(winH);
    ampRef.current = playingRef.current ? 1 : 0.55;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: winH, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  // Swipe down anywhere to drop back to the mini-player — the one exit
  // gesture shared by every mode (the mini-player's X ends the music).
  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 0.8) handleClose();
      else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;


  const resetTrack = () => progress.setValue(0);
  const togglePlay = () => { if (playing) spotify.pause(); else spotify.play(); setPlaying(!playing); };

  // Real song when connected, else the mood's own line — never a fake track.
  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';

  // Between songs the ring rests: a title change holds the kick ~2s, same
  // manners as the atmosphere — the dance floor clears between tracks.
  const [kickHold, setKickHold] = useState(false);
  const prevTitleRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const now = spotify.track?.title ?? null;
    const prev = prevTitleRef.current;
    prevTitleRef.current = now;
    if (prev === undefined || prev === now || !now) return;
    setKickHold(true);
    const t = setTimeout(() => setKickHold(false), 2200);
    return () => clearTimeout(t);
  }, [spotify.track?.title]);
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const glowTint = eq[1] + '26';
  // Beat-synced feel: on top of the flowing sweep, the whole ring KICKS on a
  // steady ~100 BPM pattern — sharp jump, quick decay, with the downbeat of
  // every bar of four hitting hardest. Reads like the ring is dancing to the
  // music instead of drifting. Only while music actually plays (the scene
  // freezes when paused, so the kick dies with it).
  const tSec = phase / 1.5;
  const BEAT_S = 0.6;
  const beatPos = (tSec % BEAT_S) / BEAT_S;
  const accent = Math.floor(tSec / BEAT_S) % 4 === 0 ? 1 : 0.6;
  const kick = playing && !musicSwitching && !kickHold ? Math.pow(1 - beatPos, 2.5) * accent : 0;
  const amp = ampRef.current * (0.68 + 0.6 * kick);
  // Landscape sizes off HEIGHT alone — the portrait formula shrinks a
  // sideways orb to a bangle (the "squish", owner 30.07).
  const orbSize = isLandscape
    ? Math.min(winH * 0.88, 360)
    : Math.min(winW * 1.02, winH * 0.54, 460);

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View
        style={[{ flex: 1, backgroundColor: '#04060f' }, { transform: [{ translateY: slideY }] }]}
        {...dismissPan.panHandlers}
        onStartShouldSetResponderCapture={() => { wakeChrome(); return false; }}>

        {/* Blurred station background */}
        <StationBackdrop station={station} blurRadius={2.5} />
        <LinearGradient
          colors={[
            'rgba(2,3,14,0.34)', 'rgba(2,3,14,0.26)', 'rgba(2,3,14,0.44)',
            'rgba(2,3,14,0.58)', 'rgba(2,3,14,0.68)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', glowTint, 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.26, bottom: winH * 0.34 }}
          pointerEvents="none"
        />

        {!isLandscape && (
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>
        )}

        {!isLandscape && (
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>CIRCULAR EQ</Text>
        </View>
        )}

        {/* Content */}
        <View style={{ flex: 1, paddingTop: isLandscape ? 8 : topPad + 52, paddingBottom: isLandscape ? 8 : Math.max(insets.bottom, 24) + 16 }}>
          {!isLandscape && (
          <View style={{ paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </View>
          )}

          {/* Orb */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ width: orbSize, height: orbSize }, deckScene]}>
            <Svg width={orbSize} height={orbSize} viewBox={`0 0 ${VB} ${VB}`}>
              <Defs>
                <RadialGradient id="cwStroke" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor="#EAF3FF" />
                  <Stop offset="0.5" stopColor={eq[0]} />
                  <Stop offset="0.75" stopColor={eq[1]} />
                  <Stop offset="1" stopColor={eq[2]} />
                </RadialGradient>
                <RadialGradient id="cwCore" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0" stopColor={eq[1]} stopOpacity="0.16" />
                  <Stop offset="0.7" stopColor={eq[2]} stopOpacity="0.07" />
                  <Stop offset="1" stopColor={eq[2]} stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Soft halo so the ring reads over the scene — centre stays hollow */}
              <Circle cx={CX} cy={CY} r={R0 + MAXLEN} fill="url(#cwCore)" />
              {/* Chunky EQ dashes — resting dots with bursts sweeping the ring */}
              <Path d={ringBars(phase, amp)} stroke="url(#cwStroke)" strokeWidth={5} strokeOpacity={0.97} fill="none" strokeLinecap="round" />
            </Svg>
            <FloatingNotes playing={playing} emitter="ring" color={eq[0]} />
            </Animated.View>
          </View>

          {!isLandscape && (
          <>
          {/* Song title / mood line */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>}
            {hasTrack && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{artist}</Text>}
          </View>

          {/* Progress — only when a real song is playing through */}
          {hasTrack && (
          <View style={{ width: '100%', paddingHorizontal: 28, marginTop: 18 }}>
            <SeekBar progress={progress} scrub={scrub} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
              <Text style={fs.time}>{formatMs(elapsedMs)}</Text>
              <Text style={fs.time}>{formatMs(durationMs)}</Text>
            </View>
          </View>
          )}

          {/* Controls */}
          <View style={fs.controls}>
            <TouchableOpacity onPress={() => { const ns = !shuffle; setShuffle(ns); if (spotify.connected) spotify.shuffle(ns); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={24} color={shuffle ? eq[1] : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetTrack(); spotify.prev(); }} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-previous" size={44} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} style={fs.playBtn} activeOpacity={0.9}>
              {playing ? (
                <View style={{ flexDirection: 'row', gap: 7 }}>
                  <View style={fs.pauseBar} />
                  <View style={fs.pauseBar} />
                </View>
              ) : (
                <MaterialCommunityIcons name="play" size={42} color="#0a0a12" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { resetTrack(); spotify.next(); }} activeOpacity={0.75}>
              <MaterialCommunityIcons name="skip-next" size={44} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const nr = !repeat; setRepeat(nr); if (spotify.connected) spotify.repeat(nr ? 'track' : 'off'); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat ? 'repeat-once' : 'repeat'} size={24} color={repeat ? eq[1] : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
          </View>

          {/* Left-aligned action pills — keep the visual the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            track={spotify.track}
            station={station}
          />
          </>
          )}
        </View>

        {isLandscape && (
          <LandscapeChrome
            chrome={chrome}
            rested={chromeRested}
            station={station}
            track={spotify.track}
            playing={playing}
            tagline={station.tagline}
            progress={progress}
            scrub={scrub}
            onPlayPause={togglePlay}
            onPrev={() => { resetTrack(); spotify.prev(); }}
            onNext={() => { resetTrack(); spotify.next(); }}
            onClose={handleClose}
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
          />
        )}

        {!isLandscape && <ModeCloseButton onPress={handleClose} />}

        <AmbientGlow active={visible && playing} beat={visible && playing && !musicSwitching && (spotify.track?.isPlaying ?? true)} trackKey={spotify.track?.title ?? null} color={eq[1]} />
        <WakeSpotifyHint show={playing && !spotify.track && !handoff} connected={spotify.connected} />
        {handoff && !spotify.track && <HandoffOverlay />}
        <PreviewGate onSilence={spotify.pause} />

        <ModeSheet visible={showMood} onClose={() => setShowMood(false)} />

        {showPicker && (
          <PlaylistSheet
            stationName={station.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(station.id, pl);
              setLinked(pl);
              setShowPicker(false);
              relinkStationPlaylist(station.id);
            }}
          />
        )}

      </Animated.View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  topBar: {
    position: 'absolute', left: 20, right: 20, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  modeLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // 14, not 18: the transport sits a touch higher so the pills below get
    // real breathing room (their own marginTop went 18 -> 26). Don't take it
    // much lower — the progress bar is directly above.
    width: '100%', paddingHorizontal: 30, marginTop: 14,
  },
  playBtn: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14,
  },
  pauseBar: { width: 8, height: 28, borderRadius: 2, backgroundColor: '#0a0a12' },
  playlistBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    alignSelf: 'center', marginTop: 18, maxWidth: '80%',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  playlistBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
});
