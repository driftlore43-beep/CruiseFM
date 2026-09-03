"""
The mirror ball, built the way the APP builds it rather than as a tile grid.

The app's ball (MirrorBallFlipbook) is a real sphere projection: each mirror is
a quad between two latitudes and two longitudes, projected through the sphere,
back-face culled, and shaded by where it POINTS rather than by its position —
reflection direction r = 2(n.v)n - v against a few fixed lamps. Neighbouring
mirrors point about 11 degrees apart and reflection doubles that, so they land
on completely different parts of the room and come out wildly different. That
dark-beside-bright checkerboard is what sells chrome; a smooth gradient reads
as a painted sphere.

BRICK BOND (alternate rows offset half a column) is how a real ball is built,
and it also kills the continuous vertical seams that otherwise stack up and
read as a drawn grid.
"""
import math, random

def _n(v):
    m = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / m for c in v)

LAMPS = [_n((-0.58, -0.55, 0.60)), _n((0.66, -0.10, 0.74)), _n((0.06, 0.62, 0.78))]
VIEW = (0.0, 0.0, 1.0)

def mirror_ball(size=200, rows=17, cols=30, seed=11, tilt=-0.16, shrink=0.91):
    rnd = random.Random(seed)
    R = size / 2.0
    cx = cy = R
    out = []
    for i in range(rows):
        la0 = math.pi * (i / rows) - math.pi / 2
        la1 = math.pi * ((i + 1) / rows) - math.pi / 2
        bond = 0.5 if i % 2 else 0.0
        for j in range(cols):
            lo0 = 2 * math.pi * ((j + bond) / cols)
            lo1 = 2 * math.pi * ((j + 1 + bond) / cols)
            pts, ok = [], True
            ax = ay = az = 0.0
            for la, lo in ((la0, lo0), (la0, lo1), (la1, lo1), (la1, lo0)):
                x = math.cos(la) * math.sin(lo)
                y = math.sin(la)
                z = math.cos(la) * math.cos(lo)
                yt = y * math.cos(tilt) - z * math.sin(tilt)
                zt = y * math.sin(tilt) + z * math.cos(tilt)
                if zt < 0.03:          # back-face cull
                    ok = False
                    break
                pts.append((x, yt))
                ax += x; ay += yt; az += zt
            if not ok:
                continue
            # shrink toward the tile's own centre — the GAP is the grid
            mx = sum(p[0] for p in pts) / 4.0
            my = sum(p[1] for p in pts) / 4.0
            pts = [(mx + (px - mx) * shrink, my + (py - my) * shrink) for px, py in pts]
            nrm = _n((ax / 4, ay / 4, az / 4))
            ndv = sum(a * b for a, b in zip(nrm, VIEW))
            r = _n(tuple(2 * ndv * nrm[k] - VIEW[k] for k in range(3)))
            b = 0.20
            for L in LAMPS:
                d = max(0.0, sum(a * c for a, c in zip(r, L)))
                b += 0.86 * (d ** 9)
            b += rnd.uniform(-0.13, 0.13)      # each mirror gets its own bit of room
            b = max(0.05, min(1.0, b))
            v = int(round(255 * (0.10 + 0.90 * (b ** 0.72))))
            d = ' '.join(f'{cx + px * R:.1f},{cy - py * R:.1f}' for px, py in pts)
            out.append(f'<polygon points="{d}" fill="rgb({v},{v},{max(0,v-2)})"/>')
    return ''.join(out)

def ball_svg(size=200, **kw):
    return (f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" '
            f'style="display:block;overflow:visible;">'
            f'<defs><radialGradient id="bodyg" cx="38%" cy="30%">'
            f'<stop offset="0" stop-color="#2a2c33"/><stop offset="1" stop-color="#08090c"/>'
            f'</radialGradient></defs>'
            f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="url(#bodyg)"/>'
            + mirror_ball(size, **kw)
            + f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="none" '
              f'stroke="rgba(255,255,255,.10)" stroke-width="1"/></svg>')
