import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "CAN WE ALSO HAVE A WHAT'S NEW CARD WHEN THE NEW UPDATE COMES IN?"
 * — owner, 01.09.
 *
 * KEYED ON THE NOTE'S OWN ID, NOT ON THE APP VERSION, and that is the one
 * decision the rest of this file hangs off. Most of what reaches a phone
 * arrives over the air without the version string moving at all — the brighter
 * Mint and the first-run explainer both shipped as 1.3.1, the same number the
 * App Store already had. So a version key would have stayed silent for exactly
 * the releases this card exists to announce. An explicit id fires when the
 * note is written and never by accident.
 *
 * `WHATS_NEW` in notificationCopy.ts is deliberately NOT reused. That one is
 * version-keyed on purpose (a notification interrupts someone, so it is held
 * to "only for a new binary, only for something big"), and this is the quieter
 * surface — a card on the home page that waits to be looked at. Two different
 * bars, so two different lists.
 */

const KEY = 'cruisefm_whats_new_seen';

export type ReleaseNote = {
  /** Never reuse or reorder these. A change of id means "show it again". */
  id: string;
  title: string;
  /** One sentence. If it needs two, it is not one release note. */
  body: string;
};

/**
 * THE NEWEST NOTE, or null for a release with nothing worth saying.
 *
 * NULL IS THE RIGHT DEFAULT AND SHOULD BE THE COMMON CASE. A card that
 * appears for every bug fix teaches people to dismiss it unread, and then it
 * is not available on the day something genuinely matters. The test is
 * whether a person could go and LOOK at the thing: "your own photo behind
 * your own station" passes, "improved reliability" does not.
 */
export const CURRENT_NOTE: ReleaseNote | null = {
  id: '2026-09-01',
  title: 'Brighter greens, and a proper welcome',
  body: 'Mint is the lime it always looked like in the picker, and the app now says what it is when you first open it.',
};

/**
 * Should the card show?
 *
 * THE CLOCK STARTS ITSELF, SILENTLY — the same rule rateApp.ts uses, and for
 * the same reason. Someone who has just installed the app has no "before" to
 * compare against, so "what's new" is meaningless to them; the first time this
 * is consulted on a phone that has never seen a note, it writes the current
 * one down and answers no. They meet the app through the welcome explainer
 * instead, and get the NEXT note like everybody else.
 *
 * `introSeen` is passed in rather than read here so the two sheets cannot
 * disagree about who is new — the welcome card owns that question.
 */
export async function noteToShow(introSeen: boolean): Promise<ReleaseNote | null> {
  if (!CURRENT_NOTE) return null;
  try {
    const seen = await AsyncStorage.getItem(KEY);
    if (seen === CURRENT_NOTE.id) return null;

    // Never seen ANY note. Two different people land here: a brand-new
    // install, and someone who has been using the app since before this
    // feature existed. Only the second should be told anything, and having
    // seen the welcome explainer is what tells them apart.
    if (seen === null && !introSeen) {
      await AsyncStorage.setItem(KEY, CURRENT_NOTE.id);
      return null;
    }
    return CURRENT_NOTE;
  } catch {
    // Storage unreadable: say nothing. Failing quiet means somebody misses a
    // note, which costs nothing; failing loud would show the same card on
    // every launch with no way to stop it.
    return null;
  }
}

export async function markNoteSeen(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // It reappears next launch. Survivable.
  }
}
