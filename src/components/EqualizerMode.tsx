import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cruise } from '@/constants/theme';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { FloatingNotes } from '@/components/FloatingNotes';
import { PLATFORMS, PlatformId, getSavedPlatform, openMusicPlatform } from '@/utils/musicPlatform';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { MoodSheet } from '@/components/MoodSheet';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { useMotion } from '@/context/MotionContext';
import { useMicLevel } from '@/utils/useMicLevel';
import { OWNER_MODE } from '@/constants/config';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Card bar geometry ─────────────────────────────────────────────────────────
const BAR_COUNT   = 30;
const SEGMENT_H   = 5;
const GAP_H       = 2;
const UNIT        = SEGMENT_H + GAP_H;   // 7px per LED segment
const MAX_SEGS    = 16;
const MIN_SEGS    = 2;
const MAX_H       = MAX_SEGS * UNIT;
const MIN_H       = MIN_SEGS * UNIT;
const CARD_BAR_W  = Math.floor((SCREEN_W - 48) / BAR_COUNT) - 2;
const CARD_GAPS   = Array.from({ length: MAX_SEGS - 1 }, (_, i) => SEGMENT_H + i * UNIT);

// ── Fullscreen bar geometry — must match the vizSection height below,
// otherwise the tallest bars get clipped at the top ─────────────────────────
const VIZ_H       = Math.round(SCREEN_H * 0.26);
const FS_MAX_SEGS = Math.max(20, Math.floor(VIZ_H / UNIT));
const FS_MAX_H    = FS_MAX_SEGS * UNIT;
const FS_MIN_H    = MIN_H;
// 24px side margins + the row's 2px gaps, so the first/last bars never clip.
const FS_BAR_W    = Math.floor((SCREEN_W - 48 - (BAR_COUNT - 1) * 2) / BAR_COUNT);
const FS_GAPS     = Array.from({ length: FS_MAX_SEGS - 1 }, (_, i) => SEGMENT_H + i * UNIT);

// ── Bar animation helpers ─────────────────────────────────────────────────────

function cardBellMaxH(i: number): number {
  const t = (i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 4.2);
  return Math.round(MIN_SEGS + (MAX_SEGS - MIN_SEGS) * Math.exp(-0.5 * t * t)) * UNIT;
}

function fsBellMaxH(i: number): number {
  const t = (i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 4.2);
  return Math.round(MIN_SEGS + (FS_MAX_SEGS - MIN_SEGS) * Math.exp(-0.5 * t * t)) * UNIT;
}

function barDur(i: number): number {
  return 380 + Math.floor(Math.abs(Math.sin(i * 1.7 + 0.4)) * 280);
}

