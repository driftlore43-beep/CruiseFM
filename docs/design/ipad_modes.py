"""
To-scale layout preview of the eight fullscreen visual modes, phone vs iPad.

This is a PROPORTION DIAGRAM, not a render of the app. Every hero size below
is computed with the SAME expression the component uses, so the sizes and the
empty space are true; the artwork inside each hero is a stand-in shape.

The point it answers (owner, 11.09: "show the enlarged size of the visual
modes before we ship this OTA"): each mode caps its hero so it cannot blow up
on a tablet, but the CHROME — play button, skip icons, song title — is a fixed
phone-sized cluster. On an iPad that leaves the scene marooned in the middle
with small controls beneath it. Both screens are drawn at the same scale, so
what you are comparing is real physical size.

RUN: python3 docs/design/ipad_modes.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

SS = 2                      # supersample
SCALE = 0.40                # points -> display px (before SS)

PHONE = (390, 844)          # iPhone 14/15
IPAD = (834, 1194)          # iPad Pro 11" portrait

# ── the real chrome, which does NOT scale with the screen ───────────────────
PLAY_D = 80                 # EqualizerMode.playBtn 80x80
SKIP_D = 48                 # MaterialCommunityIcons skip-previous/next 48
TITLE_PT = 24               # song title
ARTIST_PT = 15

FONT_DIRS = ['/usr/share/fonts', os.path.expanduser('~/.fonts')]


def _find(names):
    for root in FONT_DIRS:
        for dirpath, _, files in os.walk(root):
            for f in files:
                if f in names:
                    return os.path.join(dirpath, f)
    return None


F_REG = _find({'DejaVuSans.ttf'}) or ''
F_BOLD = _find({'DejaVuSans-Bold.ttf'}) or F_REG


def font(pt):
    return ImageFont.truetype(F_BOLD, max(1, int(pt)))


def font_r(pt):
    return ImageFont.truetype(F_REG, max(1, int(pt)))


# ── hero size per mode, transcribed from the components ────────────────────
def heroes(w, h):
    """Returns {mode: (kind, width, height, label)} in POINTS."""
    mn = min
    cas = mn(w * 0.92, cap_for('Cassette', 560))
    cd = mn(w * 0.97, h * 0.47, cap_for('CD', 430))
    vin = mn(w * 0.9, h * 0.46, cap_for('Vinyl', 430))
    orb = mn(w * 1.02, h * 0.54, cap_for('Circular EQ', 460))
    ball = mn(w * 0.71, h * 0.39, cap_for('Mirror Ball', 340))
    tun = mn(w - 32, cap_for('Tuner', 420))
    return {
        'Cassette': ('rect', cas, cas * 0.638, f'cap {int(cap_for("Cassette", 560))}'),
        'Vinyl': ('circle', vin, vin, f'cap {int(cap_for("Vinyl", 430))}'),
        'CD': ('square', cd, cd, f'cap {int(cap_for("CD", 430))}'),
        'Circular EQ': ('circle', orb, orb, f'cap {int(cap_for("Circular EQ", 460))}'),
        'Mirror Ball': ('circle', ball, ball, f'cap {int(cap_for("Mirror Ball", 340))}'),
        'Equalizer': ('bars', w - 48, round(h * 0.285), 'no cap'),
        'Tuner': ('tuner', tun, 150, f'readout cap {int(cap_for("Tuner", 420))}'),
        'Horizon': ('full', w, h, 'full bleed'),
    }


ORDER = ['Cassette', 'Vinyl', 'CD', 'Circular EQ',
         'Mirror Ball', 'Equalizer', 'Tuner', 'Horizon']

# ── a PROPOSED set of tablet caps, for the owner to compare against ────────
# Roughly x1.3, chosen so each hero lands near 70-80% of an iPad's width —
# the same presence it has on a phone, without going full-bleed.
BIGGER = {
    'Cassette': 690, 'Vinyl': 560, 'CD': 560,
    'Circular EQ': 600, 'Mirror Ball': 470, 'Tuner': 560,
}
PROPOSE = False          # flipped by the second sheet


def cap_for(mode, current):
    return BIGGER.get(mode, current) if PROPOSE else current

TINT = (255, 61, 240)
TINT2 = (51, 225, 255)


def draw_screen(d, ox, oy, wpt, hpt, mode, s):
    """Draw one device screen to scale at (ox,oy) in supersampled px."""
    def P(v):
        return v * s

    W, H = P(wpt), P(hpt)
    # screen body
    d.rounded_rectangle([ox, oy, ox + W, oy + H], radius=P(26),
                        fill=(18, 18, 24), outline=(90, 92, 105), width=max(1, int(P(1.4))))

    kind, hw, hh, _lab = heroes(wpt, hpt)[mode]
    cx = ox + W / 2

    # The scene sits in a flex:1 region above the chrome and is CENTRED in it,
    # which is what every mode's layout does — so the leftover air splits above
    # and below the hero rather than all falling underneath it.
    base = oy + H - P(120)
    region_top = oy + P(74)
    region_bot = base - P(74)
    hero_top = region_top + ((region_bot - region_top) - P(hh)) / 2
    air_pt = ((region_bot - region_top) - P(hh)) / s

    # ── the air left over around a capped hero, shaded so it is countable ──
    if kind != 'full' and air_pt > 40:
        for y0, y1 in ((region_top, hero_top), (hero_top + P(hh), region_bot)):
            if y1 - y0 > P(6):
                d.rectangle([ox + P(5), y0, ox + W - P(5), y1], fill=(38, 30, 26))
        d.text((cx, region_top + (hero_top - region_top) / 2),
               f'{int(air_pt)}pt of air', font=font(P(13)),
               fill=(214, 142, 104), anchor='mm')

    # ── the hero ──
    if kind == 'full':
        d.rounded_rectangle([ox + P(2), oy + P(2), ox + W - P(2), oy + H - P(2)],
                            radius=P(24), fill=(26, 24, 46))
        for i in range(7):
            yy = oy + H * (0.34 + i * 0.032)
            d.line([ox + P(6), yy, ox + W - P(6), yy],
                   fill=(60 + i * 20, 40 + i * 9, 90 + i * 16), width=max(1, int(P(3))))
    elif kind == 'bars':
        bw = (wpt - 48 - 29 * 2) / 30
        for i in range(30):
            bx = ox + P(24) + i * P(bw + 2)
            bh = P(hh) * (0.35 + 0.55 * abs(((i * 7) % 11) / 11 - 0.5) * 2)
            d.rectangle([bx, hero_top + P(hh) - bh, bx + P(bw), hero_top + P(hh)],
                        fill=TINT if i % 3 else TINT2)
    elif kind == 'tuner':
        rh = P(hh) * 0.52
        d.rounded_rectangle([cx - P(hw) / 2, hero_top, cx + P(hw) / 2, hero_top + rh],
                            radius=P(10), fill=(22, 30, 40), outline=TINT2, width=max(1, int(P(1.5))))
        # the dial ruler runs the FULL width — the mismatch worth seeing
        dy = hero_top + P(hh) * 0.82
        d.line([ox + P(4), dy, ox + W - P(4), dy], fill=(120, 124, 140), width=max(1, int(P(2))))
        n = max(1, int(wpt / 26))
        for i in range(n + 1):
            x = ox + P(4) + i * (W - P(8)) / n
            d.line([x, dy - P(7), x, dy + P(7)], fill=(150, 154, 170), width=max(1, int(P(1.4))))
    elif kind == 'rect':
        d.rounded_rectangle([cx - P(hw) / 2, hero_top, cx + P(hw) / 2, hero_top + P(hh)],
                            radius=P(10), fill=(52, 56, 70), outline=(200, 205, 220), width=max(1, int(P(1.6))))
        for rx in (-0.22, 0.22):
            d.ellipse([cx + P(hw) * rx - P(hh) * 0.20, hero_top + P(hh) * 0.30,
                       cx + P(hw) * rx + P(hh) * 0.20, hero_top + P(hh) * 0.70],
                      outline=TINT, width=max(1, int(P(2))))
    else:  # circle / square
        box = [cx - P(hw) / 2, hero_top, cx + P(hw) / 2, hero_top + P(hh)]
        if kind == 'square':
            d.rounded_rectangle(box, radius=P(14), fill=(40, 42, 56),
                                outline=(170, 175, 195), width=max(1, int(P(1.6))))
            inset = P(hw) * 0.075
            d.ellipse([box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset],
                      fill=(70, 66, 88), outline=(210, 200, 225), width=max(1, int(P(1.4))))
        else:
            d.ellipse(box, fill=(48, 44, 66), outline=TINT, width=max(1, int(P(2))))
            d.ellipse([cx - P(hw) * 0.10, (box[1] + box[3]) / 2 - P(hw) * 0.10,
                       cx + P(hw) * 0.10, (box[1] + box[3]) / 2 + P(hw) * 0.10],
                      fill=(24, 22, 34), outline=(180, 180, 200), width=max(1, int(P(1.2))))

    # ── the chrome: FIXED point sizes, identical on both devices ──
    d.text((cx, base - P(52)), 'Waking Up In Vegas', font=font(P(TITLE_PT) * 0.82),
           fill=(240, 240, 248), anchor='mm')
    d.text((cx, base - P(28)), 'Katy Perry', font=font_r(P(ARTIST_PT) * 0.82),
           fill=(170, 172, 186), anchor='mm')
    d.line([ox + P(28), base, ox + W - P(28), base], fill=(70, 72, 86), width=max(1, int(P(4))))
    d.line([ox + P(28), base, ox + P(28) + (W - P(56)) * 0.42, base],
           fill=(240, 240, 250), width=max(1, int(P(4))))
    ty = base + P(46)
    d.ellipse([cx - P(PLAY_D) / 2, ty - P(PLAY_D) / 2, cx + P(PLAY_D) / 2, ty + P(PLAY_D) / 2],
              fill=(255, 255, 255))
    for sx in (-1, 1):
        bx = cx + sx * P(96)
        d.polygon([(bx - sx * P(SKIP_D) * 0.22, ty), (bx + sx * P(SKIP_D) * 0.22, ty - P(SKIP_D) * 0.24),
                   (bx + sx * P(SKIP_D) * 0.22, ty + P(SKIP_D) * 0.24)], fill=(235, 235, 245))
    return hw, hh, max(0, air_pt)


def panel(mode, s):
    """One mode: phone and iPad side by side, same scale."""
    pad = int(22 * SS)
    cap = int(52 * SS)
    pw, ph = PHONE[0] * s, PHONE[1] * s
    iw, ih = IPAD[0] * s, IPAD[1] * s
    W = int(pad * 3 + pw + iw)
    H = int(cap + pad + ih + pad + 52 * SS)
    im = Image.new('RGB', (W, H), (14, 14, 17))
    d = ImageDraw.Draw(im)

    hero_p = heroes(*PHONE)[mode]
    hero_i = heroes(*IPAD)[mode]
    d.text((pad, int(9 * SS)), mode, font=font(24 * SS), fill=(236, 236, 242))
    d.text((pad, int(34 * SS)),
           f'hero {int(hero_p[1])}pt \u2192 {int(hero_i[1])}pt   ({hero_i[3]})',
           font=font_r(15 * SS), fill=(150, 152, 166))

    y = cap + pad + (ih - ph)          # sit both on the same baseline
    draw_screen(d, pad, y, *PHONE, mode, s)
    _hw, _hh, air = draw_screen(d, pad * 2 + pw, cap + pad, *IPAD, mode, s)

    d.text((pad, H - int(30 * SS)), 'iPhone  390pt', font=font_r(15 * SS), fill=(130, 132, 146))
    note = 'fills the screen' if hero_i[0] == 'full' else (
        f'{int(air)}pt of empty air' if air > 40 else 'well filled')
    d.text((pad * 2 + pw, H - int(30 * SS)), f'iPad  834pt  \u2014  {note}',
           font=font_r(15 * SS), fill=(225, 150, 110) if air > 40 else (130, 190, 140))
    return im


if __name__ == '__main__':
    s = SCALE * SS
    panels = [panel(m, s) for m in ORDER]
    cw = max(p.width for p in panels)
    chh = max(p.height for p in panels)
    cols, rows = 4, 2
    sheet = Image.new('RGB', (cw * cols, chh * rows), (14, 14, 17))
    for i, p in enumerate(panels):
        sheet.paste(p, ((i % cols) * cw, (i // cols) * chh))
    sheet = sheet.resize((sheet.width // SS, sheet.height // SS), Image.LANCZOS)

    out = '/opt/cursor/artifacts/screenshots/ipad_modes_scale.png'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)

    # ── second sheet: iPad today vs iPad with the proposed bigger caps ──
    def ipad_only(mode, s, label, colour):
        pad = int(20 * SS)
        cap = int(52 * SS)
        iw, ih = IPAD[0] * s, IPAD[1] * s
        im = Image.new('RGB', (int(iw + pad * 2), int(cap + ih + pad + 34 * SS)), (14, 14, 17))
        dd2 = ImageDraw.Draw(im)
        hw = heroes(*IPAD)[mode][1]
        dd2.text((pad, int(9 * SS)), mode, font=font(23 * SS), fill=(236, 236, 242))
        dd2.text((pad, int(33 * SS)), f'{label}  \u2014  {int(hw)}pt  ({hw / IPAD[0] * 100:.0f}% of width)',
                 font=font_r(15 * SS), fill=colour)
        draw_screen(dd2, pad, cap, *IPAD, mode, s)
        return im

    pairs = []
    for m in ['Cassette', 'Vinyl', 'CD', 'Circular EQ', 'Mirror Ball', 'Tuner']:
        PROPOSE = False
        a = ipad_only(m, s, 'NOW', (150, 152, 166))
        PROPOSE = True
        b = ipad_only(m, s, 'PROPOSED', (130, 200, 150))
        pairs.append((a, b))
    PROPOSE = False

    pwid = pairs[0][0].width
    phgt = pairs[0][0].height
    gap = int(10 * SS)
    cols = 3
    rows = 2
    cellw = pwid * 2 + gap
    sh2 = Image.new('RGB', (cellw * cols + gap * (cols + 1),
                            phgt * rows + gap * (rows + 1)), (9, 9, 11))
    for i, (a, b) in enumerate(pairs):
        cxp = gap + (i % cols) * (cellw + gap)
        cyp = gap + (i // cols) * (phgt + gap)
        sh2.paste(a, (cxp, cyp))
        sh2.paste(b, (cxp + pwid + gap, cyp))
    sh2 = sh2.resize((sh2.width // SS, sh2.height // SS), Image.LANCZOS)
    out2 = '/opt/cursor/artifacts/screenshots/ipad_modes_now_vs_proposed.png'
    sh2.save(out2)
    print('saved', out2, sh2.size)
    print('saved', out, sheet.size)
    print(f'{"mode":13s} {"phone":>7s} {"iPad":>7s}  {"% of iPad width":>16s}   note')
    for m in ORDER:
        kind, hw, _hh, lab = heroes(*IPAD)[m]
        _k, pw2, _ph2, _l = heroes(*PHONE)[m]
        print(f'  {m:12s} {int(pw2):5d}pt {int(hw):5d}pt {hw / IPAD[0] * 100:13.0f}%   {lab}')
