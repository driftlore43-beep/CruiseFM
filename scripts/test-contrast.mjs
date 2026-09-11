// Find text nobody can read, on every page, in both themes.
//
// Run it against a live `npx expo start --web` on :8081. It exists because a
// light theme fails SILENTLY — white type on white paper throws nothing and
// shows up in no diff. Both times it happened on 13.08 the owner found it on
// her phone, which is the wrong instrument.
//
// KNOWN AND DELIBERATE FALSE POSITIVE: the Stations hero. Its type sits over a
// photograph laid in as an absolutely-positioned SIBLING, which an ancestor
// walk cannot see, so the probe measures white against the page's paper and
// reports the biggest headline on the page as unreadable. Verified by pixel
// instead. If you make the hero's backdrop a real ancestor one day, this
// disappears by itself.
import fs from 'node:fs';

// Playwright is not a dependency of the app — it is only ever used by harnesses
// like this one — so resolve it politely and say what to do rather than dying
// with a module-not-found stack.
let chromium;
try {
  // NODE_PATH does not apply to ESM imports, so an install that lives outside
  // the project has to be pointed at directly.
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'));
} catch {
  console.error(
    'This check drives a real browser and needs Playwright.\n' +
    '  npm i -D playwright\n' +
    '  ...or point at an existing install:\n' +
    '  PLAYWRIGHT_MODULE=/abs/path/to/node_modules/playwright/index.mjs node scripts/test-contrast.mjs\n' +
    'It also needs the web build running:  npx expo start --web --port 8081\n' +
    '(a different port? set BASE_URL=http://localhost:<port>)'
  );
  process.exit(2);
}
// The web build's port varies when another instance is already running; the
// default keeps every existing invocation working unchanged.
const BASE = (process.env.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const PROBE = fs.readFileSync(new URL('./contrast-probe.js', import.meta.url), 'utf8');
const PAGES = [['', 'Cruise'], ['stations', 'Stations'], ['modes', 'Modes'], ['profile', 'Profile']];
const SCROLLS = [0, 700, 1500];

// The pre-installed browser; PLAYWRIGHT_BROWSERS_PATH points here too.
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const report = [];
for (const theme of ['light', 'dark']) {
  for (const [route, name] of PAGES) {
    const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript((t) => {
      window.localStorage.setItem('cruisefm_platform', 'none');
      // Past the one-off intro sheet; scripts/harness/intro.mjs owns that.
      window.localStorage.setItem('cruisefm_intro_seen', '1');
      window.localStorage.setItem('cruise_appearance', t);
    }, theme);
    await p.goto(BASE + '/' + route, { waitUntil: 'networkidle' });
    await p.waitForTimeout(6500);
    await p.addScriptTag({ content: PROBE });
    const seen = new Map();
    for (const y of SCROLLS) {
      if (y) { await p.mouse.move(196, 500); await p.mouse.wheel(0, y - (SCROLLS[SCROLLS.indexOf(y) - 1] || 0)); await p.waitForTimeout(700); }
      const hits = await p.evaluate(() => window.__contrast({ min: 2.6 }));
      for (const h of hits) if (!seen.has(h.text)) seen.set(h.text, h);
    }
    report.push({ theme, name, errs, hits: [...seen.values()] });
    await p.close();
  }
}
await b.close();

let bad = 0;
for (const r of report) {
  const flag = r.hits.length ? 'CHECK' : 'ok   ';
  console.log(`  ${flag} ${r.theme.padEnd(5)} ${r.name.padEnd(9)} errors ${r.errs.length}  low-contrast ${r.hits.length}`);
  for (const h of r.hits) {
    bad++;
    console.log(`         ${String(h.ratio).padStart(5)}:1  "${h.text}"  ${h.color} on ${h.bg} @${h.size}`);
  }
  if (r.errs.length) console.log('         ERR ' + r.errs.slice(0, 2).join(' | '));
}
console.log(bad === 0 ? '\n  no unreadable text found' : `\n  ${bad} to look at`);
