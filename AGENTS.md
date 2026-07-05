# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Cruise FM — project context

A premium driving-companion app (React Native / Expo SDK 56, Expo Router). Users bring their own Spotify playlists; Cruise FM wraps them in a cinematic driving experience — mood stations, full-screen visual modes, atmosphere. "Spotify organises by artist/genre; Cruise FM organises by how a drive feels."

The owner does not code — describe changes in plain English, Claude implements everything. Keep explanations non-technical.

## Product decisions (fixed)
- Monetisation: £2.99/mo subscription, 7-day free trial (RevenueCat planned, not integrated)
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
- Credentials in `.env` (EXPO_PUBLIC_SPOTIFY_*) — gitignored, copy manually between machines

## Gotchas learned the hard way
- Never define background JSX as an inline component inside render — new identity each render remounts the blurred image (visible twitching). Use a plain JSX const.
- Station images: assets/stations/*.jpg, must be ≥ ~1100px on the short side or web renders them at intrinsic size (bottom cut-off). Compress to ≤ ~600KB, JPEG only (no .avif/.webp/.png — bundler/perf). Source from Unsplash/Pexels, never Pinterest.
- Expo Go is a dead end (SDK 54 vs our 56 + no custom deep links). Android testing = EAS dev build; iOS on Windows blocked (needs paid Apple acct) — use Safari at the LAN IP for visuals, or the iOS Simulator on a Mac.
- Spotify playback API needs the user's Spotify app active on some device, and Premium.

## Current state / next steps
- DONE: all visuals unified, Spotify OAuth working on Android build, playback wired into all 4 modes (untested on device yet)
- NEXT: test playback on Android build → then make Start Drive play the station's LINKED playlist URI (stationPlaylists.ts already stores it) → then RevenueCat paywall (wire "Unlock Premium" button)
