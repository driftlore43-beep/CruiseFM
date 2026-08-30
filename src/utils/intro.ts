import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * HAS THIS PERSON BEEN TOLD WHAT THE APP IS?
 *
 * Deliberately "seen", not "first launch" — those are different questions and
 * only one of them is useful here.
 *
 * A listener in Belgium installed the app successfully on 29.08 and then
 * asked, in as many words, "not so clear what your app is supposed to do on
 * top of Apple Music?" He is the second person to reach the app and not
 * immediately get the idea. Nothing between the platform question and the
 * home page ever explains the premise, so that is not a him problem.
 *
 * The owner asked for it to reach people who ALREADY have the app as well as
 * new installs, which is exactly why this is a flag rather than an install
 * check: everyone starts without the key, so the update carries the
 * explanation to the existing audience once, and to every new install and
 * redownload after that. Once dismissed it never returns.
 */
const KEY = 'cruisefm_intro_seen';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Storage unreadable: claim it HAS been seen. Failing this way round
    // means the worst case is somebody misses an explainer, rather than
    // being shown the same sheet on every single launch with no way to
    // make it stop.
    return true;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do — it reappears next launch, which is survivable.
  }
}
