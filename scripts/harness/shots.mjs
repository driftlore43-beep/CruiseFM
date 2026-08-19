// App Store screenshots: the app's own screen, nothing added.
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/shots.mjs
//
// 428 x 926 logical at deviceScaleFactor 3 = 1284 x 2778, which is Apple's
// 6.5" slot. No device frame is drawn — these are raw screens, so a design
// tool can put whatever frame it likes around them (or none).
//
// NOTHING IS CONNECTED, ON PURPOSE. With no music service every mode falls
// back to the STATION'S OWN TAGLINE, so there is no song title, no artist and
// no album art anywhere in the set. That removes the whole rights question at
// source, and it reads better than a real track would.
//
// THREE TRAPS, each of which cost a set:
//
// 1. Start Drive already leaves the mode PLAYING. Pressing the transport to
//    "start" it PAUSES it — and a paused Mirror Ball is deliberately dark and
//    unlit, so the first set came out with a dead grey ball. Touch nothing.
//
// 2. The Mirror Ball rests its chrome after a few untouched seconds, so it
//    needs a wake tap — but (214, 200) lands on the record on Vinyl and the
//    disc on CD, which toggles playback. (40, 118) is above every mode's
//    object and clear of both the chevron and the grabber.
//
// 3. Wait for the "visuals only for now" hint to clear itself (~9.5s) or it
//    sits across the top of the picture.
import fs from 'node:fs';

import { answerOffAir, visibleClicker } from './visible.mjs';

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const OUT = process.env.OUT_DIR || 'screenshots-appstore';
fs.mkdirSync(OUT, { recursive: true });

// Mode paired with the station whose colours suit it. Same pairings as the
// live listing, so a slide's sampled colour stays the one in the brief.
const SHOTS = [
  ['01-mirrorball-downtown',    'Mirror Ball', 'Downtown FM'],
  ['02-vinyl-sunset',           'Vinyl',       'Sunset AM'],
  ['04-horizon-afterhours',     'Horizon',     'After Hours FM'],
  ['05-cassette-daylight',      'Cassette',    'Daylight AM'],
  ['06-cd-coastal',             'CD',          'Coastal FM'],
  ['07-tuner-nightrun',         'Tuner',       'Night Run AM'],
  ['09-equalizer-mountainpass', 'Equalizer',   'Mountain Pass FM'],
];

// ONLY=cassette,tuner re-shoots a subset — the mood sheet is occasionally
// slow to settle and a single shot is cheaper to retry than the set.
const ONLY = (process.env.ONLY || '').split(',').map((x) => x.trim()).filter(Boolean);
const wanted = (file) => ONLY.length === 0 || ONLY.some((o) => file.includes(o));

const b = await chromium.launch({ args: ['--no-sandbox'] });
const problems = [];

