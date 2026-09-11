# Playbook for the next app

Everything Cruise FM taught, written as instructions for the next project
rather than as a memoir.

**How to use this file.** Copy it into the new project's repo on day one and
rename it `CLAUDE.md` (or `AGENTS.md`). Claude reads that file automatically at
the start of every session, so these become the working rules from the first
message — no re-explaining, no relearning the same lessons at the same cost.
Then let it grow: append decisions as they're made, including the ones that
didn't work.

---

## Part 1 — How we work

- **The owner does not code.** Explanations go in plain English, no jargon, and
  changes are described by what they do on screen, not how they're built.
- **The owner art-directs; Claude implements.** Every good call in Cruise FM
  came from looking at the screen and saying what was wrong. That is the
  scarce skill and it isn't delegated.
- **Screenshots are the shared language.** A photo of the real phone settles
  arguments that code and arithmetic cannot.
- **Claude verifies before claiming.** "Done" means it was run, measured or
  rendered — not that the edit was typed.

---

## Part 2 — The ten rules

**1. Measure the thing; don't reason about it.**
When a fix based on how something *should* work doesn't move the symptom,
stop theorising and read the actual state — the real config, the real pixels,
the real response. Cruise FM lost four rounds to "the mirror ball isn't
spinning" (it was, invisibly) and two theories to a missing permission that
one config dump revealed instantly.

**2. The screen beats the style sheet.**
Layout numbers describe intentions; the rendered screen is the truth. When a
measurement from a screenshot disagrees with the code, believe the screenshot
and set the number from it.

**3. Build the instrument before the third guess.**
Second wrong diagnosis = stop fixing, start measuring. Ship a diagnostic that
prints exactly what the failing system said, rather than another plausible
theory. Every confident guess costs the owner a wasted trip.

**4. A test that cannot fail is worse than no test.**
Before trusting a check, ask: *if this were broken, would it actually say so?*
Cruise FM chased a phantom freeze for days because the probe tested scrolling
in one direction only. Also: never print PASS outside the condition that
proves it.

**5. Anything that exists twice is already drifting.**
Duplicated UI silently diverges — eight copies of one button row ended up with
three different spacings. Extract it the moment the second copy appears.

**6. Set up instant updates on day one.**
Being able to put a change on the owner's phone in two minutes, instead of
waiting days for review, is why this app got dozens of polish rounds. Batch
the slow, review-requiring changes deliberately and rarely.

**7. Write decisions down, including the rejected ones.**
The project notes record what was tried, what failed and *why* — that is what
stops the same dead end being re-attempted a month later. Keep one long-lived
notes file and append to it constantly.

**8. Honesty is a feature.**
The best-received choices were the honest ones: a drive clock that pauses when
you're clearly not driving; a message admitting a service won't share its
data; saying "visuals only" instead of faking capability. Users forgive
limitations, not deception.

**9. Learn the store's rules early and cheaply.**
Both of Cruise FM's rejections were self-inflicted and visible in our own
files before Apple ever saw the app. Run a pre-submission checklist before the
*first* submission, not after the second rejection. (See Part 3.)

**10. Fewer and better.**
Eight share-card designs became two, and the two are better than any of the
eight. A retired visual mode improved the line-up. Cutting is a feature.

---

## Part 3 — Day-one setup that paid for itself

Do these before building features, not after:

1. **A notes file** (`CLAUDE.md`) — this playbook plus every decision as it's
   made. Cheapest, highest-return thing in the whole project.
2. **Over-the-air updates**, if the platform allows them, plus a one-button way
   to publish. Cruise FM used a manual GitHub Action so the owner stayed in
   control of what shipped and when.
3. **A version readout inside the app** (Settings → "updated on <date>"), and
   an update button. Without it, "is my phone running the new code?" is
   unanswerable — and that question came up constantly.
4. **A smoke-test harness** that drives the real app through its main flows and
   reports errors. Cruise FM's ran the whole app in a browser and caught real
   bugs repeatedly.
5. **A pre-submission checklist** (copy `docs/launch/pre-submission-checklist.md`
   and adapt). The habit it encodes: verify from the app's own *resolved*
   configuration, never from what you wrote or what you remember fixing.
6. **Know which build is which.** Be able to answer "what code is in the build
   the store has?" A build cut nineteen minutes before its own fix caused an
   entire rejection cycle here.

---

## Part 4 — Product decisions worth making early

- **Name the one thing the app does that nobody else does**, and protect it.
  For Cruise FM it was organising music by how a drive *feels*. Everything
  memorable came from that; everything generic could have been copied.
- **Check third-party limits before designing around them.** Spotify's API caps
  developer apps at a handful of users — discovered late, and it reshaped the
  whole product. Read the access rules of any service you depend on *first*.
- **Decide the free/paid split early, then leave it alone** until there is
  something to sell. Shipping a purchase screen with no products behind it is
  what caused a rejection.
- **Plan for the platform you'll actually launch on.** iOS and Android have
  very different review and testing rules; pick the first one deliberately.

---

*Written 07.08.2026, at the end of Cruise FM's launch week — three App Store
submissions, two rejections, and a great deal of polish in between.*
