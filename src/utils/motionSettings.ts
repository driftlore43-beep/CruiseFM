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
