import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Easing, Image, ImageBackground, Modal, PanResponder,
  StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaylistSheet } from '@/components/PlaylistSheet';
import { STATIONS } from '@/constants/stations';
import { Fonts } from '@/constants/theme';
import { getStationPlaylist, setStationPlaylist, type LinkedPlaylist } from '@/utils/stationPlaylists';
import { useSpotifyPlayback } from '@/utils/useSpotifyPlayback';

const SCREEN_H = Dimensions.get('window').height;

// ── Palette ───────────────────────────────────────────────────────────────────
const IP = {
  bg:         '#0a0a0a',
  // Signature iPod silver — cool brushed aluminium with shading
  silverTop:  '#e7e9ed',
  silverHi:   '#f9fafb',
  silverMid:  '#c9ccd3',
  silverLo:   '#aaadb5',
  silverEdge: '#7f8188',
  lcd:        '#fdfdfd',
  lcdShade:   '#eef1f4',
  ink:        '#1a1a1a',
  inkDim:     '#6b6b6b',
  selTop:     '#4a9bec',
  selBot:     '#2f6fd0',
  wheelHi:    '#eef0f3',
  wheelMid:   '#d6d8de',
  wheelLo:    '#bdc0c7',
  wheelLabel: '#83868e',
  textDim:    'rgba(255,255,255,0.50)',
};

// ── Classic iPod main menu ─────────────────────────────────────────────────────
const MENU = ['Music', 'Videos', 'Photos', 'Podcasts', 'Extras', 'Settings', 'Shuffle Songs', 'Now Playing'];

// Demo playback timing (Spotify hook gives us title/artist but no position).
const DEMO_DURATION_MS = 214000; // 3:34

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Tiny battery glyph ─────────────────────────────────────────────────────────
function Battery() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: 17, height: 9, borderRadius: 1.5, borderWidth: 1, borderColor: '#333',
        padding: 1, justifyContent: 'center',
      }}>
        <View style={{ width: '78%', height: '100%', borderRadius: 0.5, backgroundColor: '#5bd15b' }} />
      </View>
      <View style={{ width: 1.5, height: 4, backgroundColor: '#333', marginLeft: 0.5, borderRadius: 1 }} />
    </View>
  );
}

// ── LCD status bar ──────────────────────────────────────────────────────────────
function StatusBar({ title, playing }: { title: string; playing: boolean }) {
  return (
    <View style={lcd.statusBar}>
      <LinearGradient
        colors={['#f6f8fb', '#dfe4ea']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[lcd.statusTitle, { fontFamily: Fonts.mono }]} numberOfLines={1}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MaterialCommunityIcons name={playing ? 'play' : 'pause'} size={11} color="#333" />
        <Battery />
      </View>
    </View>
  );
}

