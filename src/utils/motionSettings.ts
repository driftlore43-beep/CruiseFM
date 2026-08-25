import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruise_data_saver';

/** Data Saver = force still backgrounds everywhere (battery / mobile data). */
export async function getDataSaver(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDataSaverStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

const AUTO_DIM_KEY = 'cruise_auto_dim';

/** Auto-dim = mid-drive, the screen gently dims after ~30s without a touch
 * (tap to wake). Default ON — the screen is the biggest battery cost. */
export async function getAutoDim(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AUTO_DIM_KEY);
    return raw == null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setAutoDimStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_DIM_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

const ATMOSPHERE_KEY = 'cruise_atmosphere';

/** Atmosphere = the smoke-machine haze breathing behind every mode.
 * Default ON — it's part of the signature look; the toggle exists for
 * drivers who want the scene clean. */
export async function getAtmosphere(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ATMOSPHERE_KEY);
    return raw == null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setAtmosphereStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ATMOSPHERE_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

const SOFT_ATMOS_KEY = 'cruise_soft_atmosphere';

/** Softer Atmosphere = the haze at roughly half strength. Default ON — at full
 *  strength the smoke washed over the whole scene (owner, 26.07); the old,
 *  heavier look is still one tap away for anyone who wants it. */
export async function getSoftAtmosphere(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOFT_ATMOS_KEY);
    return raw == null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setSoftAtmosphereStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOFT_ATMOS_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

const DAYLIGHT_KEY = 'cruise_daylight';

/**
 * Daylight = a high-CONTRAST pass over the app, for driving in sun.
 *
 * Deliberately not a white theme. The problem in sunlight is not that the
 * app is dark — black behind white type is the highest contrast a phone can
 * make, and on an OLED it is also the cheapest. What disappears outdoors is
 * everything drawn at half strength: grey-on-black captions, hairline rims,
 * dark glass panels, and white type sitting on a photograph. So this lifts
 * the quiet things to full strength and deepens the scrims UNDER type,
 * rather than inverting anything. It also stands the auto-dim down, since
 * dimming is the opposite of what you want with the sun on the screen.
 *
 * Default OFF: at night the softer treatment is the nicer one.
 */
export async function getDaylight(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DAYLIGHT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setDaylightStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(DAYLIGHT_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

const VINYL_CLASSIC_KEY = 'cruise_vinyl_classic';

/**
 * Classic Vinyl = the turntable without its neon layer.
 *
 * The Vinyl deck's hardware is carefully observed — the tonearm is drawn from
 * a reference photograph, the label is the real album art, the record casts a
 * real shadow — and on top of that sit a thick pulsing ring in the station's
 * colour, eight rotating light rays and a field of gold specks. None of those
 * exist on a turntable, and a listener asked for the option of the plain thing
 * (Ethan, 23.08: "from an arcade holographic style to something more like the
 * MD app").
 *
 * Default OFF, so nobody's deck changes unless they choose it. The station's
 * colour still reaches the rim, the grooves and the arm, so a Classic deck
 * still reads as the mood it belongs to.
 */
export async function getVinylClassic(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VINYL_CLASSIC_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setVinylClassicStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VINYL_CLASSIC_KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}
