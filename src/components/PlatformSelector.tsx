import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PLATFORMS,
  PlatformId,
  getSavedPlatform,
  savePlatform,
} from '@/utils/musicPlatform';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import { readableOn, type Palette } from '@/utils/appearance';

const NONE_ENTRY = { id: 'none' as PlatformId, name: 'None / Other', color: '#666666' };

const PLATFORM_ENTRIES = [
  ...Object.entries(PLATFORMS).map(([id, p]) => ({ id: id as PlatformId, ...p })),
  NONE_ENTRY,
];

// Honest tier line under each name. Spotify is the full ride; everything
// else runs as the visual companion beside the user's own music app (which
// genuinely works today — never call it "upcoming"), with Apple Music
// flagged as the next full integration.
const TIER_CAPTIONS: Record<string, string> = {
  spotify:      'Full in-app control',
  appleMusic:   'Full in-app control',
  youtubeMusic: 'Visuals + your app',
  amazonMusic:  'Visuals + your app',
  tidal:        'Visuals + your app',
  none:         'Just the visuals',
};

type Props = {
  visible: boolean;
  onDismiss: (skipped?: boolean) => void;
};

export function PlatformSelector({ visible, onDismiss }: Props) {
  const styles = useStyles(makeStyles);
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PlatformId | null>(null);

  // Fade for the backdrop
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  // Spring slide for the sheet
  const slideAnim = useRef(new Animated.Value(80)).current;
  // Scale pop on appear
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  // The wordmark reveals on its own beat, a breath after the sheet lands
  const logoAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // THE "KEEPS UNSELECTING" BUG (Ethan, 25.08). `selected` started at
      // `null` on every open, so the sheet always showed nothing chosen even
      // though the saved platform hadn't moved — it just never asked what it
      // was. `getSavedPlatform` can return 'none' (Skip for now was pressed
      // once) — that has no card of its own to light up, so it's left
      // unselected rather than mapped onto a platform nobody chose.
      getSavedPlatform().then((id) => {
        if (id && id !== 'none') setSelected(id);
      }).catch(() => {});
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 400, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 52, friction: 12, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, tension: 60, friction: 11, useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 1, duration: 700, delay: 220, useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      slideAnim.setValue(80);
      scaleAnim.setValue(0.96);
      fadeAnim.setValue(0);
      logoAnim.setValue(0);
    }
  }, [visible]);

  const animateOut = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 50, duration: 220, useNativeDriver: true }),
    ]).start(callback);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    await savePlatform(selected);
    animateOut(() => onDismiss(false));
  };

  const handleSkip = async () => {
    await savePlatform('none');
    animateOut(() => onDismiss(true));
  };

  const handleClose = () => {
    animateOut(() => onDismiss(true));
  };

  const isReady = !!selected;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>

        {/* Tap outside to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          activeOpacity={1}
        />

        {/* Ambient violet glow orb behind the sheet */}
        <View style={styles.glowOrb} pointerEvents="none" />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 28,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}>

          {/* ── Header branding ─────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <Animated.View
              style={[
                styles.logoRow,
                {
                  opacity: logoAnim,
                  transform: [{
                    translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                  }],
                },
              ]}>
              <Text style={styles.logoText}>CRUISE FM</Text>
            </Animated.View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color={pal.ink(0.6)} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Connect Your Music</Text>
          <Text style={styles.subtitle}>
            Spotify and Apple Music play inside Cruise FM, with the controls on the card. Anywhere else, the visuals run alongside your own music app.
          </Text>

          {/* ── Platform grid ────────────────────────────────────────────── */}
          <View style={styles.grid}>
            {PLATFORM_ENTRIES.map((entry) => {
              // Tidal's mark is a near-white grey, correct on a dark sheet and
              // invisible on paper. Deepened only where it has to be.
              const platform = { ...entry, color: readableOn(entry.color, pal.mode) };
              const isSelected = selected === platform.id;
              const isNone = platform.id === 'none';
              return (
                <Pressable
                  key={entry.id}
                  style={({ pressed }) => [
                    styles.platformBtn,
                    { borderColor: isSelected ? platform.color : pal.ink(0.12) },
                    isSelected && { borderWidth: 2 },
                    pressed && { opacity: 0.82 },
                  ]}
                  onPress={() => setSelected(platform.id)}>

                  {/* Brand gradient background — signature colour per platform */}
                  <LinearGradient
                    colors={
                      isSelected
                        ? [`${platform.color}2e`, `${platform.color}12`]
                        : [pal.ink(0.09), pal.ink(0.03)]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Brand mark on a chip tinted with its own colour. On black
                      the glyph is white, which is the strongest thing that can
                      sit on a dark tint. On paper that chip is a PALE wash, so
                      a white glyph disappears into it — the mark takes the
                      brand's own colour instead, which is both legible and
                      more like the real logo. */}
                  <View style={[
                    styles.emojiWrap,
                    pal.mode === 'light'
                      ? { backgroundColor: `${platform.color}1f`, borderColor: `${platform.color}59` }
                      : { backgroundColor: `${platform.color}22`, borderColor: `${platform.color}44` },
                  ]}>
                    <PlatformIcon id={platform.id} color={pal.mode === 'light' ? platform.color : '#fff'} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.platformName,
                        isSelected
                          ? { color: isNone ? pal.ink(0.62) : platform.color, fontWeight: '700' }
                          : { color: pal.text },
                      ]}
                      numberOfLines={1}>
                      {platform.name}
                    </Text>
                    <Text style={styles.platformTier} numberOfLines={1}>
                      {TIER_CAPTIONS[platform.id] ?? ''}
                    </Text>
                  </View>

                  {/* Checkmark on selection */}
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: platform.color }]}>
                      <MaterialCommunityIcons name="check" size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* ── Confirm button ───────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              isReady ? styles.confirmBtnActive : styles.confirmBtnDisabled,
              pressed && isReady && { opacity: 0.88 },
            ]}
            onPress={handleConfirm}
            disabled={!isReady}>
            {isReady ? (
              <View style={styles.confirmGradient}>
                {/* The app's primary button: a solid pill in the OPPOSITE of the
                    page, so it reads as the one thing to press. On black that
                    is white with dark type; on paper it has to invert, or a
                    white pill on a near-white sheet disappears entirely. */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: pal.mode === 'light' ? pal.text : '#ffffff' }]} />
                <Text style={[styles.confirmText, { color: pal.mode === 'light' ? pal.bg : '#0a0a10' }]}>
                  Let&apos;s Drive
                </Text>
              </View>
            ) : (
              <Text style={[styles.confirmText, { color: pal.ink(0.32) }]}>
                Select a platform
              </Text>
            )}
          </Pressable>

          {/* ── Skip link ────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipRow}
            hitSlop={{ top: 8, bottom: 8, left: 20, right: 20 }}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Hook — show on first launch, re-show when triggered ──────────────────────
export function usePlatformSelector() {
  const [visible, setVisible] = useState(false);
  /**
   * Whether the saved-platform lookup has come back yet.
   *
   * `visible` alone cannot answer "is the platform question settled?" — it is
   * false both BEFORE the async read finishes and AFTER the sheet is
   * dismissed, and those are opposite situations. Anything that must wait its
   * turn behind this sheet (the WhatIsThis explainer does) needs to tell them
   * apart, or it appears for a frame underneath the sheet that is about to
   * cover it.
   */
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getSavedPlatform()
      .then((saved) => {
        if (!saved) setVisible(true);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  return {
    visible,
    checked,
    show:    () => setVisible(true),
    dismiss: () => setVisible(false),
  };
}

/**
 * THEMED (owner, 14.08: "the connect your music is still black in the daytime
 * mode"). This is the first screen a new listener ever sees, so it sets the
 * expectation for everything behind it — and on paper it was still a slab of
 * black, which is exactly the mistake it was restyled away from on 03.08, only
 * in the other direction.
 *
 * The BRAND COLOURS are untouched. Spotify's green and Apple's red are the
 * whole point of these cards, they read on either ground, and they are the one
 * thing on the sheet that must not follow the theme.
 */
const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    // The ground the sheet is lifted off. On paper it must still be a dimming
    // layer rather than a lighter one, or the sheet has nothing to sit against
    // — but far softer than the near-opaque black used on dark.
    backgroundColor: p.mode === 'light' ? 'rgba(28,26,22,0.34)' : 'rgba(4,4,10,0.92)',
    justifyContent: 'flex-end',
  },
  glowOrb: {
    position: 'absolute',
    bottom: '18%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    // A soft light behind the sheet. Light ON light is invisible, so on paper
    // it goes the other way and reads as a shadow pooling under the sheet.
    backgroundColor: p.mode === 'light' ? 'rgba(58,52,42,0.07)' : 'rgba(255,255,255,0.05)',
  },
  sheet: {
    backgroundColor: p.mode === 'light' ? p.panel : '#0a0a10',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: p.ink(0.12),
    overflow: 'hidden',
  },

  // ── Branding ────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 18,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: p.ink(0.08),
    borderWidth: 1, borderColor: p.ink(0.12),
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: p.ink(0.6), fontSize: 14, fontWeight: '600' },
  logoText: {
    color: p.text, fontSize: 12, fontWeight: '800', letterSpacing: 3.5,
  },
  title: {
    color: p.text, fontSize: 26, fontWeight: '700', marginBottom: 6, letterSpacing: 0,
  },
  subtitle: {
    color: p.ink(0.68), fontSize: 13.5, lineHeight: 20, marginBottom: 24,
  },

  // ── Grid ─────────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  platformBtn: {
    width: '48%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: p.ink(0.05),
  },
  emojiWrap: {
    width: 32, height: 32, borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  platformName: {
    fontSize: 13, fontWeight: '600',
  },
  platformTier: {
    fontSize: 9.5, fontWeight: '600', color: p.ink(0.52), marginTop: 1,
  },
  checkCircle: {
    width: 19, height: 19, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Confirm ──────────────────────────────────────────────────────────────────
  confirmBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnActive: {
    borderWidth: 1,
    borderColor: p.ink(0.28),
    shadowColor: p.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: p.mode === 'light' ? 0.28 : 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  confirmBtnDisabled: {
    backgroundColor: p.ink(0.06),
    borderWidth: 1,
    borderColor: p.ink(0.1),
  },
  confirmGradient: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmText: { color: p.text, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  skipRow: { alignItems: 'center', paddingTop: 16 },
  // Deliberately quiet — but 0.28 of the ink is genuinely hard to read on
  // paper, where there is no glow to carry a faint colour. 0.4 is still
  // plainly the secondary option and is still legible outdoors.
  skipText: { color: p.ink(p.mode === 'light' ? 0.4 : 0.28), fontSize: 13, fontWeight: '500' },
});
