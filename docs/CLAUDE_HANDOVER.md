# Cruise FM — Handover

**Written 2026-09-05 at commit `84e3cab`, branch `claude/cruise-fm-v4wk5f`.**

This is the entry document. Read it, then the four beside it:

| Document | What it holds |
|---|---|
| **`PROJECT_ARCHITECTURE.md`** | What the app is, every folder and file, navigation, data layer, native modules, the widget extension, external services, build config |
| **`CURRENT_STATE.md`** | Versions, builds, channels, health checks, and **exactly what was being worked on** |
| **`KNOWN_ISSUES.md`** | Open bugs, settled dead ends, and the traps this project has hit more than once |
| **`TODO.md`** | Remaining work, ordered, split into what code can do and what only the owner can |
| **`AGENTS.md`** | The full chronological log. Enormous. Searchable, not readable end to end |

Everything in these five was **verified against the codebase**, not recalled.
Anything uncertain is labelled. Where `AGENTS.md` contradicts the code, the code
wins — see `CURRENT_STATE.md` §7 for the corrections found during this audit.

---

## 1. The thirty-second version

Cruise FM is an **iOS driving-companion app**. You bring your own Spotify or
Apple Music playlists; it wraps them in a full-screen cinematic visual — a
turning record, a cassette, a mirror ball — organised by **mood stations**
rather than genre.

> Spotify organises by artist and genre; Cruise FM organises by how a drive
> feels.

**It is live on the App Store** at 1.3.1 (build 32), ~87 downloads, 3–5 a day.
Everything since 19 August has shipped **over the air** to that binary. A large
batch of **native** work — the whole widget extension, iPad support — is
written, committed and **has never run on a phone**.

**Cruise FM never plays the audio.** Spotify or the Apple Music system player
does. That is not an implementation detail; it is why the app declares no
background-audio capability, why a widget cannot legitimately animate, and why
build 7 was rejected when a stray plugin claimed otherwise.

---

## 2. Who you are working for, and how

**The owner (Jessica) does not code.** This is the single most important
working constraint.

- **Explain everything in plain, non-technical English.** No jargon, no
  file paths in conversation unless she asks, no assuming she knows what a
  build or a channel is.
- **After any change, summarise plainly what changed and why.** This is a
  standing instruction she gave on 20.08 and repeated since. Not a silent
  commit-and-move-on. She should never have to ask "what did you just do", or
  discover something by noticing it on her phone.
- **She is in Australia.** Timezone matters for scheduled things; the trademark
  registry is IP Australia, not the UK (an earlier round got this wrong).
- **She reviews design work visually.** Render it, screenshot it, send it. The
  mockup harness in `docs/design/` exists entirely for this.

### Her feedback is usually right, and usually more precise than it first reads

Repeatedly, a one-line note turned out to name a real structural fault:

- *"the shuffle button doesn't highlight"* → the active state was the station's
  accent, which is **darker than white** on 8 of 10 stations, so pressing it
  made the icon *dimmer* (measured: 25× dimmer on one station)
- *"the times on the music bars"* → eleven separate implementations of the same
  eight lines, with three different faults between them
- *"the vinyl looks squashed"* → letter-spacing was negative on 38 styles under
  28pt
- *"the mirror ball doesn't spin"* → it genuinely had stalled, because a
  native-driven value was being read back asynchronously and one dropped answer
  stopped it for ever

**When she reports something, measure before theorising.** See §5.

---

## 3. Rules that must not be broken

These are not preferences. Each one is a bug that already happened.

### Product

1. **`AmbientGlow` is the only reader of the `atmosphere` setting.** Gating the
   Mirror Ball's room layers on it was built, measured (38.76% → 0.00%) and
   **reverted at the owner's instruction**. The beams breathing *is* the look.
2. **Off air is presentation, never a lock.** Every station stays playable at
   every hour (`constants/schedule.ts`).
3. **The widget says LAST PLAYED, never "now playing".** It is redrawn a handful
   of times a day; a claim about the past cannot go stale. That single word is
   the whole of its honesty.
