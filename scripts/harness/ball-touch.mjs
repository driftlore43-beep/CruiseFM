// The mirror ball's three gestures. Owner, 19.08: "the mirror ball just keeps
// animating when i swipe across it. It doesn't pause when you tap on it
// either."
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/ball-touch.mjs
//
// The ball declined the touch on START and only claimed a sideways MOVE, so
// a TAP was never seen at all (the record and the disc both toggle play), and
// the root sniffer's wake slid the scene out from under a swipe mid-drag —
// the fault fixed for Vinyl and CD on 18.08 and missed here.
//
// THREE OUTCOMES, and each is checked against a control so none can pass
// vacuously:
//   tap       toggles play — asserted by the transport's own state flipping
//   swipe     turns the ball AND moves the song — the elapsed time must
//             change, or a "working" swipe could just be spinning nothing
//   pulldown  still dismisses — claiming on start is exactly how that gets
//             lost, so it is the regression this file exists to catch
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
  localStorage.setItem('cruisefm_platform', 'none');
  // Past the one-off "what is this app" sheet, the same way this seeds
  // past the platform sheet above. scripts/harness/intro.mjs owns that
  // sheet; every other harness would otherwise run with a Modal over
  // the app, which is how a harness passes while testing nothing.
  localStorage.setItem('cruisefm_intro_seen', '1');
  localStorage.setItem('cruise_appearance', 'dark');
});
const p = await ctx.newPage();
p.on('pageerror', (e) => problems.push(`page error: ${e.message}`));

await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.waitForTimeout(14000);
const skip = p.locator('text=Skip for now');
if (await skip.count()) { await skip.click({ force: true }); await p.waitForTimeout(2500); }

await p.getByText('MODES', { exact: true }).last().click({ force: true });
await p.waitForTimeout(2000);
await visibleClicker(p)('Mirror Ball');
await p.waitForTimeout(2500);
await p.getByText('Night Run AM', { exact: true }).last().click({ timeout: 20000 });
await answerOffAir(p);
await p.waitForTimeout(4000);
// Wake the chrome by tapping clear of the ball, so the first real gesture is
// judged awake rather than spending itself on the wake.
await p.mouse.click(40, 118);
await p.waitForTimeout(1500);

/** The mode is open iff its "YOU'RE LISTENING TO" eyebrow is on screen. */
const modeOpen = () => p.evaluate(() => {
  for (const e of document.querySelectorAll('*')) {
    if (e.children.length === 0 && (e.textContent || '').trim() === 'YOU’RE LISTENING TO') return true;
  }
  return false;
});

/** Whether the transport is showing PAUSE bars (playing) or a play triangle. */
const isPlaying = () => p.evaluate(() => {
  // The pause control is drawn as two small bars; the play state as one
  // triangle. Count the small solid white rects inside the round button.
  const btns = [...document.querySelectorAll('div')].filter((d) => {
    const r = d.getBoundingClientRect();
    const cs = getComputedStyle(d);
    return r.width > 60 && r.width < 100 && Math.abs(r.width - r.height) < 6
      && parseFloat(cs.borderTopLeftRadius) > 20;
  });
  if (!btns.length) return null;
  const btn = btns[btns.length - 1];
  const bars = [...btn.querySelectorAll('div')].filter((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 4 && r.width < 16 && r.height > 18 && r.height < 40;
  });
  return bars.length >= 2;
});

const elapsed = () => p.evaluate(() => {
  for (const e of document.querySelectorAll('*')) {
    if (e.children.length === 0 && /^\d+:\d{2}$/.test((e.textContent || '').trim())) {
      return (e.textContent || '').trim();
    }
  }
  return null;
});

const W = 393, cx = W / 2, cy = 852 * 0.42;

// ── TAP ────────────────────────────────────────────────────────────────
const playBefore = await isPlaying();
await p.mouse.click(cx, cy);
await p.waitForTimeout(1400);
const playAfter = await isPlaying();
const tapWorked = playBefore !== null && playAfter !== null && playBefore !== playAfter;
console.log(`${tapWorked ? 'ok  ' : 'FAIL'} tap toggles play      ${playBefore} -> ${playAfter}`);
if (!tapWorked) problems.push(`tap did not toggle play (${playBefore} -> ${playAfter})`);

// Put it back to playing so the swipe has a moving song under it.
if (playAfter === false) { await p.mouse.click(cx, cy); await p.waitForTimeout(1200); }

