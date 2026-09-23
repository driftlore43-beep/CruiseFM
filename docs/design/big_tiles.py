"""
THE BIG TILES — prototypes for a size the app does not offer yet.

Ethan, 2026-09-23, with two mockups of his own: the Pocket Player "as a Face",
drawn tall with the screen above and the wheel below; and "if you could make
the CD Widget have a bigger option", showing a large record with a tonearm.

BOTH ASKS ARE THE SAME GAP. Every tile in this app is SMALL (158pt) or
MEDIUM (338x158); nothing anywhere offers LARGE (338x354). So there is no
tall tile for a classic iPod to live in and no big tile for a record.

AND A SIZE IS DECLARED FOR THE WHOLE ROW, NOT PER LOOK. `.supportedFamilies`
sits on the Widget, so giving Last Played a large size means the CD player
and the ticket stub need a large arrangement too — otherwise two of the row's
three looks come out stretched at a size the gallery offers, which reads as a
bug rather than a choice. Same for The Mode. That is why this sheet draws SIX
tiles and not two: it is what the round actually costs.

DRAWN AT 2x, so 1px here is half a point. small 316, medium 676x316,
large 676x708 — the real families, at the proportions a phone gives them.

IT REUSES v3.py's OWN PARTS (the pressing, the cover label, the ball) rather
than lookalikes, for the reason assets.py exists: a second copy of a drawing
is a second thing that can drift from the one being judged. v3 writes its
sheet at import, so OUT is pointed at a throwaway first and restored after.

TWO THINGS IN ETHAN'S MOCKUPS ARE DELIBERATELY NOT COPIED, and both are on
record already. The MENU / skip / play commands printed round the wheel are
Apple's own industrial design and this app has been refused twice at review
(03.09), so the wheel stays a plain unlabelled ring. And the progress bar
(3:27 / -1:15) cannot be drawn honestly: the tile says LAST PLAYED precisely
because it does not know where a song is up to, and a bar there would be
invented.

RUN:
  OUT=<scratch>/big.html python3 docs/design/big_tiles.py
  PLAYWRIGHT_MODULE=<abs>/node_modules/playwright/index.mjs \
    IN=<scratch>/big.html OUT=<scratch>/big.png node docs/design/shot4.mjs
"""
import math, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))

_want = os.environ.get('OUT', 'big_tiles.html')
os.environ['OUT'] = str(pathlib.Path(_want).parent / '.v3-throwaway.html')
import v3                                   # noqa: E402  (writes the throwaway)
os.environ['OUT'] = _want

from assets import A                        # noqa: E402
import ball as BALLGEN                      # noqa: E402

grooves, cover_label, red_label = v3.grooves, v3.cover_label, v3.red_label

# The real families at 2x. A point is 2px here.
SM, MW, MH, LW, LH = 316, 676, 316, 676, 708
RAD = 44

CSS = v3.CSS + f"""
.l   {{ width:{LW}px; height:{LH}px; }}
.row {{ display:flex; flex-wrap:wrap; gap:50px 42px; align-items:flex-start;
        position:relative; z-index:1; width:100%; }}
.h   {{ color:#fff; font-size:30px; font-weight:800; letter-spacing:-.01em;
        text-shadow:0 2px 6px rgba(0,0,0,.8); position:relative; z-index:1;
        width:100%; margin-top:26px; }}
.hs  {{ color:rgba(255,255,255,.72); font-size:16px; font-weight:400; line-height:1.5;
        text-shadow:0 1px 4px rgba(0,0,0,.8); position:relative; z-index:1;
        width:100%; max-width:1080px; margin:-8px 0 8px; }}
"""


def slot(tag, name, inner, cls='m', note=''):
    return v3.slot(tag, name, inner, cls, note)


def head(title, sub):
    return f'<div class=h>{title}</div><div class=hs>{sub}</div>'


