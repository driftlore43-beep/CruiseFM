"""
ROUND 3: THE DECK'S GROUND, AND THE ARM'S DETAIL AND LENGTH.

Owner, 2026-09-26, with a photograph of the large Mode tile on her Home
Screen:

  "do you suggest putting the station theme colour on the background? Or
   should it be the album theme colour - like the central colour and can we
   have the same tonearm design that's in the app transferred to the widget. I
   would also be happy if we could extend the arm a bit longer. Generate
   prototypes"

────────────────────────────────────────────────────────────────────────────
TWO QUESTIONS, AND ONLY THE SECOND ONE COSTS ANYTHING.

THE GROUND is free either way — one arithmetic (`tileHalo`) fed a different
colour. What it is NOT free of is agreement: the ball and the CD in the same
gallery row both stand in the station's halo, so a record that took the
album's colour would make three tiles on one Home Screen mean three different
things. The counter-argument is that the record is the ONLY look of the three
whose centre is the album cover, so it is the one place a halo in a different
hue is visibly arguing with the object in front of it.

THE ARM IS THE EXPENSIVE ONE, AND THE PRICE IS PAID IN RECORD. Every part of
the arm that sits above and to the right of the disc pushes the disc down and
in, because the tile has a fixed 338x354 to spend. 26.09 already measured the
two ends of that: the app's arm hangs its counterweight off a stub past the
bearing and forces the disc to 231 across; folding the weight into the pivot
housing gives it back to 284. Extending the rod re-opens exactly that trade.

THE SURPRISE, AND IT IS WHY THIS SHEET EXISTS RATHER THAN A GUESS: the app's
DETAIL is free and the app's LENGTH is not. A base plate with vents, a
collar, a finger lift, slots, screws and a real cartridge all sit INSIDE the
footprint the weight already claims, so they cost no record at all. But the
rod leaves the stylus at about 71 degrees, so every point of extra length
buys 0.32 of width and 0.95 of HEIGHT — the tile's top edge is what binds,
not its side, and a longer arm is paid for almost entirely out of the disc.

EVERY RECORD SIZE ON THIS SHEET IS SOLVED, NOT PICKED. `fit()` takes each
arm's own measured footprint and returns the largest disc that keeps 15pt
either side, 16 of air above the weight, 14 under the record's foot, the
21pt key row and 16 below it. Fed today's arm it returns 142.0 and centres
it at (157.0, 161.3), which is what `Turntable` in ModeWidget.swift actually
carries — so the model is checked against the shipped numbers before it is
used to price anything new.

THE COVER: pass a real one with COVER=<path to a jpg>, or the sheet falls
back to a station photograph. Album art is deliberately not committed here.

DRAWN AT 2px PER POINT through P(), so a number here can be compared with the
Swift by eye. Large tile 338x354pt = 676x708px.

RUN:
  OUT=<scratch>/tt2.html COVER=<scratch>/cover.jpg python3 docs/design/turntable_two.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/tt2.html OUT=<scratch>/tt2.png node docs/design/shot4.mjs
"""
import base64, math, os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'turntable_two.html')
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.tt2-throwaway.html')
import turntable_one as T1                  # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

BT = T1.BT
P, keys, record, arm_slim = T1.P, T1.keys, T1.record, T1.arm_slim
cover_label, red_label = T1.cover_label, T1.red_label

CSS = BT.CSS + """
.slot { max-width: 676px; }
.note { max-width: 676px; }
"""

# Night Run AM's own accent, and it is chosen rather than convenient: a teal
# against a cream-and-rose cover is the strongest disagreement the app can
# produce, so if the album's colour is ever going to be the right answer it is
# visible here.
STATION = '#19C6D4'


# ── the ground: `tileHalo`, ported exactly ─────────────────────────────────

