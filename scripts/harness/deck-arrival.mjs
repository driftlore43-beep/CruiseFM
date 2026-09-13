// THE PAGE MUST NOT SHOW WHILE A DECK IS ARRIVING.
//
//   npx expo start --web --port 8099
//   BASE_URL=http://localhost:8099 \
//     PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright-core/index.mjs \
//     CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome \
//     node scripts/harness/deck-arrival.mjs
//
// Every mode presents in a TRANSPARENT Modal and slides its own content up
// from the bottom, and the content carries the dark background — so until it
// arrives the window really is transparent and the page underneath shows
// through. That quarter-second of stations list was visible in the owner's
// own App Store preview footage (13.09), on entry and again on every mode
// switch.
//
// NowPlayingHost holds an opaque veil for the length of the entrance. This
// checks the two halves of that: it is there while the deck arrives, and it
// is GONE soon after — a veil that outstayed its welcome would hide the page
// during a pull-down dismiss, which is the affordance that makes the gesture
// discoverable.
//
// WHAT THIS CANNOT TELL YOU: react-native-web renders a Modal as a div in the
// same document rather than as its own transparent window, so the flash
// itself does not exist here to be caught. A pixel probe read identical
// numbers before and after the fix — which meant it was measuring nothing,
// not that the fix did nothing. This checks the MECHANISM, and the fault
// itself can only be confirmed on a phone.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const b = await chromium.launch({ args:['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await b.newContext({ viewport:{width:428,height:926}, deviceScaleFactor:1 });
await ctx.addInitScript(()=>{['cruisefm_platform','cruisefm_intro_seen','cruise_appearance','cruisefm_session_kind']
  .forEach((k,i)=>localStorage.setItem(k,['none','1','dark','listening'][i]));});
const p = await ctx.newPage();
const read = () => p.evaluate(() => {
  const e = document.querySelector('[data-testid="deck-arrival-veil"]');
  if (!e) return null;
  return +parseFloat(getComputedStyle(e).opacity).toFixed(2);
});
await p.goto(`${BASE}/drive?station=night-run&mode=vinyl`,{waitUntil:'domcontentloaded',timeout:240000});
// The deck opens a beat after the page settles; sample from the moment the
// veil first exists.
let t0 = null;
for (let i = 0; i < 400; i++) {
  const v = await read();
  if (v !== null) { t0 = Date.now(); break; }
  await p.waitForTimeout(60);
}
if (t0 === null) { console.log('veil never appeared'); await b.close(); process.exit(1); }
const marks = [];
for (let i = 0; i < 16; i++) {
  marks.push([Date.now() - t0, await read()]);
  await p.waitForTimeout(70);
}
for (const [ms, v] of marks) console.log(`  ${String(ms).padStart(4)}ms  opacity ${v}`);

// The two properties, asserted rather than eyeballed.
const held = marks.filter(([ms]) => ms <= 300).every(([, v]) => v === 1);
const cleared = marks.filter(([ms]) => ms >= 800).every(([, v]) => v === 0);
const fails = [];
if (!held) fails.push('the veil is not opaque while the deck is still arriving');
if (!cleared) fails.push('the veil is still up long after the deck landed — it would hide the page during a dismiss');
console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\n  the page is covered while a deck arrives, and uncovered once it has');
await b.close();
process.exit(fails.length ? 1 : 0);
