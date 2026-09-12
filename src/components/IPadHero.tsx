import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg from 'react-native-svg';

import { ModeHero, CARD_W, STAGE_H, STAGE_TOP, type Eq } from '@/components/ShareModeArt';
import type { Station } from '@/constants/stations';
import { useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

/**
 * THE IPAD HERO — a real object, not a bigger version of the phone banner.
 *
 * Owner, 10.09 and 12.09: the reading-column fix stretched the phone's flat
 * hero into a 4:1 letterbox, and her own reaction to the turntable mockup was
 * "that's the idea I mean" — a genuine record (or ball, or CD) dominating the
 * screen, with the station's own photo and colours, not a redrawn lookalike.
 *
 * THE ART IS THE APP'S OWN, NOT A COPY OF IT. `ModeHero` (ShareModeArt.tsx)
 * already exists precisely for this — it is the production recipe the share
 * cards draw from, ported from each live mode's own geometry (the record's
 * grooves and J-shaped tonearm, the CD's jewel case, the mirror ball's tile
 * grid), and it was sitting UNUSED: `derive()` in ShareCardStyles.tsx builds
 * one and nothing ever renders it. This is its first real home.
 *
 * THE CROP IS FREE. `ModeHero` draws inside a known band of its own fixed
 * 1080-wide canvas — `STAGE_TOP`..`STAGE_TOP+STAGE_H`, "the band of the card
 * the mode owns" per that file's own comment — so reading the SAME band as
 * the viewBox here is guaranteed to frame whichever mode's art correctly,
 * with no per-mode cropping math to get wrong. That band is 1080x740, a
 * 1.46:1 landscape shape — a banner, not a portrait card.
 *
 * THE OBJECT SITS ON THE STATION'S OWN PHOTOGRAPH, the same blurred backdrop
 * every fullscreen mode already uses (never a sharp file blown up full-bleed
 * — this app's own re-blur-on-render lesson). `ModeHero` itself draws no
 * background, so it layers over that photo and its scrim as a transparent
 * sibling — same layering every mode already uses for its own object.
 *
 * THE LABEL/COVER GETS THE SHARP PHOTO, not the blurred one — it is drawn
 * small (a circle well under a fifth of the canvas), where the blur would
 * just read as an out-of-focus smear rather than a picture.
 */

/**
 * Resolve a station's photo to a plain URI string — what react-native-svg's
 * `<Image href>` and RN's own `<Image source>` both eventually want. A
 * bundled station is a `require()`d number on native and already a string on
 * web (react-native-web resolves image imports to a URL at build time); a
 * custom station's photo is already a string path either way. Mirrors the
 * same number/string split `stationImageSource()` makes for the plain RN
 * `<Image>` case elsewhere in the app.
 */
function photoUri(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image;
  // WEB'S require() DOES NOT MATCH THE NATIVE/CUSTOM SPLIT stationImage.ts
  // documents (number on native, string for a custom station's file path) —
  // measured rather than assumed: on this Metro web build a bundled asset
  // resolves to an OBJECT carrying its own `uri` (the same shape the intro
  // logo's <img> tags load from), not a plain string or a numeric asset id.
  // Handle that shape before falling through to the native resolver, or a
  // built-in station's photo silently has no backdrop on web (and nearly did
  // here — caught by looking at what the browser actually rendered rather
  // than trusting the native-only doc comment on stationImageSource).
  if (typeof image === 'object' && image !== null && 'uri' in image) {
    const uri = (image as { uri?: unknown }).uri;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  try {
    return RNImage.resolveAssetSource(image as number)?.uri ?? null;
  } catch {
    return null;
  }
}

const HERO_RATIO = STAGE_H / CARD_W; // 740 / 1080

export function IPadHero({
  station, mode, eyebrow, headline, buttonLabel, onPress, width,
}: {
  station: Station;
  mode: string;
  eyebrow: string;
  headline: string;
  buttonLabel: string;
  onPress: () => void;
  width: number;
}) {
  const styles = useStyles(makeStyles);
  const height = Math.round(width * HERO_RATIO);
  const eq = (station.eqColors ?? ['#5EE7FF', '#5B7BFF', '#C44CFF']) as Eq;
  const bgUri = photoUri(station.imageBlur ?? station.image);
  const artUri = photoUri(station.image) ?? bgUri;

  return (
    <Pressable onPress={onPress} style={[styles.wrap, { width, height }]}>
      {bgUri ? (
        <RNImage source={{ uri: bgUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={station.cardGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* The object — transparent everywhere but the record/ball/disc itself,
          so the photo shows through around it exactly like a live mode. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`0 ${STAGE_TOP} ${CARD_W} ${STAGE_H}`}>
          <ModeHero
            modeId={mode}
            eq={eq}
            art={artUri}
            uid="ipadhero"
            title={station.name}
            artist=""
            freq={0}
          />
        </Svg>
      </View>

      {/* Scrim, heaviest at the foot where the type sits — same "the type
          bands are shaded more than the picture between them" rule every
          mode's own backdrop follows (ModeScrim). MEASURED against the
          Equalizer's own art, which is the tallest of the eight (its bars
          fill the whole STAGE band): a gentle single ramp left the headline
          sitting on bright bar-tops at 0.30 opacity — nearly clear was the
          fault, not the colour, so the ramp now stays almost untouched
          until well past the object's own height and only darkens hard in
          the last quarter, where nothing but type and the button live. */}
      <LinearGradient
        colors={['rgba(4,4,10,0.02)', 'rgba(4,4,10,0.05)', 'rgba(4,4,10,0.62)', 'rgba(4,4,10,0.94)']}
        locations={[0, 0.55, 0.78, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.foot} pointerEvents="box-none">
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.station}>{station.name}</Text>
        <Pressable onPress={onPress} style={styles.cta} hitSlop={8}>
          <Text style={styles.ctaText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const makeStyles = (_p: Palette) => StyleSheet.create({
  wrap: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#07070c',
  },
  foot: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 26,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 2.6,
    marginBottom: 8,
  },
  headline: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  station: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 20,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  ctaText: {
    color: '#0a0a10',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
