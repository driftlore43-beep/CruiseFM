# Cruise FM — Project Architecture

**Audited against the codebase on 2026-09-05 at commit `84e3cab`.** Everything
here was read out of the repository rather than recalled. Anything uncertain is
labelled **[UNVERIFIED]**.

---

## 1. What the app is

Cruise FM is an **iOS driving-companion app**. The user brings their own
Spotify or Apple Music playlists; Cruise FM wraps them in a full-screen
cinematic visual — a turning record, a cassette, a mirror ball — organised by
**mood stations** rather than genre.

The one-line positioning, used throughout the product and the store listing:

> Spotify organises by artist and genre; Cruise FM organises by how a drive
> feels.

**Cruise FM never plays audio itself.** Spotify or the Apple Music system
player does. Cruise FM is the visual layer and the transport controls. This is
load-bearing, not a detail:

- The app declares **no background-audio capability**. It claimed one once (via
  a stray `expo-audio` plugin) and Apple rejected build 7 under Guideline
  2.5.4. See `KNOWN_ISSUES.md`.
- It follows that a widget or Live Activity cannot legitimately animate in real
  time — the app is not running, and it has no audio session to justify
  background time.

**Platform reality:** iOS only in practice. Android is configured in
`app.json` but has never shipped (blocked on Google's 14-day closed-test
requirement). A web build exists **purely as a test harness** — it is how every
visual check and layout measurement in this repo is done. It is not a product.

---

## 2. Tech stack (exact, from `package.json`)

| Thing | Version |
|---|---|
| Expo SDK | `~56.0.9` |
| React Native | `0.85.3` |
| React | `19.2.3` |
| expo-router | `~56.2.9` (typed routes on) |
| TypeScript | `~6.0.3` |
| react-native-svg | `15.15.4` |
| react-native-purchases (RevenueCat) | `^10.4.3` |
| @sentry/react-native | `^8.19.0` |
| @bacons/apple-targets | `5.0.0` |
| AsyncStorage | `2.2.0` |

`app.json` sets `experiments: { typedRoutes: true, reactCompiler: true }`.

**Native version pinning is a safety rule, not a preference.** Several packages
are pinned to exact versions with no `~`: `expo-constants 56.0.17`,
`expo-image-manipulator 56.0.17`, `expo-image-picker 56.0.16`,
`expo-media-library 56.0.6`, `expo-notifications 56.0.16`,
`expo-sharing 56.0.23`. Build 25 crashed 40 ms into launch because
`expo-media-library` had drifted to a version compiled against a newer
`ExpoModulesCore` than SDK 56 ships (`Symbol not found: Record.from(...)`).
`scripts/preflight.mjs` enforces this. **Do not loosen these pins.**

---

## 3. Repository layout

```
/
├── app.json                 Expo config — version, runtime, plugins, entitlements
├── eas.json                 Build + submit profiles (development/preview/testflight/production)
├── AGENTS.md                The accumulated project log (very long, chronological)
├── CLAUDE.md                One line: @AGENTS.md
├── src/                     All app code (153 files)
├── targets/widgets/         The WidgetKit extension (Swift) — 45 files
├── modules/                 Two local Expo native modules (Swift)
├── plugins/                 One config plugin
├── scripts/                 Tests, harnesses, preflight, marketing (52 files)
├── docs/                    Documentation, launch guides, design mockups
├── assets/                  Images, station photos, fonts
├── website/                 Marketing site (manual Netlify deploy)
├── screenshots-appstore/    The store screenshot set
├── screenshots-marketing/   Captioned slides built from the above
└── .github/workflows/       ota-update.yml — the only workflow
```

### 3.1 `src/` structure

```
src/
├── app/            Routes (expo-router file-based)
├── components/     ~70 components incl. all 8 visual modes
├── context/        5 React contexts
├── constants/      8 data/config modules
├── hooks/          3 small hooks
├── utils/          43 modules — services, storage, playback
└── global.css
```

---

## 4. Navigation

**expo-router, file-based.** No React Navigation config written by hand beyond
the custom tab bar.

### Route map (`src/app/`)

| File | Route | Purpose |
|---|---|---|
| `_layout.tsx` | root | Provider stack + app shell (see §5) |
| `index.tsx` | `/` | `<Redirect href="/cruise" />`, nothing else |
| `(tabs)/_layout.tsx` | — | Tab navigator + custom `FloatingTabBar` + mounts `NowPlayingHost` |
| `(tabs)/cruise.tsx` | `/cruise` | Home. Hero, one-tap Start Drive, shelves, cards |
| `(tabs)/stations.tsx` | `/stations` | The dial — AM/FM bands, receiver-style rows |
| `(tabs)/modes.tsx` | `/modes` | The eight visual modes |
| `(tabs)/profile.tsx` | `/profile` | Stats, settings, drive log entry point |
| `auth.tsx` | `/auth` | Spotify OAuth redirect handler (`cruisefm://auth`) |
| `drive.tsx` | `/drive` | Deep-link target for widgets (`cruisefm://drive?station=&mode=`) |
| `premium.tsx` | `/premium` | Paywall (self-guarded — see §9) |
| `explore.tsx` | `/explore` | **DEAD** — unmodified Expo template (`TabTwoScreen`) |
| `visuals.tsx` | `/visuals` | **DEAD** — unreferenced, uses Reanimated |

