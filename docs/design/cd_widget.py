"""
Comparison sheet for the CD widget's disc, drawn the way the Swift draws it.

Written 2026-09-10, alongside ball_widget.py, because the owner asked to see
prototypes before another build goes out. Build 47 already carries a rewrite
of the rainbow that she has never seen, so option B here IS build 47 — the
point of the sheet is that she can judge it now rather than after the build
lands, and pick a different direction in the same round if she wants one.

EVERY LAYER IS PORTED FROM CompactDisc IN ModeWidget.swift, in the same order
and with the same numbers: the jewel case, the album art beneath, the
diffraction, the neutral metal sheen, the pressed rings, the specular sweep,
the dome, the stacking step, the mirror land, the hub and its gripper holes,
and the directional rim. A lookalike would tell you nothing about what ships.

SwiftUI semantics reproduced deliberately:
  RadialGradient  — stops interpolate between startRadius and endRadius
  AngularGradient — location 0 sits at `angle`, sweeping CLOCKWISE from
                    3 o'clock, which is what `atan2(dy, dx)` gives directly
                    with y pointing down
  .blendMode(.screen) — 1-(1-a)(1-b)

RUN: python3 docs/design/cd_widget.py
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4                       # supersample
TILE = 158 * SS              # the real widget tile
DISC = 124 * SS              # the disc as build 47 draws it
ART = 'targets/widgets/after-midnight.jpg'

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

# ── gradient helpers, SwiftUI's stop semantics ───────────────────────────
def stops_at(stops, t):
    """stops: [(loc, (r,g,b), a)] -> (rgb array, a array) for array t."""
    t = np.clip(t, 0, 1)
    r = np.zeros_like(t); g = np.zeros_like(t); b = np.zeros_like(t); a = np.zeros_like(t)
    for i in range(len(stops) - 1):
        l0, c0, a0 = stops[i]; l1, c1, a1 = stops[i + 1]
        m = (t >= l0) & (t <= l1)
        if not m.any(): continue
        u = np.zeros_like(t)
        if l1 > l0: u[m] = (t[m] - l0) / (l1 - l0)
        r[m] = c0[0] + (c1[0] - c0[0]) * u[m]
        g[m] = c0[1] + (c1[1] - c0[1]) * u[m]
        b[m] = c0[2] + (c1[2] - c0[2]) * u[m]
        a[m] = a0 + (a1 - a0) * u[m]
    below = t < stops[0][0]
    r[below], g[below], b[below], a[below] = stops[0][1] + (stops[0][2],)
    above = t > stops[-1][0]
    r[above], g[above], b[above], a[above] = stops[-1][1] + (stops[-1][2],)
    return np.dstack([r, g, b]), a

def over(dst, src, a):
    return dst * (1 - a[..., None]) + src * a[..., None]

def screen(dst, src, a):
    s = 1 - (1 - dst) * (1 - src)
    return dst * (1 - a[..., None]) + s * a[..., None]

# ── the disc ─────────────────────────────────────────────────────────────
# The station's own reference disc, sampled 11.09 (docs/design + /tmp/cd_ref):
# the vivid bands are PINK/MAGENTA (~310-325deg), VIOLET (~262-278), BLUE and
# TURQUOISE/TEAL (~186-210). The yellow-gold in a raw photo is the silver metal
# itself, not the diffraction — so the spectrum drops the generic green/yellow/
# orange the old wheel carried and runs pink -> violet -> blue -> turquoise.
SPECTRUM = [
    (0.00, (0, 0, 0), 0.0),
    (0.12, hexc('#ff5ec8'), 0.5),
    (0.30, hexc('#b57cff'), 1.0),
    (0.50, hexc('#5a9cff'), 1.0),
    (0.68, hexc('#2fd6dc'), 1.0),
    (0.86, hexc('#9bede0'), 0.6),
    (1.00, (0, 0, 0), 0.0),
]
METAL = [(0.00, (1, 1, 1), 0.20), (0.17, (1, 1, 1), 0.02), (0.34, (1, 1, 1), 0.26),
         (0.55, (1, 1, 1), 0.04), (0.74, (1, 1, 1), 0.22), (0.88, (1, 1, 1), 0.03),
         (1.00, (1, 1, 1), 0.20)]

def wedge_stops(spread):
    half = spread / 720.0
    return [(0.0, (1, 1, 1), 0.0),
            (max(0.0, 0.5 - half), (1, 1, 1), 0.0),
            (max(0.0, 0.5 - half * 0.55), (1, 1, 1), 0.35),
            (0.5, (1, 1, 1), 1.0),
            (min(1.0, 0.5 + half * 0.55), (1, 1, 1), 0.35),
            (min(1.0, 0.5 + half), (1, 1, 1), 0.0),
            (1.0, (1, 1, 1), 0.0)]

# The four directions on the sheet. `fans` is (bearing, spread, strength);
# bearing is degrees clockwise from straight up, matching DiffractionFan.
OPTIONS = {
    'A_build45': None,                                    # the old colour wheel
    'B_build47': [(34, 84, 0.95), (214, 72, 0.78), (128, 44, 0.34)],
    'C_four':    [(30, 62, 0.92), (150, 62, 0.72), (210, 62, 0.88), (330, 62, 0.66)],
    'D_two_wide':[(38, 118, 1.00), (218, 104, 0.86)],
}

WHEEL = ['#6ad0ff', '#b98cff', '#ff9ad0', '#ffd68a', '#a8ffcf', '#6ad0ff']

def disc(option, size=DISC):
    n = size
    y, x = np.mgrid[0:n, 0:n].astype(float)
    cx = cy = (n - 1) / 2.0
    dx = x - cx; dy = y - cy
    d = np.hypot(dx, dy)
    R = n / 2.0
    inside = d <= R
    ang = (np.degrees(np.arctan2(dy, dx))) % 360.0     # clockwise from 3 o'clock

    # album art, darkened and desaturated the way build 47 does
    im = Image.open(ART).convert('RGB')
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2,
                  (im.width - s) // 2 + s, (im.height - s) // 2 + s)).resize((n, n), Image.LANCZOS)
    img = np.asarray(im).astype(float) / 255.0
    if option == 'A_build45':
        img = np.clip(img - 0.22, 0, 1)
        grey = img.mean(axis=2, keepdims=True)
        img = np.clip(grey + (img - grey) * 1.15, 0, 1)
    else:
        # -0.10 / 0.92 — the art is only a faint tint under the mirror now
        # that a clear-silver lift sits over it (below). Darkening it hard
        # was what made a clear disc read as a dark print.
        img = np.clip(img - 0.10, 0, 1)
        grey = img.mean(axis=2, keepdims=True)
        img = np.clip(grey + (img - grey) * 0.92, 0, 1)

    fans = OPTIONS[option]
    if fans is None:
        # two full-circle angular rainbows — a colour wheel, which is what
        # she photographed and called "painted on"
        wheel = [(i / (len(WHEEL) - 1), hexc(c), 1.0) for i, c in enumerate(WHEEL)]
        for angle, mode, op in ((20, 'overlay', 0.82), (200, 'screen', 0.5)):
            loc = ((ang - angle) % 360) / 360.0
            col, a = stops_at(wheel, loc)
            if mode == 'overlay':
                lo = 2 * img * col
                hi = 1 - 2 * (1 - img) * (1 - col)
                blended = np.where(img <= 0.5, lo, hi)
                img = img * (1 - op) + blended * op
            else:
                img = screen(img, col, np.full_like(ang, op))
    else:
        r0, r1 = 0.13 * n, 0.52 * n
        t = np.clip((d - r0) / (r1 - r0), 0, 1)
        spec, sa = stops_at(SPECTRUM, t)
        # Fine concentric tracks, THINNED (owner 11.09: "the grooves are too
        # thick, thin them out a little") and made to CATCH THE LIGHT in the
        # fans ("make them more visible near the reflected area on the
        # rainbow"). Same pitch as the base rings below so the two align.
        track = np.where(((d / R) % 0.085) / 0.085 < 0.26, 1.0, 0.0)
        for bearing, spread, strength in fans:
            # DiffractionFan turns the wedge back half a revolution so its
            # peak (location 0.5) lands on the bearing.
            gangle = (bearing - 90) - 180
            loc = ((ang - gangle) % 360) / 360.0
            _, wa = stops_at(wedge_stops(spread), loc)
            img = screen(img, spec, wa * sa * strength)
            # the tracks brighten where this fan's rainbow lands — gated by
            # the same wedge and the spectrum's own radial falloff.
            img = screen(img, np.ones_like(img), wa * sa * strength * track * 0.65)
        mloc = ((ang - (-30 - 90)) % 360) / 360.0
        _, ma = stops_at(METAL, mloc)
        img = screen(img, np.ones_like(img), ma * 0.55)
        # CLEAR-SILVER LIFT (owner 11.09: "can the CD look more whiter — it
        # currently looks too dark for a clear CD"). A pressed disc's data
        # land is bright metal, not a dark print. A uniform silver SCREEN
        # over the face lifts the darks toward silver while the fans and the
        # specular sweep keep their own brightness (screen keeps the lighter
        # of the two), so the disc reads clear without washing the rainbow
        # into the flat colour-wheel of option A.
        img = screen(img, np.full_like(img, 0.62), np.full(ang.shape, 0.42))

    # The base tracks everywhere on the silver — THINNED (owner 11.09: "too
    # thick, thin them out a little"): the white band is now 0.26 of the
    # pitch rather than half, at opacity 0.015. On plain metal they are a
    # barely-there shimmer; the fan loop above lifts the SAME tracks where
    # the rainbow lands, which is where a real disc shows them most.
    ring_t = d / R
    phase = (ring_t % 0.085) / 0.085
    ring_a = np.where(phase < 0.26, 0.015, 0.0)
    img = over(img, np.ones_like(img), ring_a)

    # specular sweep, topLeading -> bottomTrailing
    sw = np.clip(((x / n) + (y / n)) / 2.0, 0, 1)
    _, spa = stops_at([(0.04, (1, 1, 1), 0.52), (0.20, (1, 1, 1), 0.0),
                       (0.72, (1, 1, 1), 0.0), (0.95, (1, 1, 1), 0.30)], sw)
    img = over(img, np.ones_like(img), spa)

    # the dome — falls away at the rim
    dd = np.hypot(x - 0.40 * n, y - 0.34 * n) / (0.56 * n)
    _, da = stops_at([(0.0, (0, 0, 0), 0.0), (0.72, (0, 0, 0), 0.0), (1.0, (0, 0, 0), 0.30)], dd)
    img = over(img, np.zeros_like(img), da)

    img = np.clip(img, 0, 1)
    out = Image.fromarray((img * 255).astype(np.uint8))

    # strokes: stacking step, mirror land, hub, holes, rim
    ov = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    def ring(frac, width, col):
        r = frac * n / 2
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=max(1, int(width)))
    # the stacking ring is gone 10.09 — owner: "remove the circle that's
    # between the centre and the edge"
    ring(0.375, 0.035 * n, (255, 255, 255, 51))
    r = 0.31 * n / 2
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(224, 224, 224, 153), outline=(255, 255, 255, 115), width=SS)
    for i in range(4):
        a = math.radians(i * 90 + 45 - 90)
        hx = cx + 0.1175 * n * math.cos(a); hy = cy + 0.1175 * n * math.sin(a)
        hr = 0.030 * n / 2
        dr.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(0, 0, 0, 87))
    r = 0.14 * n / 2
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(9, 10, 14, 255), outline=(255, 255, 255, 46), width=SS)
    out = Image.alpha_composite(out.convert('RGBA'), ov)

    # directional rim
    rim = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rim_stops = [(0.0, 0.62), (0.28, 0.08), (0.55, 0.40), (0.80, 0.05), (1.0, 0.62)]
    for a_deg in range(0, 3600):
        u = a_deg / 3600.0
        aa = 0.0
        for i in range(len(rim_stops) - 1):
            if rim_stops[i][0] <= u <= rim_stops[i + 1][0]:
                l0, o0 = rim_stops[i]; l1, o1 = rim_stops[i + 1]
                k = 0 if l1 == l0 else (u - l0) / (l1 - l0)
                aa = o0 + (o1 - o0) * k
                break
        th = math.radians(a_deg / 10.0 + (-125 - 90))
        rr = n / 2 - 0.6 * SS
        px = cx + rr * math.cos(th); py = cy + rr * math.sin(th)
        w = 1.2 * SS / 2
        rd.ellipse([px - w, py - w, px + w, py + w], fill=(255, 255, 255, int(255 * aa)))
    out = Image.alpha_composite(out, rim)

    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1], fill=255)
    out.putalpha(mask)
    return out

# ── the jewel case and the tile ──────────────────────────────────────────
def tile(option):
    n = TILE
    base = Image.new('RGB', (n, n), (0, 0, 0))
    y, x = np.mgrid[0:n, 0:n].astype(float)
    g = ((x / n) + (y / n)) / 2
    c0 = np.array(hexc('#1c1f26')); c1 = np.array(hexc('#080a0e'))
    bg = c0[None, None, :] * (1 - g[..., None]) + c1[None, None, :] * g[..., None]
    base = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8))

    ov = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    inset = 8 * SS; radius = 16 * SS
    box = [inset, inset, n - inset, n - inset]
    d.rounded_rectangle(box, radius=radius, fill=(255, 255, 255, 18), outline=(255, 255, 255, 41), width=SS)
    # hinge spine
    d.rectangle([inset, inset + radius // 2, inset + 12 * SS, n - inset - radius // 2], fill=(255, 255, 255, 26))
    for k in range(3):
        ty = n * (0.30 + k * 0.20)
        d.rounded_rectangle([inset + 2 * SS, ty - 9.5 * SS, inset + 10 * SS, ty + 9.5 * SS],
                            radius=2 * SS, fill=(255, 255, 255, 23), outline=(255, 255, 255, 36), width=SS)
    # corner posts
    p = 7 * SS; L = 15 * SS; w = int(1.8 * SS)
    for ax, ay in ((inset + p, inset + p), (n - inset - p, inset + p),
                   (inset + p, n - inset - p), (n - inset - p, n - inset - p)):
        sx = 1 if ax < n / 2 else -1
        sy = 1 if ay < n / 2 else -1
        def rect(x0, y0, x1, y1):
            d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)],
                        fill=(255, 255, 255, 56))
        rect(ax, ay, ax + sx * L, ay + sy * w)
        rect(ax, ay, ax + sx * w, ay + sy * L)
    base = Image.alpha_composite(base.convert('RGBA'), ov)

    # accent glow behind the disc
    glow = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = 138 * SS / 2
    gcx = n / 2 + 6 * SS
    gd.ellipse([gcx - gr, n / 2 - gr, gcx + gr, n / 2 + gr], fill=(155, 92, 255, 82))
    glow = glow.filter(ImageFilter.GaussianBlur(20 * SS))
    base = Image.alpha_composite(base, glow)

    dsc = disc(option)
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    dr_ = DISC / 2
    sd.ellipse([gcx - dr_, n / 2 - dr_ + 5 * SS, gcx + dr_, n / 2 + dr_ + 5 * SS], fill=(0, 0, 0, 158))
    sh = sh.filter(ImageFilter.GaussianBlur(9 * SS))
    base = Image.alpha_composite(base, sh)
    base.paste(dsc, (int(gcx - DISC / 2), int(n / 2 - DISC / 2)), dsc)

    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=22 * SS, fill=255)
    base.putalpha(mask)
    return base.resize((158 * 3, 158 * 3), Image.LANCZOS)

if __name__ == '__main__':
    names = [('A_build45', 'A  build 45/46 — the colour wheel she photographed'),
             ('B_build47', 'B  build 47 (already committed) — 2 fans + 1 faint'),
             ('C_four',    'C  four even fans'),
             ('D_two_wide','D  two wide fans, nothing else')]
    W = 158 * 3
    sheet = Image.new('RGB', (W * 4 + 100, W + 130), (14, 14, 17))
    dd = ImageDraw.Draw(sheet)
    for i, (key, cap) in enumerate(names):
        im = tile(key)
        x = 20 + i * (W + 20)
        sheet.paste(im, (x, 80), im)
        dd.text((x, 40), cap, fill=(230, 230, 235))
    sheet.save('/tmp/cd_widget_compare.png')
    print('saved /tmp/cd_widget_compare.png')

    # how much of the disc actually carries colour, per option
    for key, cap in names:
        im = tile(key).convert('RGB')
        a = np.asarray(im).astype(float)
        n = a.shape[0]
        yy, xx = np.mgrid[0:n, 0:n]
        cx = n / 2 + 6 * 3; cy = n / 2
        m = np.hypot(xx - cx, yy - cy) <= (124 * 3 / 2) * 0.95
        px = a[m]
        mx = px.max(axis=1); mn = px.min(axis=1)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
        print(f'{key:12} tinted>0.18 {100*(sat>0.18).mean():5.1f}%   mean sat {sat.mean():.3f}   median lum {np.median(px.mean(axis=1)):5.1f}')
