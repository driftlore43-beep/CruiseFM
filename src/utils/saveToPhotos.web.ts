/** Web has no photo library, and importantly no `expo-media-library` in the
 *  bundle — see the note in saveToPhotos.ts for why that matters. */
export type SaveResult = 'saved' | 'denied' | 'unavailable' | 'failed';

export async function saveImageToPhotos(_path: string): Promise<SaveResult> {
  return 'unavailable';
}