**`explore.tsx` and `visuals.tsx` are unreachable** — nothing links to them
(verified by grep). They are the only remaining importers of
`react-native-reanimated` alongside `components/animated-icon.tsx` and
`components/ui/collapsible.tsx`, which are also template leftovers. Safe to
delete; see `TODO.md` (technical debt).

### 4.1 Two structural navigation facts that have caused real bugs

**(a) `NowPlayingHost` is mounted in `(tabs)/_layout.tsx`, NOT at the root.**
It renders the fullscreen mode and the mini-player. A deep link is a *root*
route, so when a widget tap cold-starts the app into `/drive`, the host does not
exist yet — calling `np.open()` there creates a real session with no visible
deck. The fix already in place: `/drive` records the request via
`utils/driveRequest.ts` and hands over to the home tab, which consumes it on
focus. **Do not "simplify" this.**

**(b) iOS will not reliably stack a second `Modal` over the first.** It
presents nothing and swallows every touch — the app looks frozen. Every
fullscreen mode is a `Modal`. Consequences enforced throughout the code:

- `StationSheet` (mood picker on the Modes tab) is deliberately **not** a Modal.
- `OffAirAsk` is an in-page overlay, not a Modal.
- Any sheet that *can* appear during a drive must call `useSheetOpen(true)` so
  `AutoDim` and the mode's pull-to-dismiss stand down.
- Any Modal that can appear during a drive needs
  `supportedOrientations={['portrait','landscape']}` or it snaps the screen
  upright.

---

## 5. Provider stack (`src/app/_layout.tsx`)

```
AppearanceProvider          light/dark palette
  └ NavigationSkin          hands the palette to React Navigation's ThemeProvider
     └ CruiseThemeProvider  accent colour / glow intensity
        └ MotionProvider    atmosphere, auto-dim, daylight, vinyl-classic settings
           └ EntitlementsProvider   isPro — the single premium source of truth
              └ NowPlayingProvider  the drive session
                 └ AppShell
```

`AppShell` also mounts, in this order and for stated reasons:

- `<Slot />` — the routed page
- `PlatformSelector` — the "Connect Your Music" sheet
- `WhatIsThis` — one-off explainer; its `visible` expression waits for the
  brand intro **and** the platform lookup to have *answered* **and** that sheet
  to be gone (two Modals cannot stack)
- `AutoUpdateHost` — self-updating (see §11)
- `NotificationHost` — schedules local notifications, turns a tap into a drive
- `WidgetSyncHost` — publishes the widget snapshot
- `NotifyPrompt` — the earned permission ask
- `BrandIntro` — **last child**, so it covers everything

`initCrashReports()` and `holdSplashScreen()` run at module scope, before any
component, so startup crashes are reported.

