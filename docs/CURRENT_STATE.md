# Cruise FM — Current State

**Snapshot taken 2026-09-05 at commit `84e3cab`**, branch
`claude/cruise-fm-v4wk5f`. Verified against the codebase, the workflow run
history and `scripts/preflight.mjs`, not from memory.

---

## 1. The one-paragraph summary

Cruise FM is **live on the App Store** at version **1.3.1 (build 32)**, shipped
19 August 2026. Since then all work has gone out **over the air** to that same
binary. Version `1.4.0` exists in `app.json` and carries a large batch of
**native** work — the whole widget extension, iPad support — but **no 1.4.0
build has ever succeeded on a phone**, so `runtimeVersion` is deliberately
still `1.3.0`. The immediate work in progress is aesthetic refinement of the
widget designs, still at the mockup stage.

---

## 2. Version and channel state

| | Value | Notes |
|---|---|---|
| `app.json` `version` | **1.4.0** | Apple requires a higher string each submission |
| `app.json` `runtimeVersion` | **1.3.0** | **Deliberately held** — see below |
| Live on the App Store | **1.3.1, build 32** | Submitted + released 19 Aug 2026 |
| Newest build attempted | **39** | testflight profile, FINISHED, **never submitted** |
| `provenCommit` | **`057c023`** | build 28 (1.3.0) — last build opened on a real phone |
| Branch | `claude/cruise-fm-v4wk5f` | All work happens here |

### Why `runtimeVersion` is held at 1.3.0

`runtimeVersion` decides **which installed builds can receive an OTA update**.
It was moved to 1.4.0 in advance of a build; every 1.4.0 build then failed, so
nothing anywhere was listening on 1.4.0 and **every publish reached zero
phones** — including a fix the owner had been told was already on her phone.

The rule now enforced in `scripts/preflight-allow.json` (`runtimeHeldAt`):

> **Bump `runtimeVersion` to match `version` in the same commit that cuts a
> build which SUCCEEDS. Never before one.**

---

## 3. What is where — three different audiences

| Audience | Running | Gets updates how |
|---|---|---|
| **App Store public (~87 downloads)** | build 32 (1.3.1) + production-channel OTA | Manual production publish only |
| **Owner's phone + TestFlight** | newest `testflight`-profile build + preview OTA | **Automatic** on every push |
| **Nobody** | The 1.4.0 native work (widgets, iPad) | Needs a successful build |

### Last production publish

