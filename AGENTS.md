# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Cruise FM — project context

A premium driving-companion app (React Native / Expo SDK 56, Expo Router). Users bring their own Spotify playlists; Cruise FM wraps them in a cinematic driving experience — mood stations, full-screen visual modes, atmosphere. "Spotify organises by artist/genre; Cruise FM organises by how a drive feels."

The owner does not code — describe changes in plain English, Claude implements everything. Keep explanations non-technical.

## Product decisions (fixed)
- Monetisation: £1.99/mo subscription, 7-day free trial (RevenueCat SDK wired: sandbox test_ key in config.ts, entitlement "premium", safe no-op on web/old builds via src/utils/purchases.ts; real goog_ key + Play Console product still pending)
- FREE tier: Cassette + Equalizer modes, basic playback, limited custom stations (3), badges
- PREMIUM: Vinyl + Retro Radio modes, all mood themes, unlimited playlists, future additions
- Never premium: offline listening, badges, founder cosmetics, seasonal themes
- `OWNER_MODE = true` in src/constants/config.ts bypasses all locks during development

## Architecture map
- `src/app/(tabs)/` — cruise (home w/ one-tap Start Drive), stations, modes, profile
- `src/app/premium.tsx` — amber paywall screen; `src/app/auth.tsx` — Spotify OAuth redirect handler (cruisefm://auth)
- `src/components/{Equalizer,Cassette,Vinyl,RetroRadio}Mode.tsx` — full-screen visual modes; all four share the same shell: full-bleed station image (blurRadius 3.5, `imageStyle={{width:'100%',height:'100%'}}` — REQUIRED, web falls back to intrinsic size without it), 5-stop dark gradient capped ~0.58, glow band tinted from station eqColors, "PLAYING FROM" header, bottom-left song title, white 6px progress bar, white 80px play circle (custom 8x30 pause bars), MaterialCommunityIcons skip-previous/next 48
- `src/components/StationDetailModal.tsx` — station page: full-bleed image, Add your playlist (Spotify picker), mode picker, Start Drive
- `src/constants/stations.ts` — 8 stations; each has cardGradient (muted card preview), eqColors (equalizer bar palette), iconName (white MCI icon)
- `src/utils/spotify.ts` — OAuth PKCE + playback API; `useSpotifyPlayback.ts` — live play/pause/skip + 5s now-playing poll used by all modes; `stationPlaylists.ts` — per-station linked playlist (AsyncStorage); `lastCruise.ts` — resume logic
- `src/components/DriveCheckCard.tsx` — "Are you driving?" honesty check: 45 min of untouched playback → card; ignored for 2 min → drive clock pauses (driveStats suspend/resume) until the next playback touch. Playback controls signal life via activityPing in NowPlayingContext
- `website/index.html` — self-contained waitlist landing page (Formspree form ID still a placeholder)
- Credentials in `.env` (EXPO_PUBLIC_SPOTIFY_*) — gitignored, copy manually between machines

## Gotchas learned the hard way
- Never define background JSX as an inline component inside render — new identity each render remounts the blurred image (visible twitching). Use a plain JSX const.
- Station images: assets/stations/*.jpg, must be ≥ ~1100px on the short side or web renders them at intrinsic size (bottom cut-off). Compress to ≤ ~600KB, JPEG only (no .avif/.webp/.png — bundler/perf). Source from Unsplash/Pexels, never Pinterest.
- Expo Go is a dead end (SDK 54 vs our 56 + no custom deep links). Android testing = EAS dev build; iOS on Windows blocked (needs paid Apple acct) — use Safari at the LAN IP for visuals, or the iOS Simulator on a Mac.
- Spotify playback API needs the user's Spotify app active on some device, and Premium.
- Spotify quota policy (confirmed 2026-07-18): extension requests are ORGANIZATIONS-ONLY since May 2025 and require an established business w/ 250k+ MAU — unreachable at launch. Dev-mode allowlist confirmed at 5 users (+ the owner account) — reserve slots for genuine music-testing testers; everyone else runs demo mode. Before public launch, build the no-API fallback: Start Drive deep-links the linked playlist into the Spotify app (spotify: URI, no auth needed) for non-allowlisted users; Cruise FM stays the visual layer.

## Current state / next steps
- DONE: all visuals unified, Spotify OAuth working on Android build, playback CONFIRMED WORKING on device (2026-07-18: playlists load, music plays, controls obey; play uses active-device fast path, failures surface via PlaybackNotice card)
- DONE 2026-07-19: sandbox purchase CONFIRMED on device (free-user preview → locks appear → Unlock Premium → RevenueCat test purchase unlocks → Restore purchases works)
- DONE 2026-07-20: EAS Update (OTA) wired — expo-updates ~56.0.22 installed; app.json updates.url = https://u.expo.dev/<projectId> + runtimeVersion policy "fingerprint"; eas.json preview/production build profiles carry channel "preview"/"production". Default release behaviour = check-on-launch, apply-on-next-launch (no runtime code added). REQUIRES ONE FRESH BUILD before OTA works — current installed builds lack the expo-updates native module and will NOT receive updates. Owner runs on their machine: (1) `eas build -p android --profile preview` once to bake in expo-updates; after that, JS/asset-only changes ship via `eas update --branch preview -m "<note>"` (minutes, no store, no reinstall). Fingerprint policy auto-blocks OTA when native deps change → that's the signal a new build is needed, not an update.
- DONE 2026-07-20: honest handoff — non-allowlisted drives that hand music to the Spotify app now swap the dead transport for a "Playing in Spotify" panel (src/components/HandoffOverlay.tsx, dropped into all 7 modes; `handoff` flag + `returnToSpotify` on NowPlayingContext). Price dropped £2.99 → £1.99 everywhere.
- DONE 2026-07-20: mic-reactive visuals (v1, Equalizer only) — expo-audio ~56.0.12 installed; app.json expo-audio plugin carries the mic permission string; `useMicLevel(active)` (src/utils/useMicLevel.ts) meters live loudness in `mixWithOthers` mode so it never interrupts Spotify, normalises dBFS→0..1, eases it, and returns available:false on web/denial → modes keep their timed animation. Setting `micReactive` (default ON) on MotionContext + Profile toggle; privacy clause added to legal.ts. Wired into EqualizerFullscreen bars (timed loop preserved as the fallback) + a reactive glow bloom. CONFIRMED ON DEVICE 2026-07-20: mic level tracks the music (owner-only "mic 0.xx" readout in EqualizerFullscreen) AND Spotify keeps playing cleanly (mixWithOthers works). NEEDED ONE FRESH BUILD for the native mic module; all subsequent glow/reactivity tuning ships via OTA. Shared `src/components/MicGlow.tsx` (self-contained: owns the hook + micReactive setting, renders null unless live loudness is available) now drops the reactive glow into all other modes (Cassette/Vinyl/Tuner/Horizon/SoundWave/CircularWave) via one line each above the HandoffOverlay.
- DONE 2026-07-21/22 (iPhone polish round, all OTA): mic-reactive now DEFAULT OFF (iOS: recorder + Spotify contend for the audio session — confirmed on device; smart auto-pause `micQuietTick` hush built but mic stays opt-in in Profile); ModeCloseButton chevron on all 7 modes (iOS dismiss gesture unreliable); station-owns-its-playlist rule — playStationMusic never resumes stray music: no linked playlist → pause + 'no-playlist' notice ("add a playlist"), StationDetailModal glows Add-Playlist for ANY unlinked station; mini-player ✕ now pauses Spotify; changing a station's playlist takes effect immediately (relinkStationPlaylist); keep-awake for whole drive via NowPlayingContext; SpotifyNudgeCard home tip (connected users, "wake Spotify first", dismissible); Vinyl/Cassette vertical layout aligned with other modes; settings pages swipe-right-to-back (SettingsPageShell PanResponder) + honest Account page (no fake "coming soon" — working two-tap Delete My Data: disconnectSpotify + AsyncStorage.clear).
- iOS DISTRIBUTION (2026-07-22): Apple Dev enrolled (cruisefmservice@gmail.com, team JESSICA ARROYO). eas.json `testflight` profile = store distribution on the PREVIEW channel → one `eas update --branch preview` feeds owner device + all TestFlight testers. App record "Cruise FM" created in App Store Connect (SKU cruisefm). Build succeeded; next: `eas submit -p ios --profile testflight --latest`, external tester group (~1-day Beta App Review), invite friends. Guide: docs/launch/testflight.md. LAUNCH PLAN: iOS public launch this week (launch FREE first, £1.99 sub as fast-follow); Android blocked by Google's 14-day closed test — follows later.
- NEXT: Google ID verification clears → upload build, £1.99 product in Play Console, swap test_ key for goog_ key → closed test (12 testers/14 days)