> **Correction to AGENTS.md:** an entry dated 28.07 states `BrandIntro.tsx` was
> DELETED. It was (`5db5699`) and then **re-added** in `247faef` ("Hold the
> opening logo, and light the broadcast arcs in order"). It is live today.

---

## 6. The drive session — `context/NowPlayingContext.tsx` (636 lines)

The single most important file in the app. Owns the concept of "a drive is
happening".

### Public API (`useNowPlaying()`)

| Member | Meaning |
|---|---|
| `session` | `{ mode, stationId, preview? }` or `null` |
| `open(mode, stationId?, opts?)` | Start a drive. `opts`: `preview`, `paused`, `adopt` |
| `stop()` | End it; returns the finished `DriveEvent` via `justFinished` |
| `minimize()` / `expand()` / `expanded` | Fullscreen vs mini-player |
| `playing` / `setPlaying` | The transport's optimistic state |
| `adoptPlayState(p)` | The service's *confirmed* state |
| `setStationId(id)` | Retune mid-drive (the Tuner) |
| `setMode(mode)` | Change the visual without touching the music |
| `musicSwitching` | True during the deliberate 900 ms silence between stations |
| `playbackNotice` / `clearPlaybackNotice` | The notice card |
| `reportStartResult(result)` | Feed a `StartResult` back in |
| `handoff` / `returnToSpotify()` | "Playing in Spotify" state |
| `sheetCount` / `holdSheet(open)` | How many sheets are open over the drive |
| `activityTick` / `activityPing()` | Life signal for the driving check |
| `justFinished` / `clearJustFinished()` | The drive stub |

### `startActionFor(playingUri, isPlaying, targetUri)` — exported and pure

Decides between three genuinely different outcomes when a drive starts:

- same playlist already playing → **leave it alone**
- same playlist paused → **resume in place** (call play with **no** URI —
  passing one restarts from the top, which is the bug this fixed)
- anything else, or no answer → **start**

Tested by `scripts/test-start-action.mjs`.

---

## 7. Playback layer

```
        Modes / home / mini-player
                   │
        utils/useMusicPlayback.ts        ← THE SWITCHBOARD. Everything goes here.
           ┌───────┴───────┐
useSpotifyPlayback   useAppleMusicPlayback
           │                │
    utils/spotify.ts   utils/appleMusic.ts
           │                │
   Spotify Web API    modules/cruise-music-kit (Swift/MusicKit)
```

### The switchboard rule (`utils/useMusicPlayback.ts`)

Both hooks are **always called** (rules of hooks) but only the selected one is
made **active**, via `visible && selected`. That flag gates the poll, the
`adoptPlayState` call **and** the AppState listener.

Why it matters: they used to both receive `visible`, and both wrote the shared
play state from different services — the transport alternated play/pause and the
clock ran backwards (`0:09 → 0:06 → 0:10 → 0:13 → 0:10`).

**HARD RULE, already violated twice historically:** nothing below the UI layer
may import a platform's transport directly. `useTrackClock.ts` exports
`seekActive()` which routes by platform. Check with:

```
grep -rn "from '@/utils/spotify'" src/components
```

Anything transport-shaped in that list is a latent bug.

### Spotify (`utils/spotify.ts`, 892 lines)

- **OAuth PKCE**, redirect `cruisefm://auth`, handled by `src/app/auth.tsx`.
- Scopes: `user-read-playback-state`, `user-modify-playback-state`,
  `user-read-currently-playing`, `playlist-read-private`,
  `playlist-read-collaborative`.
- Storage keys: `spotify_access_token`, `spotify_refresh_token`,
  `spotify_token_expiry`, `spotify_granted_scopes`, `spotify_pkce_verifier`,
  `spotify_restricted_account`.
- `spotifyFetch` folds every failure into `null` — right for polling, wrong for
  screens. `spotifyFetchDetailed()` returns a reason and a 12 s timeout for
  anything a human is reading. `spotifyCommand` exists because
  **a 204 means success** and `spotifyFetch` was folding it into `null`.
- **HARD LIMIT:** Spotify's developer tier caps full playback control at
  **5 accounts**. Extension requests have been organisations-only since May
  2025 (established business, 250k+ MAU). This is why Apple Music matters.
- **SETTLED, DO NOT RETRY:** a development-tier app **cannot read a playlist's
  contents** by any route — `/playlists/{id}/tracks` returns 403 while
  `/playlists/{id}` returns 200. The song list falls back to the player's
  **queue** (`/me/player/queue`), which is player *state* and works.
- **SETTLED, DO NOT RETRY:** `/audio-features` and `/audio-analysis` return
  **403** (apps registered after Nov 2024). There is no beat-map route on
  either platform.

### Apple Music (`utils/appleMusic.ts` + `modules/cruise-music-kit`)

Every call is wrapped in `safe()` and no-ops when the native module is absent,
because this JS ships over the air into builds that do not have it.
`appleMusicAvailable()` is the guard.

Native module surface (`CruiseMusicKitModule.swift`, 318 lines):
`requestAuthorization`, `authorizationStatus`, `canPlayCatalog`,
`currentEntry`, `play`, `pause`, `next`, `previous`, `seekTo`, `setShuffle`,
`setRepeat`, `playPlaylist`, `playlistTracks`, `playTrackInPlaylist`,
`libraryArtwork`, `userPlaylists`.

**It uses `SystemMusicPlayer`, not `ApplicationMusicPlayer`** — deliberately.
The application player's queue lives in our process and dies with it, so
force-quitting or backgrounding the app killed the music. `SystemMusicPlayer`
hands the queue to the Music app: it survives, and the lock screen and CarPlay
controls work. The trade, accepted: the user's Music app shows what Cruise FM
started, because it genuinely is playing it.

`setShuffle`/`setRepeat` go through `MPMusicPlayerController.systemMusicPlayer`
(the classic MediaPlayer bridge), not MusicKit's `state` — writing through
MusicKit onto a mirror of the Music app's playback did not take.

### Album artwork — three routes, in order

1. MusicKit `entry.artwork` / `song.artwork` — **nil for library items**
2. MediaPlayer `nowPlayingItem.artwork` — **nil for cloud items** (streamed
   library = not on the phone)
3. `utils/appleArtwork.ts` → **Apple's public iTunes catalogue**
   (`itunes.apple.com/search`, no key, no token). Returns an https URL.

Any `artworkUrl` not matching `^(https?|file|data):` is nulled, because MusicKit
returns `musicKit://` URLs that RN's `<Image>` draws as nothing, silently — and
because the string was truthy, the JS fallback never ran.

---

## 8. Data layer — **there is no database and no server**

**This is a deliberate architectural position, not a gap.**

- **No Firebase. No Supabase. No backend of any kind.** Verified by grep across
  `src/`, `scripts/`, `targets/`, `modules/` and `package.json` — zero hits.
- **No user accounts.** The only "authentication" is OAuth to a music service
  so the app can control *that service's* playback.
- **No analytics.** Deliberate: the privacy policy promises nothing leaves the
  device, so a third-party analytics SDK would break a public promise. The
  practical consequence is that **there is no usage data to read** — retention
  questions have to be asked of testers directly.
- The only outbound calls are: Spotify Web API, Apple's public iTunes catalogue
  lookup, Apple's App Store version lookup, RevenueCat, Sentry, and Expo's own
  update server.

**All persistence is `AsyncStorage` on the device.** This is the complete
"schema":

| Key | Owner | Holds |
|---|---|---|
| `cruise_appearance` | `utils/appearance.ts` | light/dark/system |
| `@cruise_theme_v1` | `context/ThemeContext.tsx` | accent + glow |
| `cruise_atmosphere` | `utils/motionSettings.ts` | haze on/off |
| `cruise_soft_atmosphere` | `utils/motionSettings.ts` | half-strength haze |
| `cruise_auto_dim` | `utils/motionSettings.ts` | auto-dim on/off |
| `cruise_daylight` | `utils/motionSettings.ts` | daylight legibility mode |
| `cruise_data_saver` | `utils/motionSettings.ts` | reduced motion |
| `cruise_vinyl_classic` | `utils/motionSettings.ts` | classic vinyl look |
| `cruise_custom_stations` | `utils/customStations.ts` | the user's own stations |
| `cruise_station_playlists` | `utils/stationPlaylists.ts` | **per-station, per-service** playlist links (v2) |
| `cruise_last_cruise` | `utils/lastCruise.ts` | resume target |
| `cruise_drive_log` | `utils/driveStats.ts` | every finished session |
| `cruisefm_session_kind` | `utils/sessionKind.ts` | driving vs listening |
| `cruisefm_mode_order` | `utils/modeOrder.ts` | user's mode order |
| `cruisefm_platform` | `utils/musicPlatform.ts` | chosen service (**bare string, not JSON**) |
| `cruisefm_platform_skipped` | `utils/musicPlatform.ts` | skipped the picker |
| `cruisefm_last_played` | `utils/lastPlayed.ts` | last song heard |
| `cruisefm_notification_prefs` | `utils/notifications.ts` | toggles |
| `cruisefm_notification_state` | `utils/notifications.ts` | budget + back-off ladder |
| `cruisefm_whats_new_seen` | `utils/whatsNew.ts` | version announced |
| `cruisefm_intro_seen` | `utils/intro.ts` | explainer shown |
| `cruisefm_driver_name` | `utils/driverName.ts` | display name |
| `cruise_rate_state` | `utils/rateApp.ts` | `{ firstSeenAt, askedAt }` |
| `cruise_founder_badge` | `utils/founder.ts` | founder eligibility |
| `cruisefm_store_version_cache` | `utils/appStoreUpdate.ts` | 12 h cache |
| `cruisefm_store_update_dismissed` | `utils/appStoreUpdate.ts` | dismissed **per version** |
| `cruise_make_station_dismissed` | `MakeStationCard` | invitation dismissed |
| `cruise_spotify_nudge_dismissed` | `SpotifyNudgeCard` | nudge dismissed |
| `cruise_spotify_display_name` | `utils/spotify.ts` | cached profile name |
| `cruise_dev_free_preview` | `context/EntitlementsContext.tsx` | dev-only lock preview |
| `cruisefm_widget_station_images_v1` | `utils/widgetArtwork.ts` | one-time back-fill flag |

**Files on disk** (not AsyncStorage): custom-station photos live in
`documentDirectory` (**not** `cacheDirectory` — iOS could sweep those away),
written by `utils/stationPhoto.ts` as a 1400px display copy and a soft
backdrop copy.

`cruise_rate_state.firstSeenAt` is **self-initialising on first read** and is
consulted on every home-page visit via `RateCard`. It is therefore the
de-facto "when did this device first use the app" stamp — relevant to the
grandfathering plan in `TODO.md`.

---

## 9. Premium / monetisation

**Nothing is being charged today.** `LAUNCH_FREE = true` in
`src/constants/config.ts` means every user gets everything.

```ts
isPro = hasSubscription || (OWNER_MODE ? !devFreePreview : LAUNCH_FREE)
```

`context/EntitlementsContext.tsx` is the **single source of truth**; every lock
reads `useEntitlements().isPro`.

| Setting | Value | Meaning |
|---|---|---|
| `OWNER_MODE` | `false` | must stay false in any store build |
| `LAUNCH_FREE` | `true` | everyone premium, no paywall |
| `REVENUECAT_API_KEY` | `test_Ccs…` | **sandbox Test Store key** — purchases are pretend |
| `PREMIUM_ENTITLEMENT` | `'premium'` | RevenueCat entitlement id |

**Locked pricing decisions** (do not re-open without the owner):
£1.99/month, £18/year ("save 25%"), 7-day free trial, optional launch-week
Founder lifetime £24.99.

**The intended split** — free: Cassette, Equalizer, Circular EQ (from
`MODE_CATALOG`), 3 custom stations, badges. Premium: Vinyl, Tuner, Horizon,
Mirror Ball, CD; the FM band; all themes. Never premium: offline listening,
badges, founder cosmetics, seasonal themes.

**`src/app/premium.tsx` guards itself.** While `isPro` it renders no offer at
all and navigates away. This exists because Apple rejected build 18 under
Guideline 2.1(b) — a reviewer reached a live £1.99 paywall in a submission with
no IAP products. Entry-point gating alone is one forgotten button away from
another rejection. `scripts/preflight.mjs` checks this guard is present.

---

## 10. Visual modes (the product's centre)

Eight, all in `src/components/`, all registered in
`src/constants/modeCatalog.ts`:

| id | Label | Premium | File | Lines |
|---|---|---|---|---|
| `cassette` | Cassette | no | `CassetteMode.tsx` | 1436 |
| `equalizer` | Equalizer | no | `EqualizerMode.tsx` | 1015 |
| `orb` | Circular EQ | no | `CircularWaveMode.tsx` | 586 |
| `vinyl` | Vinyl | yes | `VinylMode.tsx` | 1783 |
| `radio` | Tuner | yes | `TunerMode.tsx` | 1260 |
| `horizon` | Horizon | yes | `HorizonMode.tsx` | 810 |
| `disco` | Mirror Ball | yes | `DiscoBallMode.tsx` | 1936 |
| `cd` | CD | yes | `CDMode.tsx` | 1023 |

> The Mirror Ball's **id is `disco`** — it was renamed from "Disco Ball" but
> saved cruises store the bare string, so the id must not change.
> `knownMode()` falls back to `equalizer` for any unrecognised id.

### Shared machinery every mode uses

| Piece | File | Job |
|---|---|---|
| `ModeScrim` | `components/ModeScrim.tsx` | **The only** darkening over a station photo |
| `StationBackdrop` | `components/StationBackdrop.tsx` | Full-bleed pre-blurred photo |
| `StationIdentity` | `components/StationIdentity.tsx` | Eyebrow + dial + name |
| `ModeActionRow` | `components/ModeActionRow.tsx` | `[Change Mode] [playlist] [share]` |
| `SeekBar` | `components/SeekBar.tsx` | Progress + the little car playhead |
| `useTrackClock` | `utils/useTrackClock.ts` | The one clock, and `seekActive()` |
| `LandscapeChrome` | `components/LandscapeChrome.tsx` | The docking landscape deck |
| `CastShadow` | `components/CastShadow.tsx` | Contact shadow for record/cassette |
| `AmbientGlow` | `components/AmbientGlow.tsx` | The haze — **the only** reader of `atmosphere` |
| `confirmedPlaying` | `utils/confirmedPlaying.ts` | `playing && !switching && (track?.isPlaying ?? true)` |

### Rules that are load-bearing

- **`AmbientGlow` is the only thing the Atmosphere setting governs.** Gating
  the Mirror Ball's room layers (beams, glitter, fireflies, dust, bloom) on it
  was built, measured, and reverted at the owner's instruction. **Never gate
  the room layers on `atmosphere`.**
- **A mode's scene gates on `confirmedPlaying`, the transport gates on
  `playing`.** A button that hesitates reads as broken; a scene that animates
  over silence is a lie. That split is deliberate.
- **The scrim comes from one place.** Four modes each kept a private copy with
  a slightly different near-black (`rgba(2,2,10)`, `rgba(2,3,14)`,
  `rgba(3,4,16)`, `rgba(2,2,12)`) so no colour search could find them all.
  `scripts/test-mode-scrim.mjs` now enforces it.
- **Never animate a layout property.** Progress bars use `scaleX` +
  `translateX` on the native driver, not `width`. `EqualizerHeader` uses
  `scaleY` + a paired `translateY`, not `height` — animating `height` is why it
  never moved on a real phone.
- **Light must be gradient falloff, never a stroked or hard-edged shape.** Any
  hard edge eventually gets reported as an artefact ("the Os", "a wire cage",
  "an awkward streak"). This has been relearned on the mirror ball's rim, the
  vinyl's pie wedges, the CD's fan and the Winamp card's frame.
- **`LANDSCAPE_READY` in `utils/orientation.ts`** lists the modes with a real
  landscape composition. The Tuner is deliberately excluded — squish is worse
  than staying upright.

---

## 11. Notable systems

### `utils/notifications.ts` (527 lines) — all local, no server, no push tokens

The restraint is mechanical, not aspirational: max 2/week, ≥48 h apart, nothing
22:30–06:30 unless opted in, never during a drive or 6 h after, never on a day
they already drove, no line repeated within 8 weeks, none on install day.
Adaptive back-off: 2 ignored → 1/week, 4 → 1/fortnight, 6 → stop until they
open the app.

`plan()` **drops any candidate whose station would not be on air when it
fires** — so no copy edit can ship a lie. All state changes go through a
serialised `updateState()` (two callers used to race).

`plugins/withoutPushEntitlement.js` deletes the `aps-environment` entitlement
that `expo-notifications` adds automatically. Ours are local-only and need no
entitlement; build 24 died on exactly that key. **Keep the plugin last in the
`plugins` array** — auto-applied plugins run before named ones.

### `constants/schedule.ts` — the broadcast timetable

Half-open `[start, end)` windows in hours, may wrap midnight, optional `days`.
`'always'` for round-the-clock (Rain Drive — its real schedule is the weather).
`primaryOnAir()` picks whichever station is nearest the *middle* of its window,
which rotates the headline through the day for free.

**THE ONE RULE: off air is presentation, never a lock.** Every station stays
playable at every hour. `needsOffAirAsk()` raises a card; nothing is gated.

`scripts/test-schedule.mjs` enforces **no dead hours** — every hour of every
day must have a scheduled station on air. It caught a real 04:00–05:00 gap.

### `components/AutoUpdateHost.tsx` — the app updates itself

On returning from a real absence (>3 min) it checks, fetches and
`reloadAsync()`s. `shouldUpdateNow()` is **exported and pure** because
everything it decides ends in throwing the running app away. Guards: never
during `np.session`, never with `sheetCount > 0`, never within 60 s of a cold
start, 30-min cooldown, and the busy guard is re-read *after* the download.
Tested by `scripts/test-auto-update.mjs`.

---

## 12. Native modules (`modules/`)

Both are **local Expo modules** — autolinked, verified with
`npx expo-modules-autolinking search --platform apple`.

| Module | File | Job |
|---|---|---|
| `cruise-music-kit` | `ios/CruiseMusicKitModule.swift` (318 lines) | Apple Music via MusicKit |
| `cruise-widgets` | `ios/CruiseWidgetsModule.swift` (158 lines) | Write the widget snapshot |

`cruise-widgets` exposes `setSnapshot(json)`, `isReady()`,
`setStationImage(id, base64)`, `setArtwork(base64)`.

> Because these are **Expo** modules they are *not* in React Native's
> `NativeModules` map. Lookups go through
> `requireOptionalNativeModule('CruiseMusicKit')`, which returns `null` rather
> than throwing when absent — essential, because this JS ships OTA into builds
> without the module.

---

## 13. The widget extension (`targets/widgets/`)

Built by `@bacons/apple-targets` from `expo-target.config.js`.

**Target name must have no space** (`CruiseFMWidgets`). The plugin derives
`productName` by stripping non-word characters, and EAS registers credentials
under *that*, while the Xcode target keeps the raw value. `'CruiseFM Widgets'`
killed build 37.

### Data flow — the app writes, the widget reads. Never the reverse.

```
utils/widgetData.ts   builds WidgetSnapshot (JSON)
      ↓ components/WidgetSyncHost.tsx
modules/cruise-widgets setSnapshot() → App Group UserDefaults
      ↓
targets/widgets/Snapshot.swift  decodes it
```

- App Group: **`group.com.driftlore.CruiseFM`** — must match in four places:
  `app.json` entitlements, `expo-target.config.js`, `modules/cruise-widgets`,
  and the Apple Developer app ID. When they disagree the widgets silently show
  placeholder data with **no error anywhere**.
- Snapshot key: `cruisefm.widget.snapshot`. Version `1`.
- **Swift's decoder is all-or-nothing.** One missing required property and the
  whole decode returns nil, blanking every widget at once with nothing logged.
  **Any new snapshot field must be added to `Snapshot.swift` as OPTIONAL**,
  because a widget binary already on a phone gets handed newer snapshots by an
  app that updated over the air.
- `scripts/test-widget-contract.mjs` reads the property names out of the
  shipped Swift and checks them against a snapshot built by the shipped
  TypeScript.

### Ten designs, seven gallery rows

| Row (`kind`) | Looks | Files |
|---|---|---|
| Start Drive | — | `StartDriveWidget.swift` |
| On the Deck (`CruiseFMVinyl`) | `road`, `label` | `VinylWidget.swift`, `DeckLook.swift` |
| Last Played | `cdPlayer`, `player`, `stub` | `LastPlayedWidget.swift` |
| On Air Now | — | `OnAirWidget.swift` |
| The Mode | `mirrorBall`, `cd` | `ModeWidget.swift` |
| Your Streak | — | `StatsWidget.swift` |
| Lock Screen (iOS 16+) | — | `LockScreenWidget.swift` |

**A "look" is a different way of drawing the same idea** — those collapse into
one row with a setting. Two designs answering *different* questions get their
own row. That is what keeps the gallery at seven instead of twelve.

**`kind` strings are permanent.** `CruiseFMVinyl` shipped in build 39; changing
a kind makes a widget already on someone's Home Screen vanish. Configurable
(iOS 17 `AppIntentConfiguration`) and static (pre-17) variants **share a kind**
and only one is ever registered — see `CruiseWidgetBundle.swift`.

### Pictures — two rules, and the difference is deliberate

`targets/widgets/Artwork.swift`:

- `Art.cover(station:)` = **station photo first**, song cover second. Used
  everywhere. The owner's reason: a custom station can carry a photo the
  listener chose, and the widgets are the only place it is ever shown.
- `Art.songCover(station:)` = **song cover first**, station second. Used by the
  **CD look only** — a disc with a record sleeve on it is the whole idea.
- The Deck's **Road** look deliberately calls neither: the station photo is
  already its backdrop, so it falls back to a printed pressing.

Both orders and which widget uses which are pinned in
`scripts/test-widget-bundle.mjs`, because flipping two terms of a `??` is
invisible in review.

### Fonts

`fonts: [...]` in `expo-target.config.js` **does nothing** — the plugin ignores
unknown keys, and that silent no-op is why build 39 drew the dial in a system
face and every station icon as a missing-glyph box. Fonts reach the extension
as **bundle resources**: the `.ttf` files live in `targets/widgets/` and the
**committed** `Info.plist` declares them in `UIAppFonts`.

**SwiftUI matches the PostScript name, not the filename.** `MaterialCommunityIcons.ttf`
declares `MaterialDesignIcons`; `DotGothic16-Latin.ttf` declares
`DotGothic16-Regular`. `scripts/test-widget-fonts.mjs` reads the ttf's own name
table and checks every name the Swift asks for.

**Seven segments cannot draw an M.** DSEG7 is for digits only; band letters go
through DSEG14 via `DialText`/`splitDial`.

---

## 14. External services

| Service | Used for | Auth | Notes |
|---|---|---|---|
| Spotify Web API | Playback control, playlists, queue | OAuth PKCE | 5-account dev cap |
| Apple MusicKit | Playback, library playlists | User's own subscription | Needs `NSAppleMusicUsageDescription` only — **not** `com.apple.developer.applemusic` |
| iTunes catalogue | Album art fallback | None | `itunes.apple.com/search` |
| App Store lookup | "update available" card | None | `itunes.apple.com/lookup?bundleId=` |
| RevenueCat | Subscriptions | Publishable key | **Sandbox key today** |
| Sentry | Crash reports | DSN in `config.ts` | Cannot see `SIGKILL` (bug_type 309) |
| EAS Update | OTA | `EXPO_TOKEN` (GitHub secret) | |
| Netlify | Website | — | **Manual drag-and-drop deploy** |

---

## 15. Environment variables

Only two, both public-by-design (`EXPO_PUBLIC_` is inlined into the bundle):

- `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`
- `EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET`

They live **server-side in EAS**, per environment (`development`, `preview`,
`production`). `.env` is gitignored and is **not** in the working tree. It does
not need copying between machines — use `eas env:pull --environment preview`.

### Two traps that have each caused a silent outage

1. **From SDK 55 `eas update` REQUIRES `--environment <name>` and ignores
   `.env`.** Without the flag it publishes with **empty** Spotify credentials
   and looks completely successful — nobody on the channel can sign in.
   Worse: eas-cli shows an interactive picker, but the env loading is keyed on
   the raw **flag**, not the prompt's answer. **If a list of environments
   appears, the flag was forgotten — Ctrl-C and start again.** In CI there is
   no prompt at all.
2. **A variable stored with `secret` visibility appears in `env:list` by name
   with `*****` but eas-cli cannot read it back**, so it inlines as empty while
   a name-only grep reports green. Verify with
   `eas env:list --environment preview --include-sensitive --format short`.

---

## 16. Build, release and OTA

### `eas.json` profiles

| Profile | Channel | Distribution | Use |
|---|---|---|---|
| `development` | — | internal | dev client |
| `preview` | `preview` | internal | Android APK |
| `testflight` | **`preview`** | store | **the owner's phone + TestFlight** |
| `production` | **`production`** | store | the App Store |

**THE CHANNEL TRAP, which cost a day:** every EAS build appears in TestFlight,
so it is easy to install the *production*-profile build on the testing phone —
which quietly moves that phone onto the production channel and it stops
receiving preview updates. **The owner's phone stays on `testflight`-profile
builds.**

### `.github/workflows/ota-update.yml`

Two ways in:

1. **Automatic** — every push to `claude/cruise-fm-v4wk5f` publishes to
   **preview**, filtered to paths an update can actually carry (`src/**`,
   `assets/**`, `app.json`, `package.json`, `package-lock.json`).
2. **The button** (`workflow_dispatch`) — for everything else. Modes:
   `publish`, `diagnose`, `build`, `submit`. **Production is never automatic.**

Guards that run on every path: refuse to publish stale code from `main`;
`preflight`; readable-Spotify-keys check; "is a real build listening on this
runtime version" check.

### Versioning — `version` vs `runtimeVersion`

- `version` = `1.4.0` (what Apple sees; must increase every submission)
- `runtimeVersion` = **`1.3.0`, deliberately held** via `runtimeHeldAt` in
  `scripts/preflight-allow.json`

**`runtimeVersion` decides which installed builds can receive an update.**
Moving it to 1.4.0 while every 1.4.0 build was failing meant every publish
reached *zero* phones. **Bump it in the same commit that cuts a build which
succeeds — never before one.**

### `scripts/preflight.mjs` — run before any build

Reads the **resolved** iOS config (`expo config --type introspect`), never
`app.json`, because a plugin can inject Info.plist keys nobody wrote.
`scripts/preflight-allow.json` holds the deliberate exceptions, including
`provenCommit` — the last commit whose build was **installed and opened on a
real phone**. Currently `057c023` (build 28). **Move it forward only after a
build has actually been opened, never because it merely built.**

### `scripts/production-lag.mjs` — is the public app behind?

Reads the workflow's own run history; a production publish is a run whose job is
named `eas update --branch production` **and** whose `Publish` step succeeded (a
diagnose run has the identical job name). Exits 1 if anything is waiting.
`SELFTEST=1` forces the caught-up case. A weekly Routine
(`trig_011Pjg2StJ2NSB1xf9pkPjJC`, Mondays 09:00 AEST) runs it and only speaks
up when the app is behind.

> **It goes through `curl`, not `fetch`** — this environment's proxy is picked
> up by curl and not by Node's fetch, which returns 403.

---

## 17. Testing

**31 offline suites in `scripts/test-*.mjs`, all passing** (verified
2026-09-05). They transpile the **shipped** modules with `ts.transpileModule`
and drive them against stubs — they test real code, not lookalikes.

`scripts/test-contrast.mjs` is the exception: it drives a real browser and needs
Playwright plus a running web build, so it "fails" when run offline. That is
expected, not a regression.

`scripts/harness/` drives the **real web build** with Playwright:
`health.mjs` (15-step walk), `rest.mjs` (all 8 modes rest/wake),
`scrub-rest.mjs`, `inputs.mjs`, `skip-fire.mjs`, `ball-touch.mjs`,
`tuner-sweep.mjs`, `visible.mjs` (shared helpers), `shots.mjs`.

### The single most repeated lesson in this project

> **A check is not evidence until it has been seen to fail.**

Recorded instances: the runtime guard that returned success while reading
nothing (30.07–01.09); the vignette rule that parsed `transparent` as a
one-element list and matched nothing; the time-format scan whose loop was
deleted so `offenders` was never filled; twelve dial checks appended *after*
`process.exit()`; the widget-bundle test that looked for `DeckStyle` in the
wrong file and silently skipped the Deck; `test-skip-clock.mjs`'s first version,
which could not catch the bug it was written for.

**Before trusting a green check, reintroduce the bug and watch it go red.**

---

## 18. Branding

- **Company: Strofi Technologies.** From Greek στροφή (*strofí*) — a turn or
  bend. Pronounced STRO-fee. Named after the *next* product deliberately, so
  Cruise FM's users read the word before Strofi exists. Full policy in
  `docs/brand.md`.
- **App Store Developer line reads `JESSICA ARROYO`** and cannot be changed
  without converting to an Organization account (needs a registered business +
  D-U-N-S) or Apple granting a trading name.
- **Bundle id `com.driftlore.CruiseFM` is permanent.** Changing it would be a
  different app with no reviews and no installs.
- **Owner is in Australia.** Home trademark registry is IP Australia
  (AUD $250/class). An earlier round of advice wrongly assumed the UK — that is
  corrected in `docs/brand.md`.
- **No logo, no registered entity, no trademark, no dedicated domain** as far
  as this repo evidences. **Do not write "Ltd" or "Inc"** — the Terms already
  name Strofi Technologies as the contracting party.
- The share cards print `cruisefm.netlify.app`. When a real domain lands,
  `INSTALL_HOST` in `ShareCardStyles.tsx` and `INSTALL_URL` in `ShareCard.tsx`
  must move **together**.

### Design language (enforced across the app)

- Near-black ground `#0a0a10`, hairline `rgba(255,255,255,0.12)`, glass
  `rgba(255,255,255,0.05)`.
- **The primary button is a solid pill in the opposite of the page** — white
  with dark text on dark, dark with light text on light. It *inverts*; a white
  pill on near-white paper is not a button.
- Amber `#F7B733` survives only on badges, the FM half of the wordmark and
  premium tags. Violet is gone except Switch accents.
- **Don't tighten letter-spacing below 28pt.** 38 styles were neutralised for
  this; large display text keeps its negative tracking.
- Light-mode colours from outside the palette must go through
  `readableOn()` (`utils/appearance.ts`) — it deepens pale colours while
  preserving hue (measured 0.0° shift across the brand set) and returns dark
  mode untouched.
- `PAGE_GUTTER = 20` in `constants/theme.ts` — every page and the tab bar.

---

## 19. iOS configuration (`app.json`)

```
bundleIdentifier   com.driftlore.CruiseFM
appleTeamId        XWPL6DG7L8
ascAppId           6793233679
supportsTablet     true          ← iPad support IS live
scheme             cruisefm
```

**Info.plist keys** (only these; anything else is a rejection risk):
`ITSAppUsesNonExemptEncryption: false`, `NSAppleMusicUsageDescription`,
`NSPhotoLibraryAddUsageDescription`. Two more arrive from plugins and are
allowlisted: `NSLocalNetworkUsageDescription` (from `expo-dev-client`) and
`NSPhotoLibraryUsageDescription` (from `expo-image-picker`).

**Entitlements:** exactly one —
`com.apple.security.application-groups: [group.com.driftlore.CruiseFM]`.

**Never add `com.apple.developer.applemusic`.** Build 15 died on it. Native
MusicKit needs the usage string and nothing else; that entitlement belongs to
the MusicKit *web/REST* flow with developer tokens, which this app does not use.

**`UIBackgroundModes` must never be declared.** Preflight checks this.

**Plugin order matters.** `./plugins/withoutPushEntitlement` is last, because
auto-applied plugins (`expo-notifications`) run before named ones.
`expo-media-library`'s `photosPermission: false` once **deleted** the key
`expo-image-picker` sets — when two plugins touch one key, only the resolved
config says who won.

---

## 20. Android configuration

Configured in `app.json` (`package: com.driftlore.CruiseFM`, adaptive icons)
and `eas.json` (`preview` → APK, `production` → app bundle). **Never shipped.**

Blocked on Google Play's 14-day closed-test requirement (12 testers). Known
gaps if it is ever picked up:

- Share-card save: RN's own `Share` cannot attach a file on Android;
  `expo-sharing` is installed and wired as the Android branch.
- Pinch-zoom in `PhotoFrameSheet` is iOS-only (RN `ScrollView`'s `zoomScale`
  has no Android implementation) — Android pans only.
- The rating card and several other paths are `Platform.OS === 'ios'` gated.

---

## 21. Design mockup harness (`docs/design/`)

Not app code. It renders widget design proposals as HTML → Chromium screenshot,
so designs can be reviewed before Swift is written.

| File | Job |
|---|---|
| `v3.py` | Builds the whole gallery sheet — one `slot()` per design |
| `ball.py` | The mirror ball generator (real sphere projection) |
| `assets.py` | Reads the **repo's own** fonts and station photos |
| `shot4.mjs` | Playwright screenshot |

```bash
OUT=/tmp/widgets.html python3 docs/design/v3.py
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
  IN=/tmp/widgets.html OUT=/tmp/gallery.png node docs/design/shot4.mjs
```

**Run it from the repo root**, or `assets.py` cannot find the fonts.

> **RULE:** the mockup is a *proposal* until the Swift exists, and a **lie**
> about the Swift afterwards unless kept in step. It has twice shown text the
> Swift never drew, costing a round of confusion each time.
