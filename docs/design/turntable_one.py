"""
ONE TILE: A SLIM ARM AND THREE SILVER KEYS AT THE FOOT.

Owner, 2026-09-26, with a screenshot of MD Vinyl's widgets:

  "I like how simple Md vinyl has their widgets. I'm not saying to copy but to
   create a better tonearm design. Instead of the rectangle border at the
   bottom the buttons should just sit at the bottom - these buttons can be pill
   shaped and make them look 3d and do them silver. The reference has it as 2
   widgets but if there was a way to fit them in one widget without squashing
   the vinyl that would be great. I'd suggest no text, keep only the playback,
   forward play/pause buttons. Draw up some ideas"

────────────────────────────────────────────────────────────────────────────
THIS SUPERSEDES `turntable.py` (round 1), WHICH SHE DID NOT PICK FROM. That
sheet answered "knobs and buttons like a real turntable" with a raised control
strip across the foot, two knobs, a pitch fader and speed keys. Her reply
names the strip specifically -- "instead of the rectangle border at the
bottom" -- so the strip is gone and with it the knobs, the fader, the 33/45
keys and the arm rest. THREE KEYS, ON THE GROUND THE RECORD ALREADY STANDS ON.

THE ARM IS WHY THE RECORD HAS TO SHRINK AT ALL, SO THE ARM IS WHAT WAS FIXED.
Round 1 imported the app's own arm unchanged, and its counterweight rides a
SHORT STUB out past the bearing: bearing at 1.10 radii, weight beyond that,
far edge at 1.284r. So the disc had to come down to 220 across -- a third
smaller than build 69's 321 -- which is exactly the squashing she is asking to
avoid. THE WEIGHT IS FOLDED INTO THE PIVOT HOUSING here instead of hanging off
a stub, which is how a slim modern arm is actually built and is what the
reference shows: bearing at 1.045r, far edge at 1.169r. That one change is
worth 64 points of record.

  build 69, no arm            321 across
  round 1, the app's arm      220 across   (-31%)
  this sheet, the slim arm    284 across   (-12%)

COUNTED, NOT EYEBALLED, AND THE FIRST RENDER WAS WRONG. Across: r + 1.169r =
2.169r, plus 15 of margin each side = 338. Down: 1.023r above the centre (the
weight sits above the disc) + r below, from 16 of top air to the record's foot
at 303, which leaves 14 of air, a 21pt key and 16 of bottom margin.

THE TOP-RIGHT CORNER IS WHAT ACTUALLY BINDS, AND IT WAS MISSED FIRST TIME. A
widget clips to a rounded rectangle of about 22pt, so the weight is not merely
inside the tile's box -- it has to clear the curve. The first pass put the
pivot at 1.06r and -0.86r with a longer barrel, which measures 1.140r above
the centre and lands the weight's far corner INSIDE that curve: the render
shows it sliced. Bringing the pivot down to -0.80r and shortening the barrel
puts the corner at (323, 16), which is 85 against the corner circle's 484.
RULE: on this tile a part near a corner is checked against the CURVE, not
against the edges.

THE KEYS ARE FURNITURE, WHICH IS THE ONE THING HERE THAT IS NOT TASTE. They
are part of the object whether or not anything is playing -- the same rule as
the Pocket Player's deliberately unlabelled wheel (03.09) and the CD window's
key cluster (25.09), which she approved the day before yesterday. Nothing in
them can go stale and nothing reads as a control that is broken. The middle
key is engraved with a triangle AND two bars together, because that is the
printed label on a real combined key; drawn as one or the other it would be
claiming a state the tile does not know.

EVERY GLYPH IS A SHAPE, NEVER A CHARACTER. A codepoint the system font happens
not to cover ships as a hollow box with nothing logged anywhere -- build 39's
station icons.

NO TEXT ANYWHERE, as asked. Nothing on the label but the pressing or the
cover, nothing under the record, no dial, no station name.

DRAWN AT 2px PER POINT through P(), so a number here can be compared with the
Swift by eye. Large tile 338x354pt = 676x708px.

RUN:
  OUT=<scratch>/tt1.html python3 docs/design/turntable_one.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/tt1.html OUT=<scratch>/tt1.png node docs/design/shot4.mjs
"""
import math, os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'turntable_one.html')
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.tt1-throwaway.html')
import big_tiles as BT                      # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

import v3                                   # noqa: E402

grooves, red_label, cover_label = v3.grooves, v3.red_label, v3.cover_label

CSS = BT.CSS + """
.slot { max-width: 676px; }
.note { max-width: 676px; }
"""

# Coastal FM, the station every other sheet in this folder is drawn on.
ACCENT = '#F0B048'


def P(pt):
    """1 point = 2 pixels: the large tile is 338x354pt, drawn 676x708."""
    return pt * 2


