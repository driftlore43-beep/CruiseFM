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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cruise } from '@/constants/theme';
import { saveCustomStation, updateCustomStation, type CustomStation } from '@/utils/customStations';

const { height: SCREEN_H } = Dimensions.get('window');

// Bold white icon marks (MaterialCommunityIcons) — replaces the old emoji grid.
const ICONS = [
  'music-note', 'car-convertible', 'weather-night', 'weather-sunset', 'weather-pouring',
  'image-filter-hdr', 'waves', 'fire', 'snowflake', 'leaf', 'guitar-electric', 'piano',
  'road-variant', 'city-variant-outline', 'star-four-points', 'flash', 'sunglasses', 'drama-masks',
] as const;

// Neutral glass wash — a faint light-catch from the top-left, same finish as
// the app's other cards. Replaces the old blue tint so the sheet reads as
// clear glass over the deep-navy background.
const GLASS_WASH = ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'] as const;

function CardWash({ radius }: { radius: number }) {
  return (
    <LinearGradient
      colors={GLASS_WASH}
      start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      pointerEvents="none"
    />
  );
}

const PALETTES: { label: string; color: string; gradientColors: [string, string, string]; glowColor: string; iconBg: string }[] = [
  { label: 'Violet',   color: '#7B38E0', gradientColors: ['#1a0533', '#4a1a7a', '#000000'], glowColor: '#4a1a7a', iconBg: '#2d1060' },
  { label: 'Blue',     color: '#1a6bb5', gradientColors: ['#051530', '#0a3a5c', '#000000'], glowColor: '#0a3a5c', iconBg: '#0c2b45' },
  { label: 'Teal',     color: '#1D9E75', gradientColors: ['#032830', '#1a6b50', '#000000'], glowColor: '#1a6b50', iconBg: '#1a4030' },
  { label: 'Amber',    color: '#F59E0B', gradientColors: ['#2a1500', '#6b3a00', '#000000'], glowColor: '#8a5a05', iconBg: '#5a2800' },
  { label: 'Rose',     color: '#e05578', gradientColors: ['#2a0520', '#6a1040', '#000000'], glowColor: '#6a1040', iconBg: '#3a0828' },
  { label: 'Slate',    color: '#6b7a99', gradientColors: ['#111118', '#1e2240', '#000000'], glowColor: '#1e2240', iconBg: '#16162a' },
  { label: 'Crimson',  color: '#c0392b', gradientColors: ['#2a0505', '#6a1010', '#000000'], glowColor: '#6a1010', iconBg: '#3a0808' },
  { label: 'Forest',   color: '#27ae60', gradientColors: ['#021a05', '#0d4a1a', '#000000'], glowColor: '#0d4a1a', iconBg: '#0d3a10' },
  { label: 'Orange',   color: '#FF7A3C', gradientColors: ['#2a1000', '#7a3510', '#000000'], glowColor: '#7a3510', iconBg: '#4a1e08' },
  { label: 'Pink',     color: '#FF4FA3', gradientColors: ['#2a0518', '#7a1a4a', '#000000'], glowColor: '#7a1a4a', iconBg: '#45102b' },
  { label: 'Cyan',     color: '#33C5FF', gradientColors: ['#01202e', '#0a5a7a', '#000000'], glowColor: '#0a5a7a', iconBg: '#083a4e' },
  { label: 'Gold',     color: '#D4AF37', gradientColors: ['#241a02', '#6b5510', '#000000'], glowColor: '#6b5510', iconBg: '#443508' },
  { label: 'Lavender', color: '#A78BFA', gradientColors: ['#160f2e', '#4a3a8a', '#000000'], glowColor: '#4a3a8a', iconBg: '#2c2158' },
  { label: 'Coral',    color: '#FF6F61', gradientColors: ['#2a0c08', '#7a2a20', '#000000'], glowColor: '#7a2a20', iconBg: '#4a1710' },
  { label: 'Mint',     color: '#4ADE80', gradientColors: ['#03200f', '#15683a', '#000000'], glowColor: '#15683a', iconBg: '#0e4425' },
  { label: 'Ice',      color: '#9AD6FF', gradientColors: ['#0e1a26', '#2e5a7a', '#000000'], glowColor: '#2e5a7a', iconBg: '#1c3a52' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (station: CustomStation) => void;
  existingCount: number;
  maxFree: number;
  isPro: boolean;
  /** When set, the sheet opens pre-filled and saves back over this station. */
  editing?: CustomStation | null;
  onUpdated?: (station: CustomStation) => void;
};

export function CreateStationModal({ visible, onClose, onCreated, existingCount, maxFree, isPro, editing, onUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>(ICONS[0]);
  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Once the slide-in settles we drop the transform entirely — a lingering
  // transform on the sheet stops iOS Safari from focusing the text inputs.
  const [settled, setSettled] = useState(false);

  const atLimit = !editing && !isPro && existingCount >= maxFree;

  function handleShow() {
    if (editing) {
      setName(editing.name);
      setTagline(editing.tagline === 'My custom station' ? '' : editing.tagline);
      setSelectedIcon(editing.icon);
      setSelectedPalette(PALETTES.find((pal) => pal.color === editing.color) ?? PALETTES[0]);
    }
    setSettled(false);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(
      () => setSettled(true),
    );
  }

  function handleHide(cb?: () => void) {
    setSettled(false);
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
      id: editing ? editing.id : `custom-${Date.now()}`,
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
    if (editing) {
      await updateCustomStation(station);
      setSaving(false);
      onUpdated?.(station);
    } else {
      await saveCustomStation(station);
      setSaving(false);
      onCreated(station);
    }
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
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16 },
            !settled && { transform: [{ translateY: slideY }] },
          ]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{editing ? 'Edit station' : 'Create station'}</Text>

          {atLimit && (
            <View style={styles.limitBanner}>
              <Text style={styles.limitText}>Free plan allows {maxFree} custom stations. Upgrade to Pro for unlimited.</Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name</Text>
            <View style={[styles.inputWrap, atLimit && styles.inputDisabled]}>
              <CardWash radius={12} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Good Vibes"
                placeholderTextColor={Cruise.textMuted}
                value={name}
                onChangeText={(t) => { setName(t); setError(''); }}
                maxLength={32}
                editable={!atLimit}
                selectionColor={Cruise.violet}
              />
            </View>

            <Text style={styles.label}>Tagline</Text>
            <View style={[styles.inputWrap, atLimit && styles.inputDisabled]}>
              <CardWash radius={12} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Windows down, nothing to worry about"
                placeholderTextColor={Cruise.textMuted}
                value={tagline}
                onChangeText={setTagline}
                maxLength={60}
                editable={!atLimit}
                selectionColor={Cruise.violet}
              />
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  style={[styles.iconBtn, selectedIcon === icon && { borderColor: selectedPalette.color, backgroundColor: selectedPalette.iconBg }]}
                  onPress={() => !atLimit && setSelectedIcon(icon)}>
                  {selectedIcon !== icon && <CardWash radius={12} />}
                  <MaterialCommunityIcons name={icon as any} size={22} color="#fff" />
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

            <View style={[styles.preview, { borderColor: selectedPalette.color + '66', shadowColor: selectedPalette.color }]}>
              <CardWash radius={16} />
              <View style={[styles.previewIcon, { backgroundColor: selectedPalette.iconBg, borderColor: selectedPalette.color + '88' }]}>
                <MaterialCommunityIcons name={selectedIcon as any} size={24} color="#fff" />
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
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : atLimit ? 'Upgrade to Pro' : editing ? 'Save changes' : 'Create station'}</Text>
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
    // Near-black deep navy, matching the modes' backdrop — the glass cards
    // inside read as clear panels over it.
    backgroundColor: '#060812',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: SCREEN_H * 0.9,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
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
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Cruise.textPrimary,
    fontSize: 15,
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
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
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
    overflow: 'hidden',
    // Really deep blue card under the glass wash, glowing in the chosen colour.
    backgroundColor: '#070c1e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
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
