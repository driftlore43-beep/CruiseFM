/**
 * Save a file to the phone's photo library.
 *
 * Split by platform on purpose. `expo-media-library` is native-only, and
 * pulling it into the web bundle is not merely wasteful — Metro cannot
 * resolve the package's own TypeScript sources for web (its `exports` map
 * points at `src/`, and a relative type-barrel inside it fails to resolve),
 * which breaks the whole web build. The `.web.ts` twin next to this file
 * keeps it out of that bundle altogether, so the web preview keeps working
 * and the harnesses keep running.
 *
 * Also needs `NSPhotoLibraryAddUsageDescription`, which is why this could
 * only ship with a new binary — see the 1.2.0 batch.
 */
export type SaveResult = 'saved' | 'denied' | 'unavailable' | 'failed';

export async function saveImageToPhotos(path: string): Promise<SaveResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ML = require('expo-media-library') as typeof import('expo-media-library');
    if (!ML?.requestPermissionsAsync) return 'unavailable';
    // `true` asks for ADD-ONLY access: Cruise FM never reads anyone's photos,
    // and asking for less is the difference between a permission people grant
    // and one they think twice about.
    const perm = await ML.requestPermissionsAsync(true);
    if (!perm.granted) return 'denied';
    await ML.saveToLibraryAsync(path);
    return 'saved';
  } catch {
    return 'failed';
  }
}
