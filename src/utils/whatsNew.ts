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
  /**
   * Set when the note announces something only a NEW BINARY has.
   *
   * THIS CARD SHIPS OVER THE AIR AND THE THING IT ANNOUNCES MAY NOT. An update
   * carries JS and assets onto a binary that is already installed, and the
   * runtime is deliberately held back so the App Store build keeps receiving
   * them — which is exactly the arrangement that would let this card tell
   * somebody on the old binary to go and look at a widget they do not have.
   * That is the one thing the card may never do (see `body`'s own test).
   *
   * A VERSION NUMBER CANNOT ANSWER THIS. `Constants.expoConfig.version` is the
   * version in the BUNDLE, so a phone running the store binary reports the
   * version of whatever update it last pulled — 1.4.0 — while its widgets do
   * not exist. The capability itself is the only honest test, which is why
   * this is a flag checked against `widgetsAvailable()` at the call site
   * rather than a `minVersion` string.
   */
  needsWidgets?: boolean;
  /**
   * Show this note to a BRAND-NEW INSTALL as well.
   *
   * The default below is silence, and for an ordinary note that is right: a
   * person who installed the app an hour ago has no "before" to compare
   * against, so telling them the green is brighter is noise.
   *
   * A NOTE ABOUT A WHOLE FEATURE IS THE EXCEPTION, and the widgets are the
   * case that proves it — someone installing today gets a binary that has
   * them and would otherwise never be told they exist, which is the opposite
   * of what a what's-new card is for. The App Store shows its own What's New
   * to people who have never had the app for the same reason.
   *
   * Set it only when the note would still be worth reading if the reader had
   * never used an earlier version.
   */
  alsoForNewInstalls?: boolean;
};

/** What the phone can actually do, for a note that depends on it. */
export type NoteCaps = { hasWidgets: boolean };

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
  id: '2026-09-13-widgets',
  title: 'Cruise FM on your Home Screen',
  body: 'Press and hold your Home Screen to add a widget — what’s on air, the last song you played, or a one-tap way straight into a station.',
  needsWidgets: true,
  alsoForNewInstalls: true,
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
 * UNLESS THE NOTE SAYS `alsoForNewInstalls`, which the widgets note does. A
 * note about a feature is worth reading with no "before" at all, and holding
 * it back would leave a fresh install with widgets it was never told about.
 *
 * `introSeen` is passed in rather than read here so the two sheets cannot
 * disagree about who is new — the welcome card owns that question.
 */
export async function noteToShow(introSeen: boolean, caps: NoteCaps): Promise<ReleaseNote | null> {
  if (!CURRENT_NOTE) return null;
  // NOTHING IS WRITTEN DOWN IN THIS BRANCH, deliberately: a phone that cannot
  // do the thing yet has not "seen" the note, so when it gets the build that
  // can, the note is still waiting for it.
  if (CURRENT_NOTE.needsWidgets && !caps.hasWidgets) return null;
  try {
    const seen = await AsyncStorage.getItem(KEY);
    if (seen === CURRENT_NOTE.id) return null;

    // Never seen ANY note. Two different people land here: a brand-new
    // install, and someone who has been using the app since before this
    // feature existed. By default only the second is told anything, and
    // having seen the welcome explainer is what tells them apart — unless the
    // note is worth reading with no "before" at all, which is what
    // `alsoForNewInstalls` declares.
    if (seen === null && !introSeen && !CURRENT_NOTE.alsoForNewInstalls) {
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
