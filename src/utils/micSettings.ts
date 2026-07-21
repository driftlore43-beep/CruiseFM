import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruise_mic_reactive';

/**
 * Music-reactive visuals — when on, the mode visualisers pulse to the sound
 * around the phone (read live off the mic, never recorded). Default OFF: on
 * iPhone the mic and Spotify contend for the audio session, so out of the box
 * we keep playback perfectly clean and leave this as a deliberate opt-in in
 * Profile. It silently falls back to the timed animation if permission is
 * denied — and when off, the mic is never touched at all.
 */
export async function getMicReactive(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw == null ? false : raw === 'true';
  } catch {
    return false;
  }
}

export async function setMicReactiveStored(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}
