/**
 * The 25.08 round, driven in the real web build.
 *
 * Three of the four things fixed this round can be seen from a browser and
 * one cannot, which is the usual split:
 *
 *   CAN:  the platform sheet remembering what is already chosen (the "keeps
 *         unselecting" report), reordering the modes list, and typing a dial
 *         number for a custom station.
 *   CANNOT: the Apple Music timeout and the backgrounded resume check — both
 *         need MusicKit and a real app lifecycle, so they are covered by
 *         scripts/test-apple-start-timeout.mjs and the guards in
 *         useAppleMusicPlayback instead.
 *
 * Each check below carries its own CONTROL — a reading that would differ if
 * the fix had not landed — because a probe that cannot fail is not a test.
 * Run the web build first: npx expo start --web --port 8081
 */
import { visibleClicker } from './visible.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = process.env.OUT_DIR ?? '/tmp/ethan-round';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright');

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 1400 } });
const click = visibleClicker(page);
page.on('pageerror', (e) => { fails++; console.log('  PAGE ERROR', e.message); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// ── 1. THE PLATFORM SHEET REMEMBERS ────────────────────────────────────────
// Ethan: "Apple Music keeps unselecting in settings menu." The sheet always
// started with `selected` null, so it showed nothing chosen on every open
// even though the saved platform had not moved.
console.log('\n  the platform sheet shows what is already chosen:');
{
  // The first-run sheet is up. Choose Apple Music properly.
  await click('Apple Music');
  await page.waitForTimeout(300);
  await click('Let’s Drive').catch(async () => { await click("Let's Drive"); });
  await page.waitForTimeout(1200);

  const saved = await page.evaluate(() => localStorage.getItem('cruisefm_platform'));
  check('the choice is saved', saved === 'appleMusic', String(saved));

  // Re-open it from Profile and see whether it remembers.
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await click('Apple Music');            // the Music Platform row shows the name
  await page.waitForTimeout(1500);

  // A selected card is the one whose "Let's Drive" button is live rather than
  // the disabled "Select a platform" placeholder — that is the app's own
  // signal that something is chosen, so it cannot pass vacuously.
  const state = await page.evaluate(() => {
    const txt = [...document.querySelectorAll('*')]
      .filter((e) => !e.children.length)
      .map((e) => (e.textContent || '').trim());
    return {
      prompting: txt.includes('Select a platform'),
      ready: txt.some((t) => /Let.s Drive/.test(t)),
    };
  });
  check('it does NOT ask you to select a platform again', !state.prompting, JSON.stringify(state));
  check('...it opens with the choice already made', state.ready, JSON.stringify(state));
  await page.screenshot({ path: `${OUT}/1-platform-remembers.png` });
  await page.keyboard.press('Escape').catch(() => {});
  await click('Skip for now').catch(() => {});
  await page.waitForTimeout(800);
}

// ── 2. REORDERING THE MODES ────────────────────────────────────────────────
console.log('\n  the modes list can be reordered:');
{
  await page.goto(`${BASE}/modes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const titlesOf = () => page.evaluate(() => {
    const known = ['Equalizer', 'Circular EQ', 'Cassette', 'Vinyl', 'Tuner', 'Horizon', 'CD', 'Mirror Ball'];
    return [...document.querySelectorAll('*')]
      .filter((e) => !e.children.length && known.includes((e.textContent || '').trim()))
      .map((e) => ({ t: e.textContent.trim(), y: e.getBoundingClientRect().y }))
      .filter((x) => x.y > 0)
      .sort((a, b) => a.y - b.y)
      .map((x) => x.t);
  });

  // THE HERO CARD IS ALSO A MODE, so its title appears twice and every index
  // shifts by one — and edit mode hides the hero, so the two lists aren't even
  // the same length. Assert on RELATIVE order instead, which is what actually
  // matters and cannot be thrown off by the hero appearing or not.
  const isBefore = (list, a, b) => list.indexOf(a) < list.lastIndexOf(b);

  const before = await titlesOf();
  check('CD sits after Horizon to begin with', isBefore(before, 'Horizon', 'CD'), before.join(' '));
  console.log('       before:', before.join(' · '));

  await click('Edit order');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/2-edit-order.png` });

  // Move CD up one within PREMIUM. The up-chevrons are the only ones on the
  // page in this state; find the row and press its up arrow.
  const moved = await page.evaluate(() => {
    const known = ['Vinyl', 'Tuner', 'Horizon', 'CD', 'Mirror Ball'];
    const label = [...document.querySelectorAll('*')]
      .find((e) => !e.children.length && (e.textContent || '').trim() === 'CD');
    if (!label) return 'no CD row';
    const rowY = label.getBoundingClientRect().y;
    // The two chevrons on that row sit to its right at roughly the same y.
    const btns = [...document.querySelectorAll('[role="button"], div')]
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter((x) => x.r.width > 10 && x.r.width < 40 && x.r.height > 10 && x.r.height < 40
        && Math.abs(x.r.y + x.r.height / 2 - (rowY + 8)) < 30 && x.r.x > 280);
    if (!btns.length) return 'no chevrons';
    btns.sort((a, b) => a.r.y - b.r.y);
    btns[0].e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return 'clicked';
  });
  console.log('       move:', moved);
  await page.waitForTimeout(900);

  const after = await titlesOf();
  console.log('       after: ', after.join(' · '));
  check('the order actually changed', after.join() !== before.join(), after.join(' '));
  check('CD now sits BEFORE Horizon', isBefore(after, 'CD', 'Horizon'), after.join(' '));
  check('...and only by one place — Tuner is still above it',
    isBefore(after, 'Tuner', 'CD'), after.join(' '));
  check('the free/premium split is intact',
    isBefore(after, 'Cassette', 'Vinyl') && isBefore(after, 'Cassette', 'CD'),
    after.join(' '));
  const stored = await page.evaluate(() => localStorage.getItem('cruisefm_mode_order'));
  check('the order is saved to the phone', !!stored, String(stored));
  await page.screenshot({ path: `${OUT}/3-reordered.png` });

  // AND IT SURVIVES A RELOAD — the point of saving it.
  await click('Done');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const afterReload = await titlesOf();
  check('the new order survives a restart',
    isBefore(afterReload, 'CD', 'Horizon'), afterReload.join(' '));
}

// ── 3. THE DIAL NUMBER FIELD ───────────────────────────────────────────────
console.log('\n  a custom station can be given its own dial number:');
{
  await page.goto(`${BASE}/stations`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await click('Create');
  await page.waitForTimeout(1200);

  const hasField = await page.evaluate(() => [...document.querySelectorAll('*')]
    .some((e) => !e.children.length && (e.textContent || '').trim() === 'Dial number (optional)'));
  check('the field is on the create sheet', hasField);

  // The preview row prints the dial number. Read it, type a number, read again.
  const dialShown = () => page.evaluate(() => {
    const label = [...document.querySelectorAll('*')]
      .find((e) => !e.children.length && (e.textContent || '').trim() === 'ON THE DIAL');
    if (!label) return null;
    const y = label.getBoundingClientRect().y;
    const nums = [...document.querySelectorAll('*')]
      .filter((e) => !e.children.length && /^\d{3,4}$/.test((e.textContent || '').trim()))
      .map((e) => ({ t: e.textContent.trim(), dy: e.getBoundingClientRect().y - y }))
      .filter((x) => x.dy > 0 && x.dy < 80);
    return nums.length ? nums[0].t : null;
  });

  const auto = await dialShown();
  check('the preview shows an automatic number to begin with', /^\d{3,4}$/.test(auto ?? ''), String(auto));

  const input = page.locator('input').filter({ hasNot: page.locator('[readonly]') });
  const count = await input.count();
  // The dial field is the last text input on the sheet (name, tagline, dial).
  await input.nth(count - 1).fill('1010');
  await page.waitForTimeout(700);
  const typed = await dialShown();
  check('typing a number changes what the dial will read', typed === '1010', `${auto} -> ${typed}`);
  check('...and it is genuinely different from the automatic one', typed !== auto, `${auto} -> ${typed}`);
  await page.screenshot({ path: `${OUT}/4-dial-number.png` });

  // Out of band is pulled back onto the scale rather than accepted.
  await input.nth(count - 1).fill('9999');
  await page.waitForTimeout(600);
  const clamped = await dialShown();
  check('a number off the AM scale is clamped to 1600', clamped === '1600', String(clamped));
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the three visible fixes all land\n');
await browser.close();
process.exit(fails ? 1 : 0);
