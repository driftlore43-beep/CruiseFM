# Spotify Developer — Extended Quota Mode request

Draft answers for the Spotify Developer Dashboard extension request
(Dashboard → the Cruise FM app → "Request extension" / quota extension
form). Field names vary slightly as Spotify updates the form; match by
meaning.

**Prerequisites before submitting**
- Privacy policy: https://cruisefm.netlify.app/privacy/ — DONE
- App must be functional for review (it is)
- The dashboard app's name/description below should match

---

## App name

Cruise FM

## App / integration description (what does your app do?)

Cruise FM is a driving-companion app for Android (iOS planned) that turns a
user's own Spotify playlists into a cinematic in-car listening experience.
Users link their Spotify account, attach their own playlists to "mood
stations" (e.g. Night Run, Rain Drive, Coastal), and start a drive: the app
starts playback of the chosen playlist on the user's own Spotify app and
displays full-screen ambient visuals (equalizer, vinyl, cassette, horizon)
with the current track's title, artist, and progress, plus large
driving-friendly play/pause/skip controls.

Cruise FM does not stream, download, cache, or modify audio. All playback
happens in the official Spotify application on the user's own device via
the Web API. The app is a remote control and visual layer over the user's
existing Spotify Premium subscription.

## Why do you need access / value to Spotify users?

Cruise FM gives Spotify Premium subscribers a purpose-built, glanceable,
distraction-minimising way to enjoy their own playlists while driving. It
increases engagement with Spotify content (users organise and play their
Spotify playlists more) and drives Premium retention, since playback
control requires an active Premium subscription. The app clearly
communicates that Spotify Premium is required and links users to Spotify.

## Scopes requested and justification

- `user-read-playback-state` — to show whether music is playing and on
  which device, so the app can resume/wake the user's own device reliably.
- `user-modify-playback-state` — play, pause, skip, and start the user's
  chosen playlist on the user's own active device (large, driving-safe
  controls).
- `user-read-currently-playing` — display the current track title, artist,
  and progress inside the visual modes (with clear attribution to the
  user's Spotify content).
- `playlist-read-private` / `playlist-read-collaborative` — let the user
  pick from their own playlists (including private ones) when linking a
  playlist to a mood station. Only names/IDs/artwork are listed; nothing is
  copied or stored server-side.

## Monetisation

Cruise FM offers an optional in-app subscription (£2.99/month) that unlocks
additional VISUAL themes and modes in the app itself. Access to Spotify
content is never sold: playback requires the user's own Spotify Premium
account, all Spotify functionality works identically for free and paying
Cruise FM users, and no Spotify content is behind the paywall. The paid
tier is purely cosmetic app features (visual modes and themes).

## Data handling / privacy

- OAuth (PKCE) tokens are stored only on the user's device (AsyncStorage);
  Cruise FM operates no backend server and receives no user data.
- No Spotify content or metadata is stored beyond the device-local link
  between a station and a playlist ID chosen by the user.
- No data is sold or shared. Crash reporting (Sentry) contains technical
  crash context only.
- Privacy policy: https://cruisefm.netlify.app/privacy/
- Contact: cruisefmservice@gmail.com

## Compliance notes (Developer Policy)

- No audio ripping, caching, or offline playback; playback only via the
  official Spotify app.
- Spotify attribution: track title/artist displayed for currently playing
  content; "requires Spotify Premium" stated in-app and on the store
  listing.
- The app does not mix, overlay, or alter Spotify audio, and does not use
  Spotify content for training or advertising.
- Branding: Cruise FM states it is not affiliated with, endorsed, or
  sponsored by Spotify AB; Spotify logo used only per brand guidelines
  (platform-connect screen).
- Driving safety: visuals are ambient; controls are oversized; the app
  instructs users not to watch the screen while driving.

## Users / redirect URIs

- Redirect URI: `cruisefm://auth`
- Current status: development mode (owner + testers on allowlist)
- Expected users at launch: closed test cohort (~15) growing to public
  after Google Play launch.
