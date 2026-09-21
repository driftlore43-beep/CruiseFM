# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Cruise FM — project context

A premium driving-companion app (React Native / Expo SDK 56, Expo Router). Users bring their own Spotify playlists; Cruise FM wraps them in a cinematic driving experience — mood stations, full-screen visual modes, atmosphere. "Spotify organises by artist/genre; Cruise FM organises by how a drive feels."

The owner does not code — describe changes in plain English, Claude implements everything. Keep explanations non-technical.

## Product decisions (fixed)
- Monetisation: £2.99/mo subscription, 7-day free trial (RevenueCat SDK wired: sandbox test_ key in config.ts, entitlement "premium", safe no-op on web/old builds via src/utils/purchases.ts; real goog_/appl_ keys + store products still pending — see Current state)
- FREE tier: Cassette + Equalizer + Sound Waves modes, basic playback, limited custom stations (3), badges
- PREMIUM: Vinyl + Tuner + Horizon + Circular Equaliser modes, all mood themes, unlimited playlists, future additions
- Never premium: offline listening, badges, founder cosmetics, seasonal themes
- `OWNER_MODE` in src/constants/config.ts bypasses all locks. It is derived from the build, NOT hand-flipped: `__DEV__ || EXPO_PUBLIC_OWNER_MODE === '1'`, with that env var set per profile in eas.json (development/preview "1", production "0"). A store build therefore cannot ship with Premium unlocked, which it silently would have before 2026-09-21.
- Name: staying "Cruise FM" (decided 2026-09-21) — see gotchas for the trademark picture. Don't reopen it unprompted.

