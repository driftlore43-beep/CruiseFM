import sys, os, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from assets import A
import ball as BALLGEN
import pathlib

MW, MH, S = 676, 316, 316
RAD = 44
CREAM = 'linear-gradient(160deg,#f3f0e7,#e2ddce)'

CSS = f"""
@font-face {{ font-family:'DSEG7'; src:url(data:font/ttf;base64,{A['dseg7']}) format('truetype'); }}
@font-face {{ font-family:'DSEG14'; src:url(data:font/ttf;base64,{A['dseg14']}) format('truetype'); }}
@font-face {{ font-family:'PX'; src:url(data:font/ttf;base64,{A['pixel']}) format('truetype'); }}
.px {{ font-family:'PX',ui-monospace,monospace; }}
.up {{ background:#c3c7cb; box-shadow: inset 2px 2px 0 #ffffff, inset -2px -2px 0 #818a94,
        inset 4px 4px 0 #dfe3e6, inset -4px -4px 0 #5f666e; }}
.dn {{ background:#ffffff; box-shadow: inset 2px 2px 0 #818a94, inset -2px -2px 0 #ffffff,
        inset 4px 4px 0 #5f666e, inset -4px -4px 0 #dfe3e6; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; padding:44px;
        display:flex; flex-wrap:wrap; gap:50px 42px; align-items:flex-start;
        background-image:url(data:image/jpeg;base64,{A['nightrun']});
        background-size:cover; background-position:center; }}
body::before {{ content:''; position:fixed; inset:0; backdrop-filter:blur(38px);
        background:rgba(44,50,62,.44); z-index:0; }}
.slot {{ display:flex; flex-direction:column; gap:11px; position:relative; z-index:1; }}
.cap  {{ color:rgba(255,255,255,.70); font-size:14px; letter-spacing:.15em; text-transform:uppercase;
        text-shadow:0 1px 3px rgba(0,0,0,.7); }}
.capn {{ color:#fff; font-size:20px; font-weight:700; text-shadow:0 1px 3px rgba(0,0,0,.7); }}
.note {{ color:#9fe8b0; font-size:13px; font-weight:600; text-shadow:0 1px 3px rgba(0,0,0,.8); margin-top:-4px; }}
.w {{ border-radius:{RAD}px; overflow:hidden; position:relative; box-shadow:0 18px 40px rgba(0,0,0,.5); }}
.m {{ width:{MW}px; height:{MH}px; }}  .s {{ width:{S}px; height:{S}px; }}
.seg {{ font-family:'DSEG7'; }}  .seg14 {{ font-family:'DSEG14'; }}
.eb {{ font-size:11px; font-weight:700; letter-spacing:.26em; text-transform:uppercase; }}
"""

def slot(tag, name, inner, cls='m', note=''):
    n = f'<div class=note>{note}</div>' if note else ''
    return (f'<div class=slot><div class=cap>{tag}</div><div class=capn>{name}</div>{n}'
            f'<div class="w {cls}">{inner}</div></div>')

