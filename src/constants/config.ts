// ── Dev / owner bypass ────────────────────────────────────────────────────────
// Set to false before publishing to App Store.
// When true: all premium locks are bypassed and a DEV badge appears on each card.
export const OWNER_MODE = true;

// ── RevenueCat ────────────────────────────────────────────────────────────────
// Public (publishable) SDK key — safe to ship in the app.
// Currently the sandbox Test Store key: purchases are pretend, no real money.
// Swap for the platform keys (goog_… / appl_…) once the Play/App Store apps
// exist in the RevenueCat dashboard.
export const REVENUECAT_API_KEY = 'test_CcsXiJATGDBoQSYvQkxlayrjYct';
// The entitlement that means "this user has Premium" (set up in the dashboard).
export const PREMIUM_ENTITLEMENT = 'premium';
