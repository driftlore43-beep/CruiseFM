# Cruise FM — Known Issues, Failed Approaches, and Traps

**Part 1 re-audited 2026-11-10 at commit `b3edd34`**, every item checked against
the code rather than against the previous version of this file. Parts 2 and 3
are findings rather than status, so they are left as written and added to.

Three kinds of thing live here:

1. **Open problems** — real, unfixed, each verified today
2. **Settled dead ends** — tried, failed, and must not be retried
3. **Recurring traps** — mistakes this project has made more than once

---

## PART 1 — OPEN PROBLEMS

Six items closed since the 05.09 audit; they are listed in §1.10 so nobody
re-opens them. What follows is what is genuinely still true.

### 1.1 The iPhone Duo is a screen shape this app has never been handed

**Status: open, and it cannot be closed from here.** Apple's first foldable went
on sale **23.10.2026** — 7.6in inner screen, 5.4in outer, iOS 27.

**The app BEHAVES correctly on one already.** The 07.10 round split the two
questions that one function had been answering at once: `isWide` still measures
the window (so an unfolded Duo correctly gets the centred reading column), while
`isTabletDevice()` asks iOS's own idiom, which answers `.phone` on a foldable
however big it opens — so the driving question is still asked and its drives are
still **counted** as drives. That shipped over the air on 08.10 and is on every
public phone.

**What is untested is how it LOOKS**, and there are two specific risks:

- **The inner screen is nearly square.** App Store Connect lists its screenshot
  sizes as 2034x1398 / 2853x2007, i.e. about **1.45:1** — far nearer the iPad's
  4:3 than a phone's 19.5:9. Every deck sizes its hero as
  `min(a share of width, a share of height, a ceiling)`, tuned against those two
  shapes, so the likely outcome is an iPad-ish layout rather than the 13.09 fault
  where the height term binds and the object sits marooned. **That narrows the
  risk and does not close it.**
- **The widget tiles get sizes nobody has drawn, on two screens.** The outer
  5.4in is very likely the narrowest window this app has ever been handed, and
  26.09 measured the big CD window as **1pt over** on the smallest current
  iPhone. The last fortnight's rounds made the CD window, the ticket stub and
  the Mode tile scale with their tile rather than carry fixed numbers, which was
  lucky timing; what is left is to check nothing still adds to a fixed total.

Nobody here has a Duo, a Mac or a simulator. **Duo screenshots are optional
until April 2027**, so nothing is blocked. The order is: see it, fix what the
square screen breaks, then photograph it — a screenshot taken before anyone has
run it on one would be inventing the claim.

### 1.2 Two dead routes still ship

`src/app/explore.tsx` (an unmodified Expo template `TabTwoScreen`) and
`src/app/visuals.tsx` are **unreachable** — nothing links to either (verified by
grep today). They are also the last real reason `react-native-reanimated` is
imported at all, alongside `components/animated-icon.tsx`,
`components/animated-icon.web.tsx` and `components/ui/collapsible.tsx` — all
five confirmed as the only importers.

Harmless but they bloat the bundle. See `TODO.md` §5.

### 1.3 The mirror ball is the app's one performance cost

~3125 SVG paths across six stacked layers. Measured in a browser: **43 fps**
with 4.1% jank, against 59–60 fps everywhere else, and **zero long tasks** —
so what remains is drawing, not JavaScript.

On a phone that is react-native-svg's native drawing rather than Chromium's, so
**it may not reproduce**. Check on a device before spending anything. If it
does, `ROWS`/`COLS` in `MirrorBallFlipbook.tsx` is the knob.

### 1.4 `expo-dev-client` is in a store binary

Still in `package.json` (`~56.0.20`). It adds `NSLocalNetworkUsageDescription`
to the Info.plist. It shipped in build 23, which Apple **approved**, so it is
not a blocker — but a dev client has no business in a store build. Allowlisted
in `preflight-allow.json` with that reasoning. Drop it at a quiet moment, never
mid-release.

### 1.5 `NSPhotoLibraryUsageDescription` may be unnecessary

PHPicker on modern iOS runs out of process and probably needs no read
permission. Kept deliberately: a missing string means a crash the first time
someone taps "Add a photo" **plus another build cycle**, while a needless one
costs a line on the listing that a visible button explains. If a build is ever
confirmed to pick a photo without it, removing it is a one-line change.

