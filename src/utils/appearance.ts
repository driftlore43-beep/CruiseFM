import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Light or dark, and the palette each one hands out.
 *
 * WHY IT EXISTS (owner, 13.08, from outside in the sun): "The black is really
 * tough to see through during the day." A prototype that repainted the running
 * app settled the shape of the answer, and two findings from it are baked in
 * here rather than left to be rediscovered.
 *
 * (1) THE PAGES GO LIGHT, THE DRIVES DO NOT. Every visual mode is a photograph
 *     with white words over it — there is no black to turn white, and inverting
 *     it puts dark grey type on a mid-blue sky, which is harder to read outdoors
 *     rather than easier. The modes keep their own dark world and the existing
 *     Daylight setting does the sun work there. So nothing in this file reaches
 *     inside a mode.
 *
 * (2) CARDS KEEP THEIR OWN COLOURS (owner's call). A station card, a mode card,
 *     the hero — those carry artwork and mood, and they look right on paper for
 *     the same reason album art looks right in Apple Music's light theme. Only
 *     the PAGE around them changes: its ground, its type, its hairlines, and the
 *     plain panels that were never coloured to begin with.
 *
 * THE DARK VALUES BELOW ARE THE SHIPPED ONES, EXACTLY. Every token's dark side
 * is the literal it replaces, so converting a stylesheet to tokens cannot alter
 * how the app looks tonight — only what it is capable of looking like tomorrow.
 * If a dark token ever needs to differ from what the app already draws, that is
 * a design change and belongs in its own round.
 */

export type Appearance = 'light' | 'dark' | 'system';
export type Mode = 'light' | 'dark';

const KEY = 'cruise_appearance';

export async function getAppearance(): Promise<Appearance> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
}

export async function setAppearanceStored(value: Appearance): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    // ignore
  }
}

export type Palette = {
  mode: Mode;
  /** The page ground. Also what React Navigation paints behind every screen. */
  bg: string;
  /** Full-strength type and icons. */
  text: string;
  /** A plain panel that was never coloured — settings rows, badge tiles. */
  panel: string;
  /** The same panel, one step lifted (an earned badge, a selected row). */
  panelUp: string;
  /** The floating tab bar's own fill. */
  bar: string;
  /** An inactive tab's icon and label. */
  barMuted: string;
  /**
   * Type, rims and washes at a given strength. In dark this is white, which is
   * what every one of these call sites already spells out by hand; in light it
   * is the ink. Alpha carries the hierarchy either way, so a caption at 0.48
   * stays a caption.
   */
  ink: (alpha: number) => string;
  /**
   * THE DIAL'S LIT AMBER, and the premium gold — the app's two warm accents.
   *
   * They need a per-theme value for the same reason nothing else does: they
   * are the only colours used as TEXT on the page rather than on a card. On
   * black, #F59E0B is a lit lamp. On paper it measures 1.95:1 against the
   * ground, which is a colour you can see but not read — and the band captions,
   * the ON AIR chip and the PREMIUM badge are all set in it at 8-10pt. Deepened
   * they land at 4.5:1 and 4.3:1 and still read as amber and gold.
   */
  amber: string;
  gold: string;
  /**
   * A shadow that reads on this ground. Black on paper is a bruise — a light
   * theme's depth comes from a soft warm-grey shadow at low opacity, which is
   * why this is a colour AND an opacity rather than just a colour.
   */
  shadow: string;
  shadowOpacity: number;
};

const DARK: Palette = {
  mode: 'dark',
  bg: 'rgb(1,1,1)',            // React Navigation's own DarkTheme ground
  text: '#ffffff',
  panel: '#0a0a10',
  panelUp: '#1b1b24',
  bar: '#0d0d0d',
  barMuted: '#6A6A72',
  ink: (a) => `rgba(255,255,255,${a})`,
  amber: '#F59E0B',
  gold: '#F7B733',
  shadow: '#000000',
  shadowOpacity: 1,
};

/**
 * PAPER, NOT PAPER-WHITE. #ffffff under a bright sky is a torch pointed at the
 * reader; a warm off-white is what a printed dial or a car manual is on, and it
 * sits better under the station colours, which are almost all warm.
 */
const LIGHT: Palette = {
  mode: 'light',
  bg: '#F6F4EF',
  text: '#17171B',
  panel: '#FFFDF8',
  panelUp: '#ECE7DC',
  bar: '#FFFDF8',
  barMuted: '#8A877F',
  ink: (a) => `rgba(23,23,27,${a})`,
  amber: '#A85E06',
  gold: '#9A6B00',
  // Lower opacity than dark's, and warm rather than black: on paper a shadow is
  // the only thing separating a panel from the page, so it has to be present
  // without being a smudge.
  shadow: '#3A342A',
  shadowOpacity: 0.42,
};

export function paletteFor(mode: Mode): Palette {
  return mode === 'light' ? LIGHT : DARK;
}
