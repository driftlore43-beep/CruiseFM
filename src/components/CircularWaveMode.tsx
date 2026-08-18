import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, ScrollView,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { LandscapeChrome, restShiftFor, useChromeFade, useDeckScene, useRestScene } from '@/components/LandscapeChrome';
import { StationIdentity } from '@/components/StationIdentity';
import { ModeSheet } from '@/components/ModeSheet';
import { STATIONS } from '@/constants/stations';
import { confirmedPlaying } from '@/utils/confirmedPlaying';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { FloatingNotes } from '@/components/FloatingNotes';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useMusicPlayback, nextRepeat } from '@/utils/useMusicPlayback';
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

/** One bar's height, 0..1-ish, sharpened so the ring rests as dots. */
function burstAt(a: number, phase: number): number {
  return Math.pow(Math.max(0, spectrum(a, phase)), 2.6);
}

// All outward bars as one path. Peaks are sharpened so the ring reads as
// resting dots with wave bursts sweeping around it (reference-clip look).
function ringBars(phase: number, amp: number): string {
  let d = '';
  for (let i = 0; i < NBARS; i++) {
    const c = BAR_COS[i], s = BAR_SIN[i];
    const tip = Math.min(R0 + MINLEN + MAXLEN * amp * burstAt(BAR_ANG[i], phase), R_MAX - 5);
    d += `M${d1(CX + R0 * c)} ${d1(CY + R0 * s)}L${d1(CX + tip * c)} ${d1(CY + tip * s)}`;
  }
  return d;
}

/**
 * The SHORT INWARD half of each bar. A meter that only grows outwards reads
 * as a sunburst; mirroring it — briefly, inwards — is what makes it read as a
 * spectrum wrapped around a circle. Deliberately about a third of the outward
 * length: the centre of this mode stays hollow, which is its whole silhouette.
 */
function ringInner(phase: number, amp: number): string {
  let d = '';
  for (let i = 0; i < NBARS; i++) {
    const c = BAR_COS[i], s = BAR_SIN[i];
    const len = MINLEN * 0.6 + MAXLEN * INNER_FRAC * amp * burstAt(BAR_ANG[i], phase);
    d += `M${d1(CX + R0 * c)} ${d1(CY + R0 * s)}L${d1(CX + (R0 - len) * c)} ${d1(CY + (R0 - len) * s)}`;
  }
  return d;
}

/**
 * Peak dots riding each bar's recent maximum — the polar version of the
 * Equalizer's white peak caps, which the owner kept. A real meter's peak
 * hangs above the level and falls back slowly, and that lag is most of what
 * makes it read as an instrument rather than a pattern.
 *
 * No per-bar state: the peak is simply the highest this bar has been across
 * the last few frames of the same wave, which is the same thing sampled
 * backwards through `phase`.
 */
function ringPeaks(phase: number, amp: number): string {
  let d = '';
  for (let i = 0; i < NBARS; i++) {
    const a = BAR_ANG[i], c = BAR_COS[i], s = BAR_SIN[i];
    const b = Math.max(burstAt(a, phase), burstAt(a, phase - 0.30), burstAt(a, phase - 0.62));
    const r = Math.min(R0 + MINLEN + MAXLEN * amp * b + 3.4, R_MAX);
    // A zero-length dash with a round cap IS a dot — one path for all 64.
    d += `M${d1(CX + r * c)} ${d1(CY + r * s)}l0.01 0`;
  }
  return d;
}

/**
 * THE RING, AND ONLY THE RING, RE-RENDERS.
 *
 * This mode animates by recomputing 64 bars from a wave function every frame,
 * which — unlike the Tuner's flicker or the floating notes — is genuinely
 * per-frame data and cannot simply be gated off. What it does NOT need is to
 * drag the whole fullscreen mode with it: `phase` used to live in the parent,
 * so 15 times a second React re-rendered the header, the station identity, the
 * song block, the seek bar, the transport, the action row and the backdrop, to
 * move some bars. Owning the clock here confines the work to this subtree.
 *
 * Still the heaviest mode in the app, and honestly so: the remaining cost is
 * three path strings and one SVG diff per frame. If it needs to go further,
 * the answer is the Horizon treatment — bars as native-driver views sampled
 * into keyframes — which is a much larger change than it looks, because the
 * wave only repeats every ~42 s (phase coefficients 1, 1.3 and 0.6 share a
 * period of 20π), so every bar would need a long keyframe table.
 */
const BAR_COS = new Float64Array(NBARS);
const BAR_SIN = new Float64Array(NBARS);
const BAR_ANG = new Float64Array(NBARS);
for (let i = 0; i < NBARS; i++) {
  const a = (i / NBARS) * Math.PI * 2;
  BAR_ANG[i] = a;
  BAR_COS[i] = Math.cos(a);
  BAR_SIN[i] = Math.sin(a);
}