4. **The app may not claim what it cannot verify.** No drive recap (it cannot
   know a drive happened). No `0:00` for an unknown time — `--:--`
   (`utils/formatTime.ts`). No scene animating over unconfirmed playback
   (`utils/confirmedPlaying.ts`).
5. **The scene gates on `confirmedPlaying`; the transport gates on `playing`.**
   A button that hesitates reads as broken; a scene that moves over silence is a
   lie.
6. **Nothing leaves the device.** No server, no accounts, no analytics — and
   the privacy policy says so publicly. Adding an analytics SDK would break a
   published promise.

### Technical

7. **`runtimeVersion` moves only in the commit that cuts a build which
   succeeds.** Moving it early made every publish reach zero phones.
8. **Any new widget snapshot field must be OPTIONAL in `Snapshot.swift`.**
   Swift's decoder is all-or-nothing: one missing property blanks every widget
   at once with nothing logged.
9. **Widget `kind` strings are permanent.** Changing one makes a widget already
   on a Home Screen vanish.
10. **Nothing below the UI layer imports a platform's transport directly.** Go
    through `useMusicPlayback` / `seekActive()`. Two modes silently broke on
    Apple Music this way.
11. **Every repeating timer is AppState-gated** (`useAppActive()`). A
    backgrounded poll gets the app SIGKILLed.
12. **Never animate a layout property** (`width`, `height`). Use `scaleX`/
    `scaleY` with a paired translate on the native driver.
13. **Never add `com.apple.developer.applemusic`** or declare
    `UIBackgroundModes`. Both have caused a failed build or a rejection.
14. **Bundle id `com.driftlore.CruiseFM` is permanent.**
15. **Never write "Ltd" or "Inc" after Strofi Technologies** — no entity exists,
    and the Terms already name it as the contracting party.

### Design

16. **Light is gradient falloff, never a stroked or hard-edged shape.** Relearnt
    on the mirror ball's rim, the vinyl's wedges, the CD's fan, the Winamp
    frame.
17. **The primary button is a solid pill in the opposite of the page** — it
    inverts between themes.
18. **The material carries no hue; mood arrives as light.** The mirror ball is
    neutral chrome lit by coloured lamps. A ball that is broadly blue is a
    coloured sphere, not a mirrored one.
19. **Don't tighten letter-spacing below 28pt.**

---

## 4. The most repeated lesson in this project

> ## A check is not evidence until it has been seen to fail.

At least eight checks in this repo have shipped in a state where they could
**only** pass — matching nothing, appended after `process.exit()`, looking in
the wrong file, or with the loop that filled the results array deleted. One
printed reassurance for a month while reading nothing at all, and is cited in
older notes as having "run and passed". Those citations are worth nothing.

**Before believing a green check, reintroduce the bug and watch it go red.**
Several suites now assert they read a plausible number of files first, precisely
because of this.

The same instinct applies to probes and harnesses: **when a probe reports total
failure, check the probe first.** It has been wrong more often than the app.

---

## 5. How work gets done here

### Measure, don't eyeball

- Screen recordings are extracted frame-by-frame with the imageio-ffmpeg binary
  at `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`
  (no system ffmpeg; Chromium cannot decode HEVC)
- Contrast, brightness, motion and colour are measured with PIL/numpy
- Layout is measured in the real web build with Playwright, not judged from a
  style sheet — **when a layout number disagrees with a device screenshot, the
  screenshot wins**

### The web build is the test harness

```bash
npx expo start --web --port 8081
```

Then `scripts/harness/*.mjs`. It can prove a great deal and **lies specifically
about six things** — keyboard behaviour, `flexShrink` on scrollers,
`onTextLayout`, `measure()`, haptics and gesture termination. The full list is
in `KNOWN_ISSUES.md` §3.10. Some fixes are therefore shipped on *the mechanism
plus a device report*, and that is stated where it applies.

### Before any build

```bash
npx tsc --noEmit
for f in scripts/test-*.mjs; do node "$f" || echo "FAILED $f"; done   # 31 suites
node scripts/preflight.mjs                                            # read every line
```