function startBarAnims(
  values: Animated.Value[],
  bellFn: (i: number) => number,
  minH: number,
  timers: React.MutableRefObject<ReturnType<typeof setTimeout>[]>,
) {
  values.forEach((anim, i) => {
    const maxH = bellFn(i);
    const dur  = barDur(i);
    const t = setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: maxH,                         duration: dur,        easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(anim, { toValue: minH + (maxH - minH) * 0.18, duration: dur * 0.65, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(anim, { toValue: maxH * 0.6,                   duration: dur * 0.5,  easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(anim, { toValue: minH,                         duration: dur * 0.75, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    }, i * 14);
    timers.current.push(t);
  });
}

function stopBarAnims(
  values: Animated.Value[],
  timers: React.MutableRefObject<ReturnType<typeof setTimeout>[]>,
) {
  timers.current.forEach(clearTimeout);
  timers.current = [];
  values.forEach((v) => v.stopAnimation());
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function GapStrips({ gaps, bgColor }: { gaps: number[]; bgColor: string }) {
  return (
    <>
      {gaps.map((bottom) => (
        <View key={bottom} style={{ position: 'absolute', left: 0, right: 0, height: GAP_H, bottom, backgroundColor: bgColor }} />
      ))}
    </>
  );
}

function Bars({ values, barW, maxH, gaps, bgColor, colors }: {
  values: Animated.Value[];
  barW: number;
  maxH: number;
  gaps: number[];
  bgColor: string;
  colors?: [string, string, string];
}) {
  const barColors = colors ?? ['#00BFFF', '#8A2BE2', '#FF00AA'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: maxH }}>
      {values.map((anim, i) => (
        <Animated.View key={i} style={{ width: barW, height: anim, overflow: 'hidden' }}>
          <View style={{ width: barW, height: maxH, position: 'absolute', bottom: 0 }}>
            <LinearGradient
              colors={barColors}
              start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 3 }]}
            />
            <GapStrips gaps={gaps} bgColor={bgColor} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 3 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function Marquee({ text, textStyle }: { text: string; textStyle?: object }) {
  const tx   = useRef(new Animated.Value(0)).current;
  const [textW, setTextW] = useState(0);
  const [boxW,  setBoxW]  = useState(0);
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loop.current?.stop();
    tx.setValue(0);
    if (textW > boxW && boxW > 0) {
      const travel = textW + 32;
      loop.current = Animated.loop(Animated.sequence([
        Animated.delay(1800),
        Animated.timing(tx, { toValue: -travel, duration: travel * 22, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(tx, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      loop.current.start();
    }
    return () => loop.current?.stop();
  }, [textW, boxW]);

  return (
    <View style={{ overflow: 'hidden', width: '100%' }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      <Animated.Text
        style={[textStyle, { transform: [{ translateX: tx }] }]}
        onLayout={(e) => setTextW(e.nativeEvent.layout.width)}
        numberOfLines={1}>
        {text}
      </Animated.Text>
    </View>
  );
}

// Slim volume slider with fade-in-on-touch
// ── Violet progress bar ───────────────────────────────────────────────────────
function VioletProgressBar({ progress }: { progress: Animated.Value }) {
  const [barW, setBarW] = useState(260);
  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });
  const DOT = 14;
  return (
    <View
      style={{ flex: 1, height: 36, justifyContent: 'center' }}
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
      <Animated.View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, width: fillW, backgroundColor: '#ffffff' }}>
        <View style={{
          position: 'absolute', right: -DOT / 2, top: -(DOT / 2 - 3),
          width: DOT, height: DOT, borderRadius: DOT / 2,
          backgroundColor: '#ffffff',
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }} />
      </Animated.View>
    </View>
  );
}

function VolumeSlider() {
  const [vol, setVol] = useState(0.65);
  const widthRef  = useRef(200);
  const opacity   = useRef(new Animated.Value(0.3)).current;

  const reveal = () => Animated.timing(opacity, { toValue: 1,   duration: 140, useNativeDriver: true }).start();
  const dim    = () => Animated.timing(opacity, { toValue: 0.3, duration: 900, useNativeDriver: true }).start();

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => { reveal(); setVol(Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current))); },
    onPanResponderMove:  (e) => { setVol(Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current))); },
    onPanResponderRelease: () => dim(),
  })).current;

  const pct = `${(vol * 100).toFixed(1)}%` as any;

  return (
    <Animated.View style={[fs.volWrap, { opacity }]}>
      <View
        style={fs.volTrack}
        onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}>
        <View style={[StyleSheet.absoluteFill, fs.volBg]} />
        <LinearGradient
          colors={['#6B28D4', '#9B5CFF']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { width: pct, borderRadius: 3 }]}
        />
        <View style={[fs.volThumb, { left: pct }]} />
      </View>
    </Animated.View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Full-screen modal ─────────────────────────────────────────────────────────

