# 1.4.1 submission paperwork — the first version with a paywall

Written 17.09.2026, the day the paywall went live on preview and build 60 was
cut; updated the same day when build 61 was cut from the early-access commit
(`16dad95`) — **attach 61, not 60.** Work down it in App Store Connect. Where 1.4.0's paperwork
(`submission-1.4.0-paperwork.md`) still applies it is not repeated — this is
the delta, and the delta is almost entirely about money.

**Read this first: 1.4.1 is a paid-app submission, and everything that was
"No / empty / none" for 1.4.0 is now the opposite.** `LAUNCH_FREE = false`,
the App Store `appl_` key is in `config.ts`, two subscriptions exist in App
Store Connect and RevenueCat serves them. Build 18 was rejected for showing a
price with no products behind it; this time the products exist and **the
build and both subscriptions have to go through review together**, which
Apple's own banner on the subscription page says in as many words for a
first subscription group.

**And the people who were already here keep Premium free.** `utils/earlyAccess`
grants it on any phone that used the app before the paywall reached it. A
reviewer installs fresh and never qualifies, so they see the paywall exactly as
a new customer would. Nothing about that needs declaring, but a line in Notes
for Review (section C) says it anyway, because a reviewer who happens to read
the What's New should not be surprised by it.

---

## Before pressing Submit for Review

