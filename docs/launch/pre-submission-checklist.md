# Pre-submission checklist — run this before every App Store build

Cruise FM has been rejected twice, and **both rejections were avoidable from
the repo alone** — nothing about them needed a reviewer to find:

| Date | Guideline | What Apple saw | What would have caught it |
|---|---|---|---|
| 29.07 (build 7) | 2.5.4 Performance | The app claimed it plays audio in the background. It doesn't — Spotify does. | Reading the resolved iOS config: an `expo-audio` plugin we'd forgotten was adding the claim. |
| 06.08 (build 18) | 2.1(b) Completeness | A £1.99 "Unlock Premium" screen in a submission with no purchase products. | Checking the paywall was unreachable — the fix existed, but landed 19 minutes *after* the build was cut. |

Each cost roughly a week. This checklist exists so a third one doesn't.

Work top to bottom. Nothing here takes more than a few minutes.

---

## A. Automated checks

Run from the repo root. Every line should read PASS; INFO lines are for eyeballing.

```bash
npx expo config --type introspect --json > /tmp/pf.json
python3 - <<'PY'
import json
ip = json.load(open('/tmp/pf.json'))['ios']['infoPlist']
bg = ip.get('UIBackgroundModes')
print('PASS  no UIBackgroundModes claim' if not bg else f'FAIL  UIBackgroundModes present: {bg}')
usage = {k: v for k, v in ip.items() if k.endswith('UsageDescription')}
print(f'INFO  permission strings Apple will see ({len(usage)}):')
for k in sorted(usage): print('        ', k)
PY

grep -q 'OWNER_MODE = false'  src/constants/config.ts && echo 'PASS  OWNER_MODE false'      || echo 'FAIL  OWNER_MODE not false'
grep -q 'LAUNCH_FREE = true'  src/constants/config.ts && echo 'PASS  LAUNCH_FREE true'      || echo 'FAIL  LAUNCH_FREE not true'
grep -q 'if (isPro) return'   src/app/premium.tsx     && echo 'PASS  paywall self-guards'   || echo 'FAIL  paywall does NOT self-guard'
grep -q '{!isPro && ('        'src/app/(tabs)/profile.tsx' && echo 'PASS  upgrade card gated' || echo 'FAIL  upgrade card NOT gated'

npx tsc --noEmit && echo 'PASS  typecheck clean'
python3 -c "import json;d=json.load(open('app.json'))['expo'];print('INFO  version',d['version'],'| runtimeVersion',d['runtimeVersion'])"
```

**Reading the results**

- **UIBackgroundModes must be absent.** This is rejection #1 exactly. An Expo
  plugin can add Info.plist keys you never wrote, so the only trustworthy
  source is the *resolved* config above — never app.json alone.
- **The permission list must be explainable.** Every string there appears on
  the store listing, and Apple asks why. Today the expected set is:
  - `NSAppleMusicUsageDescription` — real, MusicKit playback.
  - `NSPhotoLibraryAddUsageDescription` — real, saving the share card.
  - `NSLocalNetworkUsageDescription` — comes from `expo-dev-client`, which is
    only bundled when a profile sets `developmentClient: true`. The
    `production` profile doesn't, so it will not ship. If it ever appears in a
    production build's own config, stop and investigate.
  - Anything else: find the feature it belongs to, or delete the plugin adding
    it. An unexplained permission is both a rejection risk and a install-time
    deterrent.
- **The purchase checks matter only while `LAUNCH_FREE` is true.** They assert
  that nothing can reach an offer the app cannot honour. When real payments
  ship, these two lines stop applying — replace them with a check that the
  products exist in App Store Connect.

Then the harnesses (the web build must be running on :8081):

```bash
node scratchpad/store/health.mjs     # 15-step walk over every page and flow
node scratchpad/dismiss8.mjs         # all 8 modes dismiss cleanly, nothing left behind
node scratchpad/landscape/sweep.mjs  # rotation, all 8 modes
```

All three must report zero errors.

---

## B. Checks only a human can make

**In App Store Connect**

- [ ] **Monetization → Subscriptions / In-App Purchases is empty** (while the
      app is free). A product sitting in "Ready to Submit" is what turns a
      stray button into rejection #2.
- [ ] **Screenshots show what the app actually is today.** They went stale once
      already — a 23.07 set was still advertising Sound Waves, a mode deleted
      on 25.07. Re-shoot with `scratchpad/store/shot.mjs` whenever the modes or
      the station names change.
- [ ] **Notes for Review** explain anything a reviewer can't discover alone:
      that no sign-in is required, that music playback needs the user's own
      Spotify or Apple Music, and — since build 7 — that the app deliberately
      does not play background audio.
- [ ] **The build selected is the one you think it is.** Check its number, and
      have Claude confirm which commit it was cut from (`Actions → Ship OTA
      update → mode: diagnose` prints the commit beside every build). Build 18
      was rejected because it was cut 19 minutes before the fix landed, and
      nothing on Apple's side would ever have told us.

**One command does the desk checks**

```bash
node scripts/preflight.mjs
```

