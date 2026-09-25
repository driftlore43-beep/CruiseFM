"""
THE BIG CD PLAYER, REDRAWN AS A FULL WINDOW.

Owner, 2026-09-24, with a photograph of the shipped large tile beside the
app's own Y2K SHARE CARD: "can we change the 'CD player' to a larger Winamp
like the share cards the app delivers".

THIS REVERSES THE 24.09 DECISION, ON HER OWN INSTRUCTION AND WITH BETTER
EVIDENCE. That round argued a Winamp window is a wide, short thing, so the
honest tall version is the window plus a record shelf under it rather than
the window stretched — and it spent roughly 60% of the tile's height on a
disc in a lit room. She has now seen it on a real phone next to the share
card, and the share card plainly reads more like a player: it fills its
frame with WINDOW, and the extra room goes into more of the dialog rather
than into a bigger object beside it.

THE REASON THE OLD ARGUMENT WAS WRONG IS THAT IT ONLY EVER OFFERED ONE WAY
TO SPEND HEIGHT. A window does not have to stretch its existing rows to
grow; it can carry MORE ROWS, which is exactly what the share card does —
the cover and the controls share the top, and four labelled fields run the
full width underneath. That is a genuinely taller dialog rather than a
short one pulled out of shape, and it is the arrangement drawn here.

────────────────────────────────────────────────────────────────────────────
THREE THINGS ON THE SHARE CARD CANNOT COME ACROSS, and every one of them is
this app's own honesty rule rather than a drawing problem.

  THE SCRUB BAR (0:24 ──────── 5:27). A widget is redrawn a handful of
  times a day, so it cannot know where a song is up to — that is precisely
  why this tile says LAST PLAYED and never NOW PLAYING. The Y2K share card
  itself had its own decorative bar taken to zero on 12.08 for the same
  reason: "the times either side read 0:00 and a bar sitting 42% along
  beside them says two different things at once."

  THE VOLUME (+ / − and the green level). We do not know the volume, and a
  level bar drawn at a guessed height is an invented readout.

  SHUFFLE, REPEAT AND THE HEART. All three are STATE, and drawing a state
  we cannot read is the same fault wearing three hats. (The app does know
  shuffle and repeat during a drive; the snapshot does not carry them, and
  a value from the last time the app ran would be stale by the time anyone
  looked.)

WHAT DOES COME ACROSS IS THE BEST PART OF HER CARD: the four labelled
fields. Artist, Track, Station and Mode are all real, all already in the
snapshot, and four full-width rows are the one thing the tall tile has the
room for and the wide one never will.

THE TRANSPORT STAYS AS ORNAMENT AND IS KEPT SMALL, which is the settled
rule for this target: the medium window already draws a play button that
does nothing, and the iPod's wheel is deliberately a plain unlabelled ring
"kept quiet rather than made the hero, so it cannot read as a control that
is broken" (03.09). Three buttons, not her card's eleven — at widget size
eleven is a row of grey smudges, and a wall of dead controls is the exact
thing that rule exists to avoid.

THE DEVICE ABOVE THEM IS THE ONE HONEST READOUT ADDED. Her card carries a
CD icon and a tape deck as decoration; here it is the station's CURRENT
MODE, drawn as the object that mode is, which the snapshot already knows.

────────────────────────────────────────────────────────────────────────────
COUNTED, NOT EYEBALLED. 338x354 at 13 of padding leaves 312x328.

  title bar          32
  air                10
  cover row         120   (cover 120 square, device + transport beside it)
  air                12
  four fields       125   (4 x 26, 3 x 7 between)
  bottom padding     12
  ───────────────────────
                    311 of 328, so 17 spare and nothing is compressed.

The right-hand cluster gets 288 − 120 − 11 = 157 wide, which takes three
42pt buttons with 6 between them (138) and leaves the device its own row.

DRAWN AT 2x, so 1px here is half a point — the same scale as big_tiles.py.

RUN:
  OUT=<scratch>/cdw.html python3 docs/design/cd_window_tall.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright-core/index.mjs \
    IN=<scratch>/cdw.html OUT=<scratch>/cdw.png node docs/design/shot4.mjs
"""
import os, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'cd_window_tall.html')
# big_tiles writes its own sheet at import, and v3 writes one at ITS import.
# Point OUT at a throwaway for both, then restore — the same dance big_tiles
# already does for v3.
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.cdw-throwaway.html')
import big_tiles as BT                      # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

