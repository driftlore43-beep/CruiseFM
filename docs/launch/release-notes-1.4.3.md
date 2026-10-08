# What's New — 1.4.3

Paste the block under **Use this** into App Store Connect → the 1.4.3 version →
**What's New in This Version**. Written for the person reading it on the update
screen: no build numbers, nothing they cannot see.

Apple shows roughly the **first three lines** before "more".

The rest of that version page — description, keywords, subtitle, name,
screenshots — is in `listing-1.4.3.md`. This file is the What's New only.

---

## What this version actually carries, and what it does NOT

1.4.3 is a **widget release**, and more completely so than 1.4.2 was. Every
native line changed since the 1.4.2 store build (**build 67**, commit
`4c78239`) is Swift inside the widget extension — `git diff 4c78239..HEAD --
modules/ targets/` touches exactly four files, all of them
`targets/widgets/*.swift` — so none of it could ever have reached anyone over
the air. It has been waiting for a binary since **24.09**.

**New in this binary, i.e. genuinely news:**

| Item | Commit | What the person sees |
|---|---|---|
| The widgets have a **large** size | `e92197e` | Nothing in the app offered one before: every tile was small or medium. Press and hold the Home Screen, add a **large** Cruise FM tile, long-press it to pick the look. |
| The big record is a whole turntable | `7288aa5` `b52d784` | A slim tonearm resting on the outer grooves and three silver keys along the foot, instead of a record on its own. |
| The deck is painted in the album's colour | `1027c6f` | The ground the record stands on takes the average colour of whatever is on the label, so the tile changes with the song. |
| The big CD player is the whole window | `180e591` `aed3e9f` `a779f16` | The Winamp-style window runs to the tile's own edges, with the share card's key cluster beside the cover, type sized for the bigger box, and LAST PLAYED where the scrub bar cannot honestly go. |
| The big ticket stub tears across | `e2a4de2` `a73be61` | A proper stub rather than a stretched boarding pass: the album cover takes half the ticket, the song sits on the tear, the barcode is bigger and in the corner. |
| The small tiles, in more detail | `33ee534` `740f76b` | The record's grooves read as cut rather than printed, and the CD's cover reads through a case that stops shouting. |

**Deliberately NOT claimed**, because the public already has it: everything
JavaScript. Production was published on **05.10** (`50a57d3`) and **08.10**
(`ee2ec02`), so Ethan's fourth round (a widget tap restarting the playlist, a
station that did nothing and then froze, the black screen with no way out), the
record taking the width it has, and the folding-iPhone tablet test all reached
real phones weeks and days ago. Saying them again as though they were new is
the kind of thing a returning reader notices — the same call 1.4.2 made.

Also not claimed, because nobody can go and look: builds 68–72, the listing
rewrite, the sweeps, and the trader paperwork.

---

## Use this

```
Cruise FM widgets come in a large size now.

Press and hold your Home Screen, add a large Cruise FM tile, then press and
hold the tile itself to choose its look. The record becomes a whole
turntable with a tonearm and silver keys, the CD player becomes a full
window, and the ticket stub gains the album cover.

Also in this update:
• The deck under the big record is painted in the colour of whatever album
  is on the label, so the tile changes with the song
• The big CD window and the ticket stub are laid out for every iPhone size
  rather than one
• More detail on the record's grooves and the CD's case
```

## Shorter, if you prefer

```
Widgets in a large size. Press and hold your Home Screen, add a large Cruise
FM tile, then press and hold the tile to choose its look: a turntable with a
real tonearm, a full CD player window, or a ticket stub carrying the album
cover.
```

---

## Two things worth knowing before she looks at it herself

**A tile already on the Home Screen can look unchanged.** iOS caches a
widget's last successful draw per PLACED tile (15.09), so the small record and
CD tiles may keep their old drawing after the update. Remove and re-add one to
see the new detail. The big sizes are new placements, so they are not affected.

**Build 72 is the store build and must not go on her phone.** It is a
production-profile build, and installing it from TestFlight moves the phone off
the preview channel, which is the 02.08 drought. Build 71 is **native-identical**
to it (`git diff b52d784..8840e78 -- modules/ targets/ plugins/ app.json
package.json package-lock.json eas.json` is empty), and she has already
launched 71 and placed a large Mode tile — so the build-25 rule is satisfied
for 72 without her touching it.

---

## The rest of the version page, for the same sitting

Everything else belongs to the VERSION and cannot be changed after Submit
without another review. In the order `listing-1.4.3.md` §8 gives:

1. **App name** — decide it first; it decides which keyword block gets pasted
   (§4 recommends `Cruise FM: Driving Visualizer`)
2. **Subtitle** — hers; §3
3. **Description and keywords** — paste blocks in §1 and §2
4. **Screenshots** — the widget slide replaces the photo-framing one; §5
5. **Attach build 72**
6. **Submit for Review**

Promotional text is the exception — no review, no version — so it is swapped on
release day (§6).

**AND THE SUBMIT BUTTON IS STILL BLOCKED.** The EU trader contact details have
to be verified before App Store Connect will let 1.4.3 go to review; see the
trader entry at the top of `AGENTS.md`. Nothing in this file unblocks that.
