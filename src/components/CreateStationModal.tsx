import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cruise } from '@/constants/theme';
import { saveCustomStation, type CustomStation } from '@/utils/customStations';

const { height: SCREEN_H } = Dimensions.get('window');

const ICONS = ['🎵', '🚗', '🌙', '🌅', '🌧', '⛰', '🌊', '🔥', '❄️', '🌿', '🎸', '🎹', '🛣', '🌃', '🌌', '⚡', '🕶', '🎭'];

const PALETTES: { label: string; color: string; gradientColors: [string, string, string]; glowColor: string; iconBg: string }[] = [
  { label: 'Violet',   color: '#7B38E0', gradientColors: ['#1a0533', '#4a1a7a', '#000000'], glowColor: '#4a1a7a', iconBg: '#2d1060' },
  { label: 'Blue',     color: '#1a6bb5', gradientColors: ['#051530', '#0a3a5c', '#000000'], glowColor: '#0a3a5c', iconBg: '#0c2b45' },
  { label: 'Teal',     color: '#1D9E75', gradientColors: ['#032830', '#1a6b50', '#000000'], glowColor: '#1a6b50', iconBg: '#1a4030' },
  { label: 'Amber',    color: '#F59E0B', gradientColors: ['#2a1500', '#6b3a00', '#000000'], glowColor: '#8a5a05', iconBg: '#5a2800' },
  { label: 'Rose',     color: '#e05578', gradientColors: ['#2a0520', '#6a1040', '#000000'], glowColor: '#6a1040', iconBg: '#3a0828' },
  { label: 'Slate',    color: '#6b7a99', gradientColors: ['#111118', '#1e2240', '#000000'], glowColor: '#1e2240', iconBg: '#16162a' },
  { label: 'Crimson',  color: '#c0392b', gradientColors: ['#2a0505', '#6a1010', '#000000'], glowColor: '#6a1010', iconBg: '#3a0808' },
  { label: 'Forest',   color: '#27ae60', gradientColors: ['#021a05', '#0d4a1a', '#000000'], glowColor: '#0d4a1a', iconBg: '#0d3a10' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (station: CustomStation) => void;
  existingCount: number;
  maxFree: number;
  isPro: boolean;
};

export function CreateStationModal({ visible, onClose, onCreated, existingCount, maxFree, isPro }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const atLimit = !isPro && existingCount >= maxFree;

  function handleShow() {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }

  function handleHide(cb?: () => void) {
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 280, useNativeDriver: true }).start(() => {
      resetForm();
      cb?.();
    });
  }

  function resetForm() {
    setName('');
    setTagline('');
    setSelectedIcon(ICONS[0]);
    setSelectedPalette(PALETTES[0]);
    setError('');
  }

  async function handleSave() {
    const trimName = name.trim();
    if (!trimName) { setError('Give your station a name.'); return; }
    setSaving(true);
    const station: CustomStation = {
      id: `custom-${Date.now()}`,
      name: trimName,
      tagline: tagline.trim() || 'My custom station',
      tags: [],
      premium: false,
      gradientColors: selectedPalette.gradientColors,
      cardGradient: [selectedPalette.color, selectedPalette.gradientColors[1], selectedPalette.gradientColors[0]],
      glowColor: selectedPalette.glowColor,
      iconBg: selectedPalette.iconBg,
      color: selectedPalette.color,
      icon: selectedIcon,
      image: null,
      bestTime: 'Any time',
      duration: 'Your playlist',
      trackCount: 0,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(trimName)}`,
      appleMusicUrl: `https://music.apple.com/search?term=${encodeURIComponent(trimName)}`,
    };
    await saveCustomStation(station);
    setSaving(false);
    onCreated(station);
    handleHide();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleHide(onClose)}
      onShow={handleShow}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handleHide(onClose)} />
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Create station</Text>

          {atLimit && (
            <View style={styles.limitBanner}>
              <Text style={styles.limitText}>Free plan allows {maxFree} custom stations. Upgrade to Pro for unlimited.</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, atLimit && styles.inputDisabled]}
              placeholder="e.g. Good Vibes"
              placeholderTextColor={Cruise.textMuted}
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              maxLength={32}
              editable={!atLimit}
              selectionColor={Cruise.violet}
            />

            <Text style={styles.label}>Tagline</Text>
            <TextInput
              style={[styles.input, atLimit && styles.inputDisabled]}
              placeholder="e.g. Windows down, nothing to worry about"
              placeholderTextColor={Cruise.textMuted}
              value={tagline}
              onChangeText={setTagline}
              maxLength={60}
              editable={!atLimit}
              selectionColor={Cruise.violet}
            />

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  style={[styles.iconBtn, selectedIcon === icon && { borderColor: selectedPalette.color, backgroundColor: selectedPalette.iconBg }]}
                  onPress={() => !atLimit && setSelectedIcon(icon)}>
                  <Text style={styles.iconEmoji}>{icon}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Colour</Text>
            <View style={styles.paletteRow}>
              {PALETTES.map((p) => (
                <Pressable
                  key={p.label}
                  style={[styles.paletteBtn, { backgroundColor: p.color }, selectedPalette.label === p.label && styles.paletteBtnActive]}
                  onPress={() => !atLimit && setSelectedPalette(p)}
                />
              ))}
            </View>

            <View style={[styles.preview, { backgroundColor: selectedPalette.iconBg, borderColor: selectedPalette.color + '55' }]}>
              <View style={[styles.previewIcon, { backgroundColor: selectedPalette.iconBg, borderColor: selectedPalette.color + '88' }]}>
                <Text style={styles.previewEmoji}>{selectedIcon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.previewName} numberOfLines={1}>{name || 'Station name'}</Text>
                <Text style={styles.previewTagline} numberOfLines={1}>{tagline || 'Your tagline here'}</Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.saveBtn, { backgroundColor: selectedPalette.color }, (atLimit || saving) && styles.saveBtnDisabled]}
              onPress={atLimit ? undefined : handleSave}
              disabled={atLimit || saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : atLimit ? 'Upgrade to Pro' : 'Create station'}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Cruise.midnight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_H * 0.9,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: Cruise.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  limitBanner: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  limitText: {
    color: Cruise.amber,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: Cruise.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: Cruise.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Cruise.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputDisabled: {
    opacity: 0.4,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Cruise.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconEmoji: {
    fontSize: 20,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paletteBtnActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.15 }],
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  previewEmoji: { fontSize: 22 },
  previewName: {
    color: Cruise.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewTagline: {
    color: Cruise.textSecondary,
    fontSize: 12,
  },
  errorText: {
    color: '#e05578',
    fontSize: 13,
    marginTop: 10,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
