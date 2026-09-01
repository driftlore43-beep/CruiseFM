# Widgets — what to do when the build is cut

The JS half ships over the air and is already live. The Swift half sits in the
repo, **deliberately not wired in**: switching it on adds an App Group
entitlement, which preflight fails on purpose (builds 15 and 24 both died at
signing over an entitlement the provisioning profile did not carry), and that
would block the OTA pipeline in the meantime.

So nothing below happens until a fresh build is actually being cut — and then
all of it happens together.

## What already exists

| Piece | Where | State |
|---|---|---|
| The snapshot the widgets read | `src/utils/widgetData.ts` | shipping |
| Keeps it fresh | `src/components/WidgetSyncHost.tsx` | shipping |
| Where a widget tap lands | `src/app/drive.tsx`, `src/utils/driveRequest.ts` | shipping |
| The bridge that hands it across | `modules/cruise-widgets/` | staged |
| The widgets themselves | `targets/widgets/` | staged |

Four widgets: **Start Drive**, **On Air Now**, **Your Streak** (Home Screen)
and **On Air** (Lock Screen — rectangular, circular and inline).

## One thing that is already true

`modules/cruise-widgets/` **autolinks**, like `cruise-music-kit` does — local
Expo modules are picked up without appearing in `app.json`. Verified with
`npx expo-modules-autolinking search --platform apple`, which lists it.

So the bridge compiles into the **next build of any kind**, even one cut
before the widget target is added. That is harmless, and worth knowing rather
than discovering: in such a build `widgetsAvailable()` returns true, the app
publishes a snapshot on every background, and `setSnapshot` returns `false`
because there is no App Group to write to. Nothing reads it, nothing throws,
nothing is logged. It only becomes useful once the two steps below are done.

## Owner-side, once, on the Apple Developer site

1. developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers**
2. Register an **App Group**: `group.com.driftlore.CruiseFM`
3. Open the app ID `com.driftlore.CruiseFM` → **App Groups** → tick it → Save

Same shape as enabling MusicKit. Nothing to pay for.

### And the widget's OWN app ID — learned the hard way, 01.09

**The extension is a separate app**, `com.driftlore.CruiseFM.widget`, and it
needs the same App Group ticked on it. This is not optional and it is not the
same box: an extension has its own identifier, its own provisioning profile
and its own capabilities.

It does not exist until the first build tries to make it. EAS registers it
automatically — `✔ Bundle identifier registered com.driftlore.CruiseFM.widget`
— and then tries to switch App Groups on for it and **fails**:

```
Failed to patch capabilities: [ { capabilityType: 'APP_GROUPS', option: 'ON' } ]
Apple API error: The request entity is not a valid request document object -
Unexpected or invalid value at 'data.relationships.bundleIdCapabilities.data.[0].attributes'
```

That is Apple's API refusing the automatic switch, not a repo problem — App
Groups needs to be told *which* group, and the auto-sync does not send one. The
error prints the exact URL to fix it at. So the first build of a widget target
is **expected** to fail once, and the sequence is:

1. Run the build. Let it fail at "Syncing capabilities".
2. Open the link it prints, or Identifiers → App IDs →
   `com.driftlore.CruiseFM.widget`.
3. Tick **App Groups**, click **Edit/Configure**, tick
   `group.com.driftlore.CruiseFM`, Continue, **Save**.
4. Run the build again. With the capability already on, there is nothing to
   patch, so the sync finds no difference and passes.

**A failed build still burns a build number** (`appVersionSource: remote`
increments server-side before any of this), so expect a gap in the sequence.
Harmless — build numbers only have to increase.

**If this is skipped**, the build still succeeds and the widgets still install
— they just show "Open the app to get started" for ever, because the shared
container the snapshot goes into does not exist. That is the failure to watch
for, and it is silent.

## Build-side, in one change

1. `npx expo install @bacons/apple-targets`
2. `app.json` → add `"@bacons/apple-targets"` to `plugins`, and add the
   entitlement to the iOS section:
   ```json
   "entitlements": {
     "com.apple.security.application-groups": ["group.com.driftlore.CruiseFM"]
   }
   ```
3. `scripts/preflight-allow.json` → add
   `"com.apple.security.application-groups"` to `entitlements`. **Do this
   knowingly**: that list is the record of every capability the profile is
   expected to carry, and step 3 in the section above is what makes it true.
4. Bump `version` **and** `runtimeVersion` in `app.json` together — the
   pinned-runtime rule, since this build genuinely changes native code.
5. `node scripts/preflight.mjs` — must pass 11/11.
6. Build on the **`testflight`** profile, so the owner's phone stays on the
   preview channel.

## After it installs — check in this order

1. Open the app once. Nothing is written until it runs (`WidgetSyncHost`
   publishes on launch and on every background).
2. Long-press the Home Screen → **+** → search "Cruise FM" → four widgets
   should be listed.
3. Add **On Air Now**. It should name the station the app's own Stations page
   says is on air. If it says "Open the app to get started", the App Group is
   the first suspect, not the code.
4. Tap it — should land in a drive on that station.
5. Add **Start Drive** after driving something, and check it names that
   station and reopens that deck.

## Things worth knowing before changing any of it

**The timeline is the whole trick.** iOS budgets a widget to a handful of
reloads a day, so no app can poll for "what's on now". WidgetKit instead takes
a list of future entries and renders them itself, on time, with the app not
running. Cruise FM already owns a real broadcast schedule, so a day of
changeovers is written into every snapshot and the On Air widget genuinely
changes through the day without ever refreshing. Do not replace that with a
refresh policy; it will be worse and it will still be wrong.

**No logic in Swift.** Which station is on air, what the dial says, whether
someone is shown DRIVES or SESSIONS — decided in `widgetData.ts`, where the
app's own screens share the code and `scripts/test-widget-data.mjs` checks it
against the real schedule. A second copy in Swift is how a widget starts
disagreeing with the app, and a widget is read at a glance and believed.

**Colours, not photographs, and it is a real limit.** A widget extension
cannot read the app's bundled assets, and a custom station's photo lives in
the app's documents directory, outside the shared container. Getting pictures
across means copying files into the App Group when a photo is saved — worth
doing, not done.

**Adding a field to the snapshot**: add it to the TypeScript type, and to
`targets/widgets/Snapshot.swift` **as an optional**. A widget binary already
on a phone will be handed newer snapshots by an app that updated over the air,
and a required property it has never heard of makes the whole decode fail —
blanking every widget at once, with nothing logged. `scripts/test-widget-contract.mjs`
checks the two halves still agree; run it after any change to either side.

## What is not built yet

**The Live Activity** — the Lock Screen banner, the Dynamic Island, and (the
reason it is worth doing) the CarPlay dashboard, which a Live Activity reaches
automatically once it exists on the phone. It is a separate target and a
larger piece of work, with one genuine open question recorded in AGENTS.md:
Cruise FM does not play the audio itself, and Apple Music playback
deliberately uses the system player so music survives the app being suspended
— so the app may not be running to push an update when the song changes.
Keeping a Live Activity in step song-by-song without a server is unsolved;
"drive in progress" — station, mode and a timer — is buildable now and is the
honest scope.