def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def halo(src, strength=0.70):
    """`Snapshot.tileHalo`, line for line, as a CSS radial gradient.

    Scale the colour to each stop's target brightness, but never past the
    point where its brightest channel clips — a clipped channel shifts the
    hue, which is the 10.09 "we manufactured a colour" fault — then pull it
    part of the way toward a neutral of the same brightness. Centre 50%/34%,
    end radius 100 * k, which on this tile is 214pt.
    """
    r, g, b = _rgb(src)
    mean = max(0.02, (r + g + b) / 3)
    peak = max(0.02, max(r, g, b))

    def stop(target, neutral):
        kk = min(target / mean, 1 / peak)
        c = [min(1, x * kk) * (1 - neutral) + target * neutral for x in (r, g, b)]
        return 'rgb({},{},{})'.format(*[round(v * 255) for v in c])

    a = stop(0.30 * strength, 0.30)
    m = stop(0.13 * strength, 0.22)
    z = stop(0.025 * strength, 0.10)
    return (f'<div style="position:absolute;inset:0;background:'
            f'radial-gradient(circle {P(214)}px at 50% 34%,{a} 0%,{m} 50%,{z} 100%);'
            f'"></div>')


def painted(src):
    """The whole tile painted rather than a glow in the middle of it — the
    same colour, spent as a surface. Deepened hard, because a saturated fill
    behind a black record leaves the disc nothing to stand against (20.09)."""
    r, g, b = _rgb(src)
    top = 'rgb({},{},{})'.format(*[round(min(1, x * 0.26 + 0.10) * 255) for x in (r, g, b)])
    mid = 'rgb({},{},{})'.format(*[round(min(1, x * 0.16 + 0.05) * 255) for x in (r, g, b)])
    return f"""
    <div style="position:absolute;inset:0;background:
        linear-gradient(166deg,{top},{mid} 52%,#0b0d0f);"></div>
    <div style="position:absolute;inset:0;background:
        repeating-linear-gradient(97deg,rgba(255,255,255,.022) 0 1px,
          transparent 1px 5px);"></div>"""


def unlit():
    """No colour at all — the fixed near-black this tile carried before
    20.09. Kept on the sheet as the control: it is what "just make the
    background black" actually looks like under a coloured cover."""
    return ('<div style="position:absolute;inset:0;background:'
            'radial-gradient(circle at 50% 38%,#1a1a1f,#08080a 82%);"></div>')


# ── the arm, and what each version of it costs ─────────────────────────────
#
# Stylus at 0.80r, five degrees below the horizontal, exactly as the app and
# the shipped widget both place it: any further in is the LABEL, which is the
# one place a needle never is (03.08). The pivot is `rod` radii back along the
# line from there, so `rod` is the only length knob and everything else
# follows from it.
STY_A = math.radians(-5)
U = (0.321600, -0.946900)          # unit vector, stylus -> pivot
PERP = (-U[1], U[0])               # across the rod

ROD_TODAY = 0.771251               # what ModeWidget.swift carries
BARREL_L, BARREL_W = 0.24, 0.115   # the counterweight, in radii
FOLD = 0.096                       # weight centre behind the pivot, folded in
PLATE_R = 0.115                    # the app's own bearing plate


def extent(rod, stub, plate):
    """The arm's own footprint, as multiples of the record's radius: how far
    right of the disc's centre anything reaches, and how far above it.

    MEASURED FROM THE DRAWN PARTS rather than asserted. The counterweight's
    far CORNER is the extreme in both directions on every version of this
    arm, so it is computed from the barrel's own half-length along the rod
    and half-width across it; the bearing plate is checked as well, because
    on a short arm it can be the thing that sticks out furthest.
    """
    sx, sy = 0.80 * math.cos(STY_A), 0.80 * math.sin(STY_A)
    px, py = sx + rod * U[0], sy + rod * U[1]
    back = (stub if stub is not None else FOLD) + BARREL_L / 2
    wx, wy = px + back * U[0], py + back * U[1]
    xs = [wx + PERP[0] * BARREL_W / 2, wx - PERP[0] * BARREL_W / 2]
    ys = [wy + PERP[1] * BARREL_W / 2, wy - PERP[1] * BARREL_W / 2]
    if plate:
        xs.append(px + PLATE_R)
        ys.append(py - PLATE_R)
    return max(xs), -min(ys)