# ══════════════ THE RECORD — now actually cut, not drawn ═══════════════════
# Owner, 03.09: "improve the vinyls' design add grooved and a bit of texture".
# The old one was a 4px repeating ring, which at widget size reads as a flat
# hatch. A record is HUNDREDS of grooves — at this scale that is a TEXTURE, so
# the pitch drops to 3px and each ring gets a lit wall on one side, which is
# what makes a groove read as cut in rather than printed on. Same rule the
# app's own Classic vinyl was rebuilt around on 25.08.
def grooves(size, label_inset, label_html, shadow=True):
    return f"""
    <div style="position:absolute;inset:0;">
      {'<div style="position:absolute;inset:9px 9px -7px 11px;border-radius:50%;background:radial-gradient(circle,rgba(38,32,24,.5),transparent 70%);filter:blur(11px);"></div>' if shadow else ''}
      <div style="position:absolute;inset:0;border-radius:50%;background:#0c0c0f;
          box-shadow:0 12px 24px rgba(30,26,20,.45);overflow:hidden;">
        <!-- the grooves: a dark cut with a hairline of light on its wall -->
        <div style="position:absolute;inset:0;border-radius:50%;background:
            repeating-radial-gradient(circle,
              #050506 0 1.15px, #17171b 1.15px 2.1px, rgba(255,255,255,.055) 2.1px 2.5px,
              #101014 2.5px 3px);"></div>
        <!-- pressing texture: fine speckle so the surface is not perfectly smooth -->
        <div style="position:absolute;inset:0;border-radius:50%;opacity:.5;background:
            repeating-conic-gradient(from 0deg,rgba(255,255,255,.030) 0deg 0.5deg,
              transparent 0.5deg 1.6deg);"></div>
        <!-- the wide sheen, gradient only: a light on a record has no edges -->
        <div style="position:absolute;inset:0;border-radius:50%;background:
            conic-gradient(from 205deg,transparent 0deg,rgba(255,255,255,.17) 26deg,transparent 64deg,
            transparent 194deg,rgba(255,255,255,.11) 224deg,transparent 260deg);"></div>
        <!-- outer rim: a pressing has a raised lip -->
        <div style="position:absolute;inset:0;border-radius:50%;
            box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.13), inset 0 0 14px rgba(0,0,0,.75);"></div>
        <div style="position:absolute;inset:{label_inset}px;border-radius:50%;overflow:hidden;
            box-shadow:0 0 0 1px rgba(0,0,0,.55);">{label_html}</div>
      </div>
    </div>"""

def red_label(num='810', band='AN'):
    """A classic record label: a red centre with the frequency printed on it.

    The station's NAME is not here — it moved to the foot of the card, and
    printing it in both places is the kind of duplication that makes a small
    label unreadable. The frequency alone has room to be read."""
    return f"""<div style="position:absolute;inset:0;background:
        radial-gradient(circle at 38% 30%,#d8402f,#96271b 72%,#7a1e14);display:flex;
        align-items:center;justify-content:center;gap:5px;">
      <span class=seg style="font-size:22px;color:#ffe7c2;">{num}</span>
      <span class=seg14 style="font-size:12px;color:#ffe7c2;opacity:.82;">{band}</span>
    </div>"""

def compact_label(num='810', band='AN'):
    """What pressing(compact:) draws. The label is 42% of the disc, so at the
    small tile's 92pt there is 38pt of room — 'CRUISE FM' would set at under
    4pt there. The frequency alone, and the name goes under the record."""
    return f"""<div style="position:absolute;inset:0;background:
        radial-gradient(circle at 38% 32%,#2b3550,#141a29);display:flex;
        align-items:center;justify-content:center;gap:5px;">
      <span class=seg style="font-size:31px;color:#FF9A2E;">{num}</span>
      <span class=seg14 style="font-size:16px;color:#FF9A2E;opacity:.8;">{band}</span>
    </div>"""

def dial_label(name, num='810', band='AN', sub=None):
    """A printed label — the station's own pressing."""
    return f"""<div style="position:absolute;inset:0;background:
        radial-gradient(circle at 38% 32%,#2b3550,#141a29);display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:3px;">
      <div class=eb style="color:rgba(255,255,255,.62);font-size:8px;">Cruise FM</div>
      <div style="color:#fff;font-size:{'19' if sub is None else '17'}px;font-weight:800;">{name}</div>
      <div style="display:flex;align-items:baseline;gap:4px;">
        <span class=seg style="font-size:20px;color:#FF9A2E;">{num}</span>
        <span class=seg14 style="font-size:11px;color:#FF9A2E;opacity:.8;">{band}</span></div>
    </div>"""

