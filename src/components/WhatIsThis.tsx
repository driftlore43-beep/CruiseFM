import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { hasSeenIntro, markIntroSeen } from '@/utils/intro';

/**
 * WHAT CRUISE FM ACTUALLY IS — shown once, to everybody.
 *
 * A listener installed the app and asked what it was for; he was the second
 * person to do that. The app went straight from "pick your music service" to
 * the home page and never said the premise out loud, which left the single
 * most important idea — moods instead of genres, and the screen becoming the
 * music — to be inferred.
 *
 * THREE RULES IT KEEPS, all learned elsewhere in this app:
 *
 * 1. IT IS SHOWN AFTER THE PLATFORM SHEET, NEVER OVER IT. Both are Modals,
 *    and iOS will not reliably stack a second Modal over the first — it
 *    presents nothing and swallows every touch, which is the trap PreviewGate
 *    (24.07) and the mood sheet (03.08) both fell into. The `visible` prop is
 *    the caller's job to get right; see _layout.tsx.
 * 2. IT IS THEMED. A hardcoded dark sheet on a light page is a bug this app
 *    has shipped twice (03.08, 14.08), and this is a first-run screen, so it
 *    sets the expectation for everything behind it.
 * 3. ONE BUTTON, AND SEEING IT COUNTS AS READING IT. `markIntroSeen` fires
 *    when it APPEARS, not when it is dismissed — the same rule RateCard uses.
 *    Somebody who force-quits mid-sentence has still had their turn; a sheet
 *    that keeps coming back until it is answered correctly is a nag.
 */

type Line = { icon: string; title: string; body: string };

/** Three sentences, in the order someone needs them. Any longer and it stops
 *  being an explanation and becomes something to dismiss unread. */
const LINES: Line[] = [
  {
    icon: 'radio',
    title: 'Stations are moods, not genres',
    body: 'Night Run, Coastal, Sunset… link your own playlists to whichever fits.',
  },
  {
    icon: 'album',
    title: 'The screen becomes the music',
    body: 'A turning record, winding tape reels, a mirror ball. Eight looks in all.',
  },
  {
    icon: 'music-note',
    title: 'Your music keeps playing where it lives',
    body: 'Apple Music or Spotify plays it. Cruise FM is the view over the top.',
  },
];

type Props = {
  visible: boolean;
  onDone: () => void;
};

export function WhatIsThis({ visible, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const styles = useStyles(makeStyles);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (!visible) return;
    // Seeing it is having been told. See rule 3 above.
    markIntroSeen().catch(() => {});
    fade.setValue(0);
    slide.setValue(40);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fade, slide]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      // A first-run sheet that pins the phone upright while the app itself
      // rotates is its own small bug — see the 30.07 landscape round.
      supportedOrientations={['portrait', 'landscape']}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 26, transform: [{ translateY: slide }] },
          ]}>
          <Text style={styles.eyebrow}>WELCOME TO</Text>
          <Text style={styles.title}>Cruise FM</Text>
          <Text style={styles.standfirst}>
            It doesn&apos;t replace your music app — it wraps it.
          </Text>

          <View style={styles.lines}>
            {LINES.map((l) => (
              <View key={l.title} style={styles.line}>
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons
                    name={l.icon as never}
                    size={17}
                    color={pal.ink(0.9)}
                  />
                </View>
                <View style={styles.lineText}>
                  <Text style={styles.lineTitle}>{l.title}</Text>
                  <Text style={styles.lineBody}>{l.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* The app's primary button: a solid fill in the OPPOSITE of the
              page. White on near-white is not a button. */}
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: pal.mode === 'light' ? pal.text : '#ffffff' },
              pressed && { opacity: 0.85 },
            ]}>
            {/* DELIBERATELY NOT "Let's cruise" — that is the exact label on
                the home hero's Start-a-drive button, and repeating it here
                invites someone to think this sheet starts a drive. This
                button only dismisses, so it says so. */}
            <Text style={[styles.ctaText, { color: pal.mode === 'light' ? pal.bg : '#0a0a10' }]}>
              Got it
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/**
 * Decides whether this person still needs telling. Returns null until the
 * answer is known, so the caller can wait rather than flashing the sheet at
 * somebody who has already seen it.
 */
export function useIntroNeeded(): boolean | null {
  const [needed, setNeeded] = useState<boolean | null>(null);
  useEffect(() => {
    hasSeenIntro().then((seen) => setNeeded(!seen)).catch(() => setNeeded(false));
  }, []);
  return needed;
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: p.mode === 'light' ? 'rgba(28,26,22,0.34)' : 'rgba(4,4,10,0.92)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: p.mode === 'light' ? p.panel : '#0a0a10',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 30,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: p.ink(0.12),
  },
  eyebrow: {
    color: p.ink(0.45),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: p.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  standfirst: {
    color: p.ink(0.66),
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
  },
  lines: { marginTop: 24, marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.ink(0.06),
    borderWidth: 1,
    borderColor: p.ink(0.12),
    marginRight: 13,
  },
  // minWidth is load-bearing on a flex row: without it the text sets the
  // row's minimum width and long lines push past the sheet's edge.
  lineText: { flex: 1, minWidth: 0, paddingTop: 1 },
  lineTitle: { color: p.text, fontSize: 15, fontWeight: '700' },
  lineBody: { color: p.ink(0.58), fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  cta: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  ctaText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
