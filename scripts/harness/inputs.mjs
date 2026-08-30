// Every text field in the app, against the two things that go wrong with them.
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/inputs.mjs
//
// (1) CAN YOU STILL SEE IT WITH THE KEYBOARD UP? There is no soft keyboard in
//     a browser, but to layout a keyboard is only "the usable height shrinks",
//     so the window is cut to what an iPhone leaves above one. That is a fair
//     model of `KeyboardAvoidingView behavior="padding"`, which pads the
//     container rather than moving the window.
//
//     It found a real one on 19.08 (owner: "when I typed the bar goes missing
//     and it becomes hard to see what I'm typing"). The create-station sheet
//     capped its height against the FULL screen, so with the keyboard up it
//     was taller than the space left — and because the backdrop is
//     bottom-aligned, the overflow went off the TOP. Measured: the name field
//     at top -142, entirely off screen. The fix is flexShrink on the sheet.
//
//     BUT KNOW WHAT THIS CANNOT SEE. The same report came back on 1.3.1 with
//     the fix shipped, and this file passed both before and after the real
//     cause was found — the ScrollView INSIDE the sheet had no style, so in
//     React Native it takes its content height and refuses to shrink, and
//     that height became a floor the sheet could not go under. Two reasons
//     the browser misses it: `KeyboardAvoidingView` here is `Platform.OS ===
//     'ios' ? 'padding' : undefined`, so on web it is inert, and react-native
//     -web resolves flex through CSS, where a scroller shrinks without being
//     told to. So a pass here is evidence about CONTRAST and about gross
//     layout, and NOT proof that a sheet survives a real keyboard. Check that
//     on a phone.
//
// (2) CAN YOU READ WHAT YOU TYPED, in both themes? A hardcoded white on a
//     themed page is invisible on paper and throws nothing — the same silent
//     failure the contrast sweep exists for. Placeholders count: they are the
//     text you see before you have typed anything.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
import { answerOffAir } from './visible.mjs';

/** What an iPhone 14 leaves above the keyboard: 852 - 336. */
const SQUEEZED_H = 516;

const SURFACES = [
  {
    name: 'create station',
    open: async (p) => {
      await p.getByText('STATIONS', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2400);
      await p.getByText('Create', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2400);
    },
  },
  {
    name: 'display name',
    open: async (p) => {
      await p.getByText('PROFILE', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2000);
      const row = p.getByText('Account Settings', { exact: true }).first();
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await row.click({ force: true, timeout: 15000 });
      await p.waitForTimeout(2400);
    },
  },
  {
    name: 'playlist paste box',
    open: async (p) => {
      await p.getByText('STATIONS', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2400);
      await p.getByText('Night Run AM', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2400);
      await p.getByText('Add your playlist', { exact: true }).last().click({ force: true });
      await p.waitForTimeout(2400);
      await answerOffAir(p, 'Play anyway').catch(() => {});
    },
  },
];

