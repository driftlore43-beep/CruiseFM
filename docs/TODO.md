# Cruise FM — Remaining Work

**Audited 2026-09-05 at commit `84e3cab`.** Ordered by what blocks what.

Two columns run in parallel throughout: **CODE** (an agent can do it) and
**OWNER** (only Jessica can — Apple's site, App Store Connect, a real phone,
an accountant). The owner-side items are usually the long pole.

---

## 0. IN PROGRESS — pick this up first

**Widget design refinement, mockup stage.** See `CURRENT_STATE.md` §5 for the
full context and the findings already made.

### H — Mirror Ball (`docs/design/v3.py` + `docs/design/ball.py`)

- [ ] Remove the "Garage" text beneath the ball
- [ ] **Smooth the silhouette** — it is currently polygonal because the outline
      is made of quads. The fix is an SVG `<clipPath>` circle in
      `ball_svg()` so the edge is perfectly round whatever the tiling does
- [ ] **Match the app's shading model** (`src/components/MirrorBallFlipbook.tsx`):
  - finer grid — the app uses `ROWS = 23, COLS = 44`; `ball.py` is `17 × 30`
  - **end-weighted scatter** — the app pushes brightness to the ends of its
    range (`sign(roll) · |roll|^0.68 · 4.6`); `ball.py` uses a *uniform*
    `rnd.uniform(-0.13, 0.13)`. The dark-beside-bright checkerboard is what
    sells chrome
  - **two lobes per lamp, kept apart** — a *wide* bright lobe and a *narrow*
    colour lobe. Widening a single tinted lobe turns half the ball one colour,
    which is a coloured sphere rather than a mirrored one
  - a bevel inset on **both** axes (`u0 .08, u1 .92, v0 .07, v1 .93`)
  - **Do NOT raise the ambient floor** — measured, it flattens the ball and
    kills the dark mirrors (>200 share fell 4.1% → 0.6%)
- [ ] Keep the pink/blue/purple party lamps — colour is the **lighting**, the
      material stays neutral chrome. That split is an explicit owner decision

### I — CD

- [ ] **Rainbow to match the reference photo** (the owner's uploaded image, not
      in the repo). A real CD's diffraction radiates as **angular streaks from
      the centre outward** that vary with radius, not flat conic bands. Needs
      radial masking, a silver base, and a strong white specular sweep
- [ ] **Station image less opaque**
- [ ] **The widget's own shape becomes the CD case** — rather than a square case
      inset inside the rounded-square widget, the widget *is* the case: hinge
      spine, corner posts and plastic sheen run to the widget's own edges, with
      the disc inside it

### Then

- [ ] Port every approved mockup change into the Swift
      (`targets/widgets/*.swift`) — **nothing from this round is in Swift yet**
- [ ] Run `node scripts/test-widget-bundle.mjs`, `test-widget-contract.mjs`,
      `test-widget-fonts.mjs`
- [ ] Keep `docs/design/v3.py` in step with the Swift, or the mockup becomes a
      lie about the app (it has been twice)

---

## 1. BLOCKING THE NEXT BUILD

### 1.1 OWNER — the App Group (~2 minutes, free, **silent if skipped**)

Almost certainly already done — `preflight-allow.json` says the owner
registered it — but **verify before building**:

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**
2. **Switch the dropdown from "App IDs" to "App Groups"** ← the step that trips
   people up
3. `group.com.driftlore.CruiseFM` must exist
4. App ID `com.driftlore.CruiseFM` → App Groups → ticked

> **If this is wrong the build still succeeds and the widgets still install** —
> they simply say "Open the app to get started" for ever, with **no error
> anywhere**. That is the failure to watch for.

### 1.2 OWNER — budget a failed build per new Apple-side record

The widget extension is a **second app ID** (`com.driftlore.CruiseFM.widget`)
that does not exist until a build tries to create it. Builds 33–37 each died on
one such record. They are cheap and each names its own fix.

### 1.3 CODE — bump the runtime **in the same commit as a successful build**

`version` is 1.4.0, `runtimeVersion` is held at 1.3.0. Move it **only** once a
1.4.0 build has succeeded. Moving it early stranded every phone once already.

---

