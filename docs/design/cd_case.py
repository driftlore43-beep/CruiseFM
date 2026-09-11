"""
Comparison sheet for the CD widget's JEWEL CASE — the frame around the disc,
not the disc itself. The disc's colour is settled (build 47 / option B, locked
11.09); this sheet is the owner's next ask: "can we do prototypes on improving
their dimensions and graphics" for the cassette and the CD case.

The disc is imported straight from cd_widget.py so every panel carries the
REAL, approved disc and only the case around it changes. Four panels:

    A  current      — the case as it ships (JewelCase in ModeWidget.swift)
    B  slimmer      — DIMENSIONS: thinner frame, the disc grows into the space
    C  refined      — GRAPHICS: a real barrel hinge, moulded corner clips, a
                      frosted spine, a dual light sweep and an inner bevel
    D  recommended  — B's proportions with C's graphics

Everything is drawn the way ModeWidget.swift's JewelCase draws it: a clear
polycarbonate frame that carries no hue, its thickness coming from paired
strokes and one or two diagonal sweeps of light. Nothing here is a lookalike —
the numbers are the Swift ones so a chosen panel ports straight across.

RUN: python3 docs/design/cd_case.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from cd_widget import disc, DISC, TILE, SS, hexc

DISC_OPTION = 'G_A'   # the locked-B disc (warm/cool light asymmetric spectra)

# ── configs: each is a JewelCase, in the Swift 158-unit space ─────────────
# inset/radius/disc are in those units; the renderer multiplies by SS.
CONFIGS = {
    'A_current': dict(cap='A  current', inset=8, radius=16, disc=124,
                      hinge='tabs', corners='posts', sweep='single',
                      stroke=1.0, spine=False, bevel=False),
    'B_slim': dict(cap='B  slimmer frame, bigger disc', inset=5, radius=13, disc=137,
                   hinge='tabs', corners='posts', sweep='single',
                   stroke=0.7, spine=False, bevel=False),
    'C_refined': dict(cap='C  refined hardware + sheen', inset=8, radius=16, disc=124,
                      hinge='pins', corners='clips', sweep='dual',
                      stroke=0.85, spine=True, bevel=True),
    'D_premium': dict(cap='D  recommended  (B + C)', inset=5, radius=13, disc=135,
                      hinge='pins', corners='clips', sweep='dual',
                      stroke=0.85, spine=True, bevel=True),
}


def _font(px):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def _spine_text(h):
    """A frosted 'CRUISE FM' running up the hinge, as a rotated strip."""
    strip = Image.new('RGBA', (h, 12 * SS), (0, 0, 0, 0))
    ImageDraw.Draw(strip).text((6 * SS, 1 * SS), 'C R U I S E  F M',
                               font=_font(6 * SS), fill=(255, 255, 255, 72))
    return strip.rotate(90, expand=True)


def case_tile(cfg):
    n = TILE
    inset = cfg['inset'] * SS
    radius = cfg['radius'] * SS
    stroke = max(1, int(round(cfg['stroke'] * SS)))
    disc_d = cfg['disc'] * SS

    # ── background: the same dark diagonal the widget tile sits on ──
    y, x = np.mgrid[0:n, 0:n].astype(float)
    g = ((x / n) + (y / n)) / 2
    c0 = np.array(hexc('#1c1f26')); c1 = np.array(hexc('#080a0e'))
    bg = c0[None, None, :] * (1 - g[..., None]) + c1[None, None, :] * g[..., None]
    base = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8)).convert('RGBA')

    gcx = n / 2 + 6 * SS
    gcy = n / 2

    # ── the case frame + hinge + sweep, UNDER the disc ──
    ov = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    box = [inset, inset, n - inset, n - inset]

    # glass body: faint fill + a light outline
    d.rounded_rectangle(box, radius=radius, fill=(255, 255, 255, 18),
                        outline=(255, 255, 255, int(41 * cfg['stroke'])), width=stroke)
    if cfg['bevel']:
        # an inner highlight and a dark line just behind it — moulded depth
        b2 = [inset + 3 * SS, inset + 3 * SS, n - inset - 3 * SS, n - inset - 3 * SS]
        d.rounded_rectangle(b2, radius=max(2, radius - 3 * SS),
                            outline=(255, 255, 255, 30), width=SS)
        d.rounded_rectangle(box, radius=radius, outline=(5, 7, 14, 70), width=SS)

    # hinge spine down the left
    spine_w = 12 * SS
    d.rectangle([inset, inset + radius // 2, inset + spine_w, n - inset - radius // 2],
                fill=(255, 255, 255, 26))
    if cfg['hinge'] == 'tabs':
        for k in range(3):
            ty = n * (0.30 + k * 0.20)
            d.rounded_rectangle([inset + 2 * SS, ty - 9.5 * SS, inset + 10 * SS, ty + 9.5 * SS],
                                radius=2 * SS, fill=(255, 255, 255, 23),
                                outline=(255, 255, 255, 36), width=SS)
    else:
        # a real barrel hinge: a thin rod down the spine and two knuckles
        rod_x = inset + spine_w * 0.5
        d.line([rod_x, n * 0.22, rod_x, n * 0.78], fill=(255, 255, 255, 40), width=SS)
        for cy in (n * 0.36, n * 0.64):
            d.rounded_rectangle([inset + 1.5 * SS, cy - 13 * SS, inset + 10.5 * SS, cy + 13 * SS],
                                radius=4.5 * SS, fill=(255, 255, 255, 30),
                                outline=(255, 255, 255, 48), width=SS)
            d.ellipse([rod_x - 2.4 * SS, cy - 2.4 * SS, rod_x + 2.4 * SS, cy + 2.4 * SS],
                      fill=(10, 12, 18, 120), outline=(255, 255, 255, 60), width=max(1, SS // 2))

    if cfg['spine']:
        st = _spine_text(int(n - 2 * inset - radius))
        ov.alpha_composite(st, (int(inset + 1 * SS), int(inset + radius // 2)))

    # diagonal light sweep(s) on the plastic, clipped to the case
    sweep = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sweep)
    sd.polygon([(inset, inset), (inset + 34 * SS, inset),
                (inset + 12 * SS, n - inset), (inset, n - inset)],
               fill=(255, 255, 255, 26))
    if cfg['sweep'] == 'dual':
        sd.polygon([(n - inset - 30 * SS, inset), (n - inset, inset),
                    (n - inset, inset + 40 * SS), (n - inset - 46 * SS, n - inset),
                    (n - inset - 70 * SS, n - inset)],
                   fill=(255, 255, 255, 14))
        # a crisp top-edge glass highlight
        sd.line([inset + radius, inset + 1.5 * SS, n - inset - radius, inset + 1.5 * SS],
                fill=(255, 255, 255, 40), width=SS)
    cmask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(cmask).rounded_rectangle(box, radius=radius, fill=255)
    ov.alpha_composite(Image.composite(sweep, Image.new('RGBA', (n, n), (0, 0, 0, 0)), cmask))

    base = Image.alpha_composite(base, ov)

    # ── accent glow behind the disc ──
    glow = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    gr = (disc_d + 14 * SS) / 2
    ImageDraw.Draw(glow).ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], fill=(155, 92, 255, 82))
    glow = glow.filter(ImageFilter.GaussianBlur(20 * SS))
    base = Image.alpha_composite(base, glow)

    # ── the disc: drop shadow, then the disc itself, scaled to this case ──
    dsc = disc(DISC_OPTION).resize((int(disc_d), int(disc_d)), Image.LANCZOS)
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    dr_ = disc_d / 2
    ImageDraw.Draw(sh).ellipse([gcx - dr_, gcy - dr_ + 5 * SS, gcx + dr_, gcy + dr_ + 5 * SS],
                               fill=(0, 0, 0, 158))
    sh = sh.filter(ImageFilter.GaussianBlur(9 * SS))
    base = Image.alpha_composite(base, sh)
    base.alpha_composite(dsc, (int(gcx - dr_), int(gcy - dr_)))

    # ── corners, OVER the disc so clips can grip its rim ──
    ov2 = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d2 = ImageDraw.Draw(ov2)
    if cfg['corners'] == 'posts':
        p = 7 * SS; L = 15 * SS; w = int(1.8 * SS)
        for ax, ay in ((inset + p, inset + p), (n - inset - p, inset + p),
                       (inset + p, n - inset - p), (n - inset - p, n - inset - p)):
            sx = 1 if ax < n / 2 else -1
            sy = 1 if ay < n / 2 else -1
            d2.rectangle([min(ax, ax + sx * L), min(ay, ay + sy * w),
                          max(ax, ax + sx * L), max(ay, ay + sy * w)], fill=(255, 255, 255, 56))
            d2.rectangle([min(ax, ax + sx * w), min(ay, ay + sy * L),
                          max(ax, ax + sx * w), max(ay, ay + sy * L)], fill=(255, 255, 255, 56))
    else:
        # moulded corner clips: two short glossy ribs hugging each corner, a
        # dark seam just inside them for moulded depth — reads as a reinforced
        # plastic corner rather than an engraved line.
        def _r(a, b, c, e):
            return [min(a, c), min(b, e), max(a, c), max(b, e)]
        p = 6 * SS; L = 17 * SS; w = 3.2 * SS
        for ax, ay in ((inset + p, inset + p), (n - inset - p, inset + p),
                       (inset + p, n - inset - p), (n - inset - p, n - inset - p)):
            sx = 1 if ax < n / 2 else -1
            sy = 1 if ay < n / 2 else -1
            for col, off in ((( 5, 7, 14, 60), 1.4 * SS), ((255, 255, 255, 48), 0)):
                d2.rounded_rectangle(_r(ax, ay + off, ax + sx * L, ay + sy * w + off),
                                     radius=w / 2, fill=col)
                d2.rounded_rectangle(_r(ax + off, ay, ax + sx * w + off, ay + sy * L),
                                     radius=w / 2, fill=col)

    base = Image.alpha_composite(base, ov2)

    # clip to the widget tile shape and downscale for display
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=22 * SS, fill=255)
    base.putalpha(mask)
    return base.resize((158 * 3, 158 * 3), Image.LANCZOS)


if __name__ == '__main__':
    order = ['A_current', 'B_slim', 'C_refined', 'D_premium']
    W = 158 * 3
    sheet = Image.new('RGB', (W * 4 + 100, W + 130), (14, 14, 17))
    dd = ImageDraw.Draw(sheet)
    cap_font = _font(13)
    for i, key in enumerate(order):
        cfg = CONFIGS[key]
        im = case_tile(cfg)
        px = 20 + i * (W + 20)
        sheet.paste(im, (px, 80), im)
        dd.text((px, 44), cfg['cap'], fill=(230, 230, 235), font=cap_font)
    out = '/tmp/cd_case_compare.png'
    sheet.save(out)
    print('saved', out)