# ══════════════ the screen every player look shares ════════════════════════
# One helper, because the tall player and the wide one must not drift into two
# different screens — they are the same look at two sizes, which is the whole
# claim being made.
def screen(art_px, title_px, artist_px, eb_px, seg_px, stacked):
    """The player's screen. `stacked` puts the cover ABOVE the words (tall
    tile) rather than beside them (wide tile, which is what ships today)."""
    cover = (f'<img src="data:image/jpeg;base64,{A["coastal"]}" '
             f'style="width:{art_px}px;height:{art_px}px;object-fit:cover;'
             f'border-radius:6px;flex:none;">')
    words = (f'<div style="min-width:0;">'
             f'<div style="color:#fff;font-size:{title_px}px;font-weight:800;'
             f'line-height:1.12;">Everlong</div>'
             f'<div style="color:rgba(255,255,255,.66);font-size:{artist_px}px;'
             f'margin-top:9px;">Foo Fighters</div></div>')
    top = (f'<div style="display:flex;flex-direction:column;align-items:center;'
           f'gap:22px;text-align:center;">{cover}{words}</div>' if stacked else
           f'<div style="display:flex;align-items:flex-start;gap:22px;">{cover}{words}</div>')
    return f"""
    <div style="position:absolute;inset:0;border-radius:10px;background:#0a0c12;
        box-shadow:inset 0 0 0 3px #9aa0a8, 0 4px 10px rgba(0,0,0,.4);
        overflow:hidden;display:flex;flex-direction:column;
        justify-content:space-between;padding:26px;">
      {top}
      <!-- NO PROGRESS BAR. A bar claims a position in a song; the only thing
           known here is that this played at some point. -->
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class=eb style="color:rgba(255,255,255,.5);font-size:{eb_px}px;">Last played</span>
        <div style="display:flex;align-items:baseline;gap:5px;">
          <span class=seg style="font-size:{seg_px}px;color:rgba(255,255,255,.62);">94.70</span>
          <span class=seg14 style="font-size:{int(seg_px*.62)}px;color:rgba(255,255,255,.5);">FM</span>
        </div>
      </div>
    </div>"""


def wheel(d):
    """The control: a plain ring, deliberately unlabelled. A machined ring is
    bright where the lamp is and dark opposite, so its edge is a sweep rather
    than one flat line — the same argument that took the record's rim off a
    plain stroke on 04.09."""
    return f"""
    <div style="width:{d}px;height:{d}px;border-radius:50%;
        background:linear-gradient(150deg,#fbfbfc,#dcdfe3 55%,#c3c7cd);
        box-shadow:0 4px 12px rgba(0,0,0,.30), inset 0 1px 0 #fff;position:relative;">
      <div style="position:absolute;inset:{int(d*0.33)}px;border-radius:50%;
          background:linear-gradient(150deg,#eff1f3,#cdd1d6);
          box-shadow:inset 0 2px 6px rgba(0,0,0,.18), 0 1px 0 #fff;"></div>
    </div>"""


CASE_METAL = """
  <div style="position:absolute;inset:0;background:
      linear-gradient(180deg,#f7f8f9 0%,#e6e8eb 36%,#d3d6da 66%,#c6c9ce 100%);"></div>
  <div style="position:absolute;inset:0;background:
      linear-gradient(140deg,transparent 10%,rgba(255,255,255,.46) 30%,transparent 52%);"></div>
  <div style="position:absolute;inset:0;background:
      linear-gradient(140deg,transparent 58%,rgba(255,255,255,.22) 74%,transparent 92%);"></div>"""


# ══════════════ 1 — the Pocket Player, tall (Ethan's ask) ══════════════════
PLAYER_TALL = slot(
    'LAST PLAYED &middot; large &middot; NEW', 'Pocket player &mdash; tall', f"""
  {CASE_METAL}
  <div style="position:absolute;left:30px;right:30px;top:30px;height:330px;">
    {screen(212, 38, 24, 12, 20, stacked=False)}
  </div>
  <div style="position:absolute;left:0;right:0;top:400px;display:flex;justify-content:center;">
    {wheel(272)}
  </div>""", 'l',
    note='Ethan&rsquo;s classic layout: cover and words together, wheel below.')


