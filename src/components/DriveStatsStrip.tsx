import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlossSheen } from '@/components/GlossSheen';
import { Cruise } from '@/constants/theme';
import { getDriveStats, type DriveStats } from '@/utils/driveStats';

function formatHours(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = totalMinutes / 60;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

/** Three glass chips under the hero — real numbers from the drive log. */
export function DriveStatsStrip({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<DriveStats | null>(null);

  useEffect(() => {
    let active = true;
    getDriveStats().then((s) => { if (active) setStats(s); });
    return () => { active = false; };
  }, [refreshKey]);

  if (!stats) return null;

  const chips: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: string; label: string }[] = [
    { icon: 'steering',      value: String(stats.drivesThisWeek),    label: 'DRIVES THIS WEEK' },
    { icon: 'clock-outline', value: formatHours(stats.totalMinutes), label: 'TIME CRUISED' },
    { icon: 'fire',          value: String(stats.streakDays),        label: 'DAY STREAK' },
  ];

  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <View key={chip.label} style={styles.chip}>
          <GlossSheen radius={16} />
          <MaterialCommunityIcons name={chip.icon} size={18} color="#fff" />
          <Text style={styles.value}>{chip.value}</Text>
          <Text style={styles.label}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 28,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  label: {
    color: Cruise.textSecondary,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
