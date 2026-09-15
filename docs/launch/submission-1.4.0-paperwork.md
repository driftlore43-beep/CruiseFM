# 1.4.0 submission paperwork — every field, in order

Written 15.09.2026 for the submission itself. Work down it in App Store
Connect; each field says what to paste, whether it needs a review, and — where
it is a decision rather than a copy job — what the choice costs either way.

**The one-line summary of the paywall question: there isn't one in 1.4.0.**
`LAUNCH_FREE = true` in `src/constants/config.ts`, so every station and every
mode is unlocked for everybody, `premium.tsx` refuses to draw an offer at all,
and preflight fails the build if that guard is ever removed. So every
monetisation answer below is **No / empty / none**, and that is the correct
answer rather than an omission. See the last section for the paperwork that
attaches to a paywall — it is real, it is outstanding, and **none of it may be
started until 1.4.0 is through review.**

---

## A. The version page — App Store Connect → Cruise FM → 1.4.0

### A1. Build

Attach **build 59** (version 1.4.0). Not 57, not 58.

- 57 is the TestFlight twin and is the one on the phone.
- 58 was cut before the tagline round, so its app says "Golden hour. Open
  roads." while the new screenshots say something else. Attaching it would put
  the pictures and the app out of step on day one.
- 59 is cut from `8d0a4ae`, the commit the screenshots were shot against.

All three are native-identical (`git diff 18b60d9 HEAD -- modules/ targets/
plugins/ app.json package.json package-lock.json eas.json` is empty), so the
"a native-changing build must be launched on a phone first" rule is satisfied
by having installed **57**, not by installing 59.

**If 59 is not in the list**, it has not finished Apple's processing, or the
scheduled submission did not fire. Wait out the processing window first; only
then run the workflow's `submit` mode. Never submit a build number twice —
that is the wall that cost three rounds on 08.09.

### A2. What's New in This Version

Paste exactly this (Apple shows about the first three lines before "more"):

```
Cruise FM is now on your Home Screen and Lock Screen.

Add a widget for whichever part of it you like — a spinning record with
your last song, a mirror ball or a CD catching the light, what's on air
right now, or a one-tap tile straight into a station. Pick a look for
each one.

Cruise FM also fills the whole screen on iPad now, not just the iPhone.

Also in this update:
• Apple Music plays more reliably — a paused song won't restart when
  you come back to the app, and changing station part-way through no
  longer trips over itself
• Your custom stations show their photo more brightly behind a mode
• The mirror ball, CD and vinyl record all catch the light more like
  the real thing
• The stations' own lines are about the hour and the light now, not
  about being in a car
```

### A3. Promotional text — **this one is stale and worth changing**

What is live today was written for 1.3.0 and leads with a feature that is two
releases old. It is also the **only** field on this page editable at any time
with no review, so it is the right place for whatever shipped most recently.

```
Now on your Home Screen and Lock Screen — plus a proper iPad screen. Ten mood
stations, eight full-screen modes, every one of them free.
```

(139 characters of 170.)

### A4. Screenshots — **both sets, and the iPad one is required**

`supportsTablet: true` ships in this build, so Apple will not accept the
version without a 13-inch iPad set.

- **iPhone 6.7"** — the ten files in `screenshots-marketing/`, in numbered
  order, 01 through 10.
- **iPad 13"** — the eight files in `screenshots-marketing-ipad/`, 01 through
  08, at 2064×2752.

The two sets carry the same headlines in the same order on purpose: the words
on a listing are one set per version, so the phone and the tablet have to read
as one thing.

### A5. App preview video — iPhone only

`CruiseFM-preview-roughcut-886x1920.mp4`, 19.5 seconds, 886×1920, into the
**iPhone 6.7" Display** slot only. The iPad listing carries no video, which is
allowed — a preview is per device size and optional at every one.

Pick a poster frame from the dial sweep or the tuner rather than a rested
deck, so the still that sits on the page has something happening in it.

**It goes through review with the build**, so it must be uploaded before
Submit; adding it afterwards means another review.

### A6. App name, subtitle, keywords — **a decision, not a copy job**

These three belong to a *version*, so this submission is the moment or they
wait for the next one.

Live today:

| Field | Live now |
|---|---|
| Name | `Cruise FM` |
| Subtitle | `Music for how a drive feels` |
| Keywords | `driving,road,trip,visualizer,equalizer,mood,commute,night,cassette,vinyl,car,radio,retro,aesthetic` |

`docs/launch/app-store-listing.md` decided on 10.08 that the name should be
**`Cruise FM: Driving Visuals`** and that decision was never applied. The
reasoning still stands: the name field is the highest-weighted thing in App
Store search and "Cruise FM" is nine characters carrying no search terms at
all.