# ── the ground ─────────────────────────────────────────────────────────────

def halo():
    """What the record stands on today -- the station's own glow, eased to
    0.70 for this tile (20.09). Not a plinth, and deliberately not a panel:
    the keys sit straight on it."""
    return ('<div style="position:absolute;inset:0;background:'
            'radial-gradient(circle at 50% 42%,rgba(240,176,72,.20),'
            'rgba(24,18,10,.55) 58%,#08080a 88%);"></div>')


def surface():
    """The reference's own move: the whole tile is a painted deck in the
    station's colour rather than a glow in it.

    IT IS A DEEPENED ACCENT, NEVER THE ACCENT ITSELF. A saturated fill behind
    a black record leaves the disc nothing to stand against, which is the
    measurement the record's own halo round settled on 20.09; this is the hue
    at a fifth of its brightness, with the light falling off toward the foot
    so the keys have somewhere dark to sit."""
    return """
    <div style="position:absolute;inset:0;background:
        linear-gradient(166deg,#3a2c17,#241a0c 48%,#120e08);"></div>
    <div style="position:absolute;inset:0;background:
        radial-gradient(circle at 46% 38%,rgba(240,176,72,.20),transparent 64%);"></div>
    <div style="position:absolute;inset:0;background:
        repeating-linear-gradient(97deg,rgba(255,255,255,.022) 0 1px,
          transparent 1px 5px);"></div>"""


# ── the arm ────────────────────────────────────────────────────────────────

def arm_slim(cx, cy, r):
    """A slim straight arm whose counterweight is part of the PIVOT rather
    than a lump on a stub behind it.

    THREE NUMBERS ARE STILL THE APP'S OWN (03.08) AND DO NOT MOVE: the stylus
    lands at 0.80 of the radius, because any further in is the LABEL and that
    is the one place a needle never is; the rod is STRAIGHT, because the app's
    own deck arm was rebuilt three times and finished straight on her
    instruction, so a curved one here would make two objects out of one; and
    the arm comes down onto the outer grooves at about 3 o'clock.

    WHAT CHANGED IS THE BACK END. The app's arm hangs its weight off a stub
    past the bearing (far edge 1.284r); here the housing IS the weight -- a
    short barrel behind the pivot, which is how a slim arm is really built and
    is what makes the record 41 points bigger.

    THE TRIG IS SOLVED IN THE COMMENT RATHER THAN CALLED AT DRAW TIME, so
    every constant can be checked against the arithmetic instead of trusted:
    with the pivot at (1.045r, -0.80r) and the stylus at 0.80r five degrees
    below the horizontal, dx = -0.248044r and dy = +0.730275r, so the rod is
    0.771251r long at 108.760 degrees. y grows downward here exactly as it
    does in SwiftUI, so the signs carry straight across.
    """
    px_, py_ = cx + r * 1.045, cy - r * 0.80
    sa = math.radians(-5)
    sx, sy = cx + r * 0.80 * math.cos(sa), cy + r * 0.80 * math.sin(sa)
    dx, dy = sx - px_, sy - py_
    length = math.hypot(dx, dy)
    ang = math.degrees(math.atan2(dy, dx))
    back = math.radians(ang + 180)

    rod_w = r * 0.030
    barrel_l, barrel_w = r * 0.24, r * 0.115      # the weight, behind the pivot
    bx = px_ + (barrel_l * 0.40) * math.cos(back)
    by = py_ + (barrel_l * 0.40) * math.sin(back)
    hub = r * 0.185
    head_l, head_w = r * 0.22, r * 0.095
    return f"""
    <!-- the rod, drawn as a tube: light along its top, shadow under it. One
         flat bar is a drawn stripe, which is the note the app's own arm
         collected twice. -->
    <div style="position:absolute;left:{P(px_)}px;top:{P(py_)}px;
        width:{P(length)}px;height:{P(rod_w)}px;transform-origin:0 50%;
        transform:translateY(-50%) rotate({ang:.3f}deg);border-radius:{P(rod_w)}px;
        background:linear-gradient(180deg,#ffffff,#e2e6ea 36%,#9aa0a9 76%,#6b717a);
        box-shadow:0 {P(1.6)}px {P(3.6)}px rgba(0,0,0,.55);"></div>
    <!-- the counterweight, as a barrel ON the pivot rather than out past it -->
    <div style="position:absolute;left:{P(bx)}px;top:{P(by)}px;
        width:{P(barrel_l)}px;height:{P(barrel_w)}px;transform:translate(-50%,-50%)
        rotate({ang:.3f}deg);border-radius:{P(barrel_w / 2)}px;
        background:linear-gradient(180deg,#eef1f5,#b3b9c1 46%,#71777f 78%,#565c64);
        box-shadow:0 {P(1.8)}px {P(4)}px rgba(0,0,0,.55),
          inset 0 {P(0.7)}px 0 rgba(255,255,255,.75);"></div>
    <!-- the bearing: a low cylinder, not a sphere. Rendered as a ball it read
         as a second object sitting beside the weight. -->
    <div style="position:absolute;left:{P(px_)}px;top:{P(py_)}px;
        width:{P(hub)}px;height:{P(hub)}px;transform:translate(-50%,-50%);
        border-radius:50%;
        background:radial-gradient(circle at 36% 28%,#f1f4f7,#adb3bb 56%,#767c85);
        box-shadow:0 {P(2.2)}px {P(5)}px rgba(0,0,0,.55),
          inset 0 {P(0.6)}px 0 rgba(255,255,255,.85);"></div>
    <div style="position:absolute;left:{P(px_)}px;top:{P(py_)}px;
        width:{P(hub * 0.34)}px;height:{P(hub * 0.34)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:radial-gradient(circle at 40% 32%,#f6f8fa,#6b6f78);"></div>
    <!-- the headshell: a small wedge at the far end, cartridge under it -->
    <div style="position:absolute;left:{P(sx)}px;top:{P(sy)}px;
        width:{P(head_l)}px;height:{P(head_w)}px;transform-origin:100% 50%;
        transform:translate(-100%,-50%) rotate({ang:.3f}deg);border-radius:{P(2)}px;
        background:linear-gradient(180deg,#f5f7fa,#b7bcc4 58%,#868c95);
        box-shadow:0 {P(1.6)}px {P(4)}px rgba(0,0,0,.6);"></div>
    <div style="position:absolute;left:{P(sx)}px;top:{P(sy)}px;
        width:{P(r * 0.040)}px;height:{P(r * 0.040)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:#23262c;
        box-shadow:0 {P(0.8)}px {P(2)}px rgba(0,0,0,.7);"></div>"""


