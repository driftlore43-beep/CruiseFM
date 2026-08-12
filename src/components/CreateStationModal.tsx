import { useEffect, useRef, useState } from 'react';
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
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDsegFont } from '@/components/StationIdentity';
import { stationDial } from '@/constants/stations';
import { Cruise, Fonts } from '@/constants/theme';
import { saveCustomStation, updateCustomStation, type CustomStation } from '@/utils/customStations';
import {
  choosePhoto, deleteStationPhoto, saveStationPhoto, stationPhotoAvailable,
  type ChosenPhoto, type CropRect, type StationPhoto,
} from '@/utils/stationPhoto';
import { PhotoFrameSheet } from '@/components/PhotoFrameSheet';

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
  // First on purpose. Owner, 10.08: "they should include a transparent option,
  // for users who prefer to have the same colour as the background". Not truly
  // transparent — a station's colour is used for gradients, glows, the EQ ramp
  // and the mode chips, and a see-through value would leave all of those with
  // nothing to draw. This is the app's own near-black instead, which is what
  // "same as the background" actually looks like, and it stays a real colour
  // everything downstream can use.
  { label: 'None',     color: '#2A2E3D', gradientColors: ['#0a0a10', '#181c28', '#000000'], glowColor: '#181c28', iconBg: '#14171f' },
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
  // Added 10.08 (owner: "browns and a wider colour selection... include a
  // pearl white also that would look good in many images"). Earths and muted
  // tones — the original set was all saturated, which left nothing that sits
  // quietly under a photograph.
  { label: 'Pearl',    color: '#EFE8DC', gradientColors: ['#15141a', '#3a3630', '#000000'], glowColor: '#3a3630', iconBg: '#272420' },
  { label: 'Espresso', color: '#6B4A38', gradientColors: ['#1a0f0a', '#4a2f20', '#000000'], glowColor: '#4a2f20', iconBg: '#2e1d14' },
  { label: 'Camel',    color: '#C08B5C', gradientColors: ['#241708', '#6b4522', '#000000'], glowColor: '#6b4522', iconBg: '#40290f' },
  { label: 'Copper',   color: '#B87333', gradientColors: ['#210f02', '#63380f', '#000000'], glowColor: '#63380f', iconBg: '#3b2109' },
  { label: 'Olive',    color: '#8A9A5B', gradientColors: ['#141705', '#3f4a1c', '#000000'], glowColor: '#3f4a1c', iconBg: '#252c10' },
  { label: 'Sage',     color: '#A8BFA0', gradientColors: ['#101a10', '#33482f', '#000000'], glowColor: '#33482f', iconBg: '#1d2a1b' },
  { label: 'Plum',     color: '#8E4B6E', gradientColors: ['#1c0716', '#54203f', '#000000'], glowColor: '#54203f', iconBg: '#331226' },
  { label: 'Midnight', color: '#35508F', gradientColors: ['#070b1a', '#1e2c56', '#000000'], glowColor: '#1e2c56', iconBg: '#121a33' },
];

/**
 * Ink for the tick on the selected swatch. White is invisible on a pale colour
 * — Pearl, Ice, Sage — so it flips to near-black on light swatches. (The RING
 * no longer needs this: it sits outside the swatch on the dark sheet, so it is
 * always white.)
 * Perceived brightness, not a plain average: the eye weights green far more
 * than blue, and a plain mean calls #33C5FF light when it plainly isn't.
 */
function ringOn(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0a0a10' : '#fff';
}

/**
 * The default for a NEW station. Explicit, not PALETTES[0] — 'None' sits first
 * in the list so it is easy to find, and indexing the default off position
 * would silently make every new station grey.
 */
