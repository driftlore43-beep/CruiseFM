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
 * HOW MUCH OF A TABLET'S HEIGHT A DECK'S OWN CONTROLS NEED.
 *
 * On a tablet the binding number for a mode's object stopped being the
 * ceiling (13.09 lifted that) and became the SHARE — `winH * 0.58` on the
 * vinyl, `winH * 0.47` on the CD. A share is a guess at how much room the
 * chrome wants, and on a 1024-point iPad it guessed far too much: the owner,
 * with her own screenshot, "i still really want the vinyl to take up a more
 * room - we have more space use it up!"
 *
 * SO THIS IS MEASURED RATHER THAN GUESSED — AND MEASURED AGAINST A REAL SONG,
 * which is the half that matters. Rendered at 768x1024, the station block
 * above a deck ends at y=105. With no track the deck shows a one-line tagline
 * starting at y=788, i.e. 341 points of furniture; with a song it shows a
 * title, an artist, a seek bar and two times, and the title's own glyphs
 * start at y=695 — 434 points. Sizing against the tagline and then meeting a
 * long song title is how an object gets squeezed by flex and its tonearm
 * pushed off the top of the screen, which is exactly what a 350 here did when
 * it was tried. 440 is the real number with a little air.
 *
 * THE CONSEQUENCE IS WORTH STATING PLAINLY: on a 1024-point iPad this leaves
 * 584 points, and the vinyl was already at 594 — so the record was very
 * slightly OVER its own budget rather than under it, and there was never any
 * headroom to give it while the controls are up. What the owner could see
 * going spare is the room the controls themselves occupy, and the answer to
 * that is `restGrowFor` in LandscapeChrome, not a bigger number here.
 *
 * IT ALSO BEHAVES IN A SHORT WIDE WINDOW, which a share does not: an iPad
 * split view 700 points tall gets 350 rather than a share that would have
 * overflowed the screen and left flex to squeeze it.
 *
 * FOR TABLETS ONLY. Phones keep their own share term untouched, so every
 * phone layout stays byte-identical — the same safety `heroCeil` and
 * `PAGE_MAX_W` are built on.
 */
export const DECK_CHROME_H = 440;

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

/**
 * THE SAME COLUMN, FOR THE CONTROLS UNDER A FULLSCREEN MODE.
 *
 * A deck's picture is full-bleed and should stay that way — the photograph and
 * the object are the point of the screen. Its CONTROLS are not: the song
 * title, the seek bar, the transport row and the pills were all laid out
 * against a phone's width, and stretched across 1032 points the shuffle and
 * repeat buttons end up at opposite corners of an iPad with the play button
 * marooned between them. That is the same "phone stretched" fault the reading
 * column fixed on the list pages, one layer in.
 *
 * DELIBERATELY THE SAME NUMBER as `pageColumn` rather than a second one: a
 * deck and a page are read at the same distance by the same person, and two
 * nearly-equal caps is how they drift apart.
 *
 * IT MUST NOT IMPOSE ALIGNMENT. `alignItems` here would shrink each mode's
 * song block to its own content and centre it, which is exactly the regression
 * of 18.08 — so this sets width and self-alignment only, and a mode that
 * genuinely centres its own children keeps saying so itself.
 */
export const deckColumn: ViewStyle = {
  width: '100%',
  maxWidth: PAGE_MAX_W,
  alignSelf: 'center',
};

export const TAB_BAR_HEIGHT  = 84;
export const TAB_BAR_BOTTOM  = 22;   // gap from screen edge
export const TAB_SAFE_INSET  = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16;
