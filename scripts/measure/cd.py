# Port of the SHIPPED CompactDisc fans, to check the geometry reads before a
# build cycle is spent on it. SwiftUI semantics reproduced deliberately:
#  - RadialGradient stops interpolate between startRadius and endRadius
#  - AngularGradient location 0 sits at `angle`, sweeping clockwise
#  - .mask uses the mask's alpha; .screen is 1-(1-a)(1-b)
from PIL import Image, ImageDraw
import math, sys

S = 512                     # render scale-up of the real 124pt disc
def hexc(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))

def lerp(a,b,t): return a+(b-a)*t

def sample(stops, t):
    """stops: [(loc,(r,g,b),alpha)] -> premultiplied-ish (r,g,b,a)"""
    if t <= stops[0][0]: return stops[0][1]+(stops[0][2],)
    if t >= stops[-1][0]: return stops[-1][1]+(stops[-1][2],)
    for i in range(len(stops)-1):
        l0,c0,a0 = stops[i]; l1,c1,a1 = stops[i+1]
        if l0 <= t <= l1:
            u = 0 if l1==l0 else (t-l0)/(l1-l0)
            return (lerp(c0[0],c1[0],u), lerp(c0[1],c1[1],u), lerp(c0[2],c1[2],u), lerp(a0,a1,u))
    return stops[-1][1]+(stops[-1][2],)

SPECTRUM = [
    (0.00, (0,0,0), 0.0),
    (0.12, hexc('#5b3bff'), 0.45),
    (0.28, hexc('#2bc0ff'), 1.0),
    (0.43, hexc('#48ffc0'), 1.0),
    (0.58, hexc('#ffe86b'), 1.0),
    (0.72, hexc('#ff8a3c'), 1.0),
    (0.87, hexc('#ff4d8f'), 0.55),
    (1.00, (0,0,0), 0.0),
]

def wedge_stops(spread):
    half = spread/720.0
    return [(0,(255,255,255),0.0),
            (max(0,0.5-half),(255,255,255),0.0),
            (max(0,0.5-half*0.55),(255,255,255),0.35),
            (0.5,(255,255,255),1.0),
            (min(1,0.5+half*0.55),(255,255,255),0.35),
            (min(1,0.5+half),(255,255,255),0.0),
            (1,(255,255,255),0.0)]

METAL = [(0.00,(255,255,255),0.20),(0.17,(255,255,255),0.02),(0.34,(255,255,255),0.26),
         (0.55,(255,255,255),0.04),(0.74,(255,255,255),0.22),(0.88,(255,255,255),0.03),
         (1.00,(255,255,255),0.20)]

FANS = [(34,84,0.95),(214,72,0.78),(128,44,0.34)]

img = Image.new('RGB',(S,S),(10,10,12))
px = img.load()
cx = cy = S/2.0
R = S/2.0
r0, r1 = 0.13*S, 0.52*S     # startRadius/endRadius as fractions of `size`

for y in range(S):
    for x in range(S):
        dx, dy = x-cx, y-cy
        d = math.hypot(dx,dy)
        if d > R-1: continue
        # base: a dark printed face standing in for the cover
        base = [40+int(26*(dx/R+1)/2), 32+int(20*(dy/R+1)/2), 46]
        # SwiftUI angular location 0 at `angle`, clockwise. Screen angle from
        # +x axis; SwiftUI's 0deg is straight UP.
        ang = (math.degrees(math.atan2(dy,dx)) + 90) % 360
        for bearing, spread, strength in FANS:
            loc = ((ang - (bearing-180)) % 360)/360.0
            wr,wg,wb,wa = sample(wedge_stops(spread), loc)
            if wa <= 0.002: continue
            t = (d-r0)/(r1-r0)
            t = min(1.0, max(0.0, t))
            sr,sg,sb,sa = sample(SPECTRUM, t)
            a = wa*sa*strength
            if a <= 0.002: continue
            for i,c in enumerate((sr,sg,sb)):
                src = c*a
                base[i] = 255-(255-base[i])*(255-src)/255.0   # screen
        # neutral metal sheen
        mloc = ((ang - (-30)) % 360)/360.0
        _,_,_,ma = sample(METAL, mloc)
        ma *= 0.55
        for i in range(3):
            src = 255*ma
            base[i] = 255-(255-base[i])*(255-src)/255.0
        px[x,y] = tuple(int(min(255,max(0,v))) for v in base)

d = ImageDraw.Draw(img)
d.ellipse([cx-0.155*S, cy-0.155*S, cx+0.155*S, cy+0.155*S], fill=(18,18,22))
img.save('cd-fans.png')

# ── measurements ────────────────────────────────────────────────────────────
import statistics
def hue_at(x,y):
    r,g,b = px[int(x),int(y)]
    mx,mn = max(r,g,b), min(r,g,b)
    return (mx-mn)/mx if mx else 0, (r,g,b)
print("saturation around the disc, at 0.36R, by bearing:")
for bearing in range(0,360,15):
    a = math.radians(bearing-90)
    x, y = cx+0.36*S*math.cos(a), cy+0.36*S*math.sin(a)
    s_,rgb = hue_at(x,y)
    bar = '#'*int(s_*40)
    print(f"  {bearing:3}deg  sat {s_:.2f} {bar}")

print("\nspectrum along the strong fan (bearing 34), inner -> outer:")
for f in [0.20,0.26,0.32,0.38,0.44,0.50]:
    a = math.radians(34-90)
    x,y = cx+f*S*math.cos(a), cy+f*S*math.sin(a)
    print(f"  r={f:.2f}R  rgb={px[int(x),int(y)]}")
