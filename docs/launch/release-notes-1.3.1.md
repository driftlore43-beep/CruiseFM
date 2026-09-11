# What's New — 1.3.1

Paste the block below into App Store Connect → the 1.3.1 version → **What's New
in This Version**. Written for the person downloading it: no build numbers, no
library names, nothing they cannot see.

Apple shows roughly the **first three lines** before "more".

## Why there is a 1.3.1 at all

1.3.0 is live. A version can only be edited before it is approved, so changing
anything on the listing — even just the screenshots — needs a new version, and
Apple requires the version STRING to go up:

> Invalid Pre-Release Train. The train version '1.3.0' is closed for new build
> submissions… must contain a higher version than that of the previously
> approved version [1.3.0].

So this covers everything since 1.3.0 went out, which is a lot more than a
screenshot change.

**The runtime version deliberately stays at 1.3.0.** It answers a different
question — whether a binary can run a given update — and nothing native has
changed. Moving it would cut every installed build off from updates until it
installed another. See `scripts/preflight-allow.json`.

---

## Use this

```
A light theme for bright days, and a dial that changes as the day does.

Cruise FM now has a light look for driving in the sun — the drives
themselves stay dark. And stations come on air at different times, so
the dial is different when you tune in, with what's on next underneath.

Also in this update:
• Every session leaves a ticket behind: where you listened, how long,
  and what played
• Tell the app whether you're driving or just listening, and it counts
  things properly and calls them by the right name
• Shuffle and repeat work properly — including repeating the whole
  playlist, not just one song
• Long song titles scroll instead of being cut off, sideways too
• Bigger, easier controls when the phone is on its side
• Night Run AM takes its colour from its own photograph
• The record and the cassette sit on the scene properly now
• Gentler reminders, and the app keeps itself up to date
```

## Shorter, if you prefer

```
A light theme for bright days, and a dial that changes through the day
as stations come on air. Every session now leaves a ticket behind, with
where you listened and what played.

Shuffle and repeat work properly, long titles scroll, and the controls
are bigger when the phone is on its side.
```

## Promotional text

The one field editable without a review, so it is where the newest thing
belongs.

```
Ten moods, not ten genres. Now with a light theme for bright days and a
dial that changes through the day as stations come on air.
```

## Screenshots

Two were reshot on 19.08 and should be replaced: `07-tuner-nightrun` and
`03-stations-dial`. The old pair showed Night Run in the jet blue it had
before the station took its colour from its own photograph — measured at
hue 216 against the station's 185.