export function EqualizerFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;

  const fsValues = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(FS_MIN_H))).current;
  // Drives the ambient glow's brightness/breath — a big, cheap element that
  // reads the mic even on slow phones where 30 tiny bars are hard to see.
  const glowPulse = useRef(new Animated.Value(0.7)).current;

  const { playing, setPlaying, setStationId: npSetStation, handoff } = useNowPlaying();
  const { micReactive } = useMotion();
  // Live loudness of the surrounding music; drives the bars when available.
  const mic = useMicLevel(visible && playing && micReactive);
  const micActive = mic.available;
  const [activeStation, setActiveStation] = useState(stationId ?? 'night-run');
  const [shuffle,       setShuffle]       = useState(false);
  const [repeat,        setRepeat]        = useState(false);
  const [platform,      setPlatform]      = useState<{ id: PlatformId; name: string; color: string } | null>(null);
  const [dimmed,        setDimmed]        = useState(false);
  const [showMood,      setShowMood]      = useState(false);
  const [showPicker,    setShowPicker]    = useState(false);
  const [linked,        setLinked]        = useState<LinkedPlaylist | null>(null);
  const playBtnScale   = useRef(new Animated.Value(1)).current;

  const slideY        = useRef(new Animated.Value(SCREEN_H)).current;
  const closePulse    = useRef(new Animated.Value(1)).current;
  const timers        = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const origBrightness = useRef(1);

  const currentStation = resolveAnyStation(activeStation);

  // ── Dynamic landscape bar geometry (computed every render from window dims) ──
  const lsRightW   = winW * 0.56;
  const lsBarW     = Math.max(3, Math.floor(lsRightW / BAR_COUNT) - 2);
  const lsMaxSegs  = Math.max(20, Math.floor(winH / UNIT));
  const lsMaxH     = lsMaxSegs * UNIT;
  const lsGaps     = Array.from({ length: lsMaxSegs - 1 }, (_, i) => SEGMENT_H + i * UNIT);
  const lsBellMaxH = useCallback((i: number) => {
    const t = (i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 4.2);
    return Math.round(MIN_SEGS + (lsMaxSegs - MIN_SEGS) * Math.exp(-0.5 * t * t)) * UNIT;
  }, [lsMaxSegs]);

  // ── Open: read platform, start bars, slide in ─────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (stationId) setActiveStation(stationId);
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') {
        const p = PLATFORMS[id as Exclude<PlatformId, 'none'>];
        if (p) setPlatform({ id: id as PlatformId, name: p.name, color: p.color });
      } else { setPlatform(null); }
    });
    slideY.setValue(SCREEN_H);
    // Respect the session's play state — a browse from the Modes tab opens
    // paused, so the bars hold still until the user presses play.
    if (playing && !micActive) startBarAnims(fsValues, isLandscape ? lsBellMaxH : fsBellMaxH, FS_MIN_H, timers);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    // Pulse the close button once to draw attention
    closePulse.setValue(1);
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(closePulse, { toValue: 1.18, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(closePulse, { toValue: 1,    duration: 220, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ]).start();
    }, 600);
    return () => {
      stopBarAnims(fsValues, timers);
      if (Platform.OS !== 'web') deactivateKeepAwake();
    };
  }, [visible]);

  // ── Restart bar heights when orientation flips ────────────────────────────
  useEffect(() => {
    if (!visible) return;
    stopBarAnims(fsValues, timers);
    if (playing && !micActive) {
      startBarAnims(fsValues, isLandscape ? lsBellMaxH : fsBellMaxH, FS_MIN_H, timers);
    }
  }, [isLandscape]);

  // ── Mic-reactive mode: when live loudness is available, halt the timed loop
  //    and let the metering drive the bars; restore the loop when it drops. ──
  useEffect(() => {
    if (!visible || !playing) return;
    stopBarAnims(fsValues, timers);
    if (!micActive) {
      startBarAnims(fsValues, isLandscape ? lsBellMaxH : fsBellMaxH, FS_MIN_H, timers);
      glowPulse.setValue(0.7); // static ambient glow when the mic isn't driving
    }
  }, [micActive]);

  useEffect(() => {
    if (!micActive || !visible || !playing) return;
    const lvl = mic.level;
    const bell = isLandscape ? lsBellMaxH : fsBellMaxH;
    fsValues.forEach((anim, i) => {
      const maxH = bell(i);
      // Per-bar liveliness so a single loudness number still reads like an EQ.
      const jitter = 0.55 + Math.random() * 0.75;
      const target = FS_MIN_H + (maxH - FS_MIN_H) * Math.min(1, lvl * 1.8 * jitter);
      Animated.timing(anim, { toValue: target, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    });
    // The big, unmissable one — the whole ambient glow breathes with the music.
    Animated.timing(glowPulse, { toValue: Math.min(1, 0.2 + lvl * 1.4), duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [mic.level, micActive, visible, playing, isLandscape]);

  // ── Keep screen awake in landscape ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (visible && isLandscape) {
      activateKeepAwakeAsync().catch(() => {});
    } else {
      deactivateKeepAwake();
    }
  }, [visible, isLandscape]);

  // ── Safety banner: fade in on landscape, then out after 3s ───────────────
  useEffect(() => {
    if (!isLandscape) { bannerOpacity.setValue(0); return; }
    bannerOpacity.setValue(1);
    const t = setTimeout(() => {
      Animated.timing(bannerOpacity, { toValue: 0, duration: 900, useNativeDriver: true }).start();
    }, 3000);
    return () => clearTimeout(t);
  }, [isLandscape]);

  // ── Dim toggle ────────────────────────────────────────────────────────────
  const toggleDim = async () => {
    if (Platform.OS === 'web') return;
    try {
      if (!dimmed) {
        origBrightness.current = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(0.12);
        setDimmed(true);
      } else {
        await Brightness.setBrightnessAsync(origBrightness.current);
        setDimmed(false);
      }
    } catch { /* permissions not granted */ }
  };

  const handleClose = async () => {
    // Restore brightness if dimmed
    if (dimmed && Platform.OS !== 'web') {
      try { await Brightness.setBrightnessAsync(origBrightness.current); } catch {}
      setDimmed(false);
    }
    if (Platform.OS !== 'web') deactivateKeepAwake();
    stopBarAnims(fsValues, timers);
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const spotify = useSpotifyPlayback(visible);

  // Progress rides the shared track clock — real Spotify position when
  // connected, the classic 4-minute demo loop otherwise.
  const { progress, elapsedMs: currentTimeMs, durationMs } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: 4 * 60 * 1000,
  });

  const togglePlay = () => {
    if (playing) {
      stopBarAnims(fsValues, timers);
      setPlaying(false);
      spotify.pause();
    } else {
      if (!micActive) startBarAnims(fsValues, isLandscape ? lsBellMaxH : fsBellMaxH, FS_MIN_H, timers);
      setPlaying(true);
      spotify.play();
    }
  };

  const topPad    = Math.max(insets.top, 20);
  const bottomPad = Math.max(insets.bottom, 24) + 20;

  useEffect(() => {
    if (visible) getStationPlaylist(activeStation).then(setLinked);
  }, [visible, activeStation]);

  // ── Swipe-down to dismiss (portrait) ─────────────────────────────────────
  const dismissPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove:  (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 0.8) handleClose();
      else Animated.spring(slideY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  // ── Shared background ─────────────────────────────────────────────────────
  // Plain JSX (not an inline component): an inline component gets a new
  // identity every render, which makes React REMOUNT the blurred image on
  // every progress tick — that was the background "twitching".
  const background = (
    <>
      <StationBackdrop station={currentStation} blurRadius={2.5} />
      <LinearGradient
        colors={[
          'rgba(2,2,12,0.20)',
          'rgba(2,2,12,0.15)',
          'rgba(2,2,12,0.30)',
          'rgba(2,2,12,0.46)',
          'rgba(2,2,12,0.58)',
        ]}
        locations={[0, 0.4, 0.65, 0.85, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );


  // ─────────────────────────────────────────────────────────────────────────
  // LANDSCAPE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  if (isLandscape) {
    const leftW  = winW * 0.44;
    const rightW = winW - leftW;
    const safeLeft  = insets.left  || 0;
    const safeRight = insets.right || 0;

    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <View style={ls.container} {...dismissPan.panHandlers}>
          {background}

          {/* Safety banner — fades out after 3s */}
          <Animated.View
            style={[ls.safeBanner, { opacity: bannerOpacity, top: Math.max(insets.top, 8) }]}
            pointerEvents="none">
            <MaterialCommunityIcons name="steering" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={ls.safeBannerText}>Drive safe — keep eyes on the road</Text>
          </Animated.View>

          {/* Dim button — top left */}
          <TouchableOpacity
            style={[ls.dimBtn, { top: Math.max(insets.top, 8) + 2, left: safeLeft + 14 }]}
            onPress={toggleDim}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons
              name={dimmed ? 'sunny-outline' : 'moon-outline'}
              size={17}
              color={dimmed ? 'rgba(255,210,60,0.7)' : 'rgba(255,255,255,0.45)'}
            />
          </TouchableOpacity>


          {/* Two-column row */}
          <View style={ls.columns}>

            {/* ── LEFT COLUMN ── */}
            <View style={[ls.leftCol, { width: leftW, paddingLeft: safeLeft + 20 }]}>

              {/* Station identity */}
              <View style={ls.leftIdentity}>
                <Ionicons name="moon" size={13} color="rgba(123,56,224,0.7)" />
                <Text style={ls.lsStation} numberOfLines={1}>{currentStation.name}</Text>
              </View>
              <Text style={ls.lsTrack} numberOfLines={1}>
                {spotify.track ? `${spotify.track.title} — ${spotify.track.artist}` : 'Carbon Wing — Midnight Pilot'}
              </Text>

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* ── Large controls ── */}
              <View style={ls.controls}>
                <TouchableOpacity style={ls.prevNextBtn} activeOpacity={0.75}>
                  <Ionicons name="play-skip-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
                  <TouchableOpacity
                    style={ls.lsPlayBtn}
                    onPress={togglePlay}
                    onPressIn={() => Animated.spring(playBtnScale, { toValue: 1.05, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                    onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                    activeOpacity={0.9}>
                    <Ionicons name={playing ? 'pause' : 'play'} size={30} color="#0a0a12" style={playing ? undefined : { marginLeft: 3 }} />
                  </TouchableOpacity>
                </Animated.View>
                <TouchableOpacity style={ls.prevNextBtn} activeOpacity={0.75}>
                  <Ionicons name="play-skip-forward" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Volume */}
              <View style={ls.volWrap}>
                <VolumeSlider />
              </View>

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* Tagline */}
              <Text style={ls.lsTagline} numberOfLines={2}>{currentStation.tagline}</Text>

              {/* Platform row */}
              {platform && (
                <TouchableOpacity
                  style={ls.lsPlatformRow}
                  onPress={() => openMusicPlatform(currentStation.name)}
                  activeOpacity={0.7}>
                  <PlatformIcon id={platform.id} size={14} color={platform.color} />
                  <Text style={[ls.lsPlatformText, { color: platform.color }]}>
                    {platform.name}
                  </Text>
                </TouchableOpacity>
              )}

            </View>

            {/* ── RIGHT COLUMN — bars ── */}
            <View style={[ls.rightCol, { width: rightW, paddingRight: safeRight }]}>
              {/* Violet bloom behind bars */}
              <View style={ls.lsVizGlow} pointerEvents="none" />
              <Bars
                values={fsValues}
                barW={lsBarW}
                maxH={lsMaxH}
                gaps={lsGaps}
                bgColor="#060612"
                colors={currentStation.eqColors ?? ['#00BFFF', currentStation.glowColor, '#FF00AA']}
              />
              <FloatingNotes playing={playing} color={currentStation.eqColors?.[1] ?? currentStation.glowColor} />
            </View>

          </View>
        </View>
      </Modal>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PORTRAIT LAYOUT (unchanged)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => {}} statusBarTranslucent>
      <Animated.View style={[fs.container, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        {background}

        {/* Ambient station glow — a soft vertical gradient (transparent →
            tint → transparent) so it has NO hard edge and the blurred image
            stays visible all the way to the bottom. Tinted with the bright
            mid bar colour so it reads as light, never a dark cut-off. */}
        <Animated.View
          style={[
            fs.glowBand,
            { opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [{ scaleY: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.32] }) }] },
          ]}
          pointerEvents="none">
          <LinearGradient
            colors={[
              'transparent',
              (currentStation.eqColors?.[1] ?? currentStation.glowColor) + '26',
              'transparent',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>

        {/* Owner-only: live mic level, so reactivity is verifiable on any device */}
        {OWNER_MODE && micReactive && (
          <View style={{ position: 'absolute', top: topPad + 4, left: 12, zIndex: 30 }} pointerEvents="none">
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700' }}>
              mic {micActive ? mic.level.toFixed(2) : 'off'}
            </Text>
          </View>
        )}

        {/* Drag pill — swipe down hint */}
        <View style={{ position: 'absolute', top: topPad + 6, left: 0, right: 0, alignItems: 'center', zIndex: 25 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>

        {/* Close button — fixed top right, always visible */}

        {/* Content */}
        <View style={[fs.content, { paddingTop: topPad + 52, paddingBottom: bottomPad }]}>

          {/* Station — small top-center label, Spotify "Playing From Playlist" style */}
          <View style={fs.identity}>
            <Text style={fs.identityEyebrow}>PLAYING FROM</Text>
            <Text style={fs.identityStation}>{currentStation.name}</Text>
          </View>

          {/* Flexible spacer — pushes the whole player cluster to the bottom,
              leaving the upper half as the mood image. */}
          <View style={{ flex: 1 }} pointerEvents="none" />

          <View style={fs.vizSection}>
            <Bars
              values={fsValues}
              barW={FS_BAR_W}
              maxH={FS_MAX_H}
              gaps={FS_GAPS}
              bgColor="transparent"
              colors={currentStation.eqColors ?? ['#00BFFF', currentStation.glowColor, '#FF00AA']}
            />
            <FloatingNotes playing={playing} color={currentStation.eqColors?.[1] ?? currentStation.glowColor} />
          </View>

          {/* Song title — bottom-left, Spotify style */}
          <View style={fs.trackBlock}>
            <Text style={fs.trackTitle} numberOfLines={1}>{spotify.track?.title ?? 'Carbon Wing'}</Text>
            <Text style={fs.trackArtist} numberOfLines={1}>{spotify.track?.artist ?? 'Midnight Pilot'}</Text>
          </View>

          {/* Progress bar */}
          <View style={fs.progressWrap}>
            <View style={fs.progressRow}>
              <Text style={fs.timeText}>{formatMs(currentTimeMs)}</Text>
              <VioletProgressBar progress={progress} />
              <Text style={[fs.timeText, { textAlign: 'right' }]}>{formatMs(durationMs)}</Text>
            </View>
          </View>

          <View style={fs.controls}>
            <TouchableOpacity
              style={fs.shuffleRepeatBtn}
              onPress={() => setShuffle((s) => !s)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="shuffle" size={26} color={shuffle ? '#7B38E0' : '#ffffff'} />
            </TouchableOpacity>

            <TouchableOpacity style={fs.skipBtn} activeOpacity={0.75} onPress={spotify.prev}>
              <MaterialCommunityIcons name="skip-previous" size={48} color="#fff" />
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
              <TouchableOpacity
                style={fs.playBtn}
                onPress={togglePlay}
                onPressIn={() => Animated.spring(playBtnScale, { toValue: 1.05, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
                activeOpacity={0.9}>
                {playing ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={fs.pauseBar} />
                    <View style={fs.pauseBar} />
                  </View>
                ) : (
                  <MaterialCommunityIcons name="play" size={46} color="#0a0a12" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={fs.skipBtn} activeOpacity={0.75} onPress={spotify.next}>
              <MaterialCommunityIcons name="skip-next" size={48} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={fs.shuffleRepeatBtn}
              onPress={() => setRepeat((r) => !r)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="repeat" size={26} color={repeat ? '#7B38E0' : '#ffffff'} />
            </TouchableOpacity>
          </View>

          {/* Left-aligned action pills — keep the bars the focus */}
          <View style={fs.actionRow}>
            <TouchableOpacity onPress={() => setShowMood(true)} style={fs.actionPill} activeOpacity={0.85}>
              <MaterialCommunityIcons name="tune-variant" size={15} color="#fff" />
              <Text style={fs.actionPillBold}>Change Mood</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker(true)} style={fs.actionPill} activeOpacity={0.85}>
              <Ionicons name="musical-notes-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={fs.actionPillText} numberOfLines={1}>
                {linked ? linked.name : 'Add Playlist'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {handoff && <HandoffOverlay />}

        <MoodSheet
          visible={showMood}
          activeId={activeStation}
          onSelect={(id) => { setActiveStation(id); npSetStation(id); setShowMood(false); }}
          onClose={() => setShowMood(false)}
        />

        {showPicker && (
          <PlaylistSheet
            stationName={currentStation.name}
            current={linked}
            onClose={() => setShowPicker(false)}
            onPick={async (pl) => {
              await setStationPlaylist(activeStation, pl);
              setLinked(pl);
              setShowPicker(false);
            }}
          />
        )}

      </Animated.View>
    </Modal>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function EqualizerModeCard() {
  const cardValues = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_H))).current;
  const [modalOpen, setModalOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    startBarAnims(cardValues, cardBellMaxH, MIN_H, timers);
    return () => stopBarAnims(cardValues, timers);
  }, []);

  const handleOpen = () => {
    stopBarAnims(cardValues, timers);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    startBarAnims(cardValues, cardBellMaxH, MIN_H, timers);
  };

  return (
    <View style={card.shell}>
      <TouchableOpacity onPress={handleOpen} activeOpacity={0.9} style={card.scene}>
        <View style={card.glowCyan} pointerEvents="none" />
        <View style={card.glowPink} pointerEvents="none" />
        <View style={card.tapHint}>
          <Ionicons name="play" size={9} color="rgba(255,255,255,0.4)" />
          <Text style={card.tapHintText}>tap to open</Text>
        </View>
        <Bars values={cardValues} barW={CARD_BAR_W} maxH={MAX_H} gaps={CARD_GAPS} bgColor="#111111" />
      </TouchableOpacity>
      <View style={card.footer}>
        <View style={card.titleRow}>
          <Text style={card.title}>Equalizer Mode</Text>
          <View style={card.freeBadge}><Text style={card.freeBadgeText}>FREE</Text></View>
        </View>
        <Text style={card.sub}>Tap to open the full experience. LED bars. Full screen. All night.</Text>
      </View>
      <EqualizerFullscreen visible={modalOpen} onClose={handleClose} />
    </View>
  );
}

export function EqualizerModePreview() {
  const values = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_H))).current;
  const [active, setActive] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  return (
    <TouchableOpacity
      onPress={() => {
        if (active) { stopBarAnims(values, timers); setActive(false); }
        else        { startBarAnims(values, cardBellMaxH, MIN_H, timers); setActive(true); }
      }}
      activeOpacity={0.9}
      style={card.scene}>
      <View style={card.glowCyan} pointerEvents="none" />
      <View style={card.glowPink} pointerEvents="none" />
      <View style={card.tapHint}>
        <Ionicons name={active ? 'pause' : 'play'} size={9} color="rgba(255,255,255,0.4)" />
        <Text style={card.tapHintText}>{active ? 'tap to stop' : 'tap to play'}</Text>
      </View>
      <Bars values={values} barW={CARD_BAR_W} maxH={MAX_H} gaps={CARD_GAPS} bgColor="#111111" />
    </TouchableOpacity>
  );
}

// ── Card styles ───────────────────────────────────────────────────────────────
const card = StyleSheet.create({
  shell: {
    backgroundColor: Cruise.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(123,56,224,0.45)',
    overflow: 'hidden',
    shadowColor: '#7B38E0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
  scene: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingBottom: 16,
  },
  tapHint: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  tapHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '600' },
  glowCyan: { position: 'absolute', bottom: 24, left: '20%', width: 120, height: 50, borderRadius: 60, backgroundColor: 'rgba(0,191,255,0.15)' },
  glowPink: { position: 'absolute', bottom: 24, right: '20%', width: 120, height: 50, borderRadius: 60, backgroundColor: 'rgba(255,0,170,0.11)' },
  footer:   { padding: 16, paddingBottom: 14, gap: 4, minHeight: 160 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:    { color: Cruise.textPrimary, fontSize: 17, fontWeight: '700' },
  sub:      { color: '#a070f0', fontSize: 13, lineHeight: 18 },
  freeBadge: {
    backgroundColor: 'rgba(16,185,129,0.18)', borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.45)',
  },
  freeBadgeText: { color: '#10B981', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
});

// ── Fullscreen styles ─────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02020c', minHeight: SCREEN_H },

  // Ambient glow band — soft vertical falloff, no hard edge
  glowBand: {
    position: 'absolute',
    left: 0, right: 0,
    top: SCREEN_H * 0.40,
    bottom: 0,
  },

  // ── Close button ──────────────────────────────────────────────────────────
  closeBtnWrap: {
    // outer shell carries the scale transform + absolute positioning from prop
  },
  closeBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1a1a1a',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    gap: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  closeBtnLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // ── Content column — no horizontal padding; each section pads itself ────────
  content: {
    flex: 1,
    gap: 0,
  },

  // Station identity — small top-center header
  identity: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  identityEyebrow: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  identityStation: { color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  // Song title — bottom-left, Spotify style
  trackBlock: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  trackTitle:  { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  trackArtist: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 },

  // ── Visualizer section — flex to fill available space ────────────────────
  vizSection: {
    width: SCREEN_W,
    // A little taller than the bars' max height so peaks never touch the edge.
    height: VIZ_H + 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  vizBloomBottom: {
    position: 'absolute', bottom: -12, alignSelf: 'center',
    width: SCREEN_W * 0.8, height: 90, borderRadius: 90,
    backgroundColor: 'rgba(90, 28, 200, 0.32)',
  },

  // ── Progress bar ─────────────────────────────────────────────────────────
  progressWrap: {
    width: '100%',
    paddingHorizontal: 28,
    marginTop: 22,
    marginBottom: 0,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    width: 38,
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 28,
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 4,
  },
  shuffleRepeatBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtn: {
    width: 52, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  playBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 14,
  },
  pauseBar: {
    width: 8,
    height: 30,
    borderRadius: 2,
    backgroundColor: '#0a0a12',
  },

  // ── Volume ────────────────────────────────────────────────────────────────
  volWrap: {
    paddingHorizontal: 28,
    marginBottom: 28,
  },
  volTrack: {
    height: 4, borderRadius: 3,
    position: 'relative', justifyContent: 'center',
  },
  volBg: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
  },
  volThumb: {
    position: 'absolute',
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginLeft: -6,
    shadowColor: '#9060FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Mode chip ─────────────────────────────────────────────────────────────
  modeChip: {
    color: '#7B38E0',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // ── Action pills ──────────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18, paddingHorizontal: 22 },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: '58%',
  },
  actionPillBold: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  actionPillText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  // ── Playlist button ───────────────────────────────────────────────────────
  playlistBtn: {
    marginTop: 20,
    marginHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  playlistBtnText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },

  // ── Playlist sheet ────────────────────────────────────────────────────────
  playlistSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: '#222222',
    paddingTop: 12, paddingBottom: 36,
  },
  sheetHandle: {
    width: 34, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 10.5, fontWeight: '800', letterSpacing: 3,
    paddingHorizontal: 22, marginBottom: 4,
  },
  stationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, height: 44,
    borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  stationPillActive: {
    borderColor: '#ffffff',
  },
  stationPillText: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', maxWidth: 80,
  },
  stationPillTextActive: {
    color: '#ffffff', fontWeight: '800',
  },
  sheetPlatformRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 22, marginTop: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 16,
  },
  sheetPlatformEmoji: { fontSize: 16 },
  sheetPlatformText: { flex: 1, fontSize: 13, fontWeight: '600' },
});

// ── Landscape styles ──────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  container: { flex: 1 },

  columns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  leftCol: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 0,
  },

  rightCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },

  lsVizGlow: {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    width: '100%', height: '50%',
    backgroundColor: 'rgba(80, 20, 180, 0.22)',
    borderTopLeftRadius: 200, borderTopRightRadius: 200,
  },

  leftIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },

  lsStation: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  lsTrack: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 12,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 14,
  },

  prevNextBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d0d1a',
    borderWidth: 1.5, borderColor: '#7B38E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },

  lsPlayBtn: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },

  volWrap: { marginBottom: 12 },

  lsTagline: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 6,
  },

  lsPlatformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  lsPlatformEmoji: { fontSize: 13 },

  lsPlatformText: { fontSize: 12, fontWeight: '600' },

  safeBanner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  safeBannerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  dimBtn: {
    position: 'absolute',
    zIndex: 20,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
});
