import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, ImageBackground, Modal, PanResponder,
  ScrollView, StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWNER_MODE } from '@/constants/config';
import { STATIONS } from '@/constants/stations';
import { Fonts } from '@/constants/theme';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

const SCREEN_H = Dimensions.get('window').height;

// ── Theme palette ─────────────────────────────────────────────────────────────
const R = {
  bg:           '#0a0a0a',
  panel:        '#111111',
  panelMid:     '#161616',
  panelLight:   '#1c1c1c',
  border:       '#222222',
  borderLight:  '#2e2e2e',
  cyan:         '#00B4D8',
  cyanDim:      'rgba(0,180,216,0.14)',
  cyanBorder:   'rgba(0,180,216,0.30)',
  amber:        '#FFB300',
  amberDim:     'rgba(255,179,0,0.12)',
  lcdBg:        '#160D00',
  lcdBorder:    '#3A2800',
  cream:        'rgba(255,255,255,0.92)',
  textDim:      'rgba(255,255,255,0.50)',
  textFaint:    'rgba(255,255,255,0.20)',
  surface:      'rgba(255,255,255,0.04)',
  surfaceBorder:'rgba(255,255,255,0.09)',
};

// ── Data ──────────────────────────────────────────────────────────────────────
type StationKey = 'night-run' | 'rain-drive' | 'coastal' | 'mountain-pass' | 'after-midnight' | 'sunset';
type TrackItem  = { id: string; title: string; artist: string; duration: string };

const RADIO_STATIONS: Array<{ id: StationKey; name: string; freq: number; tagline: string }> = [
  { id: 'night-run',      name: 'Night Run FM',     freq: 88.7,  tagline: 'Empty expressways after dark' },
  { id: 'rain-drive',     name: 'Rain Drive FM',    freq: 91.3,  tagline: 'Wet roads, warm sound' },
  { id: 'coastal',        name: 'Coastal FM',       freq: 93.5,  tagline: 'Salt air and open lanes' },
  { id: 'mountain-pass',  name: 'Mountain Pass FM', freq: 96.1,  tagline: 'High altitude frequencies' },
  { id: 'after-midnight', name: 'After Hours FM',   freq: 99.4,  tagline: 'When the city finally sleeps' },
  { id: 'sunset',         name: 'Sunset FM',        freq: 103.7, tagline: 'Golden hour, open throttle' },
];

const STATION_TRACKS: Record<StationKey, TrackItem[]> = {
  'night-run': [
    { id: 'NR1', title: 'Neon Autobahn',    artist: 'Kairo Club',      duration: '4:22' },
    { id: 'NR2', title: 'Silver Freeway',   artist: 'Midnight Pilot',  duration: '3:55' },
    { id: 'NR3', title: 'Violet Dashboard', artist: 'Noir Turbo',      duration: '4:08' },
    { id: 'NR4', title: 'Glass & Chrome',   artist: 'Low Glow',        duration: '5:02' },
  ],
  'rain-drive': [
    { id: 'RD1', title: 'Wet Asphalt',        artist: 'Storm Pilot',   duration: '4:10' },
    { id: 'RD2', title: 'Low Visibility',     artist: 'Grey Roads',    duration: '3:40' },
    { id: 'RD3', title: 'Puddle Reflections', artist: 'Deep Current',  duration: '5:15' },
    { id: 'RD4', title: 'Hydroplane',         artist: 'Midnight Pilot',duration: '3:58' },
  ],
  'coastal': [
    { id: 'CO1', title: 'Pacific Run',   artist: 'Shoreline Drive', duration: '4:33' },
    { id: 'CO2', title: 'Salt Air',      artist: 'Coastal Noir',   duration: '3:22' },
    { id: 'CO3', title: 'Horizon Line',  artist: 'Wave Delay',     duration: '4:48' },
    { id: 'CO4', title: 'Low Tide',      artist: 'Undertow',       duration: '5:11' },
  ],
  'mountain-pass': [
    { id: 'MP1', title: 'Summit Approach', artist: 'Elevation',    duration: '4:05' },
    { id: 'MP2', title: 'Hairpin',         artist: 'Switchback',   duration: '3:44' },
    { id: 'MP3', title: 'Fog Layer',       artist: 'High Altitude',duration: '4:55' },
    { id: 'MP4', title: 'Descent',         artist: 'Noir Turbo',   duration: '5:28' },
  ],
  'after-midnight': [
    { id: 'AM1', title: 'Empty Quarter', artist: 'Dark Hours',   duration: '5:02' },
    { id: 'AM2', title: '3am Overpass',  artist: 'Kairo Club',   duration: '4:18' },
    { id: 'AM3', title: 'No Traffic',    artist: 'Zero Grid',    duration: '3:50' },
    { id: 'AM4', title: 'Ghost Highway', artist: 'Night Circuit',duration: '4:40' },
  ],
  'sunset': [
    { id: 'SU1', title: 'Golden Hour',    artist: 'Low Glow',      duration: '4:15' },
    { id: 'SU2', title: 'Amber Motorway', artist: 'Dusk Pilot',    duration: '3:38' },
    { id: 'SU3', title: 'Last Light',     artist: 'Horizon Drive', duration: '4:52' },
    { id: 'SU4', title: 'Fading Lanes',   artist: 'Sunset Circuit',duration: '5:05' },
  ],
};

function parseTrackMs(d: string): number {
  const [m, s] = d.split(':').map(Number);
  return (m * 60 + s) * 1000;
}
function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Signal bars ───────────────────────────────────────────────────────────────
function SignalBars({ playing }: { playing: boolean }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;
  const loopsRef = useRef<(Animated.CompositeAnimation | null)[]>([null, null, null, null, null]);

  useEffect(() => {
    bars.forEach((bar, i) => {
      loopsRef.current[i]?.stop();
      if (!playing) { bar.setValue(i < 4 ? 0.85 : 0.3); return; }
      const dur = 1600 + i * 500;
      const low = 0.5 + i * 0.08;
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 1,   duration: dur,       easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bar, { toValue: low, duration: dur * 0.8, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      loopsRef.current[i] = loop;
      loop.start();
    });
    return () => loopsRef.current.forEach(l => l?.stop());
  }, [playing]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{
          width: 3, height: 4 + i * 3,
          backgroundColor: R.amber, borderRadius: 1, opacity: bar,
        }} />
      ))}
    </View>
  );
}

