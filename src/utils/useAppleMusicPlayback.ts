import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isInFront } from '@/utils/useAppActive';

import { useActivityPing, useAdoptPlayState } from '@/context/NowPlayingContext';

import { lookupAppleArtwork } from './appleArtwork';
import {
  getAppleLibraryArtwork,
  appleMusicAvailable,
  appleNext,
  applePause,
  applePlay,
  applePrev,
  appleSeekTo,
  appleSetRepeat,
  appleSetShuffle,
  getAppleNowPlaying,
  recoverApplePlayback,
  isAppleMusicConnected,
} from './appleMusic';
import {
  acceptReported, backButtonAction, TOGGLE_GUARD_MS,
  type NowPlaying, type PendingToggle, type RepeatMode,
} from './useSpotifyPlayback';

/**
 * Live Apple Music playback bridge — the peer of useSpotifyPlayback, and the
 * second seat behind the useMusicPlayback switchboard.
 *
 * Deliberately the same shape as the Spotify hook so the switchboard can
 * return either one and no caller can tell the difference.
 *
 * Simpler than Spotify's in two ways, both because MusicKit plays on THIS
 * phone rather than commanding a remote device: there is no waking a dozing
 * speaker (so no wake nudge, no start-result reporting), and no playlist
 * "context" to chase — the queue is ours.
 */
/** How long to give the system player before deciding the resume did not
 *  take. Long enough that a slow start is not mistaken for a failure, short
 *  enough that a driver does not sit looking at a dead button. */
const RESUME_CHECK_MS = 1600;

/**
 * How long after returning to the app a "not playing" answer counts for
 * nothing at all.
 *
 * MEASURED FROM THE OWNER'S OWN CLIP (26.08), not guessed: the app returned
 * at 4.9s, went to paused at 5.8s, the disc was completely still from 7.2s
 * to 8.4s, and everything recovered at 8.5s — so the system player was
 * answering wrongly for roughly 2.7 seconds after the resume. 3.5s covers
 * that with a margin without being long enough to make a real pause feel
 * slow, and a pause the DRIVER makes in this window is unaffected anyway
 * because that runs through lastControlRef instead.
 */
const RESUME_SETTLE_MS = 3500;

/**
 * A second, later look before `verifyResume` gives up on a genuine resume.
 *
 * Ethan, 27.08: "if I am playing music already from Apple Music then after
 * about 1 song the playlist will start from the top but won't play." Before
 * this, `verifyResume` asked ONCE at RESUME_CHECK_MS (1.6s) and, on a single
 * "not playing" answer, called `recoverApplePlayback` — which re-queues the
 * playlist from its first track. But RESUME_SETTLE_MS exists precisely
 * because a single early reading is known to lie: the owner's own clip
 * measured the system player answering "not playing" for up to ~2.7s after
 * a genuine resume. `verifyResume` never got that lesson — a perfectly
 * healthy resume landing inside that window was read as a failure and
 * "recovered" by restarting the playlist from track one, which is exactly
 * the symptom reported. One more look, this far out, before believing it.
 */
const RESUME_RECHECK_MS = 2000; // 1.6s + 2s ≈ 3.6s, just past RESUME_SETTLE_MS

