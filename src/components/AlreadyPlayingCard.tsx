import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
 * WHICH STATION: if the playlist that is playing is one a station is linked
 * to, that station, because that is the true answer rather than a guess.
 * Otherwise the hour's own pick, which is what the home page would have
 * offered anyway. The MODE is the last one they drove in.
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
export function AlreadyPlayingCard({ track, contextUri, contextName }: {
  track: NowPlaying | null;
  contextUri: string | null;
  contextName: string | null;
}) {
  const ap = useStyles(make_ap);
  const pal = usePalette();
  const np = useNowPlaying();
  const [pick, setPick] = useState<{ stationId: string; mode: string } | null>(null);

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
        if (active) setPick({ stationId: linked ?? defaultStationForNow(), mode: last.mode });
      })();
      return () => { active = false; };
    }, [contextUri]),
  );

  // Only with a song genuinely playing, and never over a drive that is
  // already running.
  if (np.session || !track || track.isPlaying === false || !pick) return null;

  const station = resolveAnyStation(pick.stationId);

  const go = () => {
    recordDriveStart(pick.stationId, undefined, pick.mode).catch(() => {});
    // `adopt`: open the session and leave the music completely alone.
    np.open(pick.mode, pick.stationId, { adopt: true });
  };

  return (
    <Pressable style={ap.card} onPress={go}>
      <View style={ap.iconRing}>
        <MaterialCommunityIcons name="ear-hearing" size={19} color={pal.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ap.title} numberOfLines={1}>
          I can hear {track.title}
        </Text>
        {/* THE PLAYLIST LEADS when we know it. Naming it is the difference
            between a guess and a fact, and it is how someone spots that their
            music is not the playlist they thought it was — which is the thing
            that prompted this card. */}
        <Text style={ap.sub} numberOfLines={2}>
          {contextName ? `${contextName} · keep it playing on ${station.name}`
                       : `Keep it playing on ${station.name}`}
        </Text>
      </View>
      <View style={ap.go}>
        <MaterialCommunityIcons name="play" size={18} color={pal.mode === 'light' ? pal.panel : '#0a0a12'} />
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
