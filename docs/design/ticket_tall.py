"""
THE BIG TICKET STUB — a bigger cover, the song against the tear, and a
barcode that reads as lines.

Owner, 2026-09-26, with a screenshot of the large stub on her Home Screen:

  "Is there any way to enlarge the album cover. Drag the song title and
   artist name closer to the dotted line. And shorten the barcode? The
   barcode lines should also compress — it must look like lines rather than
   a barcode. Also, make the barcode sit to the right bottom corner."

────────────────────────────────────────────────────────────────────────────
THE FIRST TWO ASKS ARE ONE FAULT, AND IT IS THE CD WINDOW'S FAULT AGAIN IN A
DIFFERENT PLACE. That round found a VStack shorter than its tile, so SwiftUI
centred it and split the slack above and below. Here the stack carries an
explicit `Spacer(minLength: 8)` between the song and the tear — and because
every other block is a fixed height, that spacer is where ALL the tile's
leftover room goes. Counted against the shipped numbers, with a one-line
title:

  banner 38 + air 14 + cover 110 + air 14 + song 64
    + tear 13 + counterfoil 56  =  309 of 354

...so the spacer is 45pt tall. That is the dead band in her screenshot, and
it sits in exactly the place she is pointing at. Closing it and handing the
room to the cover answers both asks with one change.

AND THE TITLE HAS TO DROP TO ONE LINE FOR THE COVER TO GROW AT ALL. It is
`lineLimit(2)` today, so a two-line title costs another 29pt — which means
the cover could only reach 126 before a long song name pushed the counterfoil
off the tile. The MEDIUM stub already sets the title `lineLimit(1)` with
`minimumScaleFactor(0.6)`, so a long title shrinks rather than wraps; taking
the same rule here is what buys the picture its 40-60pt.

THE BARCODE IS LONG BECAUSE IT WAS TOLD TO FILL. Its bars sit in an HStack
with FLEXIBLE spacers beside a `Spacer(minLength: 8)`, so it takes whatever
width the station's name leaves — roughly 180pt. 26 bars at 2-3pt wide with
two different heights is a real barcode's own proportions, which is precisely
why it reads as one. Fixed width, hairline bars, one height: lines.

  (The medium ticket needed 46 bars to read as printed at all — 10.09 — which
   is the same finding from the other end: a barcode has to be long. So the
   honest move here is to stop drawing a barcode and draw a rule of lines.)

DRAWN AT 2px PER POINT through P(), so a number in this file can be compared
with the Swift by eye. Same rule as cd_window_tall.py, and for the same
reason: on 25.09 this family of harness was found under-drawing type by 30%,
which would have made the question unanswerable.

RUN:
  OUT=<scratch>/tkt.html python3 docs/design/ticket_tall.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/tkt.html OUT=<scratch>/tkt.png node docs/design/shot4.mjs
"""
import os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'ticket_tall.html')
# big_tiles writes its own sheet at import, and v3 writes one at ITS import.
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.tkt-throwaway.html')
import big_tiles as BT                      # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

from assets import A                        # noqa: E402

# The notes are long, and a slot with no width cap stretches to fit them —
# which pushed the four tiles onto four rows and made the comparison useless.
CSS = BT.CSS + """
.slot { max-width: 676px; }
.note { max-width: 676px; }
"""
ART = A['coastal']

# The ticket's own palette, read straight out of LastPlayedWidget.swift.
PAPER, PAPER_DEEP, INK = '#F7F3E9', '#E9E3D4', '#1B1F27'


def P(pt):
    """1 point = 2 pixels. The large tile is 338x354pt and is drawn 676x708."""
    return pt * 2


# ── the parts ──────────────────────────────────────────────────────────────

def banner(h_pt=38):
    """CRUISE FM on the left, the dial on the right, ink ground. Unchanged —
    she did not name it and it is the one block with nothing spare in it."""
    return f"""
    <div style="height:{P(h_pt)}px;background:{INK};flex:none;
        display:flex;align-items:center;justify-content:space-between;
        padding:0 {P(16)}px;">
      <span style="color:#fff;font-size:{P(11)}px;font-weight:800;
          letter-spacing:{P(1.6)}px;">CRUISE FM</span>
      <span style="display:flex;align-items:baseline;gap:{P(3)}px;">
        <span class=seg style="font-size:{P(15)}px;color:#FF9A2E;">94.70</span>
        <span class=seg14 style="font-size:{P(9)}px;color:#FF9A2E;">FM</span>
      </span>
    </div>"""


