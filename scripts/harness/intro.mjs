// THE "WHAT IS THIS APP" SHEET — shown ONCE, to everybody.
//
// Built 29.08 after a listener in Belgium installed the app successfully and
// then asked what it was supposed to do on top of Apple Music. He was the
// second person to reach the app and not get the idea, so it is an onboarding
// gap rather than a him problem.
//
// THE ASSERTION THAT MATTERS MOST is the second one: that this sheet is NOT
// on screen at the same time as the platform sheet. Both are Modals, and iOS
// will not reliably stack a second Modal over the first — it presents nothing
// and swallows every touch, which is the trap PreviewGate (24.07) and the
// mood sheet (03.08) each fell into, and which a browser CANNOT reproduce.
// So this check cannot prove the app is safe on a phone; what it can do is
// prove the two are never asked to be visible together, which is the thing
// the code actually controls.
//
// The third case is the owner's specific ask — "I also would like it shipped
// to those who have the app already" — which is why the flag records HAVING
// SEEN IT rather than a first launch: an existing user has no such key, so
// the update carries the explanation to them once.
//
// Needs the web build running: npx expo start --web --port 8081
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs node scripts/harness/intro.mjs

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const B = process.env.BASE_URL || 'http://localhost:8081';
let fails = 0;
const ok = (n, good, extra='') => { console.log(good?'  ok   '+n:'  FAIL '+n+' '+extra); if(!good) fails++; };
const b = await chromium.launch();

// ---------- 1. BRAND NEW USER: platform sheet first, THEN the explainer ----------
{
  const p = await b.newPage({ viewport:{width:393,height:852} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B,{waitUntil:'networkidle'}); await p.waitForTimeout(3200);

  const t1 = await p.evaluate(()=>document.body.innerText);
  ok('platform sheet comes first', /Connect Your Music/i.test(t1));
  ok('the explainer is NOT stacked over it', !/Stations are moods/i.test(t1),
     'both modals on screen at once = the documented iOS trap');
  await p.screenshot({path:'/tmp/intro-1-platform.png'});

  const skip = p.locator('text=/Skip for now/i').first();
  if (await skip.count()) { await skip.click(); await p.waitForTimeout(2200); }

  const t2 = await p.evaluate(()=>document.body.innerText);
  ok('explainer appears after the platform question', /Stations are moods/i.test(t2));
  ok('...and says what the app is', /wraps it/i.test(t2) && /screen becomes the music/i.test(t2));
  await p.screenshot({path:'/tmp/intro-2-dark.png'});

  // dismiss
  await p.getByText("Got it", {exact:true}).first().click().catch(async()=>{
    await p.locator("text=/Got it/i").last().click();
  });
  await p.waitForTimeout(1500);
  const t3 = await p.evaluate(()=>document.body.innerText);
  ok('dismisses to the home page', !/Stations are moods/i.test(t3));
  await p.screenshot({path:'/tmp/intro-3-after.png'});

  // reload — must NOT come back
  await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(3000);
  const t4 = await p.evaluate(()=>document.body.innerText);
  ok('never returns once seen', !/Stations are moods/i.test(t4));
  ok('no page errors', errs.length===0, errs.join(' | '));
  await p.close();
}

// ---------- 2. EXISTING USER: platform already chosen, sees it once ----------
{
  const p = await b.newPage({ viewport:{width:393,height:852} });
  await p.addInitScript(()=>{ localStorage.setItem('cruisefm_platform','appleMusic'); });
  await p.goto(B,{waitUntil:'networkidle'}); await p.waitForTimeout(3200);
  const t = await p.evaluate(()=>document.body.innerText);
  ok('an EXISTING user gets it too (no platform sheet first)',
     /Stations are moods/i.test(t) && !/Connect Your Music/i.test(t));
  await p.close();
}

// ---------- 3. LIGHT THEME ----------
{
  const p = await b.newPage({ viewport:{width:393,height:852} });
  await p.addInitScript(()=>{
    localStorage.setItem('cruisefm_platform','appleMusic');
    localStorage.setItem('cruise_appearance','light');
  });
  await p.goto(B,{waitUntil:'networkidle'}); await p.waitForTimeout(3200);
  const t = await p.evaluate(()=>document.body.innerText);
  ok('renders in light theme', /Stations are moods/i.test(t));
  await p.screenshot({path:'/tmp/intro-4-light.png'});
  await p.close();
}

console.log(fails?`\n  ${fails} problem(s)\n`:'\n  the explainer shows once, to everyone, after the platform question\n');
await b.close();
process.exit(0);