const DEFAULT_PALETTE = PALETTES.find((p) => p.label === 'Violet') ?? PALETTES[0];

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
  const [selectedPalette, setSelectedPalette] = useState(DEFAULT_PALETTE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // A photo of their own, behind the station. Null keeps today's behaviour —
  // the chosen colour — which is what every station made before this had.
  const [photo, setPhoto] = useState<StationPhoto | null>(null);
  // The photo they just chose, waiting to be framed. Held here rather than
  // saved straight away, because the crop has to come off the ORIGINAL.
  const [framing, setFraming] = useState<ChosenPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  // Once the slide-in settles we drop the transform entirely — a lingering
  // transform on the sheet stops iOS Safari from focusing the text inputs.
  const [settled, setSettled] = useState(false);

  const atLimit = !editing && !isPro && existingCount >= maxFree;

  function handleShow() {
    if (editing) {
      setName(editing.name);
      setTagline(editing.tagline === 'My custom station' ? '' : editing.tagline);
      setSelectedIcon(editing.icon);
      setSelectedPalette(PALETTES.find((pal) => pal.color === editing.color) ?? DEFAULT_PALETTE);
      setPhoto(editing.image ? { image: editing.image, imageBlur: editing.imageBlur ?? editing.image } : null);
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
    setSelectedPalette(DEFAULT_PALETTE);
    setError('');
    setPhoto(null);
  }

  // The dial number is a hash of the station's id, so the id is settled the
  // moment the sheet opens rather than at save time — that way the number in
  // the preview is the number the station actually gets, not a lookalike.
  const newIdRef = useRef(`custom-${Date.now()}`);
  useEffect(() => { if (visible && !editing) newIdRef.current = `custom-${Date.now()}`; }, [visible, editing]);
  const previewId = editing ? editing.id : newIdRef.current;
  const dial = stationDial(previewId, false);
  const dsegFont = useDsegFont();

  async function handleSave() {
    const trimName = name.trim();
    if (!trimName) { setError('Give your station a name.'); return; }
    setSaving(true);
    const station: CustomStation = {
      id: previewId,
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
      image: photo?.image ?? null,
      imageBlur: photo?.imageBlur ?? null,
      bestTime: 'Any time',
      duration: 'Your playlist',
      trackCount: 0,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(trimName)}`,
      appleMusicUrl: `https://music.apple.com/search?term=${encodeURIComponent(trimName)}`,
    };
    if (editing) {
      await updateCustomStation(station);
      // Tidy up a picture they took off the station. This has to happen on
      // SAVE, not on the Remove tap — someone can hit Remove and then close
      // the sheet without saving, and deleting there would destroy the photo
      // of a station they never actually changed. Replacing a photo already
      // cleans up after itself inside pickStationPhoto.
      if (editing.image && !photo) await deleteStationPhoto(station.id).catch(() => {});
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

            {/* A photo of their own. Only offered on a build that carries the
                picker — before that the row would be a dead button, and the
                colour below is a perfectly good station either way. */}
            {stationPhotoAvailable() && (
              <>
                <Text style={styles.label}>Photo</Text>
                <View style={styles.photoRow}>
                  <Pressable
                    disabled={atLimit || picking}
                    onPress={async () => {
                      if (picking) return;
                      setPicking(true);
                      const r = await choosePhoto();
                      setPicking(false);
                      // Nothing is written yet — the framing sheet decides the
                      // crop, and only then is anything saved.
                      if (r.kind === 'chosen') { setFraming(r.photo); setError(''); }
                      else if (r.kind === 'failed') setError("That photo couldn't be used. Try another one.");
                    }}
                    style={[styles.photoBtn, !!photo && styles.photoBtnSet]}>
                    {photo
                      ? <ExpoImage source={photo.image} contentFit="cover" style={StyleSheet.absoluteFill} />
                      : null}
                    <View style={styles.photoBtnInner}>
                      <MaterialCommunityIcons
                        name={picking ? 'progress-clock' : photo ? 'image-edit-outline' : 'image-plus'}
                        size={20} color="#fff"
                      />
                      <Text style={styles.photoBtnText}>
                        {picking ? 'Opening…' : photo ? 'Change photo' : 'Add a photo'}
                      </Text>
                    </View>
                  </Pressable>
                  {!!photo && (
                    <Pressable onPress={() => setPhoto(null)} style={styles.photoClear}>
                      <Text style={styles.photoClearText}>Remove</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.photoHint}>
                  Sits behind every mode when you drive this station.
                </Text>
              </>
            )}

            <Text style={styles.label}>Colour</Text>
            <View style={styles.paletteRow}>
              {PALETTES.map((p) => (
                <Pressable
                  key={p.label}
                  style={styles.paletteCell}
                  hitSlop={4}
                  onPress={() => !atLimit && setSelectedPalette(p)}>
                  <View style={[styles.paletteDot, { backgroundColor: p.color }]} />
                  {selectedPalette.label === p.label && (
                    <>
                      {/* The ring sits OUTSIDE the swatch with a gap of sheet
                          between them, so it neither eats into the colour nor
                          has to compete with it — which is why it can simply
                          be white on every swatch, pale ones included. */}
                      <View style={styles.paletteRing} pointerEvents="none" />
                      <MaterialCommunityIcons
                        name="check-bold" size={16} color={ringOn(p.color)}
                        style={styles.paletteTick} pointerEvents="none" />
                    </>
                  )}
                </Pressable>
              ))}
            </View>

            {/* Preview = an actual row off the Stations dial, not a card.
                The page is a printed list now (dial number, name, MINE chip,
                the station's colour on its icon), so a preview that isn't
                that shape is showing something the user will never see. The
                number is real: the id is settled when the sheet opens. */}
            <Text style={[styles.previewLabel, { fontFamily: Fonts.mono }]}>ON THE DIAL</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewNumCol}>
                <Text style={[styles.previewNum, { fontFamily: dsegFont }]} numberOfLines={1}>{dial.label}</Text>
              </View>
              <Text style={styles.previewName} numberOfLines={1}>{name.trim() || 'Station name'}</Text>
              <View style={styles.mineChip}><Text style={styles.mineChipText}>MINE</Text></View>
              <View style={styles.previewTrail}>
                <View style={styles.previewIconSlot}>
                  <MaterialCommunityIcons name={selectedIcon as any} size={20} color={selectedPalette.color} />
                </View>
                <View style={styles.previewCtrlSlot}>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.28)" />
                </View>
              </View>
            </View>
            <Text style={styles.previewTagline} numberOfLines={1}>
              {tagline.trim() || 'Your tagline here'}
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.saveBtn, (atLimit || saving) && styles.saveBtnDisabled]}
              onPress={atLimit ? undefined : handleSave}
              disabled={atLimit || saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : atLimit ? 'Upgrade to Pro' : editing ? 'Save changes' : 'Create station'}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Framing. A second Modal over this one is fine — the create sheet is a
          page-level modal, not one opened from inside a running drive, so the
          iOS "no third window" rule the modes live under does not apply. */}
      <PhotoFrameSheet
        photo={framing}
        onCancel={() => setFraming(null)}
        onConfirm={async (crop: CropRect) => {
          const chosen = framing;
          setFraming(null);
          if (!chosen) return;
          setPicking(true);
          const r = await saveStationPhoto(previewId, chosen.uri, crop);
          setPicking(false);
          if (r.kind === 'photo') { setPhoto(r.photo); setError(''); }
          else if (r.kind !== 'cancelled') setError("That photo couldn't be used. Try another one.");
        }}
      />
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
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoBtn: {
    flex: 1, height: 62, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  photoBtnSet: { borderColor: 'rgba(255,255,255,0.30)' },
  // Sits over the photo once there is one, so the label stays readable
  // whatever they picked — the same problem the modes solve with a scrim.
  photoBtnInner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(6,8,18,0.42)',
  },
  photoBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  photoClear: { paddingHorizontal: 14, paddingVertical: 12 },
  photoClearText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
  photoHint: { color: 'rgba(255,255,255,0.42)', fontSize: 12, marginTop: 8, marginBottom: 2 },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paletteCell: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // Inset -4 into the row's 10pt gap, so the ring clears its neighbours by 6.
  paletteRing: {
    position: 'absolute',
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  paletteTick: {
    position: 'absolute',
    // A tick as well as a ring: with 25 swatches on screen, a ring alone still
    // makes you hunt for which one is lit (owner, 11.08). Its colour flips on
    // pale swatches — that is what ringOn is for now.
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 3,
  },
  // ── Preview: one row off the Stations dial ───────────────────────────────
  // Column widths and type sizes are copied from stations.tsx on purpose —
  // if they drift the preview stops being a preview.
  previewLabel: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 9.5, fontWeight: '800', letterSpacing: 2,
    marginTop: 24, marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  previewNumCol: { width: 64, alignItems: 'flex-end', justifyContent: 'center' },
  previewNum: { fontSize: 16, color: 'rgba(255,255,255,0.42)' },
  previewName: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.94)',
    fontSize: 17, fontWeight: '600', letterSpacing: 0,
  },
  mineChip: {
    borderWidth: 1, borderColor: 'rgba(180,195,255,0.45)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  mineChipText: { color: '#cdd8ff', fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  previewTrail: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewIconSlot: { width: 28, alignItems: 'center' },
  previewCtrlSlot: { width: 16, alignItems: 'center' },
  // The tagline doesn't appear on the dial (it lives on the station's own
  // page), so it sits under the row as a caption rather than inside it.
  previewTagline: {
    color: Cruise.textSecondary,
    fontSize: 12,
    marginTop: 8,
    paddingLeft: 80,
  },
  errorText: {
    color: '#e05578',
    fontSize: 13,
    marginTop: 10,
  },
  // The app's primary button is a solid white pill with dark type (same as
  // the Refer-a-Friend card and every other confirm). The old version was a
  // slab in whatever colour the user had just picked, which made the CTA
  // change identity as you scrolled the swatches.
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#0a0a10',
    fontSize: 16,
    fontWeight: '700',
  },
});
