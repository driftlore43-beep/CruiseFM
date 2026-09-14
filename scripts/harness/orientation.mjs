// DOES A DECK DRAW THE ORIENTATION IT IS ACTUALLY IN?
//
//   npx expo start --web --port 8081
//   BASE_URL=http://localhost:8081 \
//     PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome-linux/chrome \
//     node scripts/harness/orientation.mjs
//
// THE FAULT IT EXISTS FOR (owner, 14.09, four iPad screenshots): "the iPad is
// having issues determining the correct orientation. When I was in portrait,
// it thinks it's horizontal, and the same goes for vertical." Her landscape
// shots show the portrait layout cut off at a hard seam 768 points across —
// the PORTRAIT width — and her portrait shot shows the docked landscape deck.
//
// AND WHY A PLAIN ROTATION TEST CANNOT CATCH IT. Turn a browser window and
// react-native-web updates its own Dimensions in the same tick the DOM
// relayouts, so the two never disagree and every mode passes whichever way
// the size is read. The bug is that on a real iPad they DO disagree for a
// moment — the window's size is published from the root view controller and
// arrives late, while the mode is already drawing. So this harness MAKES them
// disagree: `visualViewport` is stubbed to report the wrong shape (that is
// the one thing react-native-web's Dimensions reads), while Playwright's real
// viewport is the other shape. A deck that asks the WINDOW then draws the
// wrong layout; a deck that measures ITS OWN BOX is unmoved. See
// src/utils/deckSize.tsx.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const PAD_P = { width: 768, height: 1024 };
const PAD_L = { width: 1024, height: 768 };
const MODES = ['vinyl', 'cd', 'cassette', 'equalizer', 'disco', 'horizon', 'orb', 'radio'];

const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];

/** The docked panel is the landscape deck's one unmistakable shape: 40% of
 *  the width (DECK_FRAC), the full height, hard against the right edge. It is
 *  found whether or not the chrome has rested, since resting slides it out
 *  rather than unmounting it. */
async function landscapeDeckPresent(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.clientHeight;
    // Deliberately a RANGE rather than exactly 40% of this viewport: a deck
    // that sized its panel from the wrong window makes the panel the wrong
    // width too, and an exact test would then miss it and report a pass.
    // Nothing in a portrait layout is full-height and only half as wide.
    for (const el of document.querySelectorAll('div')) {
      const r = el.getBoundingClientRect();
      if (r.width >= W * 0.25 && r.width <= W * 0.65 && r.height >= H * 0.85) return true;
    }
    return false;
  });
}

async function run(label, viewport, lie) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(({ lie }) => {
    localStorage.setItem('cruisefm_platform', 'none');
    localStorage.setItem('cruisefm_intro_seen', '1');
    localStorage.setItem('cruise_appearance', 'dark');
    localStorage.setItem('cruisefm_session_kind', 'listening');
    if (lie) {
      // react-native-web reads window.visualViewport and nothing else, so
      // shadowing it is enough to make `useWindowDimensions` wrong on purpose.
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: { width: lie.width, height: lie.height, scale: 1, addEventListener() {}, removeEventListener() {} },
      });
    }
  }, { lie });

  const wantLandscape = viewport.width > viewport.height;
  for (const mode of MODES) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${BASE}/drive?station=night-run&mode=${mode}`, { waitUntil: 'load' });
    await page.waitForTimeout(3200);
    await page.mouse.click(40, 118).catch(() => {});
    await page.waitForTimeout(900);

    const deck = await landscapeDeckPresent(page);
    const seen = deck ? 'landscape' : 'portrait';
    const want = wantLandscape ? 'landscape' : 'portrait';
    const ok = seen === want;
    if (!ok) problems.push(`${label} ${mode}: drew ${seen}, window is ${want}`);
    if (errs.length) problems.push(`${label} ${mode}: page error ${errs[0].slice(0, 120)}`);
    console.log(`  ${mode.padEnd(10)} ${ok ? 'ok' : 'WRONG'}  (${seen})`);
    await page.close();
  }
  await ctx.close();
}

console.log('iPad portrait, window honest');
await run('portrait/honest', PAD_P, null);
console.log('iPad landscape, window honest');
await run('landscape/honest', PAD_L, null);
console.log('iPad landscape, window LYING portrait');
await run('landscape/lying', PAD_L, PAD_P);
console.log('iPad portrait, window LYING landscape');
await run('portrait/lying', PAD_P, PAD_L);

await b.close();
if (problems.length) {
  console.log('\nPROBLEMS');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('\nevery deck drew the orientation it was actually in');
