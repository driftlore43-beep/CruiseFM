import { Platform } from 'react-native';

import { OWNER_MODE, SENTRY_DSN } from '@/constants/config';

/**
 * Safe Sentry bridge — same contract as purchases.ts: in builds without the
 * native module (or with no DSN configured, or on web) everything quietly
 * no-ops. Crash reporting must never be the thing that crashes.
 */

let started = false;
// One-shot gate: lets a deliberate test event out of an owner device.
let allowOwnerEvent = false;

/** Call once at app start. */
export function initCrashReports(): void {
  if (started || !SENTRY_DSN || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0, // crashes and errors only, no performance tracing
      // Owner devices are dev noise — drop everything except deliberate
      // test crashes. Real users are who we're listening for.
      beforeSend: (event: unknown) => {
        if (OWNER_MODE && !allowOwnerEvent) return null;
        allowOwnerEvent = false;
        return event;
      },
    });
    started = true;
  } catch {
    // build without the native module — run without crash reports
  }
}

/**
 * Prove the pipeline: send one deliberate test error to Sentry, bypassing the
 * owner-device silence for exactly this event. Resolves true once it's been
 * handed off successfully.
 */
export async function sendTestCrash(): Promise<boolean> {
  if (!started) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    allowOwnerEvent = true;
    Sentry.captureException(new Error('Cruise FM test crash — the smoke alarm works.'));
    const flushed = await Sentry.flush(5000);
    return flushed !== false;
  } catch {
    return false;
  } finally {
    allowOwnerEvent = false;
  }
}

/** Report a handled-but-noteworthy error (never throws). */
export function reportError(error: unknown, context?: string): void {
  if (!started) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.captureException(error, context ? { extra: { context } } : undefined);
  } catch {
    // never let telemetry break the app
  }
}
