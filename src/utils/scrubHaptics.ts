import * as Haptics from 'expo-haptics';

/**
 * The grain you feel when you turn the record or the disc.
 *
 * WHAT WAS THERE BEFORE: one Light tap every five *wound seconds*, which at the
 * modes' own 360° = 5s convention is exactly one tap per complete revolution.
 * A single bump per full turn of the record is a metronome, not a texture — it
 * tells you the gesture registered and nothing else.
 *
 * THE MODEL: a detent is a property of how far the OBJECT has turned, so the
 * spacing here is in degrees rather than in seconds of song. That is not a
 * detail — it means the tick RATE follows drag speed for free, with no speed
 * maths anywhere: turn it twice as fast and twice as many detents pass under
 * your thumb, exactly as a notched wheel behaves.
 *
 * THE REAL CONSTRAINT IS THE RATE CEILING, not the spacing. iOS cannot fire
 * distinct impacts much above ~18 a second; past that they queue and blur into
 * mush, which feels worse than fewer would. So beyond a moderate drag speed
 * this is rate-limited rather than distance-limited — which is also physically
 * right, since a real surface texture stops being individual bumps and becomes
 * a buzz once you move quickly.
 *
 * Sound was considered for this and rejected on 10.08: on a real deck scrubbing
 * bends the MUSIC, and we cannot touch the audio stream (Spotify and Apple Music
 * own it — we only tell them where to seek). A scratch noise over music playing
 * on unbent would read as fake. Haptics have none of that problem, cost no
 * dependency, work with the phone on silent, and cannot startle anyone in a car.
 */

/** 48 detents per revolution. Fine enough to read as grain rather than notches. */
const DEG_PER_TICK = 7.5;
/** ~18 a second. Above this, impacts stop being separable. */
const MIN_GAP_MS = 55;
/**
 * Below this, each detent is meant to be separately felt, so it gets the crisp
 * style. Set from the measured tick rate rather than by feel: at 48 detents a
 * revolution this caps Rigid at about 7 a second. The first cut used 90°/s,
 * which let Rigid run at 12 a second — fast enough that the clicks stopped
 * being countable and turned into a buzz, which is the one thing the crisp
 * style is not for.
 */
const SLOW_DEG_PER_S = 50;

export type ScrubHaptics = {
  /** Feed every gesture frame with how far the object turned, in degrees. */
  turn: (deltaDeg: number) => void;
  /** Call on grant and on release, so a new gesture starts on a crisp detent. */
  reset: () => void;
  /** The moment the deck is taken hold of. A single firmer impact under the
   *  detents — picking something up feels different from dragging it, and
   *  without it the grain fades in from nothing and the gesture has no
   *  beginning. */
  grab: () => void;
  /** And the moment it is let go. Lighter than the grab: putting something
   *  down should not feel like picking it up. */
  release: () => void;
};

export function createScrubHaptics(): ScrubHaptics {
  let accumDeg = 0;
  let lastAt = 0;

  return {
    turn(deltaDeg: number) {
      accumDeg += Math.abs(deltaDeg);
      if (accumDeg < DEG_PER_TICK) return;

      const now = Date.now();
      const since = lastAt ? now - lastAt : Infinity;
      // Rate-gated: deliberately do NOT clear accumDeg here. The travel keeps
      // banking, so the next tick lands as soon as the gate opens instead of
      // the movement being thrown away.
      if (since < MIN_GAP_MS) return;

      const degPerSec = Number.isFinite(since) ? (accumDeg / since) * 1000 : 0;
      accumDeg = 0;
      lastAt = now;

      // Slow and deliberate gets a crisp, separable detent; a sweep gets the
      // lighter rasp, because Rigid at eighteen a second is unpleasant.
      // (Soft was tried for the fast case — too weak to read through a rate
      // limit, it just felt like the haptics had stopped.)
      Haptics.impactAsync(
        degPerSec < SLOW_DEG_PER_S
          ? Haptics.ImpactFeedbackStyle.Rigid
          : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {});
    },

    reset() {
      accumDeg = 0;
      lastAt = 0;
    },

    grab() {
      // Medium, so it reads through whatever detents follow immediately. It
      // also RESETS the rate gate, or a grab landing inside the 55ms window
      // would swallow the first detent of the new gesture.
      accumDeg = 0;
      lastAt = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },

    release() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
  };
}
