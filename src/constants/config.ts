// ── Dev / owner bypass ────────────────────────────────────────────────────────
// Set to false before publishing to App Store.
// When true: all premium locks are bypassed and a DEV badge appears on each card.
export const OWNER_MODE = false;

// ── Launch-free switch ────────────────────────────────────────────────────────
// While true, every user gets the full app: no locks, no paywall. This is the
// public launch state (payments arrive as a fast-follow update). Flip to false
// only when real store products + platform RevenueCat keys are live.
export const LAUNCH_FREE = true;

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
