"""
THE BIG CD PLAYER — FILLING IT, AND SIZING ITS TYPE OFF THE BOX.

Owner, 2026-09-25, with a crop of the app's own Y2K share card showing the
whole right-hand control cluster (CD, volume, tape deck, pause/shuffle/repeat,
prev/rew/ff/next/heart):

  "Leave the progress bar out then and keep 'last played'. I want to have
   these contents on the right hand side. The designs are still missing a lot
   of details — there's too much empty space. Lastly the texts needs to scale
   larger — they're currently really small compared to how much empty space
   there is — make it look compatible."

────────────────────────────────────────────────────────────────────────────
THE TYPE COMPLAINT IS A REAL STRUCTURAL FAULT, AND IT IS THE MIRROR IMAGE OF
THE CASE-FURNITURE ONE FOUND THE DAY BEFORE. That round found the CD case's
moulded detail being multiplied by `k` when it should not have been. Here
NOTHING in the window is scaled at all: `cdTitleBar` and `field` are shared
between the medium tile and the large one, so the title sets at 15pt and the
fields at 11/12pt on BOTH — but on the large tile the value box is the full
288pt wide instead of sharing its row with a cover, and there are four rows
instead of two. The box grew and the type did not.

MEASURED AGAINST THE SHARE CARD, which is the thing she is comparing it to:
its field box is 64 tall with 34px type (0.53 of the row) and its title bar
66 with 38px (0.58). The widget's are 26 with 12pt (0.46) and 32 with 15pt
(0.47). So the card's type is ~15% larger against its own boxes — and the
card is also DENSER, which is the other half of "small compared to how much
empty space there is". Both are fixed here: the boxes get taller, the type
gets larger against them, and the slack goes to the cluster she asked for.

AND THIS HARNESS WAS UNDER-DRAWING THE TYPE BY 30%, which would have made
the question unanswerable. It draws at 2px per point (the large tile is
676x708 here for 338x354 real), so the shipped 11/12/15pt should be 22/24/30
px — it was drawing 15/17/17. Every size below is now stated in POINTS and
doubled, so the mock cannot disagree with the Swift again. That is the same
fidelity fault recorded on 21.09, when this file's own `tile()` was still
drawing build 47.

────────────────────────────────────────────────────────────────────────────
WHAT CAN AND CANNOT COME ACROSS FROM HER CARD — CORRECTED.

  THE SCRUB BAR: still no, and she has now dropped it herself. A widget is
  redrawn a handful of times a day and the snapshot carries no duration, so
  neither number on that row is available. Its height goes to LAST PLAYED,
  which is the one fact this tile genuinely has (`LastPlayed.at` is already
  stored; it needs one new optional snapshot field carrying the formatted
  time, the way `modeName` and `clockLabel` are formatted in JS).

  THE VOLUME: the +/- keys and the WELL come across; the GREEN LEVEL inside
  it does not. A trough with nothing in it is furniture and asserts nothing —
  exactly the reasoning she just applied to the progress bar.

  SHUFFLE, REPEAT AND THE HEART: drawn as plain unlit keys. My earlier note
  said these "cannot come across", which was narrower than it needed to be —
  the app does track shuffle and repeat, and since this tile is about the
  LAST played song, a past-tense readout would be honest if the snapshot
  carried them. It does not today, so they are unlit here, which is also
  what her own card draws. The heart stays unlit for good: nothing in this
  app has ever stored a liked song.

  THE TAPE DECK AND THE CD: pure decoration, and honest as decoration.

────────────────────────────────────────────────────────────────────────────
COUNTED, NOT EYEBALLED. Layout C, the recommendation, at 338x354 with the
window running to the tile's own edge:

  title bar          36     (title 19pt, was 15)
  body top pad        8
  top row           124     (cover 124 square | cluster 180 wide)
  air                10
  four fields       120     (4 x 30, 3 x 6 between; caption 14pt, value 16pt)
  air                 8
  LAST PLAYED row    20
  body bottom pad    10
  ───────────────────────
                    336 of 354, and the remaining 18 is the fields' own
                    breathing room — nothing is compressed to fit.

  Content width 314 = cover 124 + 10 + cluster 180.
  Cluster 180 x 124: CD 40 + deck 85 + volume 41 across the top (44 tall),
  then pause 88 | shuffle 41 | repeat 41 (30 tall), then five 32pt keys.

RUN:
  OUT=<scratch>/cdw.html python3 docs/design/cd_window_tall.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/cdw.html OUT=<scratch>/cdw.png node docs/design/shot4.mjs
"""
import os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'cd_window_tall.html')
# big_tiles writes its own sheet at import, and v3 writes one at ITS import.
# Point OUT at a throwaway for both, then restore.
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.cdw-throwaway.html')
import big_tiles as BT                      # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

