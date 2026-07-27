import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Is the app actually in front of the user right now?
 *
 * Anything on a repeating timer must ask this. iOS gives a backgrounded app a
 * few seconds of grace and then expects it to go quiet; an app that keeps
 * firing timers — especially ones that touch the network — gets SIGKILLed,
 * which shows up as a `bug_type 309` termination in the phone's Analytics
 * Data and is invisible to crash reporters, because the process is shot
 * rather than given a chance to report anything.
 *
 * That is exactly what was happening: the Spotify poll kept running every
 * five seconds with the app in the background.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
