// THE MODE SCRIM HAS DRIFTED THREE TIMES, AND EVERY TIME THE SEARCH IS WHAT FAILED.
//
// A mode lays a five-stop near-black gradient over the station photograph so
// the song title and the transport have something to sit on. When those stops
// were eased on 03.08 the note recorded "only Equalizer and Vinyl carry one"
// — wrong, CD had one too, and it stayed at roughly double the other two for
// a week as the darkest screen in the app. `ModeScrim` was created on 10.08 to
// stop exactly that, and it converted THREE modes.
//
// It missed four. Cassette, Tuner, Horizon and CircularWave each kept a private
// copy, and Horizon's top stop was 0.72 against the shared 0.04 for a user's
// own photo — EIGHTEEN times heavier. Found 02.09 chasing a report that a
// bright photo still came out dark.
//
// THE REASON IT KEPT BEING MISSED IS MECHANICAL, NOT CARELESSNESS: every copy
// used a slightly different near-black — rgba(2,2,10), rgba(2,3,14),
// rgba(3,4,16), rgba(2,2,12) — so no grep for a colour literal could ever find
// them all, and each round searched for whatever the last one had used.
//
// So this checks the PROPERTY instead of the string: a mode that draws a
// station backdrop must get its shading from the shared component. The shape
// of an inline scrim is what is matched — five near-black stops across the
// screen — not any particular colour.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user/CruiseFM';
const MODES = `${ROOT}/src/components`;

/**
 * Modes allowed to shade their own backdrop, each with the reason. A mode
 * belongs here only when its treatment genuinely is not a scrim — adding one
 * to silence this check is how the drift happened in the first place.
 */
const ALLOWED = {
  // A mirror ball hangs in a dark room, and the radial wash IS that room —
  // it is centred on the ball rather than shaped for the type at the foot,
  // so the shared top-to-bottom ramp cannot express it. Settled 28.07.
  'DiscoBallMode.tsx': 'radial room wash, centred on the ball, not a foot-weighted scrim',
};

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

/**
 * Every `colors={[...]}` list in a file, as arrays of stops.
 *
 * NAMED COLOURS COUNT, and leaving them out is how the first version of this
 * file shipped a check that could not fire: a vignette is written
 * `['rgba(0,0,0,0.5)', 'transparent']`, and matching only rgba() left it as a
 * one-element list that no rule could ever match. Proven by reintroducing the
 * real vignette and watching the test stay green.
 */
function colorLists(src) {
  const out = [];
  for (const m of src.matchAll(/colors=\{\[(.*?)\]\}/gs)) {
    const stops = [];
    for (const c of m[1].matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)|'(transparent)'/g)) {
      stops.push(c[5]
        ? { r: 0, g: 0, b: 0, a: 0 }
        : { r: +c[1], g: +c[2], b: +c[3], a: +c[4] });
    }
    out.push(stops);
  }
  return out;
}

/** A scrim: several near-black stops, i.e. shading rather than a tint. */
const isScrim = (stops) =>
  stops.length >= 5 && stops.every((s) => s.r + s.g + s.b < 60 && s.a > 0);

/**
 * A top or bottom vignette: black fading to nothing. Cassette carried one of
 * these over its top fifth, and it was the ONLY copy in the app — so the
 * header was readable there and nowhere else, which is exactly how a fault
 * hides. ModeScrim covers that band for every mode now, and a second layer
 * doing the same job just doubles up (Cassette's top would have landed near
 * 0.76). Matched separately because it is only two stops, so the scrim test
 * above cannot see it.
 */
const isVignette = (stops) =>
  stops.length === 2 && stops[0].r + stops[0].g + stops[0].b < 60 &&
  stops[0].a >= 0.2 && stops[1].a === 0;

const files = fs.readdirSync(MODES).filter((f) => /Mode\.tsx$/.test(f));
check('found the mode components', files.length >= 8, `saw ${files.length}`);

for (const f of files.sort()) {
  const src = fs.readFileSync(path.join(MODES, f), 'utf8');
  if (!src.includes('<StationBackdrop')) continue;   // not a station-backed mode

  const lists = colorLists(src);
  const inline = [...lists.filter(isScrim), ...lists.filter(isVignette)];
  if (ALLOWED[f]) {
    check(`${f} is a documented exception`, true, `— ${ALLOWED[f]}`);
    continue;
  }
  check(`${f} uses the shared ModeScrim`, src.includes('<ModeScrim'),
    'draws a station backdrop with no shared scrim over it');
  check(`${f} draws no scrim of its own`, inline.length === 0,
    inline.length
      ? `${inline.length} inline scrim(s), first: ${inline[0].map((s) => s.a).join(' ')} ` +
        '— move it into ModeScrim, or add the mode to ALLOWED with a reason'
      : '');
}

