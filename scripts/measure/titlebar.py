# Python port of the SHIPPED titleBarRGB / titleBarInk, so the bar's readability
# is measured rather than assumed.
def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))

def lin(x):
    return x/12.92 if x <= 0.03928 else ((x+0.055)/1.055)**2.4

def lum(c):
    return 0.2126*lin(c[0]) + 0.7152*lin(c[1]) + 0.0722*lin(c[2])

DARK = (0.051, 0.059, 0.078)
DARK_L = lum(DARK)

def ramp(hexs):
    r, g, b = rgb(hexs)
    scaled = lambda f: (r*f, g*f, b*f)
    lifted = lambda t: (r+(1-r)*t, g+(1-g)*t, b+(1-b)*t)
    return [scaled(0.82), scaled(0.94), lifted(0.12)]

def hue_sat(c):
    mx, mn = max(c), min(c)
    ch = mx - mn
    if ch == 0: return (0.0, 0.0)
    if mx == c[0]:   h = ((c[1]-c[2])/ch) % 6
    elif mx == c[1]: h = (c[2]-c[0])/ch + 2
    else:            h = (c[0]-c[1])/ch + 4
    return (h*60, ch/mx)

BUILTIN = ['#19C6D4','#FFE070','#F0B048','#F2F6FF','#FF1111','#FF6F5A',
           '#F0A050','#FF8A2A','#9B5CFF','#FBA518']
CUSTOM = ['#2A2E3D','#7B38E0','#1a6bb5','#1D9E75','#F59E0B','#e05578','#6b7a99',
          '#c0392b','#27ae60','#FF7A3C','#FF4FA3','#33C5FF','#D4AF37','#A78BFA',
          '#FF6F61','#4ADE80','#9AD6FF','#EFE8DC','#6B4A38','#C08B5C','#B87333',
          '#8A9A5B','#A8BFA0','#8E4B6E','#35508F']

worst = 99
print(f"{'accent':9} {'hue':>5} {'sat':>5} | {'mid hue':>7} {'mid sat':>7} | ink    ratio  monotonic")
for h in BUILTIN + CUSTOM:
    st = ramp(h)
    L = [lum(s) for s in st]
    midL = L[1]
    on_white = 1.05/(midL+0.05)
    on_dark = (midL+0.05)/(DARK_L+0.05)
    ink, ratio = ('dark', on_dark) if on_dark > on_white else ('white', on_white)
    ah, asat = hue_sat(rgb(h))
    mh, msat = hue_sat(st[1])
    mono = L[0] < L[1] < L[2]
    worst = min(worst, ratio)
    print(f"{h:9} {ah:5.0f} {asat:5.2f} | {mh:7.0f} {msat:7.2f} | {ink:5} {ratio:6.2f}  {'ok' if mono else 'NOT ONE-WAY'}")
print(f"\nworst contrast across all 35: {worst:.2f}:1  (bar for large bold text is 3.0)")
