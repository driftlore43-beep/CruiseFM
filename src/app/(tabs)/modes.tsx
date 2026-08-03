import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ModeThumb, type ModeThumbId } from '@/components/ModeThumb';
import { StationSheet } from '@/components/StationSheet';
import { defaultStationForNow, loadLastCruise } from '@/utils/lastCruise';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { useEntitlements } from '@/context/EntitlementsContext';
import { Cruise, PAGE_GUTTER, TAB_SAFE_INSET } from '@/constants/theme';

/**
 * SHOW THE MODE, DON'T DESCRIBE IT (owner's pick, 29.07 — "direction Q",
 * replacing the glass gradient cards settled on 28.07).
 *
 * The old page gave every mode a coloured slab and a sentence, which meant a
 * new user could not tell what Horizon or Circular EQ were without opening
 * them — and the modes are the one part of Cruise FM nobody else has. Each
 * one now carries a still picture of itself (ModeThumb), the newest gets a
 * large hero, and everything else is a calm list.
 *
 * Retired with the slabs: the featured Cassette card, the spinning reels, the
 * glass pane, the card glitter and the premium shimmer. Cassette is a row
 * like the others now — the hero slot belongs to whatever is newest, which is
 * a promise the page can keep, unlike "featured" which never changed.
 */

type ModeDef = {
  id: ModeThumbId;
  title: string;
  desc: string;
  colors: [string, string, string];
  pro: boolean;
};

// Order is deliberate: the list reads free-first, and inside each group the
// modes are ordered roughly by how much there is to look at.
const MODES: ModeDef[] = [
  { id: 'equalizer', title: 'Equalizer',   desc: "LED bars pulsing with your station's mood colours.", colors: ['#164a6a', '#2b7fa8', '#6fd6ff'], pro: false },
  { id: 'orb',       title: 'Circular EQ', desc: 'A glowing orb that pulses and radiates to the beat.', colors: ['#2a1550', '#7a2ac0', '#e07aff'], pro: false },
  { id: 'cassette',  title: 'Cassette',    desc: 'Spinning reels, retro tuner culture, purple cabin glow.', colors: ['#1c0f3a', '#4b2b8a', '#a07aff'], pro: false },
  { id: 'vinyl',     title: 'Vinyl',       desc: 'A rotating analogue record with a silver tonearm.', colors: ['#3a180a', '#8a3a18', '#e0813d'], pro: true },
  { id: 'radio',     title: 'Tuner',       desc: 'Drag the dial — glide between moods and lock on.', colors: ['#1a4a5a', '#3a6aa8', '#6ad6e0'], pro: true },
  { id: 'horizon',   title: 'Horizon',     desc: 'An endless outrun grid rolling into a glowing sun.', colors: ['#200a45', '#8a2a7a', '#ff5aa0'], pro: true },
  { id: 'cd',        title: 'CD',          desc: 'Your album on a mirrored disc behind jewel-case plastic.', colors: ['#141a2e', '#5a6f9a', '#b0c6ff'], pro: true },
  { id: 'disco',     title: 'Mirror Ball', desc: 'A slow-turning mirror ball scattering light across the drive.', colors: ['#22242c', '#8a92a4', '#e8edf6'], pro: true },
];

/** Whichever mode leads the page. Change this when a newer one lands. */
const HERO_ID: ModeThumbId = 'disco';

/**
 * Press feedback (owner, 29.07 — "direction D"): everything you can tap
 * settles under your thumb and springs back. It is felt rather than seen and
 * it is a disproportionate share of what makes an app feel built rather than
 * assembled. Native driver, so it never stutters against a scroll.
 */