# ══════════════ 2 — the same tile, cover-led ═══════════════════════════════
PLAYER_TALL_B = slot(
    'LAST PLAYED &middot; large &middot; NEW', 'Pocket player &mdash; tall, cover-led', f"""
  {CASE_METAL}
  <div style="position:absolute;left:30px;right:30px;top:30px;height:330px;">
    {screen(150, 32, 21, 12, 20, stacked=True)}
  </div>
  <div style="position:absolute;left:0;right:0;top:400px;display:flex;justify-content:center;">
    {wheel(272)}
  </div>""", 'l',
    note='Same parts, cover on top &mdash; the sleeve does the work, the words sit under it.')


# ══════════════ 3 — what ships today, for scale ════════════════════════════
PLAYER_NOW = slot(
    'LAST PLAYED &middot; medium &middot; SHIPPING', 'Pocket player &mdash; as it is now', f"""
  {CASE_METAL}
  <div style="position:absolute;left:28px;top:28px;bottom:28px;right:238px;">
    {screen(148, 34, 24, 15, 20, stacked=False)}
  </div>
  <div style="position:absolute;right:26px;top:50%;transform:translateY(-50%);">
    {wheel(192)}
  </div>""", 'm',
    note='This is already Ethan&rsquo;s second picture &mdash; screen left, wheel right.')


# ══════════════ 4 — the CD player window, tall ═════════════════════════════
# The row's other two looks have to work at the new size or the gallery is
# offering one that breaks them. A Winamp window is wide and short, so the
# honest tall version is the window with its record shelf under it rather
# than the window stretched.
CDPLAYER_TALL = slot(
    'LAST PLAYED &middot; large', 'CD player &mdash; tall', f"""
  <div style="position:absolute;inset:0;background:#3a3f4a;"></div>
  <div style="position:absolute;inset:0;background:
      radial-gradient(circle at 30% 18%,rgba(106,208,255,.30),transparent 62%);"></div>
  <div class=up style="position:absolute;left:26px;right:26px;top:26px;height:300px;padding:8px;">
    <div style="height:38px;background:linear-gradient(90deg,#1d3f8f,#5f86d6);
        display:flex;align-items:center;padding:0 10px;justify-content:space-between;">
      <span class=px style="color:#fff;font-size:17px;">Cruise FM</span>
      <div style="display:flex;gap:5px;">
        {''.join('<div class=up style="width:24px;height:22px;"></div>' for _ in range(3))}
      </div>
    </div>
    <div style="display:flex;gap:12px;padding:14px 8px 8px;">
      <img src="data:image/jpeg;base64,{A['coastal']}"
          style="width:162px;height:162px;object-fit:cover;flex:none;"
          class=dn>
      <div style="min-width:0;flex:1;">
        <div class=dn style="padding:8px 10px;margin-bottom:8px;">
          <div class=px style="color:#1b1d22;font-size:13px;opacity:.55;">Song</div>
          <div class=px style="color:#0d0f14;font-size:19px;">Everlong</div>
        </div>
        <div class=dn style="padding:8px 10px;margin-bottom:8px;">
          <div class=px style="color:#1b1d22;font-size:13px;opacity:.55;">Artist</div>
          <div class=px style="color:#0d0f14;font-size:19px;">Foo Fighters</div>
        </div>
        <div class=dn style="padding:8px 10px;">
          <div class=px style="color:#1b1d22;font-size:13px;opacity:.55;">Station</div>
          <div class=px style="color:#0d0f14;font-size:19px;">Coastal FM</div>
        </div>
      </div>
    </div>
  </div>
  <!-- THE SHELF: the height the window does not want, spent on the disc
       itself rather than on stretching the window's own furniture. -->
  <div class=up style="position:absolute;left:26px;right:26px;top:346px;bottom:26px;
      display:flex;align-items:center;justify-content:center;">
    <div style="width:262px;height:262px;border-radius:50%;overflow:hidden;
        box-shadow:0 8px 20px rgba(0,0,0,.55);position:relative;">
      <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;inset:0;
          width:100%;height:100%;object-fit:cover;filter:saturate(1.15) brightness(.72);">
      <div style="position:absolute;inset:0;background:conic-gradient(from 20deg,
          rgba(106,208,255,.95),rgba(185,140,255,.95),rgba(255,154,208,.95),
          rgba(255,214,138,.95),rgba(168,255,207,.95),rgba(106,208,255,.95));
          mix-blend-mode:overlay;"></div>
      <div style="position:absolute;inset:0;background:
          linear-gradient(120deg,rgba(255,255,255,.40) 5%,transparent 28%,
          transparent 68%,rgba(255,255,255,.24) 92%);"></div>
      <div style="position:absolute;inset:92px;border-radius:50%;background:rgba(222,228,238,.60);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.45);"></div>
      <div style="position:absolute;inset:114px;border-radius:50%;background:#090a0e;"></div>
    </div>
  </div>""", 'l',
    note='Not the window stretched &mdash; the window, then the disc in the room it makes.')