from assets import A                        # noqa: E402

ART = A['coastal']

# ── THE LARGE TILE IS NOT ONE SIZE, WHICH IS THE WHOLE OF THIS ROUND ───────
# WidgetKit hands a large widget a different box on every screen, and this
# window is drawn in FIXED POINTS for exactly one of them. `.l` (338x354) is
# the one it fits; on a Pro Max the same content leaves 36pt dead at the foot
# and 26pt dead down the right, which is what she photographed.
#
# THE SHEET COULD NOT HAVE SHOWN THAT until now: it only ever drew `.l`, i.e.
# the one size where the arithmetic is exact. Fourth time this family of file
# has hit a fidelity fault (21.09 cd_widget drawing build 47; 25.09 this file
# under-drawing type by 30%; 26.09 ticket_tall padding inside its heights) and
# the rule is the same each time: before a harness can answer a question about
# a size, check that it draws that size.
TILES = {
    'S': (329, 345),   # 375x812  — SE 3rd gen, 13 mini
    'M': (338, 354),   # 390x844 / 393x852 — the size the Swift was drawn for
    'B': (364, 382),   # 428x926 / 430x932 — Pro Max, and almost certainly hers
}

CSS = BT.CSS + '.slot { width:min-content; }' + ''.join(
    f'.l{n} {{ width:{w*2}px; height:{h*2}px; }}' for n, (w, h) in TILES.items())

# ── THE ONE SCALE RULE ─────────────────────────────────────────────────────
# 1 point = 2 pixels, because the large tile is 338x354 points and this sheet
# draws it 676x708. EVERY size below is written in points and passed through
# here, so a number in this file can be compared with the Swift by eye.
def P(pt):
    return pt * 2


# ── the parts, shared between the drawings so none of them can drift ───────

def titlebar(title_pt=19, h_pt=36):
    btn = P(h_pt - 14)
    return f"""
    <div style="height:{P(h_pt)}px;background:linear-gradient(90deg,#1d3f8f,#5f86d6);
        display:flex;align-items:center;padding:0 {P(10)}px;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:{P(8)}px;">
        {cd_glyph(h_pt - 16)}
        <span class=px style="color:#fff;font-size:{P(title_pt)}px;">Cruise FM</span>
      </div>
      <div style="display:flex;gap:{P(3)}px;">
        {''.join(f'<div class=up style="width:{btn}px;height:{P(h_pt-17)}px;display:flex;align-items:center;justify-content:center;"><span class=px style="font-size:{P(11)}px;color:#1b1d22;">{c}</span></div>' for c in ('_', '[]', 'X'))}
      </div>
    </div>"""


