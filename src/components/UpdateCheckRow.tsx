import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Cruise } from '@/constants/theme';
import { usePalette, useStyles } from '@/context/AppearanceContext';
import type { Palette } from '@/utils/appearance';

/**
 * "Check for updates" — a button for something that was previously invisible.
 *
 * WHY THIS EXISTS: over-the-air updates arrive silently. The app launches from
 * the copy it already has, downloads any newer one in the BACKGROUND while
 * you're using it, and only runs it on the launch after that. Nothing on
 * screen ever says "downloading", so if you close the app too quickly the
 * download never finishes and it looks like the update simply never came —
 * which is exactly what happened to the owner repeatedly, and the reason this
 * row exists. Now there's one place that says what is going on and finishes
 * the job while you watch.
 *
 * Everything is wrapped defensively: expo-updates is absent on web and
 * disabled in development builds, and neither should throw or show a dead
 * button.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'downloading' }
  | { kind: 'current' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

// Loaded lazily and defensively — see the note above.
function loadUpdates(): typeof import('expo-updates') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates');
  } catch {
    return null;
  }
}

export function UpdateCheckRow() {
  const st = useStyles(makeSt);
  const pal = usePalette();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const Updates = loadUpdates();
  // In Expo Go and dev builds updates are switched off entirely. A row that
  // could only ever fail is worse than no row.
  if (!Updates?.isEnabled) return null;

  const busy = state.kind === 'checking' || state.kind === 'downloading';

  const sub = (() => {
    switch (state.kind) {
      case 'checking':    return 'Looking for a newer version…';
      case 'downloading': return 'Downloading — keep the app open';
      case 'current':     return 'You’re on the latest version';
      case 'ready':       return 'Ready — tap to restart and apply';
      case 'error':       return state.message;
      default:            return 'Fetches the newest design and fixes';
    }
  })();

  const run = async () => {
    if (busy) return;

    // Second tap once downloaded: restart into the new copy. reloadAsync only
    // ever runs an update that is already on the device, so this cannot leave
    // the app half-updated.
    if (state.kind === 'ready') {
      try {
        await Updates.reloadAsync();
      } catch {
        setState({ kind: 'error', message: 'Couldn’t restart — close and reopen the app.' });
      }
      return;
    }

    setState({ kind: 'checking' });
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) { setState({ kind: 'current' }); return; }

      setState({ kind: 'downloading' });
      const fetched = await Updates.fetchUpdateAsync();
      // isNew false means the newest update is the one already running.
      setState(fetched.isNew ? { kind: 'ready' } : { kind: 'current' });
    } catch (e) {
      // Almost always no connection. Say something a driver can act on rather
      // than printing the raw error.
      const offline = /network|fetch|internet|timeout/i.test(String(e));
      setState({
        kind: 'error',
        message: offline ? 'No connection — try again on wifi.' : 'Couldn’t check just now.',
      });
    }
  };

  return (
    <Pressable style={[st.row, st.border]} onPress={run} disabled={busy}>
      <View style={st.left}>
        <View style={st.iconCol}>
          <MaterialCommunityIcons
            name={state.kind === 'ready' ? 'cloud-download-outline' : 'cloud-sync-outline'}
            size={21}
            color={state.kind === 'ready' ? Cruise.violet : pal.ink(0.62)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>Check for updates</Text>
          <Text style={[st.sub, state.kind === 'ready' && { color: Cruise.violet }]}>{sub}</Text>
        </View>
      </View>
      {busy
        ? <ActivityIndicator size="small" color={pal.ink(0.62)} />
        : <Ionicons name="chevron-forward" size={16} color={pal.ink(0.34)} />}
    </Pressable>
  );
}

const makeSt = (p: Palette) => StyleSheet.create({
  // Matches the other Profile settings rows exactly: 22pt inset, 24pt icon
  // column, 16.5pt label — see the note in SpotifyConnectRow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 22,
    gap: 16,
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: p.ink(0.12),
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 0 },
  iconCol: { width: 24, alignItems: 'center' },
  label: { color: p.text, fontSize: 16.5, fontWeight: '500' },
  sub: { color: p.ink(0.55), fontSize: 11.5, marginTop: 3, lineHeight: 16 },
});
