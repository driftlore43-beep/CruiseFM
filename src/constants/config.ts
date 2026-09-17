// ── Dev / owner bypass ────────────────────────────────────────────────────────
// Set to false before publishing to App Store.
// When true: all premium locks are bypassed and a DEV badge appears on each card.
export const OWNER_MODE = false;

// ── Launch-free switch ────────────────────────────────────────────────────────
// While true, every user gets the full app: no locks, no paywall. That was the
// public launch state from 23.07 to 17.09. It is FALSE now because the real
// store products exist and the App Store RevenueCat key below is live — the
// two must always move together: a paywall with a sandbox key behind it shows
// a price nothing can charge, and a live key behind a free app sells nothing.
export const LAUNCH_FREE = false;

// ── RevenueCat ────────────────────────────────────────────────────────────────
// Public (publishable) SDK key — safe to ship in the app. This is the App
// Store key (appl_…) for com.driftlore.CruiseFM in the RevenueCat dashboard;
// the sandbox Test Store key it replaced was test_CcsXiJATGDBoQSYvQkxlayrjYct.
// A Play Store key (goog_…) is a separate value for whenever Android ships.
export const REVENUECAT_API_KEY = 'appl_ALldTOlADMuLTmvzDynJjjWOhnE';
// The entitlement that means "this user has Premium". It is the one the
// dashboard actually holds — auto-created there in July as "Cruise FM Pro" —
// and both App Store products are attached to it. purchases.ts accepts ANY
// active entitlement anyway, so a dashboard rename cannot lock a payer out;
// this just keeps the two sides agreeing on paper.
export const PREMIUM_ENTITLEMENT = 'cruise_fm_pro';

// ── Sentry crash reports ──────────────────────────────────────────────────────
// DSN from sentry.io (org cruise-fm, project react-native). Safe to ship in
// the app. Set to '' to switch crash reporting off everywhere.
export const SENTRY_DSN = 'https://c624e74abfd79764bba03001ea1513be@o4511754925047808.ingest.us.sentry.io/4511754937499648';