from assets import A                        # noqa: E402

CSS = BT.CSS
ART = A['coastal']

# ── the parts, shared between the two drawings so neither can drift ─────────

def titlebar(px=17):
    return f"""
    <div style="height:38px;background:linear-gradient(90deg,#1d3f8f,#5f86d6);
        display:flex;align-items:center;padding:0 12px;justify-content:space-between;">
      <span class=px style="color:#fff;font-size:{px}px;">Cruise FM</span>
      <div style="display:flex;gap:5px;">
        {''.join(f'<div class=up style="width:24px;height:22px;display:flex;align-items:center;justify-content:center;"><span class=px style="font-size:11px;color:#1b1d22;">{c}</span></div>' for c in ('_', '[]', 'X'))}
      </div>
    </div>"""


def field(caption, value, arrow=True):
    """A labelled field. 52px of caption column = 26pt, measured the way the
    shipped one is: "Artist:" is the longest of the four."""
    tip = ('<div class=up style="width:34px;height:40px;margin:3px;display:flex;'
           'align-items:center;justify-content:center;"><span class=px '
           'style="font-size:13px;color:#1b1d22;">&#9660;</span></div>') if arrow else ''
    return f"""
    <div style="display:flex;align-items:center;gap:12px;height:52px;">
      <span class=px style="color:#1b1d22;font-size:15px;width:98px;flex:none;
          text-align:right;">{caption}</span>
      <div class=dn style="flex:1;min-width:0;height:52px;display:flex;
          align-items:center;justify-content:space-between;">
        <span class=px style="color:#000;font-size:17px;padding-left:12px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{value}</span>
        {tip}
      </div>
    </div>"""


def device(kind='cd'):
    """The current MODE as the object it is — the one readout the share card's
    CD-and-tape-deck decoration is replaced by."""
    if kind == 'cd':
        inner = """
      <div style="width:76px;height:76px;border-radius:50%;position:relative;
          background:conic-gradient(from 20deg,#bfe8ff,#d9c6ff,#ffd0e6,#ffe9c2,#c9ffe2,#bfe8ff);
          box-shadow:0 2px 5px rgba(0,0,0,.35);">
        <div style="position:absolute;inset:0;border-radius:50%;background:
            linear-gradient(125deg,rgba(255,255,255,.75) 6%,transparent 34%,
            transparent 66%,rgba(255,255,255,.45) 94%);"></div>
        <div style="position:absolute;inset:26px;border-radius:50%;
            background:#e6eaf0;box-shadow:inset 0 0 0 2px rgba(255,255,255,.7);"></div>
        <div style="position:absolute;inset:33px;border-radius:50%;background:#2b2f37;"></div>
      </div>"""
    else:
        inner = """
      <div class=up style="width:104px;height:64px;position:relative;">
        <div class=dn style="position:absolute;left:12px;right:12px;top:12px;height:26px;
            display:flex;align-items:center;justify-content:space-around;">
          <div style="width:14px;height:14px;border-radius:50%;background:#7d848e;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:#7d848e;"></div>
        </div>
      </div>"""
    return f"""<div style="height:88px;display:flex;align-items:center;
        justify-content:center;">{inner}</div>"""


def transport():
    """Three, not eleven. Ornament, and kept quiet — see the note at the top."""
    glyphs = ('&#9198;', '&#9654;', '&#9197;')
    btns = ''.join(
        f'<div class=up style="width:84px;height:56px;display:flex;align-items:center;'
        f'justify-content:center;"><span style="font-size:22px;color:#1b1d22;">{g}</span></div>'
        for g in glyphs)
    return f'<div style="display:flex;gap:12px;justify-content:center;">{btns}</div>'


