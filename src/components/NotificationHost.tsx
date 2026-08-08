import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useNowPlaying } from '@/context/NowPlayingContext';
import { loadLastCruise } from '@/utils/lastCruise';
import {
  noteAppOpened, noteOpenedFromNotification, notificationsAvailable,
  reschedule, scheduleRecapIfDue,
} from '@/utils/notifications';

/**
 * The one place notifications are wired into the running app.
 *
 * Two jobs:
 *   1. A TAP OPENS A DRIVE, not the home screen. Every notification carries
 *      its station, and the mode comes from the last cruise, so one tap goes
 *      from lock screen to driving.
 *   2. Re-planning. The schedule is laid out fresh on launch, on foreground
 *      and whenever a drive ends — which is also when the app reconciles what
 *      was ignored while it was closed, and shrinks its own allowance
 *      accordingly (see utils/notifications).
 *
 * Renders nothing. Everything degrades to no-ops when the native module is
 * absent (web, and any build before 1.2.0).
 */
export function NotificationHost() {
  const np = useNowPlaying();
  const openRef = useRef(np.open);
  openRef.current = np.open;
  const sessionRef = useRef(!!np.session);
  const wasDriving = sessionRef.current;
  sessionRef.current = !!np.session;

  // A drive just ended: re-plan, since "not on a day they drove" and the
  // six-hour quiet period have both just changed.
  useEffect(() => {
    if (wasDriving && !np.session) {
      void reschedule();
      void scheduleRecapIfDue();
    }
  }, [np.session, wasDriving]);

  useEffect(() => {
    if (Platform.OS === 'web' || !notificationsAvailable()) return;
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const N = require('expo-notifications') as typeof import('expo-notifications');

    const openFrom = async (resp: { notification: { request: { content: { data?: unknown } } } }) => {
      const data = (resp?.notification?.request?.content?.data ?? {}) as { id?: string; stationId?: string };
      if (!data.stationId) return;
      if (data.id) await noteOpenedFromNotification(data.id).catch(() => {});
      const last = await loadLastCruise().catch(() => null);
      openRef.current(last?.mode ?? 'equalizer', data.stationId);
    };

    // Tapped while the app was closed.
    N.getLastNotificationResponseAsync()
      .then((resp) => { if (alive && resp) void openFrom(resp); })
      .catch(() => {});
    const sub = N.addNotificationResponseReceivedListener((resp) => { void openFrom(resp); });

    void noteAppOpened();
    void reschedule();
    void scheduleRecapIfDue();

    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      void noteAppOpened();
      void reschedule();
    });

    return () => { alive = false; sub.remove(); app.remove(); };
  }, []);

  return null;
}