def field(caption, value, *, h_pt, cap_pt, val_pt, cap_w_pt, arrow=True):
    """A labelled field.

    THE CAPTION COLUMN IS MEASURED OFF THE ttf's OWN hmtx, NOT GUESSED — the
    shipped 52 comes from "Station:" at 44.00 advance units at 11pt. Scaling
    the type scales that: at 14pt "Station:" is 56.00, so the column is 64.
    """
    tipw, tiph = P(h_pt - 9), P(h_pt - 8)
    tip = (f'<div class=up style="width:{tipw}px;height:{tiph}px;margin-right:{P(3)}px;'
           f'display:flex;align-items:center;justify-content:center;flex:none;">'
           f'<div style="width:0;height:0;border-left:{P(4)}px solid transparent;'
           f'border-right:{P(4)}px solid transparent;border-top:{P(5)}px solid #1b1d22;">'
           f'</div></div>') if arrow else ''
    return f"""
    <div style="display:flex;align-items:center;gap:{P(7)}px;height:{P(h_pt)}px;">
      <span class=px style="color:#1b1d22;font-size:{P(cap_pt)}px;width:{P(cap_w_pt)}px;
          flex:none;">{caption}</span>
      <div class=dn style="flex:1;min-width:0;height:{P(h_pt)}px;display:flex;
          align-items:center;justify-content:space-between;">
        <span class=px style="color:#000;font-size:{P(val_pt)}px;padding-left:{P(7)}px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{value}</span>
        {tip}
      </div>
    </div>"""


def cd_glyph(d_pt):
    d = P(d_pt)
    return f"""
      <div style="width:{d}px;height:{d}px;border-radius:50%;position:relative;flex:none;
          background:conic-gradient(from 20deg,#bfe8ff,#d9c6ff,#ffd0e6,#ffe9c2,#c9ffe2,#bfe8ff);
          box-shadow:0 2px 5px rgba(0,0,0,.35);">
        <div style="position:absolute;inset:0;border-radius:50%;background:
            linear-gradient(125deg,rgba(255,255,255,.75) 6%,transparent 34%,
            transparent 66%,rgba(255,255,255,.45) 94%);"></div>
        <div style="position:absolute;inset:{int(d*0.34)}px;border-radius:50%;
            background:#e6eaf0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.7);"></div>
        <div style="position:absolute;inset:{int(d*0.43)}px;border-radius:50%;background:#2b2f37;"></div>
      </div>"""


def deck_glyph(w_pt, h_pt):
    """The share card's rack tape deck. Pure decoration, and honest as
    decoration — unlike a level bar it asserts no value."""
    w, h = P(w_pt), P(h_pt)
    return f"""
      <div class=up style="width:{w}px;height:{h}px;position:relative;flex:none;">
        <div style="position:absolute;left:{P(4)}px;top:{P(5)}px;width:{P(5)}px;
            height:{P(4)}px;background:#e5433c;box-shadow:0 0 0 {P(1)}px #7c1f1c;"></div>
        <div class=dn style="position:absolute;left:{P(13)}px;right:{P(4)}px;top:{P(4)}px;
            height:{P(13)}px;background:#3b4046;box-shadow:inset 2px 2px 0 #23262b,
            inset -2px -2px 0 #dfe3e6;display:flex;align-items:center;justify-content:space-around;">
          <div style="width:{P(4)}px;height:{P(4)}px;border-radius:50%;background:#8a9097;"></div>
          <div style="width:{P(4)}px;height:{P(4)}px;border-radius:50%;background:#8a9097;"></div>
        </div>
        <div style="position:absolute;left:{P(4)}px;right:{P(4)}px;bottom:{P(4)}px;
            height:{P(7)}px;display:flex;gap:{P(1)}px;">
          {''.join(f'<div class=up style="flex:1;"></div>' for _ in range(8))}
        </div>
      </div>"""