# ══════════════ 5 — the ticket stub, tall ══════════════════════════════════
STUB_TALL = slot(
    'LAST PLAYED &middot; large', 'Ticket stub &mdash; tall', f"""
  <div style="position:absolute;inset:0;background:linear-gradient(170deg,#f6f2e6,#e4ddc9);"></div>
  <div style="position:absolute;inset:0;opacity:.5;background:repeating-linear-gradient(
      52deg,rgba(0,0,0,.03) 0 1px,transparent 1px 7px);"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:78px;background:#12141c;
      display:flex;align-items:center;justify-content:space-between;padding:0 30px;">
    <span class=eb style="color:#fff;font-size:15px;">Cruise FM</span>
    <div style="display:flex;align-items:baseline;gap:6px;">
      <span class=seg style="font-size:26px;color:#FF9A2E;">94.70</span>
      <span class=seg14 style="font-size:15px;color:#FF9A2E;opacity:.85;">FM</span></div>
  </div>
  <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;left:30px;
      right:30px;top:108px;height:270px;width:calc(100% - 60px);object-fit:cover;">
  <div style="position:absolute;left:30px;right:30px;top:404px;">
    <div class=eb style="color:rgba(20,20,26,.48);font-size:13px;">Last played</div>
    <div style="color:#14141a;font-size:36px;font-weight:800;margin-top:8px;">Everlong</div>
    <div style="color:rgba(20,20,26,.6);font-size:21px;margin-top:8px;">Foo Fighters</div>
  </div>
  <!-- the tear runs the full width here, because the tile is tall: the
       counterfoil is the foot rather than a side column. -->
  <div style="position:absolute;left:0;right:0;top:556px;height:2px;
      background:repeating-linear-gradient(90deg,rgba(20,20,26,.42) 0 9px,transparent 9px 18px);"></div>
  <div style="position:absolute;left:-13px;top:543px;width:26px;height:26px;border-radius:50%;
      background:#2c323e;"></div>
  <div style="position:absolute;right:-13px;top:543px;width:26px;height:26px;border-radius:50%;
      background:#2c323e;"></div>
  <div style="position:absolute;left:30px;right:30px;bottom:34px;display:flex;
      align-items:flex-end;justify-content:space-between;">
    <div>
      <div class=eb style="color:rgba(20,20,26,.45);font-size:12px;">Station</div>
      <div style="color:#14141a;font-size:24px;font-weight:700;margin-top:6px;">Coastal FM</div>
    </div>
    <div style="display:flex;gap:3px;align-items:flex-end;height:60px;">
      {''.join(f'<div style="width:{w}px;height:100%;background:#14141a;"></div>'
               for w in [3,6,2,3,7,2,5,3,2,6,3,7,2,3,5,2,6,3,2,7,3,5,2,3,6])}
    </div>
  </div>""", 'l',
    note='The tear turns: a tall stub tears across, not down.')


