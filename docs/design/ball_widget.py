"""
Comparison sheet: the widget's mirror ball as it ships in build 47, against
the APP'S OWN mirror ball recipe (MirrorBallFlipbook.tsx), ported to a single
static frame. Written 2026-09-10 because the owner reported the widget ball
"still looks flat" and its glints "don't add any nice feature" — this is the
same instrument used for the diffraction fans: draw it and measure it before
writing a line of Swift, because Swift cannot be compiled here.

WHY A SINGLE FRAME IS THE RIGHT TARGET, not a port of the six-frame loop: a
WidgetKit tile is static — nothing on it can breathe or turn, ever, on any
app. So the honest comparison is not "the ball as it spins" but "the ball as
it sits", i.e. what the app's ball looks like PAUSED. Paused, the app's ball
still shows its chrome material and its fixed lamps; only the flashing-mirror
overlay and the room lights stop. That material-plus-lamps layer is exactly
what MirrorBallFlipbook.tsx computes per tile before any animation — so this
ports THAT, once, with no frame loop at all.

RUN: python3 docs/design/ball_widget.py
"""
import math, random
from PIL import Image, ImageDraw

SIZE = 720          # render scale — the real widget draws this at 126pt
EQ = ('#6E8CFF', '#9B5CFF', '#E24CFF')   # the station in her screenshot

def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def mixhex(a, b, t):
    ar, ag, ab = hexc(a); br, bg, bb = hexc(b)
    return (round(ar + (br-ar)*t), round(ag + (bg-ag)*t), round(ab + (bb-ab)*t))

def mix(c1, c2, t):
    return tuple(round(c1[i] + (c2[i]-c1[i])*t) for i in range(3))

def norm(v):
    m = math.sqrt(sum(c*c for c in v)) or 1.0
    return tuple(c/m for c in v)

# ── A: the widget as it ships in build 47 ────────────────────────────────
def widget_current(rows=17, cols=30, tilt=-0.16, shrink=0.955):
    lamps = [norm((-0.58,-0.55,0.60)), norm((0.66,-0.10,0.74)), norm((0.06,0.62,0.78))]
    lamp_colors = [(255,145,200), (185,140,255), (150,215,255)]
    seed = [11]
    def rnd():
        seed[0] = (seed[0]*1103515245 + 12345) & 0x7fffffff
        return (seed[0] % 1000) / 1000.0 - 0.5
    R = SIZE/2
    tiles = []
    brights = []
    for i in range(rows):
        la0 = math.pi*(i/rows) - math.pi/2
        la1 = math.pi*((i+1)/rows) - math.pi/2
        bond = 0.5 if i % 2 else 0.0
        for j in range(cols):
            lo0 = 2*math.pi*((j+bond)/cols)
            lo1 = 2*math.pi*((j+1+bond)/cols)
            pts, ax, ay, az, ok = [], 0.0, 0.0, 0.0, True
            for la, lo in ((la0,lo0),(la0,lo1),(la1,lo1),(la1,lo0)):
                x = math.cos(la)*math.sin(lo); y = math.sin(la); z = math.cos(la)*math.cos(lo)
                yt = y*math.cos(tilt) - z*math.sin(tilt)
                zt = y*math.sin(tilt) + z*math.cos(tilt)
                if zt < 0.03: ok = False; break
                pts.append((x,yt)); ax += x; ay += yt; az += zt
            if not ok: continue
            mx = sum(p[0] for p in pts)/4; my = sum(p[1] for p in pts)/4
            quad = [(R + (mx+(px-mx)*shrink)*R, R - (my+(py-my)*shrink)*R) for px,py in pts]
            n = norm((ax/4, ay/4, az/4))
            ndv = n[2]
            r = norm((2*ndv*n[0], 2*ndv*n[1], 2*ndv*n[2]-1))
            b = 0.13; w = []; cw = []
            for L in lamps:
                d = max(0, r[0]*L[0]+r[1]*L[1]+r[2]*L[2])
                lw = d**5.4; w.append(lw); cw.append(d**3); b += 1.15*lw
            b += rnd()*0.28
            b = min(1, max(0.05, b))
            v = 0.10 + 0.90*(b**0.72)
            cwsum = sum(cw)
            tint = tuple(round(255*v) for _ in range(3))
            if cwsum > 0.002:
                g = 255.0*v
                cr = sum(wt*lc[0] for wt,lc in zip(cw,lamp_colors))/cwsum
                cg = sum(wt*lc[1] for wt,lc in zip(cw,lamp_colors))/cwsum
                cb = sum(wt*lc[2] for wt,lc in zip(cw,lamp_colors))/cwsum
                k = min(1.0, cwsum*1.4)*0.78
                tint = (round(min(255,max(0,g*(1-k)+cr*k))),
                        round(min(255,max(0,g*(1-k)+cg*k))),
                        round(min(255,max(0,g*(1-k)+cb*k))))
            cx = sum(p[0] for p in quad)/4; cy = sum(p[1] for p in quad)/4
            tiles.append((quad, tint, v))
            brights.append((v, (cx,cy)))
    brights.sort(key=lambda x:-x[0])
    return tiles, [p for _,p in brights[:5]]

