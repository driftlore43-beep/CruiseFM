/**
 * The one list of visual modes and which of them are Premium. Every lock,
 * picker and preview check reads from here — never a local copy, so a mode
 * can't be free in one doorway and premium in another.
 */

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

export function isProMode(mode: string): boolean {
  return MODE_CATALOG.some((m) => m.id === mode && m.pro);
}
