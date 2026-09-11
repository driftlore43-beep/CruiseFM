# Store listing for the next build — proposed revision

Written 29.08.2026 at the owner's request ("write up an improved title —
maybe something like Cruise FM - music visualiser. SEO, description, suggest
improved previews").

Read `app-store-listing.md` alongside this: it carries the reasoning behind
the current copy and the two keyword rules, which still stand. This file only
proposes what should CHANGE, and why.

---

## FIRST — THE DECIDED NAME WAS NEVER ACTUALLY APPLIED

`app-store-listing.md` records, under "DECIDED 10.08", an app name of
**"Cruise FM: Driving Visuals"** and a subtitle of **"Music for how a drive
feels"**. The live listing, from the owner's own screenshot on 29.08, shows
the title as plain **"Cruise FM"** with no descriptive suffix at all.

So the change was written up and never made in App Store Connect. That is
worth knowing before treating anything below as a fresh idea: **the highest-
weighted field in App Store search has been spending all thirty of its
characters on a brand name carrying zero search terms**, for the whole life
of the app.

The name and keywords belong to an app *version*, so they need a version
submission — which is exactly what the next build is. **Do not let this one
slip again**: it is a form field, it costs nothing, and it is the single
biggest search lever available.

**This is the STORE listing name only.** `expo.name` in app.json stays
"Cruise FM" — that is the home-screen name, where iOS truncates at roughly
twelve characters.

---

## App name (30 characters)

**Proposed: `Cruise FM: Music Visualizer`** — 27 characters.

The owner's instinct is right, and it beats the 10.08 decision on two counts.

**Search volume.** "music visualizer" is a term people genuinely type into
the App Store. "driving visuals" is close to nobody's search. The name field
is weighted highest of all, so it should carry the term with the most demand
behind it, not the most poetic one.

**Honesty, which matters more.** `AGENTS.md` (11.08) records the owner's own
observation that she uses the app stationary, in her room, and the note
concludes that the driving frame has a question mark over it. "Music
visualizer" is simply a truer description of what the app IS — a visual layer
over music you are already playing — and it does not tell a desk listener
they are in the wrong place. Driving remains the character and the flavour;
it is all over the subtitle, the keywords, the stations and the description.

### The spelling, which is a real decision and not a detail

`visualizer` (US) and `visualiser` (UK/AU) are **different tokens** to Apple's
search. They are not folded together. The US is much the largest storefront,
so the **z** spelling belongs in the name, and the **s** spelling is carried in
the keyword field to catch AU, UK and IE searches. Both are then covered for
the price of ten keyword characters.

If it is ever worth more effort: App Store metadata can be **localised per
language**, so `en-AU`/`en-GB` could carry "Visualiser" in the name while
`en-US` keeps "Visualizer". That is a real option, not needed now, and it
would free those ten keyword characters for something else.

**Alternatives considered, with counts, in case the owner prefers one:**

| Candidate | Chars | Note |
|---|---|---|
| `Cruise FM: Music Visualizer` | 27 | **Recommended.** Highest-demand term. |
| `Cruise FM: Retro Music Visuals` | 30 | Adds *retro*, loses *visualizer* — a worse trade; retro is cheap to carry in the subtitle. |
| `Cruise FM: Driving Visuals` | 26 | The 10.08 decision. Still far better than today's bare name. |
| `Cruise FM: Music Visualiser` | 27 | Only if the AU/UK market is deliberately being put first. |

---

## Subtitle (30 characters)

**Proposed: `Vinyl, cassette & retro drive`** — 29 characters.

The subtitle is the second-highest-weighted field, and its job is to carry the
words the name could not. With *music* and *visualizer* now spent in the name,
the four best remaining terms are **vinyl**, **cassette**, **retro** and
**drive** — all real search terms, all things the app genuinely does.

This replaces "Music for how a drive feels" (never applied either), which was
lovely and spent 27 characters on *music* — already in the name — plus *feels*,
which nobody searches.

**Alternatives, with counts:**

