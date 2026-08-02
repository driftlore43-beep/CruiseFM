# Cruise FM — App Store submission kit

Everything below is ready to paste into App Store Connect
(appstoreconnect.apple.com → My Apps → Cruise FM). Work top to bottom.
Launching FREE — no in-app purchases in this version, payments are the
fast-follow update.

---

## RESUBMISSION after the 29 July rejection — do this first

Apple rejected build 7 under **Guideline 2.5.4** because the app claimed it
could play audio in the background. That was fair: Cruise FM never plays
audio itself, Spotify does. The claim came from a leftover library
(`expo-audio`), which was removed on 29 July. Verified again on 2 August —
the built app now declares no background audio and no microphone permission.

**Nothing in the code needs changing.** The rejection was about something
baked into the app file, so it cannot be sent over the air — it just needs a
new build. Everything you have been testing on your phone all week is
already the fixed version.

### On the Mac

```
cd ~/CruiseFM                                  # wherever you cloned it
git checkout claude/cruise-fm-v4wk5f           # NOT main — main is behind
git pull origin claude/cruise-fm-v4wk5f
npx eas-cli build -p ios --profile production
```

Answer **no** if it offers to commit anything. The build takes roughly 20–30
minutes and you can close the laptop lid once it says it is queued. Do **not**
change the version number — EAS increments the build number by itself.

When it finishes:

```
npx eas-cli submit -p ios --profile production --latest
```

### In App Store Connect

1. Open the rejected version → **select the new build** (it will be build 8
   or higher; anything below that is the rejected one).
2. **Where the reply goes — there are two places and they are not the same:**

   **(a) The review conversation.** On the rejected version there is a banner
   at the top saying the app was rejected, with a link into the message
   thread (older App Store Connect called this the *Resolution Center*). Open
   it and press **Reply**. This goes back to the reviewer who rejected it.

   **(b) Notes for Review** — a text box further down the *same version page*,
   under **App Review Information**. This is read by whoever picks up the new
   submission, which may not be the same person. It is the more reliable of
   the two, so put the explanation here even if you also reply in the thread.

   **Do NOT wipe what is already in Notes for Review** — the existing note is
   what tells the reviewer they can use the whole app without signing in, and
   losing it invites a different rejection. Replace it with both parts:

> Regarding the previous rejection (Guideline 2.5.4): you were correct. Cruise
> FM does not play audio itself and should not have declared the background
> audio capability. The declaration came from a third-party library that was
> no longer used by the app; it has been removed entirely and this build
> declares no UIBackgroundModes at all. Music playback is performed by the
> user's own music app, which Cruise FM optionally controls while in the
> foreground.
>
> About the app: Cruise FM is a visual driving companion. No account or
> sign-in is required — on first launch you can choose "None / Other" (or
> Skip) on the music platform screen and use every feature (mood stations,
> all visual modes, creating stations) in companion mode. An optional Spotify
> connection enables in-app playback control for Spotify Premium users;
> without it, users play music in their own music app while Cruise FM
> provides the visuals. The app does not use the microphone, collects no
> personal data, and contains no ads. This version is fully free with no
> in-app purchases.

3. **Submit to App Review.** Keep **Manually release this version** so you
   still choose the go-live moment.

### After you submit

- Your phone is unaffected — it stays on the preview channel and keeps
  receiving updates, so polish work can continue while review runs. You do
  **not** need a second build tonight.
- Do **not** publish to the *production* channel while the app is in review;
  that counts as changing the app mid-review. Preview updates are safe.
- If it sits more than two days, request an expedited review at
  developer.apple.com/contact/app-store/?topic=expedite, citing first-launch
  timing. Do **not** cancel and resubmit — that loses your place in the queue.

---

## 0. Before the form: host the website (one-time, ~10 min)

Apple requires a live **Privacy Policy URL** and a **Support URL**. The pages
are ready in the repo's `website/` folder (home, /privacy, /terms, /support).

Easiest deploy for a non-coder — **Netlify Drop**:
1. Go to **app.netlify.com/drop** (make a free account if asked)
2. Drag the whole `website` folder from the project onto the page
3. It gives you a URL like `https://something.netlify.app` — you can rename
   the site in Site settings → change site name → e.g. `cruisefm` →
   `https://cruisefm.netlify.app`
4. Check `…/privacy/` and `…/support/` open in a browser

Write down the URLs — they go in the form below. (A custom domain like
cruisefm.app can come later; Apple only needs working URLs.)

---

## 1. App Information (left sidebar → App Information)