**2026-09-04 14:04 UTC** — update group
`8cc1944d-8835-42c9-8448-09901c02f310`, commit `833731b`, runtime 1.3.0
(an exact match to build 32, so it genuinely reached phones — verified from the
job log's own `✔ Published!` line).

It carried two user-visible fixes:

- the seek bar no longer jumping to 0:00 on every skip
- one shared clock across all eight decks (no more `NaN:NaN`, no negative
  times, consistent padding)

`node scripts/production-lag.mjs` reports **up to date** as of this snapshot.

---

## 4. Health checks — all verified today

```
npx tsc --noEmit                      clean
31 offline suites (scripts/test-*.mjs)  31 passed, 0 failed
node scripts/preflight.mjs            10 passed, 1 warning, 0 failures
git status                            clean, pushed
```

The one preflight **warning** is expected and important:

> `native modules changed` — 33 files across `modules/` and `targets/widgets/`
> have changed since `provenCommit`. **This build must be LAUNCHED on a phone
> before it goes to Apple, and an OTA update cannot carry any of it.**

`scripts/test-contrast.mjs` is **not** in the 31 — it drives a real browser and
needs Playwright plus a running web build. Its offline "failure" is a missing
dependency message, not a regression.

---

## 5. What was being worked on immediately before this handover

**Aesthetic refinement of the ten widget designs, at the mockup stage only.**

Nothing from this round has been written into Swift. It lives entirely in
`docs/design/v3.py` and `docs/design/ball.py`.

### Completed and committed (`84e3cab`, 2026-09-04)

Six changes the owner requested, all in the mockup:

| Design | Change |
|---|---|
| **C2** (Deck — the label) | Record + sleeve ~10% larger, shifted right toward centre; station name and dial number grouped into one enlarged block |
| **G** (The Stub) | Barcode now runs the **full width**; last-played moved above it to free the strip; station/song/artist all enlarged at different sizes |
| **K** (The Player) | Station photo now fills the **full height** of the black screen |
| **F** (The Record) | Navy printed label replaced with the **last-played album cover**; station number and bottom text removed |
| **H** (Mirror Ball) | `ball.py` gained `party=True` — each mirror tinted by which of three coloured lamps (pink/blue/purple) catches it |
| **I** (CD) | Disc enlarged; rainbow made more vivid (darker photo underneath + a second conic band in `screen` blend) |

### IN PROGRESS — not started, requested but not yet built

The owner sent two further requests **immediately before asking for this
handover**, together with a reference photograph of a real CD
(`/root/.claude/uploads/.../73dd0bbb-image.jpg`, not committed to the repo):

**H — Mirror Ball**
1. Remove the "Garage" text beneath the ball
2. Smooth out the edges (the silhouette is currently polygonal — the fix is an
   SVG `clipPath` circle so the outline is perfectly round)
3. Make it reflective and realistic "like how we made the mirror ball in the
   app" — i.e. match `src/components/MirrorBallFlipbook.tsx`'s model

**I — CD**
1. Match the rainbow to the reference photo — a real CD's diffraction radiates
   as **angular streaks from the centre outward**, not flat conic bands
2. Make the station image **less opaque**
3. **The widget's own shape should be the CD case** — rather than drawing a
   square case inset inside the rounded-square widget, the widget itself
   becomes the case holding the disc

I had just read `src/components/MirrorBallFlipbook.tsx` to match the app's real
shading model when the handover was requested. Relevant findings already made:

- The app uses `ROWS = 23, COLS = 44`, `TILT = 0.05`,
  `BEVEL = { u0: 0.08, u1: 0.92, v0: 0.07, v1: 0.93 }`, `MIN_AREA = 1.6`
- Brightness is a function of **where a mirror points**, not where it sits:
  `r = 2(n·v)n − v`, then smooth 3D value noise over `r` (the room) plus three
  fixed lamps
- **Two lobes per lamp, kept apart**: a *wide* bright lobe (widening it is the
  knob that works — 15 → 10) and a *narrow* colour lobe (widening a single
  tinted lobe turns half the ball blue, which is a coloured sphere, not a
  mirrored one)
- **Raising the ambient floor is the knob that does NOT work** — it moved the
  median but flattened the ball, and the dark mirrors that sell chrome went
  with it (measured: >200 share fell 4.1% → 0.6%)

`docs/design/ball.py` currently uses `rows=17, cols=30` and a *uniform*
`rnd.uniform(-0.13, 0.13)` scatter, where the app pushes scatter to the ends of
its range. Bringing it in line with the app is the substance of request 3.

---

## 6. Features complete and shipped

### Core
- Eight visual modes, all with landscape compositions except the Tuner
- Ten built-in mood stations on an AM/FM dial; user-created stations
- One-tap Start Drive; resume last cruise; mini-player
- Broadcast schedule — what is on air changes through the day
- Drive/listen session tracking, streaks, badges, a printed "drive stub"
- Share cards: Snapshot, Ticket and Y2K styles, exporting a real PNG

### Music
- Spotify: OAuth PKCE, full transport, playlist linking, queue-based song list
- Apple Music: MusicKit via a local native module, full transport, library
  playlists, artwork through the public catalogue
- Per-station **and per-service** playlist links, with automatic v1→v2 migration
- Companion mode for anyone with no service — visuals only, stated honestly

### App-level
- Light and dark themes; Daylight legibility mode
- Local notifications with a mechanical budget and back-off ladder
- Self-updating (`AutoUpdateHost`) plus a manual check row
- "Update from the App Store" card for native releases OTA cannot reach
- Rating card (earned, once, never mid-drive)
- Privacy/Terms generated by `scripts/gen-legal.mts` into **both**
  `docs/legal/` and `website/`

### Written but never run on a phone
- **The whole widget extension** — ten designs, seven gallery rows
- **iPad support** (`supportsTablet: true`)
- **Apple Music repeat/shuffle Swift fix** (committed 26.08, `665d30c`)

---

## 7. Corrections found during this audit

These contradict entries in `AGENTS.md`, which is a chronological log and has
stale points. **The codebase is authoritative.**

| `AGENTS.md` says | Reality at `84e3cab` |
|---|---|
| `BrandIntro.tsx` was DELETED (28.07) | Deleted in `5db5699`, **re-added** in `247faef`. Live today. |
| Widgets "deliberately not wired into app.json" | **Wired.** `@bacons/apple-targets` is in `plugins`, the App Group entitlement is in `app.json`, and it is allowlisted in `preflight-allow.json`. |
| iPad `supportsTablet` is a to-do (`docs/launch/next-build.md`) | **Already `true` in `app.json`.** |
| Entitlements list must be empty | Now correctly contains `com.apple.security.application-groups`. |

`docs/launch/next-build.md` is therefore **partly out of date** — items 1 and 2
are done in configuration and waiting only on a successful build.

---

## 8. Known-good working practices

- **Push ≠ ship.** A push publishes to *preview* automatically; production is
  always a deliberate act. `scripts/production-lag.mjs` answers "is the public
  behind?" and a weekly Routine asks on Mondays.
- **A finished EAS build is not a submitted build.** `--auto-submit` has
  silently not submitted before. Run the workflow's `diagnose` mode and read
  the "submitted to App Store Connect" line.
- **Do not trust the GitHub job-status API for "is it still running".** It has
  reported `in_progress` for 90 minutes after a step finished. Poll the **log
  endpoint** — it 404s while running and returns content the moment it ends.
- **Measure, don't eyeball.** Screen recordings get extracted frame-by-frame
  (imageio-ffmpeg at
  `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`);
  contrast, brightness and motion are measured with PIL/numpy.
- **When a probe reports total failure, check the probe first.** It has been
  wrong more often than the app.
