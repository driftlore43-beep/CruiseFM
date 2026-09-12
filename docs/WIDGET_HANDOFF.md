# Widget designs H and I — the exact task, ready to execute

**Written 2026-09-08 at commit `0572efa`, branch `claude/cruise-fm-v4wk5f`.**
**CORRECTED 2026-09-12: that branch was merged into `main`, which is now the
branch everything happens on.**

This is the one piece of work that was **mid-flight** when the previous agent
handed over. `docs/TODO.md` §0 describes it; this file is the executable
version — exact files, exact line numbers, exact current values, and how to see
the result.

**Read `.cursor/rules/cruise-fm.mdc` first** (it is applied automatically) and
`docs/CLAUDE_HANDOVER.md` for the project as a whole.

---

## 0. What stage this is at

**Mockup only. Nothing from this round exists in Swift.**

The ten widget designs live in two places:

| | |
|---|---|
| `docs/design/v3.py` (575 lines) | The **mockup** — HTML, rendered to a gallery sheet the owner reviews visually |
| `targets/widgets/*.swift` | The **real widget extension** — what actually ships |

The mockup is how the owner approves a design before anyone writes Swift, because
**Swift cannot be compiled in this environment** and a mistake in the extension is
invisible until a build burns a review cycle.

**The mockup is a proposal until the Swift exists, and a lie about the Swift
afterwards unless it is kept in step.** That has cost a round of confusion twice —
once when a card showed "Cassette mode" that the Swift never printed, and again on
the Stub. When you finish a design here, **port it**, then keep the two together.

---

## 1. The render loop

Everything runs **from the repo root** (`assets.py` resolves the real fonts and
station photographs relative to it — running from `docs/design/` fails with
`missing .../docs/design/assets/fonts/DSEG7Classic-Bold.ttf`; set `CRUISE_ROOT`
if you must run it elsewhere).

```bash
# 1. build the sheet
OUT=/tmp/widgets.html python3 docs/design/v3.py

# 2. screenshot it
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
  IN=/tmp/widgets.html OUT=/tmp/gallery.png node docs/design/shot4.mjs
```

Then **look at the picture**. The owner reviews this work visually and so should
you — three of the last six changes were only caught by zooming into the render
(a barcode overlapping an artist's name; a sleeve opening that drew perfectly and
showed nothing because the record covered it; a "0 AM" where a label sat half
under a sleeve).

`PLAYWRIGHT_MODULE` may differ on your machine — it is an absolute path to
`playwright/index.mjs`. Drop the variable if Playwright resolves normally.

The sheet is 316×316 for a small widget (`.s`) and 676×316 for a medium (`.m`),
corner radius 44 — see `MW, MH, S` and `RAD` at `docs/design/v3.py:6-7`.

---

## 2. H — the Mirror Ball (small)

### What the owner asked for, verbatim

> "H — Remove the text beneath the mirror ball. Smooth out the edges, and make it
> reflective and realistic. Like how we made the mirror ball in the app."

This follows an earlier note on the same widget — *"make this one reflect off
pretty pink, blue and purple colours, as if it's a party happening"* — which is
**already done and must be kept**. The party lamps stay; what changes is the
material and the silhouette.

### Where it lives

| What | File | Line |
|---|---|---|
| The widget slot | `docs/design/v3.py` | `BALL` at **509** |
| The room's beams | `docs/design/v3.py` | `_BALL_BEAMS` at **506** |
| The ball itself | `docs/design/ball.py` | whole file, 111 lines |
| **The reference** | `src/components/MirrorBallFlipbook.tsx` | the app's real ball |

### What the render shows today

Rendered and looked at on 08.09, so this is the *observed* state rather than a
reading of the code:

- **The silhouette is visibly polygonal** — the outer edge is a chain of flat
  tile edges, plainest on the left and right limbs.
- **Almost every mirror is mid-grey.** There is very little dark-beside-bright,
  which is the uniform scatter (§2.3) showing itself. It reads as speckled paint.
- **The tiles are chunky** — 17 × 30 across 228 px.
- **The colour lands in three broad blobs** — purple across the top, pink at the
  lower left, blue at the right — rather than as individual mirrors catching a
  lamp. That is the single-lobe problem: brightness and colour share one `d ** 9`
  term, so wherever a lamp is bright it is also fully tinted, in a patch.