| Candidate | Chars | Note |
|---|---|---|
| `Vinyl, cassette & retro drive` | 29 | **Recommended.** Four search terms, reads cleanly. |
| `Vinyl, cassette & mood radio` | 28 | Swaps *retro/drive* for *mood/radio*. Also good; pick on taste. |
| `Retro modes for your playlists` | 30 | Reads best to a human, carries fewer search terms. |

Deliberately avoided the word **player**: the app does not play music, it
controls Apple Music or Spotify, and the listing should not blur that.

---

## Keywords (100 characters, comma-separated, no spaces after commas)

**Proposed:**

```
turntable,record,equalizer,spectrum,aesthetic,dashboard,car,road,radio,tuner,lofi,visualiser,night
```

98 characters. Every word is new — none repeats the name or subtitle, which is
the first of the two standing rules in `app-store-listing.md` and still the
easiest way to waste this field.

What changed from the current list
(`driving,road,trip,visualizer,equalizer,mood,commute,night,cassette,vinyl,car,radio,retro,aesthetic`):
`visualizer`, `cassette`, `vinyl` and `retro` all move UP into the name and
subtitle, where they are weighted more heavily, which frees room for
`turntable`, `record`, `spectrum`, `dashboard`, `tuner`, `lofi` and the
British-spelling `visualiser`. `trip`, `mood` and `commute` are dropped as
the weakest performers of the old set.

