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
# WIDGETKIT HANDS A LARGE TILE A DIFFERENT BOX ON EVERY SCREEN, and this
# harness drew only 338x354 — the one size where the shipped arithmetic comes
# out exact. A harness that cannot draw the size being asked about will answer
# confidently and be wrong, which is the fault this file's own header warns
# about and which it then committed anyway.
TILES = {
    'S': (329, 345),   # 375x812  — SE 3rd gen, 13 mini
    'M': (338, 354),   # 390x844 / 393x852 — the size the Swift was drawn for
    'B': (364, 382),   # 428x926 / 430x932 — Pro Max, and hers
}
CSS = BT.CSS + """
.slot { max-width: 760px; }
.note { max-width: 760px; }
""" + ''.join(
    f'.l{n} {{ width:{w * 2}px; height:{h * 2}px; }}' for n, (w, h) in TILES.items())
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
# SHIPPED 26.09: 28 hairlines, one width, one height, a fixed 1pt gap. 55x15.
LINES_C    = barcode(bars=28, w_pt=1, gap_pt=1, h_pt=15, two_heights=False)
# "a bit small, try to make it more bigger but not huge" (owner, 26.09). A
# UNIFORM 1.5x of what she approved: same 28 marks, same 1:1 bar-to-gap, so
# the character she picked is untouched and only the size moves. 82.5x22.
LINES_BIG  = barcode(bars=28, w_pt=1.5, gap_pt=1.5, h_pt=22, two_heights=False)
# Drawn to show where "huge" starts: 2x, and it begins to own the foot.
LINES_2X   = barcode(bars=28, w_pt=2, gap_pt=2, h_pt=30, two_heights=False)


# ── the arithmetic, stated rather than eyeballed ───────────────────────────
# Every block but the cover is a fixed height, and they add to FIXED. So on a
# tile TALLER than 354 the leftover has to land somewhere, and today it lands
# in the Spacer between the artist line and the tear — which is the one place
# it is most visible and the one place she is pointing at.
FIXED = 38 + 12 + 11 + 57 + 13 + (10 + 31 + 11)   # = 183
SHIPPED_COVER = 168


def sums(tile, cover_pt):
    w, h = tile
    used = FIXED + cover_pt
    return used, h - used


def label(tile, cover_pt, *, slack_goes):
    used, left = sums(tile, cover_pt)
    return (f'{tile[0]}x{tile[1]}pt &middot; cover {cover_pt} &middot; '
            f'{used} of {tile[1]} used &middot; {left}pt {slack_goes}')


# ══════════════ ROW 1 — what she is looking at, at three sizes ═════════════
row1 = ''.join(
    BT.slot('TICKET STUB &middot; large', f'TODAY &mdash; {n} ({w}x{h})',
            ticket(cover_pt=SHIPPED_COVER, cover_side_pt=12, cover_top_pt=12,
                   song_top_pt=11, title_pt=22, artist_pt=14, eb_pt=8,
                   gap_pt=2, slack_pt=max(0, h - FIXED - SHIPPED_COVER),
                   cf_top_pt=10, cf_bot_pt=11, name_pt=16, code=LINES_C),
            f'l{n}',
            note=label((w, h), SHIPPED_COVER, slack_goes='into the Spacer'))
    for n, (w, h) in TILES.items())

# ══════════════ ROW 2 — the cover takes the slack instead ══════════════════
# The Spacer goes and the COVER becomes the flexible block, so the song sits a
# fixed 10pt above the tear at every size and the picture absorbs whatever the
# tile has spare. On the small tile that runs the other way and the picture
# gives 6pt back, which is the block that should compress.
row2 = ''.join(
    BT.slot('TICKET STUB &middot; large', f'FIX &mdash; {n} ({w}x{h})',
            ticket(cover_pt=h - FIXED, cover_side_pt=12, cover_top_pt=12,
                   song_top_pt=11, title_pt=22, artist_pt=14, eb_pt=8,
                   gap_pt=2, slack_pt=10, cf_top_pt=10, cf_bot_pt=11,
                   name_pt=16, code=LINES_BIG),
            f'l{n}',
            note=label((w, h), h - FIXED, slack_goes='left over'))
    for n, (w, h) in TILES.items())

# ══════════════ ROW 3 — how big the code should be ═════════════════════════
def code_slot(name, code, note):
    return BT.slot('COUNTERFOIL &middot; detail', name,
                   f'<div style="position:absolute;inset:0;display:flex;'
                   f'flex-direction:column;justify-content:flex-end;'
                   f'background:linear-gradient(180deg,{PAPER},{PAPER_DEEP});">'
                   f'{tear()}'
                   f'{counterfoil(top_pt=10, bot_pt=11, name_pt=16, code=code, align="corner")}'
                   f'</div>', 'lS', note=note)


row3 = (code_slot('CODE &mdash; 55x15, shipped', LINES_C,
                  '28 hairlines at 1pt with a 1pt gap. What you have.')
        + code_slot('CODE &mdash; 82x22, proposed', LINES_BIG,
                    'The same 28 marks and the same 1:1 bar-to-gap, drawn 1.5x. '
                    'Half again as wide and half again as tall; still one width and '
                    'one height, so it still reads as a rule of lines.')
        + code_slot('CODE &mdash; 110x30, too far', LINES_2X,
                    '2x. It starts to own the foot of the ticket and crowd the '
                    'station&rsquo;s name, which is what &ldquo;huge&rdquo; would look like.'))


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The big ticket stub &mdash; the song against the tear, a bigger cover, '
                  'and a bigger code',
                  'Owner, 26.09: "The ticket stub text needs the text to move closer to the '
                  'bottom so there&rsquo;s more space for the album cover. The barcode is '
                  'looking a bit small, try to make it more bigger but not huge." <br>'
                  'ROW 1 is what ships, drawn at the three sizes WidgetKit actually hands a '
                  'large tile. Every block but the cover is a fixed number of points and they '
                  'add to 183, so at 338x354 the stack is 351 of 354 and looks right &mdash; '
                  'but her phone&rsquo;s tile is 364x382, where 31 spare points all land in '
                  'the one flexible gap, which sits between the artist line and the tear. '
                  'ROW 2 makes the COVER the flexible block instead: the song then sits a '
                  'fixed 10pt above the tear at every size and the picture takes the room. '
                  'ROW 3 sizes the code.')
        + f'<div class=row>{row1}</div>'
        + f'<div class=row>{row2}</div>'
        + f'<div class=row>{row3}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
