import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useDaylight } from '@/context/MotionContext';

import { ShareCardSheet } from '@/components/ShareCard';
import { SongListSheet } from '@/components/SongListSheet';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import type { Station } from '@/constants/stations';
import { useNowPlaying } from '@/context/NowPlayingContext';
import type { NowPlaying } from '@/utils/useMusicPlayback';

/**
 * The row of pills under every mode's transport controls:
 *
 *     [ Change Mood ] [ playlist name ] [ ↑ ]
 *
 * All eight modes used to carry their own byte-identical copy of this markup
 * and its styles, which is exactly how they drift apart. One component now,
 * so a change lands everywhere at once.
 *
 * The share pill only appears when a real song is playing — with no track
 * there is nothing to share but a mood tagline, and an always-present button
 * that sometimes shares nothing is worse than no button. Tapping it opens a
 * preview of the card that gets shared, the way Spotify does it.
 */

/** Long playlist names would squeeze the other two pills off the row, so the
 *  label is capped as well as being flex-shrunk and ellipsised. The cap is
 *  what stops a 60-character name from winning the layout fight on a narrow
 *  phone before ellipsising ever kicks in. */
const MAX_PLAYLIST_CHARS = 18;

function trim(label: string): string {
  return label.length > MAX_PLAYLIST_CHARS ? `${label.slice(0, MAX_PLAYLIST_CHARS - 1).trimEnd()}…` : label;
}

export function ModeActionRow({
  onChangeMood, onPickPlaylist, playlistLabel, contextUri, track, station, style,
}: {
  onChangeMood: () => void; // opens the mode sheet (historic prop name)
  onPickPlaylist: () => void;
  playlistLabel: string;
  /** The playlist actually feeding the music. Present = the pill can open
   *  its songs; absent (Apple Music, no context) = it opens the picker. */
  contextUri?: string | null;
  /** The live Spotify track, or null. Drives whether sharing is offered. */
  track: NowPlaying | null;
  station: Station;
  style?: object;
}) {
  const np = useNowPlaying();
  const day = useDaylight();
  const [sharing, setSharing] = useState(false);
  // Tapping the playlist pill opens the playlist's SONGS, not a picker of
  // other playlists (owner, 03.08 — wanting a particular song meant leaving
  // for Spotify). Changing playlist is one row inside that sheet, so the card
  // itself gains nothing.
  const [songs, setSongs] = useState(false);
  const canList = !!/^spotify:playlist:[A-Za-z0-9]+$/.exec(contextUri ?? '');
  // The mode's own name for the card. Read from the session rather than passed
  // in by each mode — one less prop for eight callers to keep in step.
  const modeId = np.session?.mode ?? 'equalizer';
  const modeLabel = MODE_CATALOG.find((m) => m.id === modeId)?.label ?? 'Cruise FM';

  return (
    <View style={[ar.row, style]}>
      <TouchableOpacity onPress={onChangeMood} style={[ar.pill, day && ar.pillDay]} activeOpacity={0.85}>
        <MaterialCommunityIcons name="tune-variant" size={15} color="#fff" />
        <Text style={ar.pillBold}>Change Mode</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => (canList ? setSongs(true) : onPickPlaylist())}
        style={[ar.pill, day && ar.pillDay, ar.pillFlex]}
        activeOpacity={0.85}>
        <Ionicons name="musical-notes-outline" size={14} color={day ? "#ffffff" : "rgba(255,255,255,0.7)"} />
        <Text style={[ar.pillText, day && ar.pillTextDay]} numberOfLines={1}>{trim(playlistLabel)}</Text>
      </TouchableOpacity>

      {!!track && (
        <TouchableOpacity onPress={() => setSharing(true)} style={[ar.pill, day && ar.pillDay, ar.pillIcon]} activeOpacity={0.85}
          accessibilityLabel="Share this song" accessibilityRole="button">
          {/* Ionicons' `share-outline` is the iOS box-with-an-arrow; Android's
              own share glyph is the three-node one, so each platform gets the
              symbol its users already recognise. */}
          <Ionicons
            name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
            size={17}
            color="#fff"
          />
        </TouchableOpacity>
      )}

      <SongListSheet
        visible={songs}
        onClose={() => setSongs(false)}
        onChangePlaylist={onPickPlaylist}
        contextUri={contextUri ?? null}
        playlistName={playlistLabel}
        currentUri={track?.uri ?? null}
      />

      <ShareCardSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        station={station}
        track={track}
        modeLabel={modeLabel}
        modeId={modeId}
      />
    </View>
  );
}

const ar = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 26, paddingHorizontal: 22, alignSelf: 'stretch' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  // The playlist pill takes what's left and gives way first. minWidth 0 is
  // load-bearing on a flex row: without it the text sets the pill's minimum
  // size and it refuses to shrink, pushing the share button off the edge.
  pillFlex: { flexShrink: 1, minWidth: 0 },
  pillIcon: { paddingHorizontal: 12, marginLeft: 'auto' },
  pillBold: { color: '#ffffff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  pillText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  // Daylight: a dark glass pill on a photograph has no edge at all in sun, so
  // the fill goes opaque and the rim and label go to full strength.
  pillDay: { backgroundColor: 'rgba(6,7,14,0.72)', borderColor: 'rgba(255,255,255,0.42)' },
  pillTextDay: { color: '#ffffff' },
});
