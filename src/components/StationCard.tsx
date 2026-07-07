import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Cruise } from '@/constants/theme';
import { GlossSheen } from '@/components/GlossSheen';
import type { Station } from '@/constants/stations';
import {
  PLATFORMS,
  PlatformId,
  getSavedPlatform,
  openMusicPlatform,
} from '@/utils/musicPlatform';

type Props = {
  station: Station;
  compact?: boolean;
  onPress?: () => void;
};

function triggerHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

function usePlatformColor() {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    getSavedPlatform().then((id) => {
      if (id && id !== 'none') {
        setColor(PLATFORMS[id as Exclude<PlatformId, 'none'>]?.color ?? null);
      }
    });
  }, []);
  return color;
}

async function handleStartDrive(stationName: string) {
  triggerHaptic();
  await openMusicPlatform(stationName);
}

// ── Landscape postcard for the horizontal recommended strip (250 × 150) ───────
// Photo-first: the station's scene runs sharp and full-bleed; the mood colour
// lives in the glow around the card and the tinted tag chip, not on the photo.
function CompactCard({ station, onPress }: { station: Station; onPress?: () => void }) {
  const platformColor = usePlatformColor();
  const tagTint = station.eqColors?.[1] ?? '#ffffff';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.compactShadow,
        { shadowColor: station.glowColor },
        pressed && styles.pressed,
      ]}
      onPress={onPress ?? (() => handleStartDrive(station.name))}>

      {/* Clip everything to the rounded rect */}
      <View style={styles.compactCard}>

        {/* The scene itself — sharp, untinted */}
        <Image source={station.image} style={StyleSheet.absoluteFill} resizeMode="cover" />

        {/* Bottom scrim for the name */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.62)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.compactOverlay}
        />

        {/* Glass finish — rim + light catch */}
        <GlossSheen radius={20} />

        <View style={styles.iconCircleSmall}>
          <MaterialCommunityIcons name={station.iconName as any} size={17} color="#fff" />
        </View>

        {station.premium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        )}

        <View style={styles.compactBottom}>
          <Text style={styles.compactName} numberOfLines={1}>{station.name}</Text>
          <View style={styles.compactDriveRow}>
            <View style={styles.tagsRow}>
              {station.tags.slice(0, 1).map((tag) => (
                <View
                  key={tag}
                  style={[styles.tag, { backgroundColor: tagTint + '30', borderWidth: 1, borderColor: tagTint + '55' }]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            {platformColor && (
              <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
            )}
          </View>
        </View>

      </View>
    </Pressable>
  );
}

// ── Full-width list card ──────────────────────────────────────────────────────
function ListCard({ station, onPress }: { station: Station; onPress?: () => void }) {
  const platformColor = usePlatformColor();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.cardShadow,
        { shadowColor: station.glowColor },
        pressed && styles.pressed,
      ]}
      onPress={onPress ?? (() => handleStartDrive(station.name))}>

      {/* Clip everything to the rounded rect */}
      <View style={styles.card}>

        {/* Layer 1 — mood gradient preview (horizontal) */}
        <LinearGradient
          colors={station.cardGradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Layer 2 — gentle left scrim for text legibility */}
        <LinearGradient
          colors={['rgba(3,3,10,0.20)', 'rgba(3,3,10,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Layer 3 — hairline top-edge highlight */}
        <View style={styles.cardInnerHighlight} />

        {/* Premium cards get a glossy shine on top of their mood colour */}
        {station.premium && <GlossSheen />}

        {/* Layer 4 — row content */}
        <View style={styles.cardRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={station.iconName as any} size={24} color="#fff" />
          </View>

          <View style={styles.textBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{station.name}</Text>
              {station.premium && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.tagline} numberOfLines={1}>{station.tagline}</Text>
            <View style={styles.tagsRow}>
              {station.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.chevronBlock}>
            {platformColor && (
              <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
            )}
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>

      </View>
    </Pressable>
  );
}

export function StationCard({ station, compact = false, onPress }: Props) {
  if (compact) return <CompactCard station={station} onPress={onPress} />;
  return <ListCard station={station} onPress={onPress} />;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },

  // ── Compact card ──────────────────────────────────────────────────────────
  compactShadow: {
    marginRight: 14,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  compactCard: {
    width: 250,
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  compactImageStyle: {
    borderRadius: 20,
  },
  compactOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
  },
  compactBottom: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    gap: 6,
  },
  compactName: {
    color: '#fff',
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  iconCircleSmall: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,20,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  iconEmojiSmall: { fontSize: 16 },

  // ── List card ─────────────────────────────────────────────────────────────
  cardShadow: {
    marginBottom: 14,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardImageStyle: {
    borderRadius: 20,
  },
  cardInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  textBlock: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  tagline: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tagText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chevronBlock: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  chevron: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 26,
    lineHeight: 28,
  },
  platformDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  compactDriveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  premiumBadge: {
    backgroundColor: Cruise.amber,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  premiumText: { color: '#000', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
});
