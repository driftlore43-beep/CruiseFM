# Where this goes — Cruise FM's long run, and Strofi

Written 9 August 2026, from a discussion with the owner while build 27 (1.2.0)
sat in review. The question she asked: *does Cruise FM end up as another generic
aesthetic app, or does it grow into something bigger, with Strofi as the next
project?*

This file is the reasoning, not a plan. Re-read it before any decision about
what to build next, and update it when the facts change — particularly the one
fact at the centre of it, which is still unknown.

---

## Part 1 — Cruise FM, honestly

**The risk is real and correctly identified.** "Beautiful music visualiser" is a
category with a download → screenshot → forget pattern. The visuals are a hook,
not a habit, and craft is the *most* copyable thing we have: someone with a team
can ship a mirror ball in a month.

**But "generic" is the wrong word,** and the distinction matters. Generic means
interchangeable, and Cruise FM isn't — nobody else has built this. The real risk
is narrower and more fixable: **beauty alone gives nobody a reason to come back.**

Two paths out:

- **Path A — it's a visualiser.** Keep making modes. Compete on taste, forever,
  against anyone who fancies it. A real ceiling, but small and fragile.
- **Path B — the drive is the product.** Nobody occupies this. Cruise FM is used
  by a specific person, in a specific place, for twenty to ninety minutes, hands
  not free, with a beginning and an end. Spotify and Apple Music are genuinely
  *bad* in a car — built for browsing, not for someone at a wheel. And a drive is
  an **event**, which means it can be remembered.

**The move that turns A into B is the post-drive recap** (already on the ambition
list in AGENTS.md since 25.07, but filed there as one idea among several — it is
more central than that). Strava's product is not the run. It is the *record* of
the run, and that is both what makes it a habit and what makes it spread. Cruise
FM already has the seed — drive stats, the honesty check, badges — but they are
features rather than the point.

**The one fact that decides everything, and it is not yet known: does anyone open
it a second time?** It cannot be answered with two users. There is also no
analytics, deliberately: the privacy policy promises there is no server and that
nothing leaves the phone, so third-party analytics would break a public promise.
Ask testers directly instead.

**The constraint that used to cap this is gone.** Apple Music has **no user
quota**. Since build 23 shipped MusicKit, any iPhone owner with an Apple Music
subscription gets full in-app playback — no allowlist, no five-user limit. The
Spotify dev quota is no longer the ceiling on testing, and recruiting should
target Apple Music users specifically.

---

## Part 2 — Strofi

The owner's description: a social driving and discovery platform for people who
genuinely enjoy driving — discover scenic and exciting routes, create and share
drives, connect with other enthusiasts, attend meetups, build a personal garage
and driving profile. Long-run ambition: an ecosystem connecting drivers with
roads, destinations, automotive brands, businesses and each other.

The ceiling is genuinely higher than Cruise FM's. The risk is not the idea — it
is the order it gets built in.

### The precedent that matters: DriveTribe

Roughly **£9M invested** (£4.8M from 21st Century Fox, £4M from Breyer Capital),
founded 2016 by Clarkson, Hammond and May — the three most famous car people
alive — five years of operation, never profitable, **shut down January 2022**.

**The lesson is in *how* it failed, not that it did.** DriveTribe was a **feed**:
content and community, monetised by advertising. It did no job for you when you
were alone. When ad budgets moved, there was nothing underneath it.

### What has worked in the same space

**Rever** and **Calimoto** — route discovery for motorcyclists. Neither is a
social network. They are **tools**: find good roads, plan a ride, record it. The
community grew *on top of* something people already opened by themselves. Rever
was acquired; Calimoto runs on subscriptions.

So: build a tool people use alone or in twos. The community is what grows on it,
never the thing you launch.

### The wedge — REVISED, and this is the key decision in this document

The first recommendation here was *curated routes, one region, hand-picked*. The
owner then contributed a better idea, from experience: **one-time codes that
share a route privately with the group doing that drive.** She had been out with
drifters who wanted to coordinate, didn't know the exact spots, and kept
switching between apps to manage it.

Why it beats curated routes on nearly every axis:

- **It works at n = 2.** Everything else in Strofi — discovery, meetups, the
  garage, brands — is worthless without a crowd, and cold start is what kills
  community apps. This one does not have the problem: you need a mate who
  drives, not a network.
- **It needs no content from the owner.** Users bring their own routes.
- **It distributes itself.** To use it you *must* send the code to everyone
  coming, so every group share hands the app to four or five people who now have
  a reason to open it. That is built-in growth, not marketing.
