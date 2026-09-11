"""
THE STUB, REBUILT AS A BOARDING PASS.

Owner, 09.09: "The ticket barcode is way too long. Let's rearrange the ticket
so the dotted line runs vertically, and the barcode is vertical and on the
right — like a plane ticket. The text sits on the left. The top CruiseFM text
in the banner can stay where it is. Create a prototype for this."

SHE PICKED B (09.09), and it is built: the tear runs the full height, so the
counterfoil is a genuinely detachable stub with its own slice of the banner.
A and C are kept here as the record of what the choice was between.

Three arrangements of the same idea, so the choice is a look rather than an
argument. Everything is drawn at the widget's REAL size (338 x 158 points) and
then scaled up, so a size that does not fit here will not fit on a phone.

  OUT=/tmp/ticket.html python3 docs/design/ticket.py
  PLAYWRIGHT_MODULE=... IN=/tmp/ticket.html OUT=/tmp/ticket.png node docs/design/shot4.mjs
"""
import os, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from assets import A

PAPER, PAPER_DEEP, INK = '#f4f1e8', '#e6e1d3', '#14161d'
W, H = 338, 158
SCALE = 3

STATIONS = [
    dict(name='Night Run AM', dial='810 AM', title='All You Wanted',
         artist='Michelle Branch', bar='#139da8'),
    dict(name='Party', dial='1240 AM', title='Breakaway',
         artist='Kelly Clarkson', bar='#a88d61'),
]

def dial(d):
    """Digits in DSEG7, the band in DSEG14 — exactly what `DialText` does in
    the Swift. Seven segments have no diagonal and no vertical centre bar, so
    DSEG7's M is a calculator's best attempt and reads as an N; the first cut
    of this prototype handed it the whole string and duly printed "810 AN".
    A mockup that shows what the app will not do costs a round of confusion."""
    parts = d.split()
    num = parts[0]
    band = parts[1] if len(parts) > 1 else ''
    return f'<span class="d7">{num}</span><span class="d14">{band}</span>'


def vbars(h):
    """A vertical barcode: bars stacked down the counterfoil."""
    out, y = [], 0
    i = 0
    while y < h - 2:
        t = 3 if i % 3 == 0 else 2
        w = 22 if i % 4 == 0 else 30
        out.append(f'<i style="height:{t}px;width:{w}px"></i>')
        y += t + 2.5
        i += 1
    return ''.join(out)

def notch(side):
    return f'<u class="{side}"></u>'

def ticket(v, s):
    """A: the banner runs the whole width and the tear starts under it.
       B: the tear runs the FULL height, so the counterfoil is a real
          detachable stub with its own slice of the banner.
       C: B with a wider counterfoil carrying the station's name set on its
          side, which is the most boarding-pass of the three."""
    foil = 86 if v == 'C' else 58
    full = v in ('B', 'C')

    def banner(width, label=True):
        inner = ('<b>CRUISE FM</b><span>ADMIT ONE</span>' if label else '')
        return f'<div class="banner" style="width:{width}px">{inner}</div>'

    bars_h = H - 30 - 20
    side = (f'<div class="side">{s["name"]}</div>' if v == 'C' else '')
    foil_col = f'''
      <div class="foil" style="width:{foil}px">
        {banner(foil, label=False) if full else ''}
        <div class="barswrap">
          {side}
          <div class="bars">{vbars(bars_h)}</div>
        </div>
        <div class="seat">{s['dial'].split()[0]}</div>
      </div>'''

    left = f'''
      <div class="left">
        {banner(W - foil - 1) if full else ''}
        <div class="pad">
          <div class="eyebrow">LAST PLAYED</div>
          <div class="title">{s['title']}</div>
          <div class="artist">{s['artist']}</div>
          <div class="foot">
            <div class="fl">
              <div class="eyebrow">STATION</div>
              <div class="station">{s['name']}</div>
            </div>
            <div class="dial">{dial(s['dial'])}</div>
          </div>
        </div>
      </div>'''

    return f'''
    <figure>
      <div class="card">
        {'' if full else banner(W)}
        <div class="body" style="height:{H - (0 if full else 30)}px">
          {left}
          <div class="perf" style="right:{foil}px"><u class="t"></u><u class="b"></u></div>
          {foil_col}
        </div>
      </div>
      <figcaption>{v} &mdash; {s['name']}</figcaption>
    </figure>'''


