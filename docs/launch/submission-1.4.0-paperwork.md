# 1.4.0 submission paperwork — every field, in order

Written 15.09.2026 for the submission itself. Work down it in App Store
Connect; each field says what to paste, whether it needs a review, and — where
it is a decision rather than a copy job — what the choice costs either way.

> **STATUS 15.09.2026: the owner reports the listing is entered.** Read the
> rest of this as a RECORD of what was decided and why, not as a to-do list.
> **It is not evidence about what is live** — this repository only knows what
> was written here, and App Store Connect is the only thing that knows what
> was actually typed in (the 21.08 lesson, where these notes lagged reality by
> three releases). Anything below that still reads as outstanding is listed in
> "Before pressing Submit for Review", directly under this.

**The one-line summary of the paywall question: there isn't one in 1.4.0.**
`LAUNCH_FREE = true` in `src/constants/config.ts`, so every station and every
mode is unlocked for everybody, `premium.tsx` refuses to draw an offer at all,
and preflight fails the build if that guard is ever removed. So every
monetisation answer below is **No / empty / none**, and that is the correct
answer rather than an omission. See the last section for the paperwork that
attaches to a paywall — it is real, it is outstanding, and **none of it may be
started until 1.4.0 is through review.**

---

## Before pressing Submit for Review

Four things, and the first is the only one that can cost a review cycle.

1. **Put build 57 on the phone from TestFlight and open the three widgets.**
   1.4.0 changes native code, and this project's own rule — earned on build 25,
   which crashed 40ms into launch — is that such a build is LAUNCHED on a real
   phone before it goes to Apple. 57 is native-identical to 59, so it satisfies
   the rule; installing 59 would knock the phone off the preview channel and
   stop it receiving updates (the 02.08 drought).
2. **Confirm build 59 is actually in App Store Connect.** A submission that was
   *scheduled* at build time is not a submission that *happened*, and the
   diagnose tool cannot tell you either way (08.09). Only the TestFlight list
   can.
3. **Upload the preview video before pressing Submit**, into the iPhone 6.7"
   slot only. It is reviewed together with the build, so adding it afterwards
   means another pass.
4. **Nothing waits on the compliance verification.** The app is free with no
   products, so its review does not depend on that clearing. See section D.

**AND ONCE IT IS SUBMITTED**, the standing rule applies: no publishing to the
production channel while a build is in App Store review. Preview stays safe,
so work can carry on reaching the phone and TestFlight as normal.

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

### A6. App name, subtitle, keywords — **the name changes with this version**

These three belong to a *version*, so this submission is the moment.

| Field | Type this |
|---|---|
| Name | `Cruise FM: Driving Visuals` |
| Subtitle | `Music for how a drive feels` *(unchanged)* |
| Keywords | `road,trip,visualizer,equalizer,mood,night,cassette,vinyl,car,radio,retro,aesthetic,visualiser` |

**The name was decided on 10.08 and never actually typed in** — the live
listing still says plain `Cruise FM`, which spends all nine characters of the
single most important field in App Store search on a brand name carrying no
search terms at all. The suffix puts *driving* and *visuals* into the strongest
field there is.

**The keywords change because the name did, not for their own sake.** Apple
indexes the name and the keyword field separately and then combines them, so a
word in both is a word wasted: `driving` is now in the name and had to come out,
which freed 8 characters. `commute` came out too, to make room for
**`visualiser`** — Apple does not map British and American spellings onto each
other, the owner is in Australia, and "music visualiser" is exactly what this
app is, while somebody typing "commute" wants a journey planner. Change the two
fields in the same sitting; changing the name alone leaves 8 characters
throwing themselves away.

**The subtitle is deliberately left alone.** It was chosen for search, and the
15.09 round that took the driving language out of the app's own taglines
deliberately did not touch it — dropping "drive" there would trade findability
for tidiness, which is a decision rather than a tidy-up, and not one this
submission needs to make.

**This is the store listing name only.** Do not touch `expo.name` in
`app.json` — that is the name under the icon, where iOS truncates at about
twelve characters and "Cruise FM: Dri…" is what you would get. The two are set
in different places and are meant to differ: one is for being found, the other
for being recognised. No code changes.

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

### If "compliance" sits in review for more than a few days

Reported 15.09: Business showed complete while the compliance item stayed in
review for over a week. Two things about that.

**It does not block this release.** 1.4.0 is free with no products, so nothing
about the app's own review depends on the verification clearing. Do not hold
the submission for it. What it holds up is getting PAID, which matters at step
3 above and not before.

**CHECK THE SERVICE INBOX BEFORE ASSUMING APPLE IS SLOW.** A verification that
appears stuck is very often one where Apple asked for a document and the
message went to the account's own email — and the developer account is
`cruisefmservice@gmail.com`, not a personal address. This project has already
lost a day to exactly that shape once (26.08, where the Netlify site turned out
to belong to that inbox rather than a personal login), so it is the cheapest
thing to rule out and it costs one search.

If the inbox is clear, contact Apple rather than waiting: App Store Connect's
own Contact Us, or developer.apple.com/contact, under Agreements, Tax and
Banking. A week with no word is past the point where waiting is telling you
anything.

A registered business entity is worth weighing before step 1: payments,
business banking and any future trader status all point the same way, and it
is also the only route to getting the App Store's Developer line to read
something other than your own legal name.
