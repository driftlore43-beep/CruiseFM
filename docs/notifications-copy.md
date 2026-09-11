# Notifications — the restraint rules and the full copy set

**BUILT AND LIVE as of 12.08.** This document is the spec; the code is
`src/utils/notifications.ts` (the engine and every rule below),
`src/constants/notificationCopy.ts` (every line), `NotificationHost` (the tap
handler and the replanning) and `NotifyPrompt` (the earned permission ask).

Three test suites hold it to what is written here, and they run offline against
the shipped code:

| Script | What it proves |
|---|---|
| `scripts/test-notifications.mjs` | Every on-air line is TRUE — the station it names is genuinely on air at the hour it fires — plus no banned phrasing, no duplicate ids, nothing in the quiet hours. |
| `scripts/test-notification-budget.mjs` | The ceiling, the 48-hour gap, the quiet hours, the six-hour hush after a drive, the whole back-off ladder, the 8-week no-repeat, badges and the release announcement. |
| `scripts/test-schedule.mjs` | The station timetable the on-air lines depend on. |

Run all three after touching any copy or any rule.

---

## Part 1 — How this app refuses to nag

Most apps treat notifications as a volume dial: more sends, more opens. That
works for a quarter and then people mute you, and muting is permanent — nobody
un-mutes an app. Cruise FM's version is the opposite: **the app has to earn
each notification, and it gives up quietly if it isn't wanted.**

These are mechanical rules, not good intentions. Each one is a line of code.

### The budget

- **Two per week, maximum.** Not a target — a ceiling.
- **At least 48 hours between any two.** Never twice in a day, ever.
- **Nothing between 22:30 and 06:30**, unless the person has specifically
  turned on the late-night station nudge (some people really do drive at 1am —
  After Hours FM exists for them).

### Backing off when ignored — the important one

The app watches whether its nudges get used, and quietly shrinks:

| What happened | What the app does next |
|---|---|
| Notification tapped | Normal cadence continues |
| 2 in a row ignored | Drop to one a week |
| 4 in a row ignored | Drop to one a fortnight |
| 6 in a row ignored | **Stop entirely.** Silence until they open the app themselves |

And when they do come back and drive, the budget resets to normal — no
grovelling message, no "we missed you". It simply resumes.

The principle: **an ignored notification is an answer.** Most apps treat it as
a reason to try harder. That's why people mute them.

### Never send when it would be wrong

- Not while a drive is running, and not for **6 hours** after one ends.
- Not on a day they've already driven. They don't need reminding.
- Not the same line twice within **8 weeks**.
- Not on the day the app was installed. Let them find it themselves first.

### Asking for permission

- **Never on first launch.** The permission prompt appears after their
  **third drive**, and only on the home screen — never mid-drive.
- Before the system prompt, one honest card explains exactly what will be
  sent and how often. iOS only lets you ask once; a denial is close to
  permanent, so the ask has to be worth it.
- If they say no, the app never asks again. There's a row in Settings if they
  change their mind.

### Things this app will never send

