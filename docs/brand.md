# Strofi Technologies — brand policy

The rules for using the company's name, and the facts anyone needs before they
use it. Written 12 August 2026.

This is a **policy document, not a style exercise.** There is deliberately no
logo in it yet: the name is doing all the work at the moment, and getting the
name right costs nothing while getting it wrong is expensive to undo.

---

## 1. What Strofi Technologies is

Strofi Technologies is the **company**. Cruise FM is a **product** of that
company. Anything shipped later is another product of the same company.

That distinction is the whole policy, and almost every mistake below comes from
blurring it:

| | What it is | How it is written |
|---|---|---|
| **Strofi Technologies** | The company | Always both words, on first use |
| **Cruise FM** | A product | Always two words, capital C, capital FM |
| **Strofi** | A planned product — the social driving / route-sharing app | See §3, because this one is genuinely ambiguous |

### Why the company carries the second product's name

This was a deliberate trade, made on 9 August. Strofi — the driving app — is
the bigger bet, and Cruise FM is deliberately its front door. Naming the company
*Strofi Technologies* makes that literal: every Cruise FM user reads the word
*Strofi* before Strofi exists, which is free groundwork for the product with the
harder cold-start problem.

It trades **portability for concentration**. A neutral company name would have
suited any future direction; this one bets on a particular one. That is the
right trade while one product is clearly the main event — but the cost is real,
and worth naming: **if Strofi the app is ever abandoned or renamed, the company
still carries its name.**

---

## 2. Writing the name

**Correct**

- Strofi Technologies
- Strofi Technologies Ltd — *only once an entity actually exists and is
  registered under that name. Not yet true. See §6.*
- "Cruise FM is made by Strofi Technologies."
- "A Strofi Technologies app"

**Never**