// ── Stereo indicator ──────────────────────────────────────────────────────────
function StereoIndicator() {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1,    duration: 2400, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0.18, duration: 450,  easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1,    duration: 350,  easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0.18, duration: 280,  easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1,    duration: 280,  easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1,    duration: 800,  easing: Easing.linear, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3,
      borderWidth: 0.5, borderColor: R.amber, opacity: blink,
    }}>
      <Text style={{ color: R.amber, fontSize: 7, fontFamily: Fonts.mono, fontWeight: '700', letterSpacing: 0.5 }}>ST</Text>
    </Animated.View>
  );
}

// ── Head unit knob ────────────────────────────────────────────────────────────
function HeadUnitKnob({
  topLabel, botLabel, size = 68, onPress,
}: {
  topLabel?: string; botLabel: string; size?: number; onPress?: () => void;
}) {
  const capSize = size - 20;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ alignItems: 'center' }}>
      {/* SRC / empty label above */}
      <Text style={{
        color: R.cyan, fontSize: 7, fontFamily: Fonts.mono, fontWeight: '700',
        letterSpacing: 1.5, marginBottom: 5, opacity: topLabel ? 1 : 0,
      }}>{topLabel ?? 'X'}</Text>

      {/* Knob */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.9, shadowRadius: 8, elevation: 10,
      }}>
        {/* Dark outer body */}
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#131313', borderWidth: 1, borderColor: '#080808',
        }} />
        {/* Concentric texture rings */}
        {([0.87, 0.73, 0.59] as const).map((s, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: size * s, height: size * s, borderRadius: size * s / 2,
            borderWidth: 0.5, borderColor: `rgba(255,255,255,${0.04 + i * 0.015})`,
          }} />
        ))}
        {/* Glowing cyan accent ring */}
        <View style={{
          position: 'absolute',
          width: size - 7, height: size - 7, borderRadius: (size - 7) / 2,
          borderWidth: 2, borderColor: R.cyan,
          shadowColor: R.cyan, shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.7, shadowRadius: 5,
        }} />
        {/* Metallic center cap */}
        <LinearGradient
          colors={['#424242', '#2a2a2a', '#181818']}
          start={{ x: 0.25, y: 0 }} end={{ x: 0.75, y: 1 }}
          style={{
            width: capSize, height: capSize, borderRadius: capSize / 2,
            alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6,
            borderWidth: 1, borderColor: '#0d0d0d',
          }}
        >
          <View style={{
            width: 2.5, height: 8, borderRadius: 1.5, backgroundColor: R.cyan,
            shadowColor: R.cyan, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
          }} />
        </LinearGradient>
        {/* Shine ellipse on cap */}
        <View style={{
          position: 'absolute',
          width: capSize * 0.52, height: capSize * 0.26,
          borderRadius: capSize * 0.26,
          backgroundColor: 'rgba(255,255,255,0.10)',
          top: size / 2 - capSize / 2 + 5,
          left: size / 2 - capSize * 0.27 + 2,
        }} pointerEvents="none" />
      </View>

      {/* VOL / TUNE label below */}
      <Text style={{
        color: R.amber, fontSize: 7, fontFamily: Fonts.mono, fontWeight: '700',
        letterSpacing: 1.5, marginTop: 5,
      }}>{botLabel}</Text>
    </TouchableOpacity>
  );
}

// ── Head unit (car stereo illustration) ───────────────────────────────────────
function HeadUnit({
  stationName, trackName, displayFreq, playing, isScanning,
  onVolPress, onTunePress, onCtrlPress, onPreset, activeStation,
}: {
  stationName: string; trackName: string; displayFreq: string;
  playing: boolean; isScanning: boolean;
  onVolPress: () => void; onTunePress: () => void;
  onCtrlPress: (a: 'prev' | 'play' | 'next' | 'disp' | 'src') => void;
  onPreset: (i: number) => void; activeStation: number;
}) {
  const scrollX       = useRef(new Animated.Value(0)).current;
  const scrollLoopRef = useRef<any>(null);
  const scanFlicker   = useRef(new Animated.Value(0)).current;
  const scanLoopRef   = useRef<any>(null);
  const cursorBlink   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(cursorBlink, { toValue: 1, duration: 550, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(cursorBlink, { toValue: 0, duration: 420, easing: Easing.linear, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    scrollLoopRef.current?.stop();
    const base = `  ${stationName.toUpperCase()}  ·  `;
    const baseW = base.length * 6.6;
    scrollX.setValue(0);
    scrollLoopRef.current = Animated.loop(
      Animated.timing(scrollX, { toValue: -baseW, duration: base.length * 175, easing: Easing.linear, useNativeDriver: true })
    );
    scrollLoopRef.current.start();
    return () => scrollLoopRef.current?.stop();
  }, [stationName]);

  useEffect(() => {
    if (isScanning) {
      scanLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(scanFlicker, { toValue: 0.22, duration: 40, useNativeDriver: true }),
        Animated.timing(scanFlicker, { toValue: 0,    duration: 40, useNativeDriver: true }),
      ]));
      scanLoopRef.current.start();
    } else {
      scanLoopRef.current?.stop();
      scanFlicker.setValue(0);
    }
  }, [isScanning]);

  const base       = `  ${stationName.toUpperCase()}  ·  `;
  const scrollText = base + base;

  return (
    <View style={hu.body}>
      {/* Deep gloss body gradient */}
      <LinearGradient
        colors={['#161616', '#090909', '#050505', '#080808']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Chrome top edge */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      {/* Diagonal gloss shine */}
      <LinearGradient
        colors={['rgba(255,255,255,0.055)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.65, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bottom shadow line */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.95)' }} />

      {/* CD slot — full width illuminated slit */}
      <View style={hu.cdSlotOuter}>
        <View style={hu.cdSlot}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: R.cyan, opacity: 0.35 }} />
        </View>
      </View>

      {/* Main row: VOL | LCD | TUNE */}
      <View style={hu.mainRow}>
        <HeadUnitKnob topLabel="SRC" botLabel="VOL" size={84} onPress={onVolPress} />

        {/* LCD display — recessed into body */}
        <View style={hu.displayBezel}>
          <View style={hu.display}>
            {/* Scan flicker */}
            <Animated.View style={[StyleSheet.absoluteFill, {
              backgroundColor: 'rgba(255,200,0,0.18)', borderRadius: 2, opacity: scanFlicker,
            }]} pointerEvents="none" />
            {/* Glass reflection line */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }} pointerEvents="none" />

            {/* Frequency row */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[hu.freqText, { fontFamily: Fonts.mono }]}>{displayFreq}</Text>
              <Text style={[hu.fmLabel,  { fontFamily: Fonts.mono }]}>FM</Text>
              <View style={{ flex: 1 }} />
              <View style={{ gap: 4, alignItems: 'flex-end' }}>
                <SignalBars playing={playing} />
                <StereoIndicator />
              </View>
            </View>

            {/* Scrolling station name + blinking cursor */}
            <View style={hu.scrollClip}>
              <Animated.Text
                style={[hu.scrollText, { fontFamily: Fonts.mono, transform: [{ translateX: scrollX }] }]}
                numberOfLines={1}
              >
                {scrollText}
              </Animated.Text>
              <Animated.View style={{
                position: 'absolute', right: 0, top: 2,
                width: 1.5, height: 10, backgroundColor: R.amber, opacity: cursorBlink,
              }} pointerEvents="none" />
            </View>

            {/* Current track */}
            <View style={hu.scrollClip}>
              <Text style={[hu.trackText, { fontFamily: Fonts.mono }]} numberOfLines={1}> {trackName}</Text>
            </View>

            {/* CRT scanlines */}
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={{
                position: 'absolute', left: 0, right: 0,
                top: i * 20, height: 1, backgroundColor: 'rgba(0,0,0,0.14)',
              }} pointerEvents="none" />
            ))}
          </View>
        </View>

        <HeadUnitKnob botLabel="TUNE" size={84} onPress={onTunePress} />
      </View>

      {/* Control buttons — raised bevel */}
      <View style={hu.ctrlRow}>
        {([
          { lbl: 'DISP', a: 'disp' as const },
          { icon: 'play-back' as const, a: 'prev' as const },
          { icon: 'play' as const, a: 'play' as const },
          { icon: 'play-forward' as const, a: 'next' as const },
          { lbl: 'SRC', a: 'src' as const },
        ]).map((item) => (
          <TouchableOpacity key={item.a} onPress={() => onCtrlPress(item.a)}
            style={[hu.ctrlBtn, item.a === 'play' && hu.ctrlBtnPlay]} activeOpacity={0.65}>
            {'icon' in item
              ? <Ionicons name={item.icon} size={13} color={item.a === 'play' ? R.cyan : R.amber} />
              : <Text style={hu.ctrlText}>{item.lbl}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Preset buttons */}
      <View style={hu.presetRow}>
        {RADIO_STATIONS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => onPreset(i)}
            style={[hu.presetBtn, activeStation === i && hu.presetBtnActive]} activeOpacity={0.65}>
            <Text style={[hu.presetText, activeStation === i && hu.presetTextActive, { fontFamily: Fonts.mono }]}>{i + 1}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 8 }} />
    </View>
  );
}