## Architecture map
- `src/app/(tabs)/` — cruise (home w/ one-tap Start Drive), stations, modes, profile
- `src/app/premium.tsx` — amber paywall screen; `src/app/auth.tsx` — Spotify OAuth redirect handler (cruisefm://auth)
- `src/components/{Cassette,Equalizer,SoundWave,Vinyl,Tuner,Horizon,CircularWave}Mode.tsx` — seven full-screen visual modes (registry + gating in `src/app/(tabs)/modes.tsx`, host in `NowPlayingHost.tsx`); all share the same shell: full-bleed station image (blurRadius 3.5, `imageStyle={{width:'100%',height:'100%'}}` — REQUIRED, web falls back to intrinsic size without it), 5-stop dark gradient capped ~0.58, glow band tinted from station eqColors, "PLAYING FROM" header, bottom-left song title, white 6px progress bar, white 80px play circle (custom 8x30 pause bars), MaterialCommunityIcons skip-previous/next 48
- `src/components/StationDetailModal.tsx` — station page: full-bleed image, Add your playlist (Spotify picker), mode picker, Start Drive
- `src/constants/stations.ts` — 10 stations (3 free: Night Run, Sunset, Daylight); each has cardGradient (muted card preview), eqColors (equalizer bar palette), iconName (white MCI icon), premium flag
- `src/utils/spotify.ts` — OAuth PKCE + playback API; `useSpotifyPlayback.ts` — live play/pause/skip + 5s now-playing poll used by all modes; `stationPlaylists.ts` — per-station linked playlist (AsyncStorage); `lastCruise.ts` — resume logic
- `src/utils/spotifyHandoff.ts` — the no-API path (see gotchas): `parseSpotifyPlaylistLink` turns a pasted share link into a `spotify:playlist:ID` uri, `openInSpotify` deep-links it into the Spotify app. Native tries `uri:play` → `uri` → https; web leads with https (Safari swallows raw schemes)
- `src/utils/appleMusicHandoff.ts` — the same two jobs for Apple Music: parse a share link to a canonical `https://music.apple.com/…/pl.<id>` url, open it (native tries `music://` first, then https). No API, no allowlist, no token — for an Apple Music listener this IS the experience, not a fallback
- `src/utils/playlistHandoff.ts` — one door in front of both, so callers never branch on service. `platformOfUri` reads the platform off the stored uri itself (nothing extra persisted, old Spotify-only entries keep working); `parsePlaylistLink` accepts a link from either service whichever one the user picked; `openPlaylist` routes it back to the right app
- `src/components/DriveCheckCard.tsx` — "Are you driving?" honesty check: 45 min of untouched playback → card; ignored for 2 min → drive clock pauses (driveStats suspend/resume) until the next playback touch. Playback controls signal life via activityPing in NowPlayingContext
- `website/index.html` — self-contained waitlist landing page (Formspree form ID still a placeholder)
- Credentials in `.env` (EXPO_PUBLIC_SPOTIFY_*) — gitignored, copy manually between machines

## Gotchas learned the hard way
- Never define background JSX as an inline component inside render — new identity each render remounts the blurred image (visible twitching). Use a plain JSX const.
- Station images: assets/stations/*.jpg, must be ≥ ~1100px on the short side or web renders them at intrinsic size (bottom cut-off). Compress to ≤ ~600KB, JPEG only (no .avif/.webp/.png — bundler/perf). Source from Unsplash/Pexels, never Pinterest.
- Expo Go is a dead end (SDK 54 vs our 56 + no custom deep links). Android testing = EAS dev build. Paid Apple Developer account now active (2026-09), so iOS builds are unblocked — EAS builds iOS in the cloud, no local Mac needed; only Simulator *testing* still wants a Mac (on Windows, use Safari at the LAN IP for visuals).
- Spotify playback API needs the user's Spotify app active on some device, and Premium.
- Name / trademark (checked 2026-09-21): UK IPO has NO registered "Cruise FM" in classes 9/38/41 (searched Similar, status All, back to 1976) — but 226 live "Cruise" marks, and cruisefm.co.uk is a London radio station trading under the identical name since 1984 (On & Offline Services Ltd). UK passing-off protects unregistered goodwill, so the residual risk is a complaint, not a register conflict. Decision: keep the name; don't file the words (descriptive + crowded + obvious opponent), file the logo if anything; keep store copy clearly an app, not a station ("driving companion", "your playlists", never "radio station"); Driftlore is the pre-checked fallback if a complaint ever lands.
- Spotify quota policy (confirmed 2026-07-18): extension requests are ORGANIZATIONS-ONLY since May 2025 and require an established business w/ 250k+ MAU — unreachable at launch. Dev-mode allowlist confirmed at 5 users (+ the owner account) — reserve slots for genuine music-testing testers; everyone else runs demo mode. The no-API fallback this demanded is BUILT (`src/utils/spotifyHandoff.ts`, 2026-09): users paste a playlist share link, Start Drive deep-links it into the Spotify app — no auth, no allowlist, no permission from anyone. Cruise FM is the visual layer. This is the path every non-allowlisted user takes, so treat it as the default, not the degraded mode.

## Current state / next steps
- DONE: all visuals unified, Spotify OAuth working on Android build, playback CONFIRMED WORKING on device (2026-07-18: playlists load, music plays, controls obey; play uses active-device fast path, failures surface via PlaybackNotice card)
- DONE 2026-07-19: sandbox purchase CONFIRMED on device (free-user preview → locks appear → Unlock Premium → RevenueCat test purchase unlocks → Restore purchases works)
- DONE 2026-07-20: EAS Update (OTA) wired — expo-updates ~56.0.22 installed; app.json updates.url = https://u.expo.dev/<projectId> + runtimeVersion policy "fingerprint"; eas.json preview/production build profiles carry channel "preview"/"production". Default release behaviour = check-on-launch, apply-on-next-launch (no runtime code added). REQUIRES ONE FRESH BUILD before OTA works — current installed builds lack the expo-updates native module and will NOT receive updates. Owner runs on their machine: (1) `eas build -p android --profile preview` once to bake in expo-updates; after that, JS/asset-only changes ship via `eas update --branch preview -m "<note>"` (minutes, no store, no reinstall). Fingerprint policy auto-blocks OTA when native deps change → that's the signal a new build is needed, not an update.
- DONE 2026-09: open-in-Spotify fallback shipped (`spotifyHandoff.ts` + PlaylistSheet + NowPlayingContext) — the 5-user Spotify quota ceiling no longer gates launch. Also since July: 10 stations (Downtown, Tunnel, Daylight added), 7 modes, per-station mood accents.
- DONE 2026-09: paid Apple Developer account active — iOS route open.
- NEXT (launch, in order — nothing here is code):
  1. Google Play Developer account ($25, Personal type) + identity verification — NOT STARTED, and it gates everything below. Verification takes days.
  2. Play payments profile (bank + tax) — also days; start alongside 1.
  3. Apple: Agreements, Tax & Banking in App Store Connect (Paid Applications Agreement) — same shape, runs in parallel.
  4. Upload builds; create the £2.99/7-day-trial product in each store. Shared product ID: `cruisefm_premium_monthly`. iOS bundle id `com.driftlore.CruiseFM` is already reserved in app.json.
  5. RevenueCat: link both stores, attach the product to the `premium` entitlement, collect `goog_…` + `appl_…` keys → then config.ts must select the key per platform (Platform.select), replacing the single test_ constant.
  6. Play closed test: 12 testers / 14 days minimum before production.
- Owner-facing checklist for steps 1–5 (both stores, with progress tracking): https://claude.ai/artifact/GXBvGG1hPVHAFEoLqAhJ8j
- DONE 2026-09-21: Apple Music handoff + platform-aware Start Drive. Before this, `NowPlayingContext` was Spotify-only top to bottom, so an Apple Music listener pressing Start Drive got `null` — silent nothing — while the only Apple path was a `music://…/search?term=<station name>` blind search for a station that isn't a real playlist. Now: linked Apple playlist → handed to the Apple Music app; nothing linked but a service chosen → a notice saying how to link one (instead of silence); every notice names the user's own app. Verified end to end on web — Apple Music link parses, stores and renders with no mention of Spotify anywhere; Spotify path unchanged (link still stores as `spotify:playlist:…`, junk still rejected).
- DONE 2026-09-21: OWNER_MODE is now build-derived (see Product decisions). Verified by exporting a production web build: premium modes show padlocks there and none in dev.
- STANDING NOTE (2026-09-19): the app is visually finished; the gap to revenue is paperwork, not features. Resist adding stations/modes/polish until it is live — that work is the pleasant kind and it has been crowding out the launch for a quarter.
- POSITIONING (2026-09-21): targeting Apple Music listeners on iOS first; Google Play deferred until iOS shows traction. This sidesteps the Spotify cap entirely (Apple Music has no allowlist), and iOS skips Play's 12-testers/14-days gate. Agree a number that triggers the Play work, or "traction first" becomes never.
