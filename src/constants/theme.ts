import '@/global.css';

import { Platform } from 'react-native';

export const Cruise = {
  // Core palette
  violet:           '#7B38E0',
  violetLight:      '#9B5FFF',
  violetDim:        '#4A1F8A',
  violetGlow:       'rgba(123, 56, 224, 0.35)',
  // Backgrounds
  charcoal:         '#1a1a2e',   // primary app background
  midnight:         '#12122A',   // slightly deeper, cards
  deepNavy:         '#0D0D20',
  surface:          '#20203A',
  surfaceElevated:  '#2A2A48',
  // Text
  textPrimary:      '#FFFFFF',
  textSecondary:    '#9090B0',
  textMuted:        '#505068',
  // Accent
  amber:            '#F59E0B',
} as const;

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#1a1a2e',
    backgroundElement: '#20203A',
    backgroundSelected: '#2A2A48',
    textSecondary: '#9090B0',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans:   'system-ui',
    serif:  'ui-serif',
    rounded:'ui-rounded',
    mono:   'ui-monospace',
  },
  default: {
    sans:   'normal',
    serif:  'serif',
    rounded:'normal',
    mono:   'monospace',
  },
  web: {
    sans:   'var(--font-display)',
    serif:  'var(--font-serif)',
    rounded:'var(--font-rounded)',
    mono:   'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2, one: 4, two: 8, three: 16,
  four: 24, five: 32, six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Floating tab bar sizing — screens must add this as paddingBottom
export const TAB_BAR_HEIGHT  = 84;
export const TAB_BAR_BOTTOM  = 22;   // gap from screen edge
export const TAB_SAFE_INSET  = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16;