def cover(h_pt, *, side_pt, top_pt):
    """The album cover. `side_pt` 0 runs it to the tile's own edges.

    h_pt IS THE PICTURE, not the block: the Swift applies `.frame(height:)`
    BEFORE `.padding(.top:)`, so the block is h_pt + top_pt. Drawing the
    padding inside the height instead made every option here ~14pt shorter
    than the number beside it, which is the harness-fidelity fault this file's
    own header warns about."""
    return (f'<div style="flex:none;overflow:hidden;'
            f'padding:{P(top_pt)}px {P(side_pt)}px 0;">'
            f'<img src="data:image/jpeg;base64,{ART}" style="width:100%;'
            f'height:{P(h_pt)}px;object-fit:cover;display:block;">'
            f'</div>')


def song(*, top_pt, eb_pt, title_pt, artist_pt, gap_pt):
    return f"""
    <div style="flex:none;padding:{P(top_pt)}px {P(15)}px 0;">
      <div class=eb style="font-size:{P(eb_pt)}px;color:rgba(27,31,39,.45);
          font-family:ui-monospace,monospace;letter-spacing:{P(1.6)}px;">LAST PLAYED</div>
      <div style="font-size:{P(title_pt)}px;font-weight:800;color:{INK};
          margin-top:{P(gap_pt)}px;line-height:1.08;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis;">Heart&rsquo;s All Gone</div>
      <div style="font-size:{P(artist_pt)}px;color:rgba(27,31,39,.62);
          margin-top:{P(gap_pt)}px;">blink-182</div>
    </div>"""


def tear(h_pt=13):
    """Dashes across, with a notch hanging half off each edge. Real dashes
    rather than a masked rule — the reason is in the Swift."""
    dash = (f'<div style="width:{P(6)}px;height:{P(1)}px;'
            f'background:rgba(27,31,39,.30);flex:none;"></div>')
    notch = (f'<div style="width:{P(13)}px;height:{P(13)}px;border-radius:50%;'
             f'background:rgba(0,0,0,.30);position:absolute;top:50%;'
             f'transform:translateY(-50%);"></div>')
    return f"""
    <div style="height:{P(h_pt)}px;flex:none;position:relative;
        display:flex;align-items:center;justify-content:space-between;
        padding:0 {P(4)}px;">
      {notch.replace('position:absolute;', 'position:absolute;left:' + str(P(-6.5)) + 'px;')}
      {''.join(dash for _ in range(24))}
      {notch.replace('position:absolute;', 'position:absolute;right:' + str(P(-6.5)) + 'px;')}
    </div>"""


def barcode(*, bars, w_pt, gap_pt, h_pt, two_heights):
    """`two_heights` is what makes it read as a BARCODE rather than as lines:
    a real code varies its bar heights at the guard bars. Off, and the same
    marks read as a printed rule."""
    out = []
    for i in range(bars):
        h = h_pt if not two_heights else (h_pt - 8 if i % 4 == 0 else h_pt)
        w = w_pt if not two_heights else (w_pt + 1 if i % 3 == 0 else w_pt)
        out.append(f'<div style="width:{P(w)}px;height:{P(h)}px;background:{INK};'
                   f'flex:none;"></div>')
    return (f'<div style="display:flex;align-items:flex-end;gap:{P(gap_pt)}px;'
            f'height:{P(h_pt)}px;flex:none;">{"".join(out)}</div>')


def counterfoil(*, top_pt, bot_pt, name_pt, code, align):
    """STATION / name on the left, the code on the right.

    `align` 'baseline' is what ships (the code's foot sits on the name's), and
    'corner' drops it into the tile's own bottom-right instead, which is what
    she asked for."""
    left = f"""
      <div style="min-width:0;">
        <div style="font-size:{P(8)}px;font-family:ui-monospace,monospace;
            letter-spacing:{P(1.6)}px;color:rgba(27,31,39,.45);">STATION</div>
        <div style="font-size:{P(name_pt)}px;font-weight:800;color:{INK};
            margin-top:{P(2)}px;white-space:nowrap;">Coastal FM</div>
      </div>"""
    return f"""
    <div style="flex:1;min-height:0;display:flex;align-items:flex-end;
        justify-content:space-between;
        padding:{P(top_pt)}px {P(15)}px {P(bot_pt)}px;">
      {left}
      <div style="display:flex;align-items:flex-end;{'' if align=='corner' else 'align-self:flex-end;'}">{code}</div>
    </div>"""