### 1.6 The five contrast flags must be RE-MEASURED, never inherited

`scripts/test-contrast.mjs` flags five lines on the Stations hero. They sit on a
station **photograph**, which every hero lays in as an absolutely-positioned
**sibling** the probe's ancestor walk cannot see — so it reports the page's
paper instead and the flags are false positives.

**But the hero is whoever is genuinely on air at the moment of the run**, so the
photograph behind those five lines differs between sweeps, and a real 2.3:1
fault was once found on this very page. Measure from the rendered pixels (the
darker 60% of each glyph box, so the white type is excluded, with each line's own
alpha composited over what is actually behind it) rather than carrying the last
sweep's verdict forward. Recent readings, all clear against a 4.5 bar:

| Sweep | On air | Worst of the five |
|---|---|---|
| 01.11 | Sunset AM (4.2 brightness — the hard one) | 5.66:1 |
| 28.09 | Coastal FM | 5.70:1 |
| 24.09 | Mountain Pass (the brightest photograph in the set) | 5.66:1 |

### 1.7 `ball-touch` must be run ALONE

Not a fault in the app and no longer a fault in the instrument — the 28.09
rebuild replaced a screenshot diff of the ball's box (which also caught glitter,
fireflies and light beams, each on its own clock) with a reading of the
flipbook's own six cross-faded frames, whose opacities always sum to exactly 1.
Nothing else on screen contributes to that vector, so there is no noise to
out-shout.

**It still needs running on its own.** On 18.09 it read *below* its own noise
band purely because it was the fourth harness in a batch — a scripted drag under
load delivers fewer moves, so a weak reading is evidence about the machine before
it is evidence about the app. The bands from the rebuild: idle ~18–21, held-still
**0**, moving ~7.5–9.7, with `hands-over` and `tracks-finger` both true.

### 1.8 The weekly lag Routine's prompt names a dead branch

`trig_011Pjg2StJ2NSB1xf9pkPjJC` tells its session to work on
`claude/cruise-fm-v4wk5f`, and `main` became canonical on 12.09. That branch's
tip is `6ed6cfe` (13.09) and is **not** an ancestor of main — the two histories
are divergent, 731 commits one way and 51 the other — so the last production
publish is not reachable from it and `production-lag.mjs` either names a pile of
irrelevant commits or exits 2 because the commit is missing.

Either way the Routine is designed to **say nothing on exit 0**, so **a check
that always reports healthy and a check that is dead look identical from
outside.** It is the owner's Routine and a stored prompt is hers to approve, so
it is flagged rather than edited (`TODO.md` §2). **Until then, read `last_run`
rather than trusting its silence.**

### 1.9 Technical debt, catalogued

| Item | Where | Note |
|---|---|---|
| Dead routes | `app/explore.tsx`, `app/visuals.tsx` | §1.2 |
| Template components | `animated-icon*.tsx`, `ui/collapsible.tsx`, `themed-*.tsx`, `web-badge.tsx` | Expo scaffold, all still present |
| Local var named `spotify` | Every mode | Historic; it is really the switchboard. Renaming is pure churn |
| Three copies of the clock | `useTrackClock`, `VinylMode`, `CassetteMode` | Vinyl and Cassette predate the shared one. **They must be kept in step** — the coast-cap bug had to be fixed in all three, and Cassette had never had the bound at all |
| Tuner ignores `needsOffAirAsk` | `TunerMode.tsx` | Tuning to an off-air station bypasses the ask. Deliberate — a question at the wheel is worse than the inconsistency |
| Tuner snap re-renders ~1000 SVG nodes/frame | `TunerMode.tsx` | `TunerReadout` builds a new `toFixed(2)` string each frame, defeating `React.memo`. Real, but the largest and riskiest of that family |
| `assets/images/intro/` | — | Orphaned layer-generation scripts |
| `useSpotifyPlayback` single-blip adopt | `utils/useSpotifyPlayback.ts` | Apple's copy got a two-in-a-row rule; Spotify's `idleStreakRef` covers only the `idle` probe. Not fixed deliberately — nobody has reported it on Spotify, Spotify is no longer offered to new listeners, and inferring scope cost a round once already |
| The rating card still leaves the app | `components/RateCard.tsx` | `Linking.openURL(REVIEW_URL)`. Apple's in-app StoreKit prompt needs a native module, so it waits for a build. The rules in `rateApp.ts` do not change — only where the tap goes |

