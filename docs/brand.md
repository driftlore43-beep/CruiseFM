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

### Where the name comes from (owner, 12 August 2026)

**Strofi** is from the Greek **στροφή** — *strofí* — which in English became
**strophe**.

It means **a turn, or a bend.** In literature a *strophe* is a structural
section of a poem — and, in its older sense, a turn at a familiar landmark.

That is an unusually good fit, and it is worth using rather than leaving in a
file:

- **A bend in the road** is the most literal thing a driving product could be
  named after.
- **A section of a poem** is what both products actually deal in — Cruise FM
  divides listening into moods rather than genres; Strofi divides a journey into
  a route worth repeating.
- **A turn at a familiar landmark** is navigation described the way people
  actually give directions.

Say it **STRO-fee**. Write the Greek form only where there is room to explain
it; never as the name itself.

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
| Name chosen | **Yes** — 9 August 2026. Meaning and pronunciation recorded 12.08, see §2. |
| Used in product, legal and web copy | **Yes** — see §4 |
| Legally registered company | **Not as far as this repo records.** Nothing here evidences an incorporation. Only the owner can confirm. |
| Trademark filed | **No** — owner agreed to start on 12.08. See §7. |
| Logo / visual identity | **No** — deliberately not started |
| Domain owned | **No dedicated domain.** Cruise FM lives at `cruisefm.netlify.app`. Owner agreed to change this on 12.08 — see §9a. |
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

### Where to actually look (owner asked, 12.08)

There is no single register. These are the authoritative ones, all free:

| What | Where |
|---|---|
| **UK trade marks** | `gov.uk/search-for-trademark` |
| **UK companies** | `find-and-update.company-information.service.gov.uk` |
| **EU trade marks** | `euipo.europa.eu` → eSearch plus |
| **US trade marks** | `tmsearch.uspto.gov` |
| **Many registers at once** | `tmdn.org/tmview` — **TMview. Start here.** |
| **Also many at once** | `branddb.wipo.int` — WIPO's Global Brand Database |
| **Greek trade marks** | `obi.gr` — the Hellenic Industrial Property Organisation |

**TMview replaced WIPO's database at the top of that list on 12.08**, because it
is the one search that answers the question we actually have. It carries every
EU national office — Greece's OBI included — plus the EUIPO and the UK, in a
single query. Running it once is worth more than running EUIPO, the UK IPO and
Greece separately, and it removes the "I couldn't find the Greek search"
problem entirely.

**Greece is genuinely hard to find, and it is not the owner's fault.** Greek
trade marks used to be handled by the Ministry of Development's General
Secretariat of Commerce (the *Hellenic Sign Register*, «Σήματα»), and moved to
OBI — which for years handled only patents and designs. Half the guidance
online still points at the old place. Search Greece through TMview and the
question does not arise.

### The searches run on 12.08, and what they actually showed

The owner ran three. Recorded here with what each one proves, because the two
that came back empty prove less than they appear to.

| Search | Result | What it means |
|---|---|---|
| EUIPO eSearch plus, `Strofi Technologies` | 0 in all four tabs | **Too narrow to rely on.** Nobody registers a two-word company name; the risk is someone owning *Strofi* on its own. Re-run with `Strofi`. |
| UK IPO, by word | no marks found | Same caveat, unless the word searched was `Strofi` alone. |
| A multi-register search, `Strofi` | 6 hits | **This is the useful one.** See below. |

The six hits, and the pattern in them:

- **STROFI**, **STROFI .**, **STROFI MULTIUSO**, and one figurative mark — all
  Italian national registrations, all in **Classes 21, 24 and 27**, owned by
  ARIX S.p.A. and La Commissionaria Veneta. Those classes are household
  utensils, textiles and floor coverings: these are **cleaning-cloth brands**.
  The name is close to descriptive in Italian (*strofinaccio* — a cleaning
  cloth), which is why it exists there several times over.
- **STROFI SOUVLAKI** and **STROFI OF MILOS** — Canadian, **Class 43**,
  restaurants. The same finding as the Athens taverna, in a different country.

**Nothing in Class 9, Class 42 or Class 41, anywhere, in any of the three
searches.** That is the answer to the only question that mattered. The classes
Cruise FM and Strofi need are, on this evidence, clear.

Two honest caveats, neither of them alarming:

1. An Italian **national** registration can still be raised in opposition to an
   EU-wide mark, since an EUTM has to be free across the whole Union. In
   practice, cleaning cloths against a music and driving app is about as far
   apart as two businesses get, so this is a theoretical risk rather than a
   real one.
2. A clear search is not a guarantee. Applications published after the search,
   and unregistered rights built up by trading, do not show up. This is the
   normal position for every filing anyone makes.

### The Greek restaurant, and the song

Both were found by the owner, and **neither is likely to be a blocker.** This is
the single most misunderstood thing about trade marks, so it is worth stating
properly:

**A trade mark is registered per CLASS and per TERRITORY, not over a word.** The
same word can be registered by different people for different kinds of goods.
There are 45 classes; the ones that matter here are:

- **Class 9** — downloadable software and mobile apps *(the main one)*
- **Class 42** — software as a service, software design and development
- **Class 41** — entertainment services *(possibly, for the visual side)*
- **Class 43** — *services for providing food and drink* ← **a restaurant**

A taverna in Athens registered in Class 43 does not stop a UK or EU software
mark in Classes 9 and 42. Different class, different territory, and no realistic
prospect of a consumer confusing a restaurant with a driving app.

**A song is not a trade mark at all.** Song titles are not registrable as marks
in the ordinary case, and a recording is protected by copyright, which is a
different right entirely. It has no bearing on this.

**What WOULD be a problem**, and what the search is actually for: an existing
mark in **Class 9 or 42**, in the **UK or EU**, for something a person might
confuse with this — another app, a music service, a navigation product. That is
the search to run, and it is narrower and more answerable than "is anyone called
Strofi".

### Filing — what it involves

Owner is happy to proceed (12.08). Order of operations:

1. **Search first**, in the classes and territories above. Filing into a
   conflict wastes the fee — it is not refunded.
2. **Decide the territory.** The UK is home and the obvious first filing. The EU
   is a single filing covering all member states and costs more. The US only
   matters once there are US users worth defending.
3. **Decide the classes.** Realistically **9 and 42**. Adding classes you do not
   trade in is a common and expensive mistake.
4. **File.** Online, directly with the IPO — no attorney is required for a
   straightforward word mark, and this is a word mark with no logo, which is the
   simplest case there is.

**UK fees, from 1 April 2026:** **£205** for the first class, **£60** for each
additional class. That was the first increase since 1998, so figures quoted in
older guidance will be wrong — confirm on the IPO's own page before paying.
Classes 9 and 42 together: **£265**.

**EU fees (EUTM, filed online):** **€850** for the first class, **€50** for the
second, **€150** for each class from the third. Classes 9 and 42 together:
**€900**. One filing covers all member states, which is why it is worth roughly
three times the UK — it is not three times the paperwork.

**The EUIPO SME Fund is worth a look and is NOT a plan to rely on.** It
reimburses up to 75% of trade mark application fees, but two conditions bite:
it is for **EU-established** SMEs, so a UK-only business does not qualify at
all; and the 2026 trade-mark voucher has already been reported as **exhausted**
for new applications. Check its current state before budgeting around it, and
never delay a filing waiting for it.

**Register the WORD, not a logo.** A word mark protects the name however it is
set, which is broader than a logo mark and cannot be outdated by a redesign.
This is also why the logo can wait: the valuable registration does not need one.

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

## 9a. The domain

`cruisefm.netlify.app` is **printed on every share card that leaves the app.**
It is the one piece of the brand that reaches strangers, and it currently
advertises the hosting company.

A domain is the cheapest, most visible upgrade available — around £10–35 a year
depending on the ending.

**What is already taken** (checked 12.08 by DNS; a domain that resolves is
definitely registered, but one that does not resolve is *not* proof it is free —
confirm at a registrar before planning around it):

| Domain | Status |
|---|---|
| `strofi.com` | **Taken** — resolves |
| `cruisefm.com` | **Taken** — resolves |
| `cruisefm.co.uk` | **Taken** — resolves |
| `strofi.app`, `strofi.tech`, `strofi.co.uk` | No DNS — possibly free |
| `strofitechnologies.com` | No DNS — possibly free |
| `cruisefm.app`, `cruise.fm` | No DNS — possibly free |

**Two domains are wanted, and they do different jobs:**

1. **One for Cruise FM**, because that is what goes on the share cards.
   `cruisefm.app` is the natural fit and appears to be free — and `.app` is
   worth knowing about: it is on the HSTS preload list, so it is **https-only by
   design**, which is a small mark of seriousness. `cruise.fm` is the prettiest
   option by some distance, but `.fm` domains are priced as a novelty
   (typically £70–150 a year) — worth it only if the name is staying for good.
2. **One for the company** — `strofi.tech` or `strofitechnologies.com`. It needs
   to hold a one-page site saying what the company is and how to contact it,
   which is also useful when applying for anything.

**Whichever is chosen, the address is printed in the app**
(`INSTALL_HOST` in `ShareCardStyles.tsx` and `INSTALL_URL` in `ShareCard.tsx` —
they must move together), so switching is a code change plus a Netlify domain
setting, not just a purchase.

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

## 10. Decided, and still open

**Answered 12 August 2026**

1. **Meaning and pronunciation** — recorded in §2. στροφή / strophe: a turn, a
   bend, a section of a poem.
2. **Trademark** — going ahead. §7 has the registers, the classes and the fees.
3. **Domain** — going ahead. §9a has what is taken and what to weigh.

**Still open — only the owner can answer**

1. **Is there a registered entity?** If so, its exact legal name and company
   number belong in §6, and the Terms should name it precisely. If not, §6 says
   when it starts to matter.
2. **Which domains?** The choice in §9a between `cruisefm.app` (practical) and
   `cruise.fm` (memorable, several times the price).
3. **A logo — when?** Not before the trademark search comes back clean. A word
   mark is the valuable registration and needs no logo, so there is no rush.