It reads the app's resolved native configuration and the native module
versions, and the build button refuses to run without it. Everything below in
this section is what it checks, kept here so the reasoning is readable; if the
two ever disagree, the script is the one that runs.

**On the phone**

- [ ] **If this build adds or changes ANY native module, open the equivalent
      `testflight` build on a real phone first, and watch it get past the
      splash screen.** Not "the build succeeded" — actually launched. Build 25
      compiled cleanly, uploaded cleanly, passed App Store processing, and
      then died 40 ms into launch on every open, because `expo-media-library`
      56.0.10 called an ExpoModulesCore method that SDK 56's core (56.0.15)
      does not have — `Record.from(dictionary:appContext:)`. Nothing before
      launch can see that: the linker is happy, and dyld only fails on the
      device. Note a version check would NOT have caught it either, since
      56.0.10 sits inside the `~56.0.6` range Expo publishes for this SDK —
      which is exactly why this step is a launch and not a lint.
- [ ] **Your own photo on a station works** (first build carrying
      expo-image-picker only). Pick a photo in Create Station, save, and drive
      it. Check the picker opens without crashing, and that the photo shows on
      the card, on the station page and blurred behind the mode.
      **A trap found on 09.08, recorded because it will recur with any two
      plugins that touch the same key:** `expo-media-library`'s
      `photosPermission: false` *deletes* `NSPhotoLibraryUsageDescription`, and
      it was silently deleting the one `expo-image-picker` sets — so the
      resolved config had no read permission at all while app.json plainly
      appeared to configure one. An earlier version of this checklist recorded
      that absence as a deliberate choice. It was not; it was plugin ordering.
      The `false` is now removed and the string is present. The general rule:
      when two plugins configure the same Info.plist key, only the *resolved*
      config tells you who won.
- [ ] Native module versions are **pinned exactly** in package.json (no `~`).
      The drift that caused the above came from `npm install` quietly taking
      the newest patch inside the range.
- [ ] Install nothing from TestFlight that was built on the `production`
      profile. The store build listens on the production channel; installing it
      replaces the testflight build and silently cuts the phone off from
      preview updates (this happened on 02.08 and cost a day of "the fixes
      aren't arriving").

---

## C. Cutting and submitting

```bash
git pull                                                   # never build from a stale checkout
npx eas-cli build  -p ios --profile production
npx eas-cli submit -p ios --profile production --latest
```

- **`production` profile for the store. Always.** The owner's phone stays on
  `testflight` builds.
- **Bump `version` and `runtimeVersion` together** if — and only if — this
  build changes native code (a new native module, a new plugin, a new
  permission). If the change is JavaScript only, leave both alone: bumping
  strands the test phone with no over-the-air updates until it installs a
  second build.
- The **build number** increments itself server-side; you never set it.

---

## D. While the review is open

- [ ] **No `production`-channel publishes.** That changes the app Apple is
      looking at. Preview publishes are safe — they only reach the test phone.
- [ ] If it's still *Waiting for Review* after ~2 working days, request an
      expedited review at
      <https://developer.apple.com/contact/app-store/?topic=expedite>. Don't
      cancel and resubmit; that loses your place.
- [ ] When it's approved, check whether anything shipped to preview since the
      build was cut. If so, publish it to production **before** pressing
      Release, so day-one users start on the fixed code.

---

## D2. Release day — "approved and released, but the page 404s"

Hit on the real launch (08.08). The version said **Ready for Distribution**,
the release had been pressed, and `apps.apple.com/app/id…` still returned
*"The page you're looking for can't be found."*

**Cause:** the app was set to *removed from sale* — approved, released, and
available in zero territories, so there is no public page to serve. App Store
Connect shows this only as a quiet blue banner on the Product Page tab:
*"This app was removed from sale from the App Store. Go to Pricing and
Availability to add it back."*

**Fix:** App Store Connect → the app → **Pricing and Availability** →
Availability → select the territories (All countries and regions) → confirm
price **Free** → Save. Allow a few hours to propagate.

**Check before release, not after:**

- [ ] **Pricing and Availability** — the app is available in at least one
      territory, at the intended price.
- [ ] **Agreements, Tax, and Banking** — the **Free Apps** agreement is
      **Active**. A pending agreement blocks distribution no matter what the
      version status says, and nothing surfaces it as an error.

The general lesson, again: *Ready for Distribution* describes the **review**,
not the **listing**. Three separate switches must all be right — approved,
released, and available — and only the first two are visible from the version
page.

---

## E. If it's rejected anyway

1. **Read what Apple actually said, and find the exact screen or key they
   mean.** Both rejections so far were precise and correct.
2. **Prove which code the build carried** before theorising — the diagnose mode
   above prints each build's commit. Assuming "that was fixed the same day"
   is what made rejection #2 a surprise.
3. **Fix the cause, not the entry point.** #2 was "hidden" by removing the
   button that reached the paywall; the screen itself still worked. The screen
   now refuses to render an offer at all, so a forgotten button can't
   resurrect it.
4. Reply in the Resolution Center *and* upload a new build. A reply alone
   leaves the same binary in front of them.