/** One decimal place, without toFixed — which is startlingly slow when it is
 *  called 400-odd times a frame. */
function d1(v: number): number {
  return Math.round(v * 10) / 10;
}

function WaveRing({ eq, playing, beating }: {
  eq: readonly string[]; playing: boolean; beating: boolean;
}) {
  const [phase, setPhase] = useState(0);
  const playingRef = useRef(playing);
  const ampRef = useRef(playing ? 1 : 0.55);
  playingRef.current = playing;

  useEffect(() => {
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
  }, []);

  // Beat-synced feel: on top of the flowing sweep, the whole ring KICKS on a
  // steady ~100 BPM pattern — sharp jump, quick decay, with the downbeat of
  // every bar of four hitting hardest. Reads like the ring is dancing to the
  // music instead of drifting.
  const tSec = phase / 1.5;
  const BEAT_S = 0.6;
  const beatPos = (tSec % BEAT_S) / BEAT_S;
  const accent = Math.floor(tSec / BEAT_S) % 4 === 0 ? 1 : 0.6;
  const kick = beating ? Math.pow(1 - beatPos, 2.5) * accent : 0;
  const amp = ampRef.current * (0.68 + 0.6 * kick);

  return (
    <G>
      <Circle cx={CX} cy={CY} r={CX} fill="url(#cwBloom)" opacity={0.45 + amp * 0.55} />
      {/* The rail the bars stand on. Without it they float, which is what
          made this mode read as a pattern rather than a meter. */}
      <Circle cx={CX} cy={CY} r={R0} fill="none" stroke={eq[1]} strokeOpacity={0.22} strokeWidth={1.1} />
      <Path d={ringInner(phase, amp)} stroke="url(#cwStroke)" strokeWidth={4} strokeOpacity={0.55} fill="none" strokeLinecap="round" />
      {/* Chunky EQ dashes — resting dots with bursts sweeping the ring */}
      <Path d={ringBars(phase, amp)} stroke="url(#cwStroke)" strokeWidth={5} strokeOpacity={0.97} fill="none" strokeLinecap="round" />
      <Path d={ringPeaks(phase, amp)} stroke="#FFFFFF" strokeWidth={2.6} strokeOpacity={0.78} fill="none" strokeLinecap="round" />
    </G>
  );
}

/** How far in the mirrored half reaches, as a fraction of the outward bar. */
const INNER_FRAC = 0.34;
/** Nothing may cross the canvas edge. `amp` can run past 1 on a loud burst,
 *  and the longest bars were being sliced off flat against the viewBox — a
 *  straight vertical cut down the right of the ring. */