// ── Frequency log (track list) ────────────────────────────────────────────────
function FrequencyLog({ stationIdx, activeTrack, onSelect }: {
  stationIdx: number; activeTrack: number; onSelect: (i: number) => void;
}) {
  const tracks = STATION_TRACKS[RADIO_STATIONS[stationIdx].id];
  return (
    <View style={{ width: '100%' }}>
      {tracks.map((track, i) => {
        const active = i === activeTrack;
        return (
          <TouchableOpacity key={track.id} onPress={() => onSelect(i)} activeOpacity={0.65}
            style={[fl.row, i > 0 && fl.divider, active && fl.rowActive]}>
            {active && <View style={fl.activeBorder} />}
            <Text style={[fl.num, { fontFamily: Fonts.mono }]}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={fl.title} numberOfLines={1}>{track.title}</Text>
              <Text style={[fl.artist, { fontFamily: Fonts.mono }]} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Text style={[fl.dur, { fontFamily: Fonts.mono }]}>{track.duration}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Fullscreen modal ──────────────────────────────────────────────────────────
export function RetroRadioFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets    = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const topPad    = Math.max(insets.top, 20);

  const initialStationIdx = Math.max(0, RADIO_STATIONS.findIndex((s) => s.id === stationId));

  const [playing,       setPlaying]       = useState(false);
  const [activeStation, setActiveStation] = useState(initialStationIdx);
  const [activeTrack,   setActiveTrack]   = useState(0);
  const [displayFreq,   setDisplayFreq]   = useState(RADIO_STATIONS[0].freq);
  const [isScanning,    setIsScanning]    = useState(false);
  const [showFreqLog,   setShowFreqLog]   = useState(false);
  const [showVol,       setShowVol]       = useState(false);
  const [volume,        setVolume]        = useState(75);
  const [shuffle,       setShuffle]       = useState(false);
  const [repeat,        setRepeat]        = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [barWidth,      setBarWidth]      = useState(300);

  const slideY        = useRef(new Animated.Value(SCREEN_H)).current;
  const progress      = useRef(new Animated.Value(0)).current;
  const freqLogAnim   = useRef(new Animated.Value(1)).current;
  const drawerY       = useRef(new Animated.Value(0)).current;
  const playBtnScale  = useRef(new Animated.Value(1)).current;
  const scrubDotScale = useRef(new Animated.Value(1)).current;

  const progressValue    = useRef(0);
  const progressAnimRef  = useRef<any>(null);
  const activeTrackRef   = useRef(0);
  const activeStationRef = useRef(0);
  const playingRef       = useRef(false);
  const isScrubbing      = useRef(false);
  const barWidthRef      = useRef(300);
  const scanTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const volTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeTrackRef.current   = activeTrack;   }, [activeTrack]);
  useEffect(() => { activeStationRef.current = activeStation; }, [activeStation]);
  useEffect(() => { playingRef.current       = playing;       }, [playing]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      progressValue.current = value;
      const tracks  = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      const trackMs = parseTrackMs(tracks[activeTrackRef.current].duration);
      setCurrentTimeMs(Math.round(value * trackMs));
    });
    return () => progress.removeListener(id);
  }, []);

  const _startProgress = (posMs: number, trackMs: number) => {
    const remaining = trackMs - posMs;
    if (remaining <= 0) return;
    progressAnimRef.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    progressAnimRef.current.start(({ finished }: { finished: boolean }) => {
      if (!finished) return;
      const tracks = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      setActiveTrack(t => {
        const n = Math.min(tracks.length - 1, t + 1);
        if (n === t) setPlaying(false);
        return n;
      });
    });
  };

  useEffect(() => {
    if (playing) {
      const tracks  = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      const trackMs = parseTrackMs(tracks[activeTrackRef.current].duration);
      _startProgress(progressValue.current * trackMs, trackMs);
    } else {
      progressAnimRef.current?.stop();
    }
    return () => { progressAnimRef.current?.stop(); };
  }, [playing]);

  // Track change resets and restarts progress
  useEffect(() => {
    progressAnimRef.current?.stop();
    progress.setValue(0); progressValue.current = 0;
    if (playingRef.current) {
      const tracks  = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      _startProgress(0, parseTrackMs(tracks[activeTrack].duration));
    }
  }, [activeTrack]);

  // Station change resets track + progress
  useEffect(() => {
    progressAnimRef.current?.stop();
    progress.setValue(0); progressValue.current = 0;
    setActiveTrack(0);
  }, [activeStation]);

  useEffect(() => {
    if (!visible) return;
    slideY.setValue(SCREEN_H);
    setPlaying(true); setActiveStation(initialStationIdx); setActiveTrack(0);
    setDisplayFreq(RADIO_STATIONS[initialStationIdx].freq); setIsScanning(false);
    progress.setValue(0); progressValue.current = 0;
    setCurrentTimeMs(0); setShowFreqLog(false); freqLogAnim.setValue(0);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => {
      progressAnimRef.current?.stop();
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [visible]);

  const handleClose = () => {
    setPlaying(false);
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  // Frequency scan animation
  const switchStation = (idx: number) => {
    if (idx === activeStation || isScanning) return;
    const startFreq  = displayFreq;
    const targetFreq = RADIO_STATIONS[idx].freq;
    setIsScanning(true);
    setPlaying(false);
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    const t0 = Date.now();
    scanTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      if (elapsed >= 1500) {
        clearInterval(scanTimerRef.current!);
        scanTimerRef.current = null;
        setDisplayFreq(targetFreq);
        setActiveStation(idx);
        setIsScanning(false);
        return;
      }
      const t      = elapsed / 1500;
      const eased  = t < 0.6 ? t * t * 2.78 : 1 - Math.pow(1 - t, 3) * 2;
      const base   = startFreq + (targetFreq - startFreq) * eased;
      const jitter = (Math.random() - 0.5) * Math.max(0, (1 - t * 1.6)) * 2.5;
      setDisplayFreq(Math.round(Math.max(87.5, Math.min(108.0, base + jitter)) * 10) / 10);
    }, 50);
  };

  const showVolSlider = () => {
    if (volTimerRef.current) clearTimeout(volTimerRef.current);
    setShowVol(true);
    volTimerRef.current = setTimeout(() => setShowVol(false), 3000);
  };

  const drawerPanRef = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 0,
    onPanResponderMove: (_, g) => { if (g.dy > 0) drawerY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) {
        setShowFreqLog(false);
        Animated.timing(freqLogAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
      } else {
        Animated.spring(drawerY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const progressPanRef = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (evt) => {
      isScrubbing.current = true;
      progressAnimRef.current?.stop();
      Animated.spring(scrubDotScale, { toValue: 1.4, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
      const pct   = Math.max(0, Math.min(1, evt.nativeEvent.locationX / barWidthRef.current));
      const tracks = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      const trackMs = parseTrackMs(tracks[activeTrackRef.current].duration);
      progress.setValue(pct);
      progressValue.current = pct;
      setCurrentTimeMs(Math.round(pct * trackMs));
    },
    onPanResponderMove: (evt) => {
      const pct   = Math.max(0, Math.min(1, evt.nativeEvent.locationX / barWidthRef.current));
      const tracks = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
      const trackMs = parseTrackMs(tracks[activeTrackRef.current].duration);
      progress.setValue(pct);
      progressValue.current = pct;
      setCurrentTimeMs(Math.round(pct * trackMs));
    },
    onPanResponderRelease: () => {
      isScrubbing.current = false;
      Animated.spring(scrubDotScale, { toValue: 1, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
      if (playingRef.current) {
        const tracks  = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
        const trackMs = parseTrackMs(tracks[activeTrackRef.current].duration);
        const posMs   = progressValue.current * trackMs;
        const remaining = trackMs - posMs;
        if (remaining > 0) {
          progressAnimRef.current = Animated.timing(progress, {
            toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
          });
          progressAnimRef.current.start(({ finished }: { finished: boolean }) => {
            if (!finished) return;
            const trx = STATION_TRACKS[RADIO_STATIONS[activeStationRef.current].id];
            setActiveTrack(t => {
              const n = Math.min(trx.length - 1, t + 1);
              if (n === t) setPlaying(false);
              return n;
            });
          });
        }
      }
    },
  })).current;

  const closeDrawer = () => {
    setShowFreqLog(false);
    Animated.timing(freqLogAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => drawerY.setValue(0));
  };
  const toggleDrawer = () => {
    const next = !showFreqLog;
    setShowFreqLog(next);
    drawerY.setValue(0);
    Animated.timing(freqLogAnim, { toValue: next ? 1 : 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const station      = RADIO_STATIONS[activeStation];
  const tracks       = STATION_TRACKS[station.id];
  const currentTrack = tracks[activeTrack];
  const spotify = useSpotifyPlayback(visible);
  const freqDisplay  = displayFreq.toFixed(1);
  const fillW        = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth] });
  const dotSize      = scrubDotScale.interpolate({ inputRange: [1, 1.4], outputRange: [14, 20] });
  const dotGlow      = scrubDotScale.interpolate({ inputRange: [1, 1.4], outputRange: [6, 16] });

  const handleCtrl = (a: 'prev' | 'play' | 'next' | 'disp' | 'src') => {
    if (a === 'play')      setPlaying(p => !p);
    else if (a === 'prev') setActiveTrack(t => Math.max(0, t - 1));
    else if (a === 'next') setActiveTrack(t => Math.min(tracks.length - 1, t + 1));
  };

  const headUnit = (
    <HeadUnit
      stationName={station.name} trackName={currentTrack.title}
      displayFreq={freqDisplay} playing={playing} isScanning={isScanning}
      onVolPress={showVolSlider}
      onTunePress={() => switchStation((activeStation + 1) % RADIO_STATIONS.length)}
      onCtrlPress={handleCtrl}
      onPreset={switchStation}
      activeStation={activeStation}
    />
  );

  const progressBar = (
    <View style={{ width: '100%', paddingHorizontal: isLandscape ? 4 : 28, marginTop: isLandscape ? 8 : 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[fs.timeText, { fontFamily: Fonts.mono }]}>{formatMs(currentTimeMs)}</Text>
        <View
          {...progressPanRef.panHandlers}
          style={{ flex: 1, height: 40, justifyContent: 'center' }}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            setBarWidth(w);
            barWidthRef.current = w;
          }}
        >
          {/* Track */}
          <View style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
          {/* Fill */}
          <Animated.View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, width: fillW, backgroundColor: '#ffffff' }} />
          {/* Draggable dot */}
          <Animated.View style={{
            position: 'absolute', left: fillW,
            width: dotSize, height: dotSize,
            borderRadius: 10,
            backgroundColor: '#ffffff',
            marginLeft: -7,
            top: '50%',
            marginTop: -7,
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
          }} />
        </View>
        <Text style={[fs.timeText, { fontFamily: Fonts.mono, textAlign: 'right' }]}>{currentTrack.duration}</Text>
      </View>
    </View>
  );

  const controls = (
    <View style={[fs.controls, isLandscape && { paddingHorizontal: 16, marginTop: 12 }]}>
      <TouchableOpacity onPress={() => setShuffle(s => !s)} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="shuffle" size={26} color={shuffle ? R.cyan : '#ffffff'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setActiveTrack(t => Math.max(0, t - 1)); spotify.prev(); }} style={fs.skipBtn} activeOpacity={0.75}>
        <MaterialCommunityIcons name="skip-previous" size={48} color="#fff" />
      </TouchableOpacity>
      <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
        <TouchableOpacity
          onPress={() => setPlaying(p => { if (p) spotify.pause(); else spotify.play(); return !p; })}
          onPressIn={() => Animated.spring(playBtnScale, { toValue: 1.05, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
          onPressOut={() => Animated.spring(playBtnScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
          style={fs.playBtn} activeOpacity={0.9}>
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
      <TouchableOpacity onPress={() => { setActiveTrack(t => Math.min(tracks.length - 1, t + 1)); spotify.next(); }} style={fs.skipBtn} activeOpacity={0.75}>
        <MaterialCommunityIcons name="skip-next" size={48} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setRepeat(r => !r)} style={fs.shuffleRepeatBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="repeat" size={26} color={repeat ? R.cyan : '#ffffff'} />
      </TouchableOpacity>
    </View>
  );

  const nowOnAir = (
    <View style={{ width: '100%', paddingHorizontal: 24, marginTop: 20 }}>
      <Text style={[{ color: R.cyan, fontSize: 8, fontWeight: '700', letterSpacing: 3, marginBottom: 6 }, { fontFamily: Fonts.mono }]}>NOW ON AIR</Text>
      <Text style={{ color: R.textDim, fontSize: 13, fontStyle: 'italic', lineHeight: 18 }}>
        {station.tagline}
      </Text>
    </View>
  );

  const presetsSection = (
    <View style={{ width: '100%', paddingHorizontal: isLandscape ? 16 : 24, marginTop: isLandscape ? 12 : 14 }}>
      <Text style={[fs.presetsLabel, { fontFamily: Fonts.mono }]}>PRESETS</Text>
      <View style={fs.presetsRow}>
        {RADIO_STATIONS.map((st, i) => (
          <TouchableOpacity key={st.id} onPress={() => switchStation(i)}
            style={[fs.presetBtn, activeStation === i && fs.presetBtnActive]} activeOpacity={0.75}>
            <Text style={[fs.presetBtnNum, activeStation === i && fs.presetBtnNumActive, { fontFamily: Fonts.mono }]}>{i + 1}</Text>
            {!isLandscape && (
              <Text style={[fs.presetBtnName, activeStation === i && fs.presetBtnNameActive]} numberOfLines={1}>
                {st.name.replace(' FM', '')}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const stationImg = STATIONS.find((s) => s.id === RADIO_STATIONS[activeStation].id)?.image ?? STATIONS[0].image;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <Animated.View style={[{ flex: 1, backgroundColor: R.bg }, { transform: [{ translateY: slideY }] }]}>

        {/* Blurred station image background */}
        <ImageBackground
          source={stationImg}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={2.5}
          resizeMode="cover"
        />
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
        <LinearGradient
          colors={['transparent', (STATIONS.find((s) => s.id === RADIO_STATIONS[activeStation].id)?.eqColors?.[1] ?? R.cyan) + '26', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: SCREEN_H * 0.40, bottom: 0 }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Floating top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>RETRO RADIO</Text>
          <TouchableOpacity style={fs.closeBtn} onPress={handleClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color={R.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Portrait layout ── */}
        {!isLandscape && (
          <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>

            {/* Station header — small top-center, Spotify style */}
            <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
              <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
            </View>

            {/* Flexible spacer — balances the composition around the hero */}
            <View style={{ flex: 1 }} />

            {/* Head unit — the hero, inset from the edges for breathing room */}
            <View style={{ width: '100%', paddingHorizontal: 20 }}>
              {headUnit}
            </View>

            {/* Song title — bottom-left, Spotify style */}
            <View style={{ alignSelf: 'stretch', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 4, alignItems: 'flex-start' }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>{spotify.track?.title ?? currentTrack.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>{spotify.track?.artist ?? currentTrack.artist}</Text>
            </View>

            {progressBar}
            {controls}

            {/* Flexible spacer — pins the playlist button to the bottom */}
            <View style={{ flex: 1 }} />

            {/* Playlist button */}
            <TouchableOpacity onPress={toggleDrawer} style={[fs.freqLogBtn, fs.playlistBtn, { marginTop: 12 }]} activeOpacity={0.7}>
              <Ionicons name="musical-notes-outline" size={14} color={R.textDim} />
              <Text style={[fs.freqLogBtnText, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>
              <Ionicons name={showFreqLog ? 'chevron-up' : 'chevron-down'} size={14} color={R.textDim} />
            </TouchableOpacity>

          </View>
        )}

        {/* ── Landscape layout ── */}
        {isLandscape && (
          <View style={{ flex: 1, flexDirection: 'row', paddingTop: topPad + 48 }}>
            {/* Left 40%: station info + controls + presets */}
            <View style={{ width: '40%', paddingLeft: 16, paddingRight: 8, justifyContent: 'center', gap: 8 }}>
              <View style={{ gap: 3 }}>
                <Text style={{ color: R.cream, fontSize: 16, fontWeight: '700' }}>{station.name}</Text>
                <Text style={[{ color: R.textDim, fontSize: 11 }, { fontFamily: Fonts.mono }]} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={[{ color: R.textFaint, fontSize: 10 }, { fontFamily: Fonts.mono }]} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
              {controls}
              {presetsSection}
            </View>

            {/* Right 60%: head unit + progress */}
            <View style={{ flex: 1, paddingRight: 12, justifyContent: 'center', gap: 0 }}>
              {headUnit}
              {progressBar}
            </View>
          </View>
        )}

        {/* Volume overlay */}
        {showVol && (
          <View style={fs.volOverlay}>
            <Text style={[fs.volLabel, { fontFamily: Fonts.mono }]}>VOL</Text>
            <View style={fs.volBars}>
              {Array.from({ length: 10 }, (_, i) => (
                <TouchableOpacity key={i} onPress={() => {
                  setVolume((i + 1) * 10);
                  if (volTimerRef.current) clearTimeout(volTimerRef.current);
                  volTimerRef.current = setTimeout(() => setShowVol(false), 2000);
                }}>
                  <View style={[fs.volBar, { opacity: volume / 100 >= (i + 1) / 10 ? 1 : 0.2 }]} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[fs.volPct, { fontFamily: Fonts.mono }]}>{volume}%</Text>
          </View>
        )}

        {/* Freq log overlay tap */}
        {showFreqLog && (
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeDrawer} activeOpacity={1} />
        )}

        {/* Freq log bottom sheet */}
        <Animated.View
          {...drawerPanRef.panHandlers}
          style={[fs.bottomSheet, {
            transform: [
              { translateY: freqLogAnim.interpolate({ inputRange: [0, 1], outputRange: [winH * 0.52, 0] }) },
              { translateY: drawerY },
            ],
            height: winH * 0.50,
            paddingBottom: Math.max(insets.bottom, 20),
          }]}
        >
          <View style={fs.sheetHandle} />
          <View style={fs.sheetHeader}>
            <Text style={[fs.sheetTitle, { fontFamily: Fonts.mono }]}>PLAYLIST</Text>
            <TouchableOpacity onPress={closeDrawer} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={20} color={R.textDim} />
            </TouchableOpacity>
          </View>

          {/* Station presets */}
          <View style={{ paddingHorizontal: 22, marginBottom: 6 }}>
            <Text style={{ color: '#ffffff', fontSize: 10.5, fontWeight: '800', letterSpacing: 3 }}>CHANGE STATION</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 6 }}>
            {RADIO_STATIONS.map((st, i) => {
              const master = STATIONS.find((x) => x.id === st.id);
              return (
                <TouchableOpacity key={st.id} onPress={() => { switchStation(i); closeDrawer(); }}
                  style={[fs.stationPill, activeStation === i && fs.stationPillActive]} activeOpacity={0.75}>
                  {master && (
                    <LinearGradient
                      colors={master.cardGradient}
                      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  {master && <MaterialCommunityIcons name={master.iconName as any} size={16} color="#ffffff" />}
                  <Text style={[fs.stationPillText, activeStation === i && { color: '#ffffff', fontWeight: '800' }]} numberOfLines={1}>
                    {st.name.replace(' FM', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Track log */}
          <View style={{ paddingHorizontal: 22, marginTop: 12, marginBottom: 4 }}>
            <Text style={[{ color: R.textFaint, fontSize: 8, fontWeight: '700', letterSpacing: 3 }, { fontFamily: Fonts.mono }]}>FREQUENCY LOG</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <FrequencyLog stationIdx={activeStation} activeTrack={activeTrack} onSelect={i => setActiveTrack(i)} />
          </ScrollView>
        </Animated.View>

      </Animated.View>
    </Modal>
  );
}

// ── Head unit styles ──────────────────────────────────────────────────────────
const hu = StyleSheet.create({
  body: {
    width: '100%', overflow: 'hidden', borderRadius: 16,
    backgroundColor: '#050505',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.9, shadowRadius: 18, elevation: 18,
  },
  cdSlotOuter: { paddingTop: 13, paddingBottom: 7 },
  cdSlot: {
    height: 4, backgroundColor: '#000',
    borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: '#1e1e1e', overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, gap: 12,
  },
  displayBezel: {
    flex: 1, borderRadius: 5,
    backgroundColor: '#000', padding: 4,
    borderWidth: 1.5, borderColor: '#111111',
    shadowColor: R.amber, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  display: {
    backgroundColor: R.lcdBg, borderRadius: 3, padding: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: '#201000',
    gap: 7, minHeight: 120,
  },
  freqText: {
    color: R.amber, fontSize: 44, fontWeight: '700', letterSpacing: 3, lineHeight: 46,
    textShadowColor: 'rgba(255,179,0,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  fmLabel:   { color: '#CC8800', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginLeft: 6, marginBottom: 4 },
  scrollClip:{ overflow: 'hidden', height: 18 },
  scrollText:{ color: '#CC8800', fontSize: 13, letterSpacing: 0.8, lineHeight: 18 },
  trackText: { color: 'rgba(204,136,0,0.65)', fontSize: 12, letterSpacing: 0.6, lineHeight: 18 },

  ctrlRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 12 },
  ctrlBtn: {
    flex: 1, height: 40, borderRadius: 5,
    backgroundColor: '#1e1e1e',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#383838',
    borderTopColor: 'rgba(255,255,255,0.14)', borderTopWidth: 1,
    borderBottomWidth: 2, borderBottomColor: '#030303',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2,
  },
  ctrlBtnPlay: { backgroundColor: '#001525', borderColor: R.cyan, borderTopColor: 'rgba(0,180,216,0.28)' },
  ctrlText:    { color: R.amber, fontSize: 11, fontFamily: 'Courier New', fontWeight: '700', letterSpacing: 0.5 },
  ctrlTextPlay:{ color: R.cyan },

  presetRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 7, paddingBottom: 2 },
  presetBtn: {
    flex: 1, height: 34, borderRadius: 5,
    backgroundColor: '#181818',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#303030',
    borderTopColor: 'rgba(255,255,255,0.09)', borderTopWidth: 1,
    borderBottomWidth: 2, borderBottomColor: '#020202',
  },
  presetBtnActive: { backgroundColor: 'rgba(0,180,216,0.14)', borderColor: R.cyan, borderTopColor: 'rgba(0,180,216,0.22)' },
  presetText:      { color: R.amber, fontSize: 12, fontWeight: '700' },
  presetTextActive:{ color: R.cyan },
});

// ── Frequency log styles ──────────────────────────────────────────────────────
const fl = StyleSheet.create({
  row:          { width: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  rowActive:    { backgroundColor: '#001a20' },
  activeBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: R.cyan },
  divider:      { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  num:          { color: R.cyan, fontSize: 16, fontWeight: '700', letterSpacing: 0.5, width: 32 },
  title:        { color: '#ffffff', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  artist:       { color: R.cyan, fontSize: 14, opacity: 0.6 },
  dur:          { color: R.amber, fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
});

// ── Fullscreen styles ─────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  topBar:    { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, zIndex: 10 },
  modeLabel: { color: R.cyan, fontSize: 9, fontWeight: '700', letterSpacing: 4 },
  closeBtn:  { position: 'absolute', right: 22, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: R.surfaceBorder, alignItems: 'center', justifyContent: 'center', zIndex: 20 },

  timeText: { color: '#ffffff', fontSize: 11, fontWeight: '600', letterSpacing: 0.2, width: 38 },

  controls:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 28, marginTop: 10, paddingVertical: 4 },
  shuffleRepeatBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipBtn:  { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  playBtn:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 14 },
  pauseBar: { width: 8, height: 30, borderRadius: 2, backgroundColor: '#0a0a12' },

  presetsLabel: { color: R.cyan, fontSize: 8, fontWeight: '700', letterSpacing: 3, marginBottom: 10 },
  presetsRow:   { flexDirection: 'row', gap: 7 },
  presetBtn:    { flex: 1, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 8, backgroundColor: R.surface, borderWidth: 1.5, borderColor: R.cyanBorder, alignItems: 'center', gap: 3 },
  presetBtnActive:    { backgroundColor: R.cyan, borderColor: R.cyan },
  presetBtnNum:       { color: R.cyan, fontSize: 14, fontWeight: '800' },
  presetBtnNumActive: { color: '#000' },
  presetBtnName:       { color: R.textFaint, fontSize: 7, textAlign: 'center' },
  presetBtnNameActive: { color: 'rgba(0,0,0,0.55)' },

  freqLogBtn:     { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: R.surface, borderWidth: 1, borderColor: R.cyanBorder },
  freqLogBtnText: { color: R.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  playlistBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  stationPill:    { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)' },
  stationPillActive: { borderColor: '#ffffff' },
  stationPillText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#111111', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: '#2a2a2a', paddingTop: 12 },
  sheetHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 10 },
  sheetTitle:  { color: R.cyan, fontSize: 8, fontWeight: '700', letterSpacing: 2 },

  volOverlay: { position: 'absolute', bottom: 140, left: '50%', marginLeft: -90, width: 180, backgroundColor: R.panel, borderRadius: 12, borderWidth: 1, borderColor: R.cyanBorder, padding: 14, alignItems: 'center', gap: 10, zIndex: 50, shadowColor: R.cyan, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 20 },
  volLabel:   { color: R.cyan, fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  volBars:    { flexDirection: 'row', gap: 7, alignItems: 'flex-end' },
  volBar:     { width: 12, height: 28, borderRadius: 3, backgroundColor: R.cyan },
  volPct:     { color: R.textDim, fontSize: 11, fontWeight: '600' },
});

// ── Preview card ──────────────────────────────────────────────────────────────
const SCROLL_TEXT = '  NIGHT RUN FM  ·  EMPTY EXPRESSWAYS  ·  88.7 FM  ';
const SCROLL_W    = SCROLL_TEXT.length * 7.2;

function PreviewKnob({ topLabel, botLabel }: { topLabel?: string; botLabel: string }) {
  const S = 54;
  const cap = S - 16;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      {topLabel
        ? <Text style={styles.knobTopLabel}>{topLabel}</Text>
        : <View style={{ height: 11 }} />}
      <View style={[styles.knobOuter, { width: S, height: S, borderRadius: S / 2 }]}>
        {/* Concentric texture rings */}
        {[S - 4, S - 10].map((d, i) => (
          <View key={i} style={{
            position: 'absolute', width: d, height: d, borderRadius: d / 2,
            borderWidth: 0.5, borderColor: '#1e1e1e',
          }} />
        ))}
        {/* Cyan accent ring */}
        <View style={{
          position: 'absolute', width: S - 16, height: S - 16, borderRadius: (S - 16) / 2,
          borderWidth: 1.5, borderColor: R.cyan, opacity: 0.65,
        }} />
        {/* Metallic cap */}
        <LinearGradient
          colors={['#2a2a2a', '#141414', '#0e0e0e', '#1e1e1e']}
          style={{
            width: cap, height: cap, borderRadius: cap / 2,
            alignItems: 'center', justifyContent: 'flex-start', paddingTop: 5,
            borderWidth: 1, borderColor: '#333',
          }}>
          {/* Indicator stick */}
          <View style={{ width: 2, height: 6, backgroundColor: R.cyan, borderRadius: 1, shadowColor: R.cyan, shadowOpacity: 0.9, shadowRadius: 4 }} />
        </LinearGradient>
      </View>
      <Text style={styles.knobLabel}>{botLabel}</Text>
    </View>
  );
}

export function RetroRadioPreview() {
  const scrollX     = useRef(new Animated.Value(0)).current;
  const signalAnim  = useRef(new Animated.Value(0.4)).current;
  const freqFlicker = useRef(new Animated.Value(1)).current;
  const [isActive,   setIsActive]  = useState(false);
  const [modalOpen,  setModalOpen] = useState(false);

  // Idle frequency flicker — always running
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(freqFlicker, { toValue: 1,    duration: 2200, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 0.82, duration: 70,   easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 1,    duration: 55,   easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 1,    duration: 1400, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 0.68, duration: 50,   easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 1,    duration: 90,   easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(freqFlicker, { toValue: 1,    duration: 3500, easing: Easing.linear, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const startAnimations = () => {
    scrollX.setValue(0);
    Animated.loop(Animated.timing(scrollX, { toValue: -SCROLL_W / 2, duration: 9000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(signalAnim, { toValue: 1,   duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(signalAnim, { toValue: 0.4, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  };
  const stopAnimations = () => {
    scrollX.stopAnimation(); signalAnim.stopAnimation(); signalAnim.setValue(0.4);
  };

  const handlePress = () => {
    if (OWNER_MODE) { stopAnimations(); setIsActive(false); setModalOpen(true); return; }
    if (isActive) { stopAnimations(); setIsActive(false); }
    else          { startAnimations(); setIsActive(true); }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={styles.scene}>
      {/* Cyan ambient glow */}
      <View style={styles.cyanGlow} />

      <View style={styles.tapHint}>
        <Ionicons name={!OWNER_MODE && isActive ? 'pause' : 'play'} size={9} color="rgba(255,255,255,0.45)" />
        <Text style={styles.tapHintText}>{OWNER_MODE ? 'tap to open' : isActive ? 'tap to stop' : 'tap to play'}</Text>
      </View>

      <View style={styles.unit}>
        {/* Chrome top edge */}
        <View style={{ height: 2, backgroundColor: '#2e2e2e', marginHorizontal: -14, marginTop: -8 }} />
        {/* Diagonal shine */}
        <View style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 22, opacity: 0.04, backgroundColor: '#fff', transform: [{ skewY: '-2deg' }] }} pointerEvents="none" />

        <View style={styles.cdSlotRow}><View style={styles.cdSlot} /></View>

        <View style={styles.mainRow}>
          <View style={styles.knobSection}>
            <PreviewKnob topLabel="SRC" botLabel="VOL" />
          </View>

          <View style={styles.displayBezel}>
            <View style={styles.display}>
              <Animated.Text style={[styles.freqText, { opacity: freqFlicker }]}>88.7</Animated.Text>
              <Text style={styles.fmText}>FM</Text>
              <View style={styles.scrollClip}>
                {isActive ? (
                  <Animated.Text style={[styles.scrollText, { transform: [{ translateX: scrollX }] }]} numberOfLines={1}>
                    {SCROLL_TEXT + SCROLL_TEXT}
                  </Animated.Text>
                ) : (
                  <Text style={styles.scrollText} numberOfLines={1}>  NIGHT RUN FM</Text>
                )}
              </View>
              <View style={styles.statusIcons}>
                <View style={styles.signalRow}>
                  {[3, 5, 7, 9].map((h, i) => (
                    <Animated.View key={i} style={[styles.signalBar, { height: h, opacity: i === 3 ? signalAnim : (i < 3 ? 1 : 0.35) }]} />
                  ))}
                </View>
                <MaterialCommunityIcons name="star-four-points" size={8} color="#CC8800" />
                <MaterialCommunityIcons name="music-note" size={8} color="#CC8800" />
              </View>
              <View style={styles.scanlines} pointerEvents="none" />
            </View>
          </View>

          <View style={styles.knobSection}>
            <PreviewKnob botLabel="TUNE" />
          </View>
        </View>

        <View style={styles.controlRow}>
          {([
            { lbl: 'DISP' },
            { icon: 'play-back' as const },
            { icon: 'play' as const, play: true },
            { icon: 'play-forward' as const },
            { lbl: 'SRC' },
          ]).map((item, idx) => (
            <View key={idx} style={[styles.ctrlBtn, ('play' in item) && styles.ctrlBtnPlay]}>
              {'icon' in item
                ? <Ionicons name={item.icon} size={9} color={'play' in item ? R.cyan : R.amber} />
                : <Text style={styles.ctrlText}>{item.lbl}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.presetRow}>
          {['1', '2', '3', '4', '5', '6'].map((n) => (
            <View key={n} style={styles.presetBtn}>
              <Text style={styles.presetText}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {OWNER_MODE && <RetroRadioFullscreen visible={modalOpen} onClose={() => setModalOpen(false)} />}
    </TouchableOpacity>
  );
}

// ── Preview styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scene: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a12',
  },
  cyanGlow: {
    position: 'absolute', width: 260, height: 100,
    borderRadius: 130, backgroundColor: '#00BFFF', opacity: 0.09,
  },
  tapHint: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  tapHintText: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '600' },
  unit: {
    width: '100%', backgroundColor: '#050505',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#1a1a1a',
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.85, shadowRadius: 12, elevation: 16,
  },
  cdSlotRow: { alignItems: 'center' },
  cdSlot: {
    width: '100%', height: 4, backgroundColor: '#000',
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#1e1e1e',
    shadowColor: R.cyan, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  knobSection: { alignItems: 'center' },
  knobTopLabel: { color: R.cyan, fontSize: 7, fontFamily: 'Courier New', letterSpacing: 1.5, fontWeight: '700', height: 11 },
  knobLabel:    { color: R.amber, fontSize: 7, fontFamily: 'Courier New', letterSpacing: 1.5, fontWeight: '700', marginTop: 2 },
  knobOuter: {
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#222',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 10,
  },
  displayBezel: {
    flex: 1, borderRadius: 4, backgroundColor: '#000', padding: 3,
    borderWidth: 1.5, borderColor: '#111',
    shadowColor: R.amber, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 8,
  },
  display: {
    backgroundColor: R.lcdBg, borderRadius: 2, padding: 7,
    overflow: 'hidden', borderWidth: 1, borderColor: '#201000', gap: 4, minHeight: 78,
  },
  freqText: {
    color: R.amber, fontSize: 28, fontWeight: '700', letterSpacing: 2.5, lineHeight: 30,
    textShadowColor: 'rgba(255,179,0,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  fmText:     { position: 'absolute', top: 12, right: 30, color: '#CC8800', fontSize: 10, fontFamily: 'Courier New', fontWeight: '700', letterSpacing: 1 },
  scrollClip: { overflow: 'hidden', height: 14 },
  scrollText: { color: '#CC8800', fontSize: 10, fontFamily: 'Courier New', letterSpacing: 0.8, lineHeight: 14 },
  scanlines:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', borderRadius: 4, opacity: 0.06 },
  statusIcons:{ position: 'absolute', top: 6, right: 6, gap: 3, alignItems: 'center' },
  signalRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  signalBar:  { width: 2.5, backgroundColor: R.amber, borderRadius: 0.5 },
  iconText:   { color: '#CC8800', fontSize: 8, fontFamily: 'Courier New' },
  controlRow: { flexDirection: 'row', gap: 5 },
  ctrlBtn: {
    flex: 1, height: 26, borderRadius: 3, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#383838',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)',
    borderBottomWidth: 2, borderBottomColor: '#030303',
  },
  ctrlBtnPlay:  { backgroundColor: '#001525', borderColor: R.cyan, borderTopColor: 'rgba(0,180,216,0.28)' },
  ctrlText:     { color: R.amber, fontSize: 7, fontFamily: 'Courier New', fontWeight: '700', letterSpacing: 0.3 },
  ctrlTextPlay: { color: R.cyan },
  presetRow: { flexDirection: 'row', gap: 5 },
  presetBtn: {
    flex: 1, height: 22, borderRadius: 3, backgroundColor: '#181818', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#303030',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)',
    borderBottomWidth: 2, borderBottomColor: '#020202',
  },
  presetText: { color: R.amber, fontSize: 8, fontFamily: 'Courier New', fontWeight: '700' },
});