- The bottom pole shows a small rosette of slivers where the columns converge.

### 2.1 Remove the caption

`docs/design/v3.py:519-521` — the block ending `<span ...>Garage</span>`. Delete
it outright. Nothing replaces it: the ball is the whole widget.

### 2.2 Smooth the silhouette

The ball is drawn as ~300 polygons (`mirror_ball()` in `ball.py`), so its outer
edge is a **polygon chain, not a circle** — visibly faceted at 228 px.

`ball_svg()` (`ball.py:100-111`) already draws a body circle underneath and a
hairline circle on top, but the tiles themselves overhang. The fix is a
`<clipPath>` circle in the `<defs>` block and a `clip-path` on the tile group, so
the edge is perfectly round **whatever the tiling does**:

```python
f'<defs>...<clipPath id="ballclip">'
f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}"/></clipPath></defs>'
...
f'<g clip-path="url(#ballclip)">' + mirror_ball(size, **kw) + '</g>'
```

Note `ball_svg` currently sets `style="...overflow:visible;"` — that is what lets
the tiles spill past the viewBox in the first place. A clip is the honest fix;
switching to `overflow:hidden` would clip at the **square** viewBox, not the
circle.

### 2.3 Match the app's shading model

This is the substance of "reflective and realistic". `ball.py` was written as a
simplified port and has drifted from `MirrorBallFlipbook.tsx` in four ways. **The
app's version is the reference** — it went through 23 rounds with the owner.

| | `ball.py` today | `MirrorBallFlipbook.tsx` |
|---|---|---|
| Grid | `rows=17, cols=30` (line **32**) | `ROWS = 23` (116), `COLS = 44` (117) |
| Scatter | `rnd.uniform(-0.13, 0.13)` — **uniform** (line **73**) | **end-weighted** (line **220**) |
| Lamp lobes | one lobe, `d ** 9` (line **70**) | **two**, kept apart (lines 202-208) |
| Bevel | `shrink=0.91` toward the centre (line **62**) | `BEVEL = { u0: .08, u1: .92, v0: .07, v1: .93 }` (136) |

**The end-weighted scatter is the important one.** The app pushes each mirror's
brightness toward the *ends* of its range:

```js
// MirrorBallFlipbook.tsx:220
const spread = Math.sign(env - 0.5) * Math.pow(Math.abs(env - 0.5) * 2, 0.68) * 0.5;
```

A uniform scatter clusters mirrors around the mean, which reads as speckled grey
paint. **A genuinely dark mirror beside a genuinely bright one is the cue that
sells chrome** — that sentence is in the app's own comments and it is the whole
reason this constant exists.

**Two lobes per lamp, and keeping them apart matters.** The app runs a *wide*
lobe (`dot ** 10`) for brightness and a *narrow* one (`dot ** 28`) for colour:

```js
const wide   = Math.pow(dot, 10) * L.power;   // how bright
const narrow = Math.pow(dot, 28) * L.power;   // what colour
```

`ball.py` uses a single `d ** 9` for both, which is why widening it to brighten
the ball also tints half the surface. **A ball that is broadly blue is a coloured
sphere, not a mirrored one.**

### 2.4 The one knob that does NOT work

> **Do not raise the ambient floor** (`b = 0.20` at `ball.py:66`).

This was tried on the app's ball and measured: the median brightness moved, and
the share of pixels above 200 fell **4.1% → 0.6%**. The dark mirrors went with it
and the ball flattened into a uniform grey sphere. **Widening the bright lobe is
the knob that works** — more mirrors catching a lamp brightens the ball *and*
widens the gap between a lit mirror and its neighbour at the same time. The full
reasoning is in `MirrorBallFlipbook.tsx:182-199`; read it before touching
brightness.

### 2.5 What must not change

- **The party lamps stay.** `LAMP_COLORS` (`ball.py:30`) is pink / blue / purple,
  one per lamp, so a mirror is tinted by **which lamp is catching it** rather than
  painted a single colour overall. That is an explicit owner decision.