def volume(w_pt, h_pt):
    """+ and - keys and the WELL. The well is drawn EMPTY on purpose: we do
    not know the volume, and a level bar at a guessed height is an invented
    readout — the same rule the owner just applied to the progress bar.

    Stacked when the block is tall and narrow, in a row when it is wide and
    short, because a key must stay near square at either shape."""
    wide = w_pt > h_pt * 1.6
    plus = (f'<div class=up style="width:{{w}}px;height:{{h}}px;display:flex;align-items:center;'
            f'justify-content:center;flex:none;"><div style="position:relative;'
            f'width:{P(11)}px;height:{P(11)}px;">'
            f'<div style="position:absolute;top:50%;left:0;right:0;height:{P(2)}px;'
            f'margin-top:-{P(1)}px;background:#1b1d22;"></div>'
            f'<div style="position:absolute;left:50%;top:0;bottom:0;width:{P(2)}px;'
            f'margin-left:-{P(1)}px;background:#1b1d22;"></div></div></div>')
    minus = (f'<div class=up style="width:{{w}}px;height:{{h}}px;display:flex;align-items:center;'
             f'justify-content:center;flex:none;">'
             f'<div style="width:{P(11)}px;height:{P(2)}px;background:#1b1d22;"></div></div>')
    # A 12pt well, which is the share card's own proportion (its trough is 32
    # of a 128-wide volume group) and the number the Swift ships.
    well = (f'<div class=dn style="width:{P(12)}px;min-height:0;background:#a9adb3;'
            f'box-shadow:inset 2px 2px 0 #5f666e, inset -2px -2px 0 #dfe3e6;"></div>')
    if wide:
        kw, kh = P((h_pt) * 1.28), P(h_pt)
        keys_ = plus.format(w=kw, h=kh) + minus.format(w=kw, h=kh)
        return (f'<div style="display:flex;gap:{P(4)}px;width:{P(w_pt)}px;height:{P(h_pt)}px;'
                f'flex:none;">{keys_}{well}</div>')
    kw, kh = P(w_pt - 16), P((h_pt - 4) / 2)
    return (f'<div style="display:flex;gap:{P(4)}px;width:{P(w_pt)}px;height:{P(h_pt)}px;flex:none;">'
            f'<div style="display:flex;flex-direction:column;gap:{P(4)}px;">'
            f'{plus.format(w=kw, h=kh)}{minus.format(w=kw, h=kh)}</div>{well}</div>')


# ── the keys ───────────────────────────────────────────────────────────────
# PLAIN DRAWN SHAPES, NEVER CHARACTERS. The first draft of this sheet asked
# for the media-control codepoints (U+23EA and friends) and two came back as
# ORANGE EMOJI — which is exactly why the widget draws its own Triangle
# rather than a "\u{25BC}". Every glyph below is CSS or inline SVG.

def _tri(size_pt, direction='right', color='#1b1d22'):
    s, b = P(size_pt), P(size_pt * 0.58)
    if direction == 'right':
        return (f'<div style="width:0;height:0;border-top:{b}px solid transparent;'
                f'border-bottom:{b}px solid transparent;border-left:{s}px solid {color};"></div>')
    return (f'<div style="width:0;height:0;border-top:{b}px solid transparent;'
            f'border-bottom:{b}px solid transparent;border-right:{s}px solid {color};"></div>')


def _bar(w_pt, h_pt, color='#1b1d22'):
    return f'<div style="width:{P(w_pt)}px;height:{P(h_pt)}px;background:{color};flex:none;"></div>'


def _svg(inner, size_pt):
    s = P(size_pt)
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" '
            f'stroke="#1b1d22" stroke-width="2.4" stroke-linecap="round" '
            f'stroke-linejoin="round">{inner}</svg>')