### 1.10 Closed since the last audit — do not re-open

| Was | Closed by |
|---|---|
| **The medium widget showed no text on build 39 — not diagnosed** | **Diagnosed 09.09 and confirmed on a phone.** `.aspectRatio(contentMode: .fill)` reports the *enlarged* size as its own layout size, so `.clipped()` trimmed nothing, the stack grew past the tile, WidgetKit centred it and the text rows fell outside. The station photographs are portrait, which is why the record survived and the words did not. Fixed via `cruiseBackdrop()`; the owner's build-44 screenshot shows all four lines |
| **The iPad layout is a stretched phone, home page the bad one** | **10.09.** `pageColumn` (`maxWidth: PAGE_MAX_W` 720, centred) on all four tab pages plus a matching cap on the tab bar — verified today, all four use it. A phone can never reach the cap, so nothing on iPhone moved |
| **The ball-touch swipe check is permanently marginal** | **28.09.** Instrument replaced; see §1.7 for what to do instead |
| **`reelTo` is dead code in `TunerMode.tsx`** | Gone — zero occurrences in `src/` today |
| **The whole widget extension has never run on a phone** | Builds 70/71/72. Shipped, released in 1.4.3, and pinnable to a station |
| **Apple Music repeat/shuffle fix waiting on a binary** | **23.09**, proven on a real phone by a tester's own screenshot: MediaPlayer 1 → 3 on both surfaces. Spotify's half was proven the same way on 23.09 |

---

## PART 2 — SETTLED DEAD ENDS (do not retry)

### 2.1 Spotify will not give a development-tier app a playlist's contents

**Measured on a real drive, with an instrument, on two owner-made playlists:**

```
/me                      200
/me/playlists            200
/playlists/{id}          200
/playlists/{id}/tracks   403 Forbidden
```

Granted scopes were complete. **Three confident diagnoses were wrong before
this** — missing scope (the token had it), an editorial playlist (it was hers),
the wrong endpoint (`/playlists/{id}` returns 200 and its embedded first page
came back empty).

**What ships instead:** the player's **queue** (`/me/player/queue`), which is
player *state* rather than playlist *content* and rides
`user-read-playback-state`. The sheet says plainly that Spotify will not share
the full playlist.

> **Also**: any Spotify read returning full track objects **needs a `fields`
> projection**, not for tidiness but because `available_markets` (~180 country
> codes per track *and* per album) makes a 100-song playlist arrive as
> megabytes and blow a 12 s timeout.

### 2.2 There is no beat map on either platform

Spotify's `/audio-features` and `/audio-analysis` return **403** for this app —
restricted to apps registered before Nov 2024. Tested on a real drive, 09.08.
No scope, account or reconnection changes it. **Apple Music publishes no
equivalent at all.**

Remaining routes, ranked honestly:

- **The microphone** is the only thing giving both the right tempo *and* the
  right phase. Built 20.07, removed 22.07: over Bluetooth in a car it picks up
  road noise, and on iOS the recorder contends with Spotify for the audio
  session. A narrow opt-in return is defensible; it is native, so it batches
  with a build.
- **A public BPM lookup** ships OTA and gets tempo right but **not where the
  beat falls**. "Nearly right" reads worse than plainly decorative, and it adds
  a third party plus a privacy disclosure.

The owner chose to leave the haze at its steady ~100 BPM swell, which is gated
on real playback and makes no claim about the song. **Do not re-propose this.**

### 2.3 A Home Screen widget cannot spin a record

iOS budgets a widget to a handful of redraws a day and the only thing allowed
to animate on its own is countdown-style text. True of every app.

Asked twice (an iPad tester; then the owner about MD Vinyl's apparently
spinning widget). Two explanations fit WidgetKit's rules, and **only one is
copyable**:

1. an illusion built from the same infrequent-refresh budget everyone gets, or
2. a **Live Activity** funded by the app **actually playing the audio itself**,
   which buys legitimate background time.

Cruise FM deliberately does not play the audio, and claiming background audio
is exactly what got build 7 rejected. **If MD Vinyl's trick is (2) it is not
available to us without becoming a different app.**

