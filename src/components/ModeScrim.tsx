import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import type { Station } from '@/constants/stations';

/**
 * The shading a mode lays over its station photograph.
 *
 * ONE COMPONENT BECAUSE THIS HAS DRIFTED THREE TIMES, AND EACH ROUND FOUND
 * ONLY SOME OF IT. 03.08 eased the stops and recorded "only Equalizer and
 * Vinyl carry one" — wrong, CD had one too, and it sat at roughly double the
 * others for a week as the darkest screen in the app. 10.08 created this
 * component to stop that and converted three modes — and missed Cassette,
 * Tuner, Horizon and CircularWave, one of which (Horizon) was EIGHTEEN times
 * heavier at the top than the shared ramp. 02.09 found the rest.
 *
 * THE REASON IT KEPT HIDING IS MECHANICAL RATHER THAN CARELESS: every copy
 * used a slightly different near-black — rgba(2,2,10), rgba(2,3,14),
 * rgba(3,4,16), rgba(2,2,12) — so no search for a colour could find them all,
 * and each round looked for whatever the last one had used.
 * `scripts/test-mode-scrim.mjs` now checks the property instead: a mode that
 * draws a station backdrop takes its shading from here, or is on an allowlist
 * with a stated reason.
 *
 * THE SHAPE IS THE POINT, not the overall amount, and the two ramps no longer
 * share one. A built-in photograph is shot dark on purpose, so it needs almost
 * nothing and keeps the gentle foot-weighted ramp approved on 03.08. A photo
 * of the user's own has no such discipline and needs the shading placed
 * exactly where the words are — see USER_PHOTO below, which is where the
 * reasoning for that lives.
 *
 * A USER'S OWN PHOTO GETS LESS WHERE THE PICTURE IS (owner, 10.08: "it's
 * their personalised image, it should be appreciated a bit more") and MORE
 * where the type is. Those pull opposite ways, which is exactly why both
 * halves are asserted rather than trusted.
 */
/** Built-in stations: the values approved on 03.08. Do not raise these. */
const BUILT_IN = [
  'rgba(2,2,12,0.10)',
  'rgba(2,2,12,0.06)',
  'rgba(2,2,12,0.18)',
  'rgba(2,2,12,0.32)',
  'rgba(2,2,12,0.46)',
] as const;
const BUILT_IN_AT = [0, 0.4, 0.65, 0.85, 1] as const;

/**
 * A photo of the user's own: the picture opens right up in the middle, and the
 * shading goes where the words are instead of over everything.
 *
 * THREE ZONES, AND THE MIDDLE ONE IS THE POINT. A mode puts white type in two
 * places and nowhere else — the header (mode label, "YOU'RE LISTENING TO", the
 * station's name) across y 0.06-0.13, and the song title, seek bar and
 * transport across y 0.727-0.936. Measured in all eight modes rather than
 * assumed; they agree to within a percent, which is what lets one ramp serve
 * them all. Between those two bands there is nothing but the deck's own object
 * and the photograph, so that stretch can be left almost clear.
 *
 * THE OLD RAMP WAS THE RIGHT IDEA MEASURED IN THE WRONG PLACE. It gathered
 * from 0.65 downward and reached 0.40 only at the very bottom edge — but the
 * song title starts at 0.727, where the ramp had only reached about 0.15. On a
 * bright photo that left white type at roughly 2.5:1, and the header, with a
 * top stop of 0.10, sat at 1.87:1 — genuinely unreadable. Both had been that
 * way in Vinyl, Equalizer and CD since this component was written on 10.08.
 * Nobody saw it because the ten built-in photographs are dark and measure
 * 18-20:1 there; a bright picture is something only a user can supply.
 *
 * SIZED AGAINST THE WORST PHOTO THERE IS, not against the one that was
 * reported: a pure white frame needs 0.467 behind white type to clear 4.5:1,
 * so both bands sit above that. Checked across five extremes — a lime panel,
 * pure white, bright sky, sand, snow glare.
 *
 * THE SHADING BELOW AND ABOVE IS WHAT BUYS THE OPENNESS BETWEEN, so they move
 * together or not at all. Raising the middle stops to "brighten it" without
 * touching the ends just makes the words unreadable again, which is the exact
 * fault this shape was built to fix.
 */
const USER_PHOTO = [
  'rgba(2,2,12,0.52)',
  'rgba(2,2,12,0.50)',
  'rgba(2,2,12,0.03)',
  'rgba(2,2,12,0.08)',
  'rgba(2,2,12,0.50)',
  'rgba(2,2,12,0.58)',
] as const;
const USER_PHOTO_AT = [0, 0.16, 0.32, 0.58, 0.72, 1] as const;

/** Where a mode puts white type, as fractions of the screen — measured in all
 *  eight, not assumed. The user-photo ramp is shaped around these two bands
 *  and the open stretch between them; if a deck's furniture ever moves, this
 *  is the number that moves with it. */
export const TYPE_BANDS = {
  header: { top: 0.06, bottom: 0.13 },
  foot: { top: 0.727, bottom: 0.936 },
  /** Between them: the object and the photograph, and nothing to protect.
   *  It stops well short of the foot band because the ramp has to START
   *  rising before the type reaches it — a scrim that arrives exactly where
   *  the words begin is a hard edge across the screen, which is the one thing
   *  every light and shade layer in this app has eventually been reported
   *  for. The 0.56-0.72 stretch is that transition, and it is a real cost
   *  paid for a soft one. */
  picture: { top: 0.34, bottom: 0.56 },
} as const;

export function ModeScrim({ station }: { station: Station }) {
  // A file path means a user photo; the built-ins are bundled assets, so
  // numbers. Same free discrimination StationBackdrop uses.
  const userPhoto = typeof station.image === 'string';
  return (
    <LinearGradient
      colors={[...(userPhoto ? USER_PHOTO : BUILT_IN)]}
      locations={[...(userPhoto ? USER_PHOTO_AT : BUILT_IN_AT)]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