GLYPH = {
    'play':    lambda: _tri(7, 'right'),
    'pause':   lambda: f'<div style="display:flex;gap:{P(3)}px;">{_bar(2.5,11)}{_bar(2.5,11)}</div>',
    'prev':    lambda: f'<div style="display:flex;gap:{P(1.5)}px;align-items:center;">{_bar(2,10)}{_tri(6,"left")}</div>',
    'next':    lambda: f'<div style="display:flex;gap:{P(1.5)}px;align-items:center;">{_tri(6,"right")}{_bar(2,10)}</div>',
    'rew':     lambda: f'<div style="display:flex;gap:{P(1)}px;">{_tri(6,"left")}{_tri(6,"left")}</div>',
    'ff':      lambda: f'<div style="display:flex;gap:{P(1)}px;">{_tri(6,"right")}{_tri(6,"right")}</div>',
    # shuffle: two crossing paths with heads — never a close-box X
    'shuffle': lambda: _svg('<path d="M3 6h4c2 0 3 2 5 6s3 6 5 6h3"/>'
                            '<path d="M3 18h4c2 0 3-2 5-6s3-6 5-6h3"/>'
                            '<path d="M18 3l3 3-3 3" fill="#1b1d22"/>'
                            '<path d="M18 15l3 3-3 3" fill="#1b1d22"/>', 13),
    # repeat: a broken loop with a head
    'repeat':  lambda: _svg('<path d="M5 9a6 6 0 016-6h5"/><path d="M19 15a6 6 0 01-6 6H8"/>'
                            '<path d="M14 1l3 2-3 2"/><path d="M10 19l-3 2 3 2"/>', 13),
    'heart':   lambda: _svg('<path d="M12 20C5 15 3 11 5 8a4 4 0 017-1 4 4 0 017 1c2 3 0 7-7 12z" '
                            'fill="#1b1d22"/>', 13),
}


def key(kind, w_pt, h_pt):
    return (f'<div class=up style="width:{P(w_pt)}px;height:{P(h_pt)}px;display:flex;'
            f'align-items:center;justify-content:center;flex:none;">{GLYPH[kind]()}</div>')


def keyrow(kinds, widths, h_pt, gap_pt):
    return (f'<div style="display:flex;gap:{P(gap_pt)}px;">'
            + ''.join(key(k, w, h_pt) for k, w in zip(kinds, widths)) + '</div>')


def cluster(kind, k=1.0, h_pt=None):
    """The share card's own right-hand block, in three arrangements.

    'three'  what ships today: a disc and three keys, which is most of the
             empty space she is pointing at.
    'wide'   180 x 124, beside a 124 cover — her whole crop, in one strip of
             CD/deck/volume and two rows of keys.
    'tall'   148 x 156, bought by dropping the Mode field. Every part grows
             and the volume gets a row of its own.
    """
    def z(x):
        return x * k
    if kind == 'three':
        return (f'<div style="width:{P(z(180))}px;height:{P(z(124))}px;display:flex;'
                f'flex-direction:column;align-items:center;justify-content:space-between;">'
                f'{cd_glyph(z(23))}{keyrow(("prev","play","next"),(z(21),)*3,z(15),z(3))}</div>')
    if kind == 'wide':
        top = (f'<div style="display:flex;gap:{P(z(7))}px;align-items:center;height:{P(z(44))}px;">'
               f'{cd_glyph(z(40))}{deck_glyph(z(80), z(40))}{volume(z(46), z(40))}</div>')
        rows = [top,
                keyrow(('pause', 'shuffle', 'repeat'), (z(88), z(41), z(41)), z(30), z(5)),
                keyrow(('prev', 'rew', 'ff', 'next', 'heart'), (z(32),) * 5, z(32), z(5))]
        w, h = z(180), (h_pt if h_pt else z(124))
    else:
        top = (f'<div style="display:flex;gap:{P(z(8))}px;align-items:center;height:{P(z(46))}px;">'
               f'{cd_glyph(z(46))}{deck_glyph(z(94), z(46))}</div>')
        rows = [top,
                volume(z(148), z(34)),
                keyrow(('pause', 'shuffle', 'repeat'), (z(62), z(41), z(41)), z(32), z(2)),
                keyrow(('prev', 'rew', 'ff', 'next', 'heart'), (z(26),) * 5, z(32), z(4))]
        w, h = z(148), z(156)
    return (f'<div style="width:{P(w)}px;height:{P(h)}px;display:flex;'
            f'flex-direction:column;justify-content:space-between;">{"".join(rows)}</div>')


