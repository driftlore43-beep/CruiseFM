# Cruise FM — Remaining Work

**Re-audited 2026-11-10 at commit `f0d2659`.** The previous version of this file
was audited on 05.09 and last touched 05.10; most of it described work that has
since shipped, and it still led with a widget mockup round that is now in the
store. It has been rewritten rather than ticked off — §9 lists what closed, so
nobody re-opens it.

Two columns run throughout: **CODE** (an agent can do it) and **OWNER** (only
Jessica can — Apple's site, App Store Connect, a real phone, her own browser).

> **THE SITUATION CHANGED SHAPE AND SO HAS THIS LIST.** The app is finished,
> released, paid, and live in every storefront including the EU. The question
> is no longer *is it built* — it is **does anyone buy it**. Six weeks of
> Premium on sale have produced **no trial started**, and as of 03.11 we know
> at least part of why. So this list is ordered by what moves that number, and
> the code work left is small and mostly deliberate.

---

## 0. THE ONE QUESTION — read it on 17 November

The padlock fix reached every public phone on **03.11**. Seven of the ten
stations had been a padlock that did nothing: pressing one produced no page, no
taste and no price, so most of the dial could never show anybody what Premium
was. A fortnight from that publish is **17.11**, which is the first date the
numbers mean anything.

**OWNER — read two things, in this order:**

1. **RevenueCat** — has any *trial started* at all?
2. **App Store Connect → Analytics → product page views**, against downloads.

Three answers, three different problems:

| What you see | What it means | What follows |
|---|---|---|
| A trial appears | The dead padlock was the cause | Keep going; the fix worked |
| Zero, page views healthy | People see the listing and don't install | The listing's job — screenshots, first three especially |
| Zero, page views low | Nobody is finding it | Discovery. No change inside the app fixes this |

**Do not read them before the 17th.** Four days of data on a slow-trickle app
is noise, and acting on noise is how the wrong thing gets rebuilt.

---

## 1. OWNER — status unknown, and nothing here can see it

Three were put on the calendar for 08.11; two are now closed on the owner's
word, so **one is left**. **This repo cannot verify it**, and the 18.09 lesson
applies: a belief recorded as a fact is indistinguishable from a fact when it
is read back. Marked unknown on purpose rather than assumed outstanding.

- [ ] **Promotional text** — `docs/launch/listing-1.4.3.md` §6 holds the 135
      characters. No review, live on save. **One unwrapped line** — App Store
      Connect keeps the breaks you paste, which this project has been caught by
      in three separate fields.
- [x] **The published DSA address — DONE, owner confirmed 10.11.** The EU
      product page carried her **home address** from 07.09 to at least 12.10; it
      now carries the Anytime Mailbox one. That closes the 25.08 open item and
      the whole chain that started with a stranger in Czechia on 06.10.
      Recorded on her word: `apps.apple.com` answers http 000 from this sandbox
      for every storefront, control storefronts included, so nothing here can
      confirm a listing field — ever.
- [x] **Reply to Tomáš Janů — DONE, owner confirmed 10.11.** He wrote
      unprompted with nothing to go on but a dead link, guessed the cause was
      on our side and specific to the EU storefronts, and was exactly right.

---

## 2. OWNER — open, and worth doing

- [ ] **The weekly lag Routine names a dead branch.**
      `trig_011Pjg2StJ2NSB1xf9pkPjJC` tells its session to work on
      `claude/cruise-fm-v4wk5f`, and `main` became canonical on 12.09. Read off
      the remote on 10.11, that branch's tip is `6ed6cfe` (13.09) and is **not**
      an ancestor of main — the two histories are divergent, 731 commits one way
      and 51 the other — so what a firing actually does there cannot be known
      from here: the last production publish is not reachable from it, so the
      script either names a pile of irrelevant commits or exits 2 because the
      commit is missing. Either way the Routine is designed to **say nothing on
      exit 0**, and **a check that always reports healthy and a check that is
      dead look identical from outside.** The fix is one line of its stored
      prompt;
      changing it needs her approval, so it is flagged rather than edited.
      **Until then, its silence is not evidence.**
- [ ] **Trademark — the Australian search has still never been run.** IP
      Australia is the home registry (`search.ipaustralia.gov.au`, or its free
      TM Checker), AUD $250/class standard or $330 via TM Headstart, which puts
      an examiner on it first. The EU/UK/worldwide searches already done say
      **nothing** about who holds *Strofi* in Australia. `docs/brand.md` has the
      detail, including why a Greek restaurant and a song are almost certainly
      not blockers (different class, different territory).
- [ ] **A real domain.** Every share card that leaves the app prints
      `cruisefm.netlify.app`. When it changes, `INSTALL_HOST`
      (`ShareCardStyles.tsx`) and `INSTALL_URL` (`ShareCard.tsx`) move
      **together**. Checked 12.08: `cruisefm.app`, `cruise.fm`, `strofi.app`
      had no DNS — not proof of availability, confirm at a registrar.
- [ ] **The App Store Developer line still reads JESSICA ARROYO.** On an
      individual account that is the account holder's legal name and cannot be
      set to a studio name. Changing it needs an Organization account (a
      registered business plus a free D-U-N-S number) or Apple granting a
      trading name with documentation. **Worth one support ticket first** — far
      cheaper if allowed. `docs/brand.md` §5.

---

## 3. CODE — needs a build (cannot ship over the air)

Nothing here is urgent, and one of them now matters for the reason in §0.

| # | Item | State |
|---|---|---|
| 1 | **The native rating prompt** | **NOT DONE — verified 10.11.** `RateCard.tsx` still calls `Linking.openURL(REVIEW_URL)`, which throws people out of the app. Apple's in-place StoreKit prompt gets answered far more often, and the listing has almost no ratings, which to a stranger reads as *nobody uses this*. The rules in `rateApp.ts` do not change — only where the tap goes. **This is the one code item with a plausible effect on §0.** |
| 2 | **iPhone Duo screenshots** | Optional until **April 2027**, per Apple's release notes of 05.10, so it blocks nothing. The app already *behaves* correctly on a foldable (07.10, shipped 08.10 — iOS's own idiom, so an unfolded Duo is still a phone and its drives still count). What is untested is the **nearly-square inner screen** against every deck's hero sizing, and widget tiles at sizes nobody has drawn, on two screens. **See it before photographing it** — a screenshot is a claim about how the app looks on a device. |
| 3 | **The Live Activity** | The lock-screen banner that also lights up the CarPlay Dashboard for free, which for a driving app is the best-fit surface available. Deliberately unscheduled: its open question is that the app may not be running when the song changes, and a remote push needs a server, which contradicts the privacy promise. **Re-verify the CarPlay behaviour at build time**, not from this note. |