# ── this round's extra parts ───────────────────────────────────────────────

def cd_glyph(d=64):
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


def deck_glyph(w=96, h=58):
    """The share card's little tape deck. Pure decoration, and honest as
    decoration — unlike a volume slider it asserts no value."""
    return f"""
      <div class=up style="width:{w}px;height:{h}px;position:relative;flex:none;">
        <div style="position:absolute;left:8px;top:9px;width:9px;height:9px;background:#c0392b;"></div>
        <div class=dn style="position:absolute;left:24px;right:8px;top:8px;height:22px;
            display:flex;align-items:center;justify-content:space-around;">
          <div style="width:9px;height:9px;border-radius:50%;background:#7d848e;"></div>
          <div style="width:9px;height:9px;border-radius:50%;background:#7d848e;"></div>
        </div>
        <div style="position:absolute;left:8px;right:8px;bottom:8px;height:12px;display:flex;gap:2px;">
          {''.join('<div class=up style="flex:1;"></div>' for _ in range(9))}
        </div>
      </div>"""


def keys(glyphs, w=58, h=44, fs=18):
    btns = ''.join(
        f'<div class=up style="width:{w}px;height:{h}px;display:flex;align-items:center;'
        f'justify-content:center;flex:none;"><span style="font-size:{fs}px;color:#1b1d22;">{g}</span></div>'
        for g in glyphs)
    return f'<div style="display:flex;gap:9px;">{btns}</div>'


def timerow(kind):
    """THE ROW THE SHARE CARD SPENDS ON A SCRUB BAR.

    A widget is redrawn a handful of times a day and CANNOT know where a song
    is up to — which is the whole reason this tile says LAST PLAYED. The
    snapshot carries no duration either, so neither number on the card's row
    is available. Three honest ways to use the same row:

      'when'   the one fact we do have. `LastPlayed.at` is a timestamp the
               app already stores; it is a statement about the PAST, which is
               what this tile trades in.
      'trough' the Winamp trough with NO handle and NO numbers: window
               furniture, asserting nothing.
      'none'   leave it out and give the height back.
    """
    if kind == 'none':
        return ''
    if kind == 'trough':
        return """
      <div style="display:flex;align-items:center;gap:12px;height:34px;">
        <div class=dn style="flex:1;height:26px;"></div>
      </div>"""
    return """
      <div style="display:flex;align-items:center;justify-content:space-between;height:34px;">
        <span class=px style="color:#1b1d22;font-size:13px;opacity:.62;">LAST PLAYED</span>
        <span class=px style="color:#1b1d22;font-size:15px;">1:04 pm</span>
      </div>"""