def fit(wx, wy, *, w=338, h=354, side=15, top=16, gap=14, key_h=21, foot=16):
    """The largest record that fits, and where its centre goes.

    BOTH AXES ARE REAL CONSTRAINTS AND TODAY THEY BIND AT ONCE, which is worth
    knowing before anything is changed: across, the disc plus the arm's reach
    must leave `side` either side; down, the weight's top must clear `top`
    while the record's foot stays `gap` above a `key_h` key row sitting `foot`
    off the bottom. Fed today's arm both return 142.0 to a tenth of a point.
    """
    rx = (w - 2 * side) / (wx + 1)
    ry = (h - top - foot - key_h - gap) / (wy + 1)
    r = min(rx, ry)
    cx = w / 2 - (wx - 1) * r / 2
    cy = h - foot - key_h - gap - r
    return r, cx, cy, rx, ry


def arm_app(cx, cy, r, *, rod=ROD_TODAY, stub=None, uid='x'):
    """THE APP'S OWN ARM, brought across piece by piece.

    WHAT THE WIDGET WAS MISSING IS HARDWARE, NOT SHAPE. Both arms are already
    a straight rod onto the outer grooves; what the app's deck has and this
    tile did not is the BEARING PLATE the arm stands on (vents, four screws,
    a centre screw with a glint, and a cast shadow under it, which is the one
    thing that stops the assembly floating — owner, 13.09), a COLLAR where
    the shell bolts on, a FINGER LIFT, VENT SLOTS and mounting screws on the
    shell, the shell's bright FRONT FACE, and a tapered CARTRIDGE with the
    stylus at its point instead of a dot.

    ALL OF IT SITS INSIDE THE FOOTPRINT THE WEIGHT ALREADY CLAIMS, which is
    why it is free: the plate's own edge reaches 1.16 radii against the
    weight's 1.17, and the anti-skate dial is put on the INBOARD shoulder
    where there is dead space above the disc rather than the outboard one,
    where it would be the widest thing on the tile.

    `stub` is the app's back end: the weight on a short stub BEHIND the
    bearing rather than folded into it. That is the one part of the app's arm
    that is not free, and the sheet prices it.
    """
    sx = cx + r * 0.80 * math.cos(STY_A)
    sy = cy + r * 0.80 * math.sin(STY_A)
    px, py = sx + rod * r * U[0], sy + rod * r * U[1]
    ang = math.degrees(math.atan2(sy - py, sx - px))
    back_deg = ang + 180
    rod_w = r * 0.038
    length = math.hypot(sx - px, sy - py)

    off = (stub if stub is not None else FOLD) * r
    wx = px + (off + BARREL_L * r / 2) * U[0] - (BARREL_L * r / 2) * U[0]
    # centre of the barrel: `off` back from the pivot along the rod's axis
    wx = px + off * U[0]
    wy = py + off * U[1]
    pr = PLATE_R * r
    head_l, head_w = r * 0.30, r * 0.135

    stub_html = ''
    if stub is not None:
        stub_html = f"""
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(off)}px;height:{P(rod_w * 0.72)}px;transform-origin:0 50%;
        transform:translateY(-50%) rotate({back_deg:.3f}deg);
        border-radius:{P(rod_w)}px;
        background:linear-gradient(180deg,#e8ecf1,#9aa0a9 62%,#6f757e);"></div>"""

    return f"""
    <!-- THE BEARING PLATE, AND IT IS METAL RATHER THAN THE APP'S GRAPHITE.
         The app draws this plate near-black (#212228) because on the deck it
         sits on a lit plinth with the whole room behind it; on a tile it sits
         directly beside a black record and the first render showed exactly
         what that costs -- a dark disc beside a dark disc reads as a hole,
         not as hardware. Brushed metal lit from above is the same object in
         the light this tile actually has, which is the same correction the
         Winamp's title bar needed on 10.09: keep the design, not the literal.
         A real arm's bearing stands on a machined pillar rising out of the
         plinth; this deck has no plinth, so the only thing that can put the
         assembly ON something is the light. Pure falloff, offset down and
         right to agree with the key light everything else here is lit by. -->
    <div style="position:absolute;left:{P(px + pr * 0.18)}px;top:{P(py + pr * 0.34)}px;
        width:{P(pr * 3.0)}px;height:{P(pr * 2.4)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:radial-gradient(closest-side,
          rgba(0,0,0,.60),rgba(0,0,0,.32) 52%,rgba(0,0,0,0));"></div>
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(pr * 2)}px;height:{P(pr * 2)}px;transform:translate(-50%,-50%);
        border-radius:50%;
        background:linear-gradient(164deg,#f0f3f7,#b9bfc8 32%,#7d838c 62%,#4e535b);
        box-shadow:0 {P(1.6)}px {P(3.4)}px rgba(0,0,0,.55),
          inset 0 {P(0.8)}px 0 rgba(255,255,255,.9);"></div>
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(pr * 1.54)}px;height:{P(pr * 1.54)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:linear-gradient(164deg,#31343b,#1b1d22);
        box-shadow:inset 0 {P(0.7)}px {P(1.4)}px rgba(0,0,0,.65);"></div>
    {''.join(
        f'<div style="position:absolute;left:{P(px + math.cos(math.radians(d)) * pr * 0.58)}px;'
        f'top:{P(py + math.sin(math.radians(d)) * pr * 0.58)}px;'
        f'width:{P(pr * 0.30)}px;height:{P(1.1)}px;transform:translate(-50%,-50%) '
        f'rotate({d}deg);background:rgba(255,255,255,.20);border-radius:1px;"></div>'
        for d in (0, 45, 90, 135, 180, 225, 270, 315))}
    {''.join(
        f'<div style="position:absolute;left:{P(px + fx * pr * 0.86)}px;'
        f'top:{P(py + fy * pr * 0.86)}px;'
        f'width:{P(pr * 0.17)}px;height:{P(pr * 0.17)}px;transform:translate(-50%,-50%);'
        f'border-radius:50%;background:#61666e;'
        f'box-shadow:inset 0 {P(0.4)}px 0 rgba(255,255,255,.6);"></div>'
        for fx, fy in ((-0.62, -0.50), (0.62, -0.50), (-0.62, 0.50), (0.62, 0.50)))}
    <!-- the anti-skate dial, INBOARD: outboard it would be the widest thing
         on the tile and the record would pay for it. -->
    <div style="position:absolute;left:{P(px - pr * 1.30)}px;top:{P(py + pr * 0.34)}px;
        width:{P(pr * 0.62)}px;height:{P(pr * 0.62)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:linear-gradient(170deg,#9aa0a9,#4d525a);
        box-shadow:0 {P(1)}px {P(2)}px rgba(0,0,0,.5);"></div>
    <div style="position:absolute;left:{P(px - pr * 1.30)}px;top:{P(py + pr * 0.18)}px;
        width:{P(1.2)}px;height:{P(pr * 0.28)}px;transform:translate(-50%,0);
        background:#23262c;"></div>
    {stub_html}
    <!-- the rod, one tube shaded ACROSS its own width. Six stacked slices is
         what made the app's own arm read as "cheap" once it grew (14.09):
         the banding IS the detail, so a real cross-section is continuous. -->
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(length)}px;height:{P(rod_w)}px;transform-origin:0 50%;
        transform:translateY(-50%) rotate({ang:.3f}deg);border-radius:{P(rod_w)}px;
        background:linear-gradient(180deg,#8e939c,#dfe4ec 12%,#ffffff 26%,
          #d2d7e0 44%,#9aa0aa 66%,#6a707a 86%,#474c54);
        box-shadow:0 {P(1.6)}px {P(3.6)}px rgba(0,0,0,.55);"></div>
    <!-- the counterweight -->
    <div style="position:absolute;left:{P(wx)}px;top:{P(wy)}px;
        width:{P(BARREL_L * r)}px;height:{P(BARREL_W * r)}px;
        transform:translate(-50%,-50%) rotate({ang:.3f}deg);
        border-radius:{P(BARREL_W * r / 2)}px;
        background:linear-gradient(180deg,#eef1f5,#b3b9c1 44%,#71777f 76%,#565c64);
        box-shadow:0 {P(2.2)}px {P(4.6)}px rgba(0,0,0,.72),
          inset 0 {P(0.8)}px 0 rgba(255,255,255,.9);"></div>
    {''.join(
        f'<div style="position:absolute;left:{P(wx + f * BARREL_L * r)}px;top:{P(wy)}px;'
        f'width:{P(0.9)}px;height:{P(BARREL_W * r * 0.78)}px;'
        f'transform:translate(-50%,-50%) rotate({ang:.3f}deg);'
        f'background:rgba(0,0,0,.34);"></div>' for f in (-0.26, -0.16, 0.16, 0.26))}
    <!-- the bearing itself, on the plate -->
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(pr * 0.92)}px;height:{P(pr * 0.92)}px;transform:translate(-50%,-50%);
        border-radius:50%;
        background:radial-gradient(circle at 36% 28%,#f1f4f7,#adb3bb 56%,#767c85);
        box-shadow:0 {P(2.2)}px {P(5)}px rgba(0,0,0,.55),
          inset 0 {P(0.6)}px 0 rgba(255,255,255,.85);"></div>
    <div style="position:absolute;left:{P(px)}px;top:{P(py)}px;
        width:{P(pr * 0.32)}px;height:{P(pr * 0.32)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:radial-gradient(circle at 40% 32%,#f6f8fa,#6b6f78);
        box-shadow:inset 0 0 0 {P(0.6)}px rgba(0,0,0,.35);"></div>
    <!-- THE HEADSHELL, AS A WEDGE: narrow where it bolts to the tube and
         widening to the cartridge face. A shell barely wider than the tube
         reads as a blob, which is the note the app's own arm collected. -->
    <div style="position:absolute;left:{P(sx)}px;top:{P(sy)}px;
        width:{P(head_l)}px;height:{P(head_w)}px;transform-origin:100% 50%;
        transform:translate(-100%,-50%) rotate({ang:.3f}deg);">
      <!-- collar -->
      <div style="position:absolute;left:0;top:50%;transform:translateY(-50%);
          width:{P(head_l * 0.22)}px;height:{P(head_w * 1.02)}px;border-radius:{P(1.4)}px;
          background:linear-gradient(180deg,#c3c8d1,#8f959e 60%,#666c74);"></div>
      <!-- finger lift, bolted under the shell -->
      <div style="position:absolute;left:{P(head_l * 0.34)}px;top:{P(-head_w * 0.30)}px;
          width:{P(head_l * 0.40)}px;height:{P(head_w * 0.34)}px;border-radius:{P(1)}px;
          background:linear-gradient(180deg,#9aa0ab,#6b7079);"></div>
      <!-- shell body: a trapezoid, wide at the cartridge end -->
      <div style="position:absolute;left:{P(head_l * 0.18)}px;top:0;
          width:{P(head_l * 0.60)}px;height:{P(head_w)}px;
          clip-path:polygon(0% 26%,100% 2%,100% 98%,0% 74%);
          background:linear-gradient(180deg,#e9edf3,#aab0b9 46%,#7a8089 78%,#565b63);
          box-shadow:0 {P(1.4)}px {P(3.4)}px rgba(0,0,0,.6);"></div>
      <!-- vent slots and the two mounting screws -->
      <div style="position:absolute;left:{P(head_l * 0.36)}px;top:{P(head_w * 0.30)}px;
          width:{P(head_l * 0.20)}px;height:{P(head_w * 0.13)}px;border-radius:{P(1)}px;
          background:rgba(10,11,14,.72);"></div>
      <div style="position:absolute;left:{P(head_l * 0.36)}px;top:{P(head_w * 0.56)}px;
          width:{P(head_l * 0.20)}px;height:{P(head_w * 0.13)}px;border-radius:{P(1)}px;
          background:rgba(10,11,14,.72);"></div>
      <!-- the shell's bright front FACE. Without it the shell and the
           cartridge merge into one dark wedge and only the needle reads. -->
      <div style="position:absolute;left:{P(head_l * 0.74)}px;top:{P(head_w * 0.04)}px;
          width:{P(head_l * 0.07)}px;height:{P(head_w * 0.92)}px;
          background:#cfd4dc;"></div>
      <!-- cartridge, tapering to the stylus at its point -->
      <div style="position:absolute;left:{P(head_l * 0.79)}px;top:{P(head_w * 0.18)}px;
          width:{P(head_l * 0.21)}px;height:{P(head_w * 0.64)}px;
          clip-path:polygon(0% 0%,100% 34%,100% 66%,0% 100%);
          background:linear-gradient(180deg,#2a2d34,#16181d);"></div>
    </div>
    <div style="position:absolute;left:{P(sx)}px;top:{P(sy)}px;
        width:{P(r * 0.018)}px;height:{P(r * 0.018)}px;transform:translate(-50%,-50%);
        border-radius:50%;background:#eef2f8;"></div>"""


