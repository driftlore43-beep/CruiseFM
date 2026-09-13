// CAN YOU REACH — AND STILL TOUCH — THE BOTTOM OF EVERY TAB?
//
//   npx expo start --web --port 8081
//   BASE_URL=http://localhost:8081 \
//     PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome \
//     node scripts/harness/tab-bottom.mjs
//
// WHY THIS EXISTS: the owner, on an iPad — "the freeze needs to be fixed still
// when i scroll the tab to the bottom to reach other functions." A page that
// scrolls but whose last rows cannot be TOUCHED is indistinguishable from a
// frozen app, and this repo has shipped that exact shape four times: a
// transparent Modal left over a page (03.08), an auto-dim catch layer that
// presented invisibly (03.08), a sheet parked below the screen with a live
// backdrop over the app (03.08), and a station hero painting above the sheet
// covering it (11.08). Every one of them looks like "the app stopped
// responding" and none of them throws anything.
//
// SO THE TEST IS REACHABILITY, NOT PRESENCE. `elementFromPoint` at a row's own
// centre must land INSIDE that row. Anything else is something covering it,
// and the probe names what.
//
// AND IT CARRIES ITS OWN CONTROL, because a probe that silently matched
// nothing would report a clean bill of health: it asserts it genuinely found a
// scroller, that the scroller genuinely moved, and that it found rows to test.
// A pass with no rows tested is a failure.
//
// WIDTHS: 1032x1376 is the 12.9" iPad in portrait, 1376x1032 landscape, and
// 393x852 is an iPhone 15 — the phone runs as the control, since whatever this
// finds on a tablet must not already be true on the device that ships.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SIZES = {
  'iPad portrait':  { width: 1032, height: 1376 },
  'iPad landscape': { width: 1376, height: 1032 },
  'iPhone':         { width: 393,  height: 852  },
};
const TABS = ['Home', 'Stations', 'Modes', 'Profile'];

const b = await chromium.launch({ args: ['--no-sandbox'],
  executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
let rowsTested = 0;

for (const [label, vp] of Object.entries(SIZES)) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
  // Seed, or the first-run explainer is a full-height sheet and every page
  // below it is the onboarding rather than the page (the 10.09 lesson).
  await ctx.addInitScript(() => {
    localStorage.setItem('cruisefm_platform', 'none');
    localStorage.setItem('cruisefm_intro_seen', '1');
    localStorage.setItem('cruise_appearance', 'dark');
    localStorage.setItem('cruisefm_session_kind', 'listening');
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => problems.push(`${label}: page error: ${e.message}`));
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForTimeout(14000);
  const skip = p.locator('text=Skip for now');
  if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }

  for (const tab of TABS) {
    const t = p.locator(`text=${tab.toUpperCase()}`).last();
    if (await t.count()) { await t.click({ force: true }); await p.waitForTimeout(1800); }

    // ── scroll to the very bottom ──────────────────────────────────────────
    // Through the WHEEL rather than by setting scrollTop: react-native-web
    // drives its own onScroll from real scroll events, and a scripted
    // scrollTop moves the element while the component still believes it is at
    // the top — which is how the 11.08 pull-to-dismiss probe reported a fix
    // that was not working (and a break that was).
    const before = await p.evaluate(() => {
      const s = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 40 &&
                       getComputedStyle(e).overflowY !== 'visible')
        .sort((a, b2) => b2.scrollHeight - a.scrollHeight)[0];
      return s ? { top: s.scrollTop, max: s.scrollHeight - s.clientHeight } : null;
    });
    if (!before) { problems.push(`${label} / ${tab}: no scroller found — probe blind`); continue; }
    for (let i = 0; i < 24; i++) {
      await p.mouse.move(vp.width / 2, vp.height / 2);
      await p.mouse.wheel(0, 900);
      await p.waitForTimeout(120);
    }
    await p.waitForTimeout(900);
    const after = await p.evaluate(() => {
      const s = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 40 &&
                       getComputedStyle(e).overflowY !== 'visible')
        .sort((a, b2) => b2.scrollHeight - a.scrollHeight)[0];
      return s ? { top: s.scrollTop, max: s.scrollHeight - s.clientHeight } : null;
    });
    if (before.max > 60 && after && after.top <= before.top + 4) {
      problems.push(`${label} / ${tab}: the page would not scroll (stuck at ${after.top} of ${after.max})`);
      continue;
    }

    // ── is the bottom of the page actually touchable? ─────────────────────
    const report = await p.evaluate(() => {
      const vh = window.innerHeight;
      const out = [];
      // Anything that looks like a row or a control in the last third of the
      // screen — which is where "other functions" live on every tab.
      const cands = [...document.querySelectorAll('div')].filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 120 || r.height < 28 || r.height > 220) return false;
        if (r.top < vh * 0.55 || r.bottom > vh - 4) return false;
        return (e.innerText || '').trim().length > 0;
      });
      // Only the innermost ones, or every ancestor is reported too.
      const rows = cands.filter((e) => !cands.some((o) => o !== e && e.contains(o)));
      for (const e of rows.slice(-8)) {
        const r = e.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        const inside = !!hit && (e.contains(hit) || hit.contains(e));
        if (!inside) {
          const hr = hit?.getBoundingClientRect();
          out.push({
            row: (e.innerText || '').trim().split('\n')[0].slice(0, 34),
            coveredBy: hit ? `${hit.tagName.toLowerCase()} ${Math.round(hr.width)}x${Math.round(hr.height)}` : 'nothing',
          });
        }
      }
      return { tested: rows.slice(-8).length, blocked: out };
    });
    rowsTested += report.tested;
    if (report.tested === 0) problems.push(`${label} / ${tab}: found no rows near the bottom — probe blind`);
    for (const x of report.blocked) {
      problems.push(`${label} / ${tab}: "${x.row}" cannot be touched — covered by ${x.coveredBy}`);
    }

    // ── and can it still move afterwards? ─────────────────────────────────
    const top0 = await p.evaluate(() => {
      const s = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 40 &&
                       getComputedStyle(e).overflowY !== 'visible')
        .sort((a, b2) => b2.scrollHeight - a.scrollHeight)[0];
      return s ? s.scrollTop : -1;
    });
    await p.mouse.move(vp.width / 2, vp.height / 2);
    await p.mouse.wheel(0, -1400);
    await p.waitForTimeout(700);
    const top1 = await p.evaluate(() => {
      const s = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 40 &&
                       getComputedStyle(e).overflowY !== 'visible')
        .sort((a, b2) => b2.scrollHeight - a.scrollHeight)[0];
      return s ? s.scrollTop : -1;
    });
    if (top0 > 40 && top1 >= top0 - 4) {
      problems.push(`${label} / ${tab}: frozen at the bottom — will not scroll back up`);
    }
  }
  await ctx.close();
}
await b.close();

if (rowsTested < 8) problems.push(`only ${rowsTested} rows tested — the probe proved nothing`);
if (problems.length === 0) {
  console.log(`every tab scrolls to its end and its last rows are reachable (${rowsTested} rows tested)`);
  process.exit(0);
}
console.log(`${problems.length} problem(s), ${rowsTested} rows tested:`);
for (const x of problems) console.log('  ' + x);
process.exit(1);
