import { useFonts } from 'expo-font';

import { Fonts } from '@/constants/theme';

/**
 * The Windows-era UI face, for the Y2K share card.
 *
 * The owner named the real thing (11.08): "old Microsoft Windows font, I think
 * a suitable style is MS Sans Serif (Helv)". That font is Microsoft's and
 * cannot be shipped, so this is DotGothic16 — OFL, subset to Latin (37 KB
 * rather than 1.9 MB), and the closest freely licensable match: a proportional
 * bitmap face with real mixed case.
 *
 * MIXED CASE IS THE WHOLE REQUIREMENT, and it is what ruled out the previous
 * idea of setting the card in the seven-segment face. Seven segments have no
 * diagonals and no vertical centre bar, so they cannot form most letters at
 * all — rendered for real, "Metro Boomin, Coi Leray" came out "NEtroboon
 * in,co iLErAY". Fourteen segments can manage capitals but nothing else, and a
 * whole card in capitals is not what a Windows dialog looked like. Segment
 * faces stay where they belong: numbers, on the station dials.
 *
 * Fonts ship as ASSETS, so this is OTA-safe and does not change the runtime
 * fingerprint — the same route the DSEG dial faces took on 28.07.
 */
export function usePixelFont(): string {
  const [loaded] = useFonts({
    'DotGothic16-Latin': require('../../assets/fonts/DotGothic16-Latin.ttf'),
  });
  // Falls back to the mono face, so a card captured before the font is ready
  // degrades to plain type rather than to nothing.
  return loaded ? 'DotGothic16-Latin' : Fonts.mono;
}
