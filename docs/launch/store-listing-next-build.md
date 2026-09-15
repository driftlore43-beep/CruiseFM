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

**SETTLED 15.09 — `Cruise FM: Driving Visuals` goes in with 1.4.0**, i.e. the
original 10.08 decision rather than this file's own recommendation, and the
reason is the keyword rule rather than taste.

`Cruise FM: Music Visualizer` was recommended here on the assumption that the
**subtitle would change too**. It did not: the subtitle stays
`Music for how a drive feels`, so a name carrying *Music* would repeat a word
the subtitle already owns — and Apple indexes the two fields separately and
combines them, so a repeat buys nothing. *Driving Visuals* adds two words the
subtitle does not have. Keeping a search term is worth more than upgrading one.

| Candidate | Chars | Note |
|---|---|---|
| `Cruise FM: Driving Visuals` | 26 | **CHOSEN.** The 10.08 decision; the only candidate that repeats nothing in the unchanged subtitle. |
| `Cruise FM: Music Visualizer` | 27 | Higher-demand term, but *Music* is already in the subtitle — worth revisiting only if the subtitle is rewritten. |
| `Cruise FM: Retro Music Visuals` | 30 | Adds *retro*, loses *visualizer* — a worse trade; retro is cheap to carry in the keywords. |
| `Cruise FM: Music Visualiser` | 27 | Superseded: `visualiser` now sits in the keyword field instead, which gets the AU/UK spelling in without spending name characters. |

---

## Subtitle (30 characters) — **NOT CHANGED, owner's call 15.09**

The subtitle stays `Music for how a drive feels`. Everything below is the
argument for changing it, kept because it is a real argument and the decision
may be revisited on a later version — but it was weighed at the 1.4.0
submission and deliberately not taken: the current subtitle was chosen for
search, and swapping it is a trade rather than a fix. Note that if it is ever
rewritten, the **name should be re-examined in the same sitting** — the reason
the name is *Driving Visuals* rather than *Music Visualizer* is that this
subtitle already carries *Music*.

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

**SUPERSEDED 15.09 — do not paste the list below.** It was built on the
assumption that the subtitle would change too: it drops `visualizer`,
`cassette`, `vinyl` and `retro` on the grounds that they "move UP into the name
and subtitle". The subtitle did not change, so those four words are still
carried by nothing but this field, and dropping them would lose four real
search terms outright.

What actually ships with 1.4.0 is the current list minus `driving` (now in the
name, so a repeat) and minus `commute` (the weakest term), plus the British
spelling `visualiser`:

```
road,trip,visualizer,equalizer,mood,night,cassette,vinyl,car,radio,retro,aesthetic,visualiser
```

The reasoning is in `app-store-listing.md`; the list below stays as the
proposal to revisit **if and when the subtitle is ever rewritten**, since the
two fields have to be planned together.


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
  Tuner all look exactly right. Vinyl and CD lose their album art and fall back
  to a printed pressing.
  **THAT FALLBACK IS MUCH STRONGER SINCE 13.09 than this paragraph assumed
  when it was written.** The realistic record is the default now, it is
  noticeably larger, its grooves hold their pitch at any size and it sits in a
  pool of the station's own light — the label reads CRUISE FM on a red centre
  rather than sitting empty. Judge it on the App Store set before assuming the
  no-service pass is the poorer one.
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
  a preview reads as a broken app. Note that Start Drive already leaves the
  deck PLAYING — pressing the button to "start" it is what pauses it.
- **Check Settings first, once.** The Vinyl shot depends on Classic Vinyl being
  on, which is the default since 13.09 but not on a phone that turned it off
  earlier. Atmosphere on, Daylight off, and put the phone in Do Not Disturb so
  no banner lands mid-take.

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

### THE ROUGH CUT EXISTS — 15.09, and it is 80% of the job

The owner recorded **five clips on the evening of 13 September** — about 65
seconds of footage, which between them cover almost the whole shot list above.
A 19.5-second cut has been assembled from them and sent to her. It is already
at Apple's exact frame, has the silent audio track, and would upload today but
for one thing (below).

| # | Shot | Source clip | In / length |
|---|---|---|---|
| 1 | Mirror Ball, Sunset AM, rested | `22-12-54` (9.0s) | 1.2s / 4.4s |
| 2 | Stations dial, scrolling AM into FM | `22-52-51` (10.1s) | 1.0s / 4.2s |
| 3 | Station page → Start Listening → deck opens | `22-52-51` (14.2s) | 0.0s / 2.4s |
| 4 | Vinyl, record turning, tonearm down | `22-52-51` (14.2s) | 11.4s / 2.7s |
| 5 | Cassette, reels winding | `22-15-50` (14.0s) | 10.6s / 2.2s |
| 6 | Tuner, dial dragged 101.30 → 103.50 | `01-39-28` (17.0s) | 0.2s / 3.6s |