### 2.4 The mirror ball's tiles cannot actually rotate in React Native

A tile's screen x is `R·cos(b)·sin(λ)`, so the transform needed depends on
**latitude as well as longitude** — one transform per column cannot serve the
rows in it.

**Measured** with a least-squares affine fit per column over a full turn: worst
error **89 px on a 170 px radius**, and it does **not** improve with more
columns (48/96/160 all ≈88 px), because the error is driven by latitude spread.
Every column also passes through the centre line each turn, where the required
scale goes to infinity.

Rejected on the renders, with reasons:
- per-tile animated views — needs ~1200 of them, and RN has no `preserve-3d`
- true 3D per tile — mathematically right, same view-count problem
- per-column affine — the 89 px above
- smoothing the fills so only seams move — becomes a wireframe globe

**What works** is `MirrorBallFlipbook.tsx`: six pre-built frames spanning
exactly one tile-width of rotation, cross-faded on the native driver. The grid
is regular in longitude, so rotating by one tile maps the set back onto itself
and the loop is seamless.

### 2.5 Atmosphere must govern the haze only

The owner reported something still pulsing with Atmosphere off. That was read as
"off should mean a still room", and the Mirror Ball's whole room — beams,
glitter, fireflies, dust, bloom — plus the drifting notes in six modes were
gated on the setting.

It **measured beautifully** (38.76% of the room changing → 0.00%) and was the
wrong thing to build. Her correction:

> "I wanted to keep the stars and the light beams even when the atmosphere was
> off… I just wanted the atmosphere/smoke off."

All of it was reverted. **`AmbientGlow` is the only reader of `atmosphere`, and
must stay so. Never gate the room layers on it — the beams breathing IS the
look.**

> **The lesson, which is bigger than the feature:** a report of "X happens when
> it shouldn't" says what is *wrong*, not what is *wanted*. Measurement
> confirms you built the thing right; it says nothing about whether it was the
> right thing.

### 2.6 A drive recap was proposed and declined

The owner: *"some people might even use the app casually in their room for fun
— like myself."*

A recap makes a **claim** — "your drive, 34 minutes" — and the app cannot know a
drive happened. `DriveCheckCard` exists precisely because it is guessing. What
shipped instead is `DriveStub`, framed around the **session**: a station, a
mode, a stretch of listening, some songs. No map, no distance, no route.

**Do not re-pitch a drive-framed recap.**

> The wider signal, worth more than the feature: the owner — the person most
> invested in this being a driving app — uses it stationary. That is a real
> question mark over the driving frame, and it can only be answered by asking
> testers, because there is no analytics.

### 2.7 A skin system was rejected

Several looks per mode is eight modes × N and an ongoing content commitment,
against the project's own "fewer and better" rule. The Vinyl's Classic look is
a deliberate single exception, scoped by the owner to that mode alone.

### 2.8 Approaches rejected on the render (mirror ball / CD)

- A hard specular ellipse — reads as a painted blob on the ball
- A stroked rim at the silhouette — reads as a drawn outline; use a radial
  gradient fading inward
- Four-point stars / lens-flare rings — read as stickers
- An angular ramp of ~48 thin wedges for the CD — neighbouring steps band
- Pie-wedge light on the vinyl — two straight radial edges, glaring on black
- A symmetric bevel inset — reads as smaller squares, not a bevel

### 2.9 A widget cannot usefully refresh itself without opening the app

A tester asked for it, and the button half is real: since iOS 17 a widget may
hold a `Button(intent:)`, Apple's own staff answer is explicit that an intent
compiled only into the extension runs only there, and `AppIntents` is already
imported in this target for the Look pickers. **The data is the problem.**

Every tile draws from the snapshot the APP writes into the App Group. An intent
running in the extension can re-read that file — and the file has not changed,
so the tile redraws exactly as it was. The extension links neither MusicKit nor
MediaPlayer, holds no Spotify token (those live in the app's AsyncStorage, not
the shared container), and media-library authorisation is per bundle id while
the extension has its own.

**Apple names a route and it is the one this app has already been rejected
over**: make the intent an `AudioIntent`, which runs in the app's process in the
background. That is an audio-playback declaration on an app that deliberately
does not play audio — build 7's **2.5.4** rejection wearing a third hat. Do not
reach for it without reading that history. `ForegroundContinuableIntent` is the
one worth examining, since it makes no audio claim.

