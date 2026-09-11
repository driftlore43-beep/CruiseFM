import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  getAppearance, paletteFor, setAppearanceStored,
  type Appearance, type Mode, type Palette,
} from '@/utils/appearance';

type Ctx = {
  /** What the user chose: light, dark, or follow the phone. */
  preference: Appearance;
  /** What that resolves to right now — the only thing components should read. */
  mode: Mode;
  palette: Palette;
  setPreference: (value: Appearance) => void;
};

const AppearanceCtx = createContext<Ctx>({
  preference: 'system',
  mode: 'dark',
  palette: paletteFor('dark'),
  setPreference: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<Appearance>('system');
  const phone = useColorScheme();

  useEffect(() => { getAppearance().then(setPref); }, []);

  // DARK IS THE FALLBACK, NOT LIGHT. useColorScheme returns null before the
  // phone answers and on any platform that does not report one; landing on
  // light there would flash the app white on every cold start for someone who
  // has never asked for it.
  const mode: Mode = preference === 'system' ? (phone === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<Ctx>(() => ({
    preference,
    mode,
    palette: paletteFor(mode),
    setPreference: (v) => { setPref(v); void setAppearanceStored(v); },
  }), [preference, mode]);

  return <AppearanceCtx.Provider value={value}>{children}</AppearanceCtx.Provider>;
}

export const useAppearance = () => useContext(AppearanceCtx);

/** The palette on its own — what almost every component actually wants. */
export const usePalette = () => useContext(AppearanceCtx).palette;

/**
 * A stylesheet that knows about the theme.
 *
 * `StyleSheet.create` runs once, at import, so a sheet written at module level
 * can never change colour. The fix is to make the sheet a FUNCTION of the
 * palette and build it inside the component — which is why every converted file
 * reads `const styles = useStyles(makeStyles)` rather than referencing a
 * module-level `styles`.
 *
 * Cached per factory per mode, so the sheet is built twice for the life of the
 * app rather than on every render. The cache is keyed on the factory function
 * itself, which is stable because it is declared at module level; passing an
 * inline arrow would defeat it, so don't.
 */
const sheetCache = new WeakMap<object, Partial<Record<Mode, unknown>>>();

export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: (p: Palette) => T): T {
  const { palette, mode } = useAppearance();
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  return useMemo(() => {
    let byMode = sheetCache.get(factory);
    if (!byMode) { byMode = {}; sheetCache.set(factory, byMode); }
    if (!byMode[mode]) byMode[mode] = StyleSheet.create(factory(palette));
    return byMode[mode] as T;
  }, [factory, mode, palette]);
}