# ── the cover ──────────────────────────────────────────────────────────────

_cover_path = os.environ.get('COVER')
if _cover_path and pathlib.Path(_cover_path).exists():
    _b = base64.b64encode(pathlib.Path(_cover_path).read_bytes()).decode()
    LABEL = (f'<div style="position:absolute;inset:0;overflow:hidden;">'
             f'<img src="data:image/jpeg;base64,{_b}" style="position:absolute;inset:0;'
             f'width:100%;height:100%;object-fit:cover;">'
             f'<div style="position:absolute;inset:0;box-shadow:inset 0 0 0 1px '
             f'rgba(0,0,0,.35);"></div></div>')
    ALBUM = os.environ.get('ALBUM', '#C9A87E')
else:
    LABEL = cover_label()
    ALBUM = os.environ.get('ALBUM', '#6FA3B8')


# ── row 1: the ground ──────────────────────────────────────────────────────

R0, CX0, CY0, _rx, _ry = fit(*extent(ROD_TODAY, None, False))
KEY_Y = 354 - 16 - 21 / 2


def deck(ground, *, rod=ROD_TODAY, stub=None, plate=True, uid='x'):
    r, cx, cy, _, _ = fit(*extent(rod, stub, plate))
    body = arm_app(cx, cy, r, rod=rod, stub=stub, uid=uid) if plate \
        else arm_slim(cx, cy, r)
    return ground + record(cx, cy, r, LABEL) + body + keys(KEY_Y), r


