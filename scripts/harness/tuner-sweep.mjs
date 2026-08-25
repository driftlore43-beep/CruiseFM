// Does sweeping the Tuner's dial leave the app alone?
//
//   npx expo start --web --port 8086
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8086 node scripts/harness/tuner-sweep.mjs
//
// A listener reported the app freezing when he changed station from the Tuner
// (23.08). The Tuner is the only place in the app that retunes mid-drive, and
// that path deliberately restarts the music — so sweeping across five stations
// used to start five uncancellable chains, each with its own delayed kick and
// each setting or clearing the playback notice as it resolved, out of order.
// That notice is its own iOS window, so a stack of them mounts and unmounts
// real windows over the mode's own: the third-window trap, where iOS presents
// nothing and swallows every touch.
//
// WHAT THIS CLAIMS, AND WHAT IT DELIBERATELY DOES NOT. It claims only that
// hunting across the dial leaves the app awake and throws no errors. It does
// NOT prove the fix, and several versions of it tried: a browser has no iOS
// windows to stack, no haptic queue to saturate, refuses requests instantly so
// the chains never overlap, and a scripted mouse is too slow to land stations
// inside the 900ms breath. Counting the notice failed too — it is dismissed by
// a tap ANYWHERE, so once it is up the next flick's press dismisses it instead
// of reaching the dial, and the count measures that rather than the chains.
// Measured call counts came out 8 against 10, then 11 against 8: noise.
//
// THE RULE ITSELF IS PROVEN IN scripts/test-station-supersede.mjs, which drives
// the real context against a stubbed slow service and separates cleanly (one
// conversation against four). This is the regression guard beside it.
//
// TWO THINGS IT HAS TO FAKE, and without either it measures nothing and
// passes whatever the code does:
//
//   a Spotify token, because the whole music path stands down for a listener
//   who is not connected — so with no token there is nothing to count;
//
//   a SLOW service. Requests from here are refused instantly, so every chain
//   finished long before the next one began and old and new code measured the
//   same. Chains only pile up when the service is slow, which on a moving car's
//   signal is the ordinary case — so every call is held for a few seconds,
//   which is the condition the bug was reported under.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
import { answerOffAir, visibleClicker } from './visible.mjs';

const problems = [];

const b = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 393, height: 852 } });
await ctx.addInitScript(() => {
  localStorage.setItem('cruisefm_platform', 'spotify');
  localStorage.setItem('cruise_appearance', 'dark');
  localStorage.setItem('spotify_access_token', 'harness-token');
  localStorage.setItem('spotify_token_expiry', String(Date.now() + 3600_000));
  // A LINKED PLAYLIST ON EVERY STATION THE DIAL PASSES. Without one, starting
  // a station is a single call and the count is dominated by the breath's own
  // pause, which happens either way — so the two versions read almost the
  // same. With one, the real conversation happens and the difference shows.
  const pl = { spotify: { uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', name: 'Harness' } };
  localStorage.setItem('cruise_station_playlists', JSON.stringify({
    'night-run': pl, sunset: pl, daylight: pl,
  }));
});
const p = await ctx.newPage();
p.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
// A slow, ultimately-failing service — a car going through a tunnel.
await p.route('**://api.spotify.com/**', async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  await route.abort('failed').catch(() => {});
});

try {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForTimeout(14000);
  const skip = p.locator('text=Skip for now');
  if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }

  await p.getByText('MODES', { exact: true }).last().click({ force: true });
  await p.waitForTimeout(2000);
  await visibleClicker(p)('Tuner');
  await p.waitForTimeout(2500);
  await p.getByText('Night Run AM', { exact: true }).last().click({ timeout: 20000 });
  await answerOffAir(p);
  await p.waitForTimeout(4000);
  // Wake the chrome, then let the opening notice run its 8s course so what we
  // count afterwards belongs to the sweep and not to the drive starting.
  await p.mouse.click(40, 118);
  await p.waitForTimeout(11000);


  // SEVERAL FLICKS, NOT ONE LONG DRAG, and that distinction cost a run: the
  // dial only settles on a station when the finger LIFTS, so one continuous
  // sweep is one station change however far it travels. What stacks the chains
  // is what a person actually does when hunting for a station — flick, look,
  // flick again — because each landing starts a fresh chain while the last
  // one is still talking to Spotify.
  const dialY = 560;
  const flick = async (from, to) => {
    await p.mouse.move(from, dialY);
    await p.mouse.down();
    // Few, large steps. Playwright's moves are slow enough that a finely
    // stepped drag takes most of a second on its own, which pushes the
    // landings further apart than the breath and hides the very overlap this
    // is trying to create.
    for (let x = from; (from > to ? x >= to : x <= to); x += from > to ? -60 : 60) {
      await p.mouse.move(x, dialY);
    }
    await p.mouse.move(to, dialY);
    await p.mouse.up();
  };
  for (const [from, to] of [[320, 150], [150, 300], [300, 120], [120, 280], [280, 130], [130, 310]]) {
    // Clear any notice first, or its scrim eats the flick's press instead of
    // the dial getting it — which is what a driver does anyway.
    await p.mouse.click(196, 300);
    await p.waitForTimeout(60);
    await flick(from, to);
    // LONG ENOUGH TO LAND, SHORT ENOUGH TO OVERLAP, and both halves of that
    // were learned the hard way. The needle takes ~340ms to settle after the
    // finger lifts and only THEN changes station, and a new drag cancels a
    // settle in progress — so flicking again too soon means the station never
    // changed and there is nothing to stack. But a station change waits 900ms
    // of deliberate silence before it touches the music, so flicking again too
    // late means the chains never overlap either. The window is in between.
    await p.waitForTimeout(380);
  }
  await p.waitForTimeout(9000);

  // Still interactive? A swallowed-touch freeze shows up as a tap that does
  // nothing, so this asks the app to change something visible and checks.
  await p.mouse.click(40, 118);
  await p.waitForTimeout(1200);
  const chevron = await p.evaluate(() => {
    for (const e of document.querySelectorAll('*')) {
      if (e.children.length === 0 && (e.textContent || '').trim() === 'YOU’RE LISTENING TO') {
        let n = e, o = 1;
        while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity || '1'); n = n.parentElement; }
        return Number(o.toFixed(2));
      }
    }
    return null;
  });

  const interactive = chevron !== null && chevron > 0.9;
  if (!interactive) await p.screenshot({ path: '/tmp/tuner-sweep-fail.png' }).catch(() => {});
  // Four flicks, and the station only settles on the last one — so a couple of
  // requests is the honest ceiling for one conversation, and one per flick is
  // the shape of the bug.
  console.log(`${interactive ? 'ok  ' : 'FAIL'} still interactive after the sweep (chrome opacity ${chevron})`);
  if (!interactive) problems.push(`app did not respond after the sweep (opacity ${chevron})`);
} catch (e) {
  problems.push(String(e).slice(0, 160));
  console.log('FAIL', String(e).slice(0, 160));
}

await ctx.close();
await b.close();
console.log(problems.length ? `\n  ${problems.length} problem(s):\n   ${problems.join('\n   ')}\n`
  : '\n  the app survives a burst of tuning and still answers\n');
process.exit(problems.length ? 1 : 0);
