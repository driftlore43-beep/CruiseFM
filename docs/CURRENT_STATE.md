# Cruise FM — Current State

**Snapshot taken 2026-11-10 at commit `b3edd34`**, branch `main`. Every number
below was read off the repo, the workflow history or a command run today —
`npx tsc`, `scripts/preflight.mjs`, the 50 offline suites and
`scripts/production-lag.mjs` — not from memory and not from `AGENTS.md`.

**The previous snapshot was 2026-09-05 and had gone badly stale**: it described
the app as live at 1.3.1 with the whole widget extension written and never run
on a phone, and §5 named widget mockup refinement as the work in progress. All
of that shipped. It has been rewritten rather than patched.

---

## 1. The one-paragraph summary

Cruise FM is **live on the App Store at 1.4.3 (build 72)**, released on
**2 November 2026**. The widgets, iPad support and Premium are all shipped and
in public hands; the native batch that sat unbuilt for weeks is in the store
binary. Premium has been on sale since 1.4.1 released on **19 September**, and
in that time RevenueCat has recorded **no trial started** — which as of 03.11 is
partly explained (seven of the ten stations were a padlock that did nothing, now
fixed and published). **Nothing is in flight.** The next thing that happens is a
reading, not a change: see §5.

---

## 2. Version and channel state