async function page() {
  const ctx = await b.newContext({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3 });
  await ctx.addInitScript(() => {
    // 'none' is the companion listener: no service, so no track, so every mode
    // shows the station's tagline instead of a song.
    localStorage.setItem('cruisefm_platform', 'none');
    localStorage.setItem('cruise_appearance', 'dark');
    localStorage.setItem('cruisefm_session_kind', 'driving');
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForTimeout(12000);
  const skip = p.locator('text=Skip for now');
  if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }
  return { ctx, p };
}
const tapTab = (p, label) => p.getByText(label, { exact: true }).last().click({ force: true, timeout: 8000 });

for (const [file, mode, station] of SHOTS) {
  if (!wanted(file)) continue;
  const { ctx, p } = await page();
  try {
    await tapTab(p, 'MODES');
    await p.waitForTimeout(2000);
    // Scroll first: the later cards sit below the fold, and force:true does
    // NOT scroll — it clicked the floating tab bar instead and never opened
    // the sheet at all.
    // REACHABLE, not merely first. The home page keeps a mode picker and a
    // mood picker mounted off-screen, so several cards' names exist two or
    // three times in the document; `.first()` started aiming at a parked chip,
    // which has pointer-events none and can never be clicked, so the click sat
    // there until it timed out (19.08 — the same trap the other harnesses were
    // fixed for, and this file was missed).
    await visibleClicker(p)(mode);
    await p.waitForTimeout(3000);
    // NO force here. force skips the actionability wait, and that includes
    // "has the element stopped moving" — so the row's position was read while
    // the sheet was still sliding up, and the click landed on stale
    // coordinates well above the intended station.
    // .last(), not .first(): the Stations tab stays MOUNTED behind the sheet
    // with its own row of the same name, and that copy is unclickable — the
    // click sat there until it timed out. The sheet renders after the page, so
    // its copy is the later one in the document.
    await p.getByText(station, { exact: true }).last().click({ timeout: 20000 });
    // Most of these stations keep hours, so at most times of day the drive
    // does not open until the off-air ask is answered.
    await answerOffAir(p);
    // Let the mode settle AND the wake hint retire itself.
    await p.waitForTimeout(14000);
    // Wake the chrome without touching the object — see trap 2.
    await p.mouse.click(40, 118);
    await p.waitForTimeout(1500);
    const shown = await p.getByText('YOU’RE LISTENING TO', { exact: true }).first().isVisible().catch(() => false);
    if (!shown) { problems.push(`${file}: never reached the mode`); }
    else {
      await p.screenshot({ path: `${OUT}/${file}.jpg`, quality: 92, type: 'jpeg' });
      console.log(`  shot ${file}  (${mode} / ${station})`);
    }
  } catch (e) {
    problems.push(`${file}: ${String(e).slice(0, 110)}`);
  }
  await ctx.close();
}

// The dial, at MAX scroll: that is what shows all ten stations, both bands and
// the red tuned marker. Scrolled to the top it slices the last row in half.
if (wanted('stations')) {
  const { ctx, p } = await page();
  try {
    await tapTab(p, 'STATIONS');
    await p.waitForTimeout(3000);
    // THE DIAL'S OWN SCROLLER, named rather than guessed. Expo Router keeps
    // every tab mounted, so the home page is also scrollable and is the FIRST
    // such element in the document — "the first scrollable div" scrolled that
    // instead, left the dial at the top, and produced a slide that was not the
    // stations page at all. Identify it by what it contains.
    const scrolled = await p.evaluate(() => {
      // INNERMOST, not first and not any match. Naming the page's own heading
      // is still not enough: the tabs sit inside a wrapper that is itself
      // scrollable and contains every page's text, so it matches too — and
      // scrolling THAT slid the whole stations page up and out of frame,
      // leaving the home page's parked sheet in the shot. The dial's own
      // ScrollView is the shortest of the matches.
      const all = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 200 && /Now tuning/.test(e.innerText || ''));
      if (!all.length) return false;
      const d = all.reduce((a, b) => (b.scrollHeight < a.scrollHeight ? b : a));
      d.scrollTop = d.scrollHeight;
      return true;
    });
    if (!scrolled) throw new Error('could not find the dial\'s scroller');
    await p.waitForTimeout(600);
    // Prove it is the dial we are photographing: the last row of the FM band
    // has to be on screen, or the scroll went somewhere else again.
    const lastRow = await p.evaluate(() => {
      for (const e of document.querySelectorAll('*')) {
        if (e.children.length === 0 && (e.textContent || '').trim() === 'Tunnel FM') {
          const r = e.getBoundingClientRect();
          if (r.top > 0 && r.bottom < window.innerHeight) return true;
        }
      }
      return false;
    });
    if (!lastRow) throw new Error('the dial is not in frame — the scroll hit the wrong element');
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `${OUT}/03-stations-dial.jpg`, quality: 92, type: 'jpeg' });
    console.log('  shot 03-stations-dial  (the dial at full scroll)');
  } catch (e) {
    problems.push(`03-stations-dial: ${String(e).slice(0, 110)}`);
  }
  await ctx.close();
}

await b.close();
console.log(problems.length ? '\nPROBLEMS:\n' + problems.map((x) => '  ' + x).join('\n') : '\nall shots taken');
process.exit(problems.length ? 1 : 0);
