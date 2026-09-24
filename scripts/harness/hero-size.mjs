// HOW BIG IS A MODE'S OBJECT, REALLY — measured from its own box.
//
//   npx expo start --web --port 8085
//   NO_PROXY='*' PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     BASE_URL=http://localhost:8085 MODE=Vinyl STATION='Night Run AM' \
//     OUT=/tmp/vinyl.png node scripts/harness/hero-size.mjs
//
// WRITTEN 2026-09-24, after the owner asked whether the record had got
// smaller. It had not — but establishing that took four goes, because every
// PIXEL method was fooled by something:
//
//   * widest bright span on a row        -> read the TONEARM, which is bright
//                                           and lives to the right, so it
//                                           reported the disc off-centre
//   * longest dark run through the middle -> read the LABEL, which is bright
//   * saturation                          -> read the SUNSET BACKDROP
//   * leftmost bright pixel in a band     -> read the SONG TITLE below
//
// THE ELEMENT'S OWN BOX CANNOT BE FOOLED. On web every one of these objects
// is a div with a 50% border radius, so "the largest round boxes on the page"
// finds the platter, the record and the label in one reading, in points, with
// no threshold to tune and nothing to be contaminated by.
//
// IT MEASURES WEB, WHICH IS NOT A PHONE — but the sizes come from one
// arithmetic expression fed by the deck's measured box, so a viewport set to
// a phone's own points gives the same numbers a phone does. Verified against
// the owner's own screenshot: 333pt here, 331-332pt measured off her rim.
import { answerOffAir, visibleClicker } from './visible.mjs';

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const MODE = process.env.MODE || 'Vinyl';
const STATION = process.env.STATION || 'Night Run AM';
const OUT = process.env.OUT || null;
const W = Number(process.env.W || 428);
const H = Number(process.env.H || 926);

const b = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
});
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => {
  localStorage.setItem('cruisefm_platform', 'none');
  localStorage.setItem('cruisefm_intro_seen', '1');
  localStorage.setItem('cruise_appearance', 'dark');
  localStorage.setItem('cruisefm_session_kind', 'driving');
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.waitForTimeout(12000);
const skip = p.locator('text=Skip for now');
if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }
await p.getByText('MODES', { exact: true }).last().click({ force: true, timeout: 8000 });
await p.waitForTimeout(2000);
await visibleClicker(p)(MODE);
await p.waitForTimeout(3000);
await p.getByText(STATION, { exact: true }).last().click({ timeout: 20000 });
await answerOffAir(p);
// Let the mode settle AND the "visuals only for now" hint retire itself.
await p.waitForTimeout(14000);
// Wake the chrome WITHOUT touching the object: (40,118) is above every mode's
// hero and clear of both the chevron and the grabber (shots.mjs trap 2).
await p.mouse.click(40, 118);
await p.waitForTimeout(1200);

const boxes = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('div')) {
    const r = el.getBoundingClientRect();
    if (r.width < 120 || Math.abs(r.width - r.height) > 2) continue;
    const br = parseFloat(getComputedStyle(el).borderRadius);
    if (!br || br < r.width * 0.45) continue;
    out.push(Math.round(r.width));
  }
  return [...new Set(out)].sort((a, b) => b - a).slice(0, 6);
});
console.log(`${MODE} on ${STATION} at ${W}x${H}: round boxes (points) ${boxes.join(', ')}`);
if (OUT) await p.screenshot({ path: OUT });
console.log(errs.length ? `PAGE ERRORS: ${errs.join(' | ')}` : 'no page errors');
await b.close();
