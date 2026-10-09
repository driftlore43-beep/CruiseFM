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
 * PNG, AND THE REASON IS A CORRECTION RATHER THAN A PREFERENCE (09.10, same
 * day): this shipped as a JPEG first, on the strength of Apple's own help
 * page, which lists the 21:9 size's supported extensions as ".jpeg, .jpg, or
 * .png" and reserves PNG-only for the 16:9 5244x2950. THE UPLOAD SLOT REFUSED
 * IT — "file has an invalid extension" — so App Store Connect contradicts its
 * own documentation here, and two independent write-ups report the identical
 * split (the help page says JPEG, the live catalog says PNG only). THE SLOT IS
 * THE AUTHORITY AND THE DOCUMENTATION IS NOT, which is this repo's own oldest
 * lesson arriving at a new door: when a conclusion reasoned from a spec is
 * contradicted by the actual output, the output wins and the spec gets a note.
 *
 * WHICH MOVES THE ALPHA RULE FROM STRUCTURAL TO ENFORCED, and that is worth
 * saying plainly. Apple's spec says "images can't include alpha channels or
 * transparencies"; a JPEG cannot carry one at all, so that was satisfied by
 * construction, whereas a browser screenshot is RGBA BY DEFAULT. So the frame
 * is flattened to RGB unconditionally after it is written, and the colour type
 * is then read back out of the PNG's own IHDR with a NON-ZERO EXIT if it is
 * anything but 2. Unconditional, so there is no branch to skip; and gating the
 * build rather than warning, so it cannot quietly rot.
 *
 *   node scripts/marketing/header.mjs
 *   PLAYWRIGHT_MODULE=<scratchpad>/node_modules/playwright-core/index.mjs ...
 *   REF=1 node scripts/marketing/header.mjs   # also keep an unflattened copy
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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

const png = `${OUT}/product-page-header.png`;
await p.screenshot({ path: png });
if (process.env.REF) await p.screenshot({ path: `${OUT}/product-page-header-ref.png`, type: 'png' });

// FLATTEN TO RGB UNCONDITIONALLY. Chromium may emit either colour type for an
// opaque page and "it happened to come out RGB" is exactly the shape of a
// thing that is fine until it is not, so this does not test first.
const flat = spawnSync('python3', ['-c',
  'import sys;from PIL import Image;p=sys.argv[1];Image.open(p).convert("RGB").save(p,optimize=True)',
  png], { encoding: 'utf-8' });
if (flat.status !== 0) {
  console.error('could not flatten to RGB (needs python3 + PIL):\n' + (flat.stderr || flat.error));
  process.exit(1);
}

// Measure what is actually on disk rather than what was asked for. A PNG's
// IHDR carries its real dimensions and its colour type: 2 is truecolour RGB,
// 6 is truecolour + alpha, which Apple refuses.
const buf = fs.readFileSync(png);
const sig = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
const w = sig ? buf.readUInt32BE(16) : 0;
const h = sig ? buf.readUInt32BE(20) : 0;
const colourType = sig ? buf[25] : -1;
const mb = (buf.length / 1048576).toFixed(2);

const bad = [];
if (!sig) bad.push('not a PNG');
if (w !== 3840 || h !== 1646) bad.push(`wrong size ${w}x${h}, wanted 3840x1646`);
if (colourType !== 2) bad.push(`colour type ${colourType}, wanted 2 (RGB, no alpha)`);

console.log(`${png}  ${w}x${h}  colour type ${colourType}  ${mb} MB  ${bad.length ? 'FAILED: ' + bad.join('; ') : 'OK'}`);
if (bad.length) process.exitCode = 1;