- **The material carries no hue; mood arrives as light.** The mirror ball is
  neutral chrome lit by coloured lamps — never chrome that is itself coloured.
  This is rule 23 in `.cursor/rules/cruise-fm.mdc` and it has been relearnt on
  this component more than once.
- **The room's beams** (`_BALL_BEAMS`, `v3.py:506`) are already recoloured to
  match the lamps, so the ball reads as lit *by* the room. Keep them in step if
  the lamp colours ever move.

---

## 3. I — the CD (small)

### What the owner asked for, verbatim

> "I — make sure the CD has this rainbow effect on the disc. (The photo I
> uploaded) Make the station image less opaque also. I would suggest the shape of
> the widget should be the CD case, so rather than having a square inside the
> round square widget — the widget holds the CD."

### The reference photo is not in the repo

She attached a photograph of a real CD. **It is not committed** and you cannot see
it. What it shows, so you can work from the description:

- Diffraction that **radiates outward from the hub as angular streaks**, not as
  flat concentric bands and not as an even conic wash. The colour sweeps round the
  disc *and* changes with radius, so the streaks fan.
- A **silver base** underneath. The rainbow sits on metal, so there is grey
  showing between the colours — it is not a saturated rainbow disc.
- A **clear plastic hub ring** with a darker ring around it, and the small centre
  hole.
- A strong **white specular sweep** across one side, which is most of what makes
  it read as a physical shiny object rather than a printed circle.

If in doubt, **ask the owner to re-send it** rather than guessing — she reviews
this visually and one render either way is cheap.

### Where it lives

`docs/design/v3.py`, `CD` at line **525**, running to **571**. Current structure,
in draw order:

| Lines | What |
|---|---|
| 526 | dark backdrop |
| 530-547 | **the case** — inset rectangle at `left/top/right/bottom: 14px`, hinge spine, three hinge lugs, four corner posts, one diagonal plastic sheen |
| 552-570 | **the disc** — 250 px, `left:53% top:50%`, station photo at `saturate(1.15) brightness(.72)`, two conic gradients (one `overlay` at .95 from 20deg, one `screen` at .5 from 200deg), a fine radial ring texture, a diagonal specular, then label rings at `inset:86px` and `inset:107px` |

### What the render shows today

- **The case is drawn inside the widget** with a visible dark margin around it
  and its own near-square corners sitting inside the widget's 44 px radius —
  precisely the "square inside the round square" she named.
- **The rainbow is not reading as a rainbow.** The two conic gradients over a
  darkened photograph have flattened into a milky mint-and-lilac wash. There is
  no silver, no angular streaking, and no sense of a metal surface underneath.
- **The station photograph is very present** in the lower half of the disc —
  the coast road is fully legible. That is the "less opaque" note.
- **The hub is a plain grey ring with a black hole.** There is no clear plastic
  ring and no dark ring around it, which is a good part of why the disc reads as
  a printed circle rather than an object.
- The specular sweep is not reading at all at this size.

### 3.1 The widget becomes the case

Today a case is drawn **inside** the widget with a 14 px margin all round, so the
picture reads as *a square object photographed inside a rounded square*. She wants
the widget itself to be the case.

So: drop the `14px` inset and let the hinge spine, corner posts and plastic sheen
run to the **widget's own edges** (the `.s` box, 316×316, radius 44). The case's
own `border-radius:4px` goes — the widget's 44 px corner becomes the case's
corner. The disc then sits inside that, and the backdrop at line 526 has nothing
left to show, so it can go or become the case's own interior.

**Watch the corner posts.** At `top/left: 7px` inside a 4 px-radius rectangle they
sit in a square corner; against a 44 px radius they will float in mid-air unless
they move inward and follow the curve. This is the kind of thing the render shows
in one look and the CSS does not.

### 3.2 The rainbow

Two flat conic gradients cannot produce what the photo shows — a conic band is the
same colour at every radius, so it reads as a pinwheel. What is wanted is angular
streaks that **fan out and change with radius**. Approaches worth trying, cheapest
first:

- a **`repeating-conic-gradient`** at fine angular pitch for the streaks, masked
  with a `radial-gradient` mask so it fades toward the hub and toward the rim
  (the data area of a real CD is an annulus, not the whole face)