So what is honestly available today is a tap that refreshes from a file that
has not changed, or a tap that opens the app — which is what every tile already
does. **And none of it changes §2.3**: a widget still cannot animate itself
between taps, whatever the button does.

---

## PART 3 — RECURRING TRAPS

### 3.1 A check that quietly matches nothing reads as a pass

**The single most repeated failure in this project.** Every instance:

| What | How it failed |
|---|---|
| The runtime guard | Compared `b["channel"]` and `b["runtimeVersion"]`, which `eas build:list --json` does not return (they are nested `updateChannel{}`/`runtime{}`). Both `None` on every build → empty candidate list → `exit 0`. **Printed reassurance from 30.07 to 01.09.** |
| The vignette rule | Matched two near-black stops, but a vignette is `['rgba(0,0,0,0.5)','transparent']` and `transparent` is not an `rgba()` — parsed as a one-element list nothing could match |
| The time-format scan | An edit deleted the loop, so `offenders` was never filled |
| Twelve dial checks | Appended **after** `process.exit()` |
| The widget-bundle test | Looked for `DeckStyle` in the same file as `DeckLook`; they live in different files, so the Deck was silently skipped |
| `test-skip-clock.mjs` v1 | `resetTrack()` contains none of `progress`/`setValue`, so it could not catch the bug it was written for |
| The dismiss harness | Tested scroll by *adding* 200 to `scrollTop`; CD parks at exactly max scroll, so a healthy page read as frozen |
| The toggle-tint test | A regex that matched no palettes would pass every case vacuously |

**The rule: reintroduce the bug and watch the check go red before believing
it.** Several suites now assert they read a plausible number of files first.

### 3.2 An Expo plugin can inject native keys nobody wrote

- `expo-audio` added `UIBackgroundModes: [audio]` → **Apple rejected build 7**
  (Guideline 2.5.4). The package had been kept only to protect a fingerprint.
- `expo-notifications` adds `aps-environment` automatically → **build 24
  failed to sign**. Fixed by `plugins/withoutPushEntitlement.js`.
- `expo-media-library`'s `photosPermission: false` **deleted** the
  `NSPhotoLibraryUsageDescription` that `expo-image-picker` sets.

> **Always read the RESOLVED config**, never `app.json`:
> `npx expo config --type introspect --json`. This is what `preflight.mjs`
> does.

### 3.3 Stale closures in once-built refs

`PanResponder.create` wrapped in `useRef` captures the **first** render.
Instances: the photo cropper clamping against a 1×1 image; a mode's `winH`
after rotation; `requestWake`'s timeout re-arming the rest countdown with a
stale `wakeChrome`.

> **Anything deferred past the current tick must read its state through a
> ref.**

### 3.4 Only one active poll, and every timer must be AppState-gated

A backgrounded app making a request every 5 s gets **SIGKILLed** by iOS — four
crash reports, `bug_type 309`, `EXC_CRASH / SIGKILL`, codes `0x0`. **Sentry can
never see these**: there is no signal to catch and no chance to flush. Do not
chase Sentry when the reports say 309.

Every repeating timer uses `useAppActive()`. `rAF` loops are fine — iOS does not
run them in the background.

> A `309` with `procRole: "Non UI"` is ordinary reclamation. One with
> `procRole: "Foreground"` is worth chasing.

### 3.5 Two `Modal`s will not stack on iOS

It presents nothing and eats every touch — the app looks frozen. Bitten by
`PreviewGate` (24.07), the mood sheet (03.08) and the auto-dim catch layer
(03.08). See `PROJECT_ARCHITECTURE.md` §4.1(b).

### 3.6 A React Native `transform` array replaces, it does not compose

A later `transform` in a style **array** replaces an earlier one. Adding a focus
scale alongside `deckScene` would have silently undocked the ball in landscape.
Use a nested wrapper.

### 3.7 `isLandscape ? <animated style> : null` never resets

A native-driven transform lives on the **native** view; dropping it from the
style prop sends nothing, so the view **keeps the last transform it was given**
— the record stayed shrunk and shifted in portrait, forever. Flatten the
interpolation to identity instead. **Never write that ternary.**