// ── SWIPE ──────────────────────────────────────────────────────────────
// THE WEB BUILD HAS NO SPOTIFY, so there is no track, no seek bar and no
// elapsed time — the first version of this check read them and got null on
// both sides, which is a measurement failing rather than a passing test.
//
// What CAN be measured without a track is the half the owner actually
// described: "the mirror ball just keeps animating when i swipe across it",
// i.e. the surface ignoring the finger. While a finger owns the ball its own
// turn is suspended, so:
//
//   idle      two frames a beat apart DIFFER — the ball turns on its own
//   held      finger down and still: two frames are the SAME — the drag took
//             the ball over and stopped the auto-turn
//   dragged   moving the finger CHANGES the surface — it tracks the drag
//
// "held" alone could pass on a frozen ball, and "idle" alone could pass on a
// ball that ignores touch entirely; the three together can only pass if the
// finger genuinely owns the surface.
//
// HOW THIS USED TO BE MEASURED, AND WHY IT IS NOT ANY MORE (28.09).
// It compared two SCREENSHOTS of the ball's box a beat apart, idle against
// dragged, and asserted a ratio. Two earlier attempts had already failed by
// assuming some part of the picture is quiet — and so did this one, more
// slowly: the box also holds glitter, fireflies and light beams, each on its
// own clock, so most of the "noise" was other components and the ratio
// wandered with the machine's load. It failed three sweeps running on a ball
// whose gesture code had not been touched since 14.09 (`64a644e`), which is
// the shape of an instrument fault rather than a bug. Reading the full-size
// layers' opacities was rejected at the time for catching nine layers rather
// than six — true, and the fix is to identify the six by an invariant only
// they have, which is what the code below does.
//
// READ THE BALL, DO NOT PHOTOGRAPH THE ROOM.
//
// The ball's rotation is READABLE DIRECTLY. It is a flipbook: six grids
// cross-faded, and their opacities always sum to exactly 1, which is what
// identifies them among everything else on the screen. Nothing else in the
// room contributes to that vector, so there is no noise to out-shout.
//
// That also makes the THIRD case measurable, which the old method could not
// manage — and it is the one that actually proves the finger owns the ball:
//
//   idle        the vector travels        — the ball turns on its own
//   held still  the vector STOPS DEAD     — a claimed wind suspends the turn
//   moving      the vector travels again  — it follows the finger
//
// Measured in small steps and summed, so a step can never carry the ball
// far enough for the six-frame cycle to alias back onto itself.
const ballVec = () => p.evaluate(() => {
  for (const par of document.querySelectorAll('*')) {
    const kids = [...par.children];
    if (kids.length !== 6) continue;
    const ops = kids.map((k) => parseFloat(getComputedStyle(k).opacity));
    if (ops.some(Number.isNaN)) continue;
    const s = ops.reduce((a, b) => a + b, 0);
    if (s > 0.97 && s < 1.03) return ops;
  }
  return null;
});

// If the flipbook cannot be found at all, say so — a check that quietly
// measures nothing is worse than one that fails.
const found = await ballVec();

const travel = async (ms, step = 16) => {
  let prev = await ballVec(), total = 0, reads = 0;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await p.waitForTimeout(step);
    const v = await ballVec();
    if (prev && v) { total += v.reduce((a, x, i) => a + Math.abs(x - prev[i]), 0); reads++; }
    prev = v;
  }
  return { total: +total.toFixed(3), reads };
};

const idle = await travel(600);

// Claim the wind: press, then move far enough to be judged a turn rather
// than a tap or a pull-down, and then HOLD STILL.
await p.mouse.move(cx, cy);
await p.mouse.down();
await p.mouse.move(cx + 25, cy, { steps: 4 });
await p.waitForTimeout(250);
const held = await travel(600);

// Still holding, now genuinely moving the whole time.
let prev = await ballVec(), moving = 0, x = cx + 25, dir = 1;
const until = Date.now() + 600;
while (Date.now() < until) {
  x += dir * 14;
  if (x > cx + 95 || x < cx - 95) dir = -dir;
  await p.mouse.move(x, cy);
  const v = await ballVec();
  if (prev && v) moving += v.reduce((a, q, i) => a + Math.abs(q - prev[i]), 0);
  prev = v;
}
await p.mouse.up();
await p.waitForTimeout(1200);

const idleMoves    = !!found && idle.reads > 10 && idle.total > 1;
const handsOver    = held.total < idle.total * 0.15;   // a claimed wind stops the turn
const tracksFinger = moving > 1 && moving > held.total * 4;

console.log(`     ball turn: idle ${idle.total}  held-still ${held.total}  moving ${moving.toFixed(3)}`);
const swipeWorked = idleMoves && handsOver && tracksFinger;
console.log(`${swipeWorked ? 'ok  ' : 'FAIL'} swipe turns the ball  idle-moves ${idleMoves}  hands-over ${handsOver}  tracks-finger ${tracksFinger}`);
if (!found) problems.push('the flipbook\'s six frames were not found — this check measured nothing');
if (!swipeWorked) problems.push(`swipe: idleMoves ${idleMoves}, handsOver ${handsOver}, tracksFinger ${tracksFinger}`);

// The song-position half needs a real track, which this build cannot have.
const t = await elapsed();
console.log(`     (song position not checked here — no track in the web build: elapsed ${t})`);

// ── PULL DOWN ──────────────────────────────────────────────────────────
// THE REGRESSION GUARD. Claiming the touch on start is exactly how a mode
// loses its pull-to-dismiss, so this must still work from ON the ball.
const openBefore = await modeOpen();
await p.mouse.move(cx, cy);
await p.mouse.down();
for (let i = 0; i < 14; i++) { await p.mouse.move(cx, cy + (i + 1) * 16); await p.waitForTimeout(35); }
await p.mouse.up();
await p.waitForTimeout(1800);
const openAfter = await modeOpen();
const dismissWorked = openBefore === true && openAfter === false;
console.log(`${dismissWorked ? 'ok  ' : 'FAIL'} pull-down dismisses   open ${openBefore} -> ${openAfter}`);
if (!dismissWorked) problems.push(`pull-down did not dismiss (open ${openBefore} -> ${openAfter})`);

await ctx.close();
await b.close();
console.log(problems.length ? '\nPROBLEMS:\n  ' + problems.join('\n  ') : '\ntap, swipe and pull-down all behave');
process.exit(problems.length ? 1 : 0);
