// "Is this screen wide?" and "is this a tablet?" are two questions, and this
// is the test that keeps them apart.
//
// WHY IT EXISTS. One function answered both: `isTabletSize`, which measured
// the window's SHORTER edge against theme.ts's WIDE_MIN of 700. Its own
// comment is what dated it — "every iPad's shorter edge clears 700 and every
// iPhone's falls well short of it, so this can never mistake one for the
// other" — a sentence that was true of every iPhone ever made until Apple
// announced a FOLDING one (the iPhone Duo, 09.09.2026, 7.6in unfolded, on
// sale 23.10.2026). On that device the measurement answers "tablet", and two
// real behaviours hang off that answer: a tablet is never pinned upright, and
// it is never asked whether it is heading anywhere — it answers 'listening'
// for good. Both are right for an iPad. On a phone that folds and goes in a
// car they mean the driving question disappears and the drives stop being
// COUNTED as drives, silently, on the newest iPhone there is.
//
// So the size test became `isTabletDevice()`, which reads iOS's own
// userInterfaceIdiom, and `isWide` kept the layout question. This exercises
// the SHIPPED modules — theme.ts, sessionKind.ts and orientation.ts — rather
// than a copy of the rule, because a test carrying its own 700 would agree
// with itself the day the real one moved.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const ROOT = '/home/user/CruiseFM/src';
let fails = 0;
const ok = (cond, label) => { if (!cond) { fails++; console.log(`  FAIL  ${label}`); } };

function run(file, req) {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', out)(mod, mod.exports, req);
  return mod.exports;
}

// `platform` is the DEVICE and `win` is the GLASS, and the whole point of this
// file is that they are supplied separately — which the old code could not
// have been handed, since it only ever read the glass.
function loadTheme(platform) {
  return run(`${ROOT}/constants/theme.ts`, (m) => {
    if (m === '@/global.css') return {};
    // Dimensions is supplied — and reports a TABLET-SIZED window — even though
    // theme.ts does not read it. That is deliberate: if anyone ever puts the
    // size rule back, the module still loads and the checks below NAME the
    // fault instead of the harness dying at load, which is the shape that gets
    // filed as a "known failure" and ignored (18.09).
    if (m === 'react-native') return {
      Platform: { select: (o) => (o[platform.OS] ?? o.default), ...platform },
      Dimensions: { get: () => ({ width: 820, height: 900 }) },
    };
    throw new Error('unstubbed ' + m);
  });
}

// __esModule matters: TypeScript's importDefault interop wraps a plain object a
// SECOND time, so the module under test would look for `.default.default` and
// fall through to its own fail-quiet path, which reads as a pass (16.09).
function storageStub(store) {
  return {
    __esModule: true,
    default: {
      getItem: async (k) => (k in store ? store[k] : null),
      setItem: async (k, v) => { store[k] = v; },
    },
  };
}

function loadSessionKind(theme, store) {
  return run(`${ROOT}/utils/sessionKind.ts`, (m) => {
    if (m === '@react-native-async-storage/async-storage') return storageStub(store);
    if (m === 'react') return { useEffect: () => {}, useState: (v) => [v, () => {}] };
    if (m === '@/constants/theme') return theme;
    throw new Error('unstubbed ' + m);
  });
}

// The stub RECORDS rather than no-ops, so the lock the app asked for is the
// assertion (15.09: a stub added to silence an error is a wasted chance to
// check the thing it stands for).
function loadOrientation(theme, platform) {
  const locks = [];
  const mod = run(`${ROOT}/utils/orientation.ts`, (m) => {
    if (m === 'react-native') return { Platform: platform };
    if (m === '@/constants/theme') return theme;
    if (m === 'expo-screen-orientation') return {
      OrientationLock: { ALL: 'ALL', DEFAULT: 'DEFAULT', PORTRAIT_UP: 'PORTRAIT_UP' },
      lockAsync: async (l) => { locks.push(l); },
    };
    throw new Error('unstubbed ' + m);
  });
  return { mod, locks };
}

const IPAD   = { OS: 'ios', isPad: true };
const IPHONE = { OS: 'ios', isPad: false };

// THE DUO'S REAL POINT SIZE IS NOT PUBLISHED, so nothing here depends on one
// number: these are two plausible unfolded windows, and what is asserted is
// the PROPERTY that holds for any window whose shorter edge clears WIDE_MIN.
const FOLD_OPEN   = [{ w: 740, h: 800 }, { w: 820, h: 900 }];
// 5.4in outer screen — about an old iPhone mini, i.e. likely the NARROWEST
// window this app has ever been handed. Kept here because that is the half
// nobody thinks about.
const FOLD_SHUT   = { w: 375, h: 812 };

console.log('\n1. the device test reads the device, and nothing else');
{
  for (const [p, want, label] of [
    [IPAD,                              true,  'iPad'],
    [IPHONE,                            false, 'iPhone'],
    [{ OS: 'ios' },                     false, 'iOS with no isPad reported'],
    [{ OS: 'ios', isPad: 'yes' },       false, 'iOS with a non-boolean isPad'],
    [{ OS: 'android', isPad: true },    false, 'Android claiming isPad'],
    [{ OS: 'web' },                     false, 'web'],
  ]) {
    ok(loadTheme(p).isTabletDevice() === want, `${label} -> isTabletDevice ${want}`);
  }
  // The old name must not come back: two near-identical helpers is how one
  // test ended up answering two questions in the first place.
  ok(loadTheme(IPAD).isTabletSize === undefined, 'isTabletSize is gone, not kept alongside');
}

