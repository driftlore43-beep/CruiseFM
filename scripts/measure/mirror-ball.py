import math

ROWS, COLS = 17, 30
TILT = -0.16

LAMPS_RAW = [(-0.58,-0.55,0.60), (0.66,-0.10,0.74), (0.06,0.62,0.78)]
def norm(v):
    m = math.sqrt(v[0]**2+v[1]**2+v[2]**2)
    return v if m == 0 else (v[0]/m, v[1]/m, v[2]/m)
LAMPS = [norm(l) for l in LAMPS_RAW]

def build(ambient, lamp_pow, color_pow, noise_amp, lamp_gain, vignette_lo, vignette_hi, vignette_pow, use_vignette):
    seed = [11]
    def rnd():
        seed[0] = (seed[0]*1103515245+12345) & 0x7fffffff
        return (seed[0] % 1000)/1000.0 - 0.5
    out = []
    for i in range(ROWS):
        la0 = math.pi*(i/ROWS) - math.pi/2
        la1 = math.pi*((i+1)/ROWS) - math.pi/2
        bond = 0.0 if i % 2 == 0 else 0.5
        for j in range(COLS):
            lo0 = 2*math.pi*((j+bond)/COLS)
            lo1 = 2*math.pi*((j+1+bond)/COLS)
            pts = []
            ax=ay=az=0.0
            visible = True
            for la,lo in [(la0,lo0),(la0,lo1),(la1,lo1),(la1,lo0)]:
                x = math.cos(la)*math.sin(lo); y = math.sin(la); z = math.cos(la)*math.cos(lo)
                yt = y*math.cos(TILT) - z*math.sin(TILT)
                zt = y*math.sin(TILT) + z*math.cos(TILT)
                if zt < 0.03:
                    visible = False; break
                pts.append((x,yt)); ax+=x; ay+=yt; az+=zt
            if not visible or len(pts) != 4: continue
            mx = sum(p[0] for p in pts)/4; my = sum(p[1] for p in pts)/4
            n = norm((ax/4, ay/4, az/4))
            ndv = n[2]
            refl = norm((2*ndv*n[0], 2*ndv*n[1], 2*ndv*n[2]-1))
            b = ambient
            cw_sum = 0.0
            w = []
            for L in LAMPS:
                d = max(0, refl[0]*L[0]+refl[1]*L[1]+refl[2]*L[2])
                lw = d**lamp_pow
                cwv = d**color_pow
                w.append((lw,cwv))
                b += lamp_gain*lw
                cw_sum += cwv
            b += rnd()*noise_amp
            if use_vignette:
                dist = min(1.0, math.sqrt(mx*mx+my*my)/0.94)
                vig = vignette_lo + (vignette_hi-vignette_lo)*((1-dist)**vignette_pow)
                b *= vig
            b = min(1, max(0.05, b))
            v = 0.10 + 0.90*(b**0.72)
            out.append({'v': v, 'cw_sum': cw_sum, 'w': w})
    return out

