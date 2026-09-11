import { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { DriveRow, DriveStub } from '@/components/DriveStub';
import { SettingsPageShell } from '@/components/SettingsPageShell';
import { useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';
import { getDriveStats, getFinishedDrives, type DriveEvent, type DriveStats } from '@/utils/driveStats';
import { words } from '@/utils/sessionKind';

/**
 * The full log, on a page of its own.
 *
 * WHY IT MOVED (owner, 14.08: "the driver log is really long can it be
 * collapsed into a page"). It was printed inline on Profile — this week, then
 * up to twenty more — so after a few days of use the settings below it were a
 * long scroll away, and the page stopped being a profile at all. Everything
 * else on Profile that has real depth already behaves this way: Account,
 * Privacy, Notifications and About are all pages behind a row. This is the
 * same, and Profile keeps only the seven-day strip, which is the part worth
 * seeing at a glance.
 *
 * NO CAP HERE. The inline version cut the older group at twenty, which was the
 * right call when it had to share a page and the wrong one now — a page whose
 * whole job is the log should show all of it. They are small objects and the
 * list is already only what is kept.
 */
export function DrivesPage({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles(makeStyles);
  const [drives, setDrives] = useState<DriveEvent[]>([]);
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [open, setOpen] = useState<DriveEvent | null>(null);

  // Refreshes whenever Profile regains focus, which is also when this page can
  // be opened — so a drive finished a moment ago is already in the list.
  useFocusEffect(useCallback(() => {
    let alive = true;
    getFinishedDrives().then((d) => { if (alive) setDrives(d); }).catch(() => {});
    getDriveStats().then((st) => { if (alive) setStats(st); }).catch(() => {});
    return () => { alive = false; };
  }, []));

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = drives.filter((d) => d.ts >= weekAgo);
  const earlier = drives.filter((d) => d.ts < weekAgo);

  const ordinalOf = (d: DriveEvent) => {
    // Its position counting from the oldest, within its own kind — which is
    // what "your 12th" means, and it must not change when a later one lands.
    const kind = d.kind ?? 'driving';
    const sameKind = drives.filter((e) => (e.kind ?? 'driving') === kind);
    return sameKind.length - sameKind.indexOf(d);
  };
  const weekOf = (d: DriveEvent) => {
    const kind = d.kind ?? 'driving';
    return (kind === 'listening' ? stats?.listensThisWeek : stats?.drivesThisWeek) ?? 1;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SettingsPageShell title={logTitle(drives)} onBack={onClose}>
        {drives.length === 0 && (
          <Text style={s.empty}>Nothing kept yet. Listen for a couple of minutes and a ticket appears here.</Text>
        )}

        {thisWeek.length > 0 && <Text style={s.group}>THIS WEEK</Text>}
        {thisWeek.length > 0 && (
          <View style={s.card}>
            {thisWeek.map((d, i) => (
              <DriveRow key={d.ts} drive={d} onPress={() => setOpen(d)} last={i === thisWeek.length - 1} />
            ))}
          </View>
        )}

        {earlier.length > 0 && <Text style={s.group}>EARLIER</Text>}
        {earlier.length > 0 && (
          <View style={s.card}>
            {earlier.map((d, i) => (
              <DriveRow key={d.ts} drive={d} onPress={() => setOpen(d)} last={i === earlier.length - 1} />
            ))}
          </View>
        )}
      </SettingsPageShell>

      {/* A third stacked window is one too many on iOS, but this is the second:
          the stub opens over the page, and the page is over Profile, which is a
          plain route rather than a modal. */}
      {!!open && (
        <DriveStub
          drive={open}
          visible
          onClose={() => setOpen(null)}
          ordinal={ordinalOf(open)}
          thisWeek={weekOf(open)}
        />
      )}
    </Modal>
  );
}

/**
 * "Your drives", "Your sessions", or "Your drives & sessions" when the log
 * genuinely holds both — the page cannot call a session at a desk a drive, and
 * it must not pick whichever kind happens to be first in the list either.
 */
export function logTitle(drives: DriveEvent[]): string {
  const anyDriving = drives.some((d) => (d.kind ?? 'driving') === 'driving');
  const anyListening = drives.some((d) => d.kind === 'listening');
  if (anyDriving && anyListening) return 'Your drives & sessions';
  if (anyListening) return `Your ${words('listening').plural}`;
  return `Your ${words('driving').plural}`;
}

const makeStyles = (p: Palette) => StyleSheet.create({
  group: {
    fontSize: 9.5, fontWeight: '800', letterSpacing: 2,
    color: p.ink(0.4), marginTop: 18, marginBottom: 8, marginLeft: 4,
  },
  // The settings pages' own card, so the log looks like it belongs to the
  // family of pages it now sits in rather than to the Profile page it left.
  card: {
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: p.mode === 'light' ? p.panel : p.ink(0.04),
    borderWidth: StyleSheet.hairlineWidth, borderColor: p.ink(0.14),
  },
  empty: {
    color: p.ink(0.5), fontSize: 14, lineHeight: 21, marginTop: 20,
  },
});
