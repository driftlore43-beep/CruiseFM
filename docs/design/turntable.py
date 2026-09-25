"""
THE RECORD BECOMES A TURNTABLE  (ROUND 1 — SUPERSEDED, SHE DID NOT PICK).

See `turntable_one.py`. She replied to this sheet with an MD Vinyl
screenshot and named the raised control strip specifically ("instead of the
rectangle border at the bottom the buttons should just sit at the bottom"),
so the strip, the knobs, the pitch fader, the speed keys and the arm rest
are all gone in round 2. THE ONE FINDING WORTH CARRYING FORWARD is in the
note below about the arm setting the record’s size: it is true, and it is
why round 2 redrew the arm rather than reusing the app’s own.

Owner, 2026-09-26, with a photograph of the large Record tile on her phone:

  "I wanted what we can do with the turntable widget mode. Let's add back the
   tone arm and some buttons and knobs at the bottom like the normal
   turntable machine. Reduce the size of the vinyl to allow for this space.
   And can you draw up some designs, include one with the album cover instead
   of the red centre."

────────────────────────────────────────────────────────────────────────────
THIS REVERSES 24.09 KNOWINGLY, AND SHE IS THE ONE REVERSING IT. That round
DELETED the tonearm on her own instruction ("the vinyl should be larger (fill
the space) and more defined -- try to remove the tonearm stick"), and the
record grew from 108*k to 150*k precisely because the arm was no longer in
its way. The arm is being asked back as part of a DIFFERENT object: not a
record with a stick beside it, but a deck. So the record gives those points
back, and this time they buy furniture rather than nothing.

THE ARM IS THE APP'S OWN, NOT A NEW DRAWING. Its geometry is recovered from
`e92197e` and is the same three rules the app's Vinyl deck settled on 03.08:
the stylus lands at 0.80 of the record's radius (any further in is the LABEL,
which is the one place a needle never is), the rod is STRAIGHT (the deck's
arm was rebuilt three times and finished straight on her own instruction, so
a curved one here would make two objects out of one), and the counterweight
rides a SHORT stub (set further back it reads as a lollipop). `big_tiles`
already carries that drawing; it is imported rather than copied.

THE ARM IS ALSO WHAT SETS THE RECORD'S SIZE. Its bearing sits 1.10 radii out
to the right and the counterweight rides past it, so the disc's own diameter
is decided by keeping the weight on the tile: the right edge of the weight
lands at 1.284r from the centre. That is why 24.09 measured 108*k rather than
picking it.

────────────────────────────────────────────────────────────────────────────
WHAT THE CONTROLS MAY AND MAY NOT CLAIM, which is the settled rule for this
target and is the only thing here that is not taste.

  KNOBS, KEYS, THE PITCH FADER, THE STROBE DOTS AND THE ARM REST are all
  FURNITURE. They are part of the object whether or not anything is playing,
  exactly like the Pocket Player's deliberately unlabelled wheel (03.09) and
  the CD window's key cluster (25.09). Nothing in them can go stale and
  nothing reads as a control that is broken.

  NOTHING IS LIT except the power lamp, and a lamp is LIGHT rather than
  material, so it is the one part allowed to carry the station's hue -- which
  is worth having, because 24.09 records the cost of the big record: with the
  disc at 150*k the halo is squeezed into the corners and the station's
  colour arrives almost entirely through the rim. A deck gives it somewhere
  to sit again.

  THE SPEED NUMBERS (33 / 45) are printed on a real plinth whatever it is
  doing, so they are furniture too -- but they are still TEXT on a tile she
  stripped of text on 09.09 ("remove the station's text so it's just the
  vinyl"), so B and C leave the keys blank and only D prints them. That is
  hers to pick, not mine to assume.

  THE LABEL. C and D put the last-played song's cover where the red centre
  is, which is her own ask and is the same call the CD look already makes
  (`Art.songCover`). NOTE THE FALLBACK IS REAL: a station with no cover --
  companion mode, a fresh install, a custom station -- has nothing to draw
  there, so it falls back to the red label rather than a hole.

DRAWN AT 2px PER POINT through P(), so a number here can be compared with the
Swift by eye. Large tile 338x354pt = 676x708px.

RUN:
  OUT=<scratch>/tt.html python3 docs/design/turntable.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/tt.html OUT=<scratch>/tt.png node docs/design/shot4.mjs
"""
import math, os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'turntable.html')
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.tt-throwaway.html')
import big_tiles as BT                      # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

import v3                                   # noqa: E402
from assets import A                        # noqa: E402

grooves, red_label, cover_label = v3.grooves, v3.red_label, v3.cover_label
tonearm = BT.tonearm

