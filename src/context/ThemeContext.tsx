import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type FontStyle = 'cinematic' | 'modern' | 'retro';
export type CardStyle = 'minimal' | 'gradient' | 'glassmorphism';

export interface CruiseTheme {
  accentColor: string;
  background: [string, string];
  glowIntensity: number;
  fontStyle: FontStyle;
  cardStyle: CardStyle;
}

export const DEFAULT_THEME: CruiseTheme = {
  accentColor: '#7B38E0',
  background: ['#0A0F2B', '#1a1a3a'],
  glowIntensity: 0.66,
  fontStyle: 'cinematic',
  cardStyle: 'gradient',
};

const STORAGE_KEY = '@cruise_theme_v1';

interface ThemeContextValue {
  theme: CruiseTheme;
  setTheme: (t: CruiseTheme) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: async () => {},
  resetTheme: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CruiseTheme>(DEFAULT_THEME);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setThemeState({ ...DEFAULT_THEME, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  const setTheme = async (t: CruiseTheme) => {
    setThemeState(t);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  };

  const resetTheme = async () => {
    setThemeState(DEFAULT_THEME);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Font family lookup used across the app
export function fontFamilyFor(style: FontStyle): string {
  switch (style) {
    case 'cinematic': return 'serif';
    case 'modern':    return 'normal';
    case 'retro':     return 'Courier New';
  }
}
