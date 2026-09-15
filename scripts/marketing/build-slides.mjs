/**
 * App Store marketing slides — a headline over each raw screenshot, at Apple's
 * 6.5" size (1284x2778).
 *
 *   node scripts/marketing/build-slides.mjs              # iPhone, 1284x2778
 *   DEVICE=ipad node scripts/marketing/build-slides.mjs  # iPad 13", 2064x2752
 *
 * Reads screenshots-appstore/*.jpg, writes screenshots-marketing/*.png; the
 * iPad run reads screenshots-appstore-ipad/ and writes screenshots-marketing-ipad/.
 * SAME HEADLINES ON BOTH — the listing's words are one set per version in
 * App Store Connect, so the two sets must read as one thing; only the pictures
 * and the frame around them change. The iPad set has no photo-framing slide
 * and no share-cards slide: neither was shot at iPad size, and eight is plenty.
 * Slide 1 is full-bleed (style B); the rest float the phone on a glow (style
 * A); the share cards stand alone (style CARDS). Tints come from tints.py —
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
const IPAD = process.env.DEVICE === 'ipad';
const SHOTS = `${ROOT}/screenshots-appstore${IPAD ? '-ipad' : ''}`;
const OUT = `${ROOT}/screenshots-marketing${IPAD ? '-ipad' : ''}`;

// Every number the two layouts differ on, in one place. The phone column is
// the set that shipped on 08.09 and is byte-for-byte what it was; the iPad
// column is a 3:4 canvas with a 3:4 screen inside it, so the device frame is
// wider, squarer and thinner-bezelled — an iPad, not a stretched phone.
const G = IPAD ? {
  W: 2064, H: 2752, headTop: 150, pad: 120, h1: 150, h1Small: 136, h1B: 152,
  devW: 1440, devTop: 96, devRadius: 56, devPad: 22, imgRadius: 34,
  // The headline's foot sits at ~470px = 17% of the canvas, so the scrim
  // stays fully opaque to 18% and fades out by 44% — the same rule as the
  // phone's: opaque past the type, or the app's own header ghosts through it.
  scrim: [18, 22, 32, 44],
} : {
  W: 1284, H: 2778, headTop: 168, pad: 92, h1: 98, h1Small: 88, h1B: 100,
  devW: 906, devTop: 120, devRadius: 78, devPad: 14, imgRadius: 64,
  scrim: [15.5, 20, 30, 42],
};
fs.mkdirSync(OUT, { recursive: true });
const b64 = f => 'data:image/jpeg;base64,' + fs.readFileSync(`${SHOTS}/${f}.jpg`).toString('base64');
const png = f => 'data:image/png;base64,' + fs.readFileSync(`${SHOTS}/${f}.png`).toString('base64');

// Tints are sampled from each screenshot by tints.py — never hand-picked, so
// the surround always belongs to the picture it frames.
// The iPad set carries the SAME headlines as the phone set, in the same order
// minus the two slides that only exist at phone size. Tints re-sampled from
// the iPad shots themselves (tints.py screenshots-appstore-ipad) — two differ
// from the phone's, honestly: the iPad Stations shot shows the mountain hero
// (teal) where the phone's was scrolled to the amber dial, and the iPad CD
// shot carries more of Coastal's green photograph.
const IPAD_SLIDES = [
  { f: '01-mirrorball-downtown',    t: '#443366', s: 'B', a: 'Your music,',       b: 'wrapped in a drive' },
  { f: '03-stations-dial',          t: '#365663', s: 'A', a: 'Ten moods.',        b: 'Not ten genres.' },
  { f: '02-vinyl-sunset',           t: '#643539', s: 'A', a: 'Your Apple Music',  b: 'or Spotify playlists' },
  { f: '05-cassette-daylight',      t: '#635436', s: 'A', a: 'Eight ways to',     b: 'watch your music' },
  { f: '06-cd-coastal',             t: '#566336', s: 'A', a: 'Every disc',        b: 'catches the light' },
  { f: '07-tuner-nightrun',         t: '#226977', s: 'A', a: 'Tune the dial.',    b: 'Find the feeling.' },
  { f: '04-horizon-afterhours',     t: '#772227', s: 'A', a: 'Drive into',        b: 'the sunset' },
  { f: '09-equalizer-mountainpass', t: '#365463', s: 'A', a: 'The meter from',    b: 'an old hi-fi' },
];

const PHONE_SLIDES = [
  { f: '01-mirrorball-downtown',  t: '#453663', s: 'B', a: 'Your music,',            b: 'wrapped in a drive' },
  // Amber, not the old teal: the re-shot page is the dial itself, and amber is
  // the dial's own colour (tints.py re-sampled it after the reshoot).
  { f: '03-stations-dial',        t: '#774522', s: 'A', a: 'Ten moods.',             b: 'Not ten genres.' },
  // 1.3.0's headline, placed third on purpose: Apple shows the first two or
  // three in search results, and nothing else on the listing shows that the
  // picture behind a drive can be YOURS. The framing screen says it better
  // than a finished mode does — a mode with a photo behind it just looks
  // like the built-in stations, whereas a viewfinder can only mean one thing.
  { f: '08-yourphoto-framing',    t: '#685531', s: 'A', a: 'Your own photo,',        b: 'behind your own station' },
  { f: '02-vinyl-sunset',         t: '#653439', s: 'A', a: 'Your Apple Music',       b: 'or Spotify playlists' },
  { f: '05-cassette-daylight',    t: '#635436', s: 'A', a: 'Eight ways to',          b: 'watch your music' },
  { f: '06-cd-coastal',           t: '#365163', s: 'A', a: 'Every disc',             b: 'catches the light' },
  // Teal, not the blue it wore until 08.09: Night Run's whole palette moved to
  // teal on 19.08 (sampled from its own photograph) and this tint had been
  // sampled before that, so the slide framed the station in a colour the app
  // had stopped using. Re-running tints.py after a reshoot is what caught it —
  // which is the reason that step is not optional.
  { f: '07-tuner-nightrun',       t: '#226977', s: 'A', a: 'Tune the dial.',         b: 'Find the feeling.' },
  { f: '04-horizon-afterhours',   t: '#772227', s: 'A', a: 'Drive into',             b: 'the sunset' },
  { f: '09-equalizer-mountainpass', t: '#365463', s: 'A', a: 'The meter from',       b: 'an old hi-fi' },
  // The share cards, and there is more than one — so the slide shows two
  // (owner, 12.08: "id like to have the y2k share card option displayed on the
  // preview cards"). The Y2K one leads because it is the newest and the one
  // nobody expects; the Ticket sits behind it so the slide says "styles",
  // plural, without needing a word for it.
  //
  // These are NOT device screenshots. The raw share screenshot was the share
  // SHEET — six buttons and a Cancel, which reads as a menu — and it also
  // printed cruisefm.app, a domain that was never registered. Both cards are
  // rendered from the shipping components instead (scratchpad/share/render.js,
  // NO_ART=1 NO_SNAP=1), which keeps the address current and keeps real song
  // titles and album art off the listing, exactly like the rest of the set.
  { f: '10-sharecards',           t: '#223f77', s: 'CARDS', a: 'Share the drive,',   b: 'not just the song',
    front: 'card-y2k', behind: 'card-ticket' },
];
const SLIDES = IPAD ? IPAD_SLIDES : PHONE_SLIDES;

const base = `*{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${G.W}px;height:${G.H}px;overflow:hidden;background:#07070c}
  body{font-family:"Liberation Sans","DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased}
  h1{color:#fff;font-weight:700;letter-spacing:-3px;line-height:1.04}
  h1 span{display:block;font-weight:400;color:#ffffffc4}`;

// A — floating device on a glow of the screenshot's own colour.
const A = s => `<style>${base}
    body{background:radial-gradient(122% 60% at 50% 4%, ${s.t}e0 0%, ${s.t}55 36%, #07070c 76%),#07070c;
         display:flex;flex-direction:column;align-items:center}
    .head{margin-top:${G.headTop}px;text-align:center;padding:0 ${G.pad}px}
    h1{font-size:${s.a.length > 15 || s.b.length > 18 ? G.h1Small : G.h1}px}
    .phone{margin-top:${G.devTop}px;width:${G.devW}px;border-radius:${G.devRadius}px;padding:${G.devPad}px;
      background:linear-gradient(160deg,#2b2b36,#0b0b11 40%,#1b1b24);
      box-shadow:0 60px 130px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.09)}
    .phone img{display:block;width:100%;border-radius:${G.imgRadius}px}
  </style>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>
  <div class="phone"><img src="${b64(s.f)}"></div>`;

// B — the screenshot IS the slide. The scrim must be fully opaque down past
// the headline's foot, or the app's own header text ghosts through it.
const B = s => `<style>${base}
    .bleed{position:absolute;inset:0}
    .bleed img{width:100%;height:100%;object-fit:cover}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,
      #04040a 0%, #04040a ${G.scrim[0]}%, rgba(4,4,9,.86) ${G.scrim[1]}%, rgba(4,4,9,.34) ${G.scrim[2]}%, rgba(4,4,9,0) ${G.scrim[3]}%)}
    .head{position:absolute;top:${G.headTop}px;left:0;right:0;text-align:center;padding:0 ${G.pad - 2}px}
    h1{font-size:${G.h1B}px}
  </style>
  <div class="bleed"><img src="${b64(s.f)}"></div><div class="scrim"></div>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>`;

// CARDS — two share styles, one behind the other. Both are rendered at their
// own aspect and sized off WIDTH alone, because the three styles are different
// shapes: forcing a common height would squash one of them.
const CARDS = s => `<style>${base}
    body{background:radial-gradient(122% 60% at 50% 4%, ${s.t}e0 0%, ${s.t}55 36%, #07070c 76%),#07070c;
         display:flex;flex-direction:column;align-items:center}
    .head{margin-top:180px;text-align:center;padding:0 92px}
    h1{font-size:98px}
    .mid{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center}
    /* Sized to the cards themselves rather than to the slide: a box taller
       than its contents opens a dead band above them once it is centred. */
    .stack{position:relative;width:1284px;height:1190px}
    .stack img{position:absolute;border-radius:26px;
      box-shadow:0 54px 120px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.14)}
    /* Behind: tilted and pushed left, with its right third under the front
       card. Enough of it shows to read as a different design. The left inset
       has to clear the rotation — a card rotated 7 degrees swings its corners
       out by about half its height times sin(7), roughly 50px here. */
    .back{width:790px;left:34px;top:20px;transform:rotate(-7deg)}
    .front{width:950px;left:300px;top:110px;transform:rotate(3.5deg)}
    .foot{margin-top:64px;color:#ffffff8a;font-size:36px;letter-spacing:1px}
  </style>
  <div class="head"><h1>${s.a}<span>${s.b}</span></h1></div>
  <div class="mid">
    <div class="stack">
      <img class="back" src="${png(s.behind)}">
      <img class="front" src="${png(s.front)}">
    </div>
    <div class="foot">Three card styles. Saved straight to Photos.</div>
  </div>`;

// CHROMIUM_PATH because the browser's own directory carries its version and
// moves with it — a hardcoded path is a rebuild that dies on a fresh machine
// for a reason that has nothing to do with the slides.
const br = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const p = await (await br.newContext({ viewport: { width: G.W, height: G.H } })).newPage();
let i = 0;
for (const s of SLIDES) {
  i++;
  const html = ({ A, B, CARDS })[s.s](s);
  await p.setContent(`<!doctype html><meta charset="utf-8">${html}`, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const name = `${String(i).padStart(2, '0')}-${s.f.slice(3)}.png`;
  await p.screenshot({ path: `${OUT}/${name}` });
  console.log('made', name);
}
await br.close();