def stats(tiles):
    vs = sorted(t['v']*255 for t in tiles)
    n = len(vs)
    median = vs[n//2]
    above200 = sum(1 for x in vs if x > 200) / n * 100
    tinted = sum(1 for t in tiles if t['cw_sum'] > 0.06) / n * 100
    almost_white = sum(1 for x in vs if x > 245) / n * 100
    return n, median, above200, tinted, almost_white

print("=== BEFORE (current shipped code) ===")
before = build(ambient=0.23, lamp_pow=6, color_pow=6, noise_amp=0.36, lamp_gain=0.86,
               vignette_lo=1, vignette_hi=1, vignette_pow=1, use_vignette=False)
n,med,a200,tint,white = stats(before)
print(f"tiles={n} median={med:.1f} >200={a200:.1f}% tinted={tint:.1f}% >245(near-white)={white:.1f}%")

print("=== AFTER (vignette + softer colour lobe + lower ambient) ===")
after = build(ambient=0.15, lamp_pow=6, color_pow=3, noise_amp=0.34, lamp_gain=0.92,
              vignette_lo=0.42, vignette_hi=1.12, vignette_pow=1.5, use_vignette=True)
n,med,a200,tint,white = stats(after)
print(f"tiles={n} median={med:.1f} >200={a200:.1f}% tinted={tint:.1f}% >245(near-white)={white:.1f}%")

# outer vs inner split, AFTER only — does the vignette genuinely separate them?
def outer_inner_split(ambient, lamp_pow, color_pow, noise_amp, lamp_gain, vignette_lo, vignette_hi, vignette_pow):
    seed = [11]
    def rnd():
        seed[0] = (seed[0]*1103515245+12345) & 0x7fffffff
        return (seed[0] % 1000)/1000.0 - 0.5
    inner_v = []; outer_v = []
    for i in range(ROWS):
        la0 = math.pi*(i/ROWS) - math.pi/2
        la1 = math.pi*((i+1)/ROWS) - math.pi/2
        bond = 0.0 if i % 2 == 0 else 0.5
        for j in range(COLS):
            lo0 = 2*math.pi*((j+bond)/COLS)
            lo1 = 2*math.pi*((j+1+bond)/COLS)
            pts = []; ax=ay=az=0.0; visible=True
            for la,lo in [(la0,lo0),(la0,lo1),(la1,lo1),(la1,lo0)]:
                x = math.cos(la)*math.sin(lo); y = math.sin(la); z = math.cos(la)*math.cos(lo)
                yt = y*math.cos(TILT) - z*math.sin(TILT)
                zt = y*math.sin(TILT) + z*math.cos(TILT)
                if zt < 0.03: visible=False; break
                pts.append((x,yt)); ax+=x; ay+=yt; az+=zt
            if not visible or len(pts)!=4: continue
            mx = sum(p[0] for p in pts)/4; my = sum(p[1] for p in pts)/4
            n = norm((ax/4, ay/4, az/4)); ndv = n[2]
            refl = norm((2*ndv*n[0], 2*ndv*n[1], 2*ndv*n[2]-1))
            b = ambient
            for L in LAMPS:
                d = max(0, refl[0]*L[0]+refl[1]*L[1]+refl[2]*L[2])
                b += lamp_gain*(d**lamp_pow)
            b += rnd()*noise_amp
            dist = min(1.0, math.sqrt(mx*mx+my*my)/0.94)
            vig = vignette_lo + (vignette_hi-vignette_lo)*((1-dist)**vignette_pow)
            b *= vig
            b = min(1, max(0.05, b))
            v = (0.10 + 0.90*(b**0.72))*255
            (inner_v if dist < 0.35 else outer_v).append(v)
    return inner_v, outer_v

inner, outer = outer_inner_split(0.15, 6, 3, 0.34, 0.92, 0.42, 1.12, 1.5)
print(f"\ninner-third (dist<0.35): n={len(inner)} median={sorted(inner)[len(inner)//2]:.1f}")
print(f"outer band  (dist>=0.35): n={len(outer)} median={sorted(outer)[len(outer)//2]:.1f}")

print("\n=== AFTER v2 (no vignette — reflection-driven contrast only, per the file's own no-positional-gradient rule) ===")
after2 = build(ambient=0.14, lamp_pow=6, color_pow=3, noise_amp=0.30, lamp_gain=1.05,
               vignette_lo=1, vignette_hi=1, vignette_pow=1, use_vignette=False)
n,med,a200,tint,white = stats(after2)
print(f"tiles={n} median={med:.1f} >200={a200:.1f}% tinted={tint:.1f}% >245(near-white)={white:.1f}%")

print("\n=== AFTER v3 (a touch more headroom for the peak, still no vignette) ===")
after3 = build(ambient=0.13, lamp_pow=5.4, color_pow=3, noise_amp=0.28, lamp_gain=1.15,
               vignette_lo=1, vignette_hi=1, vignette_pow=1, use_vignette=False)
n,med,a200,tint,white = stats(after3)
print(f"tiles={n} median={med:.1f} >200={a200:.1f}% tinted={tint:.1f}% >245(near-white)={white:.1f}%")
