// Render the widget mockup sheet.
//
//   OUT=/tmp/widgets.html python3 docs/design/v3.py
//   PLAYWRIGHT_MODULE=/abs/path/node_modules/playwright/index.mjs \
//     IN=/tmp/widgets.html OUT=/tmp/widgets.png node docs/design/shot4.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const IN = process.env.IN || '/tmp/widgets.html';
const OUT = process.env.OUT || '/tmp/widgets.png';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1560, height: 1700 }, deviceScaleFactor: 1 });
await p.goto('file://' + IN, { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT, fullPage: true });
await b.close();
console.log('wrote ' + OUT);
