/**
 * The App Store SEARCH RESULTS asset — 3840 x 2560 (3:2), Apple's own max for
 * that aspect.
 *
 * THIS ONE IS A TRADE, NOT AN ADDITION, AND THAT IS THE FIRST THING TO KNOW.
 * The product page header (header.mjs) sits BESIDE the screenshots and costs
 * nothing. This one REPLACES the search results row: Apple's own best-practices
 * page says that without it "your In-App Events, app previews, and screenshots
 * will appear" — up to THREE of them — and with it that row becomes ONE image.
 * So supplying this is giving up three real pictures of the app to gain one
 * designed banner. 01.10 had already reasoned about that exact row, which is
 * why the widget screenshot was planned for position 3.
 *
 * AND IT IS SEEN SMALL, WHICH IS THE REASON IT IS NOT SIMPLY THE HEADER IN A
 * DIFFERENT SHAPE. Apple advises using the same artwork in both so the brand
 * reads as one thing, and that advice is about an asset viewed at the top of a
 * product page. A search result is a row in a list on a phone. Five phones in
 * an arc is a composition that needs width to be read; shrunk to a list row it
 * is five grey slivers. So every variant here is rendered AND downscaled to
 * phone width, and the one that survives that is the one to ship — the
 * thumbnail is the real viewing condition, not the 3840px frame.
 *
 * THE VARIANTS, all drawn from the header's own parts so the two assets are
 * visibly one family:
 *   arc    five phones, deeper lean than the header's — fills a taller frame,
 *          and the busiest at thumbnail size.
 *   flat   the header's exact composition (210/250/300, -7/-4/0/4/7, 44/16)
 *          dropped into 3:2. The literal reading of "same artwork in both".
 *   trio   THREE phones, much bigger. 3:2 is far tighter horizontally than
 *          21:9, so three can be grown a long way inside the same safe area,
 *          and three big objects are legible in a list row where five are not.
 *
 * THE SAFE AREA IS THE SAME 14% DISCIPLINE AS C2, and it is MEASURED rather
 * than eyeballed: every phone's own rotated bounding box is read back out of
 * the DOM and the outermost edge is reported as a share of the width. Apple
 * warns about "unwanted clipping" and publishes no safe-area number, so a
 * composition that merely fits the frame is not good enough.
 *
 * PNG AND FLATTENED TO RGB, for the reason header.mjs records at length: the
 * 21:9 header slot refused a JPEG despite Apple's help page listing JPEG as
 * supported, so the slot is the authority and the documentation is not; and a
 * browser screenshot is RGBA by default while Apple's spec forbids an alpha
 * channel, so this flattens unconditionally and then reads the colour type
 * back out of the PNG's own IHDR, exiting non-zero on anything but 2.
 *
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *   node scripts/marketing/search-asset.mjs            # all three
 *   ... node scripts/marketing/search-asset.mjs trio   # just one
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const OUT  = `${ROOT}/screenshots-header`;
fs.mkdirSync(OUT, { recursive: true });

// Rendered at half size with deviceScaleFactor 2, so it lands on 3840x2560
// exactly rather than near it. 3:2 is the aspect Apple lists first and it
// accepts .png; the 16:9 alternative is PNG-only at one fixed 5244x2950.
const W = 1920, H = 1280;

const shot = f => 'data:image/jpeg;base64,' +
  fs.readFileSync(`${ROOT}/screenshots-appstore/${f}.jpg`).toString('base64');
const ground = f => 'data:image/jpeg;base64,' +
  fs.readFileSync(`${ROOT}/assets/stations/blur/${f}.jpg`).toString('base64');

// Each phone is a different OBJECT — tape, disc, ball, record, sun — rather
// than five of the same thing in different colours, which is the whole reason
// this says more than a screenshot row does. The Mirror Ball is always centre
// and always largest, so Apple's "focal point within the center" is satisfied
// by construction rather than by hoping.
const CASSETTE = '05-cassette-daylight';
const CD       = '06-cd-coastal';
const BALL     = '01-mirrorball-downtown';
const VINYL    = '02-vinyl-sunset';
const HORIZON  = '04-horizon-afterhours';
const GROUND   = 'downtown';            // the centre phone's own station

const VARIANTS = {
  arc: {
    note: 'five phones, deeper lean — fills the taller frame',
    gap: 23, lift: 67,
    fan: [
      { file: CASSETTE, w: 220, rot: -9, dy: 158 },
      { file: CD,       w: 262, rot: -5, dy: 69  },
      { file: BALL,     w: 315, rot:  0, dy: 0   },
      { file: VINYL,    w: 262, rot:  5, dy: 69  },
      { file: HORIZON,  w: 220, rot:  9, dy: 158 },
    ],
  },
  flat: {
    note: "the header's own composition, dropped into 3:2",
    gap: 22, lift: 22,
    fan: [
      { file: CASSETTE, w: 210, rot: -7, dy: 44 },
      { file: CD,       w: 250, rot: -4, dy: 16 },
      { file: BALL,     w: 300, rot:  0, dy: 0  },
      { file: VINYL,    w: 250, rot:  4, dy: 16 },
      { file: HORIZON,  w: 210, rot:  7, dy: 44 },
    ],
  },
  trio: {
    note: 'three phones, much bigger — built to survive a list row',
    gap: 37, lift: 20,
    fan: [
      { file: CD,    w: 363, rot: -6, dy: 106 },
      { file: BALL,  w: 440, rot:  0, dy: 0   },
      { file: VINYL, w: 363, rot:  6, dy: 106 },
    ],
  },
};

const page = (v) => `<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#07070c}
  .bg{position:absolute;inset:0}
  .bg img{width:100%;height:100%;object-fit:cover}
  /* Two layers, not one: a flat wash so the phones read against anything the
     photograph happens to be doing, and a vignette so the edges fall away
     instead of ending. A single scrim does one job or the other, never both. */
  .wash{position:absolute;inset:0;background:rgba(5,5,11,.52)}
  .vig{position:absolute;inset:0;background:
    radial-gradient(104% 104% at 50% 46%, rgba(5,5,11,0) 26%, rgba(5,5,11,.60) 74%, rgba(5,5,11,.92) 100%)}
  /* The stage is nudged UP by the variant's own lift, because the arc hangs
     below the centre phone: centring the stage centres the middle phone and
     leaves the composition's own bounding box sitting low. */
  .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
         gap:${v.gap}px;transform:translateY(-${v.lift}px)}
  .ph{border-radius:38px;padding:7px;background:linear-gradient(160deg,#2b2b36,#0b0b11 40%,#1b1b24);
      box-shadow:0 40px 90px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.1)}
  .ph img{display:block;width:100%;border-radius:31px}
