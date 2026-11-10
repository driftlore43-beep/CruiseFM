# Cruise FM — The Widgets, As Shipped

**Rewritten 2026-11-10 at commit `b3edd34`**, read off the Swift rather than
recalled.

**This file used to be something else, and that matters.** It was a 368-line
executable brief for mockup work on two designs — the Mirror Ball's silhouette
and shading, and the CD's case and diffraction — written 08.09 when that was the
one task mid-flight. **All of it shipped.** The mirror ball was ported to the
app's own chrome recipe on 10.09, its colour fault fixed on 22.09, the CD's case
and fan rebuilt on 10.09 and 21.09, and the whole extension went to the store in
**1.4.3 (build 72)**, released 02.11. A step-by-step brief for finished work is
the most misleading thing a doc set can contain, and this one was named in the
project's own "read this first" table — so it is now a **reference to what
exists**, not a task.

---

## 0. The thirty-second version

The widgets are a **WidgetKit extension in Swift**, at `targets/widgets/`, built
through `@bacons/apple-targets`. They are **not JavaScript**: nothing about them
can ship over the air, so every change waits for a build.

They are also a **separate process with its own sandbox**. The extension cannot
call into the app, cannot reach a music service, cannot read the app's
AsyncStorage and cannot see the app's bundle. Everything a tile draws was
written down in advance by the app, into a shared App Group container. That one
fact explains almost every design decision below.

---

## 1. The six gallery rows

A **row** is what someone sees in the widget gallery. A **look** is a different
way of drawing the same idea, picked by long-pressing a placed tile.

| Row | `kind` | Sizes | Looks | Draws |
|---|---|---|---|---|
| **On Air Now** | `CruiseOnAir` | small, medium | — | The schedule: what is on air this hour, and what follows |
| **Start Drive** | `CruiseStartDrive` | small, medium | — | The station's photograph full-bleed with a play button; one tap starts a drive |
| **On the Deck** | `CruiseFMVinyl` | medium | Road, Label | A record, on the station's photograph or on its own printed sleeve |
| **The Mode** | `CruiseMode` | small, **large** | Mirror Ball, CD, Record | The mode as an object. Large draws a whole deck — tonearm, three silver keys, the ground painted in the album's own colour |
| **Last Played** | `CruiseLastPlayed` | medium, **large** | CD player, Pocket player, Ticket stub | The last song, as an object |
| **On Air** (Lock Screen) | `CruiseLockScreen` | accessoryRectangular, accessoryCircular, accessoryInline | — | The dial and the station, on the Lock Screen |

**A size is declared for the whole ROW, not per look.** `.supportedFamilies`
sits on the `Widget`, so offering a large tile for the Pocket player offers it
for the CD window and the stub as well — which is why all three had to gain tall
arrangements at once, rather than being drawn stretched at a size the gallery
advertises.

### Pinning

Every tile defaults to **"my last station"**, which is exactly what all of them
did before pinning existed — so a tile already on a Home Screen kept behaving as
it had, with no migration and no default value declared anywhere.

A tile can instead be **pinned to a station**, including one the driver made
themselves. That forces an `AppEntity` rather than an `AppEnum`: a list written
into the binary cannot contain stations that did not exist when it was compiled,
so `StationQuery` reads the pickable list **out of the snapshot**, because
`suggestedEntities()` is asked while the app is not running.

Two rules there are load-bearing:

- **The sentinel.** The list's first row has an empty id and means the same as
  nil. An optional parameter gives no reliable way back, and a setting you can
  change but not undo is worse than no setting.
- **An unknown pinned id falls back rather than blanking.** A pinned station can
  be deleted, and a tile that goes empty over it looks broken when the default
  behaviour is a perfectly good tile.

**On Air Now** and the **Lock Screen** row are deliberately not pinnable — the
first is about the schedule rather than a station of yours, and the second is
iOS 16-capable while `AppIntentConfiguration` is 17+.

