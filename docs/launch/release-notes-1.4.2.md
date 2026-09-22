# What's New — 1.4.2

Paste the block under **Use this** into App Store Connect → the 1.4.2 version →
**What's New in This Version**. Written for the person reading it on the update
screen: no build numbers, nothing they cannot see.

Apple shows roughly the **first three lines** before "more".

---

## What this version actually carries, and what it does NOT

1.4.2 is a **widget release**. Every headline item is Swift inside the widget
extension, so none of it could ever have reached anyone over the air — it has
been waiting for a binary since 20.09.

**New in this binary, i.e. genuinely news:**

| Item | Commit | What the person sees |
|---|---|---|
| Pin a tile to a station | `b5d86b2` | Long-press a widget → **Edit Widget** → pick any station, including your own. Leave it alone and it behaves exactly as before ("My last station"). |
| The tiles follow the drive again | `2b615f1` | They were stuck on whatever station they first showed; tapping one also starts a drive that **counts** toward your streak and stats now. |
| The mirror ball takes the station's colour | `4c78239` | The ball was pink on every station. It is the station's own light now — teal on Night Run, warm on Sunset, plain silver on Mountain Pass. |
| Last Played shows the **song** | `60d7ed8` | The three Last Played looks drew the station's photograph under the song's name. They draw the album cover now, with the station as the fallback. |
| The CD, record and mirror-ball tiles, in more detail | `62c724a` `512e5fe` `4672d80` | Real grooves on the pressing, a clear polycarbonate edge and a metal hub on the disc, a denser ball, a contact shadow under the record. |

**Deliberately NOT claimed**, because the public already has it: the Apple
Music playlist-restart fix and the album covers reaching the widgets
(`16784c0`, `d3c2ea8`) are JavaScript and went out on the **19.09 production
publish**, so to everyone on the App Store they are already weeks old. Saying
them again as though they were new is the kind of thing a returning reader
notices.

Also not claimed: the build-64 name fix (`945989f`) and the jewel-case
clearance note (`890dc53`) — nobody can go and look at either.

---

## Use this

```
Your widgets can be pinned to a station now.

Press and hold any Cruise FM tile, choose Edit Widget, and pick the mood you
want it to show — including a station you made yourself. Leave it as it is
and nothing changes: it still follows your last drive.

Also in this update:
• The mirror ball tile finally takes its station's colour instead of
  always being pink
• The Last Played widgets show the song's album cover rather than the
  station's photograph
• The CD, record and mirror ball tiles are drawn in far more detail
• Tapping a widget now counts toward your streak and your stats
```

## Shorter, if you prefer

```
Widgets you can pin. Press and hold any Cruise FM tile, choose Edit Widget,
and set it to the mood you want — or leave it following your last drive.
The mirror ball takes its station's colour now, Last Played shows the album
cover, and the CD and record tiles are drawn in far more detail.
```

---

## Promotional text — **change it**, and this is the one field that costs nothing

170 characters, editable at any time with **no review**, so it is the cheapest
thing on the page to get right and the only one that can be fixed after the
fact.

What is live was written for 1.4.1:

```
Ten mood stations, eight full-screen modes. Try Premium free for 7 days —
and if you were here first, it's yours already.
```

**Its second half is addressed to people who cannot read it.** "If you were
here first, it's yours already" is the early-access grant, and the grant is
decided on a phone that already had the app — so the only person it is true of
is someone who is not on the App Store page looking at promotional text. To a
stranger it reads either as noise or, worse, as an offer being made to them.
It was exactly right on release day and it has expired.

Use this (118 of 170):

```
Ten mood stations, eight full-screen modes, and widgets you can pin to the
mood you want. Try Premium free for 7 days.
```

It keeps the two numbers that do the work, spends the freed half on the thing
this version is actually about, and keeps the trial, which is the reason to
tap. If the widgets should lead instead (132 of 170):

```
New: pin a widget to the mood you want. Ten mood stations, eight
full-screen modes, and your own music. Try Premium free for 7 days.
```

Leading with "New:" is worth more the week of a release and worth less a month
later, which is fine — this field can be changed back whenever, with no review
and no build.

---

## The description — one addition, and it is overdue

**Nothing in the description is wrong.** The FREE section was replaced for
1.4.1 and Apple's Terms of Use link was added for the 18.09 resubmission; both
are the owner's to confirm in App Store Connect, which is the only witness to
what was actually typed (the 21.08 rule — these notes record what was done from
here, not what is live).

What it is **missing** is widgets. They shipped in **1.4.0** and the description
has never mentioned them, so the listing has been selling an eight-mode app for
two releases while the Home Screen half went unsold — and this version is
entirely about that half. Add one section, after **BUILT FOR THE DRIVE** and
before **FREE TO START, PREMIUM IF YOU WANT MORE**:

```
ON YOUR HOME SCREEN
Six widgets. The station that's on air right now, a one-tap Start Drive,
the record you were last on, and the last song you played drawn as a CD
player, a pocket player or a ticket stub. The Mode draws a mirror ball, a
jewel case or a pressing in your station's own colours. Pin any of them to
a mood you choose, or let them follow your last drive. There's a Lock
Screen widget too.
```

Every claim in that block was checked against `targets/widgets/` rather than
written from memory — and the check corrected a stale number in this repo's own
log, which still says **seven** gallery rows from 03.09. It is **six**: On Air
Now, Start Drive, On the Deck, The Mode and Last Played on the Home Screen,
plus On Air on the Lock Screen. The streak widget was deleted on 09.09 and the
Deck's three looks collapsed into one row. Three Last Played looks (CD player,
pocket player, ticket stub), three Mode looks (mirror ball, CD, record), and
pinning on all of them except On Air Now and the Lock Screen.

"In every size" was in the first draft and is **false**: Last Played, On the
Deck and The Mode are one size each. Do not put it back.

Nothing else in the description needs to move for this version.

---

## The rest of the version page, for the same sitting

The name change decided on 15.09 goes in with **this** version, since the name
belongs to a version rather than to the app:

| Field | Value |
|---|---|
| Name | `Cruise FM: Driving Visuals` |
| Subtitle | `Music for how a drive feels` *(unchanged)* |
| Keywords | `road,trip,visualizer,equalizer,mood,night,cassette,vinyl,car,radio,retro,aesthetic,visualiser` |

**The keywords must move in the same sitting as the name.** Apple indexes the
two fields separately and then combines them, so `driving` sitting in both is a
word thrown away — changing the name alone wastes 8 characters.

Build to attach: **67**.