**The frame conversion is a cover-scale and a centre-crop, not a letterbox.**
ReplayKit records at 1282×~2662 (it trims the status bar), which is 2.076:1
against Apple's 886×1920 = 2.167:1. Scaling to *cover* and cropping loses about
27px from each side of the source — roughly 2% — and the transport icons sit
well inside that, so nothing is cut. Letterboxing instead would put black bars
on a preview, which reads as an amateur export.

    VF="scale=886:1920:force_original_aspect_ratio=increase,crop=886:1920,fps=30,format=yuv420p"
    ffmpeg -ss <IN> -t <LEN> -i <clip>.mov -an -vf "$VF" \
           -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p seg.mp4
    # then concat the segments, then the silent track Apple insists on:
    ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4
    ffmpeg -i joined.mp4 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
           -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart preview.mp4

**THE HINT BANNER IS THE TRAP IN THIS FOOTAGE, and it is invisible until you
look for it.** `WakeSpotifyHint` prints *"Visuals only for now — play music in
any app and cruise on"* across the top of a deck opened with no music service,
and it retires itself after about 9.5 seconds. So on every clip the first few
seconds are clean, the middle carries a banner saying the app is not doing full
playback, and only the tail is usable. Measured per clip rather than guessed:
it is mid-fade at 11.0s on the Vinyl clip and gone by 11.3, and gone by 10.5 on
the Cassette one. **Every in-point in the table above is set from that, not from
where the shot looks best.** Crop the top 420px of a frame and look; a
brightness average over the whole band cannot tell a banner from a backdrop.

### THE ONE THING WRONG WITH IT: the footage predates the tagline round

The clips were recorded on **13 September**; the taglines were rewritten on
**15 September** (`8d0a4ae`). Every deck prints the station's tagline where the
song title goes — which is the whole reason that round happened — so the cut
shows wording the app no longer uses:

| On screen in the footage | What the app says now |
|---|---|
| Empty expressways. Blue-lit dashboards. | Blue light. Empty hours. |
| Golden hour. Open roads. | The sky turns gold. The day lets go. |
| Cold air. Fog ahead. One more corner. | Cold air. Fog in the pines. Thin light. |
| Ocean air. Open horizons. Golden hour. | *unchanged* |
| City lights on — the night is young. | *unchanged* |

About 8 of the 19.5 seconds carry a stale line — the Night Run material (station
page, Vinyl, Cassette) and the last second of the Tuner. **The Mirror Ball opener
and the whole dial section are clean**, because a rested deck shows no tagline at
all and the dial page's copy did not change.

That matters more than a normal continuity slip: the new screenshots on the same
listing page carry the NEW wording, so the two would visibly disagree, and the
line the video would be advertising is the exact line the 15.09 round removed for
being drive-framed.

**The fix is a re-record, and it is cheap.** The tagline round published to
preview at 12:29 on 15.09 (run 381, success), so her phone already has the new
wording — open and close the app twice and it is there. Only the Night Run shots
and the Tuner need redoing; shots 1 and 2 could be kept as they are. Rebuild with
the same table above and new in-points.

### One thing to decide at the same time

The iPad build HAS shipped (build 51), so an **iPad preview** is now a real,
separate video at a separate resolution (1200x1600). It is optional — the
iPhone preview alone is perfectly valid and the iPad slot can stay empty — but
if it is wanted, record that footage in the same sitting. The decks were sized
for a tablet on 13.09, so they genuinely fill the screen now rather than
sitting phone-sized in the middle of it, which is the whole reason an iPad
preview is worth having at all.

### iPad screenshots — DONE, 13.09

Build 51 ships `supportsTablet`, so App Store Connect now requires a 13-inch
iPad set and will not accept the version without one. It exists:
`screenshots-appstore-ipad/`, eight screens at **2064x2752**, generated by
`DEVICE=ipad node scripts/harness/shots.mjs` — the same harness as the iPhone
set, so the wake tap, the off-air ask and the hint that retires itself are all
handled once rather than twice.

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

### DECIDED: the cut ships as it is (owner, 15.09)

> "im happy using this footage - its more for iphone anyways."

So the re-record above is **not** happening, and this section supersedes it.
Nobody should go and reshoot the Night Run material on the strength of the
paragraph above — read this one first.

Why the cost is small, stated plainly rather than waved away:

* **A preview is per device size, and optional at every one of them.** This is
  the **iPhone 6.7"** slot only. The iPad listing carries no video at all, and
  Apple does not require one.
* **The iPad is where the driving language mattered most**, and since 12.09 the
  app itself has no driving mode on a tablet. The video is on the one device
  where the car framing is still true.
* What remains is roughly **8 of 19.5 seconds** showing three lines the app has
  stopped saying, on a page whose screenshots say the new ones.

### HOW TO UPLOAD IT

App Store Connect → the **1.4.0** version → **Previews and Screenshots** →
**iPhone 6.7" Display** → drag the file into the preview well (it sits before
the screenshots).

* File: `CruiseFM-preview-roughcut-886x1920.mp4` — 19.5s, 886×1920, H.264,
  silent stereo AAC, 8.4 MB.
* Apple will ask for a **poster frame**; pick one from the dial sweep or the
  tuner, not from a rested deck.
* The preview goes through review with the build, so it must be in place
  **before** Submit for Review.
