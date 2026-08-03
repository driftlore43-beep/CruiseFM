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
import { Cruise } from '@/constants/theme';

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
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Connect Your Music</Text>
          <Text style={styles.subtitle}>
            Spotify and Apple Music play inside Cruise FM, with the controls on the card. Anywhere else, the visuals run alongside your own music app.
          </Text>

          {/* ── Platform grid ────────────────────────────────────────────── */}
          <View style={styles.grid}>
            {PLATFORM_ENTRIES.map((platform) => {
              const isSelected = selected === platform.id;
              const isNone = platform.id === 'none';
              return (
                <Pressable
                  key={platform.id}
                  style={({ pressed }) => [
                    styles.platformBtn,
                    { borderColor: isSelected ? platform.color : 'rgba(255,255,255,0.12)' },
                    isSelected && { borderWidth: 2 },
                    pressed && { opacity: 0.82 },
                  ]}
                  onPress={() => setSelected(platform.id)}>

                  {/* Brand gradient background — signature colour per platform */}
                  <LinearGradient
                    colors={
                      isSelected
                        ? [`${platform.color}2e`, `${platform.color}12`]
                        : ['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.03)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Brand mark — bold white icon on a tinted chip */}
                  <View style={[
                    styles.emojiWrap,
                    { backgroundColor: `${platform.color}22`, borderColor: `${platform.color}44` },
                  ]}>
                    <PlatformIcon id={platform.id} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.platformName,
                        isSelected
                          ? { color: isNone ? '#aaa' : platform.color, fontWeight: '700' }
                          : { color: Cruise.textPrimary },
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
                {/* Glassy translucent gradient — the sheet glows through */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff' }]} />
                <Text style={[styles.confirmText, { color: '#0a0a10' }]}>Let&apos;s Drive</Text>
              </View>
            ) : (
              <Text style={[styles.confirmText, { color: 'rgba(255,255,255,0.3)' }]}>
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

  useEffect(() => {
    getSavedPlatform().then((saved) => {
      if (!saved) setVisible(true);
    });
  }, []);

  return {
    visible,
    show:    () => setVisible(true),
    dismiss: () => setVisible(false),
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,4,10,0.92)',
    justifyContent: 'flex-end',
  },
  glowOrb: {
    position: 'absolute',
    bottom: '18%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sheet: {
    backgroundColor: '#0a0a10',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  logoText: {
    color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 3.5,
  },
  title: {
    color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6, letterSpacing: -0.3,
  },
  subtitle: {
    color: Cruise.textSecondary, fontSize: 13.5, lineHeight: 20, marginBottom: 24,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 9.5, fontWeight: '600', color: 'rgba(255,255,255,0.42)', marginTop: 1,
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
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: Cruise.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  confirmGradient: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  skipRow: { alignItems: 'center', paddingTop: 16 },
  skipText: { color: 'rgba(255,255,255,0.28)', fontSize: 13, fontWeight: '500' },
});