G1, _ = deck(halo(STATION), plate=False)
G2, _ = deck(halo(ALBUM), plate=False)
G3, _ = deck(painted(ALBUM), plate=False)
G4, _ = deck(unlit(), plate=False)

GROUND = ''.join([
    BT.slot('THE GROUND', '1 &mdash; the station&rsquo;s colour (what you have)', G1, 'l',
            note='Night&nbsp;Run&rsquo;s teal, through the same arithmetic the mirror ball and '
                 'the CD stand in. It is always there &mdash; a custom station with no '
                 'photograph still has an accent &mdash; and all three looks in the row agree '
                 'about what the colour means.'),
    BT.slot('THE GROUND', '2 &mdash; the album&rsquo;s colour', G2, 'l',
            note='The cover&rsquo;s own average, through the identical arithmetic. It changes '
                 'with the music, and it agrees with the thing in the middle of the tile &mdash; '
                 'which is the real argument, since the record is the only look of the three '
                 'with a cover at its centre. With no cover it falls back to the station.'),
    BT.slot('THE GROUND', '3 &mdash; the album&rsquo;s colour, painted', G3, 'l',
            note='The same colour spent as a surface rather than a glow: the whole tile is the '
                 'deck. Deepened hard on purpose &mdash; a saturated fill behind a black record '
                 'leaves the disc nothing to stand against.'),
    BT.slot('THE GROUND', '4 &mdash; no colour at all', G4, 'l',
            note='The fixed near-black this tile carried until 20.09, kept as the control. It is '
                 'what &ldquo;just make it black&rdquo; actually looks like, and it is close to '
                 'what your photograph shows &mdash; a dark station accent at 0.70 strength is '
                 'barely reading.'),
])