Also unchecked and cheap: **whether the iPad 13" screenshot slot still wants
2064 x 2752.** Apple moved the iPhone sizes under us without warning on 13.10
and nobody has looked at whether the iPad ones moved too. The existing set is
on the listing from 1.4.2 and blocks nothing.

---

## 4. CODE — ships over the air

The honest answer is that there is very little, which is what a finished app
looks like.

- [ ] **`website/support/index.html`** still carries one leftover violet accent
      from the pre-July palette (known since 26.08). Hand-authored, so it needs
      her own manual Netlify drag — signed in as **cruisefmservice@gmail.com**,
      not her personal GitHub login. **Never hand-edit `website/privacy/` or
      `website/terms/`** — `scripts/gen-legal.mts` generates them.

---

## 5. TECHNICAL DEBT — verified 10.11, safe, low priority

- [ ] **Delete the five dead template files**, which is also the whole of this
      repo's use of Reanimated: `src/app/explore.tsx`, `src/app/visuals.tsx`,
      `src/components/ui/collapsible.tsx`, `src/components/animated-icon.tsx`,
      `src/components/animated-icon.web.tsx`. Measured: those five are the
      **only** importers of `react-native-reanimated` left in `src/`. Whether
      the package can then leave `package.json` is a separate check, not an
      assumption — react-navigation has depended on it before.
- [ ] **Drop `expo-dev-client`** (~56.0.20) from a store binary; it adds
      `NSLocalNetworkUsageDescription`. **Not mid-release.**
- [ ] **`assets/images/intro/`** — 4 orphaned files, dead since `BrandIntro`
      was deleted on 28.07.
- [ ] **Vinyl and Cassette still run their own clocks** (`progress.addListener`
      in both), separate from `useTrackClock`. Three copies have had to be
      fixed in lockstep more than once — the coast cap on 18.08 found Cassette
      still carrying the original bug.
- [ ] Tuner: `TunerReadout` builds a new `toFixed(2)` string every frame,
      defeating `React.memo` (~1000 SVG nodes/frame during the snap). **Only if
      the dial still feels sluggish on a device.**

~~`reelTo` in `TunerMode.tsx`~~ — already gone, verified 10.11.

---

## 6. GROWTH — where the constraint actually is

At roughly 3–5 downloads a day, discovery is the binding constraint and has
been since launch. Two facts bear on it that the old version of this file could
not have known:

- **The EU was dark from launch until 12.10** — all 27 storefronts, ~450m
  people. Every download figure read before that date was measured with the
  largest market switched off.
