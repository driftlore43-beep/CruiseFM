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

// ── What is actually on sale ─────────────────────────────────────────────────

export type PlanKind = 'monthly' | 'annual' | 'lifetime' | 'other';

export type Plan = {
  /** Package identifier — hand this straight back to purchasePremium(). */
  id: string;
  kind: PlanKind;
  /**
   * The price the store will really charge, already formatted in the
   * listener's own currency.
   *
   * NOTHING MAY EVER WRITE A PRICE INTO THIS APP. The App Store prices per
   * country, so a typed "£1.99" is wrong for most of the world — and a
   * screen showing a different number from the one the user is billed is
   * both dishonest and a rejection. If this string is missing, the plan is
   * unusable and is dropped rather than guessed at.
   */
  priceString: string;
  price: number;
  currency: string;
  /** What the price buys. Null for a one-off, which renews nothing. */
  per: 'month' | 'year' | null;
  /** The same price expressed monthly, so an annual plan can be compared. */
  perMonth: number | null;
  perMonthString: string | null;
  /**
   * Length of the FREE trial in days, or null when this product has none.
   *
   * Only a ZERO-priced introductory offer counts. A cheap first month is an
   * intro price, not a trial, and calling it "free" would be a claim the
   * store would then contradict at the till.
   */
  trialDays: number | null;
};

const PERIOD_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

function trialDaysOf(product: any): number | null {
  const intro = product?.introPrice;
  if (!intro) return null;
  if (typeof intro.price !== 'number' || intro.price > 0) return null; // a discount, not a trial
  const unit = PERIOD_DAYS[String(intro.periodUnit ?? '').toUpperCase()];
  const units = Number(intro.periodNumberOfUnits);
  if (!unit || !Number.isFinite(units) || units <= 0) return null;
  const cycles = Number(intro.cycles);
  return Math.round(unit * units * (Number.isFinite(cycles) && cycles > 0 ? cycles : 1));
}

function kindOf(pkg: any): PlanKind {
  switch (String(pkg?.packageType ?? '')) {
    case 'MONTHLY':  return 'monthly';
    case 'ANNUAL':   return 'annual';
    case 'LIFETIME': return 'lifetime';
    default:         return 'other';
  }
}

function toPlan(pkg: any): Plan | null {
  const product = pkg?.product;
  const priceString = product?.priceString;
  // No formatted price means no honest way to show this plan. Drop it.
  if (!pkg?.identifier || typeof priceString !== 'string' || !priceString) return null;
  const kind = kindOf(pkg);
  return {
    id: String(pkg.identifier),
    kind,
    priceString,
    price: Number(product.price) || 0,
    currency: String(product.currencyCode ?? ''),
    per: kind === 'annual' ? 'year' : kind === 'monthly' ? 'month' : null,
    perMonth: typeof product.pricePerMonth === 'number' ? product.pricePerMonth : null,
    perMonthString: typeof product.pricePerMonthString === 'string' ? product.pricePerMonthString : null,
    trialDays: trialDaysOf(product),
  };
}

/**
 * The plans currently on sale, in the order they should be offered.
 *
 * NULL means we could not ask at all — web, a build without the native
 * module, billing unconfigured, or the store refused. An EMPTY ARRAY means we
 * asked and nothing is on sale. The two must stay apart: the paywall offers a
 * retry for the first and says "not available" for the second, and neither
 * may ever fall back to printing a made-up price.
 */
export async function getPlans(): Promise<Plan[] | null> {
  const P = sdk();
  if (!P || !configured) return null;
  try {
    const offerings = await P.getOfferings();
    const packages: any[] = offerings?.current?.availablePackages ?? [];
    const plans = packages
      .map(toPlan)
      .filter((p): p is Plan => p !== null);
    // Entry price first: leading with the annual plan buries the number most
    // people are deciding against.
    const rank: Record<PlanKind, number> = { monthly: 0, annual: 1, lifetime: 2, other: 3 };
    plans.sort((a, b) => rank[a.kind] - rank[b.kind]);
    return plans;
  } catch {
    return null;
  }
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable' | 'error';

/**
 * Run the store purchase flow for a plan from getPlans().
 * Resolves 'purchased' only once the premium entitlement is actually active.
 */
export async function purchasePremium(planId?: string): Promise<PurchaseOutcome> {
  const P = sdk();
  if (!P || !configured) return 'unavailable';
  try {
    const offerings = await P.getOfferings();
    const available: any[] = offerings?.current?.availablePackages ?? [];

    // STRICT when a plan was named. If the chosen package has gone between
    // the screen loading and the thumb landing, stop — silently falling back
    // to a different one would charge for a plan nobody picked, which is the
    // worst failure available on this screen.
    const pkg = planId
      ? available.find((p) => p?.identifier === planId) ?? null
      : offerings?.current?.monthly ?? available[0] ?? null;
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
