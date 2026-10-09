/**
 * The App Store product page header — 3840 x 1646 (21:9), Apple's own size.
 *
 * Apple turned creative assets on 5 October 2026 and this is the one part of
 * the listing that can move while the trader paperwork holds Submit, because
 * creative assets are submitted and approved INDEPENDENTLY of an app version.
 * It displays on iOS 27 and iPadOS 27 only, and sits in ADDITION to the
 * screenshots rather than instead of them.
 *
 * THE DESIGN IS "C2", PICKED OFF A FIVE-WAY SHEET ON 09.10. Five phones in a
 * shallow arc, each showing a visibly different object, which is the app's
 * actual pitch; the Mirror Ball is centre and largest, so Apple's focal point
 * sits dead centre as its guidance asks. NO TEXT AT ALL, deliberately: Apple
 * requires an asset's text to be localised for every supported language, and
 * on a one-language listing with no translation budget that is an argument for
 * having none. The ground is the centre phone's OWN station blurred, so the
 * banner is one place rather than a collage.
 *
 * THE FOUR THAT LOST, so nobody re-proposes them:
 *   A  one phone, centred  — purest reading of "a single, clear idea", and it
 *      leaves two thirds of a 21:9 banner as blurred photograph.
 *   B  three phones        — the safe version; 20% margins, and it shows three
 *      of eight modes where five costs nothing extra.
 *   C  five, wide          — the striking one, and its outermost phones land
 *      about 8% from the edge once rotation is counted, against Apple's own
 *      warning about "unwanted clipping".
 *   D  words + one phone   — spends the banner on the app's name, in a
 *      stand-in font, and takes on the localisation rule for nothing.
 * C2 is C pulled inside a safe area: same five, smaller and tighter, landing
 * near 14% rather than 8%.
 *
 * WHY UPSCALING THE BACKDROP IS FINE AND UPSCALING A PHONE WOULD NOT BE: the
 * ground is assets/stations/blur/*, already gaussian-blurred, so there is no
 * detail for an upscale to lose. The sharp elements are 1284-wide screenshots
 * placed at 420-600px inside a 3840 banner, i.e. downscaled. Never the other
 * way round.
 *
 * JPEG, NOT PNG, AND THAT IS STRUCTURAL: Apple's spec says in as many words
 * that "images can't include alpha channels or transparency", and a browser
 * screenshot is RGBA by default. A JPEG cannot carry an alpha channel at all,
 * so the rule is satisfied by construction rather than by a check that has to
 * keep passing. The 21:9 size accepts .jpeg/.jpg/.png; only the 16:9
 * 5244x2950 is PNG-only. Quality is measured against a lossless render below,
 * because this image is mostly smooth dark gradient, which is JPEG's worst
 * case for banding.
 *
 *   node scripts/marketing/header.mjs
 *   PLAYWRIGHT_MODULE=<scratchpad>/node_modules/playwright-core/index.mjs ...
 *   REF=1 node scripts/marketing/header.mjs   # also write the lossless PNG
 */
import fs from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const OUT  = `${ROOT}/screenshots-header`;
fs.mkdirSync(OUT, { recursive: true });

// Rendered at half size with deviceScaleFactor 2, which lands on 3840x1646
// exactly rather than near it.
const W = 1920, H = 823;

const shot = f => 'data:image/jpeg;base64,' +
  fs.readFileSync(`${ROOT}/screenshots-appstore/${f}.jpg`).toString('base64');
const ground = f => 'data:image/jpeg;base64,' +
  fs.readFileSync(`${ROOT}/assets/stations/blur/${f}.jpg`).toString('base64');

// The five, outside in. Each is a different OBJECT — tape, disc, ball, record,
// sun — rather than five of the same thing in different colours, which is the
// whole reason this says more than a screenshot row does.
const FAN = [
  { file: '05-cassette-daylight',  cls: 'm1' },
  { file: '06-cd-coastal',         cls: 'm2' },
  { file: '01-mirrorball-downtown',cls: 'm3' },  // centre, largest, focal point
  { file: '02-vinyl-sunset',       cls: 'm4' },
  { file: '04-horizon-afterhours', cls: 'm5' },
];
const GROUND = 'downtown';   // the centre phone's own station

const html = `<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#07070c}
  .bg{position:absolute;inset:0}
  .bg img{width:100%;height:100%;object-fit:cover}
  /* Two layers, not one: a flat wash so the phones read against anything the
     photograph happens to be doing, and a vignette so the 21:9 edges fall away
     instead of ending. A single scrim does one job or the other, never both. */
  .wash{position:absolute;inset:0;background:rgba(5,5,11,.52)}
  .vig{position:absolute;inset:0;background:
    radial-gradient(118% 92% at 50% 48%, rgba(5,5,11,0) 24%, rgba(5,5,11,.62) 72%, rgba(5,5,11,.92) 100%)}
  .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:22px}
  .ph{border-radius:38px;padding:7px;background:linear-gradient(160deg,#2b2b36,#0b0b11 40%,#1b1b24);
      box-shadow:0 40px 90px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.1)}
  .ph img{display:block;width:100%;border-radius:31px}
  /* Widths and leans step down from the centre, and the outer pair drop
     furthest, which is what keeps five phones reading as one object instead of
     a row of thumbnails. */
  .ph{width:210px}
  .ph.m1{transform:rotate(-7deg) translateY(44px)}
  .ph.m2{width:250px;transform:rotate(-4deg) translateY(16px)}
  .ph.m3{width:300px;z-index:2}
  .ph.m4{width:250px;transform:rotate(4deg) translateY(16px)}
  .ph.m5{transform:rotate(7deg) translateY(44px)}
</style>
<div class="bg"><img src="${ground(GROUND)}"></div>
<div class="wash"></div><div class="vig"></div>
<div class="stage">${FAN.map(p =>
  `<div class="ph ${p.cls}"><img src="${shot(p.file)}"></div>`).join('')}</div>`;

const br = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const p = await (await br.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
})).newPage();
await p.setContent(`<!doctype html><meta charset="utf-8">${html}`, { waitUntil: 'load' });
await p.waitForTimeout(400);

const jpg = `${OUT}/product-page-header.jpg`;
await p.screenshot({ path: jpg, type: 'jpeg', quality: 96 });
if (process.env.REF) await p.screenshot({ path: `${OUT}/product-page-header-ref.png` });

// Measure what is actually on disk rather than what was asked for. A JPEG's
// SOF0 marker carries its real dimensions; if Apple ever rejects this, the
// first question is whether the file is the size the slot wants.
const buf = fs.readFileSync(jpg);
let w = 0, h = 0;
for (let i = 2; i < buf.length - 9;) {
  if (buf[i] !== 0xff) { i++; continue; }
  const m = buf[i + 1];
  if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
    h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break;
  }
  i += 2 + buf.readUInt16BE(i + 2);
}
const ok = w === 3840 && h === 1646;
console.log(`${jpg}  ${w}x${h}  ${(buf.length / 1048576).toFixed(2)} MB  ${ok ? 'OK' : 'WRONG SIZE'}`);
if (!ok) process.exitCode = 1;

await br.close();