---

## 2. How the data gets there

```
the app  →  widgetData.ts  →  setSnapshot(json)  →  App Group  →  Snapshot.swift
```

`src/utils/widgetData.ts` builds the snapshot; `modules/cruise-widgets` is the
bridge, whose one job is to write it and call `WidgetCenter.reloadAllTimelines()`.

**Three rules, each of which was learnt by breaking something:**

1. **A field ADDED to the snapshot must be optional in Swift, in its own build,
   before the JS starts sending it** — and a field being REMOVED goes optional
   first too. Swift's decoder is all-or-nothing: one required property missing
   and the whole decode returns nil, blanking every tile at once with nothing
   logged anywhere. A binary already on a phone keeps being handed newer
   snapshots by an app that updates over the air.
2. **`scripts/test-widget-contract.mjs` is what holds the two sides together.**
   It reads the property names straight out of the shipped Swift, checks them
   against a snapshot built by the shipped TypeScript, and asserts the App Group
   string and storage key match across all three files. If those disagree the
   widgets read an empty container for ever, with no error.
3. **Republishing is the caller's job, and the order matters.**
   `rememberCruise.ts` saves the cruise and republishes as one action, in that
   order — the publish READS the cruise back out of storage, so a publish that
   ran first would hand the widgets the previous station. It could not go inside
   `saveLastCruise` because `widgetData` imports `lastCruise`.

### What a tile may and may not claim

- **"LAST PLAYED", never "now playing".** iOS redraws a widget a handful of
  times a day and the poll stops when the app is backgrounded, so the app often
  does not know what is playing. A claim about the past does not go stale; that
  one word is the whole of this row's honesty.
- **`currentOnAir(at:)`, never `onAir.first`.** The snapshot carries a
  *timeline* — entry 0 is "now" at the moment the app wrote it, the rest are the
  day's changeovers each stamped with the minute it happens, which is the trick
  that lets a tile change through the day with the app never running. Taking the
  head of that list presented a hours-old station as current, which reads as a
  widget that has **stopped working** rather than one that is wrong.
- **No control may be wired to anything.** The three silver keys on the big deck
  and the Pocket player's wheel are furniture — part of the object whether or
  not anything is playing. A key that looked live would be broken, because the
  extension cannot reach a music service (§5 and `KNOWN_ISSUES.md` §2.9).
- **The paywall is not in the extension and must never be.** The station picker
  offers the FM band to everyone and marks it, the same shop-window rule the
  Stations page follows; `premium` and `isPro` travel in the snapshot for
  presentation only. A widget reads a file out of shared storage, so a lock
  decided from that is a lock anyone can edit. `test-widget-bundle.mjs` fails if
  any Swift file so much as branches on those two fields.

---

## 3. Standing rules for a target with no compiler

**Swift cannot be built, rendered or photographed in this environment.** A
mistake in the extension is invisible until a build burns a review cycle, and
three builds have died on Swift that read perfectly (40, 41, 64). So:

- **`scripts/test-widget-bundle.mjs` is the compiler this environment does not
  have.** It checks what is checkable: every declared `Widget` is registered in
  the bundle (one written and never registered is simply absent from the gallery
  with nothing logged); a configurable widget always has a pre-17 fallback **on
  the same `kind`** (a changed kind makes a placed tile vanish); nothing is
  declared twice across the target, since every file compiles into one module;
  no **bare call** names something the target does not declare (which is what
  build 64 died on — one `placeholder` still calling a helper that had been
  renamed); and a long list of design rules proven to fail before being
  believed.
- **Balance-check every edited file** for braces, parens and brackets — with
  **string literals stripped BEFORE comments**, or a `//` inside
  `"cruisefm://drive"` eats the rest of that line and its closing bracket.
- **Prefer the version with fewer ways to be wrong.** A method written against a
  protocol the type does not conform to compiles as a method nobody calls, and
  nothing here would notice.
