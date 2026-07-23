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
  { id: 'waves',     label: 'Sound Waves', pro: false },
  { id: 'orb',       label: 'Circular EQ', pro: true  },
];

export function isProMode(mode: string): boolean {
  return MODE_CATALOG.some((m) => m.id === mode && m.pro);
}