# ══════════════════════════════ C1 — on the road ═══════════════════════════
C1 = slot('C1 &middot; medium', 'The Deck &mdash; on the road', f"""
  <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;inset:0;width:100%;
      height:100%;object-fit:cover;filter:blur(8px);transform:scale(1.12);">
  <div style="position:absolute;inset:0;background:
      linear-gradient(102deg,rgba(5,7,13,.93) 6%,rgba(5,7,13,.68) 44%,rgba(5,7,13,.44));"></div>
  <div style="position:absolute;right:24px;top:26px;width:264px;height:264px;">
    {grooves(264, 84, f'<img src="data:image/jpeg;base64,{A["coastal"]}" style="width:100%;height:100%;object-fit:cover;">')}
  </div>
  <div style="position:absolute;left:32px;top:44px;">
    <div class=eb style="color:#FF9A2E;">On the deck</div>
    <div style="color:#fff;font-size:36px;font-weight:800;margin-top:8px;letter-spacing:-.02em;">Garage</div>
    <div style="display:flex;align-items:baseline;gap:7px;margin-top:6px;">
      <span class=seg style="font-size:20px;color:#FF9A2E;">810</span>
      <span class=seg14 style="font-size:12px;color:#FF9A2E;opacity:.75;">AN</span>
    </div>
  </div>
  <div style="position:absolute;left:32px;bottom:30px;">
    <div class=eb style="color:rgba(255,255,255,.46);font-size:9px;">Last played</div>
    <div style="color:#fff;font-size:20px;font-weight:700;margin-top:3px;">Everlong</div>
    <div style="color:rgba(255,255,255,.62);font-size:15px;">Foo Fighters</div>
  </div>""")

# ══════════════════════════════ C2 — the label ═════════════════════════════
C2 = slot('C2 &middot; medium', 'The Deck &mdash; the label', f"""
  <div style="position:absolute;inset:0;background:{CREAM};"></div>
  <div style="position:absolute;inset:0;opacity:.4;background:repeating-linear-gradient(
      92deg,rgba(0,0,0,.022) 0 2px,transparent 2px 5px);"></div>

  <!-- THE RECORD, sliding out of the sleeve to the RIGHT. Drawn first so the
       sleeve overlaps it: that overlap is the whole illusion. -->
  <div style="position:absolute;left:182px;top:50%;transform:translateY(-50%);width:212px;height:212px;">
    {grooves(212, 58, red_label())}
  </div>

  <!-- THE SLEEVE — the station's own photograph, which is what a record
       collection actually looks like on a shelf. -->
  <div style="position:absolute;left:24px;top:50%;transform:translateY(-50%);width:212px;height:212px;
      box-shadow:0 10px 26px rgba(40,34,24,.42);">
    <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;inset:0;
        width:100%;height:100%;object-fit:cover;">
    <div style="position:absolute;inset:0;background:
        linear-gradient(118deg,rgba(255,255,255,.16) 0 22%,transparent 46%);"></div>
    <div style="position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.30),
        inset -3px 0 8px rgba(0,0,0,.24);"></div>
    <div style="position:absolute;right:0;top:0;bottom:0;width:5px;background:
        linear-gradient(90deg,rgba(0,0,0,.28),rgba(0,0,0,.05));"></div>
  </div>

  <div style="position:absolute;right:24px;top:44px;text-align:right;width:246px;">
    <div class=eb style="color:#8a8474;font-size:9px;">Now on the deck</div>
    <div style="font-size:30px;font-weight:800;color:#1b1f27;margin-top:6px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Everlong</div>
    <div style="font-size:18px;color:#6f6a5c;margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Foo Fighters</div>
  </div>
  <!-- THE STATION, not the mode. It used to read "Cassette mode" under a
       picture of a RECORD, which is two objects contradicting each other. -->
  <div style="position:absolute;right:26px;bottom:26px;text-align:right;">
    <div style="font-size:19px;font-weight:800;color:#1b1f27;">Garage</div>
  </div>""")