1. ~~**Confirm build 61 is in App Store Connect → TestFlight.**~~ **DONE 17.09 — owner confirmed it is in TestFlight, and the listing text (description, promotional text, What's New) is entered.** **SUBMITTED TO APP REVIEW 17.09** with both subscriptions in the bundle, manual release. Production channel shut until Apple answers. The Paid Apps agreement (bank + tax) was still to finish at submission time — see section D; the store will not sell the products until it is Active. A submission
   that was *scheduled* at build time is not one that *happened*, and the
   diagnose tool cannot tell you (08.09). If it is genuinely absent after
   Apple's processing window, run the workflow's `submit` mode — never before,
   a build number can only be uploaded once.
2. **Do NOT install build 60 or 61 on your phone.** They are production-profile
   builds; installing one takes the phone off the preview channel and stops it
   receiving updates (the 02.08 drought). Your phone stays on 57. 61 is
   native-identical to 57, so the launch-on-a-phone rule is already met.
3. **Both subscriptions say "Ready to Submit"** (Monetization → Subscriptions →
   Cruise FM Premium). Each needs its Review Screenshot (already uploaded —
   the real paywall) and a localisation. If either says "Missing Metadata",
   open it and the page names the field.
4. **Availability on both products — check the country count.** It read
   44 of 175 at one point. If Australia, the UK, the US and the EU are not all
   ticked, nobody there can buy, and the paywall shows "Premium isn't on sale
   right now" to them. Tick everything unless there is a reason not to.
5. **The description's FREE section and the promotional text must change** —
   the exact replacement text is in `release-notes-1.4.1.md`. A listing that
   says "nothing to buy" above a subscription is misleading metadata, which is
   its own rejection.

**AND ONCE IT IS SUBMITTED:** no publishing to the production channel while
it is in review. **Specifically, do not let the weekly production-lag Routine
talk you into it** — it WILL report the paywall commits as waiting and offer
to publish, and the answer is no until Apple says yes. The 1.4.0 binary on
the store also listens on runtime 1.3.0, so a production publish now would
put a paywall onto a binary Apple approved as "free with no IAP" — build 18's
rejection wearing a different hat. Preview (your phone, TestFlight) stays
safe.

---

## A. The version page — App Store Connect → Cruise FM → ⊕ → 1.4.1

### A1. Build

Attach **build 61** (version 1.4.1, runtime 1.3.0, commit `16dad95`). It
carries the paywall AND the free-Premium-for-early-users code baked in, so a
customer updating from the store keeps Premium from their very first launch
of 1.4.1 — no one-launch gap.

Build 60 (commit `99e3058`) also exists and is also 1.4.1. It predates the
early-access code. Do not attach it; if App Store Connect offers both, pick
the higher number. Both are native-identical to 57/58/59.

### A2. Attaching the subscriptions — **from the subscription page, not the version page**

**CORRECTED 17.09.** The first draft of this section said to scroll the version
page to an "In-App Purchases and Subscriptions" section. That section does not
exist in the current App Store Connect, and the owner spent a round looking
for it. The way it actually works:

1. Monetization → Subscriptions → open the group **Cruise FM Premium**.
2. Each product must read **Ready for Review**. Press **Add for Review** (top
   right). The page then shows a blue banner, *"This item has been added for
   review, but you can still remove the item"*, and the button greys out.
   That banner is the proof the products are attached — there is nothing to
   tick on the version page.
3. Back on the 1.4.1 version page press **Add for Review**, then on the
   review submission page check the bundle lists **three items**: version
   1.4.1 (build 61), Premium Monthly and Premium Annual. Then **Submit to
   App Review**.

- Premium Monthly — `com.driftlore.CruiseFM.monthly`
- Premium Annual — `com.driftlore.CruiseFM.premium.annual`

This is what "submitted together" means. Miss one and it is reviewed
separately later, and the paywall shows only the plan Apple has approved.

### A3. What's New in This Version

The full block is in `release-notes-1.4.1.md` — leads with "if you were
already with us, it's yours", then what is free and what Premium unlocks.

### A4. Promotional text

Also in `release-notes-1.4.1.md`. The live one says "every one of them free"
and must go.

### A5. Description

Only the FREE section and one bullet change; the replacement is in
`release-notes-1.4.1.md`. Everything else — the Apple-first opening, the ten
stations, the eight modes — stands.

### A6. Screenshots, video, name, subtitle, keywords

**Unchanged from 1.4.0.** The screenshots were shot with no paywall on
screen, which is still accurate: a reviewer or a new customer sees exactly
those screens, with padlocks on the FM band. Nothing needs reshooting for a
padlock. (If you ever want a slide that SELLS Premium, that is a marketing
decision for a later version, not a correction.)

---

## B. The monetisation answers — now "yes"

| Where | Answer |
|---|---|
| Monetization → Subscriptions | **Two products in one group ("Cruise FM Premium")**, both attached to the 1.4.1 version (A2). |
| Monetization → In-App Purchases | Empty — there is no one-off product. (The Founder lifetime idea was never created; leave it.) |
| Pricing and Availability → Price | **Free** to download, unchanged. The subscriptions carry their own prices. |
| Subscription group page → Add for Review | **Both products showing the "added for review" banner** (A2). The version page has no subscriptions section to tick. |
| App Review Information → Sign-in required | **No**, unchanged. |
| App Review Information → Notes | Section C below. |
| Subscription review notes (per product, optional) | "7-day free trial, then auto-renews. Unlocks the FM stations, five visual modes and unlimited custom stations." |
| Paid Applications Agreement, Tax, Banking | Must be **active** before Apple will sell anything. If the agreement still shows pending, the review can pass but the purchases fail at the till. |
| DSA trader declaration | Stays **non-trader** for now. See D3. |
| Export compliance | Already in the binary (`ITSAppUsesNonExemptEncryption: false`). |
| Age rating | 4+, unchanged. |

---

## C. Notes for Review — paste this

```
Cruise FM is free to download. This version adds an optional Premium
subscription (monthly or annual, 7-day free trial) sold through
StoreKit; the products are attached to this submission.

How to reach it: open the Stations tab and tap any FM-band station (the
ones with a padlock), or open Profile and tap "Upgrade to Premium". Prices
on that screen are read from the App Store, not typed into the app.

No sign-in is needed to use the app. Full in-app playback control needs an
Apple Music subscription (or Spotify Premium); without either, the app runs
as the visual layer over whatever the phone is playing and says so on
screen.

The app declares no background modes and plays no audio itself. Nothing
about the user leaves the phone: no account, no server, no analytics.

Existing users: a phone that used Cruise FM before this version keeps
Premium unlocked without paying, decided on the device. A fresh install
(including review) always sees the paywall.
```

---

## D. After Apple approves — in this order

1. **Publish PREVIEW's work to PRODUCTION BEFORE pressing Release.** The
   version is set to manual release, so there is a gap between "approved" and
   "live" — use it. The production publish carries the paywall AND the
   free-Premium-for-early-users code onto every 1.4.0 binary already
   installed (they listen on runtime 1.3.0, same as 61), so an existing
   customer's first launch after the update already knows they qualify. Publish
   AFTER approval and BEFORE release; the workflow's own "is a real build
   listening on this runtime" check must be allowed to run.
2. **Press Release — but not before the Paid Apps agreement reads Active
   (section G).** Build 61's baked bundle already carries the early-access
   code, so someone updating from the store keeps Premium from their first
   launch of 1.4.1. The production publish in step 1 is still needed for
   everyone who has NOT yet updated the binary. **Releasing while the
   agreement is unfinished ships a paywall the store cannot take money
   through**, so day-one customers meet "Premium isn't on sale right now"
   instead of a price. Approval does not expire while you wait; manual
   release exists precisely so the date is yours.
3. **Switch the DSA declaration to trader.** The moment real money moves,
   "non-trader" is untrue. It needs a public address, phone and email on the
   EU listing — **not your home address**; sort a real business address first
   (25.08).
4. **Check the first real sale in App Store Connect → Sales and Trends** a day
   or two later, and in RevenueCat → Overview. A trial that starts shows in
   both; money shows after the 7 days.

---

## E. If it is rejected

The likely reasons, in order:

- **2.3 misleading metadata** — the description or promotional text still
  says "free" / "nothing to buy". Fix the text; no new build needed.
- **3.1.2 subscription information** — **THIS IS WHAT HAPPENED, 18.09, and
  the half predicted here was the wrong half.** This bullet assumed 3.1.2
  would be about the PAYWALL SCREEN, which does show the price, the length,
  what renews and links to Terms and Privacy (15.09), read from the store.
  Apple's rejection was about the **METADATA**: *"does not include a
  functional link to the Terms of Use (EULA) in the app metadata that
  appears on the app's App Store product page."* A different surface, a
  different fix, and no build involved either way. See section F.
- **The subscription itself rejected, the app approved** — happens. The app
  ships; the paywall then shows "Premium isn't on sale right now" until the
  product is fixed and re-reviewed. Nothing breaks.

---

## F. REJECTED 18.09 — 3.1.2, and it is the product page rather than the app

Apple's message, in full: *"The submission offers auto-renewable
subscriptions, such as Premium Monthly, Premium Annual, but does not include a
functional link to the Terms of Use (EULA) in the app metadata that appears on
the app's App Store product page."* Automated, so it never reached a human
reviewer — nothing was judged and nothing about the app was found wanting.

**THE APP IS NOT THE PROBLEM AND MUST NOT BE TOUCHED.** `premium.tsx` has
carried working Terms of Use and Privacy Policy links since 15.09, in the
binary, opening in place through `SettingsSheet`. That requirement is met.
What Apple is asking for is a SECOND link, on the **App Store product page**,
which is written in App Store Connect and not in any build. So: **no new
build, no OTA, build 61 stays attached, the two subscriptions stay as they
are.** It is a text edit and a resubmission.

### F1. The fix — paste this at the end of the description

App Store Connect → Cruise FM → the **1.4.1** version → **Description**.
Leave every word of it alone and add these two lines at the very bottom,
after "Cruise FM is made by Strofi Technologies.":

```
Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://cruisefm.netlify.app/privacy/
```

**Why Apple's own EULA and not ours.** Apple's message offers two routes —
link the standard Terms of Use in the description, or upload a custom EULA in
App Store Connect — and the standard one is the right choice here for two
reasons. It is the agreement Cruise FM is already distributed under (nothing
has ever been uploaded to App Information → License Agreement, so the standard
one is in force whether or not it is linked), and its URL is Apple's own, so
the "functional link" test cannot fail on a website being down. A custom EULA
has to carry Apple's minimum terms and is read by a human, which is a second
review round to fix a link.

The description is ~2,500 characters against a 4,000 limit, so there is room.

**The Privacy line is a second belt.** The Privacy Policy URL field on the
version page should already hold that address; check it matches, and **open
both links in a browser before submitting** — "functional" is exactly what
was checked and exactly what failed. This sandbox cannot reach
`cruisefm.netlify.app` (the proxy refuses it), so nobody here can confirm the
privacy page is up; the owner's own browser is the only witness.

Cruise FM's own terms (`cruisefm.netlify.app/terms/`) are deliberately NOT
named on the product page. They are linked inside the app, where they belong,
and advertising a second document called "Terms" beside Apple's would invite a
reviewer to ask which one governs the subscription.

### F2. Resubmitting — check the bundle is three items again

A rejection returns the whole submission, so the subscriptions are no longer
attached to anything.

1. Edit the description as above. Save.
2. Monetization → Subscriptions → **Cruise FM Premium**: both products should
   still read **Ready for Review** or still carry the "added for review"
   banner. If the banner is gone, press **Add for Review** on each product's
   own page again — A2 above has the detail, and there is still nothing to
   tick on the version page.
3. The 1.4.1 version page → **Add for Review** → confirm the bundle lists
   **three items** (1.4.1 build 61, Premium Monthly, Premium Annual) →
   **Submit to App Review**.
4. Replying to the rejection message is optional and adds nothing here — the
   check is automated, so the resubmission is the answer. Do **not** press
   **Cancel Submission**; edit and resubmit instead.

Everything in section D — production publish BEFORE pressing Release, then the
DSA trader declaration — still stands unchanged for after approval. So does
the Paid Apps agreement, which is still what decides whether the store can
actually sell the products on release day.

---

## G. The money paperwork — do it DURING the review, not after

**None of this blocks the review and all of it blocks the money.** Apple
accepted the submission with the agreement unfinished, so review proceeds
either way — and then the store refuses to sell the subscriptions until it
reads **Active**. Finished during the review it costs nothing; finished after
approval it either delays Release or, worse, is skipped and real customers
meet a paywall that cannot charge them. It is also the likeliest reason for a
subscription product to be knocked back on its own while the app passes.

Where: **App Store Connect → Business** (older layouts call it Agreements,
Tax and Banking). Three things have to go green, and they unlock in order.

### G1. Paid Applications agreement

Request it and accept it. Until this is in place the other two cannot be
filled in. It is between Apple and whoever the developer account belongs to,
which today is an individual, not a company — that is fine and changes
nothing about the app.

### G2. Bank details

An Australian account in the account holder's own name: account name, bank,
**BSB** and account number. Apple pays in AUD to an AUD account with no
conversion.

**These go in Apple's form and nowhere else.** Not in chat, not in this
repository, not in a screenshot sent anywhere. Nothing in this project ever
sees a payment.

### G3. Tax forms

Two of them, and both are normal for an Australian developer.

- **US W-8BEN** — required of everyone outside the United States. It tells
  the US you are not a US taxpayer, and the Australia/US treaty then drops
  the withholding on US sales to **0%**. Skip it and the US keeps 30% of
  every American sale. It is short and self-service.
- **The Australian tax form** — asks for an **ABN** and whether you are
  registered for **GST**. Answering it honestly is the whole job; whether to
  get an ABN, and whether GST registration applies, is an **accountant's
  question and not one for this file** (raised 25.08 and still open). You can
  complete the form without an ABN. The GST threshold is a turnover test, so
  at launch scale it is very unlikely to bind, but that is context rather
  than advice.

### G4. Then enrol in the Small Business Program

Once the agreement is Active, enrol (App Store Connect → Business). It cuts
Apple's commission from **30% to 15%** on up to a million US dollars a year.
It is free, it takes one form, and at this scale there is no reason not to.
It applies from the start of the next month, so earlier is better.

### G5. What to expect afterwards

- Nothing arrives immediately. Apple pays roughly **a month after the end of
  its own fiscal month**, and only once the balance clears a small minimum.
- A 7-day trial shows as a subscriber in **Sales and Trends** and in
  RevenueCat straight away; the **money** appears a week later, when the
  trial converts.
- **Payments and Financial Reports** is where the real numbers live. Sales
  and Trends is the live view, Payments is what was actually paid.