CSS = BT.CSS + """
.slot { max-width: 676px; }
.note { max-width: 676px; }
"""

# Coastal FM, the station every other sheet in this folder is drawn on.
ACCENT = '#F0B048'


def P(pt):
    """1 point = 2 pixels: the large tile is 338x354pt, drawn 676x708."""
    return pt * 2


# ── the parts ──────────────────────────────────────────────────────────────

def halo():
    """What the record stands in today — the station's own glow, eased to
    0.70 for this tile (20.09). Not a plinth: this is the ground A, B and C
    are drawn on."""
    return (f'<div style="position:absolute;inset:0;background:'
            f'radial-gradient(circle at 50% 44%,rgba(240,176,72,.20),'
            f'rgba(24,18,10,.55) 58%,#08080a 88%);"></div>')


def plinth():
    """THE WHOLE TILE AS THE DECK. A brushed surface, lit along its top edge
    and turning out of the light at the foot — the same treatment the Pocket
    Player's case got on 09.09, and for the same reason: one flat fill reads
    as a painted panel rather than as a machined object."""
    return f"""
    <div style="position:absolute;inset:0;background:
        linear-gradient(168deg,#2b2c30,#17181b 46%,#0e0f11);"></div>
    <div style="position:absolute;inset:0;background:
        repeating-linear-gradient(97deg,rgba(255,255,255,.028) 0 1px,
          transparent 1px 4px);"></div>
    <div style="position:absolute;left:0;right:0;top:0;height:{P(7)}px;background:
        linear-gradient(180deg,rgba(255,255,255,.22),transparent);"></div>
    <div style="position:absolute;left:0;top:0;bottom:0;width:{P(9)}px;background:
        linear-gradient(90deg,rgba(255,255,255,.10),transparent);"></div>
    <div style="position:absolute;right:0;top:0;bottom:0;width:{P(11)}px;background:
        linear-gradient(270deg,rgba(0,0,0,.34),transparent);"></div>
    <div style="position:absolute;inset:0;background:
        radial-gradient(circle at 42% 40%,rgba(240,176,72,.13),transparent 62%);"></div>"""


def platter_well(cx, cy, r):
    """The record is SET INTO the deck rather than lying on it: a cut ring
    just outside the disc, dark on the lamp side and lit opposite, which is
    the inverse of the record's own rim and is what reads as a recess."""
    d = P(r * 2 + 13)
    return (f'<div style="position:absolute;left:{P(cx)}px;top:{P(cy)}px;'
            f'width:{d}px;height:{d}px;transform:translate(-50%,-50%);'
            f'border-radius:50%;background:#0a0a0c;'
            f'box-shadow:inset 0 {P(2)}px {P(4)}px rgba(0,0,0,.9),'
            f'inset 0 -{P(1.5)}px 0 rgba(255,255,255,.12),'
            f'0 {P(2)}px {P(5)}px rgba(255,255,255,.05);"></div>')


def strobe(cx, cy, r, n=52):
    """The dots machined round a real platter's edge. Furniture: they are on
    the casting whether or not it turns."""
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        out.append(f'<div style="position:absolute;left:{P(x)}px;top:{P(y)}px;'
                   f'width:{P(1.6)}px;height:{P(2.6)}px;transform:'
                   f'translate(-50%,-50%) rotate({math.degrees(a) + 90:.1f}deg);'
                   f'border-radius:1px;background:rgba(255,255,255,.30);"></div>')
    return ''.join(out)


def knob(x, y, d, *, ticks=True):
    """A machined knob: a dished cap with a pointer notch, sitting in a ring
    of tick marks. Unlit and unlabelled — see the header."""
    t = ''
    if ticks:
        for i in range(9):
            a = math.radians(-210 + i * 240 / 8)
            rx, ry = x + (d / 2 + 4.5) * math.cos(a), y + (d / 2 + 4.5) * math.sin(a)
            t += (f'<div style="position:absolute;left:{P(rx)}px;top:{P(ry)}px;'
                  f'width:{P(1.3)}px;height:{P(3.4)}px;transform:translate(-50%,-50%) '
                  f'rotate({math.degrees(a) + 90:.1f}deg);background:rgba(255,255,255,.30);'
                  f'border-radius:1px;"></div>')
    return f"""{t}
    <div style="position:absolute;left:{P(x)}px;top:{P(y)}px;width:{P(d)}px;height:{P(d)}px;
        transform:translate(-50%,-50%);border-radius:50%;
        background:radial-gradient(circle at 36% 28%,#e9ecf0,#9aa0a8 52%,#4e535a);
        box-shadow:0 {P(2)}px {P(4)}px rgba(0,0,0,.6),
          inset 0 -{P(1)}px 0 rgba(0,0,0,.45), inset 0 {P(1)}px 0 rgba(255,255,255,.55);">
      <div style="position:absolute;inset:{P(d * 0.17)}px;border-radius:50%;
          background:radial-gradient(circle at 40% 32%,#7d838b,#33373d);
          box-shadow:inset 0 {P(1)}px {P(2)}px rgba(0,0,0,.65);"></div>
      <div style="position:absolute;left:50%;top:{P(d * 0.12)}px;width:{P(2)}px;
          height:{P(d * 0.30)}px;transform:translateX(-50%);border-radius:1px;
          background:#f2f4f7;"></div>
    </div>"""


