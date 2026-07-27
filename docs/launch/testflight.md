# Sending Cruise FM to iPhone friends (TestFlight)

Goal: friends install it once, then wake up to every overnight improvement
automatically. TestFlight is Apple's official "try my app before the store"
tool — free, safe, and normal for betas.

You do this on your **Windows PC**, inside the project folder, signed in to
the Apple ID **cruisefmservice@gmail.com**.

---

## One-time setup (about 30 min of waiting, ~5 min of typing)

### 1. Get the latest project + build the TestFlight version
```
git pull origin claude/cruise-fm-v4wk5f
eas build -p ios --profile testflight
```
- This builds a "store-style" copy in the cloud (~15–20 min).
- If it asks to log in, use **cruisefmservice@gmail.com**.
- If it asks *"Generate a new Apple Distribution Certificate?"* → **Yes**.

### 2. Upload it to TestFlight
```
eas submit -p ios --profile testflight --latest
```
- First time, it creates the Cruise FM record on App Store Connect for you.
- When it finishes, Apple spends ~5–15 min "processing" (you get an email).

### 3. Add your friends
Go to **appstoreconnect.apple.com** → **Cruise FM** → **TestFlight** tab.

Two ways to invite:
- **External link (best for friends):** create a group under *External
  Testing*, add the build, and Apple runs a quick one-time *Beta App Review*
  (usually approved within a day). After that you get a **public invite link**
  you can text to anyone.
- **Internal (instant, but limited):** only works for people you add as users
  on your App Store Connect account — fine for 1–2 close testers, skips review.

> The first external build needs Apple's ~1-day review. Plan the very first
> send a day ahead; after that, updates are instant (see below).

### 4. Friends install
They install the free **TestFlight** app from the App Store, tap your invite
link, and install Cruise FM. Done.

**Tell them:** they don't need to connect Spotify. Open a station → paste any
Spotify playlist link → **Start Drive** opens it in Spotify, and Cruise FM is
the visuals over the top.

---

## Every night after that — the magic part

You do **not** rebuild. Just push the day's work:
```
git pull origin claude/cruise-fm-v4wk5f
eas update --branch preview -m "what changed"
```
Because the TestFlight build listens on the **preview** channel, this one
command updates **your phone and every friend at once**. They open the app,
wait a few seconds, fully swipe it closed, reopen — and they're on the newest
version. The Profile version line ("updated …") is the proof it landed.

### When a rebuild *is* needed
Only when we add a new **native** feature (a new device capability). The
fingerprint system auto-blocks the OTA in that case — that's the signal to run
the `eas build` + `eas submit` steps again. Everyday visual/behaviour tweaks
ship over the air, no rebuild.
