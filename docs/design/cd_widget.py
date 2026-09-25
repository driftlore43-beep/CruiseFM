"""
The CD widget's TILE, drawn the way the Swift draws it at the size an iPhone
renders it: a 158pt tile, k = 1.

Written 2026-09-10 for the disc alone; the case and the tile around it were
REBUILT 2026-09-21, because what was here drew build 47 — case inset 8,
radius 16, three flat tabs, a 124pt disc sidestepped 6pt right — and every one
of those has since moved (case option D on 11.09, the disc to 132 the same
day, the sidestep off on 15.09). A harness drawing the build before last
cannot answer a question about the tile on a phone, which is what the owner
asked on 21.09: "could you fix the CD square for iPhone also?"

TWO COVERS, ALWAYS. The demo station's photograph is a near-black night shot
(after-midnight.jpg, mean 14.7/255), so a brightness or contrast change
measured on it alone can look like nothing happened — the trap this file
already fell into on 10.09. Every comparison runs a dark cover and a bright
one side by side.

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

def ring_wave(t, pitch, band=0.006):
    """pressedRingStops' own shape: full at each ring, falling to clear over
    `band`, then ramping BACK UP across the rest of the pitch to the next
    ring. It is a sawtooth rather than a hairline, which is why the shipped
    tracks read as broad concentric banding inside the fans."""
    ph = (t % pitch)
    return np.where(ph < band, 1 - ph / band, (ph - band) / max(pitch - band, 1e-6))


# ── the disc ─────────────────────────────────────────────────────────────
# The station's own reference disc, sampled 11.09 (docs/design + /tmp/cd_ref):
# the vivid bands are PINK/MAGENTA (~310-325deg), VIOLET (~262-278), BLUE and
# TURQUOISE/TEAL (~186-210). The yellow-gold in a raw photo is the silver metal
# itself, not the diffraction — so the spectrum drops the generic green/yellow/
# orange the old wheel carried and runs pink -> violet -> blue -> turquoise.
# WEIGHTED TOWARD PINK/PURPLE 11.09 (owner: "add more pink and purple to the
# rainbow"): pink now enters earlier and holds two stops, violet holds two more,
# so pink+purple owns the inner ~0.6 of the fan and blue/turquoise are a thin
# outer rim rather than half the sweep.
SPECTRUM = [
    (0.00, (0, 0, 0), 0.0),
    (0.09, hexc('#ff4fbf'), 0.65),  # pink, in early
    (0.26, hexc('#ff6ad6'), 1.0),   # bright pink
    (0.44, hexc('#cf6dff'), 1.0),   # magenta-violet
    (0.60, hexc('#9b7cff'), 1.0),   # violet
    (0.80, hexc('#5a9cff'), 1.0),   # blue
    (0.93, hexc('#2fd6dc'), 0.6),   # turquoise, thin outer rim
    (1.00, (0, 0, 0), 0.0),
]

# ── PER-BEAM SPECTRA, LIGHT ──────────────────────────────────────────────
# Owner 11.09: "keep A [the smooth gradient] — but add in a faint of orange,
# make sure the colours aren't exactly the same on the disc... one side has
# orange, the other side doesn't but has turquoise. Keeping shades of pink and
# purple the main colours. Keep the colours light, not heavily saturated."
#
# So the two beams no longer share one spectrum: pink and purple carry both,
# but the WARM beam adds a FAINT orange at its inner edge and the COOL beam
# adds a soft turquoise at its outer edge — the disc is no longer symmetric.
# Every colour is a pastel at reduced alpha so the face stays light rather
# than a saturated rainbow. `_p` variants nudge one accent up for the dials.
SPECTRA = {
    'warm': [
        (0.00, (0, 0, 0), 0.0),
        (0.12, hexc('#ffbc8a'), 0.48),  # faint orange, locked to B (owner 11.09)
        (0.30, hexc('#ff9fd4'), 0.72),  # light pink
        (0.55, hexc('#ff88cc'), 0.80),  # pink
        (0.80, hexc('#c3a8ff'), 0.76),  # lavender
        (0.94, hexc('#d6c6ff'), 0.42),  # pale lavender
        (1.00, (0, 0, 0), 0.0),
    ],
    'warm_p': [
        (0.00, (0, 0, 0), 0.0),
        (0.12, hexc('#ffbc8a'), 0.48),  # a touch more orange
        (0.34, hexc('#ff9fd4'), 0.76),
        (0.58, hexc('#ff88cc'), 0.82),
        (0.82, hexc('#c3a8ff'), 0.76),
        (0.95, hexc('#d6c6ff'), 0.42),
        (1.00, (0, 0, 0), 0.0),
    ],
    'cool': [
        (0.00, (0, 0, 0), 0.0),
        (0.12, hexc('#ff9fd4'), 0.70),  # light pink
        (0.34, hexc('#ff88cc'), 0.80),  # pink
        (0.58, hexc('#c3a8ff'), 0.76),  # lavender
        (0.80, hexc('#a3e6dc'), 0.58),  # soft turquoise
        (0.94, hexc('#c6efe8'), 0.32),  # pale turquoise
        (1.00, (0, 0, 0), 0.0),
    ],
    'cool_p': [
        (0.00, (0, 0, 0), 0.0),
        (0.12, hexc('#ff9fd4'), 0.66),
        (0.32, hexc('#ff88cc'), 0.78),
        (0.54, hexc('#c3a8ff'), 0.74),
        (0.76, hexc('#8fe0d6'), 0.68),  # more turquoise
        (0.92, hexc('#bff0e8'), 0.42),
        (1.00, (0, 0, 0), 0.0),
    ],
    'pink': [  # the faint middle beam — pink/purple only, no accent
        (0.00, (0, 0, 0), 0.0),
        (0.15, hexc('#ff9fd4'), 0.66),
        (0.50, hexc('#ff88cc'), 0.76),
        (0.82, hexc('#c3a8ff'), 0.64),
        (1.00, (0, 0, 0), 0.0),
    ],
}
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

# `fans` is (bearing, spread, strength) and optionally a 4th entry naming the
# beam's own spectrum in SPECTRA (else the global SPECTRUM). bearing is degrees
# clockwise from straight up, matching DiffractionFan.
OPTIONS = {
    'A_build45': None,                                    # the old colour wheel
    'B_build47': [(34, 84, 0.95), (214, 72, 0.78), (128, 44, 0.34)],
    'C_four':    [(30, 62, 0.92), (150, 62, 0.72), (210, 62, 0.88), (330, 62, 0.66)],
    'D_two_wide':[(38, 118, 1.00), (218, 104, 0.86)],
    # LIGHT, ASYMMETRIC gradient (owner 11.09): warm beam carries the faint
    # orange, cool beam the turquoise, both pink/purple-led, plus a faint
    # pink middle. G_light is the same, dimmer; the _p dials push one accent.
    'G_A':      [(34, 84, 0.88, 'warm'),  (214, 72, 0.74, 'cool'),  (128, 44, 0.28, 'pink')],
    'G_orange': [(34, 84, 0.90, 'warm_p'),(214, 72, 0.74, 'cool'),  (128, 44, 0.28, 'pink')],
    'G_light':  [(34, 84, 0.88, 'warm'),  (214, 72, 0.74, 'cool'),  (128, 44, 0.28, 'pink')],
    'G_turq':   [(34, 84, 0.88, 'warm'),  (214, 72, 0.80, 'cool_p'),(128, 44, 0.28, 'pink')],
    # 14.09 — owner: "add some transparency to the CD widget. The rainbow
    # reflective effect is also missing, or it's not as visible." Same beams
    # as G_A; what changes is DISC_ALPHA (the disc stops being an opaque puck
    # and lets the case and the tile show through, which is what a clear
    # pressing does) and, for I, the fans' own intensity.
    'H_clear':  [(34, 84, 0.88, 'warm'),  (214, 72, 0.74, 'cool'),  (128, 44, 0.28, 'pink')],
    'I_vivid':  [(34, 84, 0.88, 'warm'),  (214, 72, 0.74, 'cool'),  (128, 44, 0.28, 'pink')],
    'J_less_silver': [(34, 84, 0.88, 'warm'), (214, 72, 0.74, 'cool'), (128, 44, 0.28, 'pink')],
    'K_wider':       [(34, 104, 0.88, 'warm'),(214, 92, 0.74, 'cool'), (128, 56, 0.28, 'pink')],
    # WHAT THE SWIFT CAN ACTUALLY DO. `strength` reaches SwiftUI as
    # `.opacity(strength)`, which CLAMPS at 1 — so an option that leans on a
    # 1.4x multiplier is showing something the widget will not draw, and a
    # mockup that lies about the code costs a round of confusion every time
    # (03.09). These are the numbers as they will be written.
    'L_swift':       [(34, 104, 1.00, 'warm'),(214, 92, 1.00, 'cool'), (128, 56, 0.39, 'pink')],
}

# How opaque the disc itself is. 1.0 is a solid puck, which is what shipped;
# below that the jewel case and the tile behind show through the pressing.
DISC_ALPHA = {'H_clear': 0.74, 'I_vivid': 0.74, 'J_less_silver': 0.74, 'K_wider': 0.74,
              'L_swift': 0.74}

# The clear-silver SCREEN over the whole face (11.09). It is what lifts a dark
# cover toward metal — and it is also what washes the rainbow out, so it is the
# real dial for "the rainbow is not as visible".
SILVER = {'J_less_silver': 0.26, 'K_wider': 0.30, 'L_swift': 0.30}
# option-level colour intensity multiplier (default 1.0); G_light rides lower
# to read even softer.
INTENSITY = {'G_light': 0.80, 'I_vivid': 1.5, 'J_less_silver': 1.5, 'K_wider': 1.4}

WHEEL = ['#6ad0ff', '#b98cff', '#ff9ad0', '#ffd68a', '#a8ffcf', '#6ad0ff']

# ── STREAKS ──────────────────────────────────────────────────────────────
# Owner 11.09: "the colours [shouldn't] disperse just as a gradient... let's
# try to make streaks of pink, orange, turquoise, purple that can overlap like
# the image." So instead of one smooth radial spectrum per fan, each beam is
# built from several narrow SINGLE-COLOUR rays laid side by side across the
# beam and SCREEN-blended, so where two rays overlap their colours add into a
# new hue — the way the reference photo's beams show a pink ray, an orange
# ray, a turquoise ray and a purple ray sitting next to each other, blending
# at their edges rather than melting into one gradient.
STREAK_PALETTE = [
    hexc('#ff7a3c'),   # orange
    hexc('#ff5ec8'),   # pink
    hexc('#a86cff'),   # purple
    hexc('#2fd6dc'),   # turquoise
]
# radial brightness envelope shared by every ray: fades in off the hub, holds
# across the reflective land, drops at the rim. Colour-independent, so all the
# rays share one shape and only the hue changes across the beam.
ENV_STOPS = [(0.00, (1, 1, 1), 0.0), (0.15, (1, 1, 1), 0.9),
             (0.55, (1, 1, 1), 1.0), (0.85, (1, 1, 1), 0.55),
             (1.00, (1, 1, 1), 0.0)]
# beams are (bearing, spread, strength), matching the fan geometry.
STREAKS = {
    'S_streaks': [(34, 82, 0.95), (214, 74, 0.82), (128, 40, 0.30)],
    'S_dense':   [(34, 82, 0.95), (214, 74, 0.82), (128, 40, 0.30)],
    'S_wide':    [(38, 120, 1.00), (218, 108, 0.86)],
}
# per-option (rays across a 90deg beam, how far each ray is widened past its
# slot so neighbours overlap): more/ wider = softer blending between colours.
STREAK_PARAMS = {'S_streaks': (10, 2.2), 'S_dense': (14, 2.7), 'S_wide': (9, 2.4)}

def disc(option, size=DISC, track_pitch=0.06, clear_margin=0.0,
         art=None, lit_hub=False, art_inner=0.0, art_turn=0.0, art_lift=0.0,
         fans=True, tracks=True):
    """`art_inner` is where the cover STOPS, as a fraction of the radius — 0
    fills the face, which is what the widget ships, and 0.34 leaves the middle
    as clear glass, which is what the app's own deck draws. `art_turn` turns
    the cover, the way a disc that has been spinning presents it. `art_lift`
    takes the darkening off, toward the app's own near-full-strength cover.

    `fans` is the diffraction rainbow and `tracks` the pressed rings — the
    two things the owner asked to see the disc WITHOUT on 25.09. Both remain
    switchable rather than deleted from the harness, because they are the two
    features that most say 'compact disc' and it is worth being able to put
    either back beside the other."""
    n = size
    y, x = np.mgrid[0:n, 0:n].astype(float)
    cx = cy = (n - 1) / 2.0
    dx = x - cx; dy = y - cy
    d = np.hypot(dx, dy)
    R = n / 2.0
    inside = d <= R
    ang = (np.degrees(np.arctan2(dy, dx))) % 360.0     # clockwise from 3 o'clock

    # album art, darkened and desaturated the way build 47 does
    im = Image.open(art or ART).convert('RGB')
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2,
                  (im.width - s) // 2 + s, (im.height - s) // 2 + s)).resize((n, n), Image.LANCZOS)
    if art_turn:
        # A disc that has been turning does not present its cover upright, and
        # that is most of what stops it reading as a square photograph cropped
        # to a circle. Expanded first so the corners cannot come into frame.
        big = im.resize((int(n * 1.5), int(n * 1.5)), Image.LANCZOS)
        big = big.rotate(art_turn, resample=Image.BICUBIC)
        o = (big.width - n) // 2
        im = big.crop((o, o, o + n, o + n))
    img = np.asarray(im).astype(float) / 255.0
    if option == 'A_build45':
        img = np.clip(img - 0.22, 0, 1)
        grey = img.mean(axis=2, keepdims=True)
        img = np.clip(grey + (img - grey) * 1.15, 0, 1)
    else:
        # -0.10 / 0.92 — the art is only a faint tint under the mirror now
        # that a clear-silver lift sits over it (below). Darkening it hard
        # was what made a clear disc read as a dark print.
        img = np.clip(img - 0.10 * (1 - art_lift), 0, 1)
        grey = img.mean(axis=2, keepdims=True)
        img = np.clip(grey + (img - grey) * (0.92 + 0.08 * art_lift), 0, 1)

    if art_inner > 0:
        # THE APP DRAWS THE COVER AS A RING, NOT A FILLED CIRCLE, and its own
        # comment in CDMode.tsx says why: "anything filled across the centre
        # reads as a big dark circle against a dark scene, which is exactly
        # what the printed-label version got wrong". Inside the ring the disc
        # is clear polycarbonate, so the hub and the diffraction sit in GLASS
        # rather than on a photograph — which is most of what stops the cover
        # reading as pasted on.
        edge = np.clip((d - art_inner * R) / (0.035 * R), 0, 1)[..., None]
        img = img * edge + np.full_like(img, 0.08) * (1 - edge)

    beams = OPTIONS.get(option) if fans else []
    if option in STREAKS:
        # Side-by-side single-colour rays, screen-blended so overlaps add
        # into new hues (owner 11.09: streaks that "overlap like the image").
        r0, r1 = 0.13 * n, 0.52 * n
        t = np.clip((d - r0) / (r1 - r0), 0, 1)
        _, env = stops_at(ENV_STOPS, t)
        # hairline tracks, same pitch/phase as the base rings below
        track = np.where(((d / R) % 0.06) / 0.06 < 0.10, 1.0, 0.0)
        rays_per_90, widen = STREAK_PARAMS[option]
        for bearing, spread, strength in STREAKS[option]:
            n_rays = max(4, int(round(spread / 90.0 * rays_per_90)))
            width = (spread / n_rays) * widen
            for k in range(n_rays):
                frac = (k + 0.5) / n_rays
                sub = bearing - spread / 2 + frac * spread
                col = np.array(STREAK_PALETTE[k % len(STREAK_PALETTE)])
                gangle = (sub - 90) - 180
                loc = ((ang - gangle) % 360) / 360.0
                _, wa = stops_at(wedge_stops(width), loc)
                a = wa * env * strength * 0.85
                img = screen(img, np.ones_like(img) * col, a)
                # the ray's own hairlines catch its light
                img = screen(img, np.ones_like(img), a * track * 0.55)
        mloc = ((ang - (-30 - 90)) % 360) / 360.0
        _, ma = stops_at(METAL, mloc)
        img = screen(img, np.ones_like(img), ma * 0.55)
        img = screen(img, np.full_like(img, 0.62), np.full(ang.shape, 0.42))
    elif fans is None:
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
        intensity = INTENSITY.get(option, 1.0)
        # Fine concentric tracks, now HAIRLINES (owner 11.09: "reduce the
        # groove thickness significantly — make them hairline thickness"): the
        # pitch is tighter (0.06 of the radius) and the lit band is only 0.10
        # of that pitch, so each groove is roughly a single pixel wide. Made
        # to CATCH THE LIGHT in the fans ("more visible near the reflected
        # area"). Same pitch as the base rings below so the two align.
        track = ring_wave(d / R, track_pitch) if tracks else np.zeros_like(d)
        for beam in (beams or []):
            bearing, spread, strength = beam[0], beam[1], beam[2]
            # each beam may name its own spectrum (warm/cool/pink) so the two
            # sides of the disc are NOT identical (owner 11.09).
            spec, sa = stops_at(SPECTRA[beam[3]] if len(beam) > 3 else SPECTRUM, t)
            # DiffractionFan turns the wedge back half a revolution so its
            # peak (location 0.5) lands on the bearing.
            gangle = (bearing - 90) - 180
            loc = ((ang - gangle) % 360) / 360.0
            _, wa = stops_at(wedge_stops(spread), loc)
            img = screen(img, spec, wa * sa * strength * intensity)
            # the tracks brighten where this fan's rainbow lands — gated by
            # the same wedge and the spectrum's own radial falloff.
            img = screen(img, np.ones_like(img), wa * sa * strength * intensity * track * 0.65)
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
        img = screen(img, np.full_like(img, 0.62),
                     np.full(ang.shape, SILVER.get(option, 0.42)))

    # The base tracks everywhere on the silver — now HAIRLINES (owner 11.09:
    # "reduce the groove thickness significantly — make them hairline
    # thickness"): a tighter 0.06 pitch with the lit band only 0.10 of it, at
    # opacity 0.015. On plain metal they are a barely-there shimmer; the fan
    # loop above lifts the SAME tracks where the rainbow lands, which is where
    # a real disc shows them most.
    if tracks:
        img = over(img, np.ones_like(img), ring_wave(d / R, track_pitch) * 0.015)

    # specular sweep, topLeading -> bottomTrailing
    sw = np.clip(((x / n) + (y / n)) / 2.0, 0, 1)
    _, spa = stops_at([(0.04, (1, 1, 1), 0.52), (0.20, (1, 1, 1), 0.0),
                       (0.72, (1, 1, 1), 0.0), (0.95, (1, 1, 1), 0.30)], sw)
    img = over(img, np.ones_like(img), spa)

    # ── THE CLEAR POLYCARBONATE MARGIN ──
    # A pressing's aluminium stops about 1.5mm short of the edge, so the last
    # of the disc is bare transparent plastic over whatever is behind it.
    if clear_margin > 0:
        _, ca = stops_at([(0.000, (0, 0, 0), 0.0), (0.945, (0, 0, 0), 0.0),
                          (0.975, (0, 0, 0), 0.55 * clear_margin),
                          (1.000, (0, 0, 0), 0.30 * clear_margin)], np.clip(d / R, 0, 1))
        img = over(img, np.zeros_like(img), ca)

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
    if lit_hub:
        # THE CLAMPING RING IS THE SAME METAL AS THE FACE. A flat pale fill is
        # a drawn circle; an angular ramp on the rim's own bearing makes the
        # hub catch the same lamp the rest of the disc does.
        hub = np.zeros((n, n, 4))
        hloc = ((ang - (-125 - 90)) % 360) / 360.0
        hcol, ha = stops_at([(0.00, (0.92, 0.92, 0.92), 0.72),
                             (0.30, (0.62, 0.62, 0.62), 0.40),
                             (0.55, (0.88, 0.88, 0.88), 0.64),
                             (0.82, (0.58, 0.58, 0.58), 0.36),
                             (1.00, (0.92, 0.92, 0.92), 0.72)], hloc)
        hm = (d <= r).astype(float)
        hub[..., :3] = hcol
        hub[..., 3] = ha * hm
        ov = Image.alpha_composite(ov, Image.fromarray((hub * 255).astype(np.uint8), 'RGBA'))
        dr = ImageDraw.Draw(ov)
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 115), width=SS)
    else:
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
    ImageDraw.Draw(mask).ellipse([0, 0, n - 1, n - 1],
                                 fill=int(255 * DISC_ALPHA.get(option, 1.0)))
    out.putalpha(mask)
    return out

# ── the jewel case and the tile ──────────────────────────────────────────
#
# REBUILT 21.09 TO THE CASE AS IT ACTUALLY SHIPS. What was here drew build
# 47's case — inset 8, radius 16, three flat tabs — under a 124pt disc
# sidestepped 6pt to the right, and every one of those has since moved: case
# option D landed 11.09 (inset 5, radius 13, a barrel hinge), the disc grew to
# 132 the same day, and the sidestep came off on 15.09. A harness drawing the
# build before last cannot answer a question about the tile on a phone.
#
# Everything below is ported from disc(_:k:) and JewelCase in ModeWidget.swift
# at k = 1, i.e. the 158pt tile an iPhone draws.

def rrect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle([box[0], box[1], box[2], box[3]], radius=radius,
                           fill=fill, outline=outline, width=max(1, int(round(width))))

def lin_alpha(x, y, n, p0, p1, stops):
    """SwiftUI LinearGradient alpha over a box, unit start/end points."""
    sx, sy = p0[0] * n, p0[1] * n
    ex, ey = p1[0] * n, p1[1] * n
    vx, vy = ex - sx, ey - sy
    L2 = vx * vx + vy * vy
    t = ((x - sx) * vx + (y - sy) * vy) / L2
    _, a = stops_at(stops, np.clip(t, 0, 1))
    return a

def jewel_case(n, pt, clip_alpha=0.44, clip_rib=3.2, k=1.0, furn=None):
    """The case, as its own RGBA layer over the tile. `pt` scales points.

    `k` is the tile's own scale against the 158pt reference — 2.139 on a large
    tile — and the case's BOX must take it, or the case stops filling the tile.

    `furn` is what the moulded DETAIL is scaled by, and it is a separate
    number for a reason the shipped Swift misses: a corner clip and a hinge
    knuckle are small FEATURES of the object, not shares of the tile. At k = 1
    they are 2.6pt ribs and 9x24pt knuckles, which is moulded plastic; at
    k = 2.139 they are 5.6pt ribs and 19x51pt knuckles, which is furniture
    drawn at twice life size — the owner's "rough on the edges". It defaults
    to `k`, i.e. what ships, so a comparison is against the real thing.
    """
    if furn is None:
        furn = k
    inset = 5 * k * pt
    radius = 13 * k * pt
    W = n - 2 * inset                      # the case's own box is inset by 5
    lay = Image.new('RGBA', (n, n), (0, 0, 0, 0))

    # ── the glass body: a white ramp across the case's own diagonal ──
    yy, xx = np.mgrid[0:int(W), 0:int(W)].astype(float)
    a = lin_alpha(xx, yy, W, (0, 0), (1, 1),
                  [(0.0, (1, 1, 1), 0.16), (0.5, (1, 1, 1), 0.02), (1.0, (1, 1, 1), 0.10)])
    body = np.dstack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a])
    body_im = Image.fromarray((body * 255).astype(np.uint8), 'RGBA')
    m = Image.new('L', (int(W), int(W)), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, int(W) - 1, int(W) - 1], radius=radius, fill=255)
    body_im.putalpha(Image.fromarray((np.asarray(m).astype(float) / 255 * a * 255).astype(np.uint8)))
    lay.paste(body_im, (int(inset), int(inset)), body_im)

    d = ImageDraw.Draw(lay)
    # outer stroke — marks the edge rather than drawing it
    rrect(d, [inset, inset, n - inset, n - inset], radius, outline=(255, 255, 255, 36), width=pt)
    # ── inner bevel: a dark line on the wall, a highlight just inside it ──
    rrect(d, [inset + pt, inset + pt, n - inset - pt, n - inset - pt], radius - pt,
          outline=(5, 7, 14, 66), width=pt)
    rrect(d, [inset + 3 * pt, inset + 3 * pt, n - inset - 3 * pt, n - inset - 3 * pt],
          radius - 3 * pt, outline=(255, 255, 255, 31), width=pt)

    # ── the barrel hinge down the spine ──
    fpt = furn * pt                        # points, at the furniture's scale
    sw = 12 * fpt
    sy0, sy1 = inset, n - inset
    hh = int(sy1 - sy0)
    yy, xx = np.mgrid[0:hh, 0:int(sw)].astype(float)
    sa = lin_alpha(xx, yy, sw, (0, 0), (1, 0),
                   [(0.0, (1, 1, 1), 0.16), (1.0, (1, 1, 1), 0.04)])
    strip = Image.fromarray(np.dstack([np.ones_like(sa), np.ones_like(sa),
                                       np.ones_like(sa), sa * 255]).astype(np.uint8), 'RGBA')
    lay.paste(strip, (int(inset), int(sy0)), strip)
    sd = ImageDraw.Draw(lay)
    # the strip's trailing edge
    sd.rectangle([inset + sw - fpt, sy0, inset + sw, sy1], fill=(255, 255, 255, 51))
    # the rule down the middle of the spine
    sd.rectangle([inset + sw / 2 - fpt / 2, sy0 + 18 * fpt, inset + sw / 2 + fpt / 2, sy1 - 18 * fpt],
                 fill=(255, 255, 255, 66))
    # CRUISE FM, set on its side
    txt = Image.new('RGBA', (int(70 * fpt), int(8 * fpt)), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    try:
        from PIL import ImageFont
        f = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
                               int(4.5 * fpt))
    except Exception:
        f = None
    td.text((0, 0), 'C R U I S E  F M', font=f, fill=(255, 255, 255, 71))
    txt = txt.rotate(90, expand=True)
    lay.alpha_composite(txt, (int(inset + sw / 2 - txt.width / 2), int(n / 2 - txt.height / 2)))
    # two knuckles and their pins
    kw, kh, gap = 9 * fpt, 24 * fpt, 20 * fpt
    top = n / 2 - (kh * 2 + gap) / 2
    for i in range(2):
        y0 = top + i * (kh + gap)
        x0 = inset + sw / 2 - kw / 2
        rrect(sd, [x0, y0, x0 + kw, y0 + kh], 4.5 * fpt,
              fill=(255, 255, 255, 36), outline=(255, 255, 255, 66), width=pt)
        pr = 4.4 * fpt / 2
        pcx, pcy = x0 + kw / 2, y0 + kh / 2
        sd.ellipse([pcx - pr, pcy - pr, pcx + pr, pcy + pr],
                   fill=(10, 12, 18, 140), outline=(255, 255, 255, 87), width=max(1, int(0.7 * pt)))

    # ── moulded corner clips ──
    # WHERE A CLIP SITS AND HOW BIG IT IS ARE TWO DIFFERENT NUMBERS, and
    # conflating them is what put the brackets outside the case (owner,
    # 25.09: "make sure the corners aren't overtaking the actual CD case").
    # The PADDING is a share of the box, so it has to take `k` — the case's
    # own corner radius does, and at furniture scale the clip's corner lands
    # 16.7pt from the tile edge against an arc centred 38.5pt in with a
    # 27.8pt radius, i.e. 30.8 from that centre and demonstrably OUTSIDE the
    # curve. At `6 * k` it lands 23.5pt in, 21.2 from the centre, inside it.
    # The clip's own SIZE stays furniture, which is the whole point.
    pad = 6 * k * pt
    cl = 17 * fpt
    rib = clip_rib * fpt
    for cx0, cy0, sx, sy in ((inset + pad, inset + pad, 1, 1),
                             (n - inset - pad, inset + pad, -1, 1),
                             (inset + pad, n - inset - pad, 1, -1),
                             (n - inset - pad, n - inset - pad, -1, -1)):
        x0, x1 = sorted([cx0, cx0 + sx * cl])
        y0, y1 = sorted([cy0, cy0 + sy * cl])
        if sy > 0:
            rrect(sd, [x0, y0, x1, y0 + rib], 1.6 * fpt, fill=(255, 255, 255, int(255 * clip_alpha)))
        else:
            rrect(sd, [x0, y1 - rib, x1, y1], 1.6 * fpt, fill=(255, 255, 255, int(255 * clip_alpha)))
        if sx > 0:
            rrect(sd, [x0, y0, x0 + rib, y1], 1.6 * fpt, fill=(255, 255, 255, int(255 * clip_alpha)))
        else:
            rrect(sd, [x1 - rib, y0, x1, y1], 1.6 * fpt, fill=(255, 255, 255, int(255 * clip_alpha)))

    # ── the two sweeps of light on the plastic ──
    yy, xx = np.mgrid[0:int(W), 0:int(W)].astype(float)
    for p0, p1, st in (((0, 0), (1, 1), [(0.04, (1, 1, 1), 0.20), (0.26, (1, 1, 1), 0.0),
                                         (0.74, (1, 1, 1), 0.0), (0.96, (1, 1, 1), 0.10)]),
                       ((1, 0), (0, 1), [(0.0, (1, 1, 1), 0.10), (0.34, (1, 1, 1), 0.0)])):
        a = lin_alpha(xx, yy, W, p0, p1, st)
        sw_im = Image.fromarray(np.dstack([np.ones_like(a), np.ones_like(a),
                                           np.ones_like(a), a]).astype(float).__mul__(255).astype(np.uint8), 'RGBA')
        mm = np.asarray(m).astype(float) / 255
        sw_im.putalpha(Image.fromarray((a * mm * 255).astype(np.uint8)))
        lay.alpha_composite(sw_im, (int(inset), int(inset)))
    return lay


def tile(option='L_swift', accent='#9b5cff', halo=1.0, disc_size=132,
         track_pitch=0.06, clear_margin=0.0, clip_alpha=0.44, clip_rib=3.2,
         disc_alpha=0.74, silver=None, art=None, lit_hub=False, pt=SS,
         k=1.0, furn=None, art_inner=0.0, art_turn=0.0, art_lift=0.0,
         fans=True, tracks=True):
    """`k` is the tile's scale against the 158pt reference: 1 for a small
    tile, 338/158 = 2.139 for a large one. Everything that is a share of the
    tile takes it; `furn` is what the case's moulded DETAIL takes, and
    defaults to `k`, which is what ships."""
    if furn is None:
        furn = k
    n = int(158 * k * pt)
    y, x = np.mgrid[0:n, 0:n].astype(float)
    g = ((x / n) + (y / n)) / 2
    c0 = np.array(hexc('#1c1f26')); c1 = np.array(hexc('#080a0e'))
    bg = c0[None, None, :] * (1 - g[..., None]) + c1[None, None, :] * g[..., None]
    base = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8)).convert('RGBA')

    case = jewel_case(n, pt, clip_alpha=clip_alpha, clip_rib=clip_rib, k=k, furn=furn)
    base = Image.alpha_composite(base, case)

    # ── the accent glow behind the disc, drawn as falloff (14.09) ──
    if halo > 0:
        d = np.hypot(x - n / 2, y - n / 2) / (96 * k * pt)
        acc = np.array(hexc(accent))
        _, ga = stops_at([(0.00, (0, 0, 0), 0.32), (0.52, (0, 0, 0), 0.26),
                          (0.80, (0, 0, 0), 0.10), (1.00, (0, 0, 0), 0.00)], np.clip(d, 0, 1))
        ga = ga * halo
        glow = np.dstack([np.full_like(ga, acc[0]), np.full_like(ga, acc[1]),
                          np.full_like(ga, acc[2]), ga])
        base = Image.alpha_composite(base, Image.fromarray((glow * 255).astype(np.uint8), 'RGBA'))

    # ── the disc, with its contact shadow ──
    ds = int(disc_size * k * pt)
    if silver is not None:
        SILVER['L_swift'] = silver
    dsc = disc(option, size=ds, track_pitch=track_pitch, clear_margin=clear_margin,
               art=art, lit_hub=lit_hub, art_inner=art_inner, art_turn=art_turn,
               art_lift=art_lift, fans=fans, tracks=tracks)
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    r_ = ds / 2
    ImageDraw.Draw(sh).ellipse([n / 2 - r_, n / 2 - r_ + 5 * k * pt, n / 2 + r_, n / 2 + r_ + 5 * k * pt],
                               fill=(0, 0, 0, int(255 * 0.62)))
    sh = sh.filter(ImageFilter.GaussianBlur(9 * k * pt / 2))
    base = Image.alpha_composite(base, sh)
    faded = dsc.copy()
    faded.putalpha(Image.fromarray((np.asarray(dsc.split()[3]).astype(float) * disc_alpha).astype(np.uint8)))
    base.alpha_composite(faded, (int(n / 2 - ds / 2), int(n / 2 - ds / 2)))

    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=22 * k * pt, fill=255)
    base.putalpha(mask)
    return base



def measure(im, disc_size=132, pt=SS, k=1.0):
    """What reads on the tile, in luminance levels out of 255."""
    a = np.asarray(im.convert('RGB')).astype(float)
    n = a.shape[0]
    lum = a.mean(axis=2)
    yy, xx = np.mgrid[0:n, 0:n]
    r = np.hypot(xx - n / 2, yy - n / 2)
    R = disc_size * k * pt / 2
    disc_m = r <= R * 0.98
    out = {}
    out['disc_median'] = float(np.median(lum[disc_m]))
    px = a[disc_m]
    mx = px.max(axis=1); mn = px.min(axis=1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    out['tinted'] = float(100 * (sat > 0.18).mean())
    # THE HINGE BAND, the thing the owner's own device screenshot measured as
    # dead flat on 15.09: a column across the spine at the tile's mid-height.
    row = int(n / 2)
    band = [float(lum[row, int(v * pt)]) for v in range(2, 26, 2)]
    out['hinge_profile'] = band
    out['hinge_range'] = max(band) - min(band)
    # how far the case's own edge steps against the tile background just
    # outside it — a case you can find at all
    edge_in = float(np.median(lum[row, int(6 * pt):int(9 * pt)]))
    edge_out = float(np.median(lum[row, int(1 * pt):int(4 * pt)]))
    out['case_edge_step'] = edge_in - edge_out
    # HOW COUNTABLE THE TRACKS ARE, reported as the pitch in POINTS rather
    # than by hunting peaks in a photograph — a peak counter run over an album
    # cover measures the cover. A record's grooves are 1.7pt apart on the
    # Record tile; below ~1.2pt neighbouring rings moire. So a CD wants to sit
    # just above that floor and well under the record's, and the picture is
    # what says whether it reads.
    R = disc_size * k * pt / 2
    # the rim: how far the last of the disc steps against the data area, i.e.
    # whether the pressing has a visible edge or the art runs off it
    inner = float(np.median(lum[row, int(n / 2 + R * 0.88):int(n / 2 + R * 0.93)]))
    margin = float(np.median(lum[row, int(n / 2 + R * 0.955):int(n / 2 + R * 0.985)]))
    out['rim_step'] = inner - margin
    return out


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    # ── THE 25.09 QUESTION ────────────────────────────────────────────────
    # Owner, with the large CD tile on her Home Screen beside the app's own CD
    # deck: "is there a way to get the widget have the same graphics as what's
    # in the app? the widget currently looks a bit rough on the edges and the
    # album cover sort of looks pasted on."
    #
    # TWO SEPARATE FAULTS, and each is one named change below.
    #
    #   ROUGH ON THE EDGES is the case's moulded DETAIL being multiplied by
    #   `k`. A corner clip and a hinge knuckle are small features of the
    #   object, not shares of the tile: at k = 1 they are 2.6pt ribs and
    #   9x24pt knuckles; on a large tile they are 5.6pt and 19x51pt, i.e.
    #   furniture at twice life size. The file already holds this rule for
    #   hairlines and the spine's type ("a 1pt stroke is a 1pt stroke at
    #   every size") and simply never applied it here.
    #
    #   PASTED ON is the cover filling the whole face, upright, under a
    #   silver screen. The app draws it as a RING with the middle left as
    #   clear glass, at near full strength, and turned — and its own comment
    #   says why: "anything filled across the centre reads as a big dark
    #   circle against a dark scene, which is exactly what the printed-label
    #   version got wrong."
    #
    # E RAISES THE DISC'S OPACITY, which is the one thing the 21.09 round
    # deliberately left to the owner: 0.74 lets the station's halo bleed
    # through the pressing, and roughly a quarter of what reads as colour on
    # the face is the halo rather than the disc. Raising it buys presence and
    # costs that. Her call, and this is the render to make it on.
    K = 338 / 158
    RING = dict(furn=1.0, art_inner=0.34, art_turn=-28)
    # SHIPPED 25.09: the owner picked E off the five-step sheet, then took two
    # more things off it — "E but remove the CD indents and the rainbow
    # effect. make sure the corners aren't overtaking the actual CD case."
    SHIPPED = dict(**RING, art_lift=1.0, silver=0.10, disc_alpha=0.97,
                   fans=False, tracks=False)
    STEPS = [
        ('A  what shipped before', dict()),
        ('B  + case detail at true size', dict(furn=1.0)),
        ('C  + cover as a ring, glass centre', dict(furn=1.0, art_inner=0.34)),
        ('D  + cover turned', dict(**RING)),
        ('E  + disc opaque, less silver', dict(**RING, art_lift=1.0,
                                               silver=0.10, disc_alpha=0.97)),
        ('F  SHIPPED: no rainbow, no rings', dict(**SHIPPED)),
    ]
    # TWO COVERS, ALWAYS — see the note at the top of this file.
    COVERS = [('bright cover', 'targets/widgets/daylight.jpg'),
              ('dark cover', 'targets/widgets/after-midnight.jpg')]

    from PIL import ImageFont
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 20)
        fs = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 17)
    except Exception:
        f = fs = None

    rows = []
    for cname, cpath in COVERS:
        row = []
        for cap, kw in STEPS:
            k2 = dict(art=cpath, k=K, pt=2, accent='#7FA6C9'); k2.update(kw)
            im = tile(**k2)
            m = measure(im, disc_size=132, pt=2, k=K)
            print(f"{cname:14} {cap:36} disc median {m['disc_median']:6.1f}  "
                  f"tinted {m['tinted']:5.2f}%")
            row.append(im)
            SILVER['L_swift'] = 0.30
        rows.append((cname, row))

    W = rows[0][1][0].size[0]
    pad, head = 22, 46
    sheet = Image.new('RGB', (W * len(STEPS) + pad * (len(STEPS) + 1),
                              (W + head) * len(rows) + pad * (len(rows) + 1)), (14, 14, 17))
    dd = ImageDraw.Draw(sheet)
    for r, (cname, row) in enumerate(rows):
        y = pad + r * (W + head + pad)
        for i, im in enumerate(row):
            x = pad + i * (W + pad)
            cap = STEPS[i][0] + ('' if r else '')
            dd.text((x, y + 6), cap, fill=(232, 232, 238), font=f)
            dd.text((x, y + 26), cname, fill=(150, 152, 162), font=fs)
            sheet.paste(im, (x, y + head), im)
    out = os.environ.get('OUT', '/tmp/cd_tile.png')
    sheet.save(out)
    print('saved', out)