console.log('2. an unfolded foldable is WIDE glass on a PHONE');
{
  const t = loadTheme(IPHONE);
  for (const { w, h } of FOLD_OPEN) {
    ok(t.isWide(w) === true,              `${w}x${h} takes the reading column`);
    ok(t.heroCeil(430, w) > 430,          `${w}x${h} lifts the hero ceiling`);
    ok(t.isTabletDevice() === false,      `${w}x${h} is still a phone`);
  }
  ok(t.isWide(FOLD_SHUT.w) === false,     'folded shut is a plain phone layout');
  // The outer screen is narrower than the narrowest phone the widgets were
  // drawn for (393), which is the one place a fixed point size bites.
  ok(FOLD_SHUT.w < 393,                   'the outer screen is narrower than the drawn-for phone');
}

console.log('3. the driving question survives on a folding phone');
{
  for (const { w, h } of FOLD_OPEN) {
    const store = {};
    const sk = loadSessionKind(loadTheme(IPHONE), store);
    const loaded = await sk.loadSessionKind();
    ok(loaded === null,                     `${w}x${h} has never been asked -> null, so the card asks`);
    ok(sk.cachedSessionKind() === 'driving', `${w}x${h} defaults to driving`);
  }
  const store = { cruisefm_session_kind: 'listening' };
  const sk = loadSessionKind(loadTheme(IPHONE), store);
  ok((await sk.loadSessionKind()) === 'listening', 'a folding phone that answered "listening" is believed');
  ok(sk.cachedSessionKind() === 'listening',       'and keeps that answer');
}

console.log('4. the iPad is untouched — it still never asks');
{
  const store = { cruisefm_session_kind: 'driving' };
  const sk = loadSessionKind(loadTheme(IPAD), store);
  ok((await sk.loadSessionKind()) === 'listening', 'iPad answers listening however loaded');
  ok(sk.cachedSessionKind() === 'listening',       'iPad override wins over what is stored');
}

console.log('5. the orientation rule follows the device too');
{
  const pad = loadOrientation(loadTheme(IPAD), IPAD);
  await pad.mod.lockPortrait();
  ok(pad.locks.at(-1) === 'ALL',          'an iPad is left free to turn');

  const fold = loadOrientation(loadTheme(IPHONE), IPHONE);
  await fold.mod.lockPortrait();
  ok(fold.locks.at(-1) === 'PORTRAIT_UP', 'a folding phone is pinned upright like any phone');
}

console.log('6. CONTROL: nothing on sale today changes behaviour');
{
  // The rule as it shipped, so the two can be compared rather than asserted.
  const oldIsTabletSize = (w, h) => Math.min(w, h) >= 700;
  const REAL = [
    ['iPhone SE',        375, 667,  IPHONE],
    ['iPhone 13 mini',   375, 812,  IPHONE],
    ['iPhone 16',        393, 852,  IPHONE],
    ['iPhone 16 Pro Max',440, 956,  IPHONE],
    ['iPad mini',        744, 1133, IPAD],
    ['iPad 10.2',        768, 1024, IPAD],
    ['iPad Air',         820, 1180, IPAD],
    ['iPad Pro 12.9',    1024, 1366, IPAD],
    ['iPad Pro 13',      1032, 1376, IPAD],
  ];
  for (const [name, w, h, p] of REAL) {
    const now = loadTheme(p).isTabletDevice();
    ok(now === oldIsTabletSize(w, h), `${name}: old and new agree (${now})`);
    // And sideways, since every mode can be landscape and the old test read
    // the shorter edge precisely so a turned phone was not mistaken for a pad.
    ok(now === oldIsTabletSize(h, w), `${name} sideways: old and new agree`);
  }
  // THE ONE DEVICE THEY DISAGREE ON is the one that has not shipped. If this
  // ever stops failing, the split has been undone.
  const disagree = FOLD_OPEN.filter(({ w, h }) =>
    oldIsTabletSize(w, h) !== loadTheme(IPHONE).isTabletDevice());
  ok(disagree.length === FOLD_OPEN.length, 'the old rule and the new one differ on exactly the foldable');
}

console.log('7. PROVEN TO FAIL IN THE RIGHT DIRECTION');
{
  // The old rule, injected in place of the real theme: measure the window.
  // This is what the app would have done to a Duo, and it must reproduce the
  // bug — otherwise section 3 above is passing against nothing.
  for (const { w, h } of FOLD_OPEN) {
    const sizeRule = { ...loadTheme(IPHONE), isTabletDevice: () => Math.min(w, h) >= 700 };
    const sk = loadSessionKind(sizeRule, {});
    const loaded = await sk.loadSessionKind();
    ok(loaded === 'listening' && sk.cachedSessionKind() === 'listening',
      `${w}x${h} under the OLD size rule is wrongly 'listening' (the bug reproduces)`);
  }
}

console.log(fails === 0 ? '\nall good\n' : `\n${fails} FAILED\n`);
process.exit(fails === 0 ? 0 : 1);