- **two or three layers at different pitches and offsets**, so no single period is
  legible — the same trick the app's own CD mode uses, where 50 overlapping
  low-opacity wedges avoid reading as spokes
- a **silver base** under all of it, so the rainbow modulates metal rather than
  replacing it

**Do not draw the rainbow as hard-edged wedges.** Rule 22: light is gradient
falloff, never a stroked or hard-edged shape. This exact mistake was made on the
app's own CD fan and on the vinyl's sheen, and both were reported as artefacts.

### 3.3 The station image, less opaque

`v3.py:555` — `filter:saturate(1.15) brightness(.72)`. She wants the photo to sit
further back. Lower the brightness, or add an `opacity` to the `<img>`, or both.
Then re-check the rainbow reads against it — the reason the photo was *darkened*
in the last round was so the colour would show, so these two pull against each
other and the render is the arbiter.

---

## 4. When both are approved

1. **Port every approved change into the Swift.** Both live in
   **`targets/widgets/ModeWidget.swift`** (423 lines):

   | | Line |
   |---|---|
   | `ModeView.ball(_:)` — the ball's whole widget, beams and all | 128 |
   | `ModeView.disc(_:)` — the CD's whole widget | 149 |
   | `BeamField` — the room's light beams | 163 |
   | `MirrorBall` — the sphere projection and its shading | 202 |
   | `JewelCase` — hinge spine and corner posts | 292 |
   | `CompactDisc` — the disc face and its diffraction | 354 |

   Nothing from this round is there yet. Note the Swift `MirrorBall` is a
   *third* implementation of the same idea (after the app's and `ball.py`'s) —
   when you change the shading model, change all three or say plainly which one
   is now the reference.
2. **Run the three widget suites** — they are the compiler this environment does
   not have:
   ```bash
   node scripts/test-widget-bundle.mjs      # every declared widget is registered;
                                            # kinds match; nothing declared twice
   node scripts/test-widget-contract.mjs    # the TS snapshot and Snapshot.swift agree
   node scripts/test-widget-fonts.mjs       # Swift asks for names the ttf actually has
   ```
3. **Then the full sweep**, before anything is pushed:
   ```bash
   npx tsc --noEmit
   for f in scripts/test-*.mjs; do node "$f" || echo "FAILED $f"; done   # 31 suites
   node scripts/preflight.mjs
   ```
   `scripts/test-contrast.mjs` needs Playwright **and** a running web build
   (`npx expo start --web`); its offline failure is a missing dependency, not a
   regression.

### Three widget rules that will bite

- **Any new field on the snapshot must be OPTIONAL in `targets/widgets/Snapshot.swift`.**
  Swift's decoder is all-or-nothing — one missing property blanks **every** widget
  at once, with nothing logged anywhere.
- **Widget `kind` strings are permanent.** Changing one makes a widget already on
  someone's Home Screen vanish. Build 39 has already placed the Deck.
- **Prefer the version with fewer ways to be wrong.** Swift cannot be built here.
  A `.blendMode(.overlay)` was dropped from the sleeve for exactly this reason —
  it looked right in the mockup, it was composited inside a `.clipped()` stack,
  and a plain low-opacity ring looks the same and cannot surprise anyone.

---

## 5. Nothing here reaches a phone without a build

**Widgets are native. None of this ships over the air.**

Build 39 (cut 2 September, on the owner's phone) carries the widgets as they
stood at `498c2ef`. **`ModeWidget.swift` landed on 3 September in `33cda4f`, so
the Mirror Ball and CD widgets have never existed on any phone** — nor have the
Deck's Look setting (`DeckLook.swift`) or the Last Played row
(`LastPlayedWidget.swift`). Anything you see on a device today predates all of
it.

The remaining blockers are in `docs/TODO.md` §1 and are the owner's, not code's:

- verify the App Group `group.com.driftlore.CruiseFM` on Apple's site
- cut a build — **budget a failed build or two**, because the widget extension is
  a second app ID that does not exist until a build tries to create it
- install it, open it, check the widgets
- **only then** move `runtimeVersion` to 1.4.0, in the same commit

So the design work here is worth doing well and is **not** what is holding the
release. The release is waiting on a build.
