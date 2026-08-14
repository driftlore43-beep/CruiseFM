import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Is the app in front of the user right now?
 *
 * WHY THE GATE EXISTS AT ALL: iOS gives a backgrounded app a few seconds of
 * grace and then expects it to go quiet. An app that keeps firing timers —
 * especially ones that touch the network — gets SIGKILLed, which shows up as a
 * `bug_type 309` termination in the phone's Analytics Data and is invisible to
 * crash reporters, because the process is shot rather than given a chance to
 * report anything. That is exactly what was happening on 27.07: the Spotify
 * poll kept running every five seconds with the app in the background.
 *
 * WHY IT IS `!== 'background'` AND NOT `=== 'active'` (owner, 14.08: "when I
 * swipe down the home page to look for notifications, the animation likes to
 * pause"). iOS has THREE states here, not two, and the middle one was being
 * read as "gone":
 *
 *   active     on screen, receiving touches
 *   inactive   ON SCREEN, not receiving touches — Notification Centre pulled
 *              down, Control Centre, the app switcher, an incoming call
 *              banner, a Face ID sheet
 *   background actually gone
 *
 * `inactive` means the app is STILL VISIBLE. Everything gated on the old rule
 * — the vinyl deck's rotation, the floating notes, both now-playing polls —
 * stopped dead the moment a notification shade came down over it, and the
 * frozen scene was in plain view the whole time. Pulling the shade back up
 * restarted it, so it read as the app stuttering rather than as a rule firing.
 *
 * The SIGKILL risk this gate exists for is a BACKGROUND risk specifically:
 * iOS does not terminate an app for doing work while its own Notification
 * Centre is open. So excluding only `background` keeps every bit of the
 * protection and stops punishing the app for being looked over.
 */
export function isInFront(state: AppStateStatus | null | undefined): boolean {
  // Anything unrecognised counts as in front: the failure mode of guessing
  // "gone" is a frozen screen the user is looking at, which is exactly the
  // bug above. The failure mode of guessing "here" is one more poll.
  return state !== 'background';
}

export function useAppActive(): boolean {
  const [active, setActive] = useState(() => isInFront(AppState.currentState));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => setActive(isInFront(s)));
    return () => sub.remove();
  }, []);
  return active;
}