function Pressy({
  onPress, children, style, scaleTo = 0.97,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
  scaleTo?: number;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 42, bounciness: 5 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: s }] }, style]}>
      <Pressable onPress={onPress} onPressIn={() => to(scaleTo)} onPressOut={() => to(1)}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function HeroMode({ mode, locked, onPress }: { mode: ModeDef; locked: boolean; onPress: () => void }) {
  return (
    <Pressy onPress={onPress} style={styles.heroWrap} scaleTo={0.985}>
      <View style={styles.hero}>
        <ModeThumb mode={mode.id} size={HERO_ART} colors={mode.colors} uid={`hero${mode.id}`} />
        {/* The thumb is square; the card is wider, so it is centred behind a
            scrim that carries the type. A gradient, not a flat wash: a flat
            one dulls the whole picture to pay for the two lines at the
            bottom, which is the opposite of showing the mode off. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.heroScrim}
          pointerEvents="none"
        />
        <View style={styles.heroFoot}>
          <Text style={styles.heroEyebrow}>NEWEST</Text>
          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroDesc} numberOfLines={1}>{mode.desc}</Text>
        </View>
        {locked && (
          <View style={styles.heroLock}>
            <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroLockText}>PREMIUM</Text>
          </View>
        )}
      </View>
    </Pressy>
  );
}

function ModeRow({ mode, locked, last, onPress }: {
  mode: ModeDef; locked: boolean; last: boolean; onPress: () => void;
}) {
  return (
    <Pressy onPress={onPress}>
      <View style={[styles.row, !last && styles.rowRule]}>
        <View style={styles.thumbClip}>
          <ModeThumb mode={mode.id} size={THUMB} colors={mode.colors} uid={`row${mode.id}`} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle}>{mode.title}</Text>
          <Text style={styles.rowDesc} numberOfLines={1}>{mode.desc}</Text>
        </View>
        {locked
          ? <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.45)" />
          : <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.28)" />}
      </View>
    </Pressy>
  );
}

const THUMB = 62;
const HERO_H = 250;
// The art sits above the type rather than behind it — a hero whose subject
// is half-buried under its own caption reads as a cropped picture.
const HERO_ART = 202;

export default function ModesScreen() {
  const insets = useSafeAreaInsets();
  const np = useNowPlaying();
  const { isPro } = useEntitlements();

  // Picking a mode asks which MOOD to open it on (owner, 03.08). It used to
  // go straight in, and `np.open` defaults its stationId to a hardcoded
  // 'night-run', so any other mood meant backing out to the Stations page and
  // coming in the other way. The sheet is pre-ticked with the last cruise's
  // station, or the hour's own pick on a first run, so the common case is one
  // extra tap on something already highlighted.
  const [pending, setPending] = useState<{ mode: string; locked: boolean } | null>(null);
  const [lastStation, setLastStation] = useState<string>(defaultStationForNow());
  useEffect(() => {
    loadLastCruise().then((c) => { if (c?.stationId) setLastStation(c.stationId); }).catch(() => {});
  }, []);

  function open(mode: string, locked: boolean) {
    setPending({ mode, locked });
  }

  function start(stationId: string) {
    if (!pending) return;
    // A real drive, exactly like the Stations page. It used to open PAUSED,
    // which made sense while tapping a mode meant "let me look at this one" —
    // but since the mood sheet landed (03.08) you pick a mode AND a station
    // before anything opens, which is a drive by any reading. Opening idle
    // also meant `playStationMusic` never ran, so the station's playlist
    // never started and Spotify was never woken (owner: "the redirect doesn't
    // open for … modes page -> stations mood -> plain mode").
    np.open(pending.mode, stationId, { preview: pending.locked });
    setLastStation(stationId);
    setPending(null);
  }

  const hero = MODES.find((m) => m.id === HERO_ID)!;
  const free = MODES.filter((m) => !m.pro);
  const pro = MODES.filter((m) => m.pro);

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 26, paddingBottom: TAB_SAFE_INSET + insets.bottom }}
        showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Modes</Text>

        <HeroMode mode={hero} locked={hero.pro && !isPro} onPress={() => open(hero.id, hero.pro && !isPro)} />

        <Text style={styles.section}>INCLUDED</Text>
        {free.map((m, i) => (
          <ModeRow key={m.id} mode={m} locked={false} last={i === free.length - 1}
            onPress={() => open(m.id, false)} />
        ))}

        <Text style={styles.section}>PREMIUM</Text>
        {pro.map((m, i) => (
          <ModeRow key={m.id} mode={m} locked={!isPro} last={i === pro.length - 1}
            onPress={() => open(m.id, !isPro)} />
        ))}

      </ScrollView>

      <StationSheet
        visible={!!pending}
        onClose={() => setPending(null)}
        onPick={start}
        currentId={lastStation}
        modeLabel={MODES.find((m) => m.id === pending?.mode)?.title}
        extraBottom={np.session ? 76 : 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageTitle: {
    color: Cruise.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.3,
    paddingHorizontal: PAGE_GUTTER,
    marginBottom: 24,
  },
  section: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 3,
    paddingHorizontal: PAGE_GUTTER,
    marginTop: 30,
    marginBottom: 6,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroWrap: {
    marginHorizontal: 22,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 10,
  },
  hero: {
    height: HERO_H,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 46,
    backgroundColor: '#07070c',
  },
  heroScrim: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  heroFoot: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 3,
  },
  heroLock: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroLockText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  // ── Rows ──────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: PAGE_GUTTER,
  },
  rowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  thumbClip: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  rowDesc: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 13,
    marginTop: 2,
  },
});