def lastplayed(label_pt=12, time_pt=15):
    """THE ROW THE SHARE CARD SPENDS ON A SCRUB BAR.

    A widget cannot know where a song is up to — which is the whole reason
    this tile says LAST PLAYED. The one fact it does have is WHEN, and
    `LastPlayed.at` is already stored by the app. Formatted in JS and sent as
    a string, the way `modeName` and `clockLabel` already are."""
    return f"""
      <div style="display:flex;align-items:center;justify-content:space-between;
          height:{P(20)}px;">
        <span class=px style="color:#1b1d22;font-size:{P(label_pt)}px;opacity:.66;">LAST PLAYED</span>
        <span class=px style="color:#1b1d22;font-size:{P(time_pt)}px;">1:04 pm</span>
      </div>"""


# ── the drawings ───────────────────────────────────────────────────────────
#
# THE 25.09 SHEET DREW FOUR LOOKS AT ONE SIZE. This one draws ONE look at
# several sizes, because that is where the fault turned out to be:
#
#   Owner, 26.09, with the big tile on her Home Screen: "Love the widgets!
#   But at the moment it's looking a bit compressed at the top leaving an
#   awkward gap at the bottom. Can we space them out and show me some
#   drawings"
#
# COUNTED BEFORE ANYTHING WAS DRAWN. Every number in `cdBodyTall` is a fixed
# point value, and they add to 346 of height and 338 of width:
#
#   title bar 36 + top pad 8 + top row 124 + air 10 + fields 138
#     + foot 20 + bottom pad 10 = 346
#   pad 12 + cover 124 + gap 10 + cluster 180 + pad 12 = 338
#
# against the real tiles:
#
#   329 x 345   content is 1pt OVER  — something has to squeeze
#   338 x 354   exact, both axes     — the one phone it was drawn for
#   360 x 379   33pt dead at the foot, 22pt dead down the right
#   364 x 382   36pt dead at the foot, 26pt dead down the right
#
# So "compressed at the top" and "an awkward gap at the bottom" are ONE
# fault with one cause: the stack is pinned to the top with
# `.frame(maxHeight: .infinity, alignment: .top)` — added on 25.09 to remove
# a strip ABOVE the title bar — and it removes that strip by piling every
# spare point at the FOOT instead. Re-centring would simply put the top strip
# back, which is why this needs redistributing rather than reversing.

# The size the Swift's fixed numbers were drawn against.
BASE_W, BASE_H = 338, 354

BIGGER = dict(title_pt=19, cap_pt=14, val_pt=16, field_h_pt=30, cap_w_pt=64)


