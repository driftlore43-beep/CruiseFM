// Re-shoot the Stations page for the marketing set. The shipped screenshot is
// scrolled to the very top, which leaves the last row SLICED in half against
// the screen's bottom edge — honest in the app, but on a slide it reads as a
// botched crop. Scrolling a little lands the cut between rows and shows more
// of the dial, which is the point of the slide.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3 });
const pg = await ctx.newPage();
const errors = [];
pg.on('pageerror', e => errors.push(String(e)));

await pg.goto('http://localhost:8081/stations', { waitUntil: 'networkidle', timeout: 180000 });
await pg.waitForTimeout(8000);
const skip = pg.getByText('Skip for now');
if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(1200); }
await pg.waitForTimeout(2000);

// Mouse wheel does not move an RN ScrollView on web — set scrollTop directly
// on the tallest scroller (the known trick from the 26.07 stations round).
const amount = Number(process.argv[2] || 0);
await pg.evaluate((y) => {
  const els = [...document.querySelectorAll('div')]
    .filter(e => e.scrollHeight > e.clientHeight + 40);
  els.sort((a, b) => b.scrollHeight - a.scrollHeight);
  if (els[0]) els[0].scrollTop = y;
}, amount);
await pg.waitForTimeout(1200);
await pg.screenshot({ path: process.argv[3] || 'stations.png' });
console.log('scroll', amount, 'errors:', errors.length ? errors.slice(0, 2) : 'none');
await b.close();
