# iOS / Apple setup — plain-English checklist

The app's iOS config is already done (bundle id, icon, mic permission, OAuth
scheme). This is the account + build side.

---

## Step 1 — Enrol in the Apple Developer Program (you, ~20 min + Apple's wait)

Costs **£79/year**. Do it in a web browser.

1. Make sure the **Apple ID** you'll use has **two-factor authentication on**
   (Apple requires it). Use an Apple ID you intend to keep — it *owns* the app
   forever. Your personal Apple ID is fine, or make a dedicated one.
2. Go to **developer.apple.com** → **Account** → **Enrol**.
3. Choose **Individual / Sole Proprietor** (not Organization). It's far faster
   — no company paperwork (no "D-U-N-S number"). Trade-off: the App Store
   "seller" line shows *your name*, not a company name. Fine for launch; you
   can convert to a company later.
4. Confirm your details, agree, and **pay the £79**.
5. Apple verifies your identity. Usually minutes; sometimes up to ~48 hours.
   You'll get an email when it's active.

That's the whole gate. Everything below waits until the email says you're in.

---

## Step 2 — First build onto your own iPhone (fastest test path)

This installs the real app straight on your iPhone, no App Store review.

On your computer, in the CruiseFM folder:

1. Register your iPhone as a test device (one time):
   ```
   eas device:create
   ```
   Pick "website / QR"; open the link **on your iPhone** and install the
   little profile it offers. That registers the phone.

2. Build for iOS:
   ```
   eas build -p ios --profile preview
   ```
   The first iOS build asks to sign in to your **Apple Developer** account and
   sets up signing automatically (say yes to the prompts — EAS creates the
   certificates for you). ~15–25 min in the cloud.

3. Install: open the finished build's link on your iPhone, tap **Install**.

Now test everything on a device you trust — connect Spotify, try every mode,
the mic glow, the controls.

Over-the-air updates work here too, same as Android:
`eas update --branch preview -m "..."`.

---

## Step 3 — TestFlight (later, for other testers)

When you want people *other* than yourself testing on iPhone:
```
eas build -p ios --profile production
eas submit -p ios --latest
```
That sends it to **App Store Connect → TestFlight**. Add testers by email;
they install the TestFlight app and then Cruise FM. (Apple's TestFlight is
lighter than Google's closed test — no 12-tester / 14-day rule.)

---

## Later — Apple Music (MusicKit)

Being enrolled unlocks the **MusicKit** key in the Apple Developer portal,
which is what lets Cruise FM give *full* playback control to anyone with an
Apple Music subscription — no allowlist like Spotify. That's a separate build;
we'll tackle it once you're in and the Spotify side is confirmed on iPhone.

---

## Notes

- No Mac needed for any of the above — EAS builds iOS in the cloud.
- A Mac is only needed for the free **iOS Simulator** dry run (optional, and it
  doesn't need the paid program) — a £0 way to preview the app on iOS first.
- Apple Developer Program renews yearly (£79); a lapse pulls the app from sale
  until renewed.