# ── row 2: the arm ─────────────────────────────────────────────────────────

LONG_1 = 0.848     # +10% of rod
LONG_2 = 0.926     # +20%
LONG_3 = 1.02      # +32%, and the app's own back end with it
APP_STUB = 0.26    # the app's back end: the weight out past the bearing

A1, r1 = deck(halo(STATION), plate=False)
A2, r2 = deck(halo(STATION), plate=True, uid='b')
A3, r3 = deck(halo(STATION), rod=LONG_1, plate=True, uid='c')
A4, r4 = deck(halo(STATION), rod=LONG_2, plate=True, uid='d')
A5, r5 = deck(halo(STATION), rod=LONG_3, stub=APP_STUB, plate=True, uid='e')


def cost(r):
    return f'{r * 2:.0f} across ({(r / R0 - 1) * 100:+.0f}% against A)'


ARMS = ''.join([
    BT.slot('THE ARM', 'A &mdash; what you have', A1, 'l',
            note=f'The slim arm: a rod, a barrel folded into the pivot, a small wedge at the '
                 f'end. Record {cost(r1)}. Everything below is measured against it.'),
    BT.slot('THE ARM', 'B &mdash; the app&rsquo;s arm, same length', A2, 'l',
            note=f'The deck&rsquo;s own hardware: the bearing plate with its vents, screws, '
                 f'centre screw and cast shadow, the anti-skate dial, the collar, the finger '
                 f'lift, the shell&rsquo;s slots and mounting screws, its bright front face and '
                 f'a tapered cartridge. Record {cost(r2)} &mdash; all of it fits inside the '
                 f'footprint the counterweight already claimed, so the detail is free.'),
    BT.slot('THE ARM', 'C &mdash; B, arm 10% longer', A3, 'l',
            note=f'Record {cost(r3)}. The rod leaves the stylus at about 71 degrees, so length '
                 f'buys three times as much HEIGHT as width &mdash; it is the tile&rsquo;s top '
                 f'edge that binds, and the disc pays.'),
    BT.slot('THE ARM', 'D &mdash; B, arm 20% longer', A4, 'l',
            note=f'Record {cost(r4)}. Roughly a point of diameter for every one per cent of rod, '
                 f'all the way down.'),
    BT.slot('THE ARM', 'E &mdash; the app&rsquo;s arm whole, back end and all', A5, 'l',
            note=f'32% longer with the counterweight out past the bearing on a stub, which is '
                 f'how the app really builds it. Record {cost(r5)}. This is the version 26.09 '
                 f'measured and you asked me to avoid; it is here so the trade is visible rather '
                 f'than described.'),
])

