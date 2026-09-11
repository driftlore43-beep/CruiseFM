import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDsegFonts } from '@/components/StationIdentity';
import { MODE_CATALOG } from '@/constants/modeCatalog';
import { stationDial } from '@/constants/stations';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { resolveAnyStation } from '@/utils/customStations';
import type { DriveEvent } from '@/utils/driveStats';
import { words } from '@/utils/sessionKind';

/**
 * The record of one drive, printed like a ticket the receiver issued.
 *
 * WHY IT EXISTS: beauty alone gives nobody a reason to come back. A drive is
 * an EVENT — it has a beginning and an end and a place you were — and the
 * thing that turns a visualiser into a habit is remembering it. Strava's
 * product is not the run, it is the record of the run.
 *
 * WHAT IT MAY SAY, and this is the whole design constraint: only things the
 * app genuinely knows. When it was, how long for, which station, which mode,
 * whether it was a drive or a desk session (because the listener answered
 * that themselves), which number it is — and the songs ONLY when a music
 * service is connected. There is no map and there never can be: Cruise FM has
 * no location permission and should not want one. Nothing here prints a
 * distance, a route or a speed.
 *
 * IT HAS TO BE GOOD WITHOUT SONGS. Most listeners are in companion mode,
 * where the app cannot see another app's playback, so the tracklist is the
 * bonus and never the design.
 */