### 3.8 Never size an `<Svg>` in percentages

A percentage canvas is resolved natively and does **not** re-resolve when the
window changes shape, so after a rotation the drawing is still at the old
proportions inside a re-laid-out box — and the box clips, producing a straight
horizontal cut. This is the "atmosphere cut-off" bug. Give a real pixel
width/height and draw through a `0 0 100 100` viewBox.

### 3.9 A colour prop loses to a style

`react-native-vector-icons` builds its style as `[{fontSize, color}, style]` —
**the style wins**. A per-platform colour passed as a prop was silently
discarded twice. Colour for these icons must come from the style.

### 3.10 The web build cannot test everything, and lies specifically

| Thing | Why web is useless |
|---|---|
| `KeyboardAvoidingView` | `Platform.OS === 'ios' ? 'padding' : undefined` — **inert on web** |
| `flexShrink` on a ScrollView | RNW resolves flex through CSS; the RN bug does not reproduce |
| `onTextLayout` | **Not implemented in react-native-web at all** — no marquee has ever panned in a browser |
| `evt.target.measure()` | Not answered — rotational scrub angles are nonsense on web |
| Haptics | `expo-haptics` is a native no-op |
| Gesture termination | RN Web does not model the tree-based responder handoff |
| Fonts | A different face renders; weight and spacing are checkable, letterforms are not |

Several fixes are therefore shipped **on the mechanism plus a device report**,
not on a passing test. That is stated where it applies.

### 3.11 Compression is where requests die

A tester's message was summarised to "two bugs and one feature request" — his
last paragraph asked for options on the Vinyl's look, and it was **lost**.
Worse, the word *look* was then reused for a different request in the summary
given to the owner.

> **When compressing someone's feedback, check the original for anything the
> summary dropped before reporting what was and was not done.**

### 3.12 A mechanism that reads plausibly is not the cause

Repeated instances:

- The EU availability problem was diagnosed as the DSA trader declaration —
  Apple's own help page said the opposite. **The real cause was that Sweden
  simply was not ticked** in Pricing and Availability. The wrong advice would
  have had the owner publish her home address.
- The Tuner freeze was diagnosed via the Spotify notice stack — the reporter
  was on **Apple Music**, where that branch returns early. The fix was right;
  the explanation was not.
- The blurry-photo fix reasoned that a small file enlarged *is* a blur. It is
  not — enlarging preserves hard pixel edges. And the correction was applied
  **upside down** (`× 3` where `÷ 3` was needed).

> **When a fix based on a mechanism does not move the symptom, stop reasoning
> about mechanisms and go read the actual output.**

### 3.13 Measurement pitfalls that produced confident wrong answers

- **Aliasing**: 24 meridians sampled at 1/12-turn steps land on identical
  positions and score moving structure as static. Sample a window that is not a
  multiple of the period.
- **Locating an object by a property the background shares**: hunting the
  record's centre by peak saturation found the *road* in the backdrop.
- **Measuring the wrong layer**: a "does it spin?" composite diff happily
  reported 36/255 while the ball looked frozen, because the travelling *light*
  dominates that number. Use per-frame vertical-edge maps: `min` over time =
  pinned, `std` over time = travelling.
- **Sampling near text instead of behind it**: every scrim in this app is a
  gradient, so a strip below a glyph is a different colour from behind it.
- **Diffing PNG bytes**: two similar images compress to entirely different byte
  streams. Decode to pixels.
- **`boundingBox()` is viewport-relative**: clicking an off-screen element hits
  whatever is at those coordinates and the step passes having hit nothing.
- **Phantom text**: expo-router keeps every tab mounted, and the home page now
  parks a mode picker and a mood picker off-screen — so the same words exist
  two or three times in the document. Filter on **reachability**
  (`pointer-events`), not just the viewport. `scripts/harness/visible.mjs`
  does this.

### 3.14 A stub must implement the rule, not a convenient constant

`isInFront` stubbed as a constant `true` meant `AppState` 'background' never
registered, the resume was never marked, and the test measured a settle window
that had never started. Similarly, a fixture that sets a throw-flag at
construction may walk a completely different code path than intended.

### 3.15 Drive timing harnesses by counted reads, not wall-clock sleeps

