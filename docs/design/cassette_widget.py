"""
Comparison sheet for the CASSETTE widget's shell, drawn the way CassetteMode
draws it — a design-tooling harness, NOT app code. It renders four cassettes
side by side onto the same blurred station photo so the owner can judge a
direction before another build goes out, the same way cd_widget.py lets her
pick a disc.

Every layer is ported from CassetteBody / ReelHub in
src/components/CassetteMode.tsx, in the same order and with the same numbers:
the translucent glass shell, the internal chassis, the tape path, the two
wound tape packs (left near-full, right mid-play), the reel hubs with their
inward teeth, the iridescent glass sheen, the tape-guide assembly, the busy
bottom-edge mechanism (head window, pinch rollers, capstans, locating holes),
the frosted label and its text, the broad glass reflections, the moulded
triple edge, and the five recessed screws.

House rules kept from the CD (docs/design/cd_widget.py):
  - the SHELL carries no hue: it is neutral clear polycarbonate, and the only
    colour is the station tint LIVING IN THE HARDWARE (pink flanges, pink tape
    tint, pink label spine). The light slides across as near-white sheen.
  - light effects fade to nothing at their edges.
  - Pillow + numpy at 4x supersample, with screen()/over() blend helpers.

Four panels:
  A  current       — faithful reproduction of the shipping shell.
  B  truer         — same graphics, a truer compact-cassette aspect (~1.57:1)
                     with larger, better-spaced reels that fill the window.
  C  refined       — A's dimensions, better graphics: crisper hubs, a cleaner
                     ticked label, a larger head window, subtler screws, and a
                     convincing dual light sweep + top glass highlight.
  D  recommended   — B's proportions with C's graphics.

RUN: python3 docs/design/cassette_widget.py
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 4                       # supersample
OUT = 2                      # final panels are 2x logical
PANEL_W = 500                # logical panel size
PANEL_H = 340
BODY_TARGET_W = 404          # logical shell-body width, constant across panels
BACKDROP = 'targets/widgets/night-run.jpg'

STATION = '#FF3DF0'          # night-run's neon pink — the hardware tint
ACCENT = '#33E1FF'           # secondary, for the flange arc

FONT_DIR = '/usr/share/fonts/truetype/jetbrains-mono/'
F_XBOLD = FONT_DIR + 'JetBrainsMono-ExtraBold.ttf'
F_BOLD = FONT_DIR + 'JetBrainsMono-Bold.ttf'
F_MED = FONT_DIR + 'JetBrainsMono-Medium.ttf'
F_REG = FONT_DIR + 'JetBrainsMono-Regular.ttf'


def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgba(h, op):
    r, g, b = hexc(h)
    return (int(r * 255), int(g * 255), int(b * 255), max(0, min(255, int(op * 255))))


# ── blend helpers, same as cd_widget ─────────────────────────────────────────
def over(dst, src, a):
    return dst * (1 - a[..., None]) + src * a[..., None]


def screen(dst, src, a):
    s = 1 - (1 - dst) * (1 - src)
    return dst * (1 - a[..., None]) + s * a[..., None]


# ── per-variant geometry ─────────────────────────────────────────────────────
def make_cfg(variant):
    """All coordinates in the SVG viewBox space CassetteMode uses."""
    if variant in ('A', 'C'):
        VBH = 210
    else:  # B, D — nudged toward a real compact cassette (~1.57:1)
        VBH = 217
    bodyX, bodyY = 8, 8
    bodyW = 324
    bodyH = VBH - 16
    VBW = 340
    bottom = bodyY + bodyH                    # body's bottom edge
    dy = bottom - 202                          # how far the mechanism drops
    cx = bodyX + bodyW / 2                      # 170
    # reels sit centred between the label's bottom and the mechanism
    RY = bodyY + (bodyH + 26) / 2
    if variant in ('A', 'C'):
        LX, RX, PACK = 118, 224, 104
    else:  # B, D — wider spread, fatter packs to fill the window
        spread = 118
        LX, RX = cx - spread / 2, cx + spread / 2
        PACK = 116
    return {
        'variant': variant,
        'refined': variant in ('C', 'D'),
        'VBW': VBW, 'VBH': VBH,
        'bodyX': bodyX, 'bodyY': bodyY, 'bodyW': bodyW, 'bodyH': bodyH, 'bodyR': 10,
        'bottom': bottom, 'dy': dy, 'cx': cx,
        'LX': LX, 'RX': RX, 'RY': RY, 'PACK': PACK,
        'hubDia': PACK * (48.0 / 104.0),       # hub scales with the pack
        'tapeY': bottom - 34,                  # bottom run of the tape path
    }


# ── the transform: VB space -> supersampled pixels, body centred in panel ─────
class Pen:
    def __init__(self, cfg, wpx, hpx):
        self.cfg = cfg
        self.wpx, self.hpx = wpx, hpx
        self.s = (BODY_TARGET_W * SS) / cfg['bodyW']
        self.ox = wpx / 2 - (cfg['VBW'] / 2) * self.s
        self.oy = hpx / 2 - (cfg['VBH'] / 2) * self.s
        self.ov = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.ov)

    def T(self, x, y):
        return (self.ox + x * self.s, self.oy + y * self.s)

    def _w(self, w):
        return max(1, int(round(w * self.s)))

    def rrect(self, x, y, w, h, r, fill=None, outline=None, width=1.0):
        x0, y0 = self.T(x, y)
        x1, y1 = self.T(x + w, y + h)
        self.d.rounded_rectangle([x0, y0, x1, y1], radius=r * self.s,
                                 fill=fill, outline=outline,
                                 width=self._w(width) if outline else 1)

    def rect(self, x, y, w, h, fill=None, outline=None, width=1.0):
        x0, y0 = self.T(x, y)
        x1, y1 = self.T(x + w, y + h)
        self.d.rectangle([x0, y0, x1, y1], fill=fill, outline=outline,
                         width=self._w(width) if outline else 1)

    def circle(self, cx, cy, r, fill=None, outline=None, width=1.0):
        x0, y0 = self.T(cx - r, cy - r)
        x1, y1 = self.T(cx + r, cy + r)
        self.d.ellipse([x0, y0, x1, y1], fill=fill, outline=outline,
                       width=self._w(width) if outline else 1)

    def arc(self, cx, cy, r, a0, a1, col, width=1.0):
        x0, y0 = self.T(cx - r, cy - r)
        x1, y1 = self.T(cx + r, cy + r)
        self.d.arc([x0, y0, x1, y1], a0, a1, fill=col, width=self._w(width))

    def line(self, x1, y1, x2, y2, col, width=1.0):
        self.d.line([self.T(x1, y1), self.T(x2, y2)], fill=col,
                    width=self._w(width))

    def polyline(self, pts, col, width=1.0):
        self.d.line([self.T(*p) for p in pts], fill=col, width=self._w(width),
                    joint='curve')

    def poly(self, pts, fill=None, outline=None, width=1.0):
        p = [self.T(*q) for q in pts]
        self.d.polygon(p, fill=fill, outline=outline, width=self._w(width) if outline else 1)

    def text(self, x, y, s, size, font, col, anchor='ls', tracking=0.0):
        f = ImageFont.truetype(font, int(round(size * self.s)))
        px, py = self.T(x, y)
        if tracking == 0.0:
            self.d.text((px, py), s, font=f, fill=col, anchor=anchor)
            return
        # manual letter tracking (mono caps read better with air between them)
        tr = tracking * self.s
        widths = [self.d.textlength(ch, font=f) for ch in s]
        total = sum(widths) + tr * (len(s) - 1)
        if anchor[0] == 'r':
            cur = px - total
        elif anchor[0] == 'm':
            cur = px - total / 2
        else:
            cur = px
        for ch, w in zip(s, widths):
            self.d.text((cur, py), ch, font=f, fill=col, anchor='l' + anchor[1])
            cur += w + tr


# ── the reel hub (ReelHub), drawn in VB space around a reel centre ────────────
def draw_hub(pen, ccx, ccy, hub_dia, color, accent, refined):
    hs = hub_dia / 48.0                       # -24..24 hub units -> VB units
    HUB = '#eef2fb'

    def hx(x): return ccx + x * hs
    def hy(y): return ccy + y * hs
    def C(x, y, r, **k): pen.circle(hx(x), hy(y), r * hs, **k)

    # clear station-tinted flange
    C(0, 0, 19, fill=rgba(color, 0.34))
    C(0, 0, 19, outline=rgba('#ffffff', 0.45 if refined else 0.34), width=1.0 * hs)
    # bright moulding arc(s)
    pen.arc(hx(0), hy(0), 19 * hs, 205, 292, rgba('#ffffff', 0.55 if refined else 0.5),
            width=(2.0 if refined else 1.8) * hs)
    if refined:
        pen.arc(hx(0), hy(0), 19 * hs, 40, 96, rgba(accent, 0.35), width=1.4 * hs)
    # white hub disc + moulding rings
    C(0, 0, 14.5, fill=rgba(HUB, 0.94 if refined else 0.92))
    C(0, 0, 14.5, outline=rgba('#05070e', 0.24 if refined else 0.20), width=0.9 * hs)
    C(0, 0, 11.6, outline=rgba('#05070e', 0.15 if refined else 0.13), width=0.7 * hs)
    # spindle hole
    C(0, 0, 9.4, fill=rgba('#05070e', 0.94))
    # six teeth standing INTO the hole
    for deg in range(0, 360, 60):
        a = math.radians(deg)
        cs, sn = math.cos(a), math.sin(a)
        corners = [(-1.85, -9.9), (1.85, -9.9), (1.85, -4.5), (-1.85, -4.5)]
        pts = []
        for px, py in corners:
            rx = px * cs - py * sn
            ry = px * sn + py * cs
            pts.append((hx(rx), hy(ry)))
        pen.d.polygon([pen.T(*p) for p in pts], fill=rgba(HUB, 0.96 if refined else 0.94))
    C(0, 0, 4.3, fill=rgba('#05070e', 1.0))
    C(0, 0, 9.4, outline=rgba('#ffffff', 0.24 if refined else 0.22), width=0.6 * hs)
    if refined:
        # a crisp specular pip on the top-left of the flange
        C(-8.5, -8.5, 1.5, fill=rgba('#ffffff', 0.5))


# ── a recessed Phillips screw in neutral steel ────────────────────────────────
def draw_screw(pen, cx, cy, r, angle, refined):
    op = 0.42 if refined else 0.62            # subtler screws when refined
    seat = 0.30 if refined else 0.40
    pen.circle(cx, cy, r + 1.2, fill=rgba('#05070e', seat))
    pen.circle(cx, cy, r, outline=rgba('#ffffff', 0.40 if refined else 0.55), width=1.1)
    pen.circle(cx, cy, r * 0.62, fill=rgba('#ffffff', 0.10))
    a = math.radians(angle)
    s = r * 0.6
    cs, sn = math.cos(a), math.sin(a)
    pen.line(cx - s * cs, cy - s * sn, cx + s * cs, cy + s * sn, rgba('#ffffff', op), 1.2)
    pen.line(cx + s * sn, cy - s * cs, cx - s * sn, cy + s * cs, rgba('#ffffff', op), 1.2)


# ── numpy backdrop ────────────────────────────────────────────────────────────
def backdrop(wpx, hpx):
    im = Image.open(BACKDROP).convert('RGB')
    scale = max(wpx / im.width, hpx / im.height)
    im = im.resize((int(im.width * scale) + 1, int(im.height * scale) + 1), Image.LANCZOS)
    left = (im.width - wpx) // 2
    top = (im.height - hpx) // 2
    im = im.crop((left, top, left + wpx, top + hpx))
    im = im.filter(ImageFilter.GaussianBlur(10 * SS))
    img = np.asarray(im).astype(float) / 255.0
    # a light scrim so the glass reads without sinking the whole scene
    img = img * 0.74
    return img


# ── the whole cassette on its backdrop, returned as a float image ─────────────
def render_panel(variant, wpx, hpx):
    cfg = make_cfg(variant)
    pen = Pen(cfg, wpx, hpx)                   # pre-glass vector layer
    refined = cfg['refined']
    color, accent = STATION, ACCENT
    s = pen.s

    img = backdrop(wpx, hpx)

    # VB-space coordinates for every pixel (for numpy shell fill + sheen)
    yy, xx = np.mgrid[0:hpx, 0:wpx].astype(float)
    VBX = (xx - pen.ox) / s
    VBY = (yy - pen.oy) / s
    bx, by, bw, bh, br = cfg['bodyX'], cfg['bodyY'], cfg['bodyW'], cfg['bodyH'], cfg['bodyR']

    # body mask (rounded rect, anti-aliased) in pixel space
    mimg = Image.new('L', (wpx, hpx), 0)
    md = ImageDraw.Draw(mimg)
    x0, y0 = pen.T(bx, by)
    x1, y1 = pen.T(bx + bw, by + bh)
    md.rounded_rectangle([x0, y0, x1, y1], radius=br * s, fill=255)
    body_mask = np.asarray(mimg).astype(float) / 255.0

    # ── soft cast shadow of the shell onto the scene ──
    sh = Image.new('L', (wpx, hpx), 0)
    ImageDraw.Draw(sh).rounded_rectangle(
        [x0 + 6 * SS, y0 + 12 * SS, x1 + 6 * SS, y1 + 14 * SS], radius=br * s, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(10 * SS))
    sha = np.asarray(sh).astype(float) / 255.0 * 0.55
    img = over(img, np.zeros_like(img), sha)

    # ── faint neon-pink atmosphere behind the shell (never on the shell) ──
    gl = Image.new('L', (wpx, hpx), 0)
    ImageDraw.Draw(gl).ellipse(
        [x0 - 40 * SS, (y0 + y1) / 2 - 90 * SS, x1 + 40 * SS, (y0 + y1) / 2 + 90 * SS], fill=90)
    gl = gl.filter(ImageFilter.GaussianBlur(34 * SS))
    gla = np.asarray(gl).astype(float) / 255.0 * (1 - body_mask)
    img = screen(img, np.ones_like(img) * np.array(hexc(color)), gla * 0.5)

    # ── shell body: faint vertical cool-white glass gradient ──
    t = np.clip((VBY - by) / bh, 0, 1)
    stops = [(0.0, hexc('#e8eeff'), 0.30), (0.45, hexc('#9fb0d4'), 0.16), (1.0, hexc('#dbe4ff'), 0.26)]
    gc = np.zeros((hpx, wpx, 3)); ga = np.zeros((hpx, wpx))
    for i in range(len(stops) - 1):
        l0, c0, a0 = stops[i]; l1, c1, a1 = stops[i + 1]
        m = (t >= l0) & (t <= l1)
        u = np.zeros_like(t)
        if l1 > l0: u[m] = (t[m] - l0) / (l1 - l0)
        for k in range(3):
            gc[..., k][m] = c0[k] + (c1[k] - c0[k]) * u[m]
        ga[m] = a0 + (a1 - a0) * u[m]
    img = over(img, gc, ga * body_mask)

    # ── pre-glass vector layer: chassis, tape path, packs, hubs ──
    # internal chassis + centre line
    pen.rrect(60, 30, 220, cfg['bodyH'] - 30 - 22 + (cfg['dy']), 6,
              outline=rgba('#ffffff', 0.13), width=1.0)
    pen.line(171, 30, 171, cfg['tapeY'], rgba('#ffffff', 0.10), 1.0)

    LX, RX, RY, PACK = cfg['LX'], cfg['RX'], cfg['RY'], cfg['PACK']
    tapeY = cfg['tapeY']
    # tape path (drawn before packs so it emerges from under them)
    pen.polyline([(LX, RY), (74, tapeY), (268, tapeY), (RX, RY)], rgba('#0a0c14', 0.62), 3.4)
    pen.line(74, tapeY, 268, tapeY, rgba(color, 0.34), 1.0)

    def draw_pack(cxp, scale):
        r = (PACK / 2) * scale
        pen.circle(cxp, RY, r, fill=rgba('#3a2a18', 0.97))
        pen.circle(cxp, RY, r, fill=rgba(color, 0.10))
        for i in range(9):
            rr = r * (0.42 + 0.065 * i)
            if rr < r:
                pen.circle(cxp, RY, rr, outline=rgba('#ffffff', 0.075), width=0.7)
        pen.circle(cxp, RY, r, outline=rgba(color, 0.42), width=1.0)

    draw_pack(LX, 1.0)                          # left near-full
    draw_pack(RX, 0.62)                          # right mid-play, smaller
    draw_hub(pen, LX, RY, cfg['hubDia'], color, accent, refined)
    draw_hub(pen, RX, RY, cfg['hubDia'], color, accent, refined)

    # composite the pre-glass vector layer
    ov = np.asarray(pen.ov).astype(float) / 255.0
    img = over(img, ov[..., :3], ov[..., 3])

    # ── iridescent glass sheen (near-neutral light sliding across plastic) ──
    cxr, cyr = bx + bw / 2, by + bh / 2
    th = math.radians(-18)
    perp = -math.sin(th) * (VBX - cxr) + math.cos(th) * (VBY - cyr)
    sheen = np.zeros((hpx, wpx))
    for i in range(6):
        p = -70 + i * 30
        sheen += 0.09 * np.exp(-((perp - p) / 20.0) ** 2)
    if refined:
        # a second, broader crossing sweep + a bright top glass highlight
        th2 = math.radians(10)
        perp2 = -math.sin(th2) * (VBX - cxr) + math.cos(th2) * (VBY - cyr)
        sheen += 0.06 * np.exp(-((perp2 + 26) / 34.0) ** 2)
        top = np.clip(1 - (VBY - by) / 26.0, 0, 1)
        sheen += 0.10 * (top ** 2)
    img = screen(img, np.ones_like(img), np.clip(sheen, 0, 0.5) * body_mask)

    # ── glass-over vector layer: guides, mechanism, label, reflections ──
    pen2 = Pen(cfg, wpx, hpx)
    dy = cfg['dy']

    # left tape-guide assembly
    pen2.rrect(30, 120 + dy, 26, 58, 4, fill=rgba('#ffffff', 0.05), outline=rgba('#ffffff', 0.26), width=1.0)
    pen2.circle(43, 134 + dy, 4.4, outline=rgba('#ffffff', 0.30), width=1.0)
    pen2.circle(43, 150 + dy, 3, outline=rgba('#ffffff', 0.24), width=0.9)
    pen2.rrect(37, 160 + dy, 12, 12, 2, fill=rgba(color, 0.55))
    # guide rollers on their posts
    for gx in (74, 268):
        pen2.circle(gx, tapeY, 5.4, fill=rgba('#ffffff', 0.05), outline=rgba('#ffffff', 0.42), width=1.2)
        pen2.circle(gx, tapeY, 2.6, outline=rgba('#ffffff', 0.30), width=0.8)
        pen2.circle(gx, tapeY, 0.9, fill=rgba('#05070e', 0.6))

    # ── the bottom edge (the busy hardware end) ──
    win_scale = 1.12 if refined else 1.0
    pen2.rrect(14, 195 + dy, 312, 7, 3.5, fill=rgba('#ffffff', 0.04), outline=rgba('#ffffff', 0.20), width=0.8)
    # head window trapezoid, optionally a touch larger
    wcx = 170
    def wp(x, y):
        return (wcx + (x - wcx) * win_scale, y)
    trap = [wp(108, 180 + dy), wp(232, 180 + dy), wp(222, 200 + dy), wp(118, 200 + dy)]
    pen2.poly(trap, fill=rgba('#ffffff', 0.05 if refined else 0.04),
              outline=rgba('#ffffff', 0.36 if refined else 0.32), width=1.2)
    pen2.rrect(120, 183 + dy, 100, 5, 1, fill=rgba('#ffffff', 0.07), outline=rgba('#ffffff', 0.18), width=0.6)
    # pressure pad on its leaf spring
    pen2.polyline([(158, 197 + dy), (162, 190 + dy), (178, 190 + dy), (182, 197 + dy)], rgba('#ffffff', 0.28), 0.8)
    pen2.rrect(161, 186 + dy, 18, 6, 1.4, fill=rgba('#05070e', 0.72), outline=rgba('#ffffff', 0.24), width=0.7)
    # pinch-roller openings with the rollers in them
    for px in (143, 193):
        pen2.rrect(px - 7.5, 184 + dy, 15, 13, 3, fill=rgba('#05070e', 0.42), outline=rgba('#ffffff', 0.30), width=1.0)
        pen2.circle(px, 190.5 + dy, 4.4, fill=rgba('#ffffff', 0.06), outline=rgba('#ffffff', 0.34), width=0.9)
        pen2.circle(px, 190.5 + dy, 1.5, fill=rgba('#05070e', 0.7))
    # capstan holes
    for cxx in (128, 208):
        pen2.circle(cxx, 190 + dy, 4, fill=rgba('#05070e', 0.55), outline=rgba('#ffffff', 0.36), width=1.0)
        pen2.circle(cxx, 190 + dy, 1.7, outline=rgba('#ffffff', 0.24), width=0.6)
    # locating holes either side
    pen2.circle(92, 191 + dy, 2.6, fill=rgba('#05070e', 0.5), outline=rgba('#ffffff', 0.30), width=0.8)
    pen2.circle(248, 191 + dy, 2.6, fill=rgba('#05070e', 0.5), outline=rgba('#ffffff', 0.30), width=0.8)
    # chamfer highlight along the very bottom
    pen2.line(20, 199.5 + dy, 320, 199.5 + dy, rgba('#ffffff', 0.16), 0.8)

    # ── the frosted label is drawn LAST, in the top-most unclipped layer
    #    (pen3) — see below. It sits fully inside the body, so leaving it out
    #    of the clipped glass layer only guarantees nothing composites over it.
    lby = by + 16
    # embossed bottom line
    pen2.text(300, 176 + dy, 'CR-02 · HIGH BIAS · MADE FOR THE ROAD', 5, F_MED,
              rgba('#ffffff', 0.20), anchor='rs', tracking=0.6)

    # broad glass reflections across the face
    pen2.poly([(20, by), (96, by), (40, cfg['bottom']), (bx, cfg['bottom'])], fill=rgba('#ffffff', 0.045))
    pen2.poly([(250, by), (282, by), (214, cfg['bottom']), (190, cfg['bottom'])], fill=rgba('#ffffff', 0.025))

    # stable dust specks
    def ch01(n):
        x = math.sin(n * 12.9898) * 43758.5453
        return x - math.floor(x)
    for i in range(18):
        dx = 14 + ch01(i * 2.7) * (cfg['VBW'] - 28)
        dyp = 14 + ch01(i * 5.9 + 3.1) * (cfg['VBH'] - 28)
        rr = 0.3 + ch01(i * 8.2) * 0.7
        oo = 0.06 + ch01(i * 4.4) * 0.14
        pen2.circle(dx, dyp, rr, fill=rgba('#ffffff', oo))

    # clip everything so far to the body, then composite
    gov = Image.new('RGBA', (wpx, hpx), (0, 0, 0, 0))
    gov.paste(pen2.ov, (0, 0), pen2.ov)
    gov.putalpha(Image.composite(gov.getchannel('A'), Image.new('L', (wpx, hpx), 0), mimg))
    gnp = np.asarray(gov).astype(float) / 255.0
    img = over(img, gnp[..., :3], gnp[..., 3])

    # ── moulded triple edge + screws (drawn outside the clip) ──
    pen3 = Pen(cfg, wpx, hpx)
    # lit outer edge (approx the white gradient stroke)
    pen3.rrect(8, 8, cfg['bodyW'], cfg['bodyH'], 10, outline=rgba('#ffffff', 0.62), width=2.4)
    pen3.rrect(11, 11, cfg['bodyW'] - 6, cfg['bodyH'] - 6, 8, outline=rgba('#05070e', 0.45), width=1.2)
    pen3.rrect(13.5, 13.5, cfg['bodyW'] - 11, cfg['bodyH'] - 11, 7, outline=rgba('#ffffff', 0.18), width=0.9)
    bb = cfg['bottom']
    draw_screw(pen3, 26, 24, 4, 12, refined)
    draw_screw(pen3, 314, 24, 4, -31, refined)
    draw_screw(pen3, 26, bb - 16, 4, 57, refined)
    draw_screw(pen3, 314, bb - 16, 4, -8, refined)
    draw_screw(pen3, 170, 16, 2.8, 40, refined)

    # ── the frosted label, top-most so it always reads in full ──
    pen3.rrect(30, lby, 280, 40, 4, fill=rgba('#f4f6ff', 0.88))
    pen3.rrect(30, lby, 280, 20, 4, fill=rgba('#ffffff', 0.10))
    pen3.rrect(30, lby, 280, 13, 4, fill=rgba(color, 0.62))    # station spine
    if refined:
        # faint index ticks across the label body — reads like a real inlay
        for tx in range(52, 300, 26):
            pen3.line(tx, lby + 16, tx, lby + 38, rgba('#0d1020', 0.06), 0.6)
        pen3.line(40, lby + 25, 300, lby + 25, rgba('#0d1020', 0.10), 0.5)  # title baseline rule
    pen3.rrect(30, lby, 280, 40, 4, outline=rgba('#ffffff', 0.55), width=1.0)
    tr = 1.6 if not refined else 2.2
    pen3.text(40, lby + 10, 'A · STEREO · C90', 6.5, F_XBOLD, rgba('#0d1020', 1.0), anchor='ls', tracking=tr)
    pen3.text(40, lby + 29, 'Waking Up In Vegas', 11, F_XBOLD, rgba('#0d1020', 1.0), anchor='ls',
              tracking=0.6 if refined else 0.0)
    pen3.text(300, lby + 37, 'Katy Perry', 7, F_BOLD, rgba('#0d1020', 0.72), anchor='rs')

    eov = np.asarray(pen3.ov).astype(float) / 255.0
    img = over(img, eov[..., :3], eov[..., 3])

    return np.clip(img, 0, 1)


def panel(variant):
    wpx, hpx = PANEL_W * SS, PANEL_H * SS
    img = render_panel(variant, wpx, hpx)
    out = Image.fromarray((img * 255).astype(np.uint8))
    return out.resize((PANEL_W * OUT, PANEL_H * OUT), Image.LANCZOS)


if __name__ == '__main__':
    panels = [
        ('A', 'A  current'),
        ('B', 'B  truer proportions'),
        ('C', 'C  refined graphics'),
        ('D', 'D  recommended'),
    ]
    PW, PH = PANEL_W * OUT, PANEL_H * OUT
    gap = 16
    cap_h = 46
    sheet = Image.new('RGB', (PW * 4 + gap * 5, PH + cap_h + gap * 2), (14, 14, 17))
    dd = ImageDraw.Draw(sheet)
    cap_font = ImageFont.truetype(F_BOLD, 26)
    for i, (key, cap) in enumerate(panels):
        im = panel(key)
        x = gap + i * (PW + gap)
        sheet.paste(im, (x, cap_h + gap), im if im.mode == 'RGBA' else None)
        dd.text((x + 4, gap + 4), cap, fill=(232, 232, 238), font=cap_font)

    out_tmp = '/tmp/cassette_compare.png'
    out_art = '/opt/cursor/artifacts/screenshots/widget_cassette_prototype_options.png'
    import os
    os.makedirs(os.path.dirname(out_art), exist_ok=True)
    sheet.save(out_tmp)
    sheet.save(out_art)
    print('saved', out_tmp)
    print('saved', out_art)
