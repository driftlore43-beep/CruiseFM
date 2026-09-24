/**
 * The one list of visual modes and which of them are Premium. Every lock,
 * picker and preview check reads from here — never a local copy, so a mode
 * can't be free in one doorway and premium in another.
 */

import { STATIONS } from './stations';

export type ModeInfo = { id: string; label: string; pro: boolean };

export const MODE_CATALOG: ModeInfo[] = [
  { id: 'cassette',  label: 'Cassette',    pro: false },
  { id: 'equalizer', label: 'Equalizer',   pro: false },
  { id: 'vinyl',     label: 'Vinyl',       pro: true  },
  { id: 'radio',     label: 'Tuner',       pro: true  },
  { id: 'horizon',   label: 'Horizon',     pro: true  },
  { id: 'orb',       label: 'Circular EQ', pro: false },
  // Renamed from "Disco Ball" 2026-07-25 — the id stays `disco` on purpose:
  // saved cruises and per-station mode picks store the bare string.
  { id: 'disco',     label: 'Mirror Ball', pro: true  },
  { id: 'cd',        label: 'CD',          pro: true  },
];

/** Modes that no longer exist (retired between releases). A saved cruise
 *  stores the mode as a bare string, so without this a resume would open
 *  nothing at all. */
export const FALLBACK_MODE = 'equalizer';

export function knownMode(mode: string | undefined | null): string {
  return MODE_CATALOG.some((m) => m.id === mode) ? (mode as string) : FALLBACK_MODE;
}

/**
 * A mode's own name, as the app prints it.
 *
 * Exists so the WIDGET snapshot can carry the label instead of the widget
 * target keeping a second copy of this table. A copy there would drift
 * silently — a mode renamed here would go on printing its old name on a
 * Home Screen with nothing to catch it — which is the same reasoning that
 * has `iconChar` resolved in JS rather than in Swift.
 *
 * An unknown id falls back the way `knownMode` does, so a saved cruise
 * naming a retired mode prints a real name rather than a raw id.
 */
export function modeLabel(mode: string | undefined | null): string {
  const id = knownMode(mode);
  return MODE_CATALOG.find((m) => m.id === id)?.label ?? id;
}

export function isProMode(mode: string): boolean {
  return MODE_CATALOG.some((m) => m.id === mode && m.pro);
}

/**
 * Whether a station sits behind the paywall — the FM band.
 *
 * A station someone made themselves is never premium, and an unknown id is
 * not either: `resolveAnyStation` falls back for one of those, and refusing a
 * drive over an id we do not recognise would be the worst possible reason to
 * refuse one.
 */
export function isProStation(stationId: string): boolean {
  return STATIONS.some((s) => s.id === stationId && s.premium);
}

/**
 * IS THIS DRIVE A TASTE RATHER THAN THE REAL THING?
 *
 * ONE ANSWER, IN ONE PLACE, because it is asked at every doorway — the home
 * hero, the station page, a widget tap — and a doorway that forgets half of
 * it is a doorway through the paywall. It used to be written inline as
 * `!isPro && isProMode(mode)`, which was complete while only MODES were
 * premium: a locked FM row is simply not tappable on the Stations page
 * (`onPress={isPro ? … : undefined}`), so a free user had no way to reach a
 * premium station at all.
 *
 * PINNING A WIDGET TO A STATION MADE ONE (21.09). The picker offers the FM
 * band to everyone and marks it, which is the same shop-window rule the
 * Stations page follows — a locked row is dimmed behind a padlock, never
 * hidden — so the tap has to be gated here instead of at the tile. A taste
 * then the paywall is what the app already does for a premium MODE; a tile
 * that does nothing when pressed would be worse than one that shows what is
 * behind the price.
 */
export function needsPreview(isPro: boolean, stationId: string, mode: string): boolean {
  return !isPro && (isProMode(mode) || isProStation(stationId));
}
