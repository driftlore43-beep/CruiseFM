# Cruise FM — Known Issues, Failed Approaches, and Traps

**Audited 2026-09-05 at commit `84e3cab`.**

Three kinds of thing live here:

1. **Open problems** — real, unfixed
2. **Settled dead ends** — tried, failed, and must not be retried
3. **Recurring traps** — mistakes this project has made more than once

---

## PART 1 — OPEN PROBLEMS

### 1.1 The medium widget showed no text at all on build 39 — NOT DIAGNOSED

**Status: open, cannot be reproduced from here.**

The owner photographed her Home Screen on build 39. The Deck widget drew the
record and the station photo and **nothing else** — no "ON THE DECK", no
station name, no dial, no "LAST PLAYED". Verified by zooming into the actual
pixels, not guessed from a thumbnail.

Build 39 was cut 2 September and carries `498c2ef`, whose medium layout is
`HStack(RecordView, VStack(dial, name, tagline, lastPlayed))` — i.e. it has
**always** drawn text beside the record. **The build-age gap does not explain
it.** Swift cannot be compiled in this environment and no device log was
available.

**Do not invent a cause.** Check it as its own item once a new build is on a
real phone. If it persists on the new Road/Label code, it is a real bug in how
the widget reads its data — most likely the snapshot decode (see §3.1).

### 1.2 Two dead routes still ship

`src/app/explore.tsx` (an unmodified Expo template `TabTwoScreen`) and
`src/app/visuals.tsx` are **unreachable** — nothing links to either (verified by
grep). They are also the last real reason `react-native-reanimated` is
imported at all, alongside `components/animated-icon.tsx` and
`components/ui/collapsible.tsx`.

Harmless but they bloat the bundle. See `TODO.md`.

### 1.3 The mirror ball is the app's one performance cost

~3125 SVG paths across six stacked layers. Measured in a browser: **43 fps**
with 4.1% jank, against 59–60 fps everywhere else, and **zero long tasks** —
so what remains is drawing, not JavaScript.

On a phone that is react-native-svg's native drawing rather than Chromium's, so
**it may not reproduce**. Check on a device before spending anything. If it
does, `ROWS`/`COLS` in `MirrorBallFlipbook.tsx` is the knob.

### 1.4 `expo-dev-client` is in a store binary

It adds `NSLocalNetworkUsageDescription` to the Info.plist. It shipped in build
23, which Apple **approved**, so it is not a blocker — but a dev client has no
business in a store build. Allowlisted in `preflight-allow.json` with that
reasoning. Drop it at a quiet moment, never mid-release.

### 1.5 `NSPhotoLibraryUsageDescription` may be unnecessary

PHPicker on modern iOS runs out of process and probably needs no read
permission. Kept deliberately: a missing string means a crash the first time
someone taps "Add a photo" **plus another build cycle**, while a needless one
costs a line on the listing that a visible button explains. If a 1.3.0+ build
proves the picker works without it, removing it is a one-line change.

### 1.6 The ball-touch harness's swipe check is permanently marginal

`scripts/harness/ball-touch.mjs` reports a signal-to-noise ratio of 1.1–1.4×
because the room has glitter, dust and rays all on their own clocks. It has
reported `tracks-finger: false` on a build measured working three ways.

**Do not tune the ball to satisfy it.** Measure the transform, the pill and the
seek instead. Its two real guards (tap toggles play, pull-down dismisses) are
sound.

### 1.7 Five permanent false positives in the contrast sweep

`scripts/test-contrast.mjs` flags five lines on the Stations hero at ~1.1:1.
They sit on a station **photograph**, which is an absolutely-positioned sibling
the ancestor walk cannot see. Verified by sampling the real pixels behind the
glyphs: 5.4:1, 5.9:1, 7.9:1, 11.6:1, 19.8:1. **All pass.** Do not "fix" them.

### 1.8 Technical debt, catalogued

| Item | Where | Note |
|---|---|---|
| Dead routes | `app/explore.tsx`, `app/visuals.tsx` | §1.2 |
| Template components | `animated-icon*.tsx`, `ui/collapsible.tsx`, `themed-*.tsx`, `web-badge.tsx` | Expo scaffold |
| Local var named `spotify` | Every mode | Historic; it is really the switchboard. Renaming is pure churn |
| Three copies of the clock | `useTrackClock`, `VinylMode`, `CassetteMode` | Vinyl and Cassette predate the shared one. **They must be kept in step** — the coast-cap bug had to be fixed in all three |
| `reelTo` | `TunerMode.tsx` | Dead code |
| Tuner ignores `needsOffAirAsk` | `TunerMode.tsx` | Tuning to an off-air station bypasses the ask. Deliberate for now — a question at the wheel is worse |
| Tuner snap re-renders ~1000 SVG nodes/frame | `TunerMode.tsx` | `TunerReadout` builds a new `toFixed(2)` string each frame, defeating `React.memo`. Real, but the largest and riskiest of that family |
| `assets/images/intro/` | — | Orphaned layer-generation scripts |
| `useSpotifyPlayback` single-blip adopt | `utils/useSpotifyPlayback.ts` | Apple's copy got a two-in-a-row rule; Spotify's covers only the `idle` probe. Not fixed deliberately — nobody has reported it on Spotify, and inferring scope cost a round once already |

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