export function useAppleMusicPlayback(visible: boolean, opts?: { pollMs?: number }) {
  const [connected, setConnected] = useState(false);
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [contextName, setContextName] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  // Read by the back button, which has to know where the song is right now.
  const trackRef = useRef<NowPlaying | null>(null);
  trackRef.current = track;
  const artCacheRef = useRef<{ key: string | null; url: string | null; at: number }>({ key: null, url: null, at: 0 });
  const refreshRef = useRef<() => void>(() => {});
  const lastControlRef = useRef(0);

  /**
   * HELD AGAINST A STALE READING, EXACTLY LIKE SPOTIFY'S (18.08's rule,
   * imported rather than copied). Before 26.08 there was nothing here at
   * all — `shuffle`/`repeat` below just flipped this state and left it,
   * because `currentEntry` never reported the real setting back. So the
   * button's own highlight was the whole of the evidence, and it could
   * never notice a command that silently failed to reach the Music app —
   * "the buttons highlight, but doesn't repeat" (owner, 26.08).
   */
  const pendingShuffleRef = useRef<PendingToggle<boolean>>(null);
  const pendingRepeatRef = useRef<PendingToggle<RepeatMode>>(null);
  /** Consecutive "not playing" readings. Two are needed before the drive
   *  believes the music stopped — see the note at the adopt call. */
  const pausedStreakRef = useRef(0);
  /** When the app last came back to the front — see RESUME_SETTLE_MS. Starts
   *  at 0 so a drive opened normally is never treated as "settling". */
  const resumedAtRef = useRef(0);
  const settled = <T,>(ref: { current: PendingToggle<T> }, reported: T): boolean => {
    const ok = acceptReported(ref.current, reported, Date.now());
    if (ok) ref.current = null;
    return ok;
  };
  const adoptPlay = useAdoptPlayState();
  const adoptRef = useRef(adoptPlay);
  adoptRef.current = adoptPlay;

  /**
   * The poll is owned by a ref so the AppState listener can stop and restart
   * it. This is a CRASH FIX, not a battery tweak: iOS SIGKILLs a backgrounded
   * app that keeps a timer running (bug_type 309, invisible to Sentry), which
   * is exactly what the Spotify poll did before it was gated. Any repeating
   * timer added here must obey the same rule.
   */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(() => refreshRef.current(), opts?.pollMs ?? 5000);
  };

  useEffect(() => {
    if (!visible || !appleMusicAvailable()) return;
    cancelledRef.current = false;

    (async () => {
      const conn = await isAppleMusicConnected();
      if (cancelledRef.current) return;
      setConnected(conn);
      if (!conn) return;

      /**
       * Artwork is chased SEPARATELY from the song, and never awaited before
       * the song is published. Both fallbacks can take seconds — a native
       * call with its own race, then a network lookup — and build 21 already
       * proved what happens when artwork sits between the poll and the title:
       * the whole deck reads "no track" for the entire drive.
       *
       * Claimed in the cache BEFORE the work starts so the 5s poll doesn't
       * launch the same chase over and over while the first one is in flight.
       */
      const chaseArtwork = async (artKey: string, title: string, artist: string) => {
        // Local first: it is exact, instant on the next song, and needs no
        // signal. Empty for a streamed library, which is why the catalogue
        // lookup exists behind it.
        let url = await getAppleLibraryArtwork();
        if (!url) url = await lookupAppleArtwork(title, artist);
        if (!url) return;                        // the claim's timestamp reopens the chase
        // The song may have moved on while we were away — patch only if this
        // is still what's playing, or the deck would wear the last cover.
        if (artCacheRef.current.key !== artKey) return;
        artCacheRef.current = { key: artKey, url, at: Date.now() };
        // Deliberately NOT gated on cancelledRef: a completed lookup is valid
        // whatever the screen did while it ran, and dropping it left the
        // claim blocking retries with nothing to show. A state update on a
        // gone instance is a harmless no-op.
        setTrack((t) => (t && t.title === title ? { ...t, albumArt: url } : t));
      };

      const refresh = async () => {
        const entry = await getAppleNowPlaying();
        if (cancelledRef.current) return;
        if (!entry) { setTrack(null); return; }
        // Library tracks usually carry no loadable MusicKit artwork URL —
        // keyed on title AND artist, since two songs can share either one.
        const artKey = `${entry.title}|${entry.artist}`;
        const claimed = artCacheRef.current.key === artKey;
        const art = entry.artworkUrl ?? (claimed ? artCacheRef.current.url : null);
        /**
         * MIRROR REALITY — BUT NEVER PAUSE ON A SINGLE ANSWER.
         *
         * Owner, 26.08: "when i leave the app to go to another app and open
         * back the app the pause button comes on and the disc likes to stop,
         * while the music continues to play. after a few seconds it picks
         * back up."
         *
         * That is this line, before the streak below existed. The poll is
         * STOPPED while backgrounded (the SIGKILL rule), so returning fires
         * an immediate refresh at the exact moment the system player is
         * still spinning its state back up — and its first answer after a
         * resume is routinely a stale `isPlaying: false`. One reading was
         * enough to adopt PAUSED, which stops the disc and flips the button,
         * and the next poll five seconds later put it back. The music never
         * actually stopped; only the app believed it had.
         *
         * Spotify has required TWO idle answers in a row since 10.08 for the
         * same reason — a blip during a handover must not pause a working
         * drive. Apple simply never got the rule. STARTING is still adopted
         * instantly: hearing music and showing paused is the bug, and there
         * is no symmetric risk in believing "it's playing" straight away.
         */
        // ONE VERDICT, USED BY BOTH SURFACES. The transport and the scene read
        // different values (np.playing vs track.isPlaying), and deciding
        // "is this pause real?" separately in two places is how one ends up
        // held while the other freezes — which is the visible half.
        let believedPlaying = entry.isPlaying;
        if (Date.now() - lastControlRef.current > 8000) {
          if (entry.isPlaying) {
            pausedStreakRef.current = 0;
            adoptRef.current(true);
          } else {
            /**
             * AND THE SETTLE WINDOW, WHICH THE SCREEN RECORDING FORCED.
             *
             * The owner's 26.08 clip was measured frame by frame: the app
             * came back at 4.9s, flipped to paused at 5.8s, the disc coasted
             * down and sat DEAD STILL from 7.2s to 8.4s, and it all came
             * back at 8.5s — so the system player was answering "not
             * playing" for the better part of THREE SECONDS after the
             * resume, with the music audibly going the whole time.
             *
             * Two-in-a-row alone does not survive that: the 900ms re-ask
             * would land inside the same bad window, confirm the wrong
             * answer, and show the identical fault half a second later. So
             * for a short window after returning, a "not playing" answer is
             * not evidence AT ALL — that is precisely the period the player
             * is known to be lying — and it is only counted once the phone
             * has had time to settle. Deliberately narrow, and it costs
             * nothing anywhere else: a pause that happens at any other
             * moment still lands on the second answer, about a second.
             *
             * A genuine pause made DURING the window is unaffected, because
             * that goes through lastControlRef above, not through here.
             */
            const settling = Date.now() - resumedAtRef.current < RESUME_SETTLE_MS;
            if (settling) {
              believedPlaying = true;          // not evidence — see above
              setTimeout(() => { if (!cancelledRef.current) refreshRef.current(); }, 900);
            } else {
              pausedStreakRef.current += 1;
              if (pausedStreakRef.current >= 2) {
                adoptRef.current(false);
              } else {
                believedPlaying = true;        // one answer is not enough
                // Confirm QUICKLY rather than waiting out the 5s poll, so a
                // real pause still settles in about a second — the same
                // 900ms re-ask Spotify's copy of this rule uses.
                setTimeout(() => { if (!cancelledRef.current) refreshRef.current(); }, 900);
              }
            }
          }
        }
        setTrack({
          title: entry.title,
          artist: entry.artist,
          albumArt: art,
          durationMs: entry.durationMs,
          progressMs: entry.positionMs,
          syncedAt: Date.now(),
          // THE SAME UNCONFIRMED READING MUST NOT REACH THE SCENE EITHER.
          // Every mode gates its animation on `confirmedPlaying`, which reads
          // `track.isPlaying` — so writing the stale `false` here would stop
          // the disc even while the transport was correctly held. That is the
          // half the owner actually sees: "the disc likes to stop, while the
          // music continues to play".
          isPlaying: believedPlaying,
        });
        if (entry.contextName !== undefined) setContextName(entry.contextName ?? null);
        // The REAL shuffle/repeat state, when this build's bridge reports
        // one (26.08) — `undefined` on an older build, which must leave the
        // optimistic guess exactly alone, not snap it back to 'off'/false.
        // Held against a stale reading the same way Spotify's is: a chase
        // poll landing 220ms after a press still carries the OLD setting.
        if (entry.shuffleOn !== undefined && settled(pendingShuffleRef, entry.shuffleOn)) {
          setShuffleOn(entry.shuffleOn);
        }
        if (entry.repeatMode !== undefined && settled(pendingRepeatRef, entry.repeatMode)) {
          setRepeatMode(entry.repeatMode);
        }
        // A missing cover is re-chased every ~20s, not claimed once forever:
        // a chase can die mid-flight (backgrounded app, dropped signal), and
        // the old one-shot claim left the deck blank for the rest of the
        // song with all three artwork routes healthy.
        const staleMiss = claimed && artCacheRef.current.url == null
          && Date.now() - artCacheRef.current.at > 20000;
        if (!entry.artworkUrl && (!claimed || staleMiss)) {
          artCacheRef.current = { key: artKey, url: null, at: Date.now() };
          chaseArtwork(artKey, entry.title, entry.artist);
        }
      };
      refreshRef.current = refresh;
      refresh();
      if (isInFront(AppState.currentState)) startPoll();
    })();

    return () => {
      cancelledRef.current = true;
      stopPoll();
    };
  }, [visible]);

  // Poll only while the app is in front of the user — see the note above.
  // Returning to the app also re-reads immediately so the title and progress
  // snap into step rather than waiting out the interval.
  useEffect(() => {
    if (!visible || !appleMusicAvailable()) return;
    // Same rule as Spotify's, and for the same reason — see useAppActive.
    let inFront = isInFront(AppState.currentState);
    const sub = AppState.addEventListener('change', (state) => {
      const now = isInFront(state);
      if (!now) { inFront = false; stopPoll(); return; }
      // Also revives a poll that is dead for any other reason — see the note
      // on the Spotify copy of this.
      const wasAway = !inFront;
      inFront = true;
      // COMING BACK STARTS THE COUNT AGAIN. Without this a streak of 1 left
      // over from before the app was backgrounded would let the very first
      // reading on return — the stale one — reach 2 and pause the drive,
      // which is the bug this rule exists to stop, arriving by another door.
      if (wasAway) { pausedStreakRef.current = 0; resumedAtRef.current = Date.now(); }
      if (wasAway || pollRef.current == null) { refreshRef.current(); startPoll(); }
    });
    return () => sub.remove();
  }, [visible]);

  const ping = useActivityPing();
  const after = () => setTimeout(() => refreshRef.current(), 500);

  /**
   * DID THE MUSIC ACTUALLY START? (listener report, 23.08: "after pausing the
   * song through the app it completely freezes trying to play it again… most
   * of the time the music won't play from the app itself and you have to keep
   * going back to Apple Music to play it again.")
   *
   * Every layer of the play path swallows its own failure — the native call is
   * a `try?`, and applePlay catches on this side — so when the system player
   * refuses to resume, nothing anywhere knows. This asks, once, shortly after,
   * and if the music genuinely did not start it puts the queue back and
   * carries on from where the song was. That is exactly what the listener does
   * by hand when he goes back to the Music app.
   *
   * GUARDED so it can never fight the user. It gives up if they touched the
   * transport again in the meantime (a play immediately followed by a pause
   * must stay paused), if the screen has gone, or if the app never queued
   * anything itself — in which case the music belongs to the Music app and
   * taking it over would be worse than the bug.
   */
  const verifyResume = () => {
    /**
     * READ THE STAMP THAT WAS ACTUALLY STORED — never a fresh clock.
     *
     * This said `Date.now()` until 27.08, and the guard below tests
     * `lastControlRef.current !== askedAt`. `play` sets that ref from its
     * own `Date.now()` one statement earlier, so the two agreed only when
     * the millisecond happened not to tick in between — and when it did,
     * the guard fired instantly and the ENTIRE resume check silently did
     * nothing. Non-deterministic by construction: the same press worked or
     * didn't on the same build, which fits "occasionally" in Ethan's
     * reports better than any of the mechanisms above. Caught by a test
     * that flapped between pass and fail on identical code.
     */
    const askedAt = lastControlRef.current;
    const resumeAt = trackRef.current?.progressMs ?? null;
    const check = async (isFinal: boolean) => {
      if (cancelledRef.current) return;
      // Someone pressed something else since — their intent wins.
      if (lastControlRef.current !== askedAt) return;
      // BACKGROUNDED SINCE THE PRESS (Ethan, 25.08: "requests will come in
      // late and reset my playlist if Apple Music is still playing after
      // closing Cruise app"). Nothing here clears `cancelledRef` on a mere
      // background — the sheet/screen is still mounted — so this check kept
      // running unattended after the driver had switched away. The 1.6s
      // window is short, but Apple's own status can genuinely lag behind
      // reality by that much, and this check has no way to tell "really
      // didn't start" from "hasn't told us yet" while nobody is watching to
      // notice a wrong guess. Not our music to second-guess once we're not
      // the thing on screen — if it turns out the song really did stall,
      // the driver presses play again the next time they open the app.
      if (!isInFront(AppState.currentState)) return;
      const entry = await getAppleNowPlaying().catch(() => null);
      if (cancelledRef.current || lastControlRef.current !== askedAt) return;
      if (!isInFront(AppState.currentState)) return;
      if (entry?.isPlaying) return;                 // it started; nothing to do
      if (!isFinal) {
        // ONE READING IS NOT ENOUGH — see RESUME_RECHECK_MS. Give the
        // system player the same room the poll already gives it before
        // believing a resume genuinely failed.
        setTimeout(() => check(true), RESUME_RECHECK_MS);
        return;
      }
      const ok = await recoverApplePlayback(resumeAt);
      if (ok && !cancelledRef.current) after();
    };
    setTimeout(() => check(false), RESUME_CHECK_MS);
  };

  return {
    available: appleMusicAvailable(),
    connected,
    track,
    contextName,
    // Apple's system player exposes no queue-source id — the in-drive song
    // list is Spotify-only for now, and null is how it knows.
    contextUri: null as string | null,
    shuffleOn,
    repeatMode,
    // Controls are optimistic: fire, then re-read so the display catches up.
    // Playback is local, so these land far faster than Spotify's remote calls
    // and need none of its waking machinery.
    play: () => { ping(); lastControlRef.current = Date.now(); applePlay(); after(); verifyResume(); },
    pause: () => { ping(); lastControlRef.current = Date.now(); applePause(); after(); },
    next: () => { ping(); lastControlRef.current = Date.now(); appleNext(); after(); },
    // Restart-then-previous, same rule and same window as Spotify's — see the
    // note on RESTART_WINDOW_MS there.
    prev: () => {
      ping();
      lastControlRef.current = Date.now();
      if (backButtonAction(trackRef.current) === 'restart') { appleSeekTo(0); after(); return; }
      applePrev();
      after();
    },
    // Optimistic, same as Spotify's — and now HELD against the poll rather
    // than trusted forever, via pendingShuffleRef/pendingRepeatRef above.
    shuffle: (state: boolean) => {
      ping();
      setShuffleOn(state);
      pendingShuffleRef.current = { want: state, until: Date.now() + TOGGLE_GUARD_MS };
      appleSetShuffle(state);
      after();
    },
    repeat: (mode: RepeatMode) => {
      ping();
      setRepeatMode(mode);
      pendingRepeatRef.current = { want: mode, until: Date.now() + TOGGLE_GUARD_MS };
      appleSetRepeat(mode);
      after();
    },
  };
}