# ══════════════════════════════ G — the stub ═══════════════════════════════
# Owner: "make the text bigger especially the artist and the song name."
STUB = slot('G &middot; medium', 'The Stub &mdash; with the artist', f"""
  <div style="position:absolute;inset:0;background:linear-gradient(175deg,#f7f3e9,#e9e3d4);"></div>
  <div style="position:absolute;inset:0;opacity:.34;background:repeating-linear-gradient(
      45deg,rgba(120,105,75,.10) 0 1px,transparent 1px 7px);"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:50px;background:#1b1f27;
      display:flex;align-items:center;justify-content:space-between;padding:0 24px;">
    <span class=eb style="color:#fff;font-size:12px;">Cruise FM</span>
    <span class=eb style="color:rgba(255,255,255,.45);font-size:10px;">Admit one</span>
  </div>
  <div style="position:absolute;left:24px;top:64px;">
    <div style="font-size:10px;letter-spacing:.2em;color:#8a8474;font-family:ui-monospace,Menlo,monospace;">STATION</div>
    <div style="font-size:29px;font-weight:800;color:#1b1f27;line-height:1.04;margin-top:2px;">Garage</div>
    <div style="font-size:12px;color:#6f6a5c;margin-top:2px;">Cassette mode</div>
  </div>
  <div style="position:absolute;right:24px;top:66px;text-align:right;">
    <div class=seg style="font-size:30px;color:#1b1f27;">810</div>
    <div class=seg14 style="font-size:13px;color:#6f6a5c;margin-top:3px;">AN</div>
  </div>
  <div style="position:absolute;left:0;right:0;top:172px;height:2px;
      background:repeating-linear-gradient(90deg,#bcb5a3 0 7px,transparent 7px 15px);"></div>
  <div style="position:absolute;left:-11px;top:162px;width:22px;height:22px;border-radius:50%;background:#2c3240;"></div>
  <div style="position:absolute;right:-11px;top:162px;width:22px;height:22px;border-radius:50%;background:#2c3240;"></div>
  <div style="position:absolute;left:24px;right:118px;bottom:22px;">
    <div style="font-size:10px;letter-spacing:.2em;color:#8a8474;font-family:ui-monospace,Menlo,monospace;">LAST PLAYED</div>
    <div style="font-size:30px;font-weight:800;color:#1b1f27;margin-top:3px;line-height:1.06;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Everlong</div>
    <div style="font-size:21px;color:#5f5a4e;margin-top:1px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Foo Fighters</div>
  </div>
  <div style="position:absolute;right:24px;bottom:24px;display:flex;align-items:flex-end;gap:2px;height:34px;">
    {''.join(f'<div style="width:{2 if i%3 else 4}px;height:{34 if i%4 else 23}px;background:#1b1f27;"></div>' for i in range(20))}
  </div>""")

# ══════════════════════════════ E — editorial ══════════════════════════════
EDITORIAL = slot('E &middot; medium', 'Editorial &mdash; station in the card', f"""
  <div style="position:absolute;inset:0;background:#0d0f14;"></div>
  <img src="data:image/jpeg;base64,{A['downtown']}" style="position:absolute;right:0;top:0;
      width:56%;height:100%;object-fit:cover;">
  <div style="position:absolute;right:0;top:0;width:56%;height:100%;background:
      linear-gradient(90deg,#0d0f14 0%,rgba(13,15,20,.55) 34%,rgba(13,15,20,.08));"></div>
  <div style="position:absolute;left:32px;top:42px;right:250px;">
    <div class=eb style="color:#FF9A2E;">Pick up where you left off</div>
    <div style="color:#fff;font-size:33px;font-weight:800;line-height:1.08;letter-spacing:-.02em;
        margin-top:11px;">Let&rsquo;s put<br>something on.</div>
    <div style="color:rgba(255,255,255,.60);font-size:15px;margin-top:11px;white-space:nowrap;">Garage &middot; Cassette mode</div>
  </div>
  <div style="position:absolute;right:32px;bottom:28px;width:74px;height:74px;border-radius:50%;
      background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;">
    <div style="width:0;height:0;margin-left:6px;border-left:24px solid #111;
        border-top:15px solid transparent;border-bottom:15px solid transparent;"></div>
  </div>""")

# ══════════════════════════════ D — the dial ═══════════════════════════════
# Owner: "increase the length of the lines in the tuner scale, I can barely
# see the lines - they are quite short." Minors 12 -> 20, majors 22 -> 36, and
# both lifted in opacity: a scale you cannot read is decoration, not a dial.
# 810 AM on a 530-1600 band is (810-530)/1070 = 26.2% along. The Swift works
# this out from the station's own dial rather than parking the needle.
NEEDLE = (810 - 530) / (1600 - 530)

