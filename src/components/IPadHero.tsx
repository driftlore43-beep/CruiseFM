import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CARD_W, STAGE_H } from '@/components/ShareModeArt';
import type { Station } from '@/constants/stations';
import { useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

/**
 * THE IPAD HERO — the station's own photograph at a shape that suits a tablet.
 *
 * THE MODE'S OBJECT CAME OUT AGAIN ON 13.09 (owner: "I think Cursor placed the
 * music mode in the 'let's put something on' card — let's remove that, it
 * doesn't look too clean"). Everything below about WHY the art was drawn here
 * is left standing because it explains the shape that remains: this is still a
 * 1.46:1 banner rather than the phone's 4:1 letterbox, and it still sits on the
 * blurred backdrop rather than a stretched sharp file. What it no longer does
 * is put a record on the home page — the record belongs to the Vinyl deck, and
 * a second one on the card that OPENS that deck said the same thing twice.
 *
 * ---- the original note, for the reasoning that still applies ----
 *
 * A real object, not a bigger version of the phone banner.
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
  station, eyebrow, headline, buttonLabel, onPress, width,
}: {
  station: Station;
  eyebrow: string;
  headline: string;
  buttonLabel: string;
  onPress: () => void;
  width: number;
}) {
  const styles = useStyles(makeStyles);
  const height = Math.round(width * HERO_RATIO);
  const bgUri = photoUri(station.imageBlur ?? station.image);

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

      {/* Scrim, heaviest at the foot where the type sits — same "the type
          bands are shaded more than the picture between them" rule every
          mode's own backdrop follows (ModeScrim). It stays almost untouched
          across the picture and only darkens hard in the last quarter, where
          nothing but type and the button live — which is the shape it was
          measured into when an object still sat above it, and is now simply
          what lets the photograph be the picture. */}
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
    // A SIZED CHILD OF A STRETCH COLUMN LANDS FLUSH LEFT, and every other
    // block on the page is inset by the gutter on BOTH sides — so without
    // this the hero sat 20 points left of the heading above it and of the
    // tab bar below it, with all its slack piled on the right. That is the
    // same "the bar plainly belonged to a different page" fault the single
    // gutter exists to prevent (31.07), arrived at from the other side.
    alignSelf: 'center',
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
