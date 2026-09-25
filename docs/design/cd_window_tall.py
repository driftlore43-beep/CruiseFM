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

CSS = BT.CSS
ART = A['coastal']

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


def cluster(kind):
    """The share card's own right-hand block, in three arrangements.

    'three'  what ships today: a disc and three keys, which is most of the
             empty space she is pointing at.
    'wide'   180 x 124, beside a 124 cover — her whole crop, in one strip of
             CD/deck/volume and two rows of keys.
    'tall'   148 x 156, bought by dropping the Mode field. Every part grows
             and the volume gets a row of its own.
    """
    if kind == 'three':
        return (f'<div style="width:{P(180)}px;height:{P(124)}px;display:flex;'
                f'flex-direction:column;align-items:center;justify-content:space-between;">'
                f'{cd_glyph(23)}{keyrow(("prev","play","next"),(21,21,21),15,3)}</div>')
    if kind == 'wide':
        top = (f'<div style="display:flex;gap:{P(7)}px;align-items:center;height:{P(44)}px;">'
               f'{cd_glyph(40)}{deck_glyph(80, 40)}{volume(46, 40)}</div>')
        rows = [top,
                keyrow(('pause', 'shuffle', 'repeat'), (88, 41, 41), 30, 5),
                keyrow(('prev', 'rew', 'ff', 'next', 'heart'), (32,) * 5, 32, 5)]
        w, h = 180, 124
    else:
        top = (f'<div style="display:flex;gap:{P(8)}px;align-items:center;height:{P(46)}px;">'
               f'{cd_glyph(46)}{deck_glyph(94, 46)}</div>')
        rows = [top,
                volume(148, 34),
                keyrow(('pause', 'shuffle', 'repeat'), (62, 41, 41), 32, 2),
                keyrow(('prev', 'rew', 'ff', 'next', 'heart'), (26,) * 5, 32, 4)]
        w, h = 148, 156
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

def window(*, fill, top, cover_pt, clust, rows, foot, top_pad,
           title_pt, cap_pt, val_pt, field_h_pt, cap_w_pt):
    """One drawing, a handful of switches, so the prototypes cannot drift.

    `fill`  the window runs to the tile's own edge rather than sitting on a
            border of room (owner, 25.09: "could we make the Winamp take up
            the black border surroundings?").
    `top`   the title bar is pinned to the top rather than floating in a
            centred stack. NOT a taste: the stack is SHORTER than the tile,
            so SwiftUI centres it — which is the strip of window above the
            title bar AND the gap below the last field, i.e. two of her
            complaints from one cause.
    `rows`  which fields are printed. Dropping Mode buys 36pt, which is what
            lets every part of the cluster grow in D.
    """
    inset = 0 if fill else P(13)
    justify = 'flex-start' if top else 'center'
    all_rows = (('Artist:', 'Oasis'), ('Track:', 'Champagne Supernova'),
                ('Station:', 'Calm &middot; 940 AM'), ('Mode:', 'CD'))
    fields = ''.join(
        field(c, v, h_pt=field_h_pt, cap_pt=cap_pt, val_pt=val_pt, cap_w_pt=cap_w_pt)
        + f'<div style="height:{P(6)}px;"></div>'
        for c, v in all_rows[:rows])
    cover = (f'<div class=dn style="width:{P(cover_pt)}px;height:{P(cover_pt)}px;flex:none;'
             f'padding:{P(3)}px;"><img src="data:image/jpeg;base64,{ART}" '
             f'style="width:100%;height:100%;object-fit:cover;display:block;"></div>')

    return f"""
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#1b1f28,#0a0c11);"></div>
  <div style="position:absolute;inset:0;background:
      radial-gradient(circle at 50% 88%,rgba(106,208,255,.26),transparent 64%);"></div>
  <div class=up style="position:absolute;inset:{inset}px;padding:0;overflow:hidden;
      display:flex;flex-direction:column;justify-content:{justify};">
    {titlebar(title_pt)}
    <div style="padding:{P(top_pad)}px {P(12)}px {P(10)}px;flex:1;display:flex;
        flex-direction:column;min-height:0;">
      <div style="display:flex;gap:{P(10)}px;">
        {cover}
        {cluster(clust)}
      </div>
      <div style="height:{P(10)}px;"></div>
      {fields}
      <div style="flex:1;min-height:0;"></div>
      {foot}
    </div>
  </div>"""


TODAY = dict(title_pt=15, cap_pt=11, val_pt=12, field_h_pt=26, cap_w_pt=52)
BIGGER = dict(title_pt=19, cap_pt=14, val_pt=16, field_h_pt=30, cap_w_pt=64)
BIGGEST = dict(title_pt=19, cap_pt=15, val_pt=17, field_h_pt=32, cap_w_pt=68)

A_ = BT.slot('LAST PLAYED &middot; large', 'A &mdash; build 69, what you have',
             window(fill=False, top=False, cover_pt=120, clust='three', rows=4,
                    foot='', top_pad=8, **TODAY),
             'l', note='The window floats on a border and the stack is centred &mdash; which is '
                       'the strip above the title bar AND the gap at the foot. Title 15pt, '
                       'captions 11pt, values 12pt.')

B_ = BT.slot('LAST PLAYED &middot; large', 'B &mdash; layout fixed, type stepped up',
             window(fill=True, top=True, cover_pt=124, clust='three', rows=4,
                    foot=lastplayed(), top_pad=8, **BIGGER),
             'l', note='Window to the tile&rsquo;s own edge, bar pinned to the top, and the '
                       'type sized off the box: title 19pt, captions 14pt, values 16pt. '
                       'Nothing else added &mdash; so the space beside the cover is still empty.')

C_ = BT.slot('LAST PLAYED &middot; large', 'C &mdash; + the whole cluster, all four fields',
             window(fill=True, top=True, cover_pt=124, clust='wide', rows=4,
                    foot=lastplayed(), top_pad=8, **BIGGER),
             'l', note='Her card&rsquo;s full right-hand block: CD, tape deck, volume, then '
                       'pause/shuffle/repeat and prev/rew/ff/next/heart. Everything she asked '
                       'for, and the fields keep their full width.')

D_ = BT.slot('LAST PLAYED &middot; large', 'D &mdash; bigger everything, Mode dropped',
             window(fill=True, top=True, cover_pt=156, clust='tall', rows=3,
                    foot=lastplayed(), top_pad=6, **BIGGEST),
             'l', note='Mode comes off &mdash; the tile already draws the CD &mdash; and its '
                       '36pt goes to the cover (156 square) and the cluster, so the volume '
                       'gets a row of its own and every key grows.')


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The big CD player &mdash; filling it, and sizing the type',
                  'Owner, 25.09: "Leave the progress bar out then and keep &lsquo;last '
                  'played&rsquo;. I want to have these contents on the right hand side. The '
                  'designs are still missing a lot of details &mdash; there&rsquo;s too much '
                  'empty space. Lastly the texts needs to scale larger." <br>'
                  'The type was never scaled for this tile at all: the title bar and the '
                  'fields are shared with the medium window, so they set at 15/11/12pt on a '
                  'tile whose value boxes are nearly twice as wide and which carries four '
                  'rows instead of two. B is that fixed and the two layout faults with it; '
                  'C and D then spend the reclaimed room on her cluster two different ways. '
                  'The volume well is drawn EMPTY and there is no scrub bar &mdash; both for '
                  'the same reason she gave.')
        + f'<div class=row>{A_}{B_}{C_}{D_}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
