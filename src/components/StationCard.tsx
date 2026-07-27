import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
// Accent-first: the card wears the station's own accent palette (eqColors) as
// a vivid diagonal gradient under the glass finish.
function CompactCard({ station, onPress }: { station: Station; onPress?: () => void }) {
  const platformColor = usePlatformColor();
  const accents = station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF'];
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

        {/* Smoked-glass base. The accent sits ON this rather than replacing
            it, so the card reads as tinted glass over the dark app rather
            than a solid slab of colour. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,17,29,0.55)' }]} />

        {/* The station's accent palette, held well back — enough to tell the
            stations apart at a glance, not enough to shout. */}
        <LinearGradient
          colors={accents}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.42 }]}
        />

        {/* Bottom scrim for the name */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
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
                  style={[styles.tag, { backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)' }]}>
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
// Used only by the Stations page, which is laid out like a receiver: the dial
// number sits outside the card on the left, so the station's name is CENTRED
// inside it. That means nothing else may share the name's row — the PREMIUM
// badge moved to the card's own top-right corner, and the block on the right
// is padded to the icon's width so the middle is genuinely the middle.
function ListCard({ station, onPress }: { station: Station; onPress?: () => void }) {
  const platformColor = usePlatformColor();
  // The station's own mood colour, held back. A full-strength gradient slab is
  // what the Modes tab does, and having both pages wear it made them twins —
  // and it shouted over the dial, which is meant to be the loudest thing here.
  const accent = station.eqColors?.[1] ?? '#5B7BFF';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.cardShadow,
        { shadowColor: station.glowColor },
        pressed && styles.pressed,
      ]}
      onPress={onPress ?? (() => handleStartDrive(station.name))}>

      {/* Clip everything to the rounded rect */}
      <View style={[styles.card, { borderColor: accent + '5C' }]}>

        {/* Layer 1 — smoked glass. The colour sits ON this rather than
            replacing it, so the card reads as tinted glass over the dark app. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(13,15,26,0.58)' }]} />

        {/* Layer 2 — the mood. Strongest at the left edge and still present at
            the right, so the card is coloured glass rather than a grey slab
            with a tinted corner. */}
        <LinearGradient
          colors={[accent + '82', accent + '46', accent + '1A']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* A little top-down lift, so the colour doesn't read as a flat fill */}
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Layer 3 — hairline top-edge highlight */}
        <View style={styles.cardInnerHighlight} />

        {/* Premium cards get a glossy shine */}
        {station.premium && <GlossSheen />}

        {/* Layer 4 — row content */}
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, { backgroundColor: accent + '38', borderColor: accent + '99' }]}>
            <MaterialCommunityIcons name={station.iconName as any} size={22} color="#fff" />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>{station.name}</Text>
            <Text style={styles.tagline} numberOfLines={1}>{station.tagline}</Text>
            <View style={styles.tagsRow}>
              {station.tags.slice(0, 1).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Same width as the icon, so the text block sits dead centre */}
          <View style={styles.chevronBlock}>
            {platformColor && (
              <View style={[styles.platformDot, { backgroundColor: platformColor }]} />
            )}
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
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
    // Softer, deeper lift than the old neon halo — the glow reads as the
    // card floating, not as the card being lit from behind.
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  compactCard: {
    width: 250,
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 9,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  textBlock: { flex: 1, gap: 3, alignItems: 'flex-start' },
  name: { color: '#fff', fontSize: 16, fontWeight: '800' },
  tagline: { color: 'rgba(255,255,255,0.72)', fontSize: 11.5, lineHeight: 16 },
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
  // No longer padded to the icon's width — that only existed to keep the name
  // centred, and the name is left-aligned now.
  chevronBlock: {
    width: 26,
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
