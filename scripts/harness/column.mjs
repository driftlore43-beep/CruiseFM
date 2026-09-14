// DOES EVERY BLOCK ON A TABLET PAGE SIT IN THE SAME COLUMN?
//
//   npx expo start --web --port 8081
//   BASE_URL=http://localhost:8081 \
//     PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome-linux/chrome \
//     node scripts/harness/column.mjs
//
// WHY: above 700 points the pages stop filling the screen and take a reading
// column instead (PAGE_MAX_W, 10.09), and the floating tab bar is capped to
// match it — that pairing is what makes the layout read as designed rather
// than as a phone stretched. It is also invisible to every check we have: a
// block that sizes itself from the WINDOW rather than from the column still
// fits, still renders, throws nothing, and simply sits off to one side. The
// iPad hero did exactly that (14.09) — an explicit width with no alignment,
// so it landed flush against the column's left edge with all its slack piled
// on the right, 20 points out of step with the heading above it.
//
// THE TEST IS CONCENTRICITY, not width: a block may be narrower than the
// column (a shelf, a strip), but its middle has to be the column's middle.
//
// AND IT CARRIES A CONTROL — a phone, where the column never binds and every
// block runs the full width, plus an assertion that it found blocks at all.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SIZES = {
  'iPad portrait':  { width: 768,  height: 1024 },
  'iPad landscape': { width: 1024, height: 768  },
  'iPhone':         { width: 393,  height: 852  },
};
const TABS = ['Home', 'Stations', 'Modes', 'Profile'];
const TOLERANCE = 2;

const b = await chromium.launch({ args: ['--no-sandbox'],
  executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
let blocksTested = 0;

for (const [label, vp] of Object.entries(SIZES)) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('cruisefm_platform', 'none');
    localStorage.setItem('cruisefm_intro_seen', '1');
    localStorage.setItem('cruise_appearance', 'dark');
    localStorage.setItem('cruisefm_session_kind', 'listening');
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => problems.push(`${label}: page error: ${e.message}`));
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForTimeout(13000);
  const skip = p.locator('text=Skip for now');
  if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2200); }

  for (const tab of TABS) {
    const t = p.locator(`text=${tab.toUpperCase()}`).last();
    if (await t.count()) { await t.click({ force: true }); await p.waitForTimeout(1800); }

    const r = await p.evaluate(() => {
      // The column is the one element carrying the cap. On a phone there is
      // none, and that is the control: every block runs the page's own width.
      const col = [...document.querySelectorAll('div')]
        .filter((e) => getComputedStyle(e).maxWidth === '720px')
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((x) => x.r.width > 200 && x.r.height > 200)
        .pop();
      if (!col) return { none: true };
      const mid = col.r.left + col.r.width / 2;
      const out = [];
      for (const c of col.e.children) {
        const b = c.getBoundingClientRect();
        if (b.width < 80 || b.height < 20) continue;
        const text = (c.innerText || '').trim().split('\n')[0].slice(0, 26);
        out.push({ text, off: Math.round((b.left + b.width / 2) - mid), w: Math.round(b.width) });
      }
      return { mid: Math.round(mid), blocks: out };
    });

    if (r.none) {
      // A phone has no column at all — that is the control, not a failure.
      if (vp.width >= 700) problems.push(`${label} / ${tab}: no reading column found — the page opted out`);
      continue;
    }
    blocksTested += r.blocks.length;
    if (vp.width >= 700 && r.blocks.length === 0) {
      problems.push(`${label} / ${tab}: found no blocks — probe blind`);
    }
    // ONLY ENFORCED ON A TABLET, because only there does the column bind. On
    // a phone the page fills the screen and a few things are deliberately
    // left-aligned under it (the listening/driving switch is a small pill,
    // not a full-width block) — failing those would be measuring a design
    // decision. The phone still runs, as the control that the probe can see
    // blocks at all.
    const off = vp.width >= 700 ? r.blocks.filter((x) => Math.abs(x.off) > TOLERANCE) : [];
    for (const x of off) {
      problems.push(`${label} / ${tab}: "${x.text}" is ${x.off > 0 ? 'right' : 'left'} of centre by ${Math.abs(x.off)}pt (${x.w} wide)`);
    }
    console.log(`  ${label.padEnd(15)} ${tab.padEnd(9)} ${r.blocks.length} block(s), ${off.length} off centre`);
  }
  await ctx.close();
}
await b.close();

if (blocksTested < 12) problems.push(`only ${blocksTested} blocks measured — the probe proved nothing`);
if (problems.length === 0) {
  console.log(`\nevery block sits in the column (${blocksTested} measured)`);
  process.exit(0);
}
console.log(`\n${problems.length} problem(s), ${blocksTested} blocks measured:`);
for (const x of problems) console.log('  ' + x);
process.exit(1);
