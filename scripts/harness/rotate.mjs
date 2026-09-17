// TURN AN iPAD AND SEE WHETHER ANYTHING IS LEFT BEHIND.
//
//   npx expo start --web --port 8099
//   BASE_URL=http://localhost:8099 \
//     PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome \
//     node scripts/harness/rotate.mjs
//
// WHY THIS EXISTS: nobody here has an iPad, and the fault it catches is
// invisible in a single screenshot. A layout number read once from
// `Dimensions.get('window')` at module load is correct until the device turns
// and wrong for ever after — the Equalizer's whole bar row was sized that way,
// and so were the station page's mode grid, the mood sheet's exit, the create
// sheet's own height cap and the settings back-swipe. Each of those looks
// perfect until you rotate.
//
// WIDTH IS THE SIGNAL, NOT HEIGHT. A page's scroll content is MEANT to be
// taller than the window, so flagging height made all four pages look broken
// on the first run. Nothing in this app scrolls sideways, so anything wider
// than the window is a layer still sized for the other orientation.
//
// TRANSPARENT LIGHT LAYERS ARE DELIBERATELY WIDER AND ARE NOT BUGS:
// AmbientGlow's haze runs past the screen edges on purpose (smoke has to fade
// out beyond the frame, or it ends in a straight line — see the 25.07
// bottom-seam entry), and the Vinyl deck's RecordBloom overshoots slightly at
// its largest size. They carry no text, which is how they are told apart from
// a layout that has genuinely gone wide.
//
// AND IT WAKES THE DECK BEFORE LOOKING. Every mode fades its chrome after ~6
// untouched seconds, so a probe that only waits photographs the rest state and
// reports a deck with no controls as a rotation bug. That cost a round.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const P = { width: 1032, height: 1376 }, L = { width: 1376, height: 1032 };
const b = await chromium.launch({ args:['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
const ctx = await b.newContext({ viewport: P, deviceScaleFactor: 1 });
await ctx.addInitScript(()=>{
  localStorage.setItem('cruisefm_platform','none');
  localStorage.setItem('cruisefm_intro_seen','1');
  localStorage.setItem('cruise_appearance','dark');
  localStorage.setItem('cruisefm_session_kind','listening');
  localStorage.setItem('cruise_vinyl_classic','true');
});
const p = await ctx.newPage();
p.on('pageerror', e => problems.push('page error: ' + e.message));
await p.goto(BASE, { waitUntil:'domcontentloaded', timeout:240000 });
await p.waitForTimeout(14000);
const skip = p.locator('text=Skip for now');
if (await skip.count()) { await skip.click({ force:true }); await p.waitForTimeout(2500); }

// Anything WIDER than the window after a turn is a layer still sized for the
// other orientation — the shape of every stale-Dimensions bug.
const overflow = async (tag) => {
  const vp = p.viewportSize();
  const bad = await p.evaluate(([w,h]) => {
    const out = [];
    for (const e of document.querySelectorAll('div,svg,img')) {
      const r = e.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      // HEIGHT OVERFLOW IS NORMAL — a page's scroll content is meant to be
      // taller than the window, and flagging it made every page look broken.
      // Width is the honest signal: nothing in this app scrolls sideways.
      if (r.width <= w + 2) continue;
      // A HORIZONTAL SCROLLER'S CONTENT IS MEANT TO BE WIDER THAN THE WINDOW.
      // The mode sheet's chip shelf is one (28.07), and the home page keeps
      // that sheet mounted, parked off-screen (19.08) — so its ~1000px chip
      // row is in the DOM on every page and is not an overflow of anything.
      // Skip anything inside an ancestor that scrolls sideways; a row that
      // is wider than the window with NO scroller around it is still caught.
      {
        let a = e.parentElement, scrolls = false;
        for (let i = 0; i < 6 && a; i++, a = a.parentElement) {
          const ox = getComputedStyle(a).overflowX;
          if (ox === 'auto' || ox === 'scroll') { scrolls = true; break; }
        }
        if (scrolls) continue;
      }
      // AND A TRANSPARENT LIGHT LAYER IS ALLOWED TO RUN OFF THE EDGE. Smoke
      // and glows are drawn past the frame ON PURPOSE — a haze that stops at
      // the screen edge ends in a straight line, which is the 25.07 bottom-seam
      // bug. They carry no text. Anything with WORDS in it that is wider than
      // the window is the real fault this looks for, so the two are separated
      // rather than the threshold being loosened until the run goes green —
      // a check nobody can ever get clean is one people learn to ignore.
      // 2.1x IS AmbientGlow's OWN WIDEST HAZE, not a number picked until the
      // run went green: `main` is drawn at 1.70x the screen and breathes up to
      // about 1.18, and getBoundingClientRect reports the scaled box. Read out
      // of that component rather than guessed, so if a layer ever exceeds this
      // it genuinely is sized for something other than this window.
      const empty = !(e.innerText || '').trim();
      if (empty && r.width <= w * 2.1) continue;
      {
        out.push(`${e.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} :: ${(e.innerText||'').slice(0,24).replace(/\n/g,'|')}`);
      }
    }
    return out.slice(0, 3);
  }, [vp.width, vp.height]);
  if (bad.length) problems.push(`${tag}: ${bad.join(' / ')}`);
  return bad.length === 0;
};

for (const [label, tab] of [['HOME','HOME'],['STATIONS','STATIONS'],['MODES','MODES'],['PROFILE','PROFILE']]) {
  await p.getByText(tab, { exact:true }).last().click({ force:true, timeout:8000 });
  await p.waitForTimeout(1500);
  await p.setViewportSize(L); await p.waitForTimeout(1800);
  const okL = await overflow(`${label} landscape`);
  await p.setViewportSize(P); await p.waitForTimeout(1800);
  const okP = await overflow(`${label} back to portrait`);
  console.log(`  ${label}: landscape ${okL?'ok':'OVERFLOW'} · back ${okP?'ok':'OVERFLOW'}`);
}

// And a deck, which is the one thing that presents in its own window.
await p.goto(`${BASE}/drive?station=sunset&mode=vinyl`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(9000);
// WAKE IT BEFORE LOOKING. Every deck fades its chrome after ~6 untouched
// seconds, so a rotation probe that only waits photographs the rest state and
// reports a deck with no controls as a rotation bug. (40,118) is above every
// mode's object and clear of the chevron.
await p.setViewportSize(L); await p.waitForTimeout(2200);
await p.mouse.click(40, 118); await p.waitForTimeout(1200);
if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/rot-deck-land.png` });
await p.setViewportSize(P); await p.waitForTimeout(2200);
await p.mouse.click(40, 118); await p.waitForTimeout(1200);
if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/rot-deck-port.png` });
const deckOk = await overflow('vinyl deck back to portrait');
console.log(`  VINYL deck: back to portrait ${deckOk?'ok':'OVERFLOW'}`);

console.log(problems.length ? '\nPROBLEMS:\n' + problems.map(x=>'  '+x).join('\n') : '\nnothing left behind by a rotation');
await b.close();
process.exit(problems.length ? 1 : 0);