# ══════════════ 6 — the record and a tonearm (Ethan's CD ask) ══════════════
# HIS PICTURE IS A RECORD WITH A TONEARM, not the Winamp CD player — so it is
# The Mode's Record look grown, with one new object on it.
#
# THE TONEARM DOES NOT EXIST ANYWHERE IN THE WIDGET TARGET (the app's Vinyl
# deck has one; the widgets never have), so it is the one genuinely new thing
# on this sheet. Its geometry is the app's own: a straight rod, and the stylus
# lands on the OUTER grooves at about 0.80 of the radius — put it any further
# in and the needle is sitting on the label, which is the one place a needle
# never is (03.08).
def tonearm(cx, cy, r):
    """A straight rod from a bearing above the record, down onto the outer
    grooves at about 3 o'clock.

    THREE NUMBERS ARE LOAD-BEARING AND ALL THREE ARE THE APP'S OWN (03.08).
    The stylus lands at 0.80 of the radius — any further in and the needle is
    sitting on the label, which is the one place a needle never is. The rod is
    STRAIGHT, because the app's own arm was rebuilt three times and finished
    as a plain straight rod on the owner's instruction, so a curved one here
    would make two different objects out of one. And the counterweight sits on
    a SHORT stub: set further back it reads as a lollipop, which is what the
    first render of this one did.

    THE PIVOT HAS TO CLEAR THE RECORD, which is what sets the record's size
    here rather than the tile's: at r = 254 there are only 84px of tile either
    side and the arm comes out a stub with nowhere to pivot from.

    EVERYTHING IS PLACED IN PYTHON, not with transform-origin tricks — the
    first attempt hung the counterweight off the tile's corner, because an
    origin expressed as a percentage of a box moves with the box's size.
    """
    ang_deg = 110.0                                  # down and slightly left
    px, py = cx + r * 1.10, cy - r * 0.90            # bearing, above the disc
    sa = math.radians(-5)                            # stylus at ~3 o'clock
    sx, sy = cx + r * 0.80 * math.cos(sa), cy + r * 0.80 * math.sin(sa)
    dx, dy = sx - px, sy - py
    length = math.hypot(dx, dy)
    ang = math.degrees(math.atan2(dy, dx))
    back = math.radians(ang + 180)
    wx, wy = px + 74 * math.cos(back), py + 74 * math.sin(back)
    tube_w, head_w, head_l = 8, 24, 52
    return f"""
    <!-- the rod, drawn as a tube: light along its top, shadow under it. One
         flat bar is a drawn stripe, which is the note the app's own arm
         collected twice. -->
    <div style="position:absolute;left:{px}px;top:{py}px;width:{length}px;height:{tube_w}px;
        transform-origin:0 50%;transform:translateY(-50%) rotate({ang}deg);
        border-radius:{tube_w}px;
        background:linear-gradient(180deg,#ffffff,#dfe3e8 38%,#9aa0a9 78%,#6f757e);
        box-shadow:0 4px 9px rgba(0,0,0,.55);"></div>
    <!-- the stub the counterweight rides, then the weight itself -->
    <div style="position:absolute;left:{px}px;top:{py}px;width:82px;height:7px;
        transform-origin:0 50%;transform:translateY(-50%) rotate({ang + 180}deg);
        border-radius:7px;background:linear-gradient(180deg,#e8ecf1,#868c95);"></div>
    <div style="position:absolute;left:{wx}px;top:{wy}px;width:34px;height:30px;
        transform:translate(-50%,-50%) rotate({ang}deg);border-radius:8px;
        background:linear-gradient(180deg,#dfe4ea,#7f858e 70%,#5d636b);
        box-shadow:0 3px 8px rgba(0,0,0,.5);"></div>
    <!-- the bearing: a low cylinder, not a sphere. Rendered as a ball it read
         as a second object sitting beside the counterweight. -->
    <div style="position:absolute;left:{px}px;top:{py}px;width:46px;height:46px;
        transform:translate(-50%,-50%);border-radius:50%;
        background:radial-gradient(circle at 36% 28%,#eef1f5,#a9afb8 58%,#767c85);
        box-shadow:0 5px 12px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.8);"></div>
    <div style="position:absolute;left:{px}px;top:{py}px;width:16px;height:16px;
        transform:translate(-50%,-50%);border-radius:50%;
        background:radial-gradient(circle at 40% 32%,#f2f4f7,#6c7079);"></div>
    <!-- the headshell: a wedge at the far end, with the cartridge under it -->
    <div style="position:absolute;left:{sx}px;top:{sy}px;width:{head_l}px;height:{head_w}px;
        transform-origin:100% 50%;transform:translate(-100%,-50%) rotate({ang}deg);
        border-radius:5px;background:linear-gradient(180deg,#f4f6f9,#b4b9c2 60%,#878d96);
        box-shadow:0 4px 10px rgba(0,0,0,.6);"></div>
    <div style="position:absolute;left:{sx}px;top:{sy}px;width:9px;height:9px;
        transform:translate(-50%,-50%);border-radius:50%;background:#23262c;
        box-shadow:0 2px 5px rgba(0,0,0,.7);"></div>"""


