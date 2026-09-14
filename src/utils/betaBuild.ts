/**
 * IS THIS A BETA BUILD — the owner's phone and the TestFlight testers — or the
 * app a stranger downloaded from the App Store?
 *
 * WHY IT EXISTS. Spotify caps a development-tier app at FIVE authorised
 * accounts, and extension requests have been organisations-only since May 2025
 * (an established business with 250k+ monthly users), so the offer was pulled
 * from the platform picker on 01.09: for essentially everyone it was a promise
 * the app could not keep. But it is a promise the app CAN keep for the handful
 * of people on that list — which is the owner and her testers — and taking the
 * option away from them too was collateral damage (owner, 14.09: "the Spotify
 * option is missing for my devices... could there be a way to open the access
 * to only the TestFlight users").
 *
 * HOW IT KNOWS, and it is a fact the build already carries rather than
 * anything new: every build is cut on a profile that stamps it with an update
 * CHANNEL. `eas.json` sends the `testflight` and `preview` profiles to the
 * channel `preview`, and only the `production` profile to `production` — and
 * `production` is the one that goes to the store. So the channel already
 * separates exactly the two audiences, and expo-updates reports it.
 *
 * IT FAILS CLOSED, DELIBERATELY. No updates module, no channel, an unreadable
 * value — all return false, so the public build can never show a beta-only
 * option by accident. The cost of being wrong in that direction is a stranger
 * being offered something that will refuse them, which is the exact fault
 * removing Spotify was meant to fix.
 *
 * `__DEV__` counts as beta so the option is visible while developing and in
 * the web build, where there is no channel at all.
 */
export function isBetaBuild(): boolean {
  if (__DEV__) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates');
    const channel = typeof Updates?.channel === 'string' ? Updates.channel : '';
    return channel !== '' && channel !== 'production';
  } catch {
    // web / a build without the updates module — treat as public.
    return false;
  }
}