def window(tile, *, k=1.0, air='one', cover_pt=124, clust='wide',
           field_h_pt=30, field_gap_pt=6, title_pt=19, cap_pt=14, val_pt=16,
           cap_w_pt=64, cluster_pt=180, spread=True):
    # A COVER TALLER THAN THE CLUSTER IS NOT AVAILABLE, and it was drawn
    # before it was believed. The cluster is 124 tall because that is what
    # three rows of keys need; stretching it to match a bigger picture
    # spreads those rows and reads as scattered, and leaving it short opens
    # a second empty band beside the picture. So the picture can only grow
    # by SCALING, which is what C and D do.
    """One drawing of the tall window, laid out on a REAL tile.

    Every gap is worked out here in points rather than left to CSS flex, so
    the sheet's own arithmetic is the arithmetic the Swift will carry.

    `k`       scales every size in the window, the way ModeWidget's own `k`
              scales the three heroes (14.09). k = 1 is the shipped drawing.
    `air`     where the leftover height goes:
                'one'    all of it in one Spacer above the foot row — what
                         ships today, and the gap she photographed.
                'shared' split evenly between the three seams (under the
                         title bar, under the top row, above the foot).
    `spread`  the cover and the cluster run to the window's full width, so
              the cluster's right edge meets the fields' right edge. False
              leaves the shipped 10pt gap and therefore the dead column.
    """
    tw, th = tile

    def z(x):
        return x * k

    bar, top_pad, bot_pad, foot_h = z(36), z(8), z(10), z(20)
    cover, clust_w = z(cover_pt), z(cluster_pt)
    fh, fgap = z(field_h_pt), z(field_gap_pt)
    fields_h = 4 * fh + 3 * fgap
    gap1 = z(10)

    # The width: the content row is spread to meet the fields' right edge, or
    # left at its shipped gap so the dead column shows.
    inner_w = tw - 2 * z(12)
    gap_cc = (inner_w - cover - clust_w) if spread else z(10)

    # The height: what is left after every fixed block.
    used = bar + top_pad + cover + gap1 + fields_h + foot_h + bot_pad
    if used > th + 0.5:
        raise SystemExit(
            f'overflow: {used:.0f}pt of content in a {th}pt tile '
            f'(k={k:.3f}, cover={cover_pt}, field {field_h_pt}+{field_gap_pt}). '
            f'The window clips, so the drawing would look fine and be false.')
    slack = th - used
    if air == 'shared':
        e = slack / 3
        top_pad, gap1, gap2 = top_pad + e, gap1 + e, e
    else:
        gap2 = slack

    all_rows = (('Artist:', 'P!nk'), ('Track:', 'Who Knew - Edit'),
                ('Station:', 'Party &middot; 730 AM'), ('Mode:', 'CD'))
    fields = ''.join(
        field(c, v, h_pt=field_h_pt * k, cap_pt=cap_pt * k, val_pt=val_pt * k,
              cap_w_pt=cap_w_pt * k)
        + (f'<div style="height:{P(fgap)}px;"></div>' if i < 3 else '')
        for i, (c, v) in enumerate(all_rows))
    pic = (f'<div class=dn style="width:{P(cover)}px;height:{P(cover)}px;flex:none;'
           f'padding:{P(z(3))}px;"><img src="data:image/jpeg;base64,{ART}" '
           f'style="width:100%;height:100%;object-fit:cover;display:block;"></div>')

    return f"""
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#1b1f28,#0a0c11);"></div>
  <div class=up style="position:absolute;inset:0;overflow:hidden;
      display:flex;flex-direction:column;">
    {titlebar(title_pt * k, 36 * k)}
    <div style="padding:{P(top_pad)}px {P(z(12))}px {P(bot_pad)}px;flex:1;
        display:flex;flex-direction:column;min-height:0;">
      <div style="display:flex;gap:{P(gap_cc)}px;">{pic}{cluster(clust, k * cluster_pt / 180)}</div>
      <div style="height:{P(gap1)}px;"></div>
      {fields}
      <div style="height:{P(gap2)}px;"></div>
      {lastplayed(label_pt=12 * k, time_pt=15 * k)}
    </div>
  </div>"""


def fit(tile):
    """ONE SCALE FOR BOTH AXES, which is ModeWidget's own rule (`k =
    min(width, height) / 158`). Taking the smaller of the two ratios means
    nothing is ever stretched — a square cover stays square — and the tile
    it was drawn for comes back at exactly k = 1."""
    return min(tile[0] / BASE_W, tile[1] / BASE_H)


BIG, MID, SML = TILES['B'], TILES['M'], TILES['S']
TAG = 'LAST PLAYED &middot; large, on a Pro Max (364 x 382)'

# THE WHOLE CHOICE IS ONE NUMBER: 36 spare points, and how many go to SIZE
# rather than to AIR. B spends them all on air, C all on size, D splits it.
K_D = min(fit(BIG), 1.04)

A_ = BT.slot(TAG, 'A &mdash; what you have now',
             window(BIG, k=1, air='one', spread=False),
             'lB', note='Every size in this window is a fixed number of points, chosen for a '
                        '338 x 354 tile. On this phone the same content leaves <b>36pt dead '
                        'above LAST PLAYED</b> and <b>26pt dead down the right</b> &mdash; '
                        'the gap at the foot and the crowding at the top, from one cause.')