html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The deck: what it stands on, and how long its arm is',
                  'Owner, 26.09: "do you suggest putting the station theme colour on the '
                  'background? Or should it be the album theme colour &mdash; like the central '
                  'colour&hellip; can we have the same tonearm design that&rsquo;s in the app '
                  'transferred to the widget. I would also be happy if we could extend the arm a '
                  'bit longer." <br>'
                  'THE GROUND IS FREE EITHER WAY &mdash; one arithmetic fed a different colour. '
                  'THE ARM IS NOT: every part of it sits above and to the right of the disc, and '
                  'the tile is a fixed 338&times;354, so length is paid for in record. Every '
                  'size below is SOLVED from the arm&rsquo;s own measured footprint rather than '
                  'picked, and the solver is checked first against what the widget ships today '
                  '&mdash; fed the shipped arm it returns a 142pt radius centred at (157.0, '
                  '161.3), which is what the Swift actually carries.')
        + f'<div class=row>{GROUND}</div>'
        + f'<div class=row>{ARMS}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
print(f"  solver check: r={R0:.1f} cx={CX0:.1f} cy={CY0:.1f} "
      f"(x-bound {_rx:.1f}, y-bound {_ry:.1f}) -- Swift carries 142 / 157.0 / 161.3")
for n, (rod, stub, plate) in (('A', (ROD_TODAY, None, False)),
                              ('B', (ROD_TODAY, None, True)),
                              ('C', (LONG_1, None, True)),
                              ('D', (LONG_2, None, True)),
                              ('E', (LONG_3, APP_STUB, True))):
    wx, wy = extent(rod, stub, plate)
    r, cx, cy, rx, ry = fit(wx, wy)
    print(f"  {n}: reach {wx:.3f}r wide / {wy:.3f}r up -> disc {r*2:.0f} "
          f"(x {rx*2:.0f}, y {ry*2:.0f})")