DIAL = slot('D &middot; medium', 'On Air &mdash; the dial', f"""
  <img src="data:image/jpeg;base64,{A['daylight']}" style="position:absolute;inset:0;
      width:100%;height:100%;object-fit:cover;filter:blur(13px);transform:scale(1.16);">
  <div style="position:absolute;inset:0;background:
      linear-gradient(180deg,rgba(6,7,12,.62) 0%,rgba(6,7,12,.20) 30%,rgba(6,7,12,.24) 70%,rgba(6,7,12,.66) 100%);"></div>
  <div style="position:absolute;left:32px;right:32px;top:26px;display:flex;align-items:flex-start;">
    <div style="display:flex;align-items:center;gap:7px;">
      <div style="width:11px;height:11px;border-radius:50%;background:#FF3B30;"></div>
      <span class=eb style="color:rgba(255,255,255,.72);font-size:11px;">On air</span>
    </div>
    <div style="margin-left:auto;display:flex;align-items:baseline;gap:6px;">
      <span class=seg style="font-size:38px;color:#fff;">810</span>
      <span class=seg14 style="font-size:19px;color:#fff;opacity:.9;">AN</span>
    </div>
  </div>
  <div style="position:absolute;left:32px;top:74px;color:#fff;font-size:38px;font-weight:800;
      letter-spacing:-.02em;">Garage</div>
  <div style="position:absolute;left:32px;right:32px;top:150px;height:68px;">
    <div style="position:absolute;inset:0;background:
        linear-gradient(180deg,transparent,rgba(4,5,12,.42) 26%,rgba(4,5,12,.42) 74%,transparent);"></div>
    {''.join(f'<div style="position:absolute;left:{i/32*96+2:.2f}%;top:{4 if i%8==0 else 14}px;'
             f'width:{2 if i%8==0 else 1.4}px;height:{36 if i%8==0 else 20}px;'
             f'background:rgba(255,255,255,{.80 if i%8==0 else .44});"></div>' for i in range(33))}
    <div style="position:absolute;left:0;right:0;top:42px;height:1px;background:rgba(255,255,255,.28);"></div>
    {''.join(f'<div style="position:absolute;left:{p*100:.0f}%;top:47px;transform:translateX(-50%);'
             f'font-family:DSEG7;font-size:16px;color:rgba(255,255,255,.42);">{n}</div>'
             for p,n in [(.10,'600'),(.36,'800'),(.62,'1000'),(.88,'1400')])}
    <div style="position:absolute;left:{NEEDLE*100:.1f}%;top:-2px;width:3px;height:49px;background:#FF3B30;
        box-shadow:0 0 14px rgba(255,59,48,.9);"></div>
    <div style="position:absolute;left:{NEEDLE*100:.1f}%;top:-8px;width:12px;height:12px;margin-left:-4.5px;
        border-radius:50%;background:#FF3B30;box-shadow:0 0 14px rgba(255,59,48,.95);"></div>
  </div>
  <div style="position:absolute;left:32px;bottom:24px;">
    <span class=eb style="color:rgba(255,255,255,.48);font-size:10px;">Up next &middot; After Hours FM at 11pm</span>
  </div>""",
  note='The needle sits at the station\u2019s real place on the band — 810 of 530&ndash;1600.')

EDITORIAL2 = slot('E &middot; medium', 'Start Drive &mdash; the invitation', f"""
  <div style="position:absolute;inset:0;background:#0d0f14;"></div>
  <img src="data:image/jpeg;base64,{A['downtown']}" style="position:absolute;right:0;top:0;
      width:50%;height:100%;object-fit:cover;">
  <div style="position:absolute;right:0;top:0;width:50%;height:100%;background:
      linear-gradient(90deg,#0d0f14 0%,rgba(13,15,20,.55) 34%,rgba(13,15,20,0) 100%);"></div>
  <div style="position:absolute;left:32px;top:32px;right:352px;bottom:32px;display:flex;
      flex-direction:column;">
    <div class=eb style="color:#FF9A2E;font-size:10px;">Pick up where you left off</div>
    <div style="flex:1"></div>
    <div style="color:#fff;font-size:46px;font-weight:800;line-height:1.06;letter-spacing:-.02em;">Let&rsquo;s put<br>something on.</div>
    <div style="flex:1"></div>
    <div style="color:rgba(255,255,255,.62);font-size:24px;white-space:nowrap;">Garage &middot; Cassette</div>
  </div>
  <div style="position:absolute;right:32px;top:50%;transform:translateY(-50%);width:92px;height:92px;
      border-radius:50%;background:#fff;box-shadow:0 8px 22px rgba(0,0,0,.5);
      display:flex;align-items:center;justify-content:center;">
    <div style="width:0;height:0;margin-left:8px;border-left:30px solid #111;
        border-top:19px solid transparent;border-bottom:19px solid transparent;"></div>
  </div>""")

