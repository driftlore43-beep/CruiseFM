import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

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
/**
 * The app's single side gutter. Page titles, list rows and the floating tab
 * bar all sit on it, so the bar's edges line up with the text column above
 * instead of hanging a few points outside it — which read as the panel not
 * being centred on the page (owner, 31.07). It was 22 on Cruise and Modes,
 * 20 on Stations and 16 on the tab bar.
 */
export const PAGE_GUTTER     = 20;

/**
 * WHERE A BIG PHONE STOPS AND A TABLET BEGINS.
 *
 * Every page in this app was laid out as one column against a side gutter,
 * which is right on a phone and falls apart on an iPad: at 1032 points wide
 * the hero becomes a 4:1 letterbox with its type huddled in one corner, the
 * greeting wraps against the left edge for no reason, and a two-button row
 * gives each button half a screen. Nothing is broken — it is simply a phone
 * stretched, which is what an iPad screenshot would have shown Apple.
 *
 * The fix is a reading column rather than a rebuild: above `WIDE_MIN` the
 * page's content is capped at `PAGE_MAX_W` and centred, so every card keeps
 * the proportions it was designed at and the extra width becomes margin.
 *
 * BOTH NUMBERS ARE CHOSEN SO A PHONE CAN NEVER REACH THEM. The widest phone
 * this app runs on is 430 points, so on any phone the cap never binds and the
 * layout is byte-identical to what shipped — which is the whole safety of
 * doing it this way rather than by rewriting the page.
 */
export const WIDE_MIN        = 700;
export const PAGE_MAX_W      = 720;

/** True when the window is a tablet's rather than a phone's. */
export const isWide = (winW: number) => winW >= WIDE_MIN;

/**
 * THE CEILING ON A MODE'S CENTRAL OBJECT — and why an iPad needed it lifted.
 *
 * Every fullscreen mode sizes its hero (the record, the disc, the ball, the
 * jewel case, the orb, the head unit) as `Math.min(<a share of the window>,
 * <an absolute pixel ceiling>)`. Those ceilings — 330 to 560 — were chosen so
 * an unusually tall PHONE window could not drive one mode's object past the
 * others and make the set look inconsistent (see `VinylMode`'s `platSize`).
 *
 * On an iPad that arithmetic inverts. The window is wide and tall enough that
 * the share-of-the-window term is always the LARGER number, so the pixel
 * ceiling is what actually decides the size in every mode at once — the
 * backdrop fills a 1032-point screen while the object it is meant to be
 * showing stays the size it was on a phone, marooned in the middle of it.
 * That is the owner's report on 13.09: "the modes remain small".
 *
 * `heroCeil` lifts the ceiling on a tablet so the mode's OWN share term —
 * already tuned to look right against a screen — gets to decide instead, and
 * the object grows with the screen the way the photograph behind it already
 * does. The multiplier is deliberately generous rather than exact: it is a
 * safety rail for a freak aspect ratio, not the number that should normally
 * bind.
 *
 * A PHONE CAN NEVER REACH `WIDE_MIN` (the widest is 430 points), so this
 * returns `phone` untouched there and every phone layout stays byte-identical
 * to what shipped — the same safety `PAGE_MAX_W` is built on.
 */
export const heroCeil = (phone: number, winW: number) => (isWide(winW) ? phone * 1.8 : phone);

/**
 * The reading column itself, for a page's scroll content container.
 *
 * ONE OBJECT RATHER THAN FOUR COPIES, because the floating tab bar is capped
 * to match it — so a page that opted out would put the bar visibly out of
 * step with the content above it, which is the exact fault the single gutter
 * was introduced to fix (31.07).
 */
export const pageColumn: ViewStyle = {
  width: '100%',
  maxWidth: PAGE_MAX_W,
  alignSelf: 'center',
};

export const TAB_BAR_HEIGHT  = 84;
export const TAB_BAR_BOTTOM  = 22;   // gap from screen edge
export const TAB_SAFE_INSET  = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16;