B_ = BT.slot(TAG, 'B &mdash; all of it as air',
             window(BIG, k=1, air='shared'),
             'lB', note='Nothing changes size. The 36pt is split between the three seams &mdash; '
                        'under the title bar, under the picture, above LAST PLAYED &mdash; so '
                        'each gets <b>12pt</b>, and the picture and keys spread to meet the '
                        'fields&rsquo; right edge. Roomiest of the three, but it cannot be the '
                        'whole answer: on the smallest phone this same content is 1pt TALLER '
                        'than the tile, so something there still has to squeeze.')

C_ = BT.slot(TAG, 'C &mdash; all of it as size',
             window(BIG, k=fit(BIG), air='shared'),
             'lB', note=f'Every size becomes a share of the tile instead of a number of points, '
                        f'so here the whole window is <b>{fit(BIG)*100-100:.0f}% bigger</b>: '
                        f'picture {124*fit(BIG):.0f} square, rows {30*fit(BIG):.0f} tall, '
                        f'values {16*fit(BIG):.0f}pt. {382-346*fit(BIG):.0f}pt of air left, so '
                        f'the gaps stay as tight as they are today. This is what the Mode tile '
                        f'already does, and it is the only option that also fits the smallest '
                        f'phone.')

D_ = BT.slot(TAG, 'D &mdash; some of each (recommended)',
             window(BIG, k=K_D, air='shared'),
             'lB', note=f'Grows {K_D*100-100:.0f}% and keeps <b>{382-346*K_D:.0f}pt as air</b>, '
                        f'{(382-346*K_D)/3:.0f}pt at each seam. Bigger where it matters and '
                        f'space between the blocks &mdash; both halves of your note &mdash; '
                        f'and it still scales down properly on a smaller phone.')

ROW2 = 'The same drawing, D, on all three phones'
S_ = BT.slot(ROW2, 'smallest &mdash; 329 x 345 (SE, 13 mini)',
             window(SML, k=min(fit(SML), 1.04), air='shared'),
             'lS', note=f'k = {fit(SML):.3f}, so everything comes down a little &mdash; which '
                        f'it has to: today&rsquo;s fixed 346pt of content is 1pt taller than '
                        f'this tile.')

M_ = BT.slot(ROW2, 'the one it was drawn for &mdash; 338 x 354',
             window(MID, k=1.0, air='shared'),
             'lM', note='k = 1.000, i.e. exactly the sizes signed off on 25.09, with the 8pt of '
                        'slack shared between the seams instead of all sitting at the foot.')

B2_ = BT.slot(ROW2, 'biggest &mdash; 364 x 382 (Pro Max)',
              window(BIG, k=K_D, air='shared'),
              'lB', note=f'k = {K_D:.3f}. One design at every size, which is the claim the Look '
                         f'row makes when it offers you a large tile.')


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The big CD window &mdash; spacing it out',
                  'Owner, 26.09, with the big tile on her Home Screen: "Love the widgets! But '
                  'at the moment it&rsquo;s looking a bit compressed at the top leaving an '
                  'awkward gap at the bottom. Can we space them out and show me some '
                  'drawings" <br>'
                  '<b>COUNTED FIRST, AND IT IS ONE FAULT.</b> Every size in this window is a '
                  'fixed number of points, and they add to 346 tall by 338 wide &mdash; the '
                  'large tile on a 393-wide phone, exactly. iOS hands a large widget a '
                  'different box on every screen, so on a Pro Max (364 x 382) that same '
                  'content leaves 36pt dead at the foot and 26pt dead down the right. It all '
                  'collects at the foot because the stack is pinned to the top, which is how '
                  '25.09 removed a strip ABOVE the title bar &mdash; so re-centring would just '
                  'put that strip back. <br>'
                  '<b>SO THE CHOICE IS ONE NUMBER:</b> of those 36 spare points, how many go '
                  'to making things BIGGER and how many to putting AIR between them. B spends '
                  'them all on air, C all on size, D splits it. The second row is D on all '
                  'three real phones.')
        + f'<div class=row>{A_}{B_}{C_}{D_}</div>'
        + f'<div class=row>{S_}{M_}{B2_}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