def render_current():
    img = Image.new('RGB', (int(SIZE),int(SIZE)), (5,3,8))
    d = ImageDraw.Draw(img, 'RGBA')
    cx = cy = SIZE/2
    # halo (approx)
    for rr in range(int(SIZE*0.7),0,-4):
        t = rr/(SIZE*0.7)
        col = mix((5,3,8), mix((74,49,96),(36,26,43), min(1,t*1.4)), 1-t)
        d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr], fill=col+(255,))
    tiles, glints = widget_current()
    # ball body
    d.ellipse([cx-SIZE*0.31,cy-SIZE*0.31,cx+SIZE*0.31,cy+SIZE*0.31], fill=(21,15,28,255))
    for quad, tint, v in tiles:
        q = [(cx-SIZE/2+x, cy-SIZE/2+y) for x,y in quad]
        d.polygon(q, fill=tint+(255,))
    for gx, gy in glints:
        px, py = cx-SIZE/2+gx, cy-SIZE/2+gy
        for rr in range(9,0,-1):
            a = int(255*(1-rr/9)*0.9)
            d.ellipse([px-rr,py-rr,px+rr,py+rr], outline=(255,255,255,a))
    return img

# ── B: the APP'S OWN chrome recipe, single static frame ──────────────────
# Ported from MirrorBallFlipbook.tsx's per-tile shading — lattice value noise,
# a wide brightness lobe kept apart from a narrow colour lobe, a near-white
# key lamp, brightness scatter pushed to the ENDS of its range.

def hash01(n):
    x = math.sin(n*12.9898)*43758.5453
    return x - math.floor(x)

def lattice(i,j,k):
    return hash01(i*127.1 + j*311.7 + k*74.7)

def smoothstep(t):
    return t*t*(3-2*t)

def env_noise(x,y,z,scale):
    X,Y,Z = x*scale, y*scale, z*scale
    i,j,k = math.floor(X), math.floor(Y), math.floor(Z)
    fx,fy,fz = smoothstep(X-i), smoothstep(Y-j), smoothstep(Z-k)
    acc = 0.0
    for dz in (0,1):
        for dy in (0,1):
            for dx in (0,1):
                w = (fx if dx else 1-fx)*(fy if dy else 1-fy)*(fz if dz else 1-fz)
                acc += w*lattice(i+dx,j+dy,k+dz)
    return acc

SHADE_ANCHORS = ['#0a0a0b','#191a1b','#343537','#646568','#a2a3a5','#dcdcde','#ffffff']
def shade_at(t):
    x = max(0,min(1,t))*(len(SHADE_ANCHORS)-1)
    i = min(len(SHADE_ANCHORS)-2, int(x))
    return mixhex(SHADE_ANCHORS[i], SHADE_ANCHORS[i+1], x-i)   # -> RGB tuple

def station_palette(eq):
    out = []
    for c in eq:
        out.append(hexc(c))
        out.append(mixhex(c,'#ffffff',0.28))
        out.append(mixhex(c,'#161617',0.42))
    return out

LAMPS_APP = [
    {'d': norm((-0.52,0.62,0.59)), 'power':1.00, 'sat':0.06},
    {'d': norm((0.66,0.28,0.70)),  'power':0.72, 'sat':0.52},
    {'d': norm((-0.18,-0.55,0.81)),'power':0.58, 'sat':0.40},
]