- **It came from watching people fail at something**, which beats any imagined
  feature. *"They kept switching apps"* is the cleanest signal that a job exists
  and nobody owns it.

**Order: coordination first, discovery second, community third** — with Cruise FM
feeding people in at the top. Curated routes become the answer to "where should
we go?" *after* the app has answered "how do we go together?"

### Build v1 static, not live

Share the **route** — waypoints, their order, the meeting point — not live
positions of the convoy. Live tracking is the obvious next thought and should be
resisted for v1: a much bigger build, it eats battery, and it drags the product
straight into continuous location tracking and everything that comes with it.
Fast-follow if people actually ask.

### The real step change: it needs a server

Cruise FM's entire privacy position is that there is no account and nothing
leaves the phone — which is why its policy is short and honest. The moment a code
passes between two devices there is infrastructure, storage, uptime and
data-protection obligation. Not a reason to avoid it; just a genuinely different
kind of product to run, and worth knowing before starting rather than three
months in.

### Positioning, and this part is not optional

**Position it as group coordination, not as secret spots.** The same mechanic
serves a club run, a track-day convoy, a scenic drive with friends, a road trip,
a rally. An app marketed on privately sharing hidden locations for street
drifting is an App Store rejection and a liability question; an app for driving
somewhere together with your mates is neither — and it is the same feature. The
drifters who prompted the idea are still served by it. They are simply not the
story on the listing.

---

## Part 3 — How the two fit together

This is the strongest card in the hand, and it is easy to miss by thinking of the
apps as sequential (*finish Cruise FM, then start Strofi*).

- **Cruise FM is Strofi's front door**, and the only free cold-start solution
  that will ever be available. It is already in the App Store, it already
  attracts precisely the person Strofi needs — someone who enjoys driving enough
  to want it to feel like something — and it already knows when a drive begins
  and ends.
- **The recap is the bridge.** A drive that is recorded, mapped and shared *is* a
  Strofi route. Build it once and it is Cruise FM's retention feature and
  Strofi's seed content simultaneously. The first thousand routes come from
  people who thought they were just listening to music.
- **The frequencies fit too, and this matters more than it sounds.** Strava works
  because people run three times a week. Scenic drives happen maybe monthly —
  a structural problem for any log-your-drives product on its own. Cruise FM
  covers the **commute**, which is daily. Together they cover the everyday and
  the occasion; separately, neither does.
- **The parent company is named after Strofi, not after Cruise FM** — Strofi
  Technologies, decided 09.08. That is this section made literal: every Cruise FM
  user reads the word *Strofi* before Strofi exists, which is free groundwork for
  the app with the harder cold start. It replaced Northing, which had been chosen
  for portability — the right goal while neither app had a claim on the name, and
  the wrong one once Strofi became the declared main event. The risk it accepts:
  if Strofi ever pivots or dies, the company carries its name anyway
  (see AGENTS.md, 09.08). A name about roads would have been fine for one app and
  awkward for the other.

---

## Part 4 — The sequencing advice, on record

Strofi is the bigger idea and worth building. But the foundation under **both**
products is whether anyone returns to a driving app from this studio, and that is
currently unknown. Cruise FM answers it cheaply, this month, with ten Apple Music
users. Strofi asks the same question at five times the cost.

**Get the answer from the cheap one first.**

A related caution, recorded because it will recur: the pull toward a new project
is always strongest at exactly this moment — launched, waiting, few users, the
unglamorous part. Sometimes that pull is a good signal and sometimes it is
avoidance. The tell is whether the new idea shares an audience with the current
one, or merely feels fresher. Strofi passes that test; the next idea might not.

---

## Part 5 — What to do while review is open (09.08)

1. **Recruit Apple Music testers.** No quota, no allowlist. Ten of them tell you
   more than the next month of polish.
2. **Watch someone use it cold, without explaining it.** The owner's own *"I felt
   silly explaining it"* is data: if it needs a preamble, the first sixty seconds
   are what to fix — not the modes.
3. **Start the Android clock.** Google's closed test runs 14 days regardless of
   what else is happening, so it may as well be running.
4. **Upload the marketing screenshots** (`screenshots-marketing/`, built 08.08).
5. **Validate Strofi for free.** Go to a car meet and talk to twenty enthusiasts:
   how do they find new roads today, and what did they wish they had on their
   last good drive? One Sunday morning beats a month of building, and it cannot
   be done from a desk.
