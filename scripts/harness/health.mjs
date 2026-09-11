// A walk through the app in a real browser: every page, every sheet, the drive
// flow, and back out. Catches page errors AND asserts that each step actually
// arrived somewhere — a click that hits nothing throws nothing, so a step that
// only catches exceptions reports "ok" for having done nothing at all.
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/health.mjs
let chromium;
try {
  // NODE_PATH does not apply to ESM imports, so an install outside the project
  // has to be pointed at directly.
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');

import { answerOffAir, visibleClicker } from './visible.mjs';

const errors = [];
const steps = [];
const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem('cruisefm_platform', 'spotify');
  // Past the one-off "what is this app" sheet, the same way this seeds
  // past the platform sheet above. scripts/harness/intro.mjs owns that
  // sheet; every other harness would otherwise run with a Modal over
  // the app, which is how a harness passes while testing nothing.
  localStorage.setItem('cruisefm_intro_seen', '1');
  localStorage.setItem('cruise_appearance', 'dark');
});
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });

/**
 * VISIBLE, not merely present. Expo Router keeps every tab mounted, so a
 * count-based check sees "Now tuning" while you are on Profile — which made
 * every page assertion below pass whether or not it had navigated. That is the
 * vacuous pass this file exists to avoid.
 */
const has = async (t) => {
  const l = p.getByText(t, { exact: true }).first();
  return (await l.count()) > 0 && (await l.isVisible().catch(() => false));
};
/** Navigation is judged by the route, which cannot be faked by a stale tab. */
const at = (route) => p.url().replace(/[?#].*$/, '').endsWith(route);

const clickVisible = visibleClicker(p);

/** Tap, then prove something changed — never just "it didn't throw". */
async function step(name, act, expect) {
  try {
    await act();
    await p.waitForTimeout(2600);
    const ok = expect ? await expect() : true;
    steps.push(`  ${ok ? 'ok  ' : 'MISS'} ${name}`);
  } catch (e) {
    steps.push(`  FAIL ${name} — ${String(e).slice(0, 90)}`);
  }
}
/**
 * The floating tab bar, by EXACT text. `text=STATIONS` unquoted is a
 * case-insensitive SUBSTRING match, so it also matches "Your stations" on the
 * home shelf — and .first() then taps that instead, navigating nowhere while
 * still looking like a successful step. The bar renders after the screen, so
 * .last() is the tab rather than any page content that shares the word.
 */
async function tapTab(label) {
  await p.getByText(label, { exact: true }).last().click({ force: true, timeout: 8000 });
}
async function tap(sel, { force = true } = {}) {
  const l = typeof sel === 'string' ? p.locator(sel).first() : sel;
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.click({ force, timeout: 8000 });
}

async function fresh() {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForTimeout(12000);
  if (await has('Skip for now')) {
    await tap('text=Skip for now');
    // The sheet's backdrop lingers after the tap and swallows every later
    // click, which reads as the app ignoring you.
    await p.waitForTimeout(2500);
  }
}
await fresh();

await step('first-run platform sheet dismisses',
  async () => { if (await has('Skip for now')) await tap('text=Skip for now'); },
  async () => !(await has('Connect Your Music')));

for (const [tab, route, marker] of [
  ['CRUISE', '/cruise', 'Recommended'],
  ['STATIONS', '/stations', 'Now tuning'],
  ['MODES', '/modes', 'Modes'],
  ['PROFILE', '/profile', 'Badges'],
]) {
  await step(`page: ${tab}`, () => tapTab(tab), async () => at(route) && await has(marker));
}

await step('profile: a settings page opens',
  async () => {
    await tapTab('PROFILE');
    await p.waitForTimeout(1500);
    const row = p.getByText('About Cruise FM', { exact: true }).first();
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.click({ force: true, timeout: 15000 });
  },
  // The settings page prints the version, which no other screen does.
  async () => (await p.getByText(/^Version/i).count()) > 0 || (await has('Strofi Technologies')));
await step('settings page goes back',
  async () => { const b = p.locator('[tabindex="0"]').first(); await b.click({ force: true }); },
  () => has('Badges'));

await fresh();
await step('stations: the dial lists both bands',
  async () => { await tapTab('STATIONS'); await p.waitForTimeout(2000); },
  async () => at('/stations') && (await has('FREE')));

await fresh();
await step('modes: the mood sheet opens on a mode',
  async () => {
    await tapTab('MODES');
    await p.waitForTimeout(1800);
    await clickVisible('Equalizer');
  },
  // The sheet's own heading — "Night Run AM" would be true from the Stations
  // tab sitting mounted behind it.
  () => has('MOOD FOR EQUALIZER'));

// getByText exact, not `text=...`: the sheet shows several rows whose text
// contains this station's name, and .first() on a loose match picks one that
// is not the row.
await step('mood sheet starts a drive',
  async () => {
    await p.getByText('Night Run AM', { exact: true }).first().click({ force: true });
    // Night Run keeps hours, so for most of the day picking it raises the
    // off-air ask before the drive opens. See answerOffAir.
    await answerOffAir(p);
  },
  () => has('YOU’RE LISTENING TO'));
await step('in-drive: change-mode sheet',
  // No scrollIntoViewIfNeeded: inside the mode's own modal it does not resolve
  // and the click times out waiting for it.
  () => p.getByText('Change Mode', { exact: true }).first().click({ force: true, timeout: 12000 }),
  () => has('Vinyl'));
await step('change-mode swaps the deck',
  async () => {
    // Chips scroll horizontally inside the sheet; take whichever is on screen
    // rather than naming one that may be off the right edge.
    const chip = p.locator('text=Cassette').first();
    await chip.scrollIntoViewIfNeeded().catch(() => {});
    await chip.click({ force: true });
  },
  () => has('YOU’RE LISTENING TO'));

await b.close();

console.log('\n──────── SMOKE WALK ────────');
console.log(steps.join('\n'));
const bad = steps.filter((s) => /MISS|FAIL/.test(s)).length;
console.log(`\n──────── ERRORS (${errors.length}) ────────`);
console.log(errors.length ? errors.slice(0, 12).map((e) => '  ' + e).join('\n') : '  none');
console.log(bad ? `\n${bad} step(s) did not land` : '\nall steps landed');
process.exit(bad || errors.length ? 1 : 0);
