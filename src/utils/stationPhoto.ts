import * as FileSystem from 'expo-file-system/legacy';

/**
 * A photo of your own, behind a station you made.
 *
 * The whole app already keys off one field — `station.image` — for the
 * full-bleed backdrop in all eight modes, the hero on the station page and the
 * card in the list. Custom stations have always had that field empty, which is
 * exactly why they read as colour cards sitting among photo cards. Filling it
 * in makes them first-class everywhere at once, with no plumbing downstream.
 *
 * TWO COPIES, AND THE SMALL ONE IS THE POINT. The modes never display the
 * sharp photo: they display a pre-blurred one, deliberately, because blurring
 * a full-size image on every re-display runs on the main thread and iOS killed
 * the app for it once (see the note in StationBackdrop). There is no blur
 * filter available at import time — but blowing a ~56px image up to fill a
 * screen IS a blur, for free, with no processing at all. So the tiny copy is
 * the backdrop and the big one is the card and hero, which is the same
 * arrangement the ten built-in stations already use.
 *
 * NATIVE, so everything here degrades to "unavailable" until a build carries
 * the two modules — the same shape as saveToPhotos. Written ahead of that
 * build so the build only has to switch it on.
 */
export type StationPhoto = { image: string; imageBlur: string };

/** Where a station's own photos live. Kept out of the cache directory on
 *  purpose: iOS may clear that whenever it likes, and a station losing its
 *  picture to a low-disk sweep would be baffling. */
const DIR = `${FileSystem.documentDirectory}station-photos/`;

/** Big enough to hold up as a hero, small enough to stay well inside the
 *  ~600KB-a-photo rule the built-in stations follow. */
const FULL_W = 1400;
/** The backdrop. Deliberately tiny — see the note above. */
const BLUR_W = 56;

type Picker = typeof import('expo-image-picker');
type Manipulator = typeof import('expo-image-manipulator');

function modules(): { picker: Picker; manip: Manipulator } | null {
  // documentDirectory is null on web, and both picker and manipulator ship web
  // implementations — so without this the "Add a photo" button appears in the
  // web build, opens a file dialog, and then fails at the point of saving,
  // because there is nowhere to save to. Checking the destination as well as
  // the tools keeps the unavailable path honest: the button only exists where
  // the whole journey works.
  if (!FileSystem.documentDirectory) return null;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const picker = require('expo-image-picker') as Picker;
    const manip = require('expo-image-manipulator') as Manipulator;
    /* eslint-enable @typescript-eslint/no-require-imports */
    if (!picker?.launchImageLibraryAsync || !manip?.manipulateAsync) return null;
    return { picker, manip };
  } catch {
    return null;
  }
}

/** False on web and on every build before the modules land. */
export function stationPhotoAvailable(): boolean {
  return modules() !== null;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export type PickResult =
  | { kind: 'photo'; photo: StationPhoto }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' }
  | { kind: 'failed' };

/**
 * Open the photo library and keep what comes back.
 *
 * Note there is no permission prompt on modern iOS: the library picker runs
 * outside the app and hands over only the one image chosen, so Cruise FM never
 * gains access to anyone's photos. Worth re-checking on the first real build
 * rather than trusting it here.
 */
export async function pickStationPhoto(stationId: string): Promise<PickResult> {
  const m = modules();
  if (!m) return { kind: 'unavailable' };
  try {
    // DELIBERATELY NO `allowsEditing`. It sounds like the right thing — let
    // them frame it — but on iOS it forces a SQUARE crop and ignores `aspect`
    // entirely (expo-image-picker's own types say so). That would make someone
    // crop a landscape photo of their car into a square for something that
    // ends up as a tall full-screen backdrop, losing most of it twice over.
    // Taking the whole photo is better: every place it appears already fits it
    // with `contentFit="cover"`, which crops correctly for that box — the
    // backdrop, the card and the hero each want a different shape anyway.
    const picked = await m.picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.length) return { kind: 'cancelled' };

    await ensureDir();
    const src = picked.assets[0].uri;
    const stamp = Date.now(); // new name each time, so the old file can't be cached in its place

    const full = await m.manip.manipulateAsync(src, [{ resize: { width: FULL_W } }], {
      compress: 0.82, format: m.manip.SaveFormat.JPEG,
    });
    const tiny = await m.manip.manipulateAsync(src, [{ resize: { width: BLUR_W } }], {
      compress: 0.7, format: m.manip.SaveFormat.JPEG,
    });

    const image = `${DIR}${stationId}-${stamp}.jpg`;
    const imageBlur = `${DIR}${stationId}-${stamp}-blur.jpg`;
    await FileSystem.moveAsync({ from: full.uri, to: image });
    await FileSystem.moveAsync({ from: tiny.uri, to: imageBlur });

    // Whatever this station had before is now unreachable.
    await deleteStationPhoto(stationId, stamp);
    return { kind: 'photo', photo: { image, imageBlur } };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * Delete a station's photos. Called when the picture is replaced (keeping the
 * new one, via `keepStamp`) and when the station itself is deleted.
 */
export async function deleteStationPhoto(stationId: string, keepStamp?: number): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (!info.exists) return;
    const files = await FileSystem.readDirectoryAsync(DIR);
    await Promise.all(files
      .filter((f) => f.startsWith(`${stationId}-`))
      .filter((f) => !keepStamp || !f.startsWith(`${stationId}-${keepStamp}`))
      .map((f) => FileSystem.deleteAsync(DIR + f, { idempotent: true })));
  } catch {
    // A photo left behind costs a few hundred KB and nothing else — never let
    // tidying up break deleting a station.
  }
}