def key(x, y, w, h, txt=''):
    """A key on the plinth. `.up` is the sheet's own bevel — the same one the
    CD window's transport uses, so two looks cannot drift into two kinds of
    button."""
    t = (f'<span class=px style="font-size:{P(9)}px;color:#1b1d22;">{txt}</span>'
         if txt else '')
    return (f'<div class=up style="position:absolute;left:{P(x)}px;top:{P(y)}px;'
            f'width:{P(w)}px;height:{P(h)}px;transform:translate(-50%,-50%);'
            f'border-radius:{P(2)}px;display:flex;align-items:center;'
            f'justify-content:center;">{t}</div>')


def fader(x, y, w, h):
    """A pitch slider, parked at its centre detent — which is its REST
    position on a real deck, not a reading.

    THE CAP IS WIDER THAN THE SLOT, and that overhang is the whole thing: cut
    narrower than the slot it reads as a plug sitting in a hole rather than as
    a cap riding in one, which is what the first render drew."""
    ticks = ''.join(
        f'<div style="position:absolute;left:{P(x + w * 0.62)}px;'
        f'top:{P(y - h / 2 + h * i / 4)}px;width:{P(3.5)}px;height:{P(1)}px;'
        f'transform:translate(-50%,-50%);background:rgba(255,255,255,'
        f'{".34" if i == 2 else ".18"});"></div>' for i in range(5))
    return f"""
    <div style="position:absolute;left:{P(x)}px;top:{P(y)}px;width:{P(w)}px;height:{P(h)}px;
        transform:translate(-50%,-50%);border-radius:{P(2)}px;background:#0b0c0e;
        box-shadow:inset 0 {P(1.5)}px {P(3)}px rgba(0,0,0,.9),
          0 {P(1)}px 0 rgba(255,255,255,.10);"></div>
    {ticks}
    <div class=up style="position:absolute;left:{P(x)}px;top:{P(y)}px;width:{P(w * 1.9)}px;
        height:{P(9)}px;transform:translate(-50%,-50%);border-radius:{P(2)}px;
        display:flex;align-items:center;justify-content:center;">
      <div style="width:{P(w * 1.3)}px;height:{P(1)}px;background:rgba(0,0,0,.45);"></div>
    </div>"""


def led(x, y, d=4.5, colour=ACCENT):
    """The one lit thing on the deck, and the one part allowed a hue: a lamp
    is LIGHT, and light is what carries the station's mood on this target
    (the mirror ball's rule, 28.07)."""
    return (f'<div style="position:absolute;left:{P(x)}px;top:{P(y)}px;width:{P(d)}px;'
            f'height:{P(d)}px;transform:translate(-50%,-50%);border-radius:50%;'
            f'background:{colour};box-shadow:0 0 {P(7)}px {P(2)}px {colour}88;"></div>')


def arm_rest(x, y):
    """Where the arm sits when it is not on a record. A deck has one; without
    it the arm reads as hanging in the air."""
    return f"""
    <div style="position:absolute;left:{P(x)}px;top:{P(y)}px;width:{P(9)}px;height:{P(26)}px;
        transform:translate(-50%,-50%);border-radius:{P(3)}px;
        background:linear-gradient(180deg,#6d737b,#2e3237);
        box-shadow:0 {P(1.5)}px {P(3)}px rgba(0,0,0,.6);"></div>
    <div style="position:absolute;left:{P(x)}px;top:{P(y - 9)}px;width:{P(13)}px;height:{P(5)}px;
        transform:translate(-50%,-50%);border-radius:{P(2.5)}px;
        background:linear-gradient(180deg,#eceff3,#8c929a);"></div>"""


def record(cx, cy, r, label_html):
    d = P(r * 2)
    return (f'<div style="position:absolute;left:{P(cx)}px;top:{P(cy)}px;'
            f'width:{d}px;height:{d}px;transform:translate(-50%,-50%);">'
            f'{grooves(d, int(d * 0.29), label_html)}</div>')