_R = 230
RECORD_BIG = slot(
    'THE MODE &middot; large &middot; NEW', 'Record &mdash; big, with the arm', f"""
  <div style="position:absolute;inset:0;background:
      radial-gradient(circle at 50% 42%,#2a2621,#0c0b09 78%);"></div>
  <div style="position:absolute;left:50%;top:336px;transform:translate(-50%,-50%);
      width:{_R*2}px;height:{_R*2}px;">
    {grooves(_R*2, int(_R*2*0.27), cover_label())}
  </div>
  {tonearm(LW/2, 336, _R)}
  <div style="position:absolute;left:0;right:0;bottom:34px;text-align:center;">
    <div style="color:#fff;font-size:26px;font-weight:800;">Coastal FM</div>
    <div class=eb style="color:rgba(255,255,255,.46);font-size:12px;margin-top:8px;">Vinyl</div>
  </div>""", 'l',
    note='The arm is the only new object on the whole sheet.')


# ══════════════ 7 — the CD in its case, big ════════════════════════════════
CD_BIG = slot('THE MODE &middot; large', 'CD &mdash; big', f"""
  <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1c1f26,#080a0e);"></div>
  <div style="position:absolute;left:24px;top:98px;right:24px;bottom:98px;border-radius:8px;
      background:linear-gradient(148deg,rgba(255,255,255,.16),rgba(255,255,255,.02) 44%,rgba(255,255,255,.10));
      box-shadow:inset 0 0 0 3px rgba(255,255,255,.30), 0 16px 34px rgba(0,0,0,.66);">
    <div style="position:absolute;left:0;top:0;bottom:0;width:48px;
        border-right:1px solid rgba(255,255,255,.20);
        background:linear-gradient(90deg,rgba(255,255,255,.16),rgba(255,255,255,.04));"></div>
    {''.join(f'<div style="position:absolute;left:9px;top:{t}px;width:30px;height:52px;border-radius:3px;'
             f'background:linear-gradient(160deg,rgba(255,255,255,.26),rgba(255,255,255,.06));'
             f'box-shadow:inset 0 0 0 1px rgba(255,255,255,.24);"></div>' for t in (54, 226, 398))}
    {''.join(f'<div style="position:absolute;{v}:11px;{h}:11px;width:30px;height:30px;'
             f'border-{v}:3px solid rgba(255,255,255,.34);border-{h}:3px solid rgba(255,255,255,.34);'
             f'border-radius:4px;"></div>'
             for v, h in [('top','left'), ('top','right'), ('bottom','left'), ('bottom','right')])}
    <div style="position:absolute;inset:0;border-radius:8px;background:
        linear-gradient(128deg,rgba(255,255,255,.20) 4%,transparent 26%,transparent 74%,
        rgba(255,255,255,.10) 96%);"></div>
  </div>
  <div style="position:absolute;left:54%;top:354px;transform:translate(-50%,-50%);
      width:436px;height:436px;border-radius:50%;overflow:hidden;
      box-shadow:0 14px 30px rgba(0,0,0,.72);">
    <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;inset:0;
        width:100%;height:100%;object-fit:cover;filter:saturate(1.15) brightness(.72);">
    <div style="position:absolute;inset:0;background:conic-gradient(from 20deg,
        rgba(106,208,255,.95),rgba(185,140,255,.95),rgba(255,154,208,.95),rgba(255,214,138,.95),
        rgba(168,255,207,.95),rgba(106,208,255,.95));mix-blend-mode:overlay;"></div>
    <div style="position:absolute;inset:0;background:conic-gradient(from 200deg,
        rgba(106,208,255,.5),rgba(185,140,255,.5),rgba(255,154,208,.5),rgba(255,214,138,.5),
        rgba(168,255,207,.5),rgba(106,208,255,.5));mix-blend-mode:screen;"></div>
    <div style="position:absolute;inset:0;background:repeating-radial-gradient(circle,
        rgba(255,255,255,.08) 0 3px,transparent 3px 7px);"></div>
    <div style="position:absolute;inset:0;background:
        linear-gradient(120deg,rgba(255,255,255,.40) 5%,transparent 28%,transparent 68%,
        rgba(255,255,255,.24) 92%);"></div>
    <div style="position:absolute;inset:150px;border-radius:50%;background:rgba(222,228,238,.60);
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.45);"></div>
    <div style="position:absolute;inset:187px;border-radius:50%;background:#090a0e;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);"></div>
  </div>""", 'l',
    note='The case has room for its corners at last &mdash; at small it is nearly all disc.')


