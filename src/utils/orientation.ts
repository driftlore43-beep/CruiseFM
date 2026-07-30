import { Platform } from 'react-native';

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
    await SO.lockAsync(SO.OrientationLock.DEFAULT);
  } catch { /* rotation is a nicety, never an error */ }
}

/** Everywhere else: pinned upright. Also snaps the screen back to portrait
 *  if the mode was closed while the phone lay sideways. */
export async function lockPortrait(): Promise<void> {
  if (!SO || Platform.OS === 'web') return;
  try {
    await SO.lockAsync(SO.OrientationLock.PORTRAIT_UP);
  } catch { /* same */ }
}
