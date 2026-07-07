import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlossSheen } from '@/components/GlossSheen';
import { TidalLogo } from '@/components/icons/TidalLogo';
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

const NONE_ENTRY = { id: 'none' as PlatformId, name: 'None / Other', color: '#666666', emoji: '⊘' };

const PLATFORM_ENTRIES = [
  ...Object.entries(PLATFORMS).map(([id, p]) => ({ id: id as PlatformId, ...p })),
  NONE_ENTRY,
];

// Real brand marks for this sheet only — bold and white, sitting on each
// platform's tinted chip.
type IconDef = { family: 'FontAwesome' | 'MaterialCommunityIcons'; name: string };
const PLATFORM_ICONS: Partial<Record<PlatformId, IconDef>> = {
  spotify:      { family: 'FontAwesome', name: 'spotify' },
  appleMusic:   { family: 'FontAwesome', name: 'apple' },
  youtubeMusic: { family: 'FontAwesome', name: 'youtube-play' },
  amazonMusic:  { family: 'FontAwesome', name: 'amazon' },
  none:         { family: 'MaterialCommunityIcons', name: 'close-thick' },
};

function PlatformIcon({ id, size = 18 }: { id: PlatformId; size?: number }) {
  if (id === 'tidal') return <TidalLogo size={size + 2} color="#fff" />;
  const def = PLATFORM_ICONS[id]!;
  if (def.family === 'FontAwesome') {
    return <FontAwesome name={def.name as any} size={size} color="#fff" />;
  }
  return <MaterialCommunityIcons name={def.name as any} size={size + 2} color="#fff" />;
}

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

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 280, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 68, friction: 11, useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, tension: 80, friction: 10, useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset for next open
      slideAnim.setValue(80);
      scaleAnim.setValue(0.96);
      fadeAnim.setValue(0);
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
            <View style={styles.logoRow}>
              <Text style={styles.logoText}>CRUISE FM</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Connect Your Music</Text>
          <Text style={styles.subtitle}>
            Choose your favourite platform and we'll take you straight to the vibe.
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
                    { borderColor: isSelected ? platform.color : `${platform.color}55` },
                    isSelected && { borderWidth: 2 },
                    pressed && { opacity: 0.82 },
                  ]}
                  onPress={() => setSelected(platform.id)}>

                  {/* Brand gradient background — signature colour per platform */}
                  <LinearGradient
                    colors={
                      isSelected
                        ? [`${platform.color}66`, `${platform.color}2e`]
                        : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.05)']
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

                  {/* Checkmark on selection */}
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: platform.color }]}>
                      <Text style={styles.checkMark}>✓</Text>
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
                <LinearGradient
                  colors={['rgba(160,98,255,0.55)', 'rgba(123,56,224,0.42)', 'rgba(96,40,190,0.38)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <GlossSheen radius={16} />
                <Text style={styles.confirmText}>Let's Drive</Text>
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
    backgroundColor: 'rgba(6,6,18,0.94)',
    justifyContent: 'flex-end',
  },
  glowOrb: {
    position: 'absolute',
    bottom: '18%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(123,56,224,0.22)',
  },
  sheet: {
    backgroundColor: '#0F0F22',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(123,56,224,0.35)',
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
    borderWidth: 1.5,
    overflow: 'hidden',
    // base background (gradient overlays this)
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emojiWrap: {
    width: 32, height: 32, borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  platformName: {
    flex: 1, fontSize: 13, fontWeight: '600',
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
