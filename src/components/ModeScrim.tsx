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
 * A USER'S OWN PHOTO GETS LESS DARKENING THAN A BUILT-IN WHERE THE PICTURE
 * IS, and as of 09.09 less at the type as well — the owner picked the
 * whole-frame lift (option 2) for bright AND dark photos after seeing them
 * side by side. The built-in ramp is untouched.
 */
/**
 * Built-in stations. The picture and the foot are the values approved on
 * 03.08 — DO NOT RAISE THOSE. The header band is new (08.09) and the reason
 * is measured below.
 *
 * "THE TEN BUILT-INS ARE SHOT DARK" WAS TRUE OF SEVEN OF THEM. That sentence
 * is in this file's own note above and in the 02.09 log, and it is what
 * justified leaving this ramp at a top stop of 0.10 while the user-photo ramp
 * got a real header band. Measured across all ten backdrops at the header
 * band, white type sat at:
 *
 *     after-midnight 20.8   downtown 19.6   night-run 18.9   rain-drive 17.4
 *     tunnel 14.2           cars-coffee 8.7   sunset 4.2
 *     coastal 2.7           mountain 2.7      daylight 1.9
 *
 * Three fail and one is marginal. Confirmed on real screenshots rather than
 * on the assets alone: CD on Coastal measured 2.45:1 and Equalizer on
 * Mountain Pass 2.23:1 — and both have read that way since this component
 * was written, so it is long-standing rather than a regression.
 *
 * CASSETTE ON DAYLIGHT IS THE ONE THAT DID REGRESS, and it was this file that
 * did it. 02.09 removed Cassette's private top vignette on the reasoning that
 * "ModeScrim covers that band for every mode now" — true of the user-photo
 * ramp, false of this one. Measured on the same shot before and after:
 * 3.82:1 -> 1.39:1. The vignette had been the only thing holding that header
 * up, in the one mode that had one.
 *
 * SIZED AGAINST THE BRIGHTEST PART OF THE BAND, not its average: Daylight
 * needs 0.525 there, and a pure white frame needs 0.5405 (see the note on
 * USER_PHOTO). 0.55 covers both. It costs the seven dark stations nothing
 * measurable — after-midnight moves 20.82 -> 20.75 — and it lands on the top
 * 15% of the frame, which carries the mode label and the station's name and
 * none of the object.
 */
const BUILT_IN = [
  'rgba(2,2,12,0.55)',
  'rgba(2,2,12,0.54)',
  'rgba(2,2,12,0.06)',
  'rgba(2,2,12,0.06)',
  'rgba(2,2,12,0.18)',
  'rgba(2,2,12,0.32)',
  'rgba(2,2,12,0.46)',
] as const;
/** The header plateau ends at 0.15 and is back to the approved openness by
 *  0.31, which is before the picture band opens at 0.34. The 0.15-0.31
 *  transition is the same gradient the user-photo ramp uses (0.16-0.32) and
 *  is there for the same reason: a scrim that stops where the words stop is a
 *  hard edge across the screen, which is the one thing every light and shade
 *  layer in this app has eventually been reported for. */
const BUILT_IN_AT = [0, 0.15, 0.31, 0.4, 0.65, 0.85, 1] as const;

/**
 * A photo of the user's own.
 *
 * THREE ZONES STILL — a mode puts white type in two places and nowhere else
 * (header y 0.06-0.13, song / seek / transport y 0.727-0.936, measured in
 * all eight). The picture lives between them.
 *
 * 09.09 THE OWNER PICKED THE WHOLE-FRAME LIFT, ON BRIGHT PHOTOS AND DARK
 * ONES. The comparison sheet showed today's look against (1) open the
 * picture, keep the word bands and (2) lift the whole frame. She chose 2
 * for both. So this ramp is lighter at the TYPE as well as in the middle
 * (0.57/0.60 -> 0.38/0.40) and the extra flat wash in StationBackdrop is
 * gone. A pure white frame will no longer clear 4.5:1 behind the words;
 * that floor still sizes the ten built-ins, which are ours to shoot dark.
 * Do not put the 0.54 bands back on a user photo to "fix contrast" without
 * asking — that is the darkness she just rejected.
 *
 * THE SHAPE IS STILL SHADE THE WORDS, OPEN THE PICTURE. The ends moved
 * together with the middle so it does not collapse into an even wash.
 */
const USER_PHOTO = [
  'rgba(2,2,12,0.38)',
  'rgba(2,2,12,0.36)',
  'rgba(2,2,12,0.00)',
  'rgba(2,2,12,0.02)',
  'rgba(2,2,12,0.36)',
  'rgba(2,2,12,0.40)',
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
