# Next session — the agenda

Written 1 September 2026 at the end of a long build session, so nothing has to
be reconstructed from memory. Read this first.

---

## The one thing that unblocks everything

**Send the error from build 37.**

`expo.dev/accounts/driftlore/projects/CruiseFM/builds/f0aa9c83-01d5-42d1-ad00-873481c275f2`

Find **"Configure Xcode project"** in the list of phases — the red one — click
to expand, screenshot the red lines.

**Why this is first:** three builds (35, 36, 37) died at that same phase, and
Expo's own summary says only *"Unknown error. See logs of the Configure Xcode
project build phase for more information."* That phase runs cleanly on this
machine, so the reason exists only in Expo's log. Everything below is either
blocked on it or is better done after it.

**Do not let anyone theorise past this.** Two theories were already spent on
1 September — the Apple Team ID (a real problem, genuinely fixed, but not the
whole story) and an EAS outage (wrong: build 37 ran after the recovery and
failed identically). A third guess costs another 20-minute round trip. The log
is one screenshot away and names the cause.

---

## Then: finish the 1.4.0 build

Everything is staged and committed. Once the log says what is wrong and it is
fixed, one button re-runs it.

What 1.4.0 carries:

| | |
|---|---|
| **Widgets** | Four of them — Start Drive, On Air Now, Your Streak, plus a Lock Screen one |
| **iPad** | Fills the screen properly instead of a phone-shaped box |
| **Apple Music repeat/shuffle** | Ethan's bug. The fix has been written since 26 August and only ever needed a binary |
| **Native rating prompt** | Optional; the in-place star popup instead of being thrown to the App Store |

**After it installs, check in this order** (from `widgets-setup.md`):

1. Open the app once — nothing is written to the widgets until it runs.
2. Long-press the Home Screen → **+** → search "Cruise FM" → four should appear.
3. Add **On Air Now**. It should name whatever the Stations page says is on air.
   If it says "Open the app to get started", that is the App Group, not the code.
4. Tap it — should land in a drive on that station.
5. Press **repeat twice** on a real song and confirm it actually repeats. That
   is the whole test for Ethan's fix.

---

## Then: the new previews and the animating clip

Both of these are wanted and both are easier once 1.4.0 is on the phone, which
is why they sit here rather than earlier.

The full plan already exists in **`docs/launch/store-listing-next-build.md`** —
proposed captions, the shot list, and the technical specification. Read that
rather than re-deciding it.

### New screenshots

The current set is stale in ways worth fixing: it does not show widgets, does
not show iPad, and its captions were written for an older line-up.

**iPad screenshots become REQUIRED** the moment iPad support ships — Apple will
not list the app as an iPad app without them. Easy to be blindsided by.

### The animating clip (App Preview video)

Apple allows up to three, 15–30 seconds each, and they autoplay in search
results — which is the single biggest untapped lever on the listing for an app
whose whole point is that it moves.

**Two routes, and the second is better:**

1. **A draft from the web build.** Frames can be captured here and assembled
   into a video without a phone. Honest limitation: the web build renders
   slightly differently from iOS, so it is good for deciding the *shape* of the
   cut, not for shipping.
2. **Recorded on the phone** — iOS Screen Recording, no app or cost involved.
   This is what should actually ship, and it is far better than route 1 because
   it is genuinely the app.

**Do it while testing 1.4.0.** The recordings needed are the same screens being
checked anyway, so one pass covers both jobs.

**One decision to make BEFORE recording**, and it is not a detail: whether any
real song title and artwork appear. `store-listing-next-build.md` covers this —
the safe route is the one every existing screenshot already uses, which is to
record with no music service connected so each mode shows the station's own
tagline instead of somebody's copyrighted track.

### The listing rewrite

Name, subtitle and keywords were decided and never applied. A new name can
**only** ship attached to a new version, so it goes out with 1.4.0 or waits for
1.5.0. Proposed: **`Cruise FM: Music Visualizer`**, subtitle
**`Vinyl, cassette & retro drive`**.

---

## State of play, so nothing is re-litigated

**Done and shipped today** (already on the App Store, at 1.3.0):
- The what's-new card
- The brighter Mint (Ethan's request)
- The first-run explainer

**Apple-side chores, all permanently done** — none of these come back:
- App Group registered
- App Group ticked on `com.driftlore.CruiseFM`
- App Group ticked on `com.driftlore.CruiseFM.widget` (a separate app ID, which
  does not exist until a build creates it)
- Widget distribution certificate + provisioning profile
- Apple Team ID recorded in `app.json`

**Build numbers 33–37 are spent.** A failed build still burns one. Entirely
harmless — they only ever have to increase — so the next is 38.

**Nothing is at risk.** The live app is 1.3.1 and untouched. All of this work
sits on the preview channel and in the repo.
