/**
 * Product page header prototypes — 3840 x 1646 (21:9), Apple's size.
 *
 * Apple turned creative assets on 5 October 2026. A header is a shape this app
 * has never drawn: every screen it owns is portrait and every marketing slide
 * is 1284x2778, so this is a design round rather than a crop. Four directions,
 * she picks, and the winner becomes the builder.
 *
 * Apple's own guidance, which these are built against:
 *   "Focus on a single, clear idea. Visually dense or cluttered assets dilute
 *    your impact."
 *   "Be sure your focal point artwork is within the center of your composition
 *    to prevent any unwanted clipping."
 *   Text must be localised for every supported language — which on a listing
 *   with one language and no translation budget is an argument for none.
 *
 * WHY UPSCALING THE BACKDROP IS FINE AND UPSCALING A PHONE WOULD NOT BE: the
 * grounds are assets/stations/blur/*, already gaussian-blurred, so there is no
 * detail for an upscale to lose. The sharp elements are 1284-wide screenshots
 * placed at ~600-900px inside a 3840 banner, i.e. downscaled. Never the other
 * way round.
 *
 *   node scripts/marketing/header-proto.mjs
 *   PLAYWRIGHT_MODULE=<scratchpad>/node_modules/playwright-core/index.mjs ...
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

const base = `*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:#07070c}
  body{font-family:"Liberation Sans","DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased}
  .bg{position:absolute;inset:0}
  .bg img{width:100%;height:100%;object-fit:cover}
  /* Two layers, not one: a flat wash so the phones read against anything the
     photograph happens to be doing, and a vignette so the 21:9 edges fall away
     instead of ending. A single scrim does one job or the other, never both. */
  .wash{position:absolute;inset:0;background:rgba(5,5,11,.52)}
  .vig{position:absolute;inset:0;background:
    radial-gradient(118% 92% at 50% 48%, rgba(5,5,11,0) 24%, rgba(5,5,11,.62) 72%, rgba(5,5,11,.92) 100%)}
  .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .ph{border-radius:38px;padding:7px;background:linear-gradient(160deg,#2b2b36,#0b0b11 40%,#1b1b24);
      box-shadow:0 40px 90px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.1)}
  .ph img{display:block;width:100%;border-radius:31px}`;

const bg = g => `<div class="bg"><img src="${ground(g)}"></div>
  <div class="wash"></div><div class="vig"></div>`;

// A — ONE PHONE, CENTRED. The purest reading of "a single, clear idea": this
// is what your screen becomes. Nothing else in the frame, no words.
const A = `<style>${base}
  .ph{width:372px}
</style>${bg('sunset')}
<div class="stage"><div class="ph"><img src="${shot('02-vinyl-sunset')}"></div></div>`;

// B — THREE. The centre one upright and largest so the focal point is still
// the middle; the flankers lean away and sit lower, which is what stops three
// phones reading as a row of thumbnails.
const B = `<style>${base}
  .stage{gap:52px}
  .ph{width:300px}
  .ph.mid{width:368px;z-index:2}
  .ph.l{transform:rotate(-7deg) translateY(26px)}
  .ph.r{transform:rotate(7deg) translateY(26px)}
</style>${bg('downtown')}
<div class="stage">
  <div class="ph l"><img src="${shot('07-tuner-nightrun')}"></div>
  <div class="ph mid"><img src="${shot('01-mirrorball-downtown')}"></div>
  <div class="ph r"><img src="${shot('02-vinyl-sunset')}"></div>
</div>`;

// C — FIVE, A SHALLOW ARC. The one direction that uses the 21:9 width rather
// than leaving most of it empty. Risks Apple's "visually dense" warning, which
// is exactly what the sheet is for.
const C = `<style>${base}
  .stage{gap:34px}
  .ph{width:244px}
  .ph.m1{transform:rotate(-10deg) translateY(58px)}
  .ph.m2{width:286px;transform:rotate(-5deg) translateY(20px)}
  .ph.m3{width:330px;z-index:2}
  .ph.m4{width:286px;transform:rotate(5deg) translateY(20px)}
  .ph.m5{transform:rotate(10deg) translateY(58px)}
</style>${bg('downtown')}
<div class="stage">
  <div class="ph m1"><img src="${shot('05-cassette-daylight')}"></div>
  <div class="ph m2"><img src="${shot('06-cd-coastal')}"></div>
  <div class="ph m3"><img src="${shot('01-mirrorball-downtown')}"></div>
  <div class="ph m4"><img src="${shot('02-vinyl-sunset')}"></div>
  <div class="ph m5"><img src="${shot('04-horizon-afterhours')}"></div>
</div>`;

// D — WORDS AND ONE PHONE. The whole lockup is centred as a group, so the
// focal point rule still holds. The phrase is the description's own opening,
// which enhances the picture rather than describing it — Apple's test.
const D = `<style>${base}
  .lock{display:flex;align-items:center;gap:84px}
  .ph{width:338px}
  .copy{max-width:620px}
  .wm{color:#fff;font-size:94px;font-weight:700;letter-spacing:-4px;line-height:1}
  .sub{margin-top:26px;color:#ffffffc9;font-size:38px;font-weight:400;line-height:1.24}
</style>${bg('night-run')}
<div class="stage"><div class="lock">
  <div class="copy"><div class="wm">Cruise FM</div>
    <div class="sub">Pick a mood. Press play.</div></div>
  <div class="ph"><img src="${shot('01-mirrorball-downtown')}"></div>
</div></div>`;

// C2 — C, PULLED INSIDE A SAFE AREA. Same five, smaller and tighter, because
// C's outermost phones sit about 8% from the edge once their rotation is
// counted and Apple warns in as many words about "unwanted clipping". This one
// lands near 14%, against B's 20%. Which of C and C2 is right depends on
// whether the banner is ever cropped at the sides — App Store Connect's own
// Preview tool is what answers that, and it is free to look.
const C2 = `<style>${base}
  .stage{gap:22px}
  .ph{width:210px}
  .ph.m1{transform:rotate(-7deg) translateY(44px)}
  .ph.m2{width:250px;transform:rotate(-4deg) translateY(16px)}
  .ph.m3{width:300px;z-index:2}
  .ph.m4{width:250px;transform:rotate(4deg) translateY(16px)}
  .ph.m5{transform:rotate(7deg) translateY(44px)}
</style>${bg('downtown')}
<div class="stage">
  <div class="ph m1"><img src="${shot('05-cassette-daylight')}"></div>
  <div class="ph m2"><img src="${shot('06-cd-coastal')}"></div>
  <div class="ph m3"><img src="${shot('01-mirrorball-downtown')}"></div>
  <div class="ph m4"><img src="${shot('02-vinyl-sunset')}"></div>
  <div class="ph m5"><img src="${shot('04-horizon-afterhours')}"></div>
</div>`;

const br = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const p = await (await br.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
})).newPage();

for (const [name, html] of Object.entries({ A, B, C, C2, D })) {
  await p.setContent(`<!doctype html><meta charset="utf-8">${html}`, { waitUntil: 'load' });
  await p.waitForTimeout(350);
  await p.screenshot({ path: `${OUT}/header-${name}.png` });
  console.log('made header-' + name + '.png');
}
await br.close();
