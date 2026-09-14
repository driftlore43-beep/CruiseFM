import { Dimensions, Platform } from 'react-native';

import { isTabletSize } from '@/constants/theme';

/**
 * Rotation is allowed ONLY while a fullscreen mode is open. The rest of the
 * app — home, stations, modes, profile — is lists and cards, which portrait
 * serves better; only the scenes want widescreen (owner, 30.07, after the
 * L1/L2/L3 landscape prototypes).
 *
 * app.json's `"orientation": "portrait"` sets the app's INITIAL state; this
 * module changes what's allowed at runtime through expo-screen-orientation,
 * whose native module has shipped in every build since early July — so this
 * whole feature is plain JS and travels over the air.
 *
 * Everything is wrapped defensively: the module is absent on web (where
 * lockAsync can also throw mid-gesture) and must never take the app down
 * over something as cosmetic as rotation.
 */

/**
 * Which modes have a real landscape composition. A mode NOT in this set
 * stays portrait even while open — its portrait column squeezed into a wide
 * window is worse than no landscape at all (owner, 30.07: "a lot of them do
 * squish"). Add a mode here ONLY once its file has an isLandscape branch
 * wearing LandscapeChrome — all eight now do.
 */
export const LANDSCAPE_READY = new Set(['disco', 'equalizer', 'cassette', 'vinyl', 'cd', 'orb', 'horizon', 'radio']);

function loadModule(): typeof import('expo-screen-orientation') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-screen-orientation');
  } catch {
    return null;
  }
}

const SO = loadModule();

/** While a mode is open: let the phone turn. DEFAULT is the platform's own
 *  mask — on iPhone that is everything except upside-down portrait, which is
 *  exactly right (no app allows upside-down on a phone). */
export async function allowRotation(): Promise<void> {
  if (!SO || Platform.OS === 'web') return;
  try {
    // ALL includes upside-down, which is normal on a tablet and is refused
    // outright on a phone (expo-screen-orientation says so in its own docs),
    // so the two devices genuinely need different masks here.
    await SO.lockAsync(isTablet() ? SO.OrientationLock.ALL : SO.OrientationLock.DEFAULT);
  } catch { /* rotation is a nicety, never an error */ }
}

/**
 * A TABLET IS NEVER PINNED UPRIGHT, and that is a fix rather than a nicety.
 *
 * Locking the whole app to portrait outside a mode is a PHONE's rule: the
 * list pages are a single column and portrait reads better, and a phone in a
 * pocket is held upright anyway. An iPad is not — it sits in a stand, in a
 * case, in Stage Manager — so refusing to turn reads as broken, and the
 * shorter edge clears the reading column's cap in both orientations anyway
 * (see PAGE_MAX_W), so nothing about the pages needs portrait.
 *
 * IT ALSO REMOVES THE THING THAT CAUSED THE WRONG-ORIENTATION BUG. Under the
 * old rule an iPad lying sideways was FORCED upright for the pages and then
 * released the moment a mode opened, so every single drive began with the
 * system turning the window underneath a tree that had already rendered —
 * which is exactly the landscape-screen-with-portrait-layout the owner
 * photographed (14.09). No forced turn, no race to lose.
 */
function isTablet(): boolean {
  try {
    const { width, height } = Dimensions.get('window');
    return isTabletSize(width, height);
  } catch {
    return false;
  }
}

/** Everywhere else: pinned upright. Also snaps the screen back to portrait
 *  if the mode was closed while the phone lay sideways. */
export async function lockPortrait(): Promise<void> {
  if (!SO || Platform.OS === 'web') return;
  if (isTablet()) { await allowRotation(); return; }
  try {
    await SO.lockAsync(SO.OrientationLock.PORTRAIT_UP);
  } catch { /* same */ }
}