def app_recipe(rows=17, cols=30, tilt=-0.16, shrink=0.955, glints=True, noise_scale=3.1):
    R = SIZE/2
    palette = station_palette(EQ)
    tiles = []
    brights = []
    for i in range(rows):
        la0 = math.pi*(i/rows) - math.pi/2
        la1 = math.pi*((i+1)/rows) - math.pi/2
        bond = 0.5 if i % 2 else 0.0
        for j in range(cols):
            lo0 = 2*math.pi*((j+bond)/cols)
            lo1 = 2*math.pi*((j+1+bond)/cols)
            pts, ax, ay, az, ok = [], 0.0, 0.0, 0.0, True
            for la, lo in ((la0,lo0),(la0,lo1),(la1,lo1),(la1,lo0)):
                x = math.cos(la)*math.sin(lo); y = math.sin(la); z = math.cos(la)*math.cos(lo)
                yt = y*math.cos(tilt) - z*math.sin(tilt)
                zt = y*math.sin(tilt) + z*math.cos(tilt)
                if zt < 0.03: ok = False; break
                pts.append((x,yt)); ax += x; ay += yt; az += zt
            if not ok: continue
            mx = sum(p[0] for p in pts)/4; my = sum(p[1] for p in pts)/4
            quad = [(R + (mx+(px-mx)*shrink)*R, R - (my+(py-my)*shrink)*R) for px,py in pts]
            n = norm((ax/4, ay/4, az/4))
            ndv = n[2]
            r = norm((2*ndv*n[0], 2*ndv*n[1], 2*ndv*n[2]-1))
            env = env_noise(r[0],r[1],r[2], noise_scale)
            flare = 0.0; cLobe = 0.0; flare_hue = 0; flare_sat = 0.0
            for idx, L in enumerate(LAMPS_APP):
                dot = r[0]*L['d'][0] + r[1]*L['d'][1] + r[2]*L['d'][2]
                if dot <= 0: continue
                wide = (dot**10)*L['power']
                if wide > flare: flare = wide
                narrow = (dot**28)*L['power']
                if narrow > cLobe: cLobe = narrow; flare_hue = idx; flare_sat = L['sat']
            key = LAMPS_APP[0]['d']
            lambert = max(0, n[0]*key[0]+n[1]*key[1]+n[2]*key[2])
            depth = min(1, n[2]*1.35)
            spread = math.copysign((abs(env-0.5)*2)**0.68, env-0.5) * 0.5
            t = max(0, min(1, 0.34 + lambert*0.22 + spread*0.80 + flare*1.20))
            hue = palette[(flare_hue*3 + int(env*len(palette))) % len(palette)]
            lifted = mix(hue, (255,255,255), 0.30)
            cast = min(0.72, cLobe*flare_sat*2.4) if cLobe > 0.06 else 0.0
            base = min(1, t + cast*0.42) if cast > 0 else t
            fill = mix(shade_at(base), lifted, cast) if cast > 0 else shade_at(t)
            op = min(1, (0.56+0.50*t)*(0.82+0.18*depth))
            cx_ = sum(p[0] for p in quad)/4; cy_ = sum(p[1] for p in quad)/4
            tiles.append((quad, fill, op, t))
            brights.append((t, (cx_,cy_)))
    brights.sort(key=lambda x:-x[0])
    return tiles, [p for _,p in brights[:3]] if glints else []

def render_app(glints=True, label_body=(21,15,28)):
    img = Image.new('RGB', (int(SIZE),int(SIZE)), (5,3,8))
    d = ImageDraw.Draw(img, 'RGBA')
    cx = cy = SIZE/2
    for rr in range(int(SIZE*0.7),0,-4):
        t = rr/(SIZE*0.7)
        col = mix((5,3,8), mix((74,49,96),(36,26,43), min(1,t*1.4)), 1-t)
        d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr], fill=col+(255,))
    tiles, hot = app_recipe(glints=glints)
    d.ellipse([cx-SIZE*0.31,cy-SIZE*0.31,cx+SIZE*0.31,cy+SIZE*0.31], fill=label_body+(255,))
    for quad, fill, op, t in tiles:
        q = [(cx-SIZE/2+x, cy-SIZE/2+y) for x,y in quad]
        blended = mix(label_body, fill, op)
        d.polygon(q, fill=blended+(255,))
    if glints:
        for gx, gy in hot:
            px, py = cx-SIZE/2+gx, cy-SIZE/2+gy
            for rr in range(7,0,-1):
                a = int(255*(1-rr/7)*0.55)
                d.ellipse([px-rr,py-rr,px+rr,py+rr], fill=(255,255,255,a))
    return img

# ── measurements ────────────────────────────────────────────────────────
def measure(tiles_fn, name):
    tiles = tiles_fn()[0]
    vals = [t[-1] if len(t)==4 else t[-1] for t in tiles]
    med = sorted(vals)[len(vals)//2]
    above = sum(1 for v in vals if v > 0.78)/len(vals)*100
    below = sum(1 for v in vals if v < 0.22)/len(vals)*100
    print(f"{name:32} n={len(vals):4}  median={med:.2f}  bright(>0.78)={above:5.1f}%  dark(<0.22)={below:5.1f}%")

if __name__ == '__main__':
    measure(lambda: (widget_current()[0], None), "A current widget")
    # widget_current returns v not t at index 2; normalize measurement separately below
    def cur_vals():
        tiles,_ = widget_current()
        return [(None,None,None,t[2]) for t in tiles], None
    measure(lambda: cur_vals(), "A current widget (v)")
    measure(app_recipe, "B app recipe")
    measure(lambda: app_recipe(glints=False), "C app recipe, no glints")

    sheet = Image.new('RGB', (SIZE*3 + 80, SIZE + 140), (14,14,17))
    a = render_current(); b = render_app(glints=True); c = render_app(glints=False)
    for i, (im, cap) in enumerate([(a,"A  current widget"), (b,"B  app recipe + glints"), (c,"C  app recipe, no glints")]):
        x = 20 + i*(SIZE+20)
        sheet.paste(im, (x, 80))
        d = ImageDraw.Draw(sheet)
        d.text((x, 30), cap, fill=(230,230,235))
    sheet.save('/tmp/ball_widget_compare.png')
    print("saved /tmp/ball_widget_compare.png")
