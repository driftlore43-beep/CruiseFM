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
