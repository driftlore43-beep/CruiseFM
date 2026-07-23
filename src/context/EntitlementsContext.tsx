import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { LAUNCH_FREE, OWNER_MODE } from '@/constants/config';
import { hasPremium, initPurchases, onPremiumChange } from '@/utils/purchases';

const DEV_FREE_KEY = 'cruise_dev_free_preview';

type Entitlements = {
  /** Premium unlocked? Single source of truth for every lock in the app. */
  isPro: boolean;
  /** True when isPro comes from a real store subscription (not OWNER_MODE). */
  hasSubscription: boolean;
  /** Re-check RevenueCat now — call after a purchase or restore. */
  refreshSubscription: () => Promise<void>;
  /** Dev-only: view the app as a free user (only meaningful with OWNER_MODE). */
  devFreePreview: boolean;
  setDevFreePreview: (on: boolean) => void;
};

const Ctx = createContext<Entitlements | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [devFreePreview, setDevFree] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEV_FREE_KEY).then((v) => setDevFree(v === 'true')).catch(() => {});
  }, []);

  // RevenueCat: check once at launch, then follow renewals/expiries live.
  useEffect(() => {
    initPurchases();
    hasPremium().then(setHasSubscription).catch(() => {});
    return onPremiumChange(setHasSubscription);
  }, []);

  const refreshSubscription = async () => {
    setHasSubscription(await hasPremium());
  };

  const setDevFreePreview = (on: boolean) => {
    setDevFree(on);
    AsyncStorage.setItem(DEV_FREE_KEY, on ? 'true' : 'false').catch(() => {});
  };

  // Launch-free period: everyone is premium, unconditionally — a stale
  // free-preview flag from an old dev session must never re-lock a device
  // while the toggle itself is hidden. With OWNER_MODE on, the dev toggle
  // still lets us preview the lock UI before the paid update.
  const isPro = hasSubscription || (OWNER_MODE ? !devFreePreview : LAUNCH_FREE);

  const value = useMemo(
    () => ({ isPro, hasSubscription, refreshSubscription, devFreePreview, setDevFreePreview }),
    [isPro, hasSubscription, devFreePreview],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): Entitlements {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntitlements must be used inside EntitlementsProvider');
  return ctx;
}