export function DriveStub({
  drive, visible, onClose, ordinal, thisWeek,
}: {
  drive: DriveEvent;
  visible: boolean;
  onClose: () => void;
  /** Which number session this was, all-time. */
  ordinal: number;
  /** How many of the same kind this week, this one included. */
  thisWeek: number;
}) {
  const s = useStyles(makeStyles);
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <StubCard drive={drive} ordinal={ordinal} thisWeek={thisWeek} />
          </ScrollView>
          <Pressable style={s.done} onPress={onClose}>
            <Text style={s.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The stub itself, without the sheet around it — so the log can show the same
 * card when you tap a past drive.
 */
export function StubCard({
  drive, ordinal, thisWeek,
}: {
  drive: DriveEvent; ordinal: number; thisWeek: number;
}) {
  const s = useStyles(makeStyles);
  const { seg7 } = useDsegFonts();
  const station = resolveAnyStation(drive.stationId);
  const dial = stationDial(drive.stationId, !!station.premium, station.dialAm);
  const accent = station.eqColors?.[1] ?? '#F59E0B';
  const w = words(drive.kind ?? 'driving');
  const modeLabel = MODE_CATALOG.find((m) => m.id === drive.mode)?.label ?? null;
  const tracks = drive.tracks ?? [];

  return (
    <View style={s.card}>
      <View style={[s.tint, { backgroundColor: accent }]} />
      <View style={s.head}>
        <View style={s.dialRow}>
          <Text style={[s.dial, seg7 ? { fontFamily: seg7 } : null]}>{dial.label}</Text>
          <Text style={s.station} numberOfLines={1}>{station.name}</Text>
        </View>
        <Text style={s.when}>{whenLabel(drive.ts)}</Text>

        <Text style={s.big}>
          {durationLabel(drive.minutes ?? 0)}
          <Text style={s.bigUnit}>{'  '}{unitLabel(drive.minutes ?? 0)}</Text>
        </Text>
        {/* Anything logged before 13.08 has no mode — it simply isn't printed,
            rather than guessed at. */}
        {!!modeLabel && <Text style={s.mode}>{modeLabel}</Text>}
      </View>

      {/* The tear. Two notches punched in the sheet's own colour, so the card
          reads as torn rather than as a panel with a dashed line across it. */}
      <View style={s.perfWrap}>
        <View style={[s.notch, s.notchL]} />
        <View style={s.perf} />
        <View style={[s.notch, s.notchR]} />
      </View>

      <View style={s.foot}>
        <Text style={s.count}>{`Your ${ordinalLabel(ordinal)} ${w.noun}`}</Text>
        <Text style={s.sub}>
          {thisWeek <= 1 ? `First this week` : `${nth(thisWeek)} this week`}
        </Text>

        {tracks.length > 0 && (
          <View style={s.tracks}>
            {tracks.map((t, i) => (
              <View key={`${t.title}-${i}`} style={s.trk}>
                <Text style={[s.trkNo, seg7 ? { fontFamily: seg7 } : null]}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text style={s.trkTitle} numberOfLines={1}>{t.title}</Text>
                {!!t.artist && <Text style={s.trkArtist} numberOfLines={1}>{t.artist}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** One line in the log. */
export function DriveRow({
  drive, onPress, last,
}: { drive: DriveEvent; onPress: () => void; last?: boolean }) {
  const s = useStyles(makeStyles);
  const pal = usePalette();
  const { seg7 } = useDsegFonts();
  const station = resolveAnyStation(drive.stationId);
  const dial = stationDial(drive.stationId, !!station.premium, station.dialAm);
  const modeLabel = MODE_CATALOG.find((m) => m.id === drive.mode)?.label;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, !last && s.rowRule, pressed && s.rowPressed]}>
      <Text style={[s.rowDial, seg7 ? { fontFamily: seg7 } : null]}>{dial.label}</Text>
      <View style={s.rowMid}>
        <Text style={s.rowTitle} numberOfLines={1}>{station.name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {shortDay(drive.ts)}{modeLabel ? ` · ${modeLabel}` : ''}
          {drive.kind === 'listening' ? ' · listening' : ''}
        </Text>
      </View>
      <Text style={s.rowLen}>{compactLength(drive.minutes ?? 0)}</Text>
      <MaterialCommunityIcons name="chevron-right" size={17} color={pal.ink(0.3)} />
    </Pressable>
  );
}

// ── words ────────────────────────────────────────────────────────────────────

/** "Tuesday · 8:14pm", or the date once it is no longer this week. */
function whenLabel(ts: number): string {
  const d = new Date(ts);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const withinWeek = Date.now() - ts < 6 * 24 * 3600 * 1000;
  const day = withinWeek
    ? days[d.getDay()]
    : `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${h12}:${m}${suffix}`;
}

/** The hero number. Under an hour it is plain minutes; over, it is h:mm — a
 *  "94 minutes" reads as a measurement, "1:34" reads as a length of time. */
function durationLabel(mins: number): string {
  if (mins < 60) return String(mins);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}
function unitLabel(mins: number): string {
  return mins < 60 ? (mins === 1 ? 'minute' : 'minutes') : 'hours';
}
function compactLength(mins: number): string {
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
function shortDay(ts: number): string {
  const d = new Date(ts);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}
function nth(n: number): string {
  return `${n}${suffixFor(n)}`;
}
function ordinalLabel(n: number): string {
  return `${n}${suffixFor(n)}`;
}
function suffixFor(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

// ── styles ───────────────────────────────────────────────────────────────────

const PAPER = '#F4F1E8';
const PAPER_INK = '#1a1a1e';
const PAPER_INK_2 = '#6d6a63';
const PAPER_RULE = '#ddd8c9';

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: p.mode === 'light' ? p.bg : '#0a0a10',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    maxHeight: '88%',
  },
  scroll: { paddingBottom: 14 },
  done: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: p.text,
    marginTop: 14,
  },
  doneText: { color: p.bg, fontSize: 15, fontWeight: '800' },

  // THE CARD IS ALWAYS PAPER, in either theme. It is a printed object, not a
  // panel of the app — the same reasoning that keeps station artwork its own
  // colours on a light page.
  card: { backgroundColor: PAPER, borderRadius: 14, overflow: 'hidden' },
  /** A band of the station's own light down the left edge — the one place the
   *  mood shows on an otherwise printed card. */
  tint: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  head: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 15 },
  dialRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  dial: { fontSize: 15, color: '#8a8781' },
  station: { flexShrink: 1, fontSize: 20, fontWeight: '800', color: PAPER_INK },
  when: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, color: PAPER_INK_2, marginTop: 7, textTransform: 'uppercase' },
  big: { fontSize: 46, fontWeight: '800', color: PAPER_INK, marginTop: 14 },
  bigUnit: { fontSize: 17, fontWeight: '700', color: PAPER_INK_2 },
  mode: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, color: PAPER_INK_2, marginTop: 6, textTransform: 'uppercase' },

  perfWrap: { flexDirection: 'row', alignItems: 'center' },
  perf: {
    flex: 1, height: 1, marginHorizontal: 8,
    borderBottomWidth: 1, borderStyle: 'dashed', borderColor: '#c9c4b6',
  },
  // Punched in the SHEET's colour, not a grey — the hole has to read as the
  // card ending, which means showing whatever is behind it.
  notch: { width: 14, height: 14, borderRadius: 7, backgroundColor: p.mode === 'light' ? p.bg : '#0a0a10' },
  notchL: { marginLeft: -7 },
  notchR: { marginRight: -7 },

  foot: { paddingHorizontal: 18, paddingTop: 13, paddingBottom: 17 },
  count: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: PAPER_INK, textTransform: 'uppercase' },
  sub: { fontSize: 13.5, color: PAPER_INK_2, marginTop: 3 },
  tracks: { marginTop: 13, borderTopWidth: 1, borderTopColor: PAPER_RULE, paddingTop: 11, gap: 6 },
  trk: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  trkNo: { fontSize: 10, color: '#a09c93', width: 20 },
  trkTitle: { flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: '#3a3833' },
  trkArtist: { flexShrink: 1, fontSize: 12.5, color: '#8a8781' },

  // ── log rows ──────────────────────────────────────────────────────────────
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13 },
  rowRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.ink(0.12) },
  rowPressed: { backgroundColor: p.ink(0.05) },
  rowDial: { width: 52, textAlign: 'right', fontSize: 14, color: p.ink(0.42) },
  rowMid: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15.5, fontWeight: '700', color: p.text },
  rowSub: { fontSize: 12, color: p.ink(0.5), marginTop: 1 },
  rowLen: { fontSize: 14, fontWeight: '700', color: p.ink(0.72) },
});
