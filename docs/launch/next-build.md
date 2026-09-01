# The next build — what goes in it

Written 1 September 2026, at the owner's request, after publishing the Mint fix
to production.

Everything on this list is a **native** change, which means it cannot reach a
phone over the air. An over-the-air update carries the app's JavaScript and its
pictures; anything that changes the app's own machinery needs a fresh binary
from Apple. That is why these are batched rather than done one at a time — each
build costs a review cycle, so they travel together.

Owner's own timing, 29.08: **"we'll do the build sometime next week."**

---

## Before anything is built

### The App Group (owner-side, ~2 minutes, free)

The widgets need a shared cupboard that the app writes into and the widget reads
out of. Apple calls it an App Group and it has to be registered by hand.

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**
2. **Switch the dropdown at the top right from "App IDs" to "App Groups"** —
   this is the step that trips people up. Registering it under App IDs is a
   different thing and will not work.
3. Register `group.com.driftlore.CruiseFM`. If it says the name is taken, check
   the App Groups list first — it may already be there from an earlier attempt,
   in which case nothing needs registering.
4. Description field: anything readable. **"Cruise FM widget data"** is fine —
   it is a private label only visible in the developer portal.
5. Then open the app ID `com.driftlore.CruiseFM` → **App Groups** → tick it → Save.

**If this is skipped the build still succeeds and the widgets still install** —
they simply say "Open the app to get started" for ever, with no error anywhere.
That is the failure to watch for, and it is silent.

---

## In the build

### 1. iPad — the app fills the screen

Right now Cruise FM runs on an iPad in a small phone-shaped box in the middle of
the screen. One line of configuration (`supportsTablet`) makes it fill the
display properly.

This is genuinely cheap — no new code, no new drawing — because every screen in
the app already lays itself out from the window's real size, which is what the
landscape work built. What it needs afterwards is **looking at on a real iPad**,
because "fills the screen" and "looks right filling the screen" are different
claims, and Apple wants iPad screenshots on the listing before it will show the
app as an iPad app.

An iPad tester has already asked for this.

### 2. Widgets — the four that are written and waiting

The Swift is finished and sitting in the repo, deliberately switched off. Four
of them: **Start Drive**, **On Air Now** and **Your Streak** on the home screen,
and **On Air** on the lock screen.

Turning them on is four lines of configuration, all listed in
`docs/launch/widgets-setup.md` — follow that file rather than this one when the
build is actually being cut, it has the exact steps and the traps.

**The honest limit, already settled and worth not re-litigating:** a home screen
widget cannot spin a record. Apple only lets a widget redraw every 15–60 minutes
and the only thing allowed to move on its own is countdown text. That is true of
every app, not just ours. What *does* change through the day is the On Air tile,
because it reads the real broadcast schedule — so it genuinely says something
different at breakfast and at midnight without ever animating.

### 3. Apple Music repeat and shuffle — already written, waiting on a binary

Ethan reported that repeat lit up but did not repeat. The fix was committed on
26 August (`665d30c`) and is half-shipped: the JavaScript side is already live
and harmless, but the Swift side — which is the half that actually tells the
Music app to repeat — needs a build.

Nothing to do at build time beyond cutting it. Afterwards: press repeat twice on
a real phone and check the song actually repeats.

### 4. The rating prompt becomes Apple's own

The app currently sends people out to the App Store to leave a review, because
the in-app star prompt needs a native piece we do not have yet. Swapping it is
small, and it matters: a prompt that appears in place gets answered far more
often than one that throws you into another app. The rules about *when* to ask
(earned, once, never mid-drive) do not change — only where the tap goes.

### 5. Store listing — the rewrite that has been sitting ready

`docs/launch/store-listing-next-build.md` has the full proposal. In short:

- **Name:** `Cruise FM: Music Visualizer` — the current name says nothing about
  what the app does, and the name is the single strongest thing Apple searches.
- **Subtitle:** `Vinyl, cassette & retro drive`
- **Keywords:** rewritten around what people actually type.
- **Screenshots:** new captions, and the first three matter most because that is
  all anyone sees in search results.
- **iPad screenshots:** required once iPad support is on.

A new name and subtitle can only go out attached to a new version, which is why
it belongs in this batch.

### 6. Not in this build, on purpose

- **The app preview video.** The full plan and a shot list are written up in
  `store-listing-next-build.md`. It is genuinely worth doing — a moving app sells
  a visual app far better than stills — but it is an afternoon's work of its own
  and the owner has parked it.
- **The Live Activity.** This is the lock-screen banner during a drive, and it is
  the one that would also put Cruise FM on a car's CarPlay dashboard for free.
  It is the biggest single thing left on the widget list and it deserves its own
  round rather than being rushed in alongside four others.

---

## When the build is cut

1. **Bump `version` and `runtimeVersion` together** in `app.json`. This is not
   optional when native code changes: it is the only thing stopping an
   over-the-air update landing on a binary that cannot run it.
2. Add the App Group entitlement to `scripts/preflight-allow.json` **knowingly**
   — that list is the record of what Apple's side is expected to carry, so it
   moves only when the real capability has.
3. Run `node scripts/preflight.mjs` and read every line.
4. Build on the **testflight** profile for the owner's phone, production for the
   store. A production-profile build must never be installed from TestFlight onto
   the testing phone — that quietly moves the phone off the preview channel and
   it stops receiving updates.
5. **Open the build on a real phone before it goes anywhere near Apple.** Build
   25 crashed 40 milliseconds into launch over a native module mismatch that no
   check in this repo could see. A launch is the only proof.
6. A finished build is **not** a submitted build. Run the workflow's `diagnose`
   mode afterwards and read the "submitted to App Store Connect" line before
   telling anyone it is with Apple.