def foot(h_pt, keys_txt=None):
    """B and C's control strip: a raised bar across the tile's foot, two
    knobs on the left and three keys on the right."""
    y = 354 - h_pt / 2
    txt = keys_txt or ['', '', '']
    return (f'<div style="position:absolute;left:0;right:0;bottom:0;'
            f'height:{P(h_pt)}px;background:linear-gradient(180deg,#26272b,#131417);'
            f'box-shadow:inset 0 {P(1.5)}px 0 rgba(255,255,255,.16);"></div>'
            + knob(38, y, 30) + knob(82, y, 30)
            + key(196, y, 38, 21, txt[0]) + key(245, y, 38, 21, txt[1])
            + key(294, y, 38, 21, txt[2])
            + led(122, y, 4.5))


# ── the four tiles ─────────────────────────────────────────────────────────

A_ = BT.slot('THE MODE &middot; large', 'A &mdash; build 69, what you have', f"""
  {halo()}
  {record(169, 177, 160.5, red_label())}
""", 'l', note='The record alone at 150&thinsp;&times;&thinsp;k &mdash; 321 of a 338pt tile. '
               'The arm came off on 24.09 and this is what growing into its place bought.')

# 110, not 24.09's 115.5 (108 * k): the arm's clearance is measured off the
# RECORD's own radius, so a couple of points off the disc buys the
# counterweight twenty at the corner — which is where the first render put it.
_R_B, _CX_B, _CY_B = 110, 148, 170
B_ = BT.slot('THE MODE &middot; large', 'B &mdash; the arm back, controls at the foot', f"""
  {halo()}
  {record(_CX_B, _CY_B, _R_B, red_label())}
  {tonearm(P(_CX_B), P(_CY_B), P(_R_B))}
  {foot(60)}
""", 'l', note='The record gives back the points the arm needs (321 &rarr; 231 across) and '
               'the foot takes 60. Two knobs, three blank keys, one lamp in the station&rsquo;s '
               'colour. Ground unchanged &mdash; still the halo, not a plinth.')

C_ = BT.slot('THE MODE &middot; large', 'C &mdash; B, with the album cover on the label', f"""
  {halo()}
  {record(_CX_B, _CY_B, _R_B, cover_label())}
  {tonearm(P(_CX_B), P(_CY_B), P(_R_B))}
  {foot(60)}
""", 'l', note='Identical to B but for the centre. The cover falls back to the red label when '
               'there is no cover to draw &mdash; companion mode, a fresh install, a custom '
               'station &mdash; so it is never a hole.')

_R_D = 106
D_ = BT.slot('THE MODE &middot; large', 'D &mdash; the whole tile is the deck', f"""
  {plinth()}
  {platter_well(140, 150, _R_D)}
  {strobe(140, 150, _R_D + 9)}
  {record(140, 150, _R_D, cover_label())}
  {arm_rest(306, 134)}
  {tonearm(P(140), P(150), P(_R_D))}
  <div style="position:absolute;left:0;right:0;bottom:{P(72)}px;height:{P(1)}px;
      background:rgba(255,255,255,.10);"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:{P(72)}px;background:
      linear-gradient(180deg,rgba(255,255,255,.05),transparent 46%);"></div>
  {knob(38, 318, 32)}
  {key(94, 304, 34, 20, '33')}
  {key(94, 332, 34, 20, '45')}
  {led(140, 318, 5)}
  {fader(290, 318, 13, 46)}
""", 'l', note='Platter set into a brushed plinth with a strobe-dotted rim, the arm on its own '
               'rest, speed keys and a pitch fader at the front. The only lit thing is the '
               'power lamp &mdash; light is the one part allowed to carry the station&rsquo;s '
               'colour, which the big record had nearly lost.')

html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The Record becomes a turntable',
                  'Owner, 26.09: "add back the tone arm and some buttons and knobs at the '
                  'bottom like the normal turntable machine. Reduce the size of the vinyl to '
                  'allow for this space... include one with the album cover instead of the red '
                  'centre." <br>'
                  'The arm is the app&rsquo;s own drawing, recovered rather than redrawn, and it '
                  'is what sets the record&rsquo;s size: its bearing sits 1.10 radii out to the '
                  'right and the counterweight rides past that, so the disc has to come down to '
                  '231 across to keep the weight on the tile. Every knob, key, dot and fader is '
                  'FURNITURE &mdash; part of the object whether or not anything is playing, so '
                  'nothing can go stale and nothing reads as a broken control. The one lit part '
                  'is the power lamp, because a lamp is light, and light is what carries the '
                  'station&rsquo;s colour on this target.')
        + f'<div class=row>{A_}{B_}{C_}{D_}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
