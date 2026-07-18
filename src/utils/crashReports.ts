import { Platform } from 'react-native';

import { OWNER_MODE, SENTRY_DSN } from '@/constants/config';

/**
 * Safe Sentry bridge — same contract as purchases.ts: in builds without the
 * native module (or with no DSN configured, or on web) everything quietly
 * no-ops. Crash reporting must never be the thing that crashes.
 */

let started = false;

/** Call once at app start. */
export function initCrashReports(): void {
  if (started || !SENTRY_DSN || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      // Owner devices are dev noise — real users are who we're listening for.
      enabled: !OWNER_MODE,
      tracesSampleRate: 0, // crashes and errors only, no performance tracing
    });
    started = true;
  } catch {
    // build without the native module — run without crash reports
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