| | Value | Notes |
|---|---|---|
| `app.json` `version` | **1.4.3** | Apple requires a higher string each submission |
| `app.json` `runtimeVersion` | **1.3.0** | **Deliberately held** — see below |
| Live on the App Store | **1.4.3, build 72** | Released 02.11 (owner's word; see §7) |
| Newest build | **72** | production profile, FINISHED, `error null` |
| On the owner's phone | **71** | testflight twin of 72, native-identical |
| `provenCommit` | **`057c023`** | build 28 (1.3.0) — last build opened on a phone |
| Branch | `main` | Canonical since 12.09 |

### Why `runtimeVersion` is held at 1.3.0, and why that is not a bug

`runtimeVersion` decides **which installed builds can receive an OTA update**.
Holding it at 1.3.0 is what makes an update reach **both** audiences at once:

- build **72** (the released 1.4.3 binary) listens on 1.3.0
- build **67** (the 1.4.2 binary still on every phone that has not updated)
  listens on 1.3.0 as well

Moving it would cut the second group off entirely, for no gain — nothing in JS
calls into the widget Swift and no field has been added to the snapshot, so a
bundle built from this source runs identically either side of the binary.

It was once moved **ahead** of a build, every 1.4.0 build then failed, nothing
anywhere was listening, and **every publish reached zero phones** — including a
fix the owner had been told was already on her phone. Hence the rule in
`scripts/preflight-allow.json`:

> **Bump `runtimeVersion` only when an update would genuinely break on an older
> binary.** Never in advance of a build.

---

## 3. What is where — three different audiences

| Audience | Running | Gets updates how |
|---|---|---|
| **App Store public** | build 72 (1.4.3) + production-channel OTA | Manual production publish only |
| **Phones that have not updated** | build 67 (1.4.2) + the same production OTA | Same publish reaches them, because the runtime matches |
| **Owner's phone + TestFlight** | build 71 + preview OTA | **Automatic** on every push to `main` that touches `src/`, `assets/` or the manifests |

**The owner is the only person on TestFlight.** Everyone else, testers included,
is on the public binary and listens on **production** — so a preview publish
reaches exactly one phone. A bug report from anyone else concerns code that can
only be fixed for them by a production publish.

**Download count: unknown.** The old snapshot said "~87, 3–5 a day" as of
05.09. Nothing here can read App Store Connect, so that figure is two months
old and must not be repeated as current.

### Last production publish

**2026-11-03 14:46 UTC** — update group
`1cb6611d-5406-4b9b-b3e1-6f658f801db5`, commit `22121d5`, branch production,
runtime 1.3.0. It carried the padlock fix: seven of the ten stations could not
be pressed at all by a free user, so most of the dial could never show anybody
what Premium was.

`node scripts/production-lag.mjs` today: **"The public app is up to date.
Nothing to publish."** (exit 0, verified rather than assumed.)

---

## 4. Health checks — all run today, 2026-11-10

```
npx tsc --noEmit                          clean
50 offline suites (scripts/test-*.mjs)    49 passed, 1 failed
node scripts/preflight.mjs                10 passed, 1 warning, 0 failures
node scripts/production-lag.mjs           up to date
git status                                clean, pushed
```

**The one failure is `scripts/test-contrast.mjs` and it is not a regression** —
it drives a real browser and needs Playwright plus a running web build, which
is what its own message says. With the web build up it passes, making 50 of 50.

**The one preflight warning is expected and permanent until the next build:**

> `native modules changed` — 33 files across `modules/` and `targets/widgets/`
> have changed since `provenCommit`. **A build from here must be LAUNCHED on a
> phone before it goes to Apple, and an OTA update cannot carry any of it.**

That warning has been standing since build 52's `provenCommit` and does not
mean anything is wrong; it means the Swift in the tree is newer than the last
build anyone opened. It clears only when `provenCommit` moves forward, which
happens **after a build has actually been opened** — never because it built.

### The container needs setting up before any of this runs

A rebuilt container arrives with no `node_modules` and a **shallow** clone,
which produces a false red: with no baseline, `git show <provenCommit>:package-lock.json`
reads nothing, every package reports as "(new)" and the unproven-versions check
cascades off it. Both are cleared by:

```bash
npm ci && git fetch --unshallow
```

The browser harnesses additionally need **`playwright-core@1.56`** installed
into the **scratchpad, never the project lockfile** (its chromium revision is
1194, which is what `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` is),
plus `NO_PROXY='*'` to reach localhost. And `python3` here is 3.11 with **no
PIL**; `python3.13` has it, so anything needing Pillow runs under that.

---

## 5. What is in flight — nothing, and that is the point

There is no half-finished work. The last three rounds all shipped and were
published. What comes next is **a reading, not a change**, and `docs/TODO.md`
§0 is the authority on it:

**On 17 November** — a fortnight after the padlock fix reached public phones —
read RevenueCat for any trial started, and App Store Connect's product-page
views against downloads. Three answers, three different problems: the fix
worked; people see the listing and don't install (a listing problem); or nobody
is finding it (a discovery problem, which no change inside the app fixes).

**Do not read them earlier.** Four days of data on a slow-trickle app is noise.

---

## 6. Features complete and shipped

### Core
- Eight visual modes, all with landscape compositions except the Tuner
- Ten built-in mood stations on an AM/FM dial; user-created stations, which can
  carry the driver's own photograph
- One-tap Start Drive; resume last cruise; mini-player
- Broadcast schedule — what is on air changes through the day
- Drive/listen session tracking, streaks, badges, a printed "drive stub"
- Share cards: Snapshot, Ticket and Y2K styles, exporting a real PNG

### Widgets — shipped, and in public hands
- Six gallery rows: On Air Now, Start Drive, On the Deck, The Mode, Last Played
  (Home Screen) and On Air (Lock Screen)
- **Small, medium and large** tiles; the large family arrived in 1.4.3
- A tile can be **pinned to a station** (an `AppEntity`, so a driver's own
  stations appear in the picker), or left on "my last station", which is the
  default and what every tile did before
- The looks are picked per tile: Road / Label on the Deck, Mirror Ball / CD /
  Record on The Mode, CD player / Pocket player / Ticket stub on Last Played

### Music
- Spotify: OAuth PKCE, full transport, playlist linking, queue-based song list.
  **Not offered to new listeners since 01.09** — the developer tier caps full
  control at five accounts, so the picker hides it rather than promising
  something it cannot deliver; anyone already on it keeps working
- Apple Music: MusicKit via a local native module, full transport, library
  playlists, artwork through the public catalogue
- Per-station **and per-service** playlist links, with automatic v1→v2 migration
- Companion mode for anyone with no service — visuals only, stated honestly

### Money and compliance
- **Premium is on sale**: £1.99/month and £17.99/year through RevenueCat,
  entitlement `cruise_fm_pro`, 7-day trial. `LAUNCH_FREE` is **off**
- Everyone who used the app before the paywall keeps Premium for good
  (`earlyAccess`, decided from evidence on the phone rather than a date)
- **Small Business Program approved** (10.10) — Apple's commission is 15%
- **The EU is live** (12.10) — the trader declaration verified, and the
  published contact address is the virtual mailbox rather than her home one
  (10.11)

### App-level
- Light and dark themes; Daylight legibility mode
- Local notifications with a mechanical budget and back-off ladder
- Self-updating (`AutoUpdateHost`) plus a manual check row
- "Update from the App Store" card for native releases OTA cannot reach
- Release notes gated on the **binary's** version, so a phone is never told
  about something its build cannot do
- Rating card (earned, once, never mid-drive) — still the browser route; the
  native prompt needs a build
- Privacy/Terms generated by `scripts/gen-legal.mts` into **both**
  `docs/legal/` and `website/`

---

## 7. What this repo can and cannot know

**`AGENTS.md` is a chronological log and has stale points. The codebase wins.**
Re-verified today:

| Claim | Reality at `b3edd34` |
|---|---|
| `BrandIntro.tsx` was deleted | **Live.** Imported and mounted in `src/app/_layout.tsx` |
| Widgets "not wired into app.json" | **Wired.** `@bacons/apple-targets` in `plugins`, the App Group in `entitlements`, allowlisted in `preflight-allow.json` |
| iPad `supportsTablet` is a to-do | **`true`**, and every tab page now uses the reading column, so the old "stretched phone" fault is closed |

**And the harder limit, which matters more than any of those.** Nothing here
can see App Store Connect, Apple's developer site, RevenueCat, Netlify or
`apps.apple.com` — that last one answers **http 000 for every storefront**,
control storefronts included, because this sandbox's proxy refuses the host.
So:

> **Every fact about the live listing, a release, a review outcome, a sale or a
> published address is the owner's word, and is recorded as her word.**

This file has twice read a form back as proof and been wrong (18.09, 26.08),
and once asserted a listing subtitle through five read-backs that turned out
never to have been typed (08.10). **A belief recorded as a fact is
indistinguishable from a fact when it is read back.**

---

## 8. Known-good working practices

- **Push ≠ ship.** A push to `main` publishes to *preview* automatically;
  production is always a deliberate act. `scripts/production-lag.mjs` answers
  "is the public behind?" and a weekly Routine asks on Mondays — **but that
  Routine's stored prompt names a dead branch** (`docs/TODO.md` §2), so its
  silence is not evidence until that is fixed.
- **Never publish to production while a build is in App Store review.** That is
  changing the app under the reviewer. Preview stays safe.
- **A finished EAS build is not a submitted build.** `--auto-submit` has
  silently not submitted before. Run the workflow's `diagnose` mode and read
  the "submitted to App Store Connect" line.
- **Read the build's own Xcode log, not the status word.** Its byte size dates
  the outcome before a line is read: ~2 MB stopped at the compiler, ~11.9 MB got
  all the way through. Then search the block between `--- compiler errors ---`
  and `--- end ---` for real `error:` lines; the four "setter cannot be more
  available than enclosing scope" warnings in the widget files are expected.
- **Do not trust the GitHub job-status API for "is it still running".** It has
  reported `in_progress` for 90 minutes after a step finished, and the log
  endpoint has 404ed for seven minutes after one. Read the **step-level
  timestamps** in `list_workflow_jobs` first, then fetch the log.
- **Measure, don't eyeball.** Screen recordings get extracted frame by frame
  (imageio-ffmpeg at
  `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`);
  contrast, brightness and motion are measured with PIL/numpy. But **reach for
  the picture, not the pixel count**, when the question is "do these two things
  agree" — a diff of a photo-backed scene is mush, and looking at the shot has
  settled in one glance what numbers could not.
- **When a probe reports total failure, check the probe first.** It has been
  wrong more often than the app, and a check that quietly matches nothing reads
  as a pass (`KNOWN_ISSUES.md` §3.1).
- **A native-changing build must be opened on a phone before Apple sees it.**
  Preflight warns; the warning is the whole point. And a widget already on a
  Home Screen must be **removed and re-added** to be judged — iOS caches a
  tile's last successful draw per placed tile.
