// ── Dev / owner bypass ────────────────────────────────────────────────────────
// When true: all premium locks are bypassed and a DEV badge appears on each card.
//
// This is deliberately NOT a hand-flipped switch. Shipping a store build with
// it on would hand Premium to every user for free and quietly kill the
// subscription — and it would look like "nobody wanted to pay" rather than
// "the flag was left on". So it's a property of the build itself:
//
//   local dev (`expo start`)        → ON  (via __DEV__)
//   EAS development / preview       → ON  (EXPO_PUBLIC_OWNER_MODE=1 in eas.json)
//   EAS production                  → OFF (eas.json sets it to 0; nothing to forget)
//
// To rehearse the real paywall on a preview build, flip that env var to "0"
// in eas.json's preview profile and rebuild.
export const OWNER_MODE = __DEV__ || process.env.EXPO_PUBLIC_OWNER_MODE === '1';

// ── RevenueCat ────────────────────────────────────────────────────────────────
// Public (publishable) SDK key — safe to ship in the app.
// Currently the sandbox Test Store key: purchases are pretend, no real money.
// Swap for the platform keys (goog_… / appl_…) once the Play/App Store apps
// exist in the RevenueCat dashboard.
export const REVENUECAT_API_KEY = 'test_CcsXiJATGDBoQSYvQkxlayrjYct';
// The entitlement that means "this user has Premium" (set up in the dashboard).
export const PREMIUM_ENTITLEMENT = 'premium';

// ── Sentry crash reports ──────────────────────────────────────────────────────
// DSN from sentry.io (org cruise-fm, project react-native). Safe to ship in
// the app. Set to '' to switch crash reporting off everywhere.
export const SENTRY_DSN = 'https://c624e74abfd79764bba03001ea1513be@o4511754925047808.ingest.us.sentry.io/4511754937499648';
