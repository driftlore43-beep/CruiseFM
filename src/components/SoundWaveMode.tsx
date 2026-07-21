import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Modal, PanResponder, ScrollView,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { MoodSheet } from '@/components/MoodSheet';
import { STATIONS } from '@/constants/stations';
import { resolveAnyStation } from '@/utils/customStations';
import { StationBackdrop } from '@/components/StationBackdrop';
import { FloatingNotes } from '@/components/FloatingNotes';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';
import { useTrackClock } from '@/utils/useTrackClock';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { HandoffOverlay } from '@/components/HandoffOverlay';
import { MicGlow } from '@/components/MicGlow';
import { MarqueeText } from '@/components/MarqueeText';

const SCREEN_H = Dimensions.get('window').height;

// Waveform geometry (SVG viewBox units — scales to fit)
const VB_W = 360;
const VB_H = 240;
const POINTS = 56;

const DEMO_DURATION_MS = 214000; // 3:34

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Audio-bar spectrum ────────────────────────────────────────────────────────
// A row of rounded bars along a centre baseline (with a soft mirrored
// reflection). A few slowly drifting amplitude clusters give it the shape of a
// real waveform; per-bar jitter makes the bars dance while it plays.
const NBARS = 60;
const PHASE_SPEED = 1.2;

function gauss(x: number, mu: number, sig: number): number {
  const d = (x - mu) / sig;
  return Math.exp(-0.5 * d * d);
}

/** Blend a #rrggbb colour toward white by `amount` (0..1). */
function lightenHex(hex: string, amount: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amount);
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Heights (0..~1.1) for every bar at this moment.
function barHeights(phase: number, amp: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < NBARS; i++) {
    const t = i / (NBARS - 1);
    // Tall central peak with two smaller symmetric shoulders, drifting gently.
    const env =
      1.00 * gauss(t, 0.50 + 0.03 * Math.sin(phase * 0.31), 0.080) +
      0.60 * gauss(t, 0.30 + 0.03 * Math.sin(phase * 0.27 + 1.3), 0.075) +
      0.60 * gauss(t, 0.70 + 0.03 * Math.sin(phase * 0.23 + 2.1), 0.075) +
      0.12; // floor so quiet stretches still show baseline dots
    // Lively per-bar spectrum jitter.
    const jit = 0.42 + 0.58 * Math.abs(
      Math.sin(i * 0.7 + phase * 2.4) * 0.6 + Math.sin(i * 1.9 - phase * 1.7) * 0.4,
    );
    out.push(Math.min(1.15, env * jit) * amp);
  }
  return out;
}