// ── LCD: menu list view ─────────────────────────────────────────────────────────
function MenuView({ selected, artwork, station, onPick }: { selected: number; artwork: any; station: string; onPick: (i: number) => void }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Left: scrolling menu list */}
      <View style={{ flex: 1.28, paddingTop: 2 }}>
        {MENU.map((item, i) => {
          const active = i === selected;
          return (
            <TouchableOpacity key={item} activeOpacity={0.7} onPress={() => onPick(i)} style={[lcd.menuRow, active && lcd.menuRowActive]}>
              {active && (
                <LinearGradient
                  colors={[IP.selTop, IP.selBot]}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[lcd.menuText, active && lcd.menuTextActive]} numberOfLines={1}>{item}</Text>
              {active && <Ionicons name="chevron-forward" size={13} color="#fff" />}
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Right: album-art pane */}
      <View style={lcd.artPane}>
        <Image source={artwork} style={lcd.artImg} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={lcd.artLabel} numberOfLines={2}>{station}</Text>
      </View>
    </View>
  );
}

// ── LCD: now playing view ───────────────────────────────────────────────────────
function NowPlayingView({
  artwork, title, artist, trackNo, elapsedMs, fill,
}: {
  artwork: any; title: string; artist: string; trackNo: string;
  elapsedMs: number; fill: Animated.AnimatedInterpolation<string | number>;
}) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', padding: 8, gap: 10 }}>
      <Image source={artwork} style={lcd.npArt} resizeMode="cover" />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[lcd.npTrackNo, { fontFamily: Fonts.mono }]}>{trackNo}</Text>
        <Text style={lcd.npTitle} numberOfLines={2}>{title}</Text>
        <Text style={lcd.npArtist} numberOfLines={1}>{artist}</Text>

        {/* Progress */}
        <View style={{ marginTop: 8 }}>
          <View style={lcd.npTrack}>
            <Animated.View style={[lcd.npFill, { width: fill }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
            <Text style={[lcd.npTime, { fontFamily: Fonts.mono }]}>{formatMs(elapsedMs)}</Text>
            <Text style={[lcd.npTime, { fontFamily: Fonts.mono }]}>-{formatMs(DEMO_DURATION_MS - elapsedMs)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── The iPod device ─────────────────────────────────────────────────────────────
function IpodDevice({
  width, view, selected, artwork, station, title, artist, trackNo, playing,
  elapsedMs, fill, onWheelStep, onPickItem, onMenu, onCenter, onPrev, onNext, onPlayPause,
}: {
  width: number; view: 'menu' | 'now'; selected: number; artwork: any; station: string;
  title: string; artist: string; trackNo: string; playing: boolean;
  elapsedMs: number; fill: Animated.AnimatedInterpolation<string | number>;
  onWheelStep: (dir: 1 | -1) => void; onPickItem: (i: number) => void;
  onMenu: () => void; onCenter: () => void; onPrev: () => void; onNext: () => void; onPlayPause: () => void;
}) {
  const height = width * 1.63;
  const screenW = width * 0.82;
  const screenH = screenW * 0.75;
  const wheel = width * 0.62;
  const center = wheel * 0.38;

  // Rotational wheel gesture — accumulate angle, step every ~28°.
  // Capture-phase so a deliberate drag steals from the tap zones, while a
  // plain tap still fires MENU / prev / next / play buttons underneath.
  const wheelRef = useRef<View>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const angleRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const stepRef = useRef(onWheelStep);
  stepRef.current = onWheelStep;
  const measure = () => wheelRef.current?.measureInWindow((x, y, w, h) => {
    centerRef.current = { x: x + w / 2, y: y + h / 2 };
  });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.hypot(g.dx, g.dy) > 4,
      onPanResponderGrant: () => { angleRef.current = null; accRef.current = 0; measure(); },
      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const c = centerRef.current;
        const a = Math.atan2(pageY - c.y, pageX - c.x);
        if (angleRef.current !== null) {
          let d = a - angleRef.current;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          accRef.current += d;
          const step = 0.49; // ~28°
          while (accRef.current > step) { stepRef.current(1); accRef.current -= step; }
          while (accRef.current < -step) { stepRef.current(-1); accRef.current += step; }
        }
        angleRef.current = a;
      },
      onPanResponderRelease: () => { angleRef.current = null; accRef.current = 0; },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={[dev.body, { width, height, borderRadius: width * 0.11 }]}>
      {/* Base metallic vertical sheen */}
      <LinearGradient
        colors={[IP.silverTop, IP.silverHi, IP.silverMid, IP.silverLo]}
        locations={[0, 0.18, 0.62, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Curved-metal edge shading — darker down both sides */}
      <LinearGradient
        colors={['rgba(50,52,60,0.24)', 'transparent', 'transparent', 'rgba(50,52,60,0.28)']}
        locations={[0, 0.13, 0.87, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Diagonal gloss highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.10)', 'transparent']}
        locations={[0, 0.32, 0.6]}
        start={{ x: 0.08, y: 0 }} end={{ x: 0.6, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bright top rim */}
      <View style={{ position: 'absolute', top: 0, left: '7%', right: '7%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1 }} pointerEvents="none" />

      {/* Screen bezel */}
      <View style={{ alignItems: 'center', marginTop: height * 0.055 }}>
        <View style={[dev.bezel, { width: screenW + 14, height: screenH + 14, borderRadius: 6 }]}>
          <View style={[dev.screen, { width: screenW, height: screenH }]}>
            <StatusBar title={view === 'menu' ? 'iPod' : 'Now Playing'} playing={playing} />
            {view === 'menu'
              ? <MenuView selected={selected} artwork={artwork} station={station} onPick={onPickItem} />
              : <NowPlayingView artwork={artwork} title={title} artist={artist} trackNo={trackNo} elapsedMs={elapsedMs} fill={fill} />}
          </View>
        </View>
      </View>

      {/* Click wheel */}
      <View style={{ alignItems: 'center', marginTop: height * 0.05 }}>
        <View ref={wheelRef} onLayout={measure} style={[dev.wheelWrap, { width: wheel, height: wheel, borderRadius: wheel / 2 }]} {...pan.panHandlers}>
          <LinearGradient
            colors={[IP.wheelHi, IP.wheelMid, IP.wheelLo]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: wheel / 2 }]}
          />
          {/* recessed inner shading ring */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: wheel / 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)' }} />
          {/* MENU */}
          <TouchableOpacity onPress={onMenu} style={[dev.wheelZone, { top: 0, left: 0, right: 0, height: wheel * 0.3 }]} activeOpacity={0.6}>
            <Text style={dev.wheelLabel}>MENU</Text>
          </TouchableOpacity>
          {/* Prev */}
          <TouchableOpacity onPress={onPrev} style={[dev.wheelZone, { left: 0, top: wheel * 0.3, bottom: wheel * 0.3, width: wheel * 0.3 }]} activeOpacity={0.6}>
            <MaterialCommunityIcons name="skip-backward" size={wheel * 0.11} color={IP.wheelLabel} />
          </TouchableOpacity>
          {/* Next */}
          <TouchableOpacity onPress={onNext} style={[dev.wheelZone, { right: 0, top: wheel * 0.3, bottom: wheel * 0.3, width: wheel * 0.3 }]} activeOpacity={0.6}>
            <MaterialCommunityIcons name="skip-forward" size={wheel * 0.11} color={IP.wheelLabel} />
          </TouchableOpacity>
          {/* Play/Pause */}
          <TouchableOpacity onPress={onPlayPause} style={[dev.wheelZone, { bottom: 0, left: 0, right: 0, height: wheel * 0.3 }]} activeOpacity={0.6}>
            <MaterialCommunityIcons name="play-pause" size={wheel * 0.12} color={IP.wheelLabel} />
          </TouchableOpacity>
          {/* Center select */}
          <TouchableOpacity
            onPress={onCenter}
            style={[dev.center, { width: center, height: center, borderRadius: center / 2 }]}
            activeOpacity={0.7}>
            <LinearGradient
              colors={[IP.wheelHi, IP.wheelMid, IP.wheelLo]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: center / 2 }]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Fullscreen modal ────────────────────────────────────────────────────────────
export function IpodClassicFullscreen({ visible, onClose, stationId }: { visible: boolean; onClose: () => void; stationId?: string }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const topPad = Math.max(insets.top, 20);

  const station = STATIONS.find((s) => s.id === stationId) ?? STATIONS[0];
  const spotify = useSpotifyPlayback(visible);

  const [view, setView] = useState<'menu' | 'now'>('menu');
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [linked, setLinked] = useState<LinkedPlaylist | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => { if (visible) getStationPlaylist(station.id).then(setLinked); }, [visible, station.id]);

  const slideY   = useRef(new Animated.Value(SCREEN_H)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null);
  const playingRef = useRef(false);

  useEffect(() => { playingRef.current = playing; }, [playing]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setElapsedMs(value * DEMO_DURATION_MS));
    return () => progress.removeListener(id);
  }, []);

  const startProgress = (fromMs: number) => {
    const remaining = DEMO_DURATION_MS - fromMs;
    if (remaining <= 0) return;
    progressAnim.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
    });
    progressAnim.current.start(({ finished }) => {
      if (!finished) return;
      progress.setValue(0);
      if (playingRef.current) startProgress(0);
    });
  };

  useEffect(() => {
    if (playing) startProgress((progress as any)._value * DEMO_DURATION_MS);
    else progressAnim.current?.stop();
    return () => progressAnim.current?.stop();
  }, [playing]);

  // Open / reset
  useEffect(() => {
    if (!visible) return;
    slideY.setValue(SCREEN_H);
    setView('menu'); setSelected(0); setPlaying(false);
    progress.setValue(0); setElapsedMs(0);
    Animated.spring(slideY, { toValue: 0, tension: 50, friction: 12, useNativeDriver: true }).start();
    return () => progressAnim.current?.stop();
  }, [visible]);

  const handleClose = () => {
    setPlaying(false);
    progressAnim.current?.stop();
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(onClose);
  };

  const resetTrack = () => { progress.setValue(0); setElapsedMs(0); };

  const startPlaying = () => { setPlaying(true); spotify.play(); };
  const togglePlay = () => setPlaying((p) => { if (p) spotify.pause(); else spotify.play(); return !p; });

  // Selecting a menu item — Music opens the playlist picker (iPod-native way
  // to choose what plays); Now Playing / Shuffle open the player. Rest cosmetic.
  const activate = (item: string) => {
    if (item === 'Music') { setShowPicker(true); }
    else if (item === 'Now Playing') { setView('now'); }
    else if (item === 'Shuffle Songs') { setView('now'); resetTrack(); startPlaying(); }
  };
  const onCenter = () => {
    if (view === 'menu') activate(MENU[selected]);
    else togglePlay();
  };
  const onPickItem = (i: number) => { setSelected(i); activate(MENU[i]); };

  const onMenu = () => { if (view === 'now') setView('menu'); };
  const onWheelStep = (dir: 1 | -1) => {
    if (view !== 'menu') return;
    setSelected((s) => Math.max(0, Math.min(MENU.length - 1, s + dir)));
  };
  const onPrev = () => { resetTrack(); spotify.prev(); };
  const onNext = () => { resetTrack(); spotify.next(); };

  const title  = spotify.track?.title  ?? 'Neon Autobahn';
  const artist = spotify.track?.artist ?? 'Cruise FM';
  const fill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const deviceW = Math.min(winW * 0.76, 306, winH * 0.47);
  const glowTint = (station.eqColors?.[1] ?? '#5B7BFF') + '26';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[{ flex: 1, backgroundColor: IP.bg }, { transform: [{ translateY: slideY }] }]}>

        {/* Blurred station background */}
        <ImageBackground
          source={station.image}
          style={StyleSheet.absoluteFill}
          imageStyle={{ width: '100%', height: '100%' }}
          blurRadius={3.5}
          resizeMode="cover"
        />
        <LinearGradient
          colors={[
            'rgba(2,2,12,0.22)', 'rgba(2,2,12,0.14)', 'rgba(2,2,12,0.30)',
            'rgba(2,2,12,0.46)', 'rgba(2,2,12,0.58)',
          ]}
          locations={[0, 0.4, 0.65, 0.85, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', glowTint, 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: winH * 0.38, bottom: 0 }}
          pointerEvents="none"
        />

        {/* Drag pill */}
        <View style={{ position: 'absolute', top: topPad + 4, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </View>

        {/* Top bar */}
        <View style={[fs.topBar, { top: topPad + 14 }]}>
          <Text style={[fs.modeLabel, { fontFamily: Fonts.mono }]}>IPOD</Text>
          <TouchableOpacity style={fs.closeBtn} onPress={handleClose} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
            <Ionicons name="close" size={17} color={IP.textDim} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ flex: 1, paddingTop: topPad + 52, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          {/* PLAYING FROM header */}
          <View style={{ alignItems: 'center', gap: 3, paddingHorizontal: 32, paddingBottom: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 2 }}>PLAYING FROM</Text>
            <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>{station.name}</Text>
          </View>

          {/* iPod device */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <IpodDevice
              width={deviceW}
              view={view}
              selected={selected}
              artwork={station.image}
              station={station.name}
              title={title}
              artist={artist}
              trackNo={`${selected + 1} of ${station.trackCount}`}
              playing={playing}
              elapsedMs={elapsedMs}
              fill={fill}
              onWheelStep={onWheelStep}
              onPickItem={onPickItem}
              onMenu={onMenu}
              onCenter={onCenter}
              onPrev={onPrev}
              onNext={onNext}
              onPlayPause={togglePlay}
            />
          </View>

          {/* Hint */}
          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
              {view === 'menu' ? 'Spin the wheel · press ● to select' : 'MENU to go back · ● to play/pause'}
            </Text>
          </View>
        </View>

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

// ── Styles ──────────────────────────────────────────────────────────────────────
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
});

const dev = StyleSheet.create({
  body: {
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: IP.silverEdge,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55, shadowRadius: 24, elevation: 18,
  },
  bezel: {
    backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#0a0a0a',
  },
  screen: {
    backgroundColor: IP.lcd,
    overflow: 'hidden',
    borderRadius: 2,
  },
  wheelWrap: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  wheelZone: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  wheelLabel: { color: IP.wheelLabel, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  center: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
});

const lcd = StyleSheet.create({
  statusBar: {
    height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#c2c8d0',
    overflow: 'hidden',
  },
  statusTitle: { color: IP.ink, fontSize: 10, fontWeight: '800', flex: 1 },

  menuRow: {
    height: 15.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 6, overflow: 'hidden',
  },
  menuRowActive: {},
  menuText: { color: IP.ink, fontSize: 10.5, fontWeight: '700' },
  menuTextActive: { color: '#fff' },
  menuChevron: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },

  artPane: { flex: 1, margin: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#222', justifyContent: 'flex-end' },
  artImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  artLabel: { color: '#fff', fontSize: 8.5, fontWeight: '800', padding: 4, letterSpacing: 0.2 },

  npArt: { width: '42%', aspectRatio: 1, borderRadius: 4, backgroundColor: '#222' },
  npTrackNo: { color: IP.inkDim, fontSize: 8.5, fontWeight: '700', marginBottom: 2 },
  npTitle: { color: IP.ink, fontSize: 12, fontWeight: '800', lineHeight: 15 },
  npArtist: { color: IP.inkDim, fontSize: 10, fontWeight: '600', marginTop: 1 },
  npTrack: { height: 4, borderRadius: 2, backgroundColor: '#d5dae0', overflow: 'hidden' },
  npFill: { height: 4, borderRadius: 2, backgroundColor: IP.selBot },
  npTime: { color: IP.inkDim, fontSize: 8, fontWeight: '700' },
});