# ══════════════ 8 — the mirror ball, big ═══════════════════════════════════
_BEAMS = [(-74, 620, .20, '#ff8fd0'), (-48, 660, .15, '#7fb3ff'), (-20, 620, .19, '#c08bff'),
          (14, 660, .14, '#ff8fd0'), (42, 620, .20, '#7fb3ff'), (68, 660, .15, '#c08bff')]

BALL_BIG = slot('THE MODE &middot; large', 'Mirror ball &mdash; big', f"""
  <div style="position:absolute;inset:0;background:
      radial-gradient(circle at 50% 36%,#241c2c,#0a060f 76%);"></div>
  {''.join(f'<div style="position:absolute;left:50%;top:60px;width:2px;height:{h}px;'
           f'background:linear-gradient(180deg,{c}{int(o*255):02x},transparent);'
           f'transform-origin:top center;transform:rotate({a}deg);"></div>'
           for a, h, o, c in _BEAMS)}
  <div style="position:absolute;left:50%;top:14px;transform:translateX(-50%);width:3px;height:52px;
      background:rgba(255,255,255,.30);"></div>
  <div style="position:absolute;left:50%;top:60px;transform:translateX(-50%);
      filter:drop-shadow(0 0 60px rgba(230,150,230,.42));">{BALLGEN.ball_svg(456, party=True)}</div>
  <div style="position:absolute;left:0;right:0;bottom:36px;text-align:center;">
    <div style="color:#fff;font-size:26px;font-weight:800;">Coastal FM</div>
    <div class=eb style="color:rgba(255,255,255,.46);font-size:12px;margin-top:8px;">Mirror ball</div>
  </div>""", 'l',
    note='More mirrors, not bigger ones &mdash; the grid grows with the tile.')


html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + head('Last Played &mdash; a tall tile',
               'Ethan&rsquo;s iPod. The wide tile he already has is his second picture, '
               'so what is new is the tall one. A widget is never told which way the phone '
               'is held &mdash; it only knows the shape of the tile it was dropped into &mdash; '
               'so &ldquo;portrait and landscape&rdquo; becomes two tiles that can sit on the '
               'Home Screen together.')
        + '<div class=row>' + PLAYER_TALL + PLAYER_TALL_B + PLAYER_NOW + '</div>'
        + head('&hellip;and the rest of that row has to follow',
               'The size is declared for the whole row, not per look. Offer a large tile and '
               'these two are offered at it as well, so they need an arrangement of their own '
               'or they come out stretched.')
        + '<div class=row>' + CDPLAYER_TALL + STUB_TALL + '</div>'
        + head('The Mode &mdash; a big tile',
               'Ethan&rsquo;s second picture is a record with a tonearm, which is this row '
               'rather than the CD player above. Same rule: all three looks, or none.')
        + '<div class=row>' + RECORD_BIG + CD_BIG + BALL_BIG + '</div>'
        + "</body></html>")
pathlib.Path(_want).write_text(html)
print('built the big-tile sheet ->', _want)
