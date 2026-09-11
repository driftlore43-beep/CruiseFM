# Apple Music — your part of the setup

Claude builds the connection itself; this is the ~15 minutes of clicking only
you can do, because it happens inside your Apple accounts. Do these any time —
none of it touches the app that's in review.

## 1. Make sure the test iPhone has an Apple Music subscription

Testing playback needs a phone that can actually play Apple Music. If you
don't have a subscription, one month covers the whole build — and Apple
usually offers the first month free.

Check: open the Music app → play any song from Apple Music (not a file).
If it plays, you're set.

## 2. Switch on MusicKit for the app's identifier

1. Go to **developer.apple.com** and sign in (cruisefmservice@gmail.com).
2. Open **Account** → **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Click the Cruise FM app id: **com.driftlore.CruiseFM**.
4. Find the **App Services** tab (next to Capabilities).
5. Tick **MusicKit**, then **Save**.

That's the whole portal job. No keys to download for what we're building —
modern iPhones handle the app's Apple Music credentials automatically once
MusicKit is enabled on the identifier.

## 3. That's it — the rest is code

What happens next, so the sequence is clear:

- Claude builds the connection behind the same switchboard Spotify uses, so
  the two become equals: sign in with your Apple ID, live song titles,
  play/pause/skip/seek, and linking Apple Music playlists to stations.
- The finished connection needs **one fresh build** (it contains a native
  piece, which over-the-air updates can't carry). It goes into the same
  build as the other queued native items, so everything ships together.
- From that build on, refinements flow over the air as normal.

## Worth knowing

- Apple Music users get the full experience with no user limit — this is
  the whole reason it beats Spotify for launch.
- People without an Apple Music subscription still get what they get today:
  the visual companion experience.
- Nothing here touches the App Store submission that's waiting for review.