# ══════════════════════════════ J — the CD Player window ═══════════════════
# Owner: "make sure the card isn't [floating] inside the bubble. Create the
# Winamp as if it's the shape of the widget." So the window IS the widget: the
# title bar runs to all three edges and the bevel is the widget's own rim,
# rather than a little grey card sitting inside a rounded rectangle.
WINAMP = slot('J &middot; medium', 'CD Player &mdash; last played', f"""
  <div style="position:absolute;inset:0;background:
      linear-gradient(180deg,#dfe3e6 0%,#c3c7cb 14%,#c3c7cb 78%,#a8adb4 100%);"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:56px;
      background:linear-gradient(90deg,#7a4a12,#c2761a 62%,#e0a24e);
      display:flex;align-items:center;padding:0 8px 0 12px;">
    <div style="width:26px;height:26px;border-radius:50%;background:
        conic-gradient(from 20deg,#8fd8ff,#c9a7ff,#ffb4dc,#ffe1a3,#b9ffd9,#8fd8ff);
        box-shadow:inset 0 0 0 2px rgba(255,255,255,.6);position:relative;">
      <div style="position:absolute;inset:10px;border-radius:50%;background:#c3c7cb;"></div></div>
    <span class=px style="color:#fff;font-size:22px;margin-left:10px;">Cruise FM</span>
    <div style="margin-left:auto;display:flex;gap:4px;">
      {''.join(f'<div class=up style="width:32px;height:28px;display:flex;align-items:center;'
               f'justify-content:center;"><span class=px style="font-size:16px;color:#1b1f27;">{c}</span></div>'
               for c in ['_','[]','X'])}
    </div>
  </div>
  <div class=dn style="position:absolute;left:20px;top:74px;width:196px;height:196px;padding:6px;">
    <img src="data:image/jpeg;base64,{A['coastal']}" style="width:100%;height:100%;object-fit:cover;">
  </div>
  <div style="position:absolute;left:232px;right:20px;top:80px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span class=px style="font-size:19px;color:#1b1f27;width:74px;">Artist:</span>
      <div class=dn style="flex:1;height:48px;display:flex;align-items:center;padding:0 12px;">
        <span class=px style="font-size:23px;color:#0a0a0a;white-space:nowrap;overflow:hidden;
            text-overflow:ellipsis;">Foo Fighters</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;">
      <span class=px style="font-size:19px;color:#1b1f27;width:74px;">Track:</span>
      <div class=dn style="flex:1;height:48px;display:flex;align-items:center;padding:0 12px;">
        <span class=px style="font-size:23px;color:#0a0a0a;white-space:nowrap;overflow:hidden;
            text-overflow:ellipsis;">Everlong</span>
      </div>
    </div>
  </div>
  <div class=up style="position:absolute;left:232px;bottom:22px;width:104px;height:54px;
      display:flex;align-items:center;justify-content:center;">
    <div style="width:0;height:0;margin-left:4px;border-left:20px solid #1b1f27;
        border-top:13px solid transparent;border-bottom:13px solid transparent;"></div>
  </div>
  <div style="position:absolute;left:352px;bottom:22px;height:54px;display:flex;align-items:center;">
    <span class=px style="font-size:17px;color:#4a5058;">Garage &middot; 810 AM</span>
  </div>
  <!-- the edges: shading, never a rim. Each fades to nothing inward, so there
       is no boundary anywhere for the eye to read as a border. -->
  <div style="position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(180deg,rgba(255,255,255,.34) 0,transparent 22px),
      linear-gradient(0deg,rgba(0,0,0,.22) 0,transparent 36px),
      linear-gradient(90deg,rgba(255,255,255,.16) 0,transparent 26px),
      linear-gradient(270deg,rgba(0,0,0,.18) 0,transparent 30px);"></div>""")