</style>
<div class="bg"><img src="${ground(GROUND)}"></div>
<div class="wash"></div><div class="vig"></div>
<div class="stage">${v.fan.map((p, i) =>
  `<div class="ph" data-i="${i}" style="width:${p.w}px;transform:rotate(${p.rot}deg) translateY(${p.dy}px);${p.rot === 0 ? 'z-index:2;' : ''}">`
  + `<img src="${shot(p.file)}"></div>`).join('')}</div>`;

const br = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

const want = process.argv.slice(2).filter(a => VARIANTS[a]);
const names = want.length ? want : Object.keys(VARIANTS);
let failed = false;

for (const name of names) {
  const v = VARIANTS[name];
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><meta charset="utf-8">${page(v)}`, { waitUntil: 'load' });
  await p.waitForTimeout(400);

  // MEASURE THE ROTATED BOXES RATHER THAN THE DECLARED WIDTHS. getBoundingClientRect
  // on a rotated element returns the box the rotation actually sweeps, so this is
  // the real distance to the frame's edge — which is what Apple's clipping warning
  // is about and what no amount of reading the CSS can tell you.
  const box = await p.evaluate(() => {
    const r = [...document.querySelectorAll('.ph')].map(e => e.getBoundingClientRect());
    return {
      left: Math.min(...r.map(b => b.left)), right: Math.max(...r.map(b => b.right)),
      top: Math.min(...r.map(b => b.top)),  bottom: Math.max(...r.map(b => b.bottom)),
    };
  });

  const png = `${OUT}/search-asset-${name}.png`;
  await p.screenshot({ path: png });
  await p.close();

  // Flatten to RGB UNCONDITIONALLY — no test first, so there is no branch to skip.
  const flat = spawnSync('python3', ['-I', '-c',
    'import sys;from PIL import Image;p=sys.argv[1];Image.open(p).convert("RGB").save(p,optimize=True)',
    png], { encoding: 'utf-8' });
  if (flat.status !== 0) {
    console.error('could not flatten to RGB (needs python3 + PIL):\n' + (flat.stderr || flat.error));
    process.exit(1);
  }

  // Measure what is on disk, not what was asked for: a PNG's IHDR carries its
  // real size and its colour type (2 = RGB, 6 = RGB + alpha, which Apple refuses).
  const buf = fs.readFileSync(png);
  const sig = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  const w = sig ? buf.readUInt32BE(16) : 0;
  const h = sig ? buf.readUInt32BE(20) : 0;
  const ct = sig ? buf[25] : -1;

  const mL = (box.left / W) * 100, mR = ((W - box.right) / W) * 100;
  const mT = (box.top / H) * 100,  mB = ((H - box.bottom) / H) * 100;

  const bad = [];
  if (!sig) bad.push('not a PNG');
  if (w !== 3840 || h !== 2560) bad.push(`wrong size ${w}x${h}, wanted 3840x2560`);
  if (ct !== 2) bad.push(`colour type ${ct}, wanted 2 (RGB, no alpha)`);
  if (Math.min(mL, mR) < 10) bad.push(`side margin ${Math.min(mL, mR).toFixed(1)}% — Apple warns about clipping`);
  if (Math.min(mT, mB) < 6)  bad.push(`top/bottom margin ${Math.min(mT, mB).toFixed(1)}%`);

  console.log(
    `${name.padEnd(5)} ${w}x${h} ct${ct} ${(buf.length / 1048576).toFixed(2)}MB  ` +
    `margins L${mL.toFixed(1)} R${mR.toFixed(1)} T${mT.toFixed(1)} B${mB.toFixed(1)}  ` +
    (bad.length ? 'FAILED: ' + bad.join('; ') : 'OK') + `   (${v.note})`);
  if (bad.length) failed = true;
}

await br.close();
if (failed) process.exitCode = 1;
