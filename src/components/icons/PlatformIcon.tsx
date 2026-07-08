import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';

import { TidalLogo } from '@/components/icons/TidalLogo';
import type { PlatformId } from '@/utils/musicPlatform';

// Real brand marks (Tidal has its own SVG; the rest are icon-font glyphs).
type IconDef = { family: 'FontAwesome' | 'MaterialCommunityIcons'; name: string };
const PLATFORM_ICONS: Partial<Record<PlatformId, IconDef>> = {
  spotify:      { family: 'FontAwesome', name: 'spotify' },
  appleMusic:   { family: 'FontAwesome', name: 'apple' },
  youtubeMusic: { family: 'FontAwesome', name: 'youtube-play' },
  amazonMusic:  { family: 'FontAwesome', name: 'amazon' },
  none:         { family: 'MaterialCommunityIcons', name: 'close-thick' },
};

/** A platform's brand mark, sized and coloured to taste. */
export function PlatformIcon({ id, size = 18, color = '#fff' }: { id: PlatformId; size?: number; color?: string }) {
  if (id === 'tidal') return <TidalLogo size={size + 2} color={color} />;
  const def = PLATFORM_ICONS[id];
  if (!def) return null;
  if (def.family === 'FontAwesome') {
    return <FontAwesome name={def.name as any} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={def.name as any} size={size + 2} color={color} />;
}
