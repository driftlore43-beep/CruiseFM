"""
The Record tile from ModeWidget.swift, drawn the way the Swift draws it, so a
change to it can be looked at and measured before anything is written.

Written 2026-09-20. The ball and the disc already have harnesses
(ball_widget.py, cd_widget.py); the record never got one, and it is the tile
a real user's Home Screen screenshot showed reading as a flat black circle on
a flat dark square while the two beside it read as objects.

EVERY LAYER IS PORTED FROM RecordView IN Artwork.swift AND `record()` IN
ModeWidget.swift, in the same order and with the same numbers. A lookalike
would say nothing about what ships.

DRAWN IN POLAR COORDINATES WITH NUMPY, not with PIL's ellipse outlines. Every
layer on this tile is either radially symmetric or an angular sweep, so r and
theta ARE the drawing — and a first attempt with PIL strokes came out with
hard white rings and a crescent-shaped label, i.e. unfaithful in exactly the
places the judgement would have been made. Supersampled 4x and box-filtered
down, which is what gives the grooves their real weight: at 1.7pt pitch on a
139pt record the rings are BELOW one device pixel apart, so what a phone
actually shows is a texture, and any harness that draws them crisply is
flattering the code.

SwiftUI semantics reproduced deliberately:
  .stroke(w)      — centred on the path, so it straddles the radius
  RadialGradient  — `center` is in UNIT space of the view being filled, and
                    stops interpolate between startRadius and endRadius
  AngularGradient — location 0 sits at `angle`, sweeping CLOCKWISE from
                    3 o'clock, i.e. what atan2(dy, dx) gives with y down
  Color(white: x) — OPAQUE grey, not a white at opacity x. The lead-in band
                    and the land are both that, which is why they cover the
                    grooves rather than tinting them.

RUN: python3 docs/design/record_widget.py
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw

SS = 4                 # supersample: 1pt -> 4px
TILE = 158             # the reference tile the Swift's `k` is measured against
SIZE = 139             # RecordView's size at k = 1
N = TILE * SS


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ball_halo_stops(src, strength=1.0):
    """Snapshot.swift's tileHalo, ported: hue-safe, never clips a channel.

    `strength` scales each stop's TARGET BRIGHTNESS, which is the one knob
    that dims the glow without touching its hue or its falloff — dropping the
    whole layer's opacity instead would wash it toward whatever is behind it.
    """
    r, g, b = hexc(src) / 255.0
    mean = max(0.02, (r + g + b) / 3)
    peak = max(0.02, max(r, g, b))

    def stop(target, neutral):
        k = min(target / mean, 1 / peak)
        return np.array([min(1, x * k) * (1 - neutral) + target * neutral
                         for x in (r, g, b)]) * 255
    return [stop(0.30 * strength, 0.30), stop(0.13 * strength, 0.22),
            stop(0.025 * strength, 0.10)]


def grid():
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    return xx + 0.5, yy + 0.5


def over(dst, col, a):
    """Source-over, a as a per-pixel 0..1 array."""
    a3 = a[..., None]
    return dst * (1 - a3) + np.asarray(col, float) * a3


def ring(r, radius, width):
    """Anti-aliased coverage of a stroke centred on `radius`, in px units."""
    return np.clip(width / 2 - np.abs(r - radius) + 0.5, 0, 1)


def fill(r, radius):
    return np.clip(radius - r + 0.5, 0, 1)


def angular(theta, stops, angle_deg):
    """SwiftUI AngularGradient: location 0 at `angle`, clockwise."""
    t = ((theta - math.radians(angle_deg)) / (2 * math.pi)) % 1.0
    out = np.zeros_like(t)
    for i in range(len(stops) - 1):
        l0, v0 = stops[i]
        l1, v1 = stops[i + 1]
        m = (t >= l0) & (t <= l1)
        u = np.zeros_like(t)
        if l1 > l0:
            u[m] = (t[m] - l0) / (l1 - l0)
        out[m] = v0 + (v1 - v0) * u[m]
    return out


def draw_tile(*, halo=0.0, shadow=False, flecks=0, tracks=False,
              accent='#6E8CFF', eq=('#C6ECFF', '#2E7DFF', '#1340E6'),
              size=None, trough=0.55, wall=0.055, band_wall=0.10):
    """`size` is RecordView's size at k = 1, i.e. its share of the 158pt
    reference tile — so 139 is what ships and 150 is a record that very
    nearly fills the tile. `trough`, `wall` and `band_wall` are the three
    numbers that decide how DEFINED the grooves read: the cut, the light on
    its outer wall, and the light on a between-tracks band."""
    S = (size if size is not None else SIZE) * SS
    R = S / 2
    cx = cy = N / 2
    x, y = grid()
    dx, dy = x - cx, y - cy
    r = np.hypot(dx, dy)
    theta = np.arctan2(dy, dx)

    img = np.zeros((N, N, 3), float)

    if halo > 0:
        # ── CANDIDATE: the ball tile's own station halo, so the two squares
        #    belong to the same station rather than one being monochrome ──
        st = ball_halo_stops(accent, halo)
        hr = np.hypot(x - 0.5 * N, y - 0.34 * N) / (100 * SS)
        t = np.clip(hr, 0, 1)
        img = np.zeros((N, N, 3), float)
        m = t <= 0.5
        u = np.where(m, t / 0.5, (t - 0.5) / 0.5)[..., None]
        lo = np.where(m[..., None], st[0], st[1])
        hi = np.where(m[..., None], st[1], st[2])
        img = lo + (hi - lo) * u
    else:
        # ── the tile's backdrop: RadialGradient #1a1a1f -> #08080a,
        #    centre (0.38, 0.30) of the tile, endRadius 150 ──
        br = np.hypot(x - 0.38 * N, y - 0.30 * N) / (150 * SS)
        t = np.clip(br, 0, 1)[..., None]
        img = hexc('#1a1a1f') * (1 - t) + hexc('#08080a') * t

    # ── CANDIDATE: a contact shadow under the record ──
    if shadow:
        sr = np.hypot(dx, (dy - 6 * SS) * 1.06)
        a = 0.62 * np.clip(1 - (sr - R * 0.80) / (R * 0.46), 0, 1) ** 1.5
        img = over(img, (0, 0, 0), a)

    # ── the body ──
    img = over(img, (255 * 0.045,) * 3, fill(r, R))

    # ── grooves: the trough, then the lit wall just outside it ──
    pitch = 1.7 * SS
    ring_count = max(6, int((S * (0.99 - 0.46) / 2) / pitch))
    # CANDIDATE: the gaps between tracks. A pressing is not one continuous
    # spiral to look at — the lead-out of one track and the lead-in of the
    # next leave a wider, glassier band, and those bands are how anyone
    # recognises a record across a room. Drawn by SKIPPING the trough at a
    # few rings and putting the land's own grey there instead.
    bands = set()
    if tracks:
        for f in (0.20, 0.38, 0.55, 0.72):
            bands.add(int(round(f * ring_count)))
    for i in range(ring_count):
        d = S * 0.99 - i * pitch * 2
        if i in bands:
            img = over(img, (255 * 0.058,) * 3, ring(r, d / 2, pitch * 1.9))
            img = over(img, (255, 255, 255), band_wall * ring(r, (d + pitch * 1.1) / 2, 0.5 * SS))
            continue
        img = over(img, (0, 0, 0), trough * ring(r, d / 2, pitch * 0.62))
        img = over(img, (255, 255, 255), wall * ring(r, (d + pitch * 0.66) / 2, 0.5 * SS))

    # ── the two smooth bands: OPAQUE greys, so they cover the grooves ──
    img = over(img, (255 * 0.055,) * 3, ring(r, S * 0.968 / 2, S * 0.030))
    img = over(img, (255 * 0.058,) * 3, fill(r, S * 0.50 / 2))

    # ── CANDIDATE: dust and wear on the pressing ──
    if flecks:
        rng = np.random.default_rng(7)
        for _ in range(flecks):
            ang = rng.uniform(0, math.tau)
            rad = S * rng.uniform(0.27, 0.47)
            fx, fy = cx + math.cos(ang) * rad, cy + math.sin(ang) * rad
            ln = rng.uniform(1.0, 3.2) * SS
            ux, uy = math.cos(ang + 1.3), math.sin(ang + 1.3)
            # distance to the fleck's own short segment
            px, py = x - fx, y - fy
            t2 = np.clip(px * ux + py * uy, -ln, ln)
            dseg = np.hypot(px - t2 * ux, py - t2 * uy)
            a = rng.uniform(0.05, 0.13) * np.clip(1 - dseg / (0.55 * SS), 0, 1)
            img = over(img, (255, 255, 255), a * fill(r, R * 0.99))

    # ── the sheen: falloff only, never a hard wedge ──
    sx = cx - R + S * 0.32
    sy = cy - R + S * 0.24
    sr = np.hypot(x - sx, y - sy)
    a = 0.15 * np.clip(1 - sr / (S * 0.62), 0, 1) * fill(r, R)
    img = over(img, (255, 255, 255), a)

    # ── the directional rim: an angular sweep, never one brightness ──
    v = angular(theta, [(0.00, 0.06), (0.11, 0.42), (0.26, 0.10),
                        (0.53, -0.50), (0.83, 0.05), (1.00, 0.06)], 190)
    cov = ring(r, S * 0.985 / 2, 1.2 * SS)
    img = over(img, (255, 255, 255), np.clip(v, 0, 1) * cov)
    img = over(img, (0, 0, 0), np.clip(-v, 0, 1) * cov)

    # ── the label: paper stuck onto vinyl, so it has a thickness ──
    LD = S * 0.42
    lr = LD / 2
    # its own shadow cast onto the disc
    lsr = np.hypot(dx, dy - S * 0.010)
    a = 0.55 * np.clip(1 - (lsr - lr) / (S * 0.018 * 2.2), 0, 1)
    img = over(img, (0, 0, 0), a)
    # the red pressing, from the label's own unit space
    lx = cx - lr + LD * 0.38
    ly = cy - lr + LD * 0.30
    lrad = np.clip(np.hypot(x - lx, y - ly) / (S * 0.26), 0, 1)
    c0, c1, c2 = hexc('#d8402f'), hexc('#96271b'), hexc('#7a1e14')
    t = lrad[..., None]
    lab = np.where(t < 0.5, c0 + (c1 - c0) * (t / 0.5), c1 + (c2 - c1) * ((t - 0.5) / 0.5))
    m = fill(r, lr)[..., None]
    img = img * (1 - m) + lab * m
    # the paper edge: lit at the top, shadowed at the foot
    up = -dy / np.maximum(r, 1e-6)
    v = 0.34 * np.clip(up, 0, 1) - 0.46 * np.clip(-up, 0, 1)
    cov = ring(r, lr, 1 * SS)
    img = over(img, (255, 255, 255), np.clip(v, 0, 1) * cov)
    img = over(img, (0, 0, 0), np.clip(-v, 0, 1) * cov)

    # ── spindle hole, and the accent hairline round the whole record ──
    img = over(img, (0, 0, 0), 0.55 * fill(r, S * 0.055 / 2))
    img = over(img, hexc(accent), 0.55 * ring(r, R, 0.8 * SS))

    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    return im.resize((N // 2, N // 2), Image.LANCZOS)


def measure(im, label, size=None):
    a = np.asarray(im).astype(float)
    n = a.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    r = np.hypot(xx - n / 2, yy - n / 2)
    Rp = (size if size is not None else SIZE) * (SS // 2) / 2
    disc = r <= Rp * 0.99
    room = r > Rp * 1.03
    dl = a[disc].mean(axis=1)
    rl = a[room].mean(axis=1)
    px = a[room]
    mx = px.max(axis=1); mn = px.min(axis=1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    # how strongly the record's own edge separates from what is behind it
    band_in = (r > Rp * 0.90) & (r <= Rp * 0.99)
    band_out = (r > Rp * 1.01) & (r <= Rp * 1.10)
    # HOW DEFINED THE GROOVES ARE, as a number rather than an impression:
    # the spread between the light and the dark inside the groove area. A
    # flat black disc scores near zero whatever its median is.
    gr = (r > Rp * 0.50) & (r < Rp * 0.94)
    gl = a[gr].mean(axis=1)
    groove = float(np.percentile(gl, 90) - np.percentile(gl, 10))
    print(f'{label:34} disc {np.median(dl):6.2f}  room {np.median(rl):6.2f}  '
          f'room colour {sat.mean():.3f}  '
          f'edge step {np.median(a[band_in].mean(axis=1)) - np.median(a[band_out].mean(axis=1)):6.2f}  '
          f'groove spread {groove:5.2f}')


if __name__ == '__main__':
    # THE DUST WAS DRAWN AND IS NOT SHIPPING. 14 to 30 flecks of wear on the
    # pressing moved no number at all (disc median 28.00 either way) and at the
    # size a phone draws this they are a handful of pale specks that read as
    # marks on a screen rather than as an owned record. Pass flecks=14 to see
    # it again before anyone proposes it a second time.
    # THE 20.09 ROUND'S OWN QUESTION was how strong the station halo should
    # be, and it was settled at 0.70 — pass halo=1.0/0.50/0.35 to see that
    # comparison again. The shots below are the 24.09 one: the owner, off a
    # photograph of the large tile, asked for the record "larger (fill the
    # space) and more defined", with the tonearm off.
    #
    # `size` is the record's share of the 158pt reference tile, so the same
    # numbers describe the small tile and the large one.
    STATION = dict(halo=0.70, shadow=True, tracks=True, accent='#E0483A',
                   eq=('#FF9A8A', '#E0483A', '#8E1F16'))
    DEFINED = dict(trough=0.70, wall=0.105, band_wall=0.17)
    shots = [
        ('large: 108, with the arm',  dict(size=108)),
        ('large: 150, no arm',        dict(size=150)),
        ('large: 150 + defined',      dict(size=150, **DEFINED)),
        # REJECTED, and drawn so nobody proposes it twice: at this contrast
        # the between-track bands read as countable rings, which is the
        # "target printed on a black disc" fault 03.09 removed.
        ('large: too far (rejected)', dict(size=150, trough=0.80, wall=0.150,
                                           band_wall=0.22)),
        ('small: 139 + defined',      dict(size=139, **DEFINED)),
    ]
    ims = []
    for cap, kw in shots:
        k = dict(STATION); k.update(kw)
        im = draw_tile(**k)
        measure(im, cap, size=kw.get('size'))
        ims.append((cap, im))
    W = ims[0][1].size[0]
    pad = 24
    sheet = Image.new('RGB', (W * len(ims) + pad * (len(ims) + 1), W + pad * 2 + 30), (14, 14, 17))
    dd = ImageDraw.Draw(sheet)
    for i, (cap, im) in enumerate(ims):
        xx = pad + i * (W + pad)
        sheet.paste(im, (xx, pad + 30))
        dd.text((xx, pad + 8), cap, fill=(230, 230, 235))
    out = os.environ.get('OUT', '/tmp/record_widget_compare.png')
    sheet.save(out)
    print('saved', out)