## 2. IN THE NEXT BUILD (native — cannot ship over the air)

| # | Item | State |
|---|---|---|
| 1 | **The widget extension** — 10 designs, 7 rows | Written, wired, never run |
| 2 | **iPad full screen** (`supportsTablet: true`) | **Already in `app.json`** — needs looking at on a real iPad, and iPad screenshots become *required* |
| 3 | **Apple Music repeat/shuffle** | Swift committed 26.08 (`665d30c`). Verify by pressing repeat twice on a real song |
| 4 | **Native rating prompt** | **NOT DONE.** `RateCard.tsx` still uses `Linking.openURL(REVIEW_URL)`. Swapping to StoreKit's in-place prompt needs a native piece. The rules in `rateApp.ts` do not change — only where the tap goes |
| 5 | **Store listing rewrite** | Drafted in `docs/launch/store-listing-next-build.md`. A new name/subtitle can only ship attached to a new version |

**Deliberately NOT in this build:** the **Live Activity** (the lock-screen
banner that also lights up CarPlay for free). It is the biggest thing left on
the widget list and deserves its own round. Its open question is recorded in
`AGENTS.md` — the app may not be running when the song changes, and a remote
push needs a server, which contradicts the privacy promise.

---

## 3. BEFORE SUBMITTING (marketing — no build needed)

Both were asked for directly by the owner and are **not** parked:

- [ ] **App Store screenshots.** The current set (`screenshots-appstore/`, built
      by `scripts/marketing/build-slides.mjs`) predates the widget work, the
      light theme, the broadcast schedule and the drive stub. **iPad
      screenshots become REQUIRED** the moment `supportsTablet` ships.
      Re-run `scripts/marketing/tints.py` after **any** screenshot change — the
      surround colour is sampled from the picture, not picked.
- [ ] **The app preview video.** Full plan, shot list and technical spec are
      already in `docs/launch/store-listing-next-build.md` under **"THE APP
      PREVIEW VIDEO — how to actually make it"**. Read that rather than
      re-deriving it. Two recording routes, both free.

---

## 4. THE PAYWALL — decided, sequenced, not built

The owner's position (04.09): **"I wasn't ready to publish to Apple"** and
**"I'll still wait for those users to come in — it's almost been a month since
I launched."** So this is deliberately not urgent.

### 4.1 The grandfathering plan (agreed)

> **Anyone who installed before the paywall keeps everything, free, for ever.
> New installs get the free/premium split.**

- The app **already** stamps every device: `cruise_rate_state.firstSeenAt`
  (`utils/rateApp.ts`) is self-initialising and consulted on every home-page
  visit via `RateCard`. **Nothing needs shipping in advance** — the paywall can
  read that date when it arrives.
- **Honest limitation:** it is on-device. Delete and reinstall and it is gone.
  There is no server and no accounts, and becoming a different kind of app for
  this is not worth it.
- **Cap what they keep, not how many they are:** *"You keep everything Cruise FM
  does today. Anything built from here is part of the paid tier."* That is what
  stops the cohort getting more expensive over time.
- **Trigger:** when the paperwork clears, **or at 500 downloads, whichever comes
  first.** At ~110/month that is ~4 months, which is about when the admin will
  be done anyway.
- **It must be a DATE in code, never "the first 500"** — there is no server, so
  the app genuinely cannot know who the 500th install was. Same rule the
  Founder tier already follows (`utils/founder.ts`).

### 4.2 Things that must NOT vanish when the cap arrives

The free tier caps custom stations at 3. If someone made six while it was free,
**those six must stay — visible, playable, with their photos.** The cap may only
block making a *seventh*. Same for linked playlists. This is the version of
"suddenly I can't access anything" that would actually sting, because it is the
user's own work.

### 4.3 OWNER — the long pole, start early

- [ ] **Apple's Paid Applications Agreement** (Agreements, Tax and Banking).
      Apple pays nothing until it is signed. For an Australian developer this is
      where the ABN and tax questions bite — worth an accountant, not a
      week-of-launch scramble
- [ ] **EU trader declaration** must switch to "I'm a trader" when real charging
      starts, which requires a **public address**. The owner has said not her
      home address, so this needs a decision
