# App Store listing — Cruise FM

Written 08.08.2026, the day of launch, to replace copy that had drifted:
the old draft was Spotify-only, still listed Sound Waves (retired 25.07),
counted seven modes instead of eight and eight stations instead of ten, and
advertised a **£1.99/month subscription that does not exist** — the app ships
free with no in-app purchases at all, and a purchase offer in the UI is what
got build 18 rejected. Nothing here promises anything the app can't do.

**How to update it:** the **description** and **keywords** belong to an app
version, so changing them means creating a new version in App Store Connect
and submitting it — metadata-only review, usually quick. Batch it with the
next build. **Promotional text** is the exception: it can be changed at any
time with no review at all.

---

## Subtitle (30 characters)

> Music for how a drive feels

(27 characters.)

## Promotional text (170 characters — editable any time, no review)

> Apple Music and Spotify both play inside Cruise FM now, with the controls on
> the card. Ten mood stations, eight full-screen modes, all free.

(146 characters.)

## Keywords (100 characters, comma-separated, no spaces after commas)

> driving,road,trip,visualizer,equalizer,mood,commute,night,cassette,vinyl,car,radio,retro,aesthetic

(98 characters. Revised 10.08 — the previous list wasted about a tenth of the
field.)

**The two rules this field runs on, both easy to get wrong:**

1. **Never repeat a word that already appears in the app name or the subtitle.**
   Apple indexes those fields separately and combines them with this one, so a
   repeat buys nothing. The old list carried `drive` and `music`, both of which
   the subtitle already covers ("Music for how a drive feels").
2. **Never write phrases.** Apple splits on commas *and* spaces and forms the
   combinations itself, so `road trip` and `night drive` were spending
   characters on words already present. Single words only.

Those two changes freed enough room for `equalizer`, `retro` and `aesthetic` —
all terms people genuinely search and none of which the listing previously
claimed anywhere.

Kept `driving` alongside the subtitle's `drive` on purpose: Apple handles
plurals but is unreliable about derived forms, so the two are worth holding
separately.

## App name (30 characters) — DECIDED 10.08

> Cruise FM: Driving Visuals

(26 characters.) The name field is the **highest-weighted** thing in App Store
search, and the old name spent all of it on the brand — "Cruise FM" is nine
characters carrying no search terms at all. The suffix puts *driving* and
*visuals* into the strongest field there is.

**THIS IS THE STORE LISTING NAME ONLY. Do not change `expo.name` in app.json.**
That field is what appears under the icon on the home screen, where iOS
truncates at roughly twelve characters — "Cruise FM: Dri…" would be the result.
The two names are set in different places and are meant to differ: the listing
name is for being found, the home-screen name is for being recognised. No code
change is involved in this at all.

Set it in App Store Connect on the next version. The name belongs to an app
*version*, so it needs a version submission — batch it with the 1.3.0 build
rather than submitting for it alone.

## Description (max 4000 characters)

> Spotify organises music by artist. Cruise FM organises it by how a drive feels.
>
> Pick a mood station, tap Start Drive, and your dashboard becomes the film your
> music deserves.
>
> YOUR MUSIC, YOUR ACCOUNT
> Connect Apple Music or Spotify and play your own playlists with full control
> inside Cruise FM — play, pause, skip, scrub the track, pick a song from the
> queue. Listening on something else? Press play in your own app and Cruise FM
> runs the visuals alongside it.
>
> TEN MOOD STATIONS
> Night Run. Sunset. Daylight. Rain Drive. Coastal. Mountain Pass. After Hours.
> Cars & Coffee. Downtown. Tunnel. Each one is a feeling rather than a genre —
> link any playlist you own to any station, and the drive takes care of itself.
>
> EIGHT FULL-SCREEN MODES
> • Mirror Ball — a slow-turning ball scattering light around the room
> • Vinyl — your album art on a turning record, tonearm riding the grooves
> • Cassette — living tape reels that wind as the song plays
> • CD — a mirrored disc under jewel-case plastic
> • Equalizer — a segmented LED meter lit in your station's colours
> • Circular EQ — a spectrum wrapped into a glowing ring
> • Tuner — a dot-matrix head unit; drag the dial to glide between moods
> • Horizon — an endless grid rolling into a sliced sun
>
> BUILT FOR THE DRIVE
> • One-tap Start Drive from the home screen
> • Auto-dim while you're moving, so the screen never shouts at you
> • Drive stats kept honest — an "Are you driving?" check quietly pauses the
>   clock when the music is playing and you're not
> • Badges and streaks, free forever
> • Share a card of what you're listening to
>
> FREE
> Every station and every mode is unlocked. No account needed to look around,
> no ads, nothing to buy.
>
> GOOD TO KNOW
> Cruise FM controls your own Apple Music or Spotify app — it does not stream,
> download or store any music itself. Full in-app playback needs an Apple Music
> subscription or Spotify Premium; without either, Cruise FM runs as the visual
> layer while you play music in your own app.
>
> Please don't watch the screen while you're driving. That's what passengers
> are for.
>
> Cruise FM is made by Strofi Technologies.

---

## Strofi Technologies, and the one line that cannot say it

Cruise FM is presented as a **Strofi Technologies** product. As of 09.08 that
name appears in the app (the Profile footer), in the Privacy Policy and Terms, on
the website footer, and in the store **description** — everywhere the product
speaks for itself.

**Why the parent carries the second app's name.** Strofi — the social driving and
route-discovery platform — is the bigger bet (see `docs/strategy.md`), and Cruise
FM is deliberately its front door. Naming the company Strofi Technologies makes
that literal: every Cruise FM user reads the word *Strofi* before Strofi exists,
which is free groundwork for the app that has the harder cold-start problem. It
trades portability for concentration, and concentration is the right trade when
one product is clearly the main event.

Two earlier names, recorded so nobody re-proposes them. **Veyra** lasted a few
hours on 09.08 — pretty, vowel-heavy coinages (Veyra, Vayra, Lumina, Nova, Aura)
are the most contested naming space there is, because every founder reaches for
them first. **Northing** replaced it and was chosen for portability, before the
decision to lead with Strofi made portability the wrong goal. Also checked and
rejected along the way: Skywave, Longwave, Catseye, Faro, Rumbo, Sereno, Estela,
Bruma, Madrugada, Ocaso, Glovebox, Highbeam — all had software or App Store
namesakes. Nothing in software uses Strofi.

The one place it CANNOT appear is the App Store's own **Developer** line, which
still reads *JESSICA ARROYO*. That field is not metadata we write: on an
**Individual** developer account it is the account holder's legal name, and
Apple does not allow it to be set to anything else. The app's name on the store
is unaffected — that stays "Cruise FM".

Two routes to changing it, and neither is a quick edit:

- **Convert to an Organization account.** Needs a legally registered business
  plus a free D-U-N-S number. Days to weeks, and the D-U-N-S lookup alone can
  take a fortnight.
- **Ask Apple about a trading name.** Apple has in some cases let individuals
  display a registered trading name with documentation. Worth a support ticket
  before committing to the company route, because it is far cheaper if granted.

Until then the honest position is that the listing credits a person and the
product credits Strofi Technologies, which is a normal state of affairs for a small studio
and confuses nobody who reads the app itself.

Worth weighing rather than rushing: a registered entity is likely wanted
anyway before charging for anything (payments, business banking, and EU trader
status all point the same way).
