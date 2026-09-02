import { requireOptionalNativeModule } from 'expo-modules-core';

import { noteLastPlayed } from './lastPlayed';

/**
 * Send the last-played album cover across to the widgets.
 *
 * WHY THIS IS ITS OWN FILE. It reaches for two optional native modules and
 * does real work over the network, on a path that runs whenever a song
 * changes — so it is kept well away from the switchboard, and every single
 * step is allowed to fail without anything upstream noticing. A widget with
 * yesterday's cover, or none, is a far smaller problem than a drive that
 * stutters trying to fetch a picture.
 *
 * IT ONLY RUNS ON A GENUINELY NEW SONG. `noteLastPlayed` returns false when
 * the title and artist match what is already stored, which matters because
 * the poll fires every five seconds and a song lasts minutes: without that
 * gate this would download the same image several hundred times a drive.
 */

type Bridge = { setArtwork(base64: string | null): Promise<boolean> };
const bridge = requireOptionalNativeModule<Bridge>('CruiseWidgets');

/** Small on purpose. It is drawn as a record label ~30pt across, so anything
 *  larger is bytes crossing a process boundary for nothing. */
const LABEL_PX = 240;

function modules() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manip = require('expo-image-manipulator');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system/legacy');
    return manip?.manipulateAsync && fs?.downloadAsync ? { manip, fs } : null;
  } catch {
    return null;
  }
}

/**
 * Remember a song, and if it is new, put its cover where the widgets can
 * draw it. Returns quietly on every failure.
 */
export async function noteSongForWidgets(
  title: string, artist: string, artUrl: string | null,
): Promise<void> {
  const isNew = await noteLastPlayed(title, artist, artUrl).catch(() => false);
  if (!isNew || !bridge) return;

  // No artwork for this song: clear the old one rather than leave the
  // previous song's cover sitting on the record claiming to be this one.
  if (!artUrl) { await bridge.setArtwork(null).catch(() => {}); return; }

  const m = modules();
  if (!m) return;
  try {
    let local = artUrl;
    if (/^https?:/.test(artUrl)) {
      const to = `${m.fs.cacheDirectory}widget-art.jpg`;
      const res = await m.fs.downloadAsync(artUrl, to);
      if (!res?.uri) return;
      local = res.uri;
    }
    const out = await m.manip.manipulateAsync(
      local, [{ resize: { width: LABEL_PX, height: LABEL_PX } }],
      { compress: 0.8, format: m.manip.SaveFormat.JPEG, base64: true },
    );
    if (out?.base64) await bridge.setArtwork(out.base64);
  } catch {
    // Offline, a dead URL, a codec that will not open it — all end here, and
    // all mean the widget keeps whatever cover it already had.
  }
}