- [ ] **Real store products** in App Store Connect (£1.99/mo, £18/yr) and the
      **real RevenueCat platform keys** — `config.ts` holds a **sandbox
      `test_` key** today
- [ ] Only then flip `LAUNCH_FREE = false`

---

## 5. GROWTH WORK (what actually moves downloads)

At ~3–5 downloads/day and ~87 total, the constraint is discovery, not features.

- [ ] **The name.** "Cruise FM" says nothing about what the app does, and the
      name is the strongest thing Apple searches. `Cruise FM: Music Visualizer`
      is drafted. Ships only attached to a new version
- [ ] **Ratings.** The listing has almost none, which to a stranger reads as
      "nobody uses this". The in-place StoreKit prompt (§2.4) gets answered far
      more often than the current one, which throws people out to the App Store
- [ ] **Keywords + first three screenshots** — that is all anyone sees in
      search results
- [ ] **Ask testers where they actually use it** — car, room, both. There is no
      analytics and never will be, so this can only be asked. It bears directly
      on whether the driving frame is right (see `KNOWN_ISSUES.md` §2.6)

---

## 6. TECHNICAL DEBT (safe, low priority)

- [ ] Delete `src/app/explore.tsx` and `src/app/visuals.tsx` (dead routes), then
      the template components that go with them
      (`animated-icon*.tsx`, `ui/collapsible.tsx`, `themed-*.tsx`,
      `web-badge.tsx`) — this is also what would finally remove
      `react-native-reanimated`
- [ ] Drop `expo-dev-client` from a store binary (adds
      `NSLocalNetworkUsageDescription`). **Not mid-release**
- [ ] Delete `reelTo` in `TunerMode.tsx`
- [ ] `assets/images/intro/` is orphaned
- [ ] Consider collapsing Vinyl's and Cassette's private clocks into
      `useTrackClock` — three copies have had to be fixed in lockstep at least
      once
- [ ] Tuner: `TunerReadout` builds a new `toFixed(2)` string each frame,
      defeating `React.memo` (~1000 SVG nodes/frame during the snap).
      **Only if the dial still feels sluggish on a device**

---

## 7. IDEAS RECORDED, NOT SCHEDULED

- **Live Activity → CarPlay.** A Live Activity now appears on the CarPlay
  Dashboard automatically once it exists on iPhone — no separate CarPlay app.
  For a driving app that is the single best-fit surface available.
  **Re-verify at build time**, not from this note
- **Strofi**, the next product — a social driving/route platform. Full thinking
  in `docs/strategy.md`. The wedge is the owner's own idea: **one-time codes
  that share a route privately with the group doing that drive.** It works at
  n=2, which is what kills most community apps. Needs a server — a genuine step
  change from Cruise FM's no-account position
- **A real domain.** Share cards print `cruisefm.netlify.app`. When it changes,
  `INSTALL_HOST` (`ShareCardStyles.tsx`) and `INSTALL_URL` (`ShareCard.tsx`)
  move **together**
- **Trademark.** File **IP Australia** first (AUD $250/class); Paris Convention
  priority carries the EU/UK/US for six months. `docs/brand.md` has the detail.
  **The Australian search has not been run** — that is the gap

---

## 8. RELEASE CHECKLIST (short form)

`docs/launch/pre-submission-checklist.md` is the full version. **Run it.**

1. `node scripts/preflight.mjs` — read **every** line
2. Bump `version` **and** `runtimeVersion` together if native changed
3. Build on the **`testflight`** profile for the phone, **`production`** for the
   store. **Never install a production-profile build on the testing phone**
4. **Open the build on a real phone before it goes near Apple.** Build 25
   crashed 40 ms into launch over a native module mismatch no static check
   could see. A launch is the only proof
5. Move `provenCommit` in `preflight-allow.json` **only after** that launch
6. A finished build is **not** a submitted build — run the workflow's
   `diagnose` mode and read the "submitted to App Store Connect" line
7. While in review: **no production-channel publish** at the runtime that build
   listens on. Preview stays safe
8. After approval and release: check the store page actually loads. An approved,
   released app whose page 404s is set to *removed from sale* under Pricing and
   Availability
