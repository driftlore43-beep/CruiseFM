import { requireOptionalNativeModule } from 'expo-modules-core';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { cachedCustomStations, loadCustomStations } from './customStations';
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

type Bridge = {
  setArtwork(base64: string | null): Promise<boolean>;
  setStationImage?(id: string, base64: string | null): Promise<boolean>;
};
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


/**
 * A CUSTOM STATION'S PHOTOGRAPH, HANDED TO THE WIDGETS.
 *
 * The ten built-in stations' backdrops are bundled inside the widget
 * extension, so they needed nothing like this. A custom station's photo lives
 * in the app's documents directory, which a widget extension genuinely cannot
 * reach — it is a separate process with its own sandbox — so the only way
 * across is to copy it into the App Group.
 *
 * `setStationImage` IS OPTIONAL ON THE BRIDGE and this returns quietly
 * without it. That is not defensive habit: this ships over the air to phones
 * running build 38, whose widget extension has no such function and no code
 * to draw the result. Those keep their gradients until they install a build
 * that does.
 *
 * WIDGET-SIZED, NOT SCREEN-SIZED. 560px matches the bundled built-ins, which
 * were measured for a widget at ~1080px across at 3x; the app's own soft copy
 * is 540px wide and already the small one, so this is a copy rather than a
 * further downscale in most cases.
 */
const STATION_PX = 560;

export async function sendStationImageToWidgets(
  stationId: string, blurUri: string | null,
): Promise<void> {
  if (!bridge?.setStationImage) return;
  // No photo, or the station is going away: clear whatever was there rather
  // than leave an orphan for a widget to keep drawing.
  if (!blurUri) { await bridge.setStationImage(stationId, null).catch(() => {}); return; }

  const m = modules();
  if (!m) return;
  try {
    const out = await m.manip.manipulateAsync(
      blurUri, [{ resize: { width: STATION_PX } }],
      { compress: 0.72, format: m.manip.SaveFormat.JPEG, base64: true },
    );
    if (out?.base64) await bridge.setStationImage(stationId, out.base64);
  } catch {
    // A missing or unreadable file just means the widget keeps its gradient.
  }
}


/**
 * BACK-FILL THE STATIONS THAT ALREADY EXIST.
 *
 * Copying happens when a photo is SAVED, which does nothing for the stations
 * someone already made — their photos were saved by a build that had nowhere
 * to copy them to. Without this, an existing custom station would show a
 * gradient in the widgets for ever, or until its owner happened to re-pick
 * the same picture, which nobody is going to do.
 *
 * ONCE PER INSTALL, and cheaply: it is a handful of stations at most, it
 * runs off the back of a publish rather than on a screen, and the flag is
 * written before the work so a failure cannot turn it into a loop. If a copy
 * fails, that station simply keeps its gradient — which is exactly what it
 * has today.
 */
const BACKFILL_KEY = 'cruisefm_widget_station_images_v1';

export async function backfillStationImagesOnce(): Promise<void> {
  if (!bridge?.setStationImage) return;
  try {
    if (await AsyncStorage.getItem(BACKFILL_KEY)) return;
    // Written FIRST. A half-finished back-fill is not worth retrying on every
    // launch — the save path keeps everything correct from here on.
    await AsyncStorage.setItem(BACKFILL_KEY, '1');
    if (!cachedCustomStations().length) await loadCustomStations().catch(() => {});
    for (const st of cachedCustomStations()) {
      const blur = (st as { imageBlur?: string | null }).imageBlur ?? null;
      if (typeof blur === 'string' && blur) await sendStationImageToWidgets(st.id, blur);
    }
  } catch {
    // Nothing here is worth interrupting anything for.
  }
}