// The shared component is the thing every mode now leans on, so its own shape
// is worth pinning — and the shape is the whole design. A user's own photo
// must be MORE open than a built-in where the picture is, and AT LEAST as
// shaded where the words are. Those pull opposite ways, which is exactly why
// it is worth asserting rather than trusting.
{
  const src = fs.readFileSync(`${MODES}/ModeScrim.tsx`, 'utf8');
  const stops = (name) => {
    const body = src.split(`const ${name} = [`)[1]?.split(']')[0] ?? '';
    return [...body.matchAll(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/g)].map((m) => +m[1]);
  };
  const at = (name) => {
    const body = src.split(`const ${name} = [`)[1]?.split(']')[0] ?? '';
    return [...body.matchAll(/[\d.]+/g)].map((m) => +m[0]);
  };
  const bands = (() => {
    const m = src.match(/TYPE_BANDS = \{([\s\S]*?)\n\} as const;/);
    if (!m) return null;
    const pick = (k) => {
      const r = m[1].match(new RegExp(k + ': \\{ top: ([\\d.]+), bottom: ([\\d.]+)'));
      return r ? { top: +r[1], bottom: +r[2] } : null;
    };
    const out = { header: pick('header'), foot: pick('foot'), picture: pick('picture') };
    return Object.values(out).every(Boolean) ? out : null;
  })();

  const ramps = {
    'built-in':   { a: stops('BUILT_IN'),   y: at('BUILT_IN_AT') },
    'user photo': { a: stops('USER_PHOTO'), y: at('USER_PHOTO_AT') },
  };
  check('both ramps pair every stop with a position',
    Object.values(ramps).every((r) => r.a.length >= 5 && r.a.length === r.y.length),
    JSON.stringify(Object.fromEntries(Object.entries(ramps).map(([k, r]) => [k, [r.a.length, r.y.length]]))));
  check('the type bands are declared', !!bands,
    'TYPE_BANDS missing — the user ramp is shaped around them');

  /** Alpha at a height, the way a linear gradient interpolates it. */
  const alpha = ({ a, y }, h) => {
    if (h <= y[0]) return a[0];
    for (let i = 0; i < y.length - 1; i++) {
      if (h <= y[i + 1]) return a[i] + (a[i + 1] - a[i]) * ((h - y[i]) / (y[i + 1] - y[i]));
    }
    return a.at(-1);
  };
  const span = (r, b, n = 5) =>
    Array.from({ length: n }, (_, i) => alpha(r, b.top + (b.bottom - b.top) * (i / (n - 1))));

  if (bands && Object.values(ramps).every((r) => r.a.length === r.y.length)) {
    const user = ramps['user photo'], built = ramps['built-in'];

    // The floor the whole shape exists to clear. A pure white photograph is
    // the worst picture anyone can supply, and it needs this much behind
    // white type to reach 4.5:1.
    //
    // THIS READ 0.467 FROM 02.09 TO 08.09 AND IT WAS THE WRONG QUANTITY.
    // 4.5:1 against white needs a background at relative luminance 0.1833,
    // i.e. sRGB 0.465 — and that is what got written down as the ALPHA. A
    // scrim of alpha `a` over white leaves 255(1-a) + 5a, so reaching sRGB
    // 0.465 takes a = 0.5405; at 0.467 the real ratio is 3.49:1. The check
    // fired correctly against its threshold for a week and proved nothing,
    // because the threshold was the thing that was wrong. Derived here rather
    // than copied so it can be re-checked instead of trusted.
    const NEEDED = (() => {
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]) =>
        0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
      const over = (a) => [0, 1, 2].map((i) => 255 * (1 - a) + [2, 2, 12][i] * a);
      let lo = 0, hi = 1;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (1.05 / (lum(over(m)) + 0.05) >= 4.5) hi = m; else lo = m;
      }
      return hi;
    })();
    check('the white-type floor is derived, not remembered',
      NEEDED > 0.53 && NEEDED < 0.55, `solved ${NEEDED.toFixed(4)}`);

    // BOTH RAMPS, not just the user's. Leaving the built-in one out is the
    // exact gap that let three stations ship with an unreadable header:
    // Coastal at 2.45:1, Mountain Pass at 2.23:1 and Daylight at 1.39:1,
    // measured on real screenshots. "The built-ins are shot dark" was true of
    // seven of the ten, and this check is what stops that being assumed again.
    for (const [name, r] of Object.entries(ramps)) {
      for (const key of ['header', 'foot']) {
        // The foot on a built-in is deliberately lighter: the type there is
        // the song title, which is large, and the 03.08 values were approved
        // against the real photographs rather than against a white frame.
        if (name === 'built-in' && key === 'foot') continue;
        const worst = Math.min(...span(r, bands[key]));
        check(`${name}: white type is safe across the ${key}`, worst >= NEEDED,
          `thinnest point is ${worst.toFixed(3)}, needs >= ${NEEDED.toFixed(4)}`);
      }
    }

    // …and the openness that shading pays for. This is the whole trade: if the
    // middle is not clearly lighter than the bands, the shape has collapsed
    // back into an even wash over the picture.
    const mid = Math.max(...span(user, bands.picture));
    check('user photo: the picture between the bands stays open', mid <= 0.12,
      `heaviest point in the picture is ${mid.toFixed(3)}`);
    check("user photo: the picture is more open than a built-in's",
      span(user, bands.picture).every((v, i) => v <= span(built, bands.picture)[i]));

    // THE SHAPE, stated as what it is for rather than as where its biggest
    // number sits. This read "heaviest at the foot" until 08.09, which was a
    // fair description while the built-in ramp's top stop was 0.10 — and it
    // would have REFUSED the header band that ramp needed, because a header
    // heavy enough to read on Daylight is heavier than a foot tuned for
    // photographs that are already dark. The property worth holding is that
    // the shading sits where the words are and gets out of the way where the
    // picture is, which is what both ramps are actually built to do.
    for (const [name, r] of Object.entries(ramps)) {
      const open = Math.max(...span(r, bands.picture));
      for (const key of ['header', 'foot']) {
        const band = Math.min(...span(r, bands[key]));
        check(`${name}: the ${key} is shaded more than the picture`, band > open,
          `${key} thinnest ${band.toFixed(3)} vs picture heaviest ${open.toFixed(3)}`);
      }
    }
  }
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  every station-backed mode takes its shading from one place\n');
process.exit(fails ? 1 : 0);