- **Everyone who used the app before 19.09 holds `earlyAccess`** and can never
  be a customer, by design. That is correct and it also means the paying
  population starts from zero on that date.

- [ ] **Keywords and the first three screenshots** are all anyone sees in a
      search result. The keyword field is at 99 of 100 characters since 09.10.
- [ ] **Ask testers where they actually use it** — car, room, both. There is no
      analytics and never will be, so this can only be asked. It bears on
      whether the driving frame is right at all: the owner herself uses it
      stationary, in her room, for fun (11.08).
- [ ] **Ratings** — see §3.1. The surface exists; the prompt is the wrong kind.

---

## 7. IDEAS RECORDED, NOT SCHEDULED

- **Strofi**, the next product — a social driving / route platform. Full
  thinking in `docs/strategy.md`. The wedge is the owner's own idea: **one-time
  codes that share a route privately with the group doing that drive.** It works
  at n=2, which is what kills most community apps. Needs a server — a genuine
  step change from Cruise FM's no-account, no-server position.
  **Someone else shipped the same idea**: *CruiserFM* (developer MOHAMMAD KHALED
  TORYALAE, v1.2.5 as of 19.09) carries cruise codes, a lobby, waypoints, live
  positions and push-to-talk. The idea was right; the question is whether it is
  working for him, and his **reviews** are the number to read.
- **A post-session recap.** Repeatedly raised and repeatedly narrowed: it must
  never claim a *drive* happened, because the app cannot tell — which is why the
  "Are you driving?" card exists. The session stub built on 13.08 is the honest
  version of it and already ships.
- **Beat-locked visuals are closed, permanently.** Spotify answers 403 on both
  `/audio-features` and `/audio-analysis` for an app registered after Nov 2024
  (measured 09.08 on a real drive), and Apple publishes no equivalent. The only
  route that gives both tempo *and* phase is the microphone, removed on 22.07
  for Bluetooth road noise and audio-session contention. **Do not re-propose a
  metadata route.**

---

## 8. RELEASE CHECKLIST (short form)

`docs/launch/pre-submission-checklist.md` is the full version. **Run it.**

1. `node scripts/preflight.mjs` — read **every** line
2. Bump `version` **and** `runtimeVersion` together if native changed
3. Build on the **`testflight`** profile for the phone, **`production`** for the
   store. **Never install a production-profile build on the testing phone** —
   it moves her off the preview channel and work silently stops reaching her
4. **Open the build on a real phone before it goes near Apple.** Build 25
   crashed 40 ms into launch over a native module mismatch no static check
   could see. A launch is the only proof
5. Move `provenCommit` in `preflight-allow.json` **only after** that launch
6. A finished build is **not** a submitted build — run the workflow's
   `diagnose` mode and read the "submitted to App Store Connect" line
7. While in review: **no production-channel publish** at the runtime that build
   listens on. Preview stays safe
8. After approval and release: check the store page actually loads

---

## 9. CLOSED SINCE THE LAST AUDIT — do not re-open

Everything below was open on 05.10 and is done. Dates are when it landed.

| Was | Closed |
|---|---|
| Widget design refinement (mockup stage, §0 of the old file) | Ported to Swift and shipped — builds 70/71/72, Sept 25–Oct 1 |
| The App Group, and the widget's own app ID | Registered; builds 33–37 are history |
| The widget extension "written, wired, never run" | Live on real Home Screens, confirmed by photograph 13.10 |
| iPad "the home page is a stretched phone" | Fixed 10.09 — all four tab pages take a capped reading column, tab bar capped to match, hero alignment fixed 14.09 |
| iPad screenshots blocked on that decision | Eight shots at 2064x2752, on the listing since 1.4.2 |
| The app preview video | Shot and cut 15.09; she chose to ship the footage as-is |
| Apple Music repeat/shuffle "verify on a real phone" | Proven on a stranger's phone 23.09 (MediaPlayer 1 → 3 on both surfaces) |
| Store listing rewrite / the name | `Cruise FM: Driving Visualizer`, applied 09.10 with the 99-character keyword field |
| **The whole paywall section** | Built and on sale since 1.4.1 released 19.09 — real products, real RevenueCat key, `LAUNCH_FREE = false`, `OWNER_MODE = false` |
| Grandfathering the early users | `earlyAccess.ts`, 17.09 — evidence-based rather than a date or a head count, permanent in both directions |
| Paid Applications Agreement, tax, banking | Active since 25.08 (the 17.09 note that it was unfinished was never true) |
| Small Business Program (15% not 30%) | Submitted 18.09, approved 10.10 |
| EU trader declaration | Verified 12.10; all 27 storefronts live, confirmed by `de` and `cz` loading in her browser |
| `reelTo` dead code | Gone |