# ── the keys ───────────────────────────────────────────────────────────────

INK = '#2b2f36'


def _tri(w, h, pointing_left=False):
    """A triangle cut from borders -- a SHAPE, never a character."""
    side = 'right' if pointing_left else 'left'
    return (f'<div style="width:0;height:0;border-top:{P(h / 2)}px solid transparent;'
            f'border-bottom:{P(h / 2)}px solid transparent;'
            f'border-{side}:{P(w)}px solid {INK};"></div>')


def _bar(w, h):
    return (f'<div style="width:{P(w)}px;height:{P(h)}px;background:{INK};'
            f'border-radius:{P(0.6)}px;"></div>')


def _glyph(kind, s):
    """`s` is the glyph's own height in points, so the three keys carry marks
    of one size whatever their pills measure."""
    if kind == 'prev':
        inner = _tri(s * 0.52, s, True) + _tri(s * 0.52, s, True)
    elif kind == 'next':
        inner = _tri(s * 0.52, s) + _tri(s * 0.52, s)
    else:
        inner = (_tri(s * 0.56, s)
                 + f'<div style="width:{P(s * 0.40)}px;"></div>'
                 + _bar(s * 0.20, s) + _bar(s * 0.20, s))
    gap = P(s * 0.13)
    return (f'<div style="display:flex;align-items:center;gap:{gap}px;'
            f'filter:drop-shadow(0 {P(0.7)}px 0 rgba(255,255,255,.60));">{inner}</div>')


def pill(x, y, w, h, kind):
    """A silver key, pill shaped and lit from above.

    FOUR LAYERS MAKE IT READ AS METAL RATHER THAN AS A COLOURED SHAPE, and
    none of them is a stroke: a vertical ramp that is bright at the crown and
    turns out of the light at the waist, a HAIRLINE CATCH along the very top
    edge, an inner shadow under the bottom edge where the cap rolls away, and
    a drop shadow on the ground so it sits above the tile rather than in it.
    A plain border round it would read as a sticker -- the note this target has
    now collected on the mirror ball's rim, the vinyl's wedges and the CD's
    corner clips."""
    return f"""
    <div style="position:absolute;left:{P(x)}px;top:{P(y)}px;
        width:{P(w)}px;height:{P(h)}px;transform:translate(-50%,-50%);
        border-radius:{P(h / 2)}px;display:flex;align-items:center;
        justify-content:center;
        background:linear-gradient(180deg,#fbfcfd,#dde1e6 34%,#aeb4bc 56%,
          #8b9199 78%,#c2c7cd);
        box-shadow:0 {P(2.4)}px {P(5)}px rgba(0,0,0,.58),
          0 {P(0.8)}px {P(1.4)}px rgba(0,0,0,.35),
          inset 0 {P(0.9)}px 0 rgba(255,255,255,.95),
          inset 0 -{P(1.1)}px {P(1.4)}px rgba(0,0,0,.30);">
      {_glyph(kind, h * 0.44)}
    </div>"""