Sleeping fixed milliseconds against a real `setInterval` means some windows
catch two polls and some catch one, purely on timer phase — tests flap on
unchanged code. Count **actual reads** instead.

### 3.16 Assorted one-liners worth keeping

- **"artist" contains "art"** — check object *keys*, never a substring of JSON.
- **`Animated.loop` on a sawtooth runs once and parks.** A value that relies on
  the loop's reset needs its restart written out explicitly.
- **Duplicate SVG gradient ids across roots render one blank.** Namespace them
  off `useId()`.
- **`zIndex` beats source order** — a later sibling with no `zIndex` loses to an
  earlier one that has it.
- **`SafeAreaView` does not work inside a `Modal`** — it measures zero. Read
  `useSafeAreaInsets()` and floor it: `Math.max(insets.top, 20)`.
- **An absolutely-positioned sheet cannot live inside the page's ScrollView** —
  it is placed against the scroll *content*.
- **`cruisefm_platform` is stored as a bare string, not JSON.** Seeding it
  JSON-encoded silently falls through to the Spotify path.
- **The drive log is append-ordered**, so storage is oldest-first and
  `getFinishedDrives` reverses it. Seed data must match how the app writes.
- **A failed EAS build still burns a build number** (`appVersionSource: remote`
  increments server-side first).
- **`npm install <anything>` can move unrelated packages.** Run preflight after
  every install, not only before a release.
- **EUIPO and UK IPO search results cannot be shared as links.** Screenshot
  them.

---

### 3.17 A specification is a claim about a slot; the slot is the fact

**Twice in four days, in two different App Store Connect fields, Apple's own
documentation was quoted correctly and was wrong about what Apple's own upload
form accepts.**

| What the docs said | What the slot did |
|---|---|
| The 21:9 product-page header's *"Supported extensions"* are *".jpeg, .jpg, or .png"* (re-read after the rejection; it still says exactly that) | Refused the JPEG — *"file has an invalid extension"*. PNG only |
| Nothing — the iPhone screenshot slots had been 1284x2778 for a year | *"File dimensions are invalid"* on all ten. Apple had consolidated its iPhone slots into one **Dynamic Island (medium display)** tab accepting 2556x1179 / 1179x2556 / 2622x1206 / **1206x2622** |

Both were settled in **seconds by one upload**, after work that had been
reasoned carefully from a spec. **Nothing in this repo could have caught
either** — there is no way to ask App Store Connect what it wants without
pressing upload.

The general form is this file's most expensive lesson in a new place: when a
fix reasoned from a mechanism does not survive contact, stop reasoning about
the mechanism and go read what the thing actually said. See §3.12.

### 3.18 A harness cannot answer a question about a size it does not draw

Four rounds in the `docs/design/` family hit this, and each one would have
answered the owner's question **confidently and wrongly**:

- `cd_widget.py`'s `tile()` was still drawing **build 47** — case inset 8,
  radius 16, a 124pt disc sidestepped 6pt right — every one of which had moved
  since. A harness drawing the build before last cannot answer a question about
  the tile on a phone.
- `cd_window_tall.py` and `ticket_tall.py` each drew **only** `.l` (338x354) —
  the one large-tile size where the shipped arithmetic happens to be exact — so
  neither could ever have shown the fault being asked about, which only appears
  on the other four real tile sizes.
- `ticket_tall.py` had not **parsed** since `e2a4de2`: a botched edit corrupted
  a string literal and the file was a syntax error for a day with nobody
  re-running it.
- `cd_window_tall.py` was under-drawing type by **30%** (11/12/15pt rendered as
  15/17/17 at 2px per point), which is exactly the quantity the round was about.

**Before a harness can answer a question about a size, check that it draws that
size — and that it still runs.** Write every dimension in points through one
`P()` helper so a number in the harness can be compared with the Swift by eye,
make the harness **fail** on an overflow rather than clipping it silently, and
lead the sheet with a "what shipped" tile so the two can be compared at a
glance.

And the mirror image: **a harness that draws what the code does NOT do is just
as wrong.** The tonearm sheet offset the counterweight's ribs in *screen* x
while the Swift offsets them along the barrel, and a painted-deck sheet laid in
a brushed grain the Swift has no cheap way to draw. Seven fidelity faults have
been caught in that folder; all of them by porting or by looking.