# ══════════════════════════════ K — the player (new) ═══════════════════════
# Owner's idea, from a photo of an iPod. It is a good one and it fits the
# app's language exactly — but it is drawn as A player, not AS an iPod: no
# click wheel with four printed commands, no "MUSIC" header, different
# proportions. See the note under it.
PLAYER = slot('K &middot; medium', 'The Player &mdash; new, your idea', f"""
  <div style="position:absolute;inset:0;background:
      linear-gradient(158deg,#f2f3f5 0%,#d8dade 38%,#eceef1 62%,#c9ccd1 100%);"></div>
  <div style="position:absolute;inset:0;opacity:.5;background:repeating-linear-gradient(
      96deg,rgba(255,255,255,.5) 0 1px,rgba(0,0,0,.035) 1px 3px);"></div>
  <!-- the screen -->
  <div style="position:absolute;left:24px;top:26px;width:376px;bottom:26px;border-radius:8px;
      background:#0a0c12;box-shadow:inset 0 0 0 3px #9aa0a8, 0 3px 8px rgba(0,0,0,.35);
      overflow:hidden;">
    <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;left:14px;top:16px;
        width:152px;height:152px;object-fit:cover;border-radius:4px;">
    <div style="position:absolute;left:182px;right:14px;top:22px;">
      <div style="color:#fff;font-size:27px;font-weight:800;line-height:1.1;">Everlong</div>
      <div style="color:rgba(255,255,255,.66);font-size:19px;margin-top:8px;">Foo Fighters</div>
    </div>
    <div style="position:absolute;left:14px;right:14px;bottom:16px;display:flex;align-items:center;
        justify-content:space-between;">
      <span class=eb style="color:rgba(255,255,255,.5);font-size:9px;">Last played</span>
      <div style="display:flex;align-items:baseline;gap:4px;">
        <span class=seg style="font-size:14px;color:rgba(255,255,255,.62);">810</span>
        <span class=seg14 style="font-size:9px;color:rgba(255,255,255,.5);">AN</span></div>
    </div>
  </div>
  <!-- the control: a plain ring, deliberately NOT a click wheel -->
  <div style="position:absolute;right:52px;top:50%;transform:translateY(-50%);width:196px;height:196px;
      border-radius:50%;background:linear-gradient(150deg,#fbfbfc,#dcdfe3 55%,#c3c7cd);
      box-shadow:0 3px 10px rgba(0,0,0,.28), inset 0 1px 0 #fff;">
    <div style="position:absolute;inset:64px;border-radius:50%;
        background:linear-gradient(150deg,#eff1f3,#cdd1d6);
        box-shadow:inset 0 2px 5px rgba(0,0,0,.16), 0 1px 0 #fff;"></div>
  </div>""",
  note='Drawn as “a player”, not as an iPod — see the note in the reply.')

# ══════════════════════════════ smalls ═════════════════════════════════════
# Owner: "Increase the size of the vinyl and put the station number in the
# centre of the vinyl, and the name on the bottom. Remove the song name."
RECORD = slot('F &middot; small', 'The Record &mdash; on cream', f"""
  <div style="position:absolute;inset:0;background:{CREAM};"></div>
  <div style="position:absolute;inset:0;opacity:.4;background:repeating-linear-gradient(
      92deg,rgba(0,0,0,.022) 0 2px,transparent 2px 5px);"></div>
  <div style="position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:258px;height:258px;">
    {grooves(258, 80, compact_label())}
  </div>
  <div style="position:absolute;left:0;right:0;bottom:14px;text-align:center;">
    <span style="color:#1b1f27;font-size:17px;font-weight:800;">Garage</span>
  </div>""", 's')

# Owner: "Mirror ball needs to reflect the same as it is on the app."
BALL = slot('H &middot; small', 'Mirror Ball', f"""
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,#191c26,#05060a 76%);"></div>
  {''.join(f'<div style="position:absolute;left:50%;top:30px;width:1px;height:{h}px;'
           f'background:linear-gradient(180deg,rgba(214,230,255,{o}),transparent);'
           f'transform-origin:top center;transform:rotate({a}deg);"></div>'
           for a,h,o in [(-74,320,.15),(-48,340,.10),(-20,320,.13),(14,340,.09),(42,320,.14),(68,340,.10)])}
  <div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);width:2px;height:30px;
      background:rgba(255,255,255,.30);"></div>
  <div style="position:absolute;left:50%;top:34px;transform:translateX(-50%);
      filter:drop-shadow(0 0 34px rgba(190,215,255,.34));">{BALLGEN.ball_svg(228)}</div>
  <div style="position:absolute;left:0;right:0;bottom:14px;text-align:center;">
    <span style="color:#fff;font-size:17px;font-weight:800;">Garage</span>
  </div>""", 's')

