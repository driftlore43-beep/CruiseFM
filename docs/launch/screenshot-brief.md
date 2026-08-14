# App Store screenshots — design brief

Paste this into whatever you're designing with. It carries the decisions that
are easy to get wrong and expensive to redo.

---

## The two rules that matter most

**1. Apple shows only the first two or three in search results.** Most people
never swipe. So the opening slide has to be the strongest picture in the set,
not an explanation.

**2. Every slide is judged at thumbnail size first.** If a caption isn't
readable shrunk to the size of a postage stamp, it isn't doing anything.

---

## Size

**1284 × 2778 pixels** (Apple's 6.5" slot). Keep all text at least **90px**
clear of the top and bottom edges.

---

## The order, the headline, and the exact background colour

The colours are sampled from each screenshot's own lit areas, then all forced
to the same darkness and richness. That's what makes ten different colours
still look like one product — and it's why white caption text works on every
one of them.

| # | Screenshot | Headline | Background |
|---|---|---|---|
| 1 | Mirror Ball (Downtown) | **Drive your music** | `#453564` |
| 2 | Vinyl (Sunset) | **Spin your album art** | `#63363c` |
| 3 | Stations dial | **Choose your mood station** | `#753f24` |
| 4 | Horizon (After Hours) | **Take the long way home** | `#772228` |
| 5 | Tuner (Night Run) | **Tune the dial, find the feeling** | `#234476` |
| 6 | Your photo (framing screen) | **Your own photo behind the drive** | `#685531` |
| 7 | Cassette (Daylight) | **A tape deck for the road** | `#675332` |
| 8 | CD (Coastal) | **The disc, spinning again** | `#366357` |
| 9 | Equalizer (Mountain Pass) | **The meter from an old hi-fi** | `#2d586c` |
| 10 | Share card | **Your music wrapped in a drive** | `#633647` |

Ten is Apple's maximum, so this fills every slot.

### Why this order

Your opening slide was the home screen. It's the least distinctive thing in the
app — it looks like any music player. The modes are what nobody else has, so
one of those has to go first. Your line **"Drive your music"** still works as
the opener; it just needs a better picture under it.

**"Take the long way home"** moved to Horizon — the endless road suits it
better than the mirror ball did.

---

## Layout rules

- **One caption position for the whole set.** Top, since the phone sits low in
  the frame. Moving it around between slides is the single fastest way to look
  unconsidered.
- **One font size for every headline** — pick the largest that fits the longest
  line (#5), then use it everywhere. Don't size each caption to fill its slide.
- **White text.** Every background above is dark enough to carry it. This is
  also why the pale lavender didn't work: white on a light background vanishes
  at thumbnail size.
- **Never leave a slide without a caption.** Each one is a free sentence.
- **Don't split one image across two slides.** In search they're shown
  individually, so half a picture reads as broken to anyone who doesn't swipe.

---

## What would actually get these rejected

Screenshot rejections are much rarer than binary ones — both rejections so far
were the app itself, not the listing — but these are the real ones, in order of
how likely they are to bite.

**1. The app has to be visibly in use (Guideline 2.3.3).** Apple's wording:
*"Screenshots should show the app in use, and not merely the title art, login
page, or splash screen."* Marketing frames and headlines are normal and every
large app uses them; what gets flagged is when the slide becomes ART INSTEAD OF
THE APP. The two shapes to avoid are a phone shrunk small enough that the
interface is unreadable, and one image split across two slides — on its own,
half a phone with no legible UI is exactly what that rule is for.

The test: cover the caption. Can you still tell what the app does from what is
left? If not, make the phone bigger.

**2. Content you don't have the rights to.** The current set has no song
titles, no artist names and no album covers, because it was shot with nothing
connected. KEEP IT THAT WAY. Dropping a real album cover into the vinyl or CD
slide to make it look richer is the obvious improvement and the one that can be
rejected *and* draw a complaint from a rights holder.

**3. Showing what the submitted build doesn't have (2.3.1).** The screenshots
must match the BINARY you send, not the newer preview version on your own
phone. Those two have drifted apart before, so check it deliberately.

**4. Other platforms (2.3.10).** No Android imagery, no "also on Google Play",
no non-Apple device frames. iPhone frames are fine and standard.

**5. Promotional text.** No "Free", no "#1", no "Download now", no prices in
the images. Prices vary by storefront and change, so a price claim in a
screenshot is inaccurate metadata waiting to happen.

**If you ever add an App Preview VIDEO**, the rules are much stricter than for
stills: the footage has to be captured from the device itself, not composed in
a design tool. Nothing here applies that constraint to static screenshots.

---

## Copy: one thing that must stay true

**Nothing may claim the visuals react to the music.** They don't — neither
Spotify nor Apple Music will give the app the beat information, which was
tested and settled. Lines like "moves with the music" or "reacts to every beat"
would be false.

Everything in the table above is safe: the modes really do spin, the album art
really is the record's label, the dial really tunes.

---

## Which screenshots

They're in `screenshots-appstore/` in the repo, already at the right size:

- `01-mirrorball-downtown.jpg`
- `02-vinyl-sunset.jpg`
- `03-stations-dial.jpg`
- `04-horizon-afterhours.jpg`
- `05-cassette-daylight.jpg`
- `06-cd-coastal.jpg`
- `07-tuner-nightrun.jpg`
- `08-yourphoto-framing.jpg`
- `09-equalizer-mountainpass.jpg`
- `10-sharecard-vinyl.jpg`

They were shot with no music connected on purpose, so there are no song titles,
artist names or album covers anywhere in the set — nothing that could raise a
rights question, and it reads cleaner than a real track would.

---

## If a screenshot ever changes

Re-sample the colours; don't reuse the table. The command is:

```
python3 scripts/marketing/tints.py
```

A new picture means a new correct colour — when the mountain shot was replaced
with the dial, its slide went from teal to amber, which was right.