const R_MAX = VB / 2 - 3;

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function CircularWaveFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useMusicPlayback(visible);

  // Shuffle and repeat are READ STRAIGHT OFF THE PLAYER, not mirrored into
  // local state. Each mode used to keep its own copy and sync it in an effect
  // — eight copies of the same two lines, and the copy is what let the button
  // disagree with the music. The player already flips optimistically and holds
  // its answer against a stale poll, so there is nothing left for a mirror to
  // do but drift.
  const shuffle = spotify.shuffleOn;
  const repeat = spotify.repeatMode;
  const eq = station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF'];

  const { playing, setPlaying, setStationId: npSetStation, handoff, relinkStationPlaylist, musicSwitching } = useNowPlaying();
  // The SCENE waits for the service's own verdict; the transport keeps the
  // optimistic `playing`, because a button that hesitates reads as broken.
  // See utils/confirmedPlaying for why, and for the clip that proved it.
  const live = confirmedPlaying(playing, spotify.track, musicSwitching);
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
    // BOTH orientations now — portrait rests the same way (useRestScene).
    active: visible, playing, sheetOpen: showMood || showPicker,
  });
  const deckScene = useDeckScene(chrome, winW, 0.86, isLandscape);
  // The scene re-centres itself once the controls have gone. MEASURED rather
  // than assumed, so each mode's own deliberate offsets survive — see
  // restShiftFor in LandscapeChrome.
  const [contentH, setContentH] = useState(0);
  const [sceneBox, setSceneBox] = useState({ y: 0, h: 0 });
  const restScene = useRestScene(chrome, restShiftFor(contentH, sceneBox.y, sceneBox.h), !isLandscape);


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
  /**
   * The dismiss gesture reaches handleClose through a ref because the
   * responder below is built once — closing over the first render's copy
   * would leave it using a stale window height after a rotation.
   */
  const dismissCloseRef = useRef(handleClose);
  dismissCloseRef.current = handleClose;

  /** Where the card ends up when the finger leaves — or is taken away. */
  const settleDismiss = (g: { dy: number; vy: number }) => {
    if (g.dy > 120 || g.vy > 0.8) dismissCloseRef.current();
    else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
  };

  /**
   * A sheet above the card owns every gesture. Without this, a FAST flick
   * that the song list declined bubbled down here (the sheet's React tree
   * lives inside the mode's), the card dismissed UNDER the open sheet, and
   * tearing down both iOS windows at once froze the whole screen (owner,
   * 04.08: "the card collapses to the bottom and then whole screen
   * freezes"). While any sheet is up, the dismiss gesture stands down.
   */
  const npSheetCount = useNowPlaying().sheetCount;
  const sheetUpRef = useRef(false);
  sheetUpRef.current = npSheetCount > 0;

  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => !sheetUpRef.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => settleDismiss(g),
    /**
     * iOS CANCELS a touch that leaves the bottom edge of the screen — which
     * is exactly how you drag a card away. With no terminate handler the
     * gesture just stopped: `slideY` stayed parked wherever the finger left
     * it, so the mode was still "open" with its content off-screen and its
     * modal window still over the app. Taps fell through to the page beneath
     * (which is why the tab bar kept working) but scrolling did not, and the
     * only ways out were to swipe again — re-grabbing the stranded card —
     * or to kill the app. Terminating settles it exactly like a release.
     */
    onPanResponderTerminationRequest: () => false,
    onPanResponderTerminate: (_, g) => settleDismiss(g),
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
        <Animated.View style={{ opacity: chrome, position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Animated.View>
        )}

        {!isLandscape && (
        <Animated.View style={[fs.topBar, { top: topPad + 14 }, { opacity: chrome }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>CIRCULAR EQ</Text>
        </Animated.View>
        )}

        {/* Content */}
        <View style={{ flex: 1, paddingTop: isLandscape ? 8 : topPad + 52, paddingBottom: isLandscape ? 8 : Math.max(insets.bottom, 24) + 16 }}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
          {!isLandscape && (
          <Animated.View style={{ opacity: chrome, paddingHorizontal: 32, paddingBottom: 10, alignItems: 'center' }}>
            <StationIdentity station={station} />
          </Animated.View>
          )}

          {/* Orb */}
          <Animated.View
            style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, restScene]}
            onLayout={(e) => setSceneBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
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
                {/* Bloom sitting ON the ring rather than filling the middle —
                    an annulus, so the hollow centre stays hollow. Breathes
                    with the level, so the whole instrument brightens on a
                    burst instead of only its bars. */}
                <RadialGradient id="cwBloom" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0.52" stopColor={eq[1]} stopOpacity="0" />
                  <Stop offset="0.74" stopColor={eq[1]} stopOpacity="0.30" />
                  <Stop offset="0.88" stopColor={eq[2]} stopOpacity="0.16" />
                  <Stop offset="1" stopColor={eq[2]} stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Soft halo so the ring reads over the scene — centre stays hollow */}
              <Circle cx={CX} cy={CY} r={R0 + MAXLEN} fill="url(#cwCore)" />
              <WaveRing eq={eq} playing={live} beating={live && !kickHold} />
            </Svg>
            <FloatingNotes playing={live} emitter="ring" color={eq[0]} />
            </Animated.View>
          </Animated.View>

          {!isLandscape && (
          /* EVERYTHING BELOW THE SCENE RESTS TOGETHER. pointerEvents goes
             off once it is invisible, or the tap meant to bring the controls
             back would press whatever button it landed on. */
          <Animated.View
            style={{ alignSelf: 'stretch', opacity: chrome }}
            pointerEvents={chromeRested ? 'none' : 'auto'}>
          {/* Song title / mood line */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 0 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0 }} numberOfLines={2}>{title}</Text>}
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
            <TouchableOpacity onPress={() => spotify.shuffle(!shuffle)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
            <TouchableOpacity onPress={() => spotify.repeat(nextRepeat(repeat))} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name={repeat === 'track' ? 'repeat-once' : 'repeat'} size={24} color={repeat !== 'off' ? eq[1] : 'rgba(255,255,255,0.85)'} />
            </TouchableOpacity>
          </View>

          {/* Left-aligned action pills — keep the visual the focus */}
          <ModeActionRow
            onChangeMood={() => setShowMood(true)}
            onPickPlaylist={() => setShowPicker(true)}
            playlistLabel={spotify.contextName ?? (linked ? linked.name : 'Add Playlist')}
            contextUri={spotify.contextUri}
            track={spotify.track}
            station={station}
          />
          </Animated.View>
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
            contextUri={spotify.contextUri}
          />
        )}

        {!isLandscape && <ModeCloseButton onPress={handleClose} chrome={chrome} rested={chromeRested} />}

        <AmbientGlow active={visible && live} beat={visible && live} trackKey={spotify.track?.title ?? null} color={eq[1]} />
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