def keys(y, *, h=21, wide=56, narrow=44, gap=12):
    """Three keys, centred, sitting straight on the ground -- no strip, no
    panel, no divider. The middle one is wider because it is the one a thumb
    goes for, which is also what the reference does."""
    total = narrow * 2 + wide + gap * 2
    x0 = 169 - total / 2
    return (pill(x0 + narrow / 2, y, narrow, h, 'prev')
            + pill(x0 + narrow + gap + wide / 2, y, wide, h, 'play')
            + pill(x0 + narrow + gap + wide + gap + narrow / 2, y, narrow, h, 'next'))


def record(cx, cy, r, label_html):
    d = P(r * 2)
    return (f'<div style="position:absolute;left:{P(cx)}px;top:{P(cy)}px;'
            f'width:{d}px;height:{d}px;transform:translate(-50%,-50%);">'
            f'{grooves(d, int(d * 0.29), label_html)}</div>')


# ── the four tiles ─────────────────────────────────────────────────────────

# r = 142 is the CEILING for these margins, not a preference. Across:
# 2.169r = 308, leaving 15 either side. Down: 1.023r above the centre and r
# below, from 16 of top air to the record's foot at 303.3, which leaves 14 of
# air, a 21pt key and 16 of bottom margin. The weight's far corner lands at
# (323, 16), inside the tile's own 22pt corner curve with room to spare.
R, CX, CY, KEY_Y = 142, 157.0, 161.3, 354 - 16 - 21 / 2

A_ = BT.slot('THE MODE &middot; large', 'A &mdash; build 69, what you have', f"""
  {halo()}
  {record(169, 177, 160.5, red_label())}
""", 'l', note='The record alone at 321 across, no arm and no keys. This is the control &mdash; '
               'every number below is measured against it.')

B_ = BT.slot('THE MODE &middot; large', 'B &mdash; the slim arm, three keys on the ground', f"""
  {halo()}
  {record(CX, CY, R, red_label())}
  {arm_slim(CX, CY, R)}
  {keys(KEY_Y)}
""", 'l', note='284 across &mdash; 12% off the control, against round&nbsp;1&rsquo;s 31%. The '
               'weight is folded into the pivot instead of hanging off a stub behind it, which '
               'is the whole of where those points came from. No strip, no divider: the keys sit '
               'on the same ground the record does.')

C_ = BT.slot('THE MODE &middot; large', 'C &mdash; B, with the album cover on the label', f"""
  {halo()}
  {record(CX, CY, R, cover_label())}
  {arm_slim(CX, CY, R)}
  {keys(KEY_Y)}
""", 'l', note='Identical to B but for the centre. The cover falls back to the red label when '
               'there is nothing to draw &mdash; companion mode, a fresh install, a custom '
               'station &mdash; so it is never a hole.')

D_ = BT.slot('THE MODE &middot; large', 'D &mdash; C, on a painted deck', f"""
  {surface()}
  {record(CX, CY, R, cover_label())}
  {arm_slim(CX, CY, R)}
  {keys(KEY_Y)}
""", 'l', note='The reference&rsquo;s own ground: the whole tile painted in the station&rsquo;s '
               'colour rather than a glow in the middle of it. Deepened to a fifth of its '
               'brightness, because a saturated fill behind a black record leaves the disc '
               'nothing to stand against.')

html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('One tile: a slim arm, and three silver keys at the foot',
                  'Owner, 26.09: "create a better tonearm design. Instead of the rectangle '
                  'border at the bottom the buttons should just sit at the bottom &mdash; these '
                  'buttons can be pill shaped and make them look 3d and do them silver&hellip; '
                  'if there was a way to fit them in one widget without squashing the vinyl that '
                  'would be great. I\'d suggest no text, keep only the playback, forward '
                  'play/pause buttons." <br>'
                  'The arm is what makes the record shrink, so the arm is what was fixed: the '
                  'app&rsquo;s own one hangs its counterweight off a stub past the bearing (far '
                  'edge 1.284 radii), which is why round&nbsp;1 came out 31% smaller than what '
                  'you have. Folding the weight into the pivot housing &mdash; how a slim arm is '
                  'actually built &mdash; brings that to 1.169, and the disc back up to 284 '
                  'across. The three keys are FURNITURE, part of the object whether or not '
                  'anything is playing, exactly like the CD window&rsquo;s keys you picked on '
                  'Thursday; the middle one is engraved with a triangle AND two bars together, '
                  'because that is the printed label on a real combined key rather than a claim '
                  'about what the song is doing. No text anywhere on the tile.')
        + f'<div class=row>{A_}{B_}{C_}{D_}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
