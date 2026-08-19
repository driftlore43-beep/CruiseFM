// Winding the deck must not bring the controls back.
//
//   npx expo start --web --port 8085
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     BASE_URL=http://localhost:8085 node scripts/harness/scrub-rest.mjs
//
// Owner, 18.08: "could we have the vinyl and CD not have the controls come
// back in when I try to scrub. It tends to move back up and then it acts like
// the page wants to move down." One cause, both halves: the root touch
// sniffer woke on ANY touch, waking slides the scene back to its awake
// position — under the finger — and the object moving relative to the thumb
// reads to the drag classifier as downward travel, so the card starts to
// dismiss.
//
// FOUR THINGS, and the last two are what stop this passing vacuously:
//   rested    the controls are away to begin with
//   mid-drag  still away while a finger is winding
//   after     still away when it lifts
//   tap       a plain TAP does bring them back — a drag is not the only way
//             to touch a deck, and losing tap-to-wake would be a worse bug
//   wound     the deck's own wind marker appeared, so the drag actually
//             reached the deck rather than being swallowed somewhere
//
// Verified against the broken version: with the wake fired straight from the
// root sniffer, mid-drag reads 1 and after reads 1.
let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error('Needs Playwright. PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs');
  process.exit(2);
}
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
import { answerOffAir, visibleClicker } from './visible.mjs';
const b = await chromium.launch({ args:['--no-sandbox'] });
const problems = [];
for (const MODE of ['Vinyl','CD']) {
  const ctx = await b.newContext({ viewport:{width:393,height:852} });
  await ctx.addInitScript(()=>{ localStorage.setItem('cruisefm_platform','none'); localStorage.setItem('cruise_appearance','dark'); });
  const p = await ctx.newPage();
  p.on('pageerror',e=>problems.push(`${MODE}: ${e.message}`));
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
  await p.mouse.click(40,118); await p.waitForTimeout(1200);

  const vis = async () => p.evaluate(()=>{
    for (const e of document.querySelectorAll('*')) if (e.children.length===0 &&
      (e.textContent||'').trim()==='YOU’RE LISTENING TO') {
      let n=e,o=1; while(n&&n!==document.body){o*=parseFloat(getComputedStyle(n).opacity||'1');n=n.parentElement;}
      return Number(o.toFixed(2));
    }
    return null;
  });
  // THE CONTROL. Without this the test could pass by the drag doing nothing
  // at all — the deck's own wind marker only appears once the gesture has
  // been judged a scrub, so it proves the touch reached the deck.
  const winding = async () => p.evaluate(()=>{
    for (const e of document.querySelectorAll('*')) if (e.children.length===0 &&
      /^[+-]\s?\d+\s?s$/.test((e.textContent||'').trim())) {
      let n=e,o=1; while(n&&n!==document.body){o*=parseFloat(getComputedStyle(n).opacity||'1');n=n.parentElement;}
      if (o > 0.5) return true;
    }
    return false;
  });

  await p.waitForTimeout(10000);
  const restedVis = await vis();

  // A DRAG on the deck: must wind, must NOT wake, must NOT move the scene.
  await p.mouse.move(196, 430);
  await p.mouse.down();
  
  for (let i=0;i<10;i++){ await p.mouse.move(196+(i+1)*11, 430+i*2); await p.waitForTimeout(45); }
  const midVis = await vis(); const wound = await winding();
  await p.mouse.up();
  await p.waitForTimeout(1200);
  const afterVis = await vis();

  // A TAP on the deck: must bring them back.
  await p.mouse.click(196, 430);
  await p.waitForTimeout(1400);
  const tapVis = await vis();

  const ok = restedVis < 0.05 && midVis < 0.05 && afterVis < 0.05 && tapVis > 0.9 && wound;
  console.log(`${ok?'ok  ':'FAIL'} ${MODE.padEnd(6)} rested ${restedVis}  mid-drag ${midVis}  after ${afterVis}  tap ${tapVis}  wound ${wound}`);
  if (!ok) problems.push(`${MODE}: rested ${restedVis} mid ${midVis} after ${afterVis} tap ${tapVis} wound ${wound}`);
  await ctx.close();
}
await b.close();
console.log(problems.length ? '\nPROBLEMS:\n'+problems.join('\n') : '\na drag leaves the controls alone; a tap brings them back');
process.exit(problems.length?1:0);