# Owner: "the CD Mode should remove all texts — place only the last played song
# on the CD and don't forget the case it usually is in."
CD = slot('I &middot; small', 'CD', f"""
  <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1c1f26,#080a0e);"></div>
  <!-- THE CASE. A jewel case is a hard rectangle with a hinge spine down one
       side and four corner posts holding the tray — those are what make it
       read as a case rather than a pane of glass over a disc. -->
  <div style="position:absolute;left:14px;top:14px;right:14px;bottom:14px;border-radius:4px;
      background:linear-gradient(148deg,rgba(255,255,255,.16),rgba(255,255,255,.02) 44%,rgba(255,255,255,.10));
      box-shadow:inset 0 0 0 2px rgba(255,255,255,.30), 0 12px 26px rgba(0,0,0,.66);">
    <!-- hinge spine -->
    <div style="position:absolute;left:0;top:0;bottom:0;width:30px;border-right:1px solid rgba(255,255,255,.20);
        background:linear-gradient(90deg,rgba(255,255,255,.16),rgba(255,255,255,.04));"></div>
    {''.join(f'<div style="position:absolute;left:5px;top:{t}px;width:20px;height:34px;border-radius:2px;'
             f'background:linear-gradient(160deg,rgba(255,255,255,.26),rgba(255,255,255,.06));'
             f'box-shadow:inset 0 0 0 1px rgba(255,255,255,.24);"></div>' for t in (26,112,198))}
    <!-- corner posts -->
    {''.join(f'<div style="position:absolute;{v}:7px;{h}:7px;width:20px;height:20px;'
             f'border-{v}:2.5px solid rgba(255,255,255,.34);border-{h}:2.5px solid rgba(255,255,255,.34);'
             f'border-radius:3px;"></div>' for v,h in [('top','left'),('top','right'),('bottom','left'),('bottom','right')])}
    <!-- the plastic's own highlight, a single diagonal sweep -->
    <div style="position:absolute;inset:0;border-radius:4px;background:
        linear-gradient(128deg,rgba(255,255,255,.20) 4%,transparent 26%,transparent 74%,rgba(255,255,255,.10) 96%);
        pointer-events:none;"></div>
  </div>
  <!-- the disc: the last played cover, and nothing written anywhere -->
  <div style="position:absolute;left:53%;top:50%;transform:translate(-50%,-50%);width:210px;height:210px;
      border-radius:50%;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.7);">
    <img src="data:image/jpeg;base64,{A['coastal']}" style="position:absolute;inset:0;width:100%;
        height:100%;object-fit:cover;filter:saturate(1.1) brightness(.86);">
    <div style="position:absolute;inset:0;background:conic-gradient(from 20deg,
        rgba(106,208,255,.85),rgba(185,140,255,.85),rgba(255,154,208,.85),rgba(255,214,138,.85),
        rgba(168,255,207,.85),rgba(106,208,255,.85));mix-blend-mode:overlay;"></div>
    <div style="position:absolute;inset:0;background:repeating-radial-gradient(circle,
        rgba(255,255,255,.06) 0 2px,transparent 2px 4px);"></div>
    <div style="position:absolute;inset:0;background:
        linear-gradient(120deg,rgba(255,255,255,.34) 5%,transparent 28%,transparent 68%,rgba(255,255,255,.20) 92%);"></div>
    <div style="position:absolute;inset:72px;border-radius:50%;background:rgba(222,228,238,.60);
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.45);"></div>
    <div style="position:absolute;inset:90px;border-radius:50%;background:#090a0e;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);"></div>
  </div>""", 's')

html = (f"<html><head><meta charset=utf-8><style>{CSS}</style></head><body>"
        + WINAMP + C1 + C2 + STUB + EDITORIAL2 + DIAL + PLAYER + RECORD + BALL + CD + "</body></html>")
pathlib.Path(os.environ.get('OUT', 'widgets.html')).write_text(html)
print('built round 3')