- ~~STROFI TECHNOLOGIES~~ in body text — capitals are a styling choice for a
  specific place (the app's footer byline sets it in small caps), not how the
  name is spelled.
- ~~Strofi Tech~~, ~~ST~~, ~~Strofi Technologies Inc~~ — no abbreviations, and
  no legal suffix that isn't real.
- ~~strofi~~ / ~~STROFI~~ as the company. The company is two words.
- Possessive of the short form in formal copy: write "Strofi Technologies'
  privacy policy", not "Strofi's privacy policy" — the second reads as the app.

**Pronunciation and meaning.** Not recorded anywhere. If there is an intended
pronunciation or origin, write it here — it will be asked, and a coined name
with no story invites people to invent one.

---

## 3. The ambiguity that needs a rule

The company and the future app share a word. Left alone, "Strofi" means two
things, and the confusion will arrive exactly when the app launches.

**The rule:**

- In anything a **user** reads — apps, the website, the store, support replies —
  "Strofi" alone means **the app**. The company is always "Strofi Technologies",
  written out.
- In anything **legal or commercial** — terms, privacy, invoices, contracts,
  App Store agreements — the company is always "Strofi Technologies", and the
  app is named explicitly. Never "Strofi" alone.
- Never write "Strofi" to mean the company as shorthand, even internally. It is
  the habit that leaks into published copy.

This costs a few extra words and removes a whole category of confusion.

---

## 4. Where the name appears today

Every one of these is live. If the name ever changes, this is the list to work
through.

| Where | What it says | File |
|---|---|---|
| App → Profile footer | "A Strofi Technologies app" | `src/app/(tabs)/profile.tsx` |
| Privacy Policy → "Who makes Cruise FM" | Full section | `src/constants/legal.ts` |
| Terms → "Who you are agreeing with" | Full section | `src/constants/legal.ts` |
| Website footer | "Cruise FM is made by **Strofi Technologies**." | `website/index.html` |
| Website privacy / terms | Generated from the app's own copy | `scripts/gen-legal.mts` |
| App Store description | Closing line | listing (owner-managed) |

**The legal copy is generated, not duplicated.** `scripts/gen-legal.mts` writes
both `docs/legal/` and `website/` from `src/constants/legal.ts`. Edit the source
and re-run it; never hand-edit the website copies, which is how they drifted
apart before.

---

## 5. The one line that cannot carry the name

The App Store's **Developer** line reads **JESSICA ARROYO**, and it cannot be
changed by editing anything.

On an **Individual** Apple Developer account that field *is* the account
holder's legal name. It is not metadata. The app's own name on the store is
unaffected — that stays "Cruise FM".

Two routes, neither quick:

1. **Convert to an Organization account.** Requires a legally registered
   business and a free D-U-N-S number. Days to weeks; the D-U-N-S lookup alone
   can take a fortnight.
2. **Ask Apple about a trading name.** Apple has in some cases allowed an
   individual to display a registered trading name, with documentation. Worth a
   support ticket first, because it is far cheaper if granted.

**Until then the honest position is:** the store listing credits a person, and
the product credits Strofi Technologies. That is ordinary for a small studio and
confuses nobody who opens the app. Do not describe the company as the App Store
developer in any copy, because the store itself says otherwise.

---

## 6. Status — what is true, and what is not

Stated plainly, because brand documents are where wishful thinking accumulates.

| | Status |
|---|---|
| Name chosen | **Yes** — 9 August 2026 |
| Used in product, legal and web copy | **Yes** — see §4 |
| Legally registered company | **Not as far as this repo records.** Nothing here evidences an incorporation. Only the owner can confirm. |
| Trademark filed | **No** |
| Logo / visual identity | **No** — deliberately not started |
| Domain owned | **No dedicated domain.** Cruise FM lives at `cruisefm.netlify.app`; `cruisefm.app` was never registered. |
| Company bank account, VAT, trader status | **Unknown / not recorded** |

**Do not write "Ltd", "Limited", "Inc" or any suffix until an entity exists.**
Implying a registered company that does not exist is a genuine legal problem,
not a stylistic one — and the app's Terms already name Strofi Technologies as
the party you agree with, which makes it more important, not less.

**When registration matters.** It is not urgent while the app is free, but three
things all point the same way and will arrive together: charging money
(payments and business banking), EU/UK trader status obligations, and the
Organization route to the App Store Developer line in §5. Worth doing once,
before the first of them forces it.

---

## 7. Name clearance — what was checked, and the test that matters

**Nothing in software uses "Strofi".** That was the finding on 9 August, and it
is the main reason the name survived.

**The test is not "does anyone anywhere use this word".** Almost every word
fails that. The questions that matter:

1. Would anyone **confuse** us with them?
2. Are they in **music, apps or automotive**?
3. Would they be able to **block a trademark**?

An earlier pass used the strict test and rejected nearly everything, which is
how good names get thrown away.

**Rejected, with reasons — do not re-propose:**

- **Veyra** — lasted about an hour. Pretty, vowel-heavy coinages (Veyra, Vayra,
  Lumina, Nova, Aura) are the most contested naming space there is, because
  every founder reaches for them first. Another coinage in that family fails
  identically.
- **Northing** — a surveying term, chosen for portability, before leading with
  Strofi made portability the wrong goal.
- **Skywave, Longwave, Catseye, Faro, Rumbo, Sereno, Estela, Bruma, Madrugada,
  Ocaso, Glovebox, Highbeam** — all had software or App Store namesakes, several
  in transport or fintech, one publicly traded.

**Before spending anything on a logo,** run a proper trademark search in the
territories that matter (UK IPO, EUIPO, USPTO). A visual identity built on a
name that cannot be registered is money spent twice.

---

## 8. Voice

The company and the product do not sound the same, and that is intentional.

**Cruise FM has personality** — "Empty expressways. Blue-lit dashboards." It is
allowed to be evocative, because it is selling a feeling.

**Strofi Technologies is plain.** It states facts: who made the thing, who you
are agreeing with, who to contact. When the company speaks, it is usually
because something legal or factual requires it, and ornament there reads as
evasion.

One line that works, and is already in use: *"Cruise FM is made by Strofi
Technologies."* No mission statement, no "we believe". If a longer description
is ever needed, describe what the company **makes**, not what it **feels**.

---

## 9. Rules for the future

- **A new product does not need a new company.** It ships as "A Strofi
  Technologies app" and gets its own name, exactly as Cruise FM does.
- **Bundle identifiers never change.** Cruise FM stays `com.driftlore.CruiseFM`
  forever — it is the app's identity on the store, invisible to users, and
  changing it would create a different app with no reviews and no existing
  installs. The same will be true of anything shipped next. A bundle ID that
  doesn't match the company name is normal and worth nothing to fix.
- **The Expo project slug likewise stays.** Internal, immutable in practice.
- **If the company name ever changes,** §4 is the checklist, and the legal copy
  must be regenerated rather than hand-edited.

---

## 10. Open questions for the owner

Only you can answer these, and each changes what should be written above:

1. **Is there a registered entity?** If so, its exact legal name and number
   belong in §6, and the Terms should name it precisely.
2. **What does "Strofi" mean, and how is it said?** Worth recording before
   someone else decides.
3. **Trademark — worth filing?** Cheap now, and the answer decides whether a
   logo is worth commissioning.
4. **A dedicated domain?** `cruisefm.netlify.app` is the live address and is
   printed on every share card. A real domain is the single most visible
   upgrade available to the brand, and it is inexpensive.
