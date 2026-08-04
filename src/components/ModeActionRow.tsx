import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useDaylight } from '@/context/MotionContext';

import { ShareCardSheet } from '@/components/ShareCard';
import { SongListSheet } from '@/components/SongListSheet';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import type { Station } from '@/constants/stations';
import { useNowPlaying } from '@/context/NowPlayingContext';
import { appleMusicAvailable, isApplePlaylist } from '@/utils/appleMusic';
import { getSavedPlatform } from '@/utils/musicPlatform';
import { getStationPlaylist } from '@/utils/stationPlaylists';
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

/**
 * Photograph the screen AS IT IS — the running mode, the moment the share
 * pill is tapped, before the share sheet covers anything. This is the "share
 * it like a screenshot, in a card form" the owner asked for on 27.07: the
 * card's Snapshot style frames whatever this returns.
 *
 * Everything degrades to null: react-native-view-shot is a NATIVE module that
 * exists in builds 15+ but not on web or anything older, and this file ships
 * over the air into all of them. Null simply means the sheet opens with the
 * drawn styles, exactly as it did before snapshots existed. The race is a
 * seatbelt — a wedged native call must not leave the share pill dead.
 */
export type ModeSnapshot = { uri: string; w: number; h: number };

async function grabModeSnapshot(): Promise<ModeSnapshot | null> {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { captureScreen } = require('react-native-view-shot');
    if (typeof captureScreen !== 'function') return null;
    const uri: string = await Promise.race([
      captureScreen({ format: 'jpg', quality: 0.92, result: 'tmpfile' }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('capture timed out')), 1500)),
    ]);
    if (!uri) return null;
    // The card needs the capture's aspect to lay the full page out uncropped
    // (and to slice the status bar off by fraction) — the screen's points are
    // that aspect exactly.
    const scr = Dimensions.get('screen');
    return {
      // iOS hands back a bare path; SVG's Image wants a real uri.
      uri: uri.startsWith('/') ? `file://${uri}` : uri,
      w: scr.width, h: scr.height,
    };
  } catch {
    return null;
  }
}

function trim(label: string): string {
  return label.length > MAX_PLAYLIST_CHARS ? `${label.slice(0, MAX_PLAYLIST_CHARS - 1).trimEnd()}…` : label;
}

export function ModeActionRow({
  onChangeMood, onPickPlaylist, playlistLabel, contextUri, track, station, style,
}: {
  onChangeMood: () => void; // opens the mode sheet (historic prop name)
  onPickPlaylist: () => void;
  playlistLabel: string;
  /** The playlist Spotify says is feeding the music. When it is missing the
   *  station's own linked playlist stands in; only with neither (Apple Music,
   *  an unlinked station) does the pill fall back to the picker. */
  contextUri?: string | null;
  /** The live Spotify track, or null. Drives whether sharing is offered. */
  track: NowPlaying | null;
  station: Station;
  style?: object;
}) {
  const np = useNowPlaying();
  const day = useDaylight();
  const [sharing, setSharing] = useState(false);
  const [snap, setSnap] = useState<ModeSnapshot | null>(null);
  // Tapping the playlist pill opens the playlist's SONGS, not a picker of
  // other playlists (owner, 03.08 — wanting a particular song meant leaving
  // for Spotify). Changing playlist is one row inside that sheet, so the card
  // itself gains nothing.
  const [songs, setSongs] = useState(false);

  /**
   * The station's own linked playlist, as a fallback for the song list.
   *
   * `contextUri` is whatever SPOTIFY says is playing, and it is empty until
   * the poll has answered — and stays empty whenever the context isn't a
   * playlist at all. The pill quietly fell back to the playlist PICKER in
   * that case, so tapping it mid-drive opened the wrong sheet and the owner
   * reported the song options simply not coming up (03.08). The station
   * already knows which playlist it drives, so there is no need to wait on
   * Spotify to answer before we can list it.
   */
  const [linkedUri, setLinkedUri] = useState<string | null>(null);
  const stationId = np.session?.stationId;
  useEffect(() => {
    if (!stationId) { setLinkedUri(null); return; }
    let live = true;
    getStationPlaylist(stationId)
      .then((p) => { if (live) setLinkedUri(p?.uri ?? null); })
      .catch(() => { if (live) setLinkedUri(null); });
    return () => { live = false; };
  }, [stationId]);

  // Either platform's playlist can be listed. Apple's ids are not restricted
  // to Spotify's alphabet, so the two patterns are kept separate rather than
  // loosened into one — an Apple id must never be handed to a Spotify call.
  // A link saved for the other platform is not this drive's playlist — the
  // pill named a Spotify list on an Apple Music drive (owner, 04.08). Judge
  // it the way playback does.
  const [appleActive, setAppleActive] = useState(false);
  useEffect(() => {
    getSavedPlatform()
      .then((pf) => setAppleActive(pf === 'appleMusic' && appleMusicAvailable()))
      .catch(() => {});
  }, []);
  const usableUri = (uri?: string | null) =>
    !uri ? null : (appleActive ? isApplePlaylist(uri) : !isApplePlaylist(uri)) ? uri : null;

  const isPlaylist = (uri?: string | null) =>
    !!/^spotify:playlist:[A-Za-z0-9]+$/.exec(uri ?? '') || !!/^applemusic:playlist:.+$/.exec(uri ?? '');
  const usableLinked = usableUri(linkedUri);
  const canList = isPlaylist(usableUri(contextUri)) || isPlaylist(usableLinked);
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
        <TouchableOpacity
          onPress={async () => {
            // Capture BEFORE the sheet renders — once it's up, the screen is
            // the sheet, not the mode. A failed capture opens the sheet
            // anyway, just without the Snapshot style.
            setSnap(await grabModeSnapshot());
            setSharing(true);
          }}
          style={[ar.pill, day && ar.pillDay, ar.pillIcon]} activeOpacity={0.85}
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
        contextUri={isPlaylist(usableUri(contextUri)) ? (contextUri ?? null) : usableLinked}
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
        snapshot={snap}
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
