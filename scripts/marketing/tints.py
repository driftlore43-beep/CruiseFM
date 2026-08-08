"""Sample each screenshot's own lit colour, so the slide's surround belongs to
the picture instead of being one brand slab repeated ten times."""
from PIL import Image
import colorsys, glob, os, json

SHOTS = 'screenshots-appstore'
out = {}
for p in sorted(glob.glob(f'{SHOTS}/*.jpg')):
    im = Image.open(p).convert('RGB').resize((160, 346))
    wr = wg = wb = wt = 0.0
    for r, g, b in im.getdata():
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        # Weight toward pixels that are both lit and coloured: the mood lives
        # in the glow, not in the near-black backdrop or the white type.
        w = s * (l ** 0.8) * (1 - max(0, l - 0.72) * 3)
        if w <= 0:
            continue
        wr += r * w; wg += g * w; wb += b * w; wt += w
    if wt == 0:
        out[os.path.basename(p)[:-4]] = '#3a3a48'
        continue
    r, g, b = wr / wt, wg / wt, wb / wt
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    # Land every tint in the same lightness/saturation band or the ten slides
    # read as ten different products.
    l = 0.30
    s = min(0.55, max(0.30, s))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    out[os.path.basename(p)[:-4]] = '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))

print(json.dumps(out, indent=2))
