import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDriveStats, type DriveStats } from '@/utils/driveStats';
import { cachedSessionKind, loadSessionKind, words } from '@/utils/sessionKind';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

function formatHours(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = totalMinutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

/**
 * "Your week" — real numbers from the drive log, as numbers.
 *
 * These used to be three glass tiles with rims and icons, which made them a
 * third card style on a page that already had too many. A statistic doesn't
 * need a container: a big number with a small label under it reads faster and
 * disappears when you're not looking for it, which is right for something you
 * check occasionally rather than act on.
 *
 * The heading lives in here rather than on the page, so that a driver with no
 * stats yet gets no empty section either.
 */
export function DriveStatsStrip({ refreshKey }: { refreshKey: number }) {
  const styles = useStyles(make_styles);
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [kind, setKind] = useState(cachedSessionKind());

  useEffect(() => {
    let active = true;
    getDriveStats().then((s) => { if (active) setStats(s); });
    loadSessionKind().then((k) => { if (active && k) setKind(k); });
    return () => { active = false; };
  }, [refreshKey]);

  if (!stats) return null;

  // Nothing to show a driver who hasn't driven yet — three zeros under the
  // heading "Your week" is worse than no section at all. It appears the
  // moment there's a real number in it.
  if (!stats.drivesThisWeek && !stats.listensThisWeek && !stats.totalMinutes && !stats.streakDays) return null;

  // Short labels on purpose: at three-to-a-row on a 393pt screen, "DRIVES THIS
  // WEEK" wraps onto two lines and knocks the numbers out of line with each
  // other. The heading already says which week it is.
  // Drives and desk sessions are counted apart and shown apart, because
  // rolling them together would put back exactly the vagueness this replaced.
  // The FIRST column is whichever kind you are in — the other only appears
  // once there is a real number in it, so somebody who only ever drives never
  // sees a column of zeros for something they don't do.
  const w = words(kind);
  const other = kind === 'driving'
    ? { value: String(stats.listensThisWeek), label: 'SESSIONS', show: stats.listensThisWeek > 0 }
    : { value: String(stats.drivesThisWeek), label: 'DRIVES', show: stats.drivesThisWeek > 0 };
  const mine = kind === 'driving' ? stats.drivesThisWeek : stats.listensThisWeek;

  const items = [
    { value: String(mine),                    label: w.countLabel },
    ...(other.show ? [{ value: other.value,   label: other.label }] : []),
    { value: formatHours(stats.totalMinutes), label: w.timeLabel },
    { value: String(stats.streakDays),        label: 'DAY STREAK' },
  ];

  return (
    <View>
      <Text style={styles.heading}>Your week</Text>
      <View style={styles.row}>
        {items.map((it) => (
          <View key={it.label} style={styles.item}>
            <Text style={styles.value}>{it.value}</Text>
            <Text style={styles.label}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const make_styles = (p: Palette) => StyleSheet.create({
  heading: {
    color: p.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0,
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 22,
  },
  // Each stat takes an equal third rather than sitting on a fixed gap: the
  // labels are long enough that a gap-based row wraps "DRIVES THIS WEEK" onto
  // two lines on a narrow phone and knocks the numbers out of alignment.
  item: { flex: 1, paddingRight: 10 },
  value: {
    color: p.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
  },
  label: {
    color: p.ink(0.5),
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 3,
  },
});
