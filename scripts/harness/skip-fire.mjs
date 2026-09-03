// Does pressing skip reach the service — and does the bar hold still?
//
//   npx expo start --web --port 8081
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     node scripts/harness/skip-fire.mjs
//
// WHY IT EXISTS (owner, 03.09, with a screen recording): "whenever I change
// songs the bar likes to jump back to 0:00 and the time when I changed the
// songs. So it looks like it's jumping around." Measured from that clip frame
// by frame: the readout ran 0:11 on a 3:32 song, dropped to 0:00 for half a
// second, and came back at 0:12 — SAME SONG, same duration, same title. The
// cause was `resetTrack()`, wired into every skip button, zeroing the bar
// before Spotify had been asked; the first chase poll then put it back.
//
// IT CHECKS BOTH HALVES, because the fix for one can silently break the other
// and did: the sweep that deleted resetTrack briefly left every handler as
// `() => spotify.next`, which type-checks and does nothing when pressed.
//
//   fires   the press reaches /me/player/next
//   holds   the bar does NOT drop to zero
//
// SPOTIFY IS FAKED AT THE NETWORK, not stubbed in the app, so the whole real
// path runs: a token in storage, /me/player answering with a song fixed at
// 1:11 of 3:32, and the transport endpoints answering 204. That means the poll,
// the chase, useTrackClock and the bar are all the shipped code.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
import { answerOffAir, visibleClicker } from './visible.mjs';

const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
/** Where the fake song sits. Deliberately well clear of zero, so a bar that
 *  drops to the start is unmistakable rather than a rounding argument. */
const AT_MS = 71000;
const LEN_MS = 212000;
const MODES = (process.env.MODES || 'Tuner,CD,Circular EQ,Mirror Ball,Horizon').split(',');

const state = (progress) => ({
  device: { id: 'harness', is_active: true, name: 'Harness', type: 'Computer' },
  is_playing: true,
  progress_ms: progress,
  shuffle_state: false,
  repeat_state: 'off',
  context: { uri: 'spotify:playlist:harness' },
  item: {
    name: 'Bout You Now', uri: 'spotify:track:harness',
    duration_ms: LEN_MS,
    artists: [{ name: 'Sugababes' }],
    album: { images: [] },
  },
});

const b = await chromium.launch({ args: ['--no-sandbox'] });
const problems = [];

for (const MODE of MODES) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('cruisefm_platform', 'spotify');
    localStorage.setItem('spotify_access_token', 'harness-token');
    localStorage.setItem('spotify_token_expiry', String(Date.now() + 3600e3));
    localStorage.setItem('cruise_appearance', 'dark');
    localStorage.setItem('cruisefm_intro_seen', '1');
  });
  const p = await ctx.newPage();
  const hits = [];
  // THE FAKE SERVICE NEVER MOVES THE SONG ON. A real skip would change the
  // track, and then a bar that jumped would be telling the truth — so the
  // reply stays identical either side of the press, which makes any movement
  // of the bar the app's own invention. That is the bug, isolated.
  await p.route('**://api.spotify.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    hits.push(path);
    if (path === '/v1/me/player') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state(AT_MS)) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  p.on('pageerror', (e) => problems.push(`${MODE}: page error ${e.message}`));

  try {
    await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await p.waitForTimeout(14000);
    const skip = p.locator('text=Skip for now');
    if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }
    await p.getByText('MODES', { exact: true }).last().click({ force: true });
    await p.waitForTimeout(2000);
    await visibleClicker(p)(MODE);
    await p.waitForTimeout(2500);
    await p.getByText('Night Run AM', { exact: true }).last().click({ timeout: 20000 });
    await answerOffAir(p);
    await p.waitForTimeout(4000);
    // A rested deck ignores the first tap; wake it above every mode's object.
    await p.mouse.click(40, 118);
    await p.waitForTimeout(1200);

    // The elapsed readout is the instrument — the same thing the owner filmed.
    // Read it rather than the bar's width: it is a number, so a drop to zero
    // cannot be confused with a narrow bar.
    const readElapsed = () => p.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('*')) {
        if (e.children.length) continue;
        const t = (e.textContent || '').trim();
        if (/^\d{1,2}:\d{2}$/.test(t)) {
          const r = e.getBoundingClientRect();
          if (r.width > 0 && r.top > window.innerHeight * 0.5) out.push({ t, x: r.x });
        }
      }
      // Elapsed sits left of the duration on the same row.
      out.sort((a, c) => a.x - c.x);
      return out.length ? out[0].t : null;
    });

    const before = await readElapsed();
    if (before == null) { problems.push(`${MODE}: no elapsed readout found — the probe saw nothing`); continue; }
    if (before === '0:00') { problems.push(`${MODE}: the bar was already at 0:00 before the press — the fake song never landed`); continue; }

    const n0 = hits.filter((h) => h.endsWith('/next')).length;
    // Press skip-next. The glyph is an icon font, so find it by its own
    // codepoint rather than by text.
    const pressed = await p.evaluate(() => {
      for (const e of document.querySelectorAll('*')) {
        if (e.children.length) continue;
        const cp = (e.textContent || '').codePointAt(0);
        if (cp === 0xf04ad || cp === 0xf04ae) {   // skip-next / skip-previous
          const r = e.getBoundingClientRect();
          if (r.width > 20) { e.closest('[tabindex],div')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
        }
      }
      return true;
    });
    // Watch the readout across the whole window the drop used to live in
    // (measured at half a second) plus the first chase polls.
    const seen = [];
    for (let i = 0; i < 14; i += 1) { seen.push(await readElapsed()); await p.waitForTimeout(120); }

    const fired = hits.filter((h) => h.endsWith('/next')).length > n0;
    const zeroed = seen.some((s) => s === '0:00');
    if (!fired) problems.push(`${MODE}: skip did not reach the service — the button is wired to nothing`);
    if (zeroed) problems.push(`${MODE}: the bar dropped to 0:00 after a skip (${before} -> ${seen.join(' ')})`);
    console.log(`${MODE.padEnd(12)} before ${before}  fires ${fired ? 'yes' : 'NO'}  holds ${zeroed ? 'NO' : 'yes'}  [${[...new Set(seen)].join(' ')}]`);
  } catch (e) {
    problems.push(`${MODE}: ${e.message.split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
}
await b.close();

if (problems.length) {
  console.error('\nskip-fire FAILED:\n' + problems.map((s) => `  - ${s}`).join('\n'));
  process.exit(1);
}
console.log('\nskip-fire ok — every skip reaches the service and leaves the bar alone.');
