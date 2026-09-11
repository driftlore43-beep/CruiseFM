// Does every mode's chrome rest, wake, and know when NOT to?
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/rest.mjs
//
// The feature is that after six untouched seconds of playback the controls
// fade and the scene is left alone (owner, 18.08). Three things have to hold
// in all eight modes, and a mode can pass two of them while failing the third:
//
//   awake   the controls are there
//   paused  they are STILL there after six seconds — hiding the play button
//           from someone who just pressed pause is the one case this must not
//           cover, and it is the easiest one to break by accident
//   rested  gone after six seconds of playback
//   woken   a tap anywhere brings them straight back
//
// IT MEASURES THE EYEBROW'S COMPOSITED OPACITY, walking the ancestor chain,
// rather than asking whether an element exists — the whole mechanism is
// opacity, so a presence check would pass on every mode whether it worked or
// not. It has already earned that: Cassette passed awake and rested and failed
// `woken`, because its portrait root was missing the touch sniffer that brings
// the chrome back. Nothing else in the suite would have caught it.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
import { answerOffAir, visibleClicker } from './visible.mjs';
const MODES = ['Equalizer','Cassette','Vinyl','Tuner','Horizon','Circular EQ','Mirror Ball','CD'];
const b = await chromium.launch({ args:['--no-sandbox'] });
const problems = [];
for (const MODE of MODES) {
  const ctx = await b.newContext({ viewport:{width:393,height:852} });
  await ctx.addInitScript(()=>{ localStorage.setItem('cruisefm_platform','none'); localStorage.setItem('cruise_appearance','dark');
    // Past the one-off intro sheet; scripts/harness/intro.mjs owns that.
    localStorage.setItem('cruisefm_intro_seen','1'); });
  const p = await ctx.newPage();
  p.on('pageerror',e=>problems.push(`${MODE}: page error ${e.message}`));
  try {
    await p.goto(BASE,{waitUntil:'domcontentloaded',timeout:240000});
    await p.waitForTimeout(14000);
    const skip = p.locator('text=Skip for now');
    if (await skip.count()) { await skip.click({force:true}); await p.waitForTimeout(2500); }
    await p.getByText('MODES',{exact:true}).last().click({force:true});
    await p.waitForTimeout(2000);
    await visibleClicker(p)(MODE); await p.waitForTimeout(2500);
    await p.getByText('Night Run AM',{exact:true}).last().click({timeout:20000});
    await answerOffAir(p);
    await p.waitForTimeout(3000);
    await p.mouse.click(40,118); await p.waitForTimeout(1500);
    // The eyebrow is the tell: present awake, gone at rest, back on a tap.
    const vis = async () => p.evaluate(()=>{
      for (const e of document.querySelectorAll('*')) if (e.children.length===0 &&
        (e.textContent||'').trim()==='YOU’RE LISTENING TO') {
        let n=e, o=1;
        while (n && n!==document.body) { const s=getComputedStyle(n); o*= parseFloat(s.opacity||'1'); n=n.parentElement; }
        return Number(o.toFixed(2));
      }
      return null;
    });
    const awake = await vis();
    // A PAUSED DRIVE MUST NOT REST. Hiding the play button from someone who
    // just pressed pause is the one case this whole feature must not cover.
    await p.mouse.click(196, 697);          // the transport's play/pause
    await p.waitForTimeout(10000);
    const paused = await vis();
    await p.mouse.click(196, 697);          // play again
    await p.waitForTimeout(1200);
    await p.waitForTimeout(10000);
    const rested = await vis();
    await p.mouse.click(196, 430);
    await p.waitForTimeout(1600);
    const woken = await vis();
    const ok = awake > 0.9 && paused > 0.9 && rested !== null && rested < 0.05 && woken > 0.9;
    console.log(`${ok?'ok  ':'FAIL'} ${MODE.padEnd(12)} awake ${awake}  paused ${paused}  rested ${rested}  woken ${woken}`);
    if (!ok) problems.push(`${MODE}: awake ${awake} paused ${paused} rested ${rested} woken ${woken}`);
  } catch (e) { problems.push(`${MODE}: ${String(e).slice(0,100)}`); console.log('FAIL', MODE, String(e).slice(0,80)); }
  await ctx.close();
}
await b.close();
console.log(problems.length ? '\nPROBLEMS:\n'+problems.join('\n') : '\nall eight rest and wake');
process.exit(problems.length?1:0);