- **A size must be a share of its tile, never a number of points.** WidgetKit
  hands a large tile a different box on every screen — 329x345, 338x354,
  360x379, 364x382 — and fixed numbers were exact on one phone and 1pt over or
  36pt short on the others.
- **A `GeometryReader` aligns its content top-leading, not centre**, so anything
  inside one needs an explicit frame or it is silently pushed off two edges.
- **Nothing structural may carry a hue.** The material is neutral chrome and the
  LIGHT carries the mood — the app learnt this on its own mirror ball in round
  22 and the widget's copy had drifted back to three hues.
- **A widget cannot animate itself.** Settled three times (20.08, 27.08, 19.09):
  iOS budgets a widget to a handful of redraws a day and only countdown-style
  text may animate. Every app, not just this one.

### And the rule no check can replace

**A build that changes native code must be LAUNCHED on a phone, with the tiles
actually placed, before it goes to Apple.** A build that compiles is not a build
whose gallery offers the new size.

**A tile already on a Home Screen must be removed and re-added to be judged** —
iOS caches a widget's last successful draw **per placed tile**, so a tile can be
older than the app that drew it, and an unchanged-looking tile after an update
is the cache rather than the work. Two tiles on one Home Screen have been
observed rendering from different builds at once.

---

## 4. The design harnesses

The owner reviews this work **visually**, and so should you. `docs/design/`
draws a tile in Python or HTML so a design can be approved before anyone writes
Swift:

| File | Draws |
|---|---|
| `v3.py` + `shot4.mjs` | The original ten-design gallery sheet |
| `ball.py`, `ball_widget.py` | The mirror ball, with the app's own shading model |
| `cd_widget.py`, `cd_case.py`, `cd_window_tall.py` | The CD disc, its jewel case, the big Winamp window |
| `record_widget.py`, `turntable_{one,two}.py` | The record, and the big deck's tonearm geometry |
| `ticket.py`, `ticket_tall.py` | The ticket stub, wide and tall |
| `cassette_widget.py`, `big_tiles.py` | The cassette, and the large family |
| `assets.py` | Resolves the **repo's own** fonts and station photographs |

Run everything **from the repo root** — `assets.py` resolves relative to it, so
running from `docs/design/` fails on a missing font; set `CRUISE_ROOT` if you
must. Then **look at the picture**: faults that reading the code cannot find
have been caught that way repeatedly — a barcode across an artist's name, a
sleeve opening that drew perfectly and showed nothing because the record covered
it, a tonearm's stylus sitting on the label, a counterweight sliced off by the
tile's rounded corner.

**`assets.py` reading the real files is deliberate.** An earlier harness inlined
base64 copies of the fonts and photographs, which die on a container reset and
can drift from what ships, so a mockup could show a station in a colour the app
does not have.

> **The mockup is a proposal until the Swift exists, and a lie about the Swift
> afterwards unless it is kept in step.** That has cost a round of confusion
> three times. See `KNOWN_ISSUES.md` §3.18.

---

## 5. What is not done

- **The iPhone Duo's tile sizes.** Two screens, and the outer 5.4in is very
  likely the narrowest window this app has ever been handed. `KNOWN_ISSUES.md`
  §1.1 has the detail; nothing is blocked, since Duo screenshots are optional
  until April 2027.
- **A Live Activity.** The biggest thing left on the widget list and the one
  that would also light up the CarPlay Dashboard for free. It needs its own
  round, and it needs the open question answered honestly: keeping it in step
  with the actual song needs either the app running or a server, and there is no
  Cruise FM server by design. The buildable scope is "a drive is in progress" —
  station, mode and a native ticking timer — rather than a song-by-song tracker.
- **A refresh button that does something.** Not a design gap but a platform
  one; `KNOWN_ISSUES.md` §2.9 records why, including the route Apple names and
  why this app has already been rejected over it once.