CSS = f'''
@font-face {{ font-family:'DSEG7'; src:url(data:font/ttf;base64,{A['dseg7']}); }}
@font-face {{ font-family:'DSEG14'; src:url(data:font/ttf;base64,{A['dseg14']}); }}
* {{ box-sizing:border-box; margin:0; padding:0 }}
body {{ background:#0a0a10; font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
        padding:40px; display:flex; flex-wrap:wrap; gap:44px }}
figure {{ zoom:{SCALE} }}
figcaption {{ color:#8a8a96; font-size:6px; margin-top:5px; letter-spacing:.6px }}
.card {{ width:{W}px; height:{H}px; border-radius:9px; overflow:hidden;
         background:linear-gradient(180deg,{PAPER},{PAPER_DEEP}); position:relative }}
.banner {{ height:30px; background:{INK}; display:flex; align-items:center;
           justify-content:space-between; padding:0 15px; flex:none }}
.banner b {{ color:#fff; font-size:10px; font-weight:800; letter-spacing:1.6px }}
.banner span {{ color:rgba(255,255,255,.45); font-size:8px; font-weight:800; letter-spacing:1.4px }}
.foil .banner {{ padding:0; border-left:1px solid rgba(255,255,255,.10) }}
.body {{ display:flex; position:relative }}
.left {{ flex:1; display:flex; flex-direction:column; min-width:0 }}
.pad {{ padding:10px 14px 11px; display:flex; flex-direction:column; height:100%; min-width:0 }}
.eyebrow {{ font-family:ui-monospace,Menlo,monospace; font-size:8px;
            letter-spacing:1.6px; color:rgba(20,22,29,.45) }}
.title {{ font-size:21px; font-weight:800; color:{INK}; margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.artist {{ font-size:14px; color:rgba(20,22,29,.62); margin-top:1px;
           white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.foot {{ margin-top:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:8px }}
.station {{ font-size:15px; font-weight:800; color:{INK}; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis }}
.dial {{ color:{INK}; white-space:nowrap; display:flex; align-items:baseline; gap:3px }}
.d7 {{ font-family:'DSEG7'; font-size:14px }}
.d14 {{ font-family:'DSEG14'; font-size:10px; opacity:.7 }}
.fl {{ min-width:0 }}
.perf {{ position:absolute; top:0; bottom:0; width:1px;
         background:repeating-linear-gradient(180deg,rgba(20,22,29,.30) 0 5px,transparent 5px 9px) }}
.perf u {{ position:absolute; left:-6.5px; width:13px; height:13px; border-radius:50%;
           background:#0a0a10 }}
.perf u.t {{ top:-6.5px }} .perf u.b {{ bottom:-6.5px }}
.foil {{ flex:none; display:flex; flex-direction:column; align-items:stretch }}
.barswrap {{ flex:1; display:flex; align-items:center; justify-content:center;
             gap:5px; padding:9px 0 3px; min-height:0 }}
.side {{ writing-mode:vertical-rl; transform:rotate(180deg); font-size:9px;
         font-weight:800; letter-spacing:1.1px; color:rgba(20,22,29,.55);
         white-space:nowrap; overflow:hidden }}
.bars {{ display:flex; flex-direction:column; align-items:center;
         justify-content:space-between; height:100% }}
.bars i {{ display:block; background:{INK} }}
.seat {{ font-family:'DSEG7'; font-size:9px; color:rgba(20,22,29,.55);
          text-align:center; padding-bottom:8px }}
'''

html = ('<!doctype html><meta charset="utf-8"><style>' + CSS + '</style>' +
        ''.join(ticket(v, s) for s in STATIONS for v in ('A', 'B', 'C')))
out = os.environ.get('OUT', '/tmp/ticket.html')
pathlib.Path(out).write_text(html, encoding='utf-8')
print('wrote ' + out)