// Owner-tuned Sound Waves palettes (cap → mid → base). Stations not listed
// derive their bars from their shared eqColors.
const SW_PALETTES: Record<string, [string, string, string]> = {
  'rain-drive':     ['#FFE070', '#FFD24A', '#E8AE2E'],   // rich gold, no white cap
  'coastal':        ['#FF9A4A', '#FF7A2E', '#F25A14'],   // entirely sunset orange
  'after-midnight': ['#FF3B3B', '#EE1111', '#C40000'],   // blood red, kept
  'sunset':         ['#FF5FB0', '#FF2E96', '#E0187E'],   // hot pink
  'tunnel':         ['#C9E7FF', '#A8D4FF', '#7FB4EE'],   // faint light blue
  'daylight':       ['#FFDA45', '#FBA518', '#E8720E'],   // sun-drenched gold
};

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function SoundWaveFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const [activeId, setActiveId] = useState(stationId ?? 'night-run');
  const station = resolveAnyStation(activeId);
  const spotify = useSpotifyPlayback(visible);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    if (!spotify.connected) return;
    setShuffle(spotify.shuffleOn);
    setRepeat(spotify.repeatMode !== 'off');
  }, [spotify.connected, spotify.shuffleOn, spotify.repeatMode]);
  const eq = station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF'];
  // Bar gradient [cap, mid, base]. Owner-tuned per mood — several stations
  // read best as one strong colour family (After Hours' solid red was the
  // reference); the rest get a lightened tint of their own top colour.
  const swStops = SW_PALETTES[station.id] ?? [lightenHex(eq[0], 0.45), eq[0], eq[2]];

  const { playing, setPlaying, setStationId: npSetStation, handoff } = useNowPlaying();
  const [phase, setPhase] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showMood, setShowMood] = useState(false);

  useEffect(() => {
    if (visible) getStationPlaylist(station.id).then(setLinked);
  }, [visible, station.id]);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const { progress, elapsedMs, durationMs } = useTrackClock({
    visible, playing, track: spotify.track, demoDurationMs: DEMO_DURATION_MS,
  });
  const playingRef = useRef(false);
  const ampRef = useRef(0.5);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  // Waveform animation loop — throttled to ~30fps.
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const start = Date.now();
    let last = 0;
    const tick = () => {
      const now = Date.now();
      if (now - last >= 33) {
        last = now;
        const target = playingRef.current ? 1 : 0.25;
        ampRef.current += (target - ampRef.current) * 0.08;
        setPhase(((now - start) / 1000) * PHASE_SPEED);
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
    slideY.setValue(SCREEN_H);
    ampRef.current = playingRef.current ? 1 : 0.25;
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
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

  // Real song info when we're actually connected to it; otherwise the mood's
  // own line — never a fake track. No music data = atmosphere, not pretence.
  const hasTrack = !!spotify.track;
  const title = spotify.track?.title ?? station.tagline;
  const artist = spotify.track?.artist ?? '';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const glowTint = eq[1] + '26';
  const amp = ampRef.current;

  // Rhythmic pulse — a ~112 BPM thump (sharp attack, quick decay) with an
  // accented downbeat every bar. Fades in with play energy so idle stays calm.
  // Note: playback is remote (Spotify), so this is a musical-feeling pulse,
  // not true beat detection — the app never receives the audio signal.
  const BPM = 112;
  const beats = (phase / PHASE_SPEED) * (BPM / 60);
  const beatIdx = Math.floor(beats);
  const accent = beatIdx % 4 === 0 ? 1 : 0.7;
  const energy = Math.min(1, Math.max(0, (amp - 0.5) / 0.5));
  // Softer attack + much gentler swell — a subtle sway, not a hard thump
  // (it's a musical-feeling pulse, not real beat sync, so keep it understated).
  const pulse = Math.exp(-(beats - beatIdx) * 3.2) * accent * energy;
  const ampEff = amp * (1 + 0.12 * pulse);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#05060f' }, { transform: [{ translateY: slideY }] }]} {...dismissPan.panHandlers}>

        {/* Blurred station background */}
        <StationBackdrop station={station} blurRadius={2.5} />
        <LinearGradient
          colors={[
            'rgba(3,4,16,0.30)', 'rgba(3,4,16,0.22)', 'rgba(3,4,16,0.40)',
            'rgba(3,4,16,0.55)', 'rgba(3,4,16,0.66)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', glowTint, 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.30, bottom: winH * 0.30 }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>SOUND WAVES</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
          </View>

          {/* Waveform — sits low in its area so the bars read grounded */}
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMax meet">
              <Defs>
                {/* Each bar takes the full gradient top→bottom (bright cap, mood base) */}
                <SvgGradient id="swBar" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={swStops[0]} />
                  <Stop offset="0.35" stopColor={swStops[1]} />
                  <Stop offset="1" stopColor={swStops[2]} />
                </SvgGradient>
                <RadialGradient id="swGlow" cx="0.5" cy="0.5" rx="0.5" ry="0.5">
                  <Stop offset="0" stopColor={swStops[1]} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={swStops[1]} stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {/* Soft central glow */}
              <Ellipse cx={VB_W / 2} cy={VB_H / 2} rx={VB_W * 0.46} ry={VB_H * 0.30} fill="url(#swGlow)" />

              {(() => {
                const cy = VB_H / 2;
                const slot = VB_W / NBARS;
                const barW = slot * 0.5;
                const rx = barW / 2;
                const maxUp = VB_H * 0.40;
                return barHeights(phase, ampEff).map((h, i) => {
                  const x = i * slot + (slot - barW) / 2;
                  const up = Math.max(barW, h * maxUp);   // shortest reads as a dot
                  const down = up * 0.42;                 // fainter mirror
                  return (
                    <Fragment key={i}>
                      <Rect x={x} y={cy - 2 - up} width={barW} height={up} rx={rx} ry={rx} fill="url(#swBar)" opacity={0.95} />
                      <Rect x={x} y={cy + 2} width={barW} height={down} rx={rx} ry={rx} fill="url(#swBar)" opacity={0.45} />
                    </Fragment>
                  );
                });
              })()}
            </Svg>
            <FloatingNotes playing={playing} color={swStops[1]} />
          </View>

          {/* Song title */}
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 4 }}>
            {hasTrack
              ? <MarqueeText text={title} style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} />
              : <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>{title}</Text>}
            {hasTrack && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{artist}</Text>}
          </View>

          {/* Progress — only when we're actually tracking a real song */}
          {hasTrack && (
          <View style={{ width: '100%', paddingHorizontal: 28, marginTop: 18 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <Animated.View style={{ height: 6, borderRadius: 3, width: fill, backgroundColor: '#fff' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
              <Text style={[fs.time, { fontFamily: Fonts.mono }]}>{formatMs(elapsedMs)}</Text>
              <Text style={[fs.time, { fontFamily: Fonts.mono }]}>{formatMs(durationMs)}</Text>
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

        <MicGlow active={visible && playing} color={eq[1]} />

        {handoff && !spotify.track && <HandoffOverlay />}

        <MoodSheet
          visible={showMood}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); npSetStation(id); setShowMood(false); }}
          onClose={() => setShowMood(false)}
        />

        {showPicker && (
          <PlaylistSheet
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
    width: '100%', paddingHorizontal: 30, marginTop: 18,
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
});