- "We miss you" / "Your stations are waiting" / anything guilt-shaped.
- Fake urgency: "Don't lose your streak!", countdowns, expiring anything.
- Marketing dressed as a notification. (The existing **Premium Offers** toggle
  should be deleted — the app is free, and a marketing switch is the fastest
  way to lose someone's trust in the whole notification system.)
- Anything that isn't true. If it says a station is on air, it is.

### The honesty rule

Every notification must be a **statement about the world**, not a request.
"Sunset AM is on air" is a fact. "Come back to Cruise FM" is a plea. The first
one gets tapped; the second gets muted.

---

## Part 2 — The copy

Structure throughout: **title = the moment. Body = the invitation.** Every one
opens straight into that station with the mode they last used — one tap from
notification to driving.

### A. The on-air nudges — time and day

The app already maps hours to stations; the notification simply announces it.

**Weekday evening — the drive home** (17:00–18:00, their usual finish if known)
| Title | Body |
|---|---|
| Clocking off? | Sunset AM is on air. Golden hour, open roads. |
| The long way home | Sunset AM's playing. No need to rush back. |
| Sun's going down | Golden hour on Sunset AM. Take the scenic route. |

**Friday evening — the week ends**
| Title | Body |
|---|---|
| That's the week done | Sunset AM is on air. Drive it out of your system. |
| Friday, finally | Downtown FM's on. Violet towers, sleeping streets. |

**Saturday morning — the weekend jam**
| Title | Body |
|---|---|
| Saturday. Nowhere to be. | Daylight AM's playing. Top down, open road. |
| Cold morning, warm cup | Cars & Coffee FM is on air. Engines idling. |
| The roads are yours today | Daylight AM. Go somewhere. |

**Sunday evening — the wind-down**
| Title | Body |
|---|---|
| Sunday's last light | Coastal FM is on. Ocean air, open horizons. |
| One more before Monday | Night Run AM's playing. Empty expressways. |

**Weekday morning — the run in** (only if they've driven mornings before)
| Title | Body |
|---|---|
| Morning air | Mountain Pass FM. Cold air, fog ahead, one more corner. |
| Beat the traffic | Cars & Coffee FM is on air. Warm cup, cold morning. |

**Late night — opt-in only**
| Title | Body |
|---|---|
| The world's asleep | After Hours FM. The road belongs to you. |
| Still up? | Night Run AM's on. Blue-lit dashboards. |

### B. Weather — phase two, and the only one with a privacy cost

**Decision (owner asked 07.08: "would we allow the app to collect data about
the weather?"). Short answer: it can't be done without knowing roughly where
the phone is, so it ships later, strictly opt-in, and never by default.**

Everything else in this document happens entirely on the phone — the schedule,
the drive history, the back-off counters. Nothing is sent anywhere, which is
what keeps the Privacy page's "no Cruise FM server" claim literally true.
Weather is the one exception: to know it's raining, the app has to ask a
weather service, and that service has to be told approximately where to look.

Four ways to do it, in order of how much they cost the user:

| Approach | Permission needed | Honest verdict |
|---|---|---|
| **Ask for their town once**, store it on the phone | none | Most private. Goes stale if they move. |
| **Coarse location** (iOS "reduced accuracy", ~1–20 km) | one prompt | Plenty precise for rain. Recommended. |
| Precise location | one prompt | Overkill. Invites App Review scrutiny for no gain. |
| Look it up from their internet address | none | Frequently wrong on mobile networks, and still leaks. Not worth it. |

**Recommended:** when — and only when — someone switches Weather on, offer
both of the top two ("Use my rough location" or "Set my town"). Never ask
otherwise. The lookup sends a rough position and nothing else: no identity, no
history, no account. There is precedent already — the album-artwork lookup
calls Apple's public catalogue and is disclosed in the privacy policy; the same
disclosure would be added for weather.

**Sequencing:** ship the time-based nudges first. They need no permission and
leak nothing, so they can go out with confidence. Weather follows as its own
opt-in, with the privacy copy updated in the same change.

Copy, once it exists — Rain Drive FM exists precisely for this:

| Title | Body |
|---|---|
| It's raining | Rain Drive FM is on air. Streetlights in the glass. |
| Wet roads tonight | Rain Drive FM. Slow roads, no hurry. |
| Fog on the hills | Mountain Pass FM's playing. One more corner. |

### C. Learned from their own driving

Only after ~2 weeks of history, and only when the pattern is real. Their data,
their phone, never sent anywhere.

| Title | Body |
|---|---|
| Tuesday, half eight | Your usual. Night Run AM's warmed up. |
| Same time as always | Sunset AM is on air. |
| Long drive ahead? | Coastal FM — you've done your best hours on it. |

### D. Badges — earned, never dangled

Sent **only** when something has genuinely been achieved, or is one drive away.
Never a countdown, never a threat.

| When | Title | Body |
|---|---|---|
| Badge earned | Night Owl, earned | Three drives after dark. It suits you. |
| Badge earned | Full Week | Seven days straight. That's a habit now. |
| One drive away | One more for Full Week | Six days down. Night Run AM's on air. |
| First ever drive | Ignition | Your first drive's on the books. |

Rule: the "one more" variant sends **once per badge, ever** — the moment it
becomes reachable. If they don't take it, that's their answer.

### E. Sunday recap — already promised in Settings

Weekly, Sunday evening, only if they drove that week.

| Situation | Title | Body |
|---|---|---|
| Normal week | Your week on the road | Four drives, 3h 20m. Mostly Sunset AM. |
| One drive | One drive this week | 45 minutes on Coastal FM. Worth it. |
| Big week | Some week | Six drives, 8h 10m. Night Run AM was home. |
| No drives | *(nothing sent)* | Silence is the correct message. |

### F. Something new in the app

Local, scheduled when an update installs. At most one per release, and only
for genuinely new things — never "we fixed some bugs".

| Title | Body |
|---|---|
| Mirror Ball is on the dial | A new way to watch the music. Take it for a drive. |
| A new station just launched | Tunnel FM. Underground, neon tubes, bass. |

---

## Part 3 — The Settings page, rewritten

The current page offers three toggles that do nothing. Replace with what
actually sends:

**DRIVE NUDGES**
- **When a station comes on air** — *A couple a week, at the times you drive* — default **ON**
- **Late night** — *After Hours and Night Run, for 1am drives* — default **OFF**
- **Weather** — *When it's raining, Rain Drive FM* — default **OFF**, phase two,
  and the only row that asks for anything (see section B)

**YOUR DRIVING**
- **Badges** — *When you earn one* — default **ON**
- **Sunday recap** — *Your week on the road* — default **ON**

**WHAT'S NEW**
- **New Stations & Modes** — *When a new mood station or visual mode launches —
  at most one per update* — default **ON** (owner, 07.08: "when new themes come
  out, would notifications also send through? … at least ensure that is left
  turned on"). This is the only way someone finds out the app grew, it is
  capped at one per release, and it never carries an offer.

**DONE 07.08 (OTA):** the old **Premium Offers** toggle is deleted — component,
preference key and all. It sat in a free app that sells nothing, it sent
nothing, and a marketing category is the fastest way to lose trust in every
other notification. Any stored value from it is ignored. The sheet now carries
the ceiling in plain sight: *"Cruise FM sends at most two notifications a week,
and fewer if you don't use them. Nothing is ever sent to sell you something."*

**All five toggles now do something (12.08).** Two of them did not until that
day: `badges` was never read, because nothing called `noteBadgesEarned`, and
`newStations` was never read at all. Both are wired now — badges are judged when
a drive ends, and a release announces itself once via `WHATS_NEW`. An inert
toggle is the same fault as a clock running over silence, and this page had two.

The last row was relabelled **New in Cruise FM**: it announces whatever a
release adds, and 1.3.0's line is about photos rather than a station or a mode,
so "New Stations & Modes" was narrower than the behaviour.

Plus, at the foot, an honest line stating the ceiling — something like
*"Cruise FM sends at most two notifications a week, and fewer if you don't use
them."* Saying it out loud is the strongest possible signal that the app isn't
going to become a nuisance, and it's a promise the code actually keeps.

---

## Part 4 — Build notes

- Needs `expo-notifications` — native, so it batches with the photo-library
  permission and the Save to Photos button in the next build.
- Everything is **local**: scheduled on the phone, nothing sent to a server, so
  the Privacy page's "no Cruise FM server" claim stays true. Update the privacy
  copy to say notifications are scheduled on-device.
- Each notification carries the station and mode, and opens the drive directly
  via the existing deep-link route.
- The budget, the back-off counters and the last-sent timestamps live in
  AsyncStorage next to the drive log.
- iOS asks for permission exactly once — the pre-prompt card matters more than
  any single line of copy here.
