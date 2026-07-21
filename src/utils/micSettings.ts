import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruise_mic_reactive';

/**
 * Music-reactive visuals — when on, the mode visualisers pulse to the sound
 * around the phone (read live off the mic, never recorded). Default ON: it's
 * the headline of the driving experience. Users can switch it off in Profile,
 * and it silently falls back to the timed animation if permission is denied.
 */
export async function getMicReactive(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw == null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function setMicReactiveStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}
