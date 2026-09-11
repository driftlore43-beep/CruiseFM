// Find text nobody can read.
//
// THE BUG THIS EXISTS FOR: a light theme fails by leaving white type on white
// paper, and it fails SILENTLY — nothing throws, nothing looks broken in a
// diff, and the only way it has been caught so far is the owner noticing on
// her phone (twice on 13.08: the shelf captions, then Rain Drive). So measure
// it: walk every text node, work out what is actually behind it, and report
// anything under the readable threshold.
//
// It reads the COMPOSITED background, not the element's own, because almost
// nothing in this app paints its own — a caption sits on a card sits on a page.
// Walking up until something opaque turns up is the only way to know.
window.__contrast = function (opts) {
  const MIN = (opts && opts.min) || 2.6;

  function parse(c) {
    const m = /^rgba?\(([^)]+)\)$/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(',').map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  /** What is actually behind this element, composited down the ancestor chain. */
  function backdrop(el) {
    const stack = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      // A photograph or a gradient: stop, and say so — a contrast number
      // against an unknown picture would be a guess dressed as a measurement.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 0.995) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    const root = parse(getComputedStyle(document.body).backgroundColor);
    if (root && root.a >= 0.995) base = root;
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  }

  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
    // An icon glyph is a picture, not a word. Test the CODEPOINT, not the
    // font name: the family comes back as 'ionicons' for some and as a plain
    // fallback for others, so a name test silently lets half of them through
    // and the report fills up with sun and rain symbols.
    const cp = text.codePointAt(0);
    const pua = (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd);
    if (text.length <= 2 && pua) continue;
    if (/dseg/i.test(cs.fontFamily)) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg) continue;
    // A photograph laid in as an absolutely-positioned SIBLING is invisible to
    // an ancestor walk — which is every hero in this app, so the probe reads
    // white-on-photo as white-on-paper and reports the loudest headline on the
    // page as unreadable. If anything in the same positioned box is a picture,
    // the real backdrop is unknown and a number here would be a guess.
    let host = el.parentElement;
    while (host && getComputedStyle(host).position === 'static') host = host.parentElement;
    if (host && [...host.querySelectorAll('*')].some((n) => {
      const s2 = getComputedStyle(n);
      return n.tagName === 'IMG' || (s2.backgroundImage && s2.backgroundImage !== 'none');
    })) continue;
    // Inherited opacity from any ancestor dims the text as surely as alpha does.
    let eff = fg.a;
    for (let n = el; n && n !== document.body; n = n.parentElement) eff *= parseFloat(getComputedStyle(n).opacity);
    const c = ratio(over({ ...fg, a: eff }, bg), bg);
    if (c < MIN) out.push({ text: text.slice(0, 44), ratio: +c.toFixed(2), color: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, size: cs.fontSize });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
};