`scripts/test-contrast.mjs` needs Playwright **and** a running web build; its
offline failure is a missing dependency, not a regression.

### Shipping

- **A push to this branch auto-publishes to `preview`** — the owner's phone and
  TestFlight. Production is **never** automatic.
- **`node scripts/production-lag.mjs`** answers "is the public app behind?"
  Exit 1 means yes. A weekly Routine asks on Mondays.
- Production publish: GitHub → Actions → *Ship OTA update* → channel
  `production`, mode `publish`. **Run `diagnose` first** — never publish while a
  build is in App Store review.

---

## 6. Where to start reading the code

In this order:

1. **`src/context/NowPlayingContext.tsx`** (636 lines) — the drive session. The
   single most important file.
2. **`src/utils/useMusicPlayback.ts`** — the switchboard every screen talks to.
   Its header comment explains the bug that shaped it.
3. **`src/constants/stations.ts`**, **`modeCatalog.ts`**, **`schedule.ts`** —
   the data the whole app is built on.
4. **`src/app/_layout.tsx`** and **`src/app/(tabs)/_layout.tsx`** — the provider
   stack and why `NowPlayingHost` lives where it does.
5. **One mode**, ideally `src/components/VinylMode.tsx` — they all share the
   same shell.
6. **`targets/widgets/Snapshot.swift`** + **`src/utils/widgetData.ts`** — the
   two halves of the widget contract.

**The code is heavily commented, and the comments are the reasoning.** They
record what was tried, what was measured and why the current shape won. They
are not decoration — several of them are the only place a hard-won constraint is
written down. Read them before changing the code they sit on, and **keep them in
step**: a comment that has drifted from its code is worse than none.

---

## 7. What was happening the moment this handover was written

**Aesthetic refinement of the ten widget designs, at the mockup stage.**

Six changes were completed and committed in `84e3cab` (C2, G, K, F, H, I — see
`CURRENT_STATE.md` §5). The owner then asked for two more, which are **not
started**:

- **H (Mirror Ball):** remove the caption, smooth the silhouette, and make it
  reflective and realistic "like how we made the mirror ball in the app"
- **I (CD):** match a real CD's rainbow (she supplied a reference photo), make
  the station image less opaque, and **make the widget itself the CD case**
  rather than drawing a case inside it

I had just read `src/components/MirrorBallFlipbook.tsx` to match the app's real
shading model when the handover was requested. The findings are written up in
`CURRENT_STATE.md` §5 and turned into a task list in `TODO.md` §0.

**Nothing from this round is in Swift.** It lives only in `docs/design/v3.py`
and `docs/design/ball.py`.

---

## 8. Five things that will bite a new agent fastest

1. **`AGENTS.md` is a chronological log, not a spec.** It has stale entries —
   four are corrected in `CURRENT_STATE.md` §7. Search it for reasoning;
   trust the codebase for facts.
2. **Pushing is not shipping.** Work sat unreleased for two weeks twice because
   "it's OTA" was true of what the code *could* do and false about anything
   having been sent.
3. **A finished EAS build is not a submitted build**, and a submitted build is
   not a released one. Check the actual line in `diagnose`.
4. **Do not trust the GitHub job-status API for "still running".** It has said
   `in_progress` for 90 minutes after a step finished. Poll the log endpoint.
5. **The owner's phone must stay on `testflight`-profile builds.** Installing a
   production-profile build from TestFlight moves it to the production channel
   and it silently stops receiving updates.

---

## 9. Things that are settled — do not reopen

Full reasoning in `KNOWN_ISSUES.md` Part 2.

- Spotify will not give a development-tier app a playlist's contents (403,
  measured with an instrument after three wrong diagnoses)
- There is no beat map on either platform (403 / does not exist)
- A Home Screen widget cannot spin a record
- The mirror ball's tiles cannot truly rotate in RN (measured: 89 px error, and
  it does not improve with more columns)
- Atmosphere governs the haze only
- A drive-framed recap was proposed and declined
- A skin system (several looks per mode) was rejected
