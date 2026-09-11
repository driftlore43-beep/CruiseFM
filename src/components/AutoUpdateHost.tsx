import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useNowPlaying } from '@/context/NowPlayingContext';

/**
 * The app updates itself while you aren't looking.
 *
 * WHY (owner, 14.08: "if there was a way to automatically update the app when
 * it's closed for them — instead of pressing 'look for new updates' — that
 * would be good, so they aren't stuck without the update").
 *
 * WHAT WAS ALREADY HAPPENING, and why it left people behind: expo-updates
 * defaults to checking ON LAUNCH, downloading in the BACKGROUND, and running
 * the new copy on the launch AFTER that. Two things fall out of it. A short
 * visit — open, glance, close — never gives the download time to finish, so
 * nothing is ever gained. And even a completed download sits unused until the
 * next launch, so someone can be a full session behind without any sign of it.
 * The "Check for updates" button exists precisely because that was invisible,
 * and a button is the wrong answer to "the app should already be up to date".
 *
 * WHAT THIS ADDS: coming back to the app after being away is the natural
 * moment to be on the newest version — the phone has been idle, there is
 * nothing to interrupt, and from the outside it simply looks as though the app
 * updated while it was shut. So on returning from the background after a
 * while, it checks, downloads, and restarts itself into the new copy.
 *
 * THE RESTART IS THE WHOLE RISK, AND EVERY RULE HERE EXISTS TO CONTAIN IT.
 * `reloadAsync` throws the running app away, so it must never land in the
 * middle of something:
 *
 *   - NEVER DURING A DRIVE. A session ending because the app decided to
 *     update itself would be the worst bug in the app. `session` covers a
 *     minimised drive as well as an open mode.
 *   - NEVER WITH A SHEET OPEN. Same reasoning as AutoDim (03.08): the sheet is
 *     something the user deliberately opened and is looking at.
 *   - NEVER ON A COLD START. expo-updates already checks at launch, and
 *     restarting seconds into boot would read as a crash — or loop.
 *   - ONLY AFTER A REAL ABSENCE. Flicking to another app for five seconds and
 *     coming back must not restart anything.
 *
 * If an update is ready but the moment isn't safe, nothing is lost: it stays
 * downloaded, and the standing expo-updates behaviour runs it at the next
 * launch anyway. Waiting is always allowed; interrupting never is.
 *
 * NO TIMER, DELIBERATELY. This hangs off AppState alone — a repeating timer is
 * what got the app SIGKILLed on 27.07, and there is nothing here worth polling
 * for. It also does no work at all in the background, only on the way back.
 *
 * Renders nothing. Pure JS against a native module that has shipped in every
 * build since 15, so it travels over the air like anything else.
 */

/** How long away counts as "they left", rather than glancing at a message. */
export const AWAY_MS = 3 * 60 * 1000;
/** Don't check again within this of the last one, however often they switch. */
export const COOLDOWN_MS = 30 * 60 * 1000;
/** A cold start is already handled by expo-updates' own launch check. */
export const COLD_START_GRACE_MS = 60 * 1000;

/**
 * Whether returning to the app right now is a moment to update in.
 *
 * A PURE FUNCTION ON PURPOSE. Everything this decides ends in throwing the
 * running app away, so the rules are the part worth being able to read and
 * test on their own rather than inferring them from an effect
 * (scripts/test-auto-update.mjs exercises the shipped copy).
 */
export function shouldUpdateNow(now: {
  /** ms the app spent in the background. */
  awayMs: number;
  /** ms since this copy of the app started. */
  sinceBootMs: number;
  /** ms since the last check, or Infinity if there hasn't been one. */
  sinceLastCheckMs: number;
  /** A drive is running, or a sheet is open. */
  busy: boolean;
}): boolean {
  if (now.busy) return false;
  if (now.awayMs < AWAY_MS) return false;
  if (now.sinceBootMs < COLD_START_GRACE_MS) return false;
  if (now.sinceLastCheckMs < COOLDOWN_MS) return false;
  return true;
}

// Loaded defensively: absent on web, and switched off in dev builds.
function loadUpdates(): typeof import('expo-updates') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates');
  } catch {
    return null;
  }
}

export function AutoUpdateHost() {
  const np = useNowPlaying();

  // The listener is attached once, so everything it reads has to come through
  // a ref — a captured `session` would be forever null (the same stale-closure
  // trap as the modes' dismiss responders).
  const busyRef = useRef(false);
  busyRef.current = np.session != null || np.sheetCount > 0;

  const bootedAt = useRef(Date.now());
  const leftAt = useRef<number | null>(null);
  const lastCheck = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    const Updates = loadUpdates();
    if (!Updates?.isEnabled) return;

    let alive = true;

    const maybeUpdate = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!alive || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!alive) return;
        // Re-read the guard AFTER the download: it can take a while on a
        // moving car's signal, and a drive may have started in the meantime.
        if (busyRef.current) return;
        await Updates.reloadAsync();
      } catch {
        // Offline, a slow network, a half-finished download — all of them
        // simply mean "not this time". The launch check will get it later.
      } finally {
        runningRef.current = false;
      }
    };

    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        const now = Date.now();
        const away = leftAt.current == null ? 0 : now - leftAt.current;
        leftAt.current = null;
        const ok = shouldUpdateNow({
          awayMs: away,
          sinceBootMs: now - bootedAt.current,
          // No check yet means nothing to wait out.
          sinceLastCheckMs: lastCheck.current === 0 ? Infinity : now - lastCheck.current,
          busy: busyRef.current,
        });
        if (!ok) return;
        lastCheck.current = now;
        void maybeUpdate();
      } else if (next === 'background' || next === 'inactive') {
        // 'inactive' is also the iOS app switcher and a notification banner,
        // so this may be set without a real departure — harmless, because the
        // AWAY_MS test on the way back is what actually decides.
        if (leftAt.current == null) leftAt.current = Date.now();
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => { alive = false; sub.remove(); };
  }, []);

  return null;
}
