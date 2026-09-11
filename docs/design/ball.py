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

# A PARTY PALETTE, one colour per lamp — pink, blue, purple — so each mirror
# is tinted by WHICH lamp is actually catching it rather than painted a
# single colour overall. A mirror straddling two lamps' light blends between
# their colours the same way it already blends brightness between them.
LAMP_COLORS = [(255, 120, 190), (120, 175, 255), (190, 125, 255)]

def mirror_ball(size=200, rows=17, cols=30, seed=11, tilt=-0.16, shrink=0.91, party=False):
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
            lamp_w = []
            for L in LAMPS:
                d = max(0.0, sum(a * c for a, c in zip(r, L)))
                w = d ** 9
                lamp_w.append(w)
                b += 0.86 * w
            b += rnd.uniform(-0.13, 0.13)      # each mirror gets its own bit of room
            b = max(0.05, min(1.0, b))
            v = int(round(255 * (0.10 + 0.90 * (b ** 0.72))))
            if party:
                # TINT ONLY WHERE THE LIGHT ACTUALLY LANDS: a mirror caught by
                # no lamp stays plain silver (wsum ~ 0), one caught square-on
                # by a single lamp goes nearly that lamp's own colour, and one
                # between two lamps blends — exactly how the brightness itself
                # is built above, just carried into colour too.
                wsum = sum(lamp_w)
                if wsum > 0.002:
                    cr = sum(w * c[0] for w, c in zip(lamp_w, LAMP_COLORS)) / wsum
                    cg = sum(w * c[1] for w, c in zip(lamp_w, LAMP_COLORS)) / wsum
                    cb = sum(w * c[2] for w, c in zip(lamp_w, LAMP_COLORS)) / wsum
                    strength = min(1.0, wsum * 1.5) * 0.68
                    rr = int(max(0, min(255, v * (1 - strength) + cr * strength)))
                    gg = int(max(0, min(255, v * (1 - strength) + cg * strength)))
                    bb = int(max(0, min(255, v * (1 - strength) + cb * strength)))
                    fill = f'rgb({rr},{gg},{bb})'
                else:
                    fill = f'rgb({v},{v},{max(0,v-2)})'
            else:
                fill = f'rgb({v},{v},{max(0,v-2)})'
            d = ' '.join(f'{cx + px * R:.1f},{cy - py * R:.1f}' for px, py in pts)
            out.append(f'<polygon points="{d}" fill="{fill}"/>')
    return ''.join(out)

def ball_svg(size=200, **kw):
    party = kw.get('party', False)
    body0, body1 = ('#332536', '#0d0812') if party else ('#2a2c33', '#08090c')
    return (f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" '
            f'style="display:block;overflow:visible;">'
            f'<defs><radialGradient id="bodyg" cx="38%" cy="30%">'
            f'<stop offset="0" stop-color="{body0}"/><stop offset="1" stop-color="{body1}"/>'
            f'</radialGradient></defs>'
            f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="url(#bodyg)"/>'
            + mirror_ball(size, **kw)
            + f'<circle cx="{size/2}" cy="{size/2}" r="{size/2}" fill="none" '
              f'stroke="rgba(255,255,255,.10)" stroke-width="1"/></svg>')
