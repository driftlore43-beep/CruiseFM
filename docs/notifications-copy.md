# Notifications — the restraint rules and the full copy set

Draft for review. Nothing here is built yet; notifications need a new binary
(see the next-fresh-build batch). The copy and the timing are ordinary code
afterwards, so both can be tuned over the air.

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

### B. Weather — phase two

The most delightful ones, and the only ones needing a lookup. Rain Drive FM
exists precisely for this.

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
- **When a station comes on air** — *A couple a week, at the times you drive*
- **Late night** — *After Hours and Night Run, for 1am drives* (default OFF)
- **Weather** — *When it's raining, Rain Drive FM* (phase two)

**YOUR DRIVING**
- **Badges** — *When you earn one*
- **Sunday recap** — *Your week on the road*

**WHAT'S NEW**
- **New stations and modes** — *At most one per update*

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