const read = (p) => p.evaluate(() => {
  const lum = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  };
  const rel = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => ({
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)), a: 1,
  });
  // REACHABLE ONLY. Expo Router keeps every tab mounted and the sheets park
  // rather than unmount, so the document holds fields belonging to screens
  // you are not on — the first run reported SIX fields on a page that has
  // one, and failed on them. A parked field renders under a
  // `pointer-events: none` ancestor, exactly like the parked mode chips.
  const reachable = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.pointerEvents === 'none' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (parseFloat(cs.opacity || '1') < 0.05) return false;
    }
    return true;
  };
  // TEXT FIELDS ONLY. React Native Web renders a <Switch> as an
  // <input type="checkbox">, and the Profile page's five toggles stay mounted
  // behind the settings page — so the first runs reported SIX fields on a page
  // that has one, and failed on the contrast of a checkbox, which has no text
  // to read. This file's whole claim is about things you type into.
  const TEXTY = new Set(['', 'text', 'search', 'url', 'email', 'password', 'tel', 'number']);
  const out = [];
  for (const i of document.querySelectorAll('input, textarea')) {
    if (i.tagName === 'INPUT' && !TEXTY.has((i.getAttribute('type') || '').toLowerCase())) continue;
    const r = i.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (!reachable(i)) continue;
    const cs = getComputedStyle(i);
    // Composite the real ground behind it.
    let n = i, bg = null;
    while (n && !bg) {
      const c = lum(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) bg = c;
      n = n.parentElement;
    }
    const fg = lum(cs.color);
    let ratio = null;
    if (fg && bg) {
      const f = rel(over(fg, bg)), b = rel(bg);
      ratio = Math.round(((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)) * 100) / 100;
    }
    // TWO DIFFERENT THINGS, AND ONLY ONE IS A BUG.
    //
    // The 19.08 fault this file exists for pushed the name field to top
    // -142: the sheet overflowed UPWARD out of its bottom-anchored backdrop,
    // so the field was gone and no amount of scrolling brought it back.
    // A field merely BELOW the fold inside a scroller that can still scroll
    // is the ordinary shape of a long form — you scroll to it, and iOS
    // scrolls a focused input into view by itself.
    //
    // Conflating them cost a round on 25.08, when a third (optional) field
    // was added to the create sheet and this reported a failure on a sheet
    // that was working correctly. `aboveFold` stays a hard failure;
    // `belowFold` is reported and forgiven, but ONLY when something above it
    // genuinely has room left to scroll — if nothing can scroll, being below
    // the fold means gone, and that is a failure again.
    let canScroll = false;
    for (let n = i.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 4 && n.clientHeight > 50) { canScroll = true; break; }
    }
    out.push({
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      onScreen: r.top >= 0 && r.bottom <= window.innerHeight,
      aboveFold: r.top < 0,
      belowFold: r.bottom > window.innerHeight,
      canScroll,
      colour: cs.color, ratio,
    });
  }
  return out;
});

const b = await chromium.launch({ args: ['--no-sandbox'] });
const problems = [];
for (const theme of ['dark', 'light']) {
  for (const s of SURFACES) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
    await ctx.addInitScript(([t]) => {
      localStorage.setItem('cruisefm_platform', 'none');
      // Past the one-off "what is this app" sheet, the same way this seeds
      // past the platform sheet above. scripts/harness/intro.mjs owns that
      // sheet; every other harness would otherwise run with a Modal over
      // the app, which is how a harness passes while testing nothing.
      localStorage.setItem('cruisefm_intro_seen', '1');
      localStorage.setItem('cruise_appearance', t);
    }, [theme]);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await p.waitForTimeout(15000);
      const skip = p.locator('text=Skip for now');
      if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }
      await s.open(p);

      const full = await read(p);
      if (!full.length) { problems.push(`${theme}/${s.name}: no field found — the walk did not reach it`); await ctx.close(); continue; }
      await p.setViewportSize({ width: 393, height: SQUEEZED_H });
      await p.waitForTimeout(1500);
      const tight = await read(p);

      // Gone (off the top, or below with nothing able to scroll) vs merely
      // further down a form that scrolls — see the note in `read`.
      const lost = tight.filter((f) => f.aboveFold || (f.belowFold && !f.canScroll)).length;
      const scrollTo = tight.filter((f) => f.belowFold && f.canScroll).length;
      const faint = full.filter((f) => f.ratio != null && f.ratio < 3).length;
      const ok = lost === 0 && faint === 0 && tight.length === full.length;
      const note = scrollTo ? `  (${scrollTo} below the fold, scrollable)` : '';
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${s.name.padEnd(19)} ${full.length} field(s)  unreachable when squeezed ${lost}  low-contrast ${faint}${note}`);
      for (const f of full) console.log(`        colour ${f.colour}  contrast ${f.ratio ?? 'n/a'}`);
      if (!ok) problems.push(`${theme}/${s.name}: ${lost} unreachable, ${faint} unreadable`);
      if (errs.length) problems.push(`${theme}/${s.name}: ${errs[0]}`);
    } catch (e) {
      problems.push(`${theme}/${s.name}: ${String(e).slice(0, 110)}`);
      console.log(`FAIL ${theme.padEnd(5)} ${s.name.padEnd(19)} ${String(e).slice(0, 60)}`);
    }
    await ctx.close();
  }
}
await b.close();
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map((x) => '  ' + x).join('\n')
  : '\nevery field stays on screen with the keyboard up, and reads in both themes');
process.exit(problems.length ? 1 : 0);
