import { Platform } from 'react-native';

import { PREMIUM_ENTITLEMENT, REVENUECAT_API_KEY } from '@/constants/config';

/**
 * Safe RevenueCat bridge.
 *
 * react-native-purchases is a native module, so it only exists in builds that
 * include it (EAS builds from here on). On web — and in any older build —
 * every call here quietly no-ops and reports "no subscription", leaving the
 * OWNER_MODE bypass and free tier to behave as before. Nothing crashes.
 */

let Purchases: any = null;
let configured = false;

// RevenueCat's sandbox "Test Store" keys (test_…) are only permitted in debug
// builds. In a release build (preview/production), calling configure() with a
// test key makes the SDK pop a "Wrong API Key" dialog and force-close the app
// to protect test purchases — and it does so at the native layer, so a JS
// try/catch can't stop it. Detect that combination and simply skip billing
// until a real platform key (goog_…/appl_…) is in place.
const IS_TEST_KEY = REVENUECAT_API_KEY.startsWith('test_');

function sdk(): any | null {
  if (Platform.OS === 'web') return null;
  if (Purchases) return Purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Purchases = require('react-native-purchases').default;
  } catch {
    Purchases = null; // build without the native module — run degraded
  }
  return Purchases;
}

/** Call once at app start. Safe to call again (no-ops). */
export function initPurchases(): void {
  const P = sdk();
  if (!P || configured) return;
  // A test key in a release build would force-close the app (see note above),
  // so leave billing unconfigured. Free tier + OWNER_MODE bypass still work;
  // there just aren't any live purchases until the real key ships.
  if (IS_TEST_KEY && !__DEV__) return;
  try {
    P.configure({ apiKey: REVENUECAT_API_KEY });
    configured = true;
  } catch {
    // never let billing setup break app launch
  }
}

function entitledFrom(customerInfo: any): boolean {
  const active = customerInfo?.entitlements?.active ?? {};
  // Cruise FM has a single paid tier, so ANY active entitlement means
  // Premium — this shrugs off dashboard naming ("premium" vs "Premium"
  // vs the auto-created "CruiseFM Pro").
  return !!active[PREMIUM_ENTITLEMENT] || Object.keys(active).length > 0;
}

/** Does this user currently have an active Premium subscription? */
export async function hasPremium(): Promise<boolean> {
  const P = sdk();
  if (!P || !configured) return false;
  try {
    return entitledFrom(await P.getCustomerInfo());
  } catch {
    return false;
  }
}

/** Live updates (renewals, expirations, purchases on other devices). */
export function onPremiumChange(cb: (isPro: boolean) => void): () => void {
  const P = sdk();
  if (!P || !configured) return () => {};
  const listener = (info: any) => cb(entitledFrom(info));
  try {
    P.addCustomerInfoUpdateListener(listener);
    return () => { try { P.removeCustomerInfoUpdateListener(listener); } catch {} };
  } catch {
    return () => {};
  }
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable' | 'error';

/**
 * Run the store purchase flow for the default offering's first package.
 * Resolves 'purchased' only once the premium entitlement is actually active.
 */
export async function purchasePremium(): Promise<PurchaseOutcome> {
  const P = sdk();
  if (!P || !configured) return 'unavailable';
  try {
    const offerings = await P.getOfferings();
    const pkg =
      offerings?.current?.monthly ??
      offerings?.current?.availablePackages?.[0];
    if (!pkg) return 'unavailable';
    const { customerInfo } = await P.purchasePackage(pkg);
    return entitledFrom(customerInfo) ? 'purchased' : 'error';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'error';
  }
}

/** Re-attach a subscription bought earlier / on another phone. */
export async function restorePremium(): Promise<boolean> {
  const P = sdk();
  if (!P || !configured) return false;
  try {
    return entitledFrom(await P.restorePurchases());
  } catch {
    return false;
  }
}