def window(*, fill, top, cover, rows, dev, time_kind, gap=14, pad=22):
    """One drawing, four switches, so the prototypes cannot drift apart.

    `fill`  the window runs to the tile's own edge rather than sitting on a
            border of room (owner, 25.09: "could we make the Winamp take up
            the black border surroundings?").
    `top`   the title bar is pinned to the top rather than floating in a
            centred stack (owner: "make sure the top bar sits at the very top
            not just as a strip"). That one is not a taste: the stack is
            SHORTER than the tile, so it centres, which is a strip of window
            above the title bar AND the empty space below the last field —
            the owner's two complaints from one cause.
    """
    inset = 0 if fill else 26
    justify = 'flex-start' if top else 'center'
    right = ''
    if dev == 'cd':
        right = f'<div style="display:flex;align-items:center;justify-content:center;">{cd_glyph(64)}</div>'
    elif dev == 'both':
        right = (f'<div style="display:flex;align-items:center;justify-content:space-between;">'
                 f'{cd_glyph(58)}{deck_glyph()}</div>')
    keyrows = {
        # PLAIN GEOMETRIC GLYPHS ONLY. The first draft used the media-control
        # codepoints (U+23EA and friends) and two of them came back as ORANGE
        # EMOJI — which is exactly the class of thing the widget itself avoids
        # by drawing its own Triangle rather than asking for a character.
        3: keys(('&#9664;&#9664;', '&#9654;', '&#9654;&#9654;'), w=70, h=50, fs=17),
        5: (keys(('&#10073;&#10073;', '&#9654;&#9612;', '&#8635;'), w=58, h=44, fs=15) +
            '<div style="height:9px;"></div>' +
            keys(('&#9612;&#9664;', '&#9664;&#9664;', '&#9654;&#9654;', '&#9654;&#9612;'),
                 w=42, h=40, fs=12)),
    }[rows]
    fields = ''.join(
        field(c, v) + f'<div style="height:{gap}px;"></div>'
        for c, v in (('Artist:', 'Oasis'), ('Track:', 'Champagne Supernova'),
                     ('Station:', 'Calm &middot; 940 AM'), ('Mode:', 'CD')))
    return f"""
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#1b1f28,#0a0c11);"></div>
  <div style="position:absolute;inset:0;background:
      radial-gradient(circle at 50% 88%,rgba(106,208,255,.26),transparent 64%);"></div>
  <div class=up style="position:absolute;inset:{inset}px;padding:0;overflow:hidden;
      display:flex;flex-direction:column;justify-content:{justify};">
    {titlebar()}
    <div style="padding:{pad}px {pad+2}px {pad}px;flex:1;display:flex;
        flex-direction:column;">
      <div style="display:flex;gap:20px;">
        <div class=dn style="width:{cover}px;height:{cover}px;flex:none;padding:6px;">
          <img src="data:image/jpeg;base64,{ART}"
              style="width:100%;height:100%;object-fit:cover;display:block;">
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;
            justify-content:space-between;">
          {right}
          {keyrows}
        </div>
      </div>
      <div style="height:{gap+6}px;"></div>
      {fields}
      <div style="flex:1;min-height:0;"></div>
      {timerow(time_kind)}
    </div>
  </div>"""


A = BT.slot('LAST PLAYED &middot; large', 'A &mdash; build 69, what you have',
            window(fill=False, top=False, cover=240, rows=3, dev='cd', time_kind='none'),
            'l', note='The window floats on a border, and the stack is centred &mdash; '
                      'which is the strip above the title bar AND the gap at the foot.')

B = BT.slot('LAST PLAYED &middot; large', 'B &mdash; the two layout fixes only',
            window(fill=True, top=True, cover=240, rows=3, dev='cd', time_kind='none'),
            'l', note='Window to the tile&rsquo;s own edge, title bar pinned to the top. '
                      'Nothing added yet.')

C = BT.slot('LAST PLAYED &middot; large', 'C &mdash; + the share card&rsquo;s furniture',
            window(fill=True, top=True, cover=228, rows=5, dev='both', time_kind='when'),
            'l', note='CD and tape deck, seven keys, and the scrub row spent on the one '
                      'thing a widget really knows &mdash; WHEN it played.')

D = BT.slot('LAST PLAYED &middot; large', 'D &mdash; + an empty trough instead',
            window(fill=True, top=True, cover=228, rows=5, dev='both', time_kind='trough'),
            'l', note='The Winamp trough with no handle and no numbers: furniture, '
                      'claiming nothing. Closest to the share card to look at.')


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + BT.head('The big CD player &mdash; filling it',
                  'Owner, 25.09: "could we make the Winamp take up the black border '
                  'surroundings? ... the widget has too much empty space. Add in the '
                  'progress bar if possible. Make sure the top bar sits at the very top '
                  'not just as a strip." <br>'
                  'The strip above the title bar and the gap at the foot are ONE fault: '
                  'the stack is shorter than the tile, so it centres. B is that fixed and '
                  'nothing else. C and D then spend the room two different ways &mdash; '
                  'and neither can carry a real progress bar, because a widget is redrawn '
                  'a handful of times a day and the snapshot holds no duration.')
        + f'<div class=row>{A}{B}{C}{D}</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print(f"wrote {_want}")
