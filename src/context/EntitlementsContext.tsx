import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { OWNER_MODE } from '@/constants/config';

const DEV_FREE_KEY = 'cruise_dev_free_preview';

type Entitlements = {
  /** Premium unlocked? Single source of truth for every lock in the app. */
  isPro: boolean;
  /** Dev-only: view the app as a free user (only meaningful with OWNER_MODE). */
  devFreePreview: boolean;
  setDevFreePreview: (on: boolean) => void;
};

const Ctx = createContext<Entitlements | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [devFreePreview, setDevFree] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEV_FREE_KEY).then((v) => setDevFree(v === 'true')).catch(() => {});
  }, []);

  const setDevFreePreview = (on: boolean) => {
    setDevFree(on);
    AsyncStorage.setItem(DEV_FREE_KEY, on ? 'true' : 'false').catch(() => {});
  };

  // RevenueCat slots in here later: isPro = hasActiveSubscription || (OWNER_MODE && !devFreePreview)
  const isPro = OWNER_MODE && !devFreePreview;

  const value = useMemo(() => ({ isPro, devFreePreview, setDevFreePreview }), [isPro, devFreePreview]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): Entitlements {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEntitlements must be used inside EntitlementsProvider');
  return ctx;
}