**Recommendation: apply the name, leave the subtitle and keywords alone.**

- The name costs nothing and is the biggest single search win available.
- The subtitle and keywords were chosen *for search*, and the 15.09 round
  deliberately did not touch them — dropping the driving words for consistency
  with the app's new wording would trade findability for tidiness. That is a
  real trade and it is yours to make, not a tidy-up.

**This is the store listing name only.** Do not touch `expo.name` in
`app.json` — that is the name under the icon, where iOS truncates at about
twelve characters and "Cruise FM: Dri…" is what you would get.

### A7. Description

The live description is accurate for 1.4.0 as it stands — nothing in it
overclaims, and it already says plainly that the app is free with nothing to
buy. It does not mention widgets or the iPad. Adding a paragraph is optional;
if you want it, drop this in after the **EIGHT FULL-SCREEN MODES** block:

```
ON YOUR HOME SCREEN
Widgets for the parts you want at a glance — a record with your last song, a
mirror ball or a CD catching the light, what's on air right now, or a one-tap
tile straight into a station. Each one has looks to choose from. There's a
Lock Screen widget too, and the whole app fills an iPad's screen.
```

---

## B. The monetisation answers — all of them are "no"

This is the paywall section of the submission, and getting it wrong is what
cost this app a rejection once already.

| Where | Answer |
|---|---|
| Monetization → In-App Purchases | **Empty.** No products exist, none are "Ready to Submit". |
| Monetization → Subscriptions | **Empty.** |
| Pricing and Availability → Price | **Free** (base AUD 0). |
| App Review Information → "Does your app contain in-app purchases?" | **No.** |
| App Review Information → "Is a sign-in required?" | **No** — no account, nothing to log into. Apple Music and Spotify are optional, and the app runs as the visual layer without either. |
| Export compliance | Already answered in the binary (`ITSAppUsesNonExemptEncryption: false`), so App Store Connect should not ask. |
| Content rights | Cruise FM plays no music of its own; it controls the user's own Apple Music or Spotify app. No third-party content is included. |
| Age rating | 4+, unchanged. |

**Why this matters more than it looks.** Build 18 was rejected under Guideline
2.1(b) because the reviewer reached a £1.99 "Unlock Premium" screen in a
submission with no purchase products behind it. The fix was to make the paywall
screen refuse to draw itself while everyone is premium, which is what
`LAUNCH_FREE` does today. So: **do not create a subscription product, and do
not flip `LAUNCH_FREE`, while 1.4.0 is in review.** A product sitting in "Ready
to Submit" with a free app is the same rejection wearing a different hat.

**Also while in review:** no publish to the **production** channel. Preview —
your phone and TestFlight — stays safe and unaffected.

---

## C. Notes for Review

Nothing has changed here since the last submission. Worth keeping:

- No sign-in needed to use the app; the reviewer can open it and drive
  immediately.
- Full in-app playback control needs an Apple Music subscription (or Spotify
  Premium); without either, the app is the visual layer and says so on screen.
- The app declares no background modes and plays no audio itself.

---

## D. The paywall paperwork — for AFTER this is released

None of this blocks 1.4.0. It is what has to be true before the £1.99/month
and £18/year products can go live, and by your own account (08.09) most of it
is part-done. In order of what actually unblocks the next thing:

1. **Apple payment setup / Tax / Banking** (Business → Agreements, Tax and
   Banking). The Paid Applications Agreement is account-wide and unsigned;
   Apple pays nothing until it is signed. Tax and banking sit behind it.
2. **The DSA trader declaration — submit it as "non-trader", now.**
   *Selecting* non-trader is not the same as *submitting* it, and an app with
   no status submitted at all is the one Apple removes in the EU. Non-trader
   does **not** withhold the app; EU buyers simply see a disclosure. It becomes
   untrue the moment you actually sell something, and **do not enter a trader
   address until there is a real one that is not your home address.**
3. **Create the subscription products** — £1.99/month and £18/year ("save
   25%"), 7-day free trial. Optionally a launch-week Founder lifetime at
   £24.99. Only once 1.4.0 is released.
4. **RevenueCat production keys.** The app currently carries a sandbox `test_`
   key; the entitlement is called `premium`. Real keys and real products go in
   together, and `LAUNCH_FREE` flips off in the same change — never before.

A registered business entity is worth weighing before step 1: payments,
business banking and any future trader status all point the same way, and it
is also the only route to getting the App Store's Developer line to read
something other than your own legal name.
