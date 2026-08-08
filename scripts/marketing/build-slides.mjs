/**
 * App Store marketing slides — a headline over each raw screenshot, at Apple's
 * 6.5" size (1284x2778).
 *
 *   node scripts/marketing/build-slides.mjs
 *
 * Reads screenshots-appstore/*.jpg, writes screenshots-marketing/*.png.
 * Slide 1 is full-bleed (style B); the rest float the phone on a glow (style
 * A); the share card stands alone (style CARD). Tints come from tints.py —
 * never hand-picked, so the surround always belongs to the picture it frames.
 *
 * The typeface is Liberation Sans (the free Helvetica clone) because that is
 * what this machine has. Drop a real font in and point the stack at it.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = `${ROOT}/screenshots-appstore`;
const OUT = `${ROOT}/screenshots-marketing`;
fs.mkdirSync(OUT, { recursive: true });
const b64 = f => 'data:image/jpeg;base64,' + fs.readFileSync(`${SHOTS}/${f}.jpg`).toString('base64');

// Tints are sampled from each screenshot by tints.py — never hand-picked, so
// the surround always belongs to the picture it frames.
const SLIDES = [
  { f: '01-mirrorball-downtown',  t: '#453564', s: 'B', a: 'Your music,',            b: 'wrapped in a drive' },
  // Amber, not the old teal: the re-shot page is the dial itself, and amber is
  // the dial's own colour (tints.py re-sampled it after the reshoot).
  { f: '03-stations-dial',        t: '#753f24', s: 'A', a: 'Ten moods.',             b: 'Not ten genres.' },
  { f: '02-vinyl-sunset',         t: '#63363c', s: 'A', a: 'Your Spotify or',        b: 'Apple Music playlists' },
  { f: '05-cassette-daylight',    t: '#675332', s: 'A', a: 'Eight ways to',          b: 'watch your music' },
  { f: '06-cd-coastal',           t: '#366357', s: 'A', a: 'Every disc',             b: 'catches the light' },
  { f: '07-tuner-nightrun',       t: '#234476', s: 'A', a: 'Tune the dial.',         b: 'Find the feeling.' },
  { f: '04-horizon-afterhours',   t: '#772228', s: 'A', a: 'Drive into',             b: 'the sunset' },
  { f: '08-circulareq-tunnel',    t: '#774322', s: 'A', a: 'Sound,',                 b: 'in the round' },
  { f: '09-equalizer-mountainpass', t: '#2d586c', s: 'A', a: 'A meter that moves',   b: 'with the music' },
  // The raw screenshot here is the share SHEET — six buttons and a Cancel,
  // which reads as a menu, not a product. The card itself is the picture, so
  // this slide shows the card alone (cropped by crop-card.py).
  { f: '10-sharecard-vinyl',      t: '#633647', s: 'CARD', a: 'Share the drive,',    b: 'not just the song' },
];

const base = `*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1284px;height:2778px;overflow:hidden;background:#07070c}
  body{font-family:"Liberation Sans","DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased}
  h1{color:#fff;font-weight:700;letter-spacing:-3px;line-height:1.04}
  h1 span{display:block;font-weight:400;color:#ffffffc4}`;

// A — floating device on a glow of the screenshot's own colour.
const A = s => `<style>${base}
    body{background:radial-gradient(122% 60% at 50% 4%, ${s.t}e0 0%, ${s.t}55 36%, #07070c 76%),#07070c;
         display:flex;flex-direction:column;align-items:center}
    .head{margin-top:168px;text-align:center;padding:0 92px}
    h1{font-size:${s.a.length > 15 || s.b.length > 18 ? 88 : 98}px}
    .phone{margin-top:120px;width:906px;border-radius:78px;padding:14px;
      background:linear-gradient(160deg,#2b2b36,#0b0b11 40%,#1b1b24);
      box-shadow:0 60px 130px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.09)}
    .phone img{display:block;width:100%;border-radius:64px}
  </style>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>
  <div class="phone"><img src="${b64(s.f)}"></div>`;

// B — the screenshot IS the slide. The scrim must be fully opaque down past
// the headline's foot, or the app's own header text ghosts through it.
const B = s => `<style>${base}
    .bleed{position:absolute;inset:0}
    .bleed img{width:100%;height:100%;object-fit:cover}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,
      #04040a 0%, #04040a 15.5%, rgba(4,4,9,.86) 20%, rgba(4,4,9,.34) 30%, rgba(4,4,9,0) 42%)}
    .head{position:absolute;top:168px;left:0;right:0;text-align:center;padding:0 90px}
    h1{font-size:100px}
  </style>
  <div class="bleed"><img src="${b64(s.f)}"></div><div class="scrim"></div>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>`;

// CARD — the share card standing on its own, no phone. Same glow as A so the
// slide still belongs to the set.
// The card sits at these pixels inside the raw share screenshot (measured by
// thresholding the bright block, not eyeballed). Cropping in CSS keeps this
// script self-contained — no image library, no temp file.
const CARD_BOX = { x: 228, y: 558, w: 826, h: 1051 };
const CARD_W = 1124;
const k = CARD_W / CARD_BOX.w;
const CARD = s => `<style>${base}
    body{background:radial-gradient(122% 60% at 50% 4%, ${s.t}e0 0%, ${s.t}55 36%, #07070c 76%),#07070c;
         display:flex;flex-direction:column;align-items:center}
    .head{margin-top:180px;text-align:center;padding:0 92px}
    h1{font-size:98px}
    /* Centre the card in whatever is left under the headline — sized by hand
       it left a dead band the height of a phone at the foot. */
    .mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center}
    .card{position:relative;width:${CARD_W}px;height:${Math.round(CARD_BOX.h * k)}px;
      border-radius:40px;overflow:hidden;
      box-shadow:0 54px 120px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.12)}
    .card img{position:absolute;display:block;width:${Math.round(1284 * k)}px;
      left:${-Math.round(CARD_BOX.x * k)}px;top:${-Math.round(CARD_BOX.y * k)}px}
    .foot{margin-top:84px;color:#ffffff8a;font-size:36px;letter-spacing:1px}
  </style>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>
  <div class="mid">
    <div class="card"><img src="${b64(s.f)}"></div>
    <div class="foot">Made in the app. Saved straight to Photos.</div>
  </div>`;

const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await br.newContext({ viewport: { width: 1284, height: 2778 } })).newPage();
let i = 0;
for (const s of SLIDES) {
  i++;
  const html = ({ A, B, CARD })[s.s](s);
  await p.setContent(`<!doctype html><meta charset="utf-8">${html}`, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const name = `${String(i).padStart(2, '0')}-${s.f.slice(3)}.png`;
  await p.screenshot({ path: `${OUT}/${name}` });
  console.log('made', name);
}
await br.close();
