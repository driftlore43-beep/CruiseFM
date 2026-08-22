import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect } from 'expo-router';

import { usePalette, useStyles } from '@/context/AppearanceContext';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { resolveAnyStation } from '@/utils/customStations';
import { recordDriveStart } from '@/utils/driveStats';
import { defaultStationForNow, resolveCruiseToStart } from '@/utils/lastCruise';
import { stationForPlaylist } from '@/utils/stationPlaylists';
import type { Palette } from '@/utils/appearance';
import type { NowPlaying } from '@/utils/useMusicPlayback';

/**
 * "I can hear this — want to cruise with it?"
 *
 * Owner, 18.08: "there should be something at the top, like 'I hear this song
 * playing…', 'do you want to continue', and then it selects a station and a
 * mood. Because sometimes the playlists don't stick and users play whatever
 * song comes up."
 *
 * THE POINT IS THAT IT STARTS NOTHING. Every other way into a drive tells the
 * music service what to play; this one takes what is already playing and
 * wraps a station and a mode around it. That is the case the app had no
 * answer for — someone with music already going, who wants the visual, and
 * whose only route in was to have their song replaced.
 *
 * WHICH STATION — AND WHO DECIDES. If the playlist that is playing is one a
 * station is linked to, that station, because it is the true answer: one tap
 * and the drive opens. Otherwise WE ARE GUESSING, and the card asks instead
 * (owner, 18.08: "for a solo song that is playing, not associated with a
 * playlist, allow the user to choose the station and [the mode]"). A solo
 * track, an album, the radio, or a playlist no station owns all land here —
 * one rule, "ask when we do not know", rather than a special case for each.
 *
 * The button says which it is going to be: a play triangle starts something,
 * a chevron opens a chooser. A control that sometimes starts a drive and
 * sometimes asks a question, behind the same glyph, is the kind of thing this
 * app keeps taking out.
 *
 * IT NEVER APPEARS DURING A DRIVE, and it never appears without a real song —
 * a card that says "I hear this" when it hears nothing is exactly the kind of
 * claim this app keeps taking out.
 *
 * ON APPLE MUSIC it still works, with less to say: the system player exposes
 * no queue-source id, so `contextUri` is null, which means no playlist name
 * and no station match — it falls through to the hour's station. That is the
 * honest outcome rather than a guess dressed up as a match.
 */
/**
 * THE LITTLE BARS THAT SAY "THIS IS LIVE".
 *
 * The card claims to be hearing something; three bars moving is the cheapest
 * possible proof, and it is the app's own language — the home header has used
 * the same meter since 02.08.
 *
 * SAME TECHNIQUE AS THAT HEADER, and for the reason recorded there rather
 * than by preference: React Native's own `Animated` on the NATIVE driver,
 * transforming `scaleY` — never `height`, which is a layout property and so
 * cannot leave the JS thread, and never Reanimated, which measurably did not
 * animate on the owner's device while looking perfect in a browser. The bar
 * is drawn at full height and squashed, so it needs a paired `translateY` of
 * half the difference to keep its foot on the baseline (RN has no
 * transform-origin).
 */
const BARS = [
  { maxH: 13, duration: 460, delay: 0 },
  { maxH: 18, duration: 560, delay: 90 },
  { maxH: 10, duration: 500, delay: 40 },
];
const BAR_REST = 3;

function LiveBar({ maxH, duration, delay, live }: {
  maxH: number; duration: number; delay: number; live: boolean;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!live) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    // The delay runs ONCE, before the loop. Inside it, every bar would pause
    // at the bottom of each cycle and the three would breathe in unison.
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
    ]);
    anim.start();
    return () => anim.stop();
  }, [live, delay, duration, v]);

  return (
    <Animated.View
      style={{
        width: 3, height: maxH, borderRadius: 1.5, backgroundColor: '#fff',
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [(maxH - BAR_REST) / 2, 0] }) },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [BAR_REST / maxH, 1] }) },
        ],
      }}
    />
  );
}

/**
 * Open a drive around music that is ALREADY playing, without starting or
 * changing anything. Shared, because the card takes this path itself when it
 * knows the station, and the page takes it after asking when it doesn't —
 * two callers, one definition, so they cannot drift.
 */
export function startAdoptedDrive(
  np: ReturnType<typeof useNowPlaying>, stationId: string, mode: string,
): void {
  recordDriveStart(stationId, undefined, mode).catch(() => {});
  np.open(mode, stationId, { adopt: true });
}

