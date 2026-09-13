import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cruisefm_driver_name';
/**
 * THE NAME SOMEONE HAS BEFORE THEY PICK ONE.
 *
 * 'Night Driver' until 13.09, and it made two claims about a stranger that the
 * app has no way to support: that they are driving, and that it is night. The
 * second is simply wrong most of the day, and the first stopped being safe the
 * moment the app admitted it is used at a desk as well as in a car — on an
 * iPad there is no driving mode at all, so a tablet greeted every new owner as
 * a driver.
 *
 * 'Cruiser' keeps the app's own voice — cruising here is the feeling, not a
 * claim about where anybody is sitting — and is true of both. One word to
 * change if a better one turns up; 'Listener' and 'Passenger' were the other
 * two considered.
 */
export const DEFAULT_DRIVER_NAME = 'Cruiser';

export async function getDriverName(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const name = raw?.trim();
    return name ? name : DEFAULT_DRIVER_NAME;
  } catch {
    return DEFAULT_DRIVER_NAME;
  }
}

export async function setDriverName(name: string): Promise<void> {
  try {
    const trimmed = name.trim();
    if (trimmed) await AsyncStorage.setItem(KEY, trimmed);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // storage hiccup — the in-memory name still shows this session
  }
}

/** "Jess Arroyo" → "JA", "Jess" → "J" — the avatar's initials. */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // The fallback is the default name's own initial, so a blank name and the
  // default one never disagree about what the avatar says.
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
    || DEFAULT_DRIVER_NAME[0]!.toUpperCase();
}