def ticket(*, cover_pt, cover_side_pt, cover_top_pt, song_top_pt, title_pt,
           artist_pt, eb_pt, gap_pt, slack_pt, cf_top_pt, cf_bot_pt,
           name_pt, code, two_line_ghost=False):
    spacer = (f'<div style="height:{P(slack_pt)}px;flex:none;"></div>'
              if slack_pt else '<div style="flex:0 0 0;"></div>')
    return f"""
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;
      background:linear-gradient(180deg,{PAPER},{PAPER_DEEP});">
    {banner()}
    {cover(cover_pt, side_pt=cover_side_pt, top_pt=cover_top_pt)}
    {song(top_pt=song_top_pt, eb_pt=eb_pt, title_pt=title_pt,
          artist_pt=artist_pt, gap_pt=gap_pt)}
    {spacer}
    {tear()}
    {counterfoil(top_pt=cf_top_pt, bot_pt=cf_bot_pt, name_pt=name_pt,
                 code=code, align='corner')}
  </div>"""


# ── the codes ──────────────────────────────────────────────────────────────
TODAY_CODE = barcode(bars=26, w_pt=2, gap_pt=0.5, h_pt=30, two_heights=True)
LINES_B    = barcode(bars=20, w_pt=1.5, gap_pt=1.5, h_pt=18, two_heights=False)
LINES_C    = barcode(bars=28, w_pt=1, gap_pt=1, h_pt=15, two_heights=False)
LINES_D    = barcode(bars=16, w_pt=2, gap_pt=2, h_pt=20, two_heights=False)


A_ = BT.slot('TICKET STUB &middot; large', 'A &mdash; build 69, what you have',
             ticket(cover_pt=110, cover_side_pt=14, cover_top_pt=14,
                    song_top_pt=14, title_pt=24, artist_pt=15, eb_pt=8.5,
                    gap_pt=3, slack_pt=45, cf_top_pt=12, cf_bot_pt=14,
                    name_pt=17, code=TODAY_CODE),
             'l', note='The 45pt of nothing between the artist line and the tear is a '
                       'Spacer &mdash; every other block is a fixed height, so all the tile&rsquo;s '
                       'leftover room lands there. The code is 26 bars told to FILL the row.')

B_ = BT.slot('TICKET STUB &middot; large', 'B &mdash; the slack goes to the cover',
             ticket(cover_pt=150, cover_side_pt=14, cover_top_pt=14,
                    song_top_pt=14, title_pt=24, artist_pt=15, eb_pt=8.5,
                    gap_pt=3, slack_pt=0, cf_top_pt=12, cf_bot_pt=12,
                    name_pt=17, code=LINES_B),
             'l', note='Spacer closed, so the song sits straight on the tear, and the 40pt '
                       'goes to the picture (110 &rarr; 150). Code fixed at 20 hairlines, one '
                       'height, in the corner. Nothing else moves.')

C_ = BT.slot('TICKET STUB &middot; large', 'C 'C &mdash; bigger picture, tighter foot'mdash; bigger picture, tighter foot (CHOSEN, shipped 26.09)',
             ticket(cover_pt=168, cover_side_pt=12, cover_top_pt=12,
                    song_top_pt=11, title_pt=22, artist_pt=14, eb_pt=8,
                    gap_pt=2, slack_pt=0, cf_top_pt=10, cf_bot_pt=11,
                    name_pt=16, code=LINES_C),
             'l', note='The song block and the counterfoil each give up a few points too, so '
                       'the picture reaches 168 &mdash; half the tile. The code is 28 finer '
                       'lines at one height, which is as far from a barcode as it goes.')

D_ = BT.slot('TICKET STUB &middot; large', 'D &mdash; the picture runs to the edges',
             ticket(cover_pt=166, cover_side_pt=0, cover_top_pt=0,
                    song_top_pt=14, title_pt=24, artist_pt=15, eb_pt=8.5,
                    gap_pt=3, slack_pt=0, cf_top_pt=12, cf_bot_pt=12,
                    name_pt=17, code=LINES_D),
             'l', note='No border round the picture at all &mdash; it runs edge to edge under '
                       'the banner, the way the CD window now runs to its own tile. Same song '
                       'block and foot as B; 16 wider lines in the corner.')


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The big ticket stub &mdash; a bigger cover, and lines instead of a barcode',
                  'Owner, 26.09: "Is there any way to enlarge the album cover. Drag the song '
                  'title and artist name closer to the dotted line. And shorten the barcode? '
                  'The barcode lines should also compress &mdash; it must look like lines '
                  'rather than a barcode. Also, make the barcode sit to the right bottom '
                  'corner." <br>'
                  'The first two asks are the same fault: a Spacer between the artist line and '
                  'the tear is where all 45 spare points of the tile end up, so closing it '
                  'pulls the song down AND hands the room to the picture. The title also drops '
                  'to one line (shrinking rather than wrapping, as the medium stub already '
                  'does) &mdash; without that a long song name would push the counterfoil off '
                  'the tile and the cover could not grow past 126. B, C and D spend the '
                  'reclaimed room three different ways.')
        + f'<div class=row>{A_}{B_}{C_}{D_}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