If `driving` is wanted back (Apple is unreliable about derived forms, so it is
not fully covered by the subtitle's *drive*), swap out `night` — that variant
comes to exactly 100 characters.

**Do NOT put `spotify` or `apple music` in this field.** They are other
companies' trademarks and Apple can reject the version over it. Naming them in
the *description* as a factual statement of what the app works with is fine,
and is what the description already does.

---

## Promotional text (170 characters — editable any time, NO review)

This is the only field that can change without a submission, so it should
always lead with whatever shipped most recently. For the next build:

> Now on iPad, with home screen widgets — start a drive in one tap. Plus
> smoother Apple Music playback and a rebuilt vinyl deck. Ten moods, eight
> modes, all free.

**Only publish that once the iPad and widget build is actually live.** If the
build slips, the current 1.3.0 text stays; it is still accurate.

---

## Description

The existing description in `app-store-listing.md` is good and mostly stands.
**Apple does not index the description for search** — it is a conversion
document, not an SEO one — so the only edits worth making are to the parts a
human reads before tapping "more".

**Three changes for the next build:**

1. **Opening line.** With the name now saying "Music Visualizer", the first
   line should pay that off immediately rather than restate the brand:

   > Your music, finally worth watching.
   >
   > Cruise FM turns your iPhone into the dashboard your music deserves. Apple
   > organises music by artist. Cruise FM organises it by how a drive feels.

2. **Add iPad and widgets** to BUILT FOR THE DRIVE, once they genuinely ship:

   > • Home Screen widgets — start a drive in one tap, see what's on air
   > • Full-screen on iPad

3. **Everything else stays**, including the GOOD TO KNOW paragraph. It is the
   part that keeps the listing honest about needing a subscription for full
   control, and it is why the app has not had a 2.1 rejection since build 18.

---

## Previews and screenshots

### The current set, and what is wrong with it

From the owner's screenshot of the live listing, the captions read:

1. "Take your party to the road" — Mirror Ball
2. "Choose your vibe" — Stations
3. "You become the DJ" — Vinyl
4. "Spin your album art" — CD
5. "Watch your music play" — Cassette
6. "Take the lon…" — Horizon

Three problems, in order of how much they cost:

**The first slide does not say what the app is.** Apple shows the first two or
three screenshots directly in search results, so slide 1 is doing the work of
an advert. "Take your party to the road" could be a rideshare app, a speaker,
a playlist. Someone scrolling past has about a second to understand *this
makes my music look like that*.

**"You become the DJ" is not true.** There is no mixing, no beatmatching,
nothing a DJ does. It is the kind of line that wins a tap and loses the user
thirty seconds later, and this listing has been careful everywhere else not to
promise what the app cannot do.

**"Watch your music play" is the best description of the whole product** and it
is spent on slide 5, where fewer people reach.

### Proposed captions

| # | Mode shown | Caption |
|---|---|---|
| 1 | Mirror Ball | **Your music, finally worth watching** |
| 2 | Stations dial | **Ten moods, not ten genres** |
| 3 | Vinyl | **Your album art, on a real record** |
| 4 | Cassette | **Tape reels that wind as it plays** |
| 5 | CD | **A disc that catches the light** |
| 6 | Tuner | **Drag the dial between moods** |
| 7 | Horizon | **An endless road into the sun** |
| 8 | Create station | **Make a station from your own photo** |
| 9 | — | **Free. No account, no ads.** |

The reasoning behind the order: the strongest *image* leads, because slide 1 is
seen by people who have not decided to care yet; the product's own thesis line
("Ten moods, not ten genres") comes second, because that is the thing no
competitor can copy; and slides 6 and 8 are the only two that show the app
being *used* rather than looked at, which is what convinces someone it is a
tool and not a wallpaper.

Slide 8 matters more than it looks: a custom station with the user's own photo
is the feature most likely to make someone stay, and nothing in the current set
hints it exists.

### App preview VIDEOS — the biggest missing lever

The listing has **no app preview video**. Apple allows up to three, 15–30
seconds each, and a video **autoplays in search results** where the static
screenshots do not move at all.

For an app whose entire proposition is *motion* — a turning record, a mirror
ball scattering light, reels winding — static screenshots are close to the
worst possible medium. A single 20-second capture of one drive, cutting
between three or four modes, would carry more than all nine screenshots
together.

Needs no build, so it can happen any time. Recommended as the highest-value
listing task after the name change. **Full plan below.**

---

## THE APP PREVIEW VIDEO — how to actually make it

Parked 29.08 for a later day at the owner's request. Everything needed to
start is here; nothing about it depends on the next build.

### Who does which half

The honest division, because one half genuinely cannot be done from this
environment:

**The owner records the raw footage.** Apple's guidance is that a preview
must show authentic use of the app's real UI, which in practice means a real
device. The web build used for screenshots is react-native-web — close, but
its fonts differ, its animations fall back off the native driver, and the
marquee behaves differently. Good enough for a still; not good enough to
stake a store listing on.

**Claude does everything either side of that.** The shot list and timings
below, and then the edit itself — trimming, sequencing, resizing to Apple's
exact frame, adding the silent audio track Apple requires — all of which is
ffmpeg work on footage the owner sends over.

### How the owner records it — two routes, both free

1. **QuickTime on the MacBook (best quality).** Plug the iPhone in by cable,
   open QuickTime Player → File → New Movie Recording → click the arrow beside
   the record button → choose the iPhone as camera and microphone. Records the
   phone's screen at full resolution with no on-screen recording indicator.
2. **iOS built-in Screen Recording** (Control Centre → the record button).
   Simpler, and fine — it just records at the phone's own resolution and can
   catch the odd system UI element.

Record **generously**: a couple of minutes of unhurried driving through the
modes gives plenty to cut from, and re-recording later to fix one shot is far
more annoying than recording too much now.

### The rights decision, which has to be made BEFORE recording

The App Store screenshots are deliberately taken in **demo mode with no music
service connected**, so every deck shows the station's own tagline instead of
a real song title and album art — no rights questions at all. `AGENTS.md`
records that as a deliberate choice.

The same choice applies here, and it has a real cost:

- **No service connected** — the visuals still animate fully (the scene gate
  defaults to running when there is no track at all, which is the documented
  companion-mode behaviour), so Mirror Ball, Equalizer, Horizon, Cassette and
  Tuner all look exactly right. **But Vinyl and CD lose their album art**,
  which is a good part of what makes those two decks beautiful.
- **A real playlist connected** — everything looks its best, but a real song
  title, artist and album cover appear in the store listing.

**Recommendation: record it BOTH ways in the same sitting.** It costs one
extra pass, and it means the decision can be made while looking at the two
side by side rather than in the abstract. Plenty of music apps show real
artwork in previews; this listing has simply been more cautious than it had
to be so far, and that caution is worth keeping unless the Vinyl shot is
visibly poorer for it.

### Shot list — one 20-second cut

Timings are a starting point, not a rule; the edit can breathe once there is
real footage.

| Time | Shot | Why |
|---|---|---|
| 0–3s | **Mirror Ball**, resting, light moving across the room | Opens on the strongest image in the app. A preview autoplays silently in search — the first second has to be arresting with no words at all. |
| 3–6s | **Stations dial**, thumb scrolling the AM/FM list | Says "this is a real thing with structure", not a screensaver. |
| 6–8s | Tap a station → the deck opens | The one-tap promise, shown rather than claimed. |
| 8–12s | **Vinyl**, record turning, tonearm down | The most recognisable object in the app. |
| 12–15s | **Cassette**, reels winding | Variety, and the reels genuinely move — it reads as alive. |
| 15–18s | **Tuner**, dragging the dial between two stations | The only shot showing a gesture doing something. Interaction converts. |
| 18–20s | **Horizon** or back to Mirror Ball, hold | Ends on motion rather than a cut to black. |

Two things to get right while recording, both easy to miss:

- **Let each deck REST before moving on.** After about six untouched seconds
  the controls fade and the scene re-centres — that rested state is the app at
  its most cinematic and is what should be on screen for most of each shot.
- **Do not press the transport just before a shot.** Pausing stops the scene
  (deliberately — a still deck is what paused looks like), so a paused deck in
  a preview reads as a broken app.

### Technical specification, confirmed 29.08

| Requirement | Value |
|---|---|
| Length | **15–30 seconds** — App Store Connect rejects anything outside it |
| iPhone resolution | **886×1920** or 1920×886 |
| iPad resolution | **1200×1600** or 1600×1200 |
| Format | .mov, .m4v or .mp4, H.264 (or ProRes 422 HQ as .mov) |
| Max file size | 500 MB |
| Audio | **An audio track must be present even if silent** — a silent stereo AAC track satisfies it |
| How many | Up to 3 per device size |

That silent-audio requirement is the one that catches people out: a video
exported with no audio stream at all is rejected, and the error does not
explain itself. The edit will add one.

Sources checked on the day: [Apple's own App Preview specifications](https://www.developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications),
[DemoScope's 2026 summary](https://demoscope.app/blog/posts/app-store-preview-video-requirements-apple-guidelines),
[ScreenKit specs](https://screenkit.tools/specs/app-store-app-preview-video-specs).
**Re-check them at the time rather than trusting this table** — Apple changes
accepted frame sizes when new devices land, and this file will not update
itself.

### One thing to decide at the same time

If the iPad build has shipped by then, an **iPad preview** is a separate
video at a separate resolution. Worth recording the iPad footage in the same
sitting if the build is out; otherwise the iPhone preview alone is perfectly
valid and the iPad slot can stay empty.

### iPad screenshots — REQUIRED by the next build, easy to be blindsided by

The live listing currently says **"Only on iPhone"**. The moment the next build
turns on iPad support, App Store Connect will require a **separate iPad
screenshot set** (13-inch display), and the version cannot be submitted without
it.

`scripts/harness/shots.mjs` already generates the iPhone set from the real web
build; the same recipe at an iPad viewport is the cheapest way to produce them.
Do this as part of the build, not after it, or the submission blocks.

---

## Order of work

1. **App name + subtitle + keywords** — form fields, zero code, biggest single
   search lever, and already once forgotten. Do it with the next version.
2. **iPad screenshots** — blocks the submission, so it is not optional.
3. **New captions** on the existing screenshots — cheap, no build needed.
4. **App preview video** — highest conversion value, no build needed, can
   happen any time. **Parked 29.08 for a later day.** Needs ~10 minutes of
   screen recording from the owner on a real iPhone; everything else (shot
   list, edit, resize, silent audio track) is done from here. Full plan in
   the section above.
5. **Promotional text** — after the build is live, since it names iPad and
   widgets.