export function AlreadyPlayingCard({ track, contextUri, contextName, onAsk }: {
  track: NowPlaying | null;
  contextUri: string | null;
  contextName: string | null;
  /**
   * Ask the PAGE to run the station/mode chooser.
   *
   * The sheets cannot live in here: this card sits inside the page's
   * ScrollView, and an absolutely-positioned sheet is placed against its
   * nearest positioned ancestor — so it landed somewhere down the scroll
   * content instead of over the screen, mounted and invisible. They are
   * rendered as siblings of the ScrollView instead, which is exactly how the
   * Modes tab does it.
   */
  onAsk: (defaultMode: string) => void;
}) {
  const ap = useStyles(make_ap);
  const pal = usePalette();
  const np = useNowPlaying();
  // `stationId` is null when nothing owns this music — the signal that the
  // card must ask rather than act.
  const [pick, setPick] = useState<{ stationId: string | null; mode: string } | null>(null);

  // Worked out on focus rather than on tap: the button should name the
  // station it is about to open, not surprise you with one.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [linked, last] = await Promise.all([
          stationForPlaylist(contextUri),
          resolveCruiseToStart(),
        ]);
        if (active) setPick({ stationId: linked, mode: last.mode });
      })();
      return () => { active = false; };
    }, [contextUri]),
  );

  // Only with a song genuinely playing, and never over a drive that is
  // already running.
  if (np.session || !track || track.isPlaying === false || !pick) return null;

  const known = pick.stationId !== null;
  const station = known ? resolveAnyStation(pick.stationId as string) : null;


  return (
    <Pressable
      style={ap.card}
      onPress={() => (known ? startAdoptedDrive(np, pick.stationId as string, pick.mode)
                            : onAsk(pick.mode))}>
      {/* THE COVER OF WHAT IS ACTUALLY PLAYING. The card asserts it can hear
          something; showing the record it is hearing is the difference
          between a notice and a moment. Album art already reaches us on both
          services — Spotify sends it, Apple Music's comes from the public
          catalogue lookup — and when it doesn't, the ear icon stands in
          rather than a grey square pretending to be artwork. */}
      <View style={ap.art}>
        {track.albumArt
          ? <ExpoImage source={{ uri: track.albumArt }} contentFit="cover" style={StyleSheet.absoluteFill} />
          : <View style={ap.artFallback}>
              <MaterialCommunityIcons name="ear-hearing" size={19} color={pal.text} />
            </View>}
        {/* The bars sit ON the cover, over a scrim that runs the width of the
            tile — a bare white bar can land on a pale album and vanish. */}
        <View style={ap.barsScrim} pointerEvents="none">
          <View style={ap.bars}>
            {BARS.map((b, i) => <LiveBar key={i} {...b} live />)}
          </View>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* EYEBROW + NAME, the app's own grammar — the same shape as YOU'RE
            LISTENING TO over a station, or TONIGHT'S PICK over the hero. It
            is here for a plain reason: "I can hear Wake Me Up When September
            Ends" does not fit on a phone, and putting the claim in a small
            line above hands the whole width to the thing worth reading. */}
        <Text style={ap.eyebrow}>I CAN HEAR</Text>
        {/* TWO LINES. A song title is the one thing on this card worth reading in
            full, and plenty of them do not fit a phone's width beside a cover
            and a button — "Wake Me Up When September Ends" is the owner's own
            example and it clipped at one line. The card grows by a line only
            when it has to. */}
        <Text style={ap.title} numberOfLines={2}>{track.title}</Text>
        {/* THE PLAYLIST LEADS when we know it. Naming it is the difference
            between a guess and a fact, and it is how someone spots that their
            music is not the playlist they thought it was — which is the thing
            that prompted this card. */}
        {/* THE ARTIST LEADS THE SUB-LINE. It belongs to the song, which is
            what someone is reacting to when they glance at this — and the
            playlist keeps its place directly after, because naming it is
            still the difference between a guess and a fact, and it is how
            someone spots that their music is not the playlist they thought
            it was. That was the thing that prompted this card. */}
        <Text style={ap.sub} numberOfLines={2}>
          {[
            track.artist || null,
            station
              ? (contextName ? `${contextName} — keep it playing on ${station.name}`
                             : `Keep it playing on ${station.name}`)
              : 'Keep it playing — pick a mood and a look',
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={ap.go}>
        {known
          ? <MaterialCommunityIcons name="play" size={18} color={pal.mode === 'light' ? pal.panel : '#0a0a12'} />
          : <Ionicons name="chevron-forward" size={17} color={pal.mode === 'light' ? pal.panel : '#0a0a12'} />}
      </View>
    </Pressable>
  );
}

const make_ap = (p: Palette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: p.ink(0.05),
    borderWidth: 1,
    borderColor: p.ink(0.14),
  },
  art: {
    width: 54, height: 54, borderRadius: 12, overflow: 'hidden',
    backgroundColor: p.ink(0.06),
    borderWidth: 1, borderColor: p.ink(0.12),
  },
  artFallback: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // Anchored to the foot of the tile so the bars stand on its bottom edge.
  barsScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 26,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, paddingLeft: 7, paddingBottom: 6 },
  eyebrow: {
    color: p.ink(0.5), fontSize: 8.5, fontWeight: '800', letterSpacing: 1.4,
    marginBottom: 2,
  },
  iconRing: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.ink(0.06),
    borderWidth: 1, borderColor: p.ink(0.14),
  },
  title: { color: p.text, fontSize: 14.5, fontWeight: '800', letterSpacing: 0 },
  sub: { color: p.ink(0.66), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  // The app's primary button, in miniature: a solid fill in the opposite of
  // the page, with the glyph in the page's own colour.
  go: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.mode === 'light' ? p.text : '#ffffff',
  },
});