- **Name:** Cruise FM
- **Subtitle (30 chars max):** `Cinematic drives. Your music.`
- **Category:** Primary **Music**, Secondary **Lifestyle**
- **Content rights:** does not use third-party content (your visuals are
  original; users bring their own music via their own accounts)
- **Age rating** (questionnaire): answer **None/No** to everything —
  result should be **4+**

## 2. Pricing and Availability

- **Price:** Free
- **Availability:** all countries (default)

## 3. App Privacy (left sidebar → App Privacy)

Privacy Policy URL: `https://<your-site>/privacy/`

Questionnaire — "Do you collect data from this app?" → **Yes**, then declare
ONLY this:

- **Diagnostics → Crash Data**
  - Used for: **App Functionality**
  - Linked to the user's identity: **No**
  - Used for tracking: **No**

Nothing else is collected (no contact info, no location, no identifiers, no
usage data leaves the phone). The Spotify token stays on-device — that is not
"collection" by Cruise FM.

## 4. The version page (iOS App 1.0)

**Promotional text (170 chars max):**
> Turn every drive into a film. Mood stations, your own playlists, and
> cinematic visual modes — vinyl, cassette, retro tuner — glowing along
> with the music.

**Description:**
> Spotify organises music by artist and genre. Cruise FM organises it by how
> a drive feels.
>
> Pick a mood station — Night Run, Sunset, Coastal, Rain Drive — link one of
> your own playlists, and press Start Drive. Your music plays; Cruise FM
> turns the screen into the in-car experience it always should have been.
>
> CINEMATIC MODES
> • Cassette — spinning neon reels and tape-deck warmth
> • Equalizer — LED bars pulsing in your station's colours
> • Sound Waves — a flowing waveform that ripples with the mood
> • Vinyl — a rotating record with a real tonearm
> • Tuner — drag a real FM dial between moods
> • Horizon — an endless synthwave grid rolling into the sun
> • Circular EQ — a ring of light that kicks to the beat
>
> All seven modes are free while Cruise FM is in its launch period.
>
> BUILT FOR THE DRIVE
> • One-tap Start Drive from the home screen
> • Station-tinted atmosphere that breathes and pulses with the music
> • Auto-dim, like a car head unit — tap to wake, easy on your battery
> • Drag anywhere on the progress bar to seek
> • Drive stats and badges for your journeys
> • Create your own stations with custom names, icons and colours
>
> YOUR MUSIC, YOUR WAY
> Bring your own playlists. Full in-app playback control works with Spotify
> Premium; listeners on other services (or without Premium) play music in
> their own app while Cruise FM runs the visuals alongside.
>
> No account. No ads. Your data stays on your phone.
>
> Eyes on the road — set your drive before you set off.

**Keywords (100 chars max, no spaces after commas):**
`driving,car,music,visualizer,vinyl,cassette,retro,night drive,aesthetic,mood,radio,playlist`

**Support URL:** `https://<your-site>/support/`
**Marketing URL (optional):** `https://<your-site>/`

**Screenshots:** 5–6 portrait screenshots. Take them on the iPhone during a
drive (best set: Vinyl on Coastal, Tuner mid-drag, Equalizer on Night Run,
Cassette on Daylight, the home screen, a station page). Send them to Claude
to be resized/framed to Apple's required dimensions if the upload complains.

**Build:** select the **latest production build (7)** — the launch-free build
uploaded 23 July. Do NOT pick build 3 (old TestFlight build with dev tools on).

## 5. App Review Information

- **Sign-in required:** **No** (leave the demo-account fields empty)
- **Notes for review — paste this:**
> Cruise FM is a visual driving companion. No account or sign-in is required:
> on first launch you can choose "None / Other" (or Skip) on the music
> platform screen and use every feature — mood stations, all visual modes,
> creating stations — in companion mode. Optional Spotify connection enables
> in-app playback control for Spotify Premium users; without it, users play
> music in their own music app while Cruise FM provides the visuals. The app
> does not use the microphone, collects no personal data, and contains no
> ads. This version is fully free with no in-app purchases.
- **Contact:** your name, phone, cruisefmservice@gmail.com

## 6. Submit

- Version release: **Manually release this version** (recommended — YOU press
  the go-live button after approval, so launch lands on your schedule)
- Press **Add for Review** → **Submit to App Review**
- First reviews typically take 24–48 h. Rejections, if any, arrive as
  specific messages — paste them to Claude verbatim for the fix.

---

## Order of play tomorrow

1. Morning: Netlify Drop the website → grab URLs (10 min)
2. Take the 5–6 screenshots on the iPhone (10 min)
3. Fill the forms with this kit (30 min)
4. Submit → start the External Testing group for friends while review runs
