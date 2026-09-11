// A DRIVER'S OWN ORDER FOR THE MODES LIST — Ethan (25.08): "I use the Tuner,
// CD, Vinyl, and Cassette the most so it would be nice to have the option
// move those to the front."
//
// The one property worth testing is the one that isn't obvious: a mode must
// never cross out of its own free/premium group, because that grouping is the
// paywall's shop window on the Modes tab. Reordering is a convenience; the
// INCLUDED/PREMIUM split is a product decision, and a saved order from a
// future version (or a corrupt one) must not be able to quietly rearrange it.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/modeOrder.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const req = () => new Proxy({}, { get: () => () => {} });
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, req);
const { applyModeOrder, moveModeWithinGroup } = m.exports;

// The real catalogue's shape: free modes and premium modes, in shelf order.
const MODES = [
  { id: 'equalizer', pro: false },
  { id: 'orb', pro: false },
  { id: 'cassette', pro: false },
  { id: 'vinyl', pro: true },
  { id: 'radio', pro: true },
  { id: 'horizon', pro: true },
  { id: 'cd', pro: true },
  { id: 'disco', pro: true },
];
const proOf = (id) => MODES.find((x) => x.id === id)?.pro ?? false;
const ids = (list) => list.map((x) => x.id);
const DEFAULT = MODES.map((x) => x.id);

console.log('\n  with no saved order, nothing moves:');
{
  check('null order is the catalogue order', JSON.stringify(ids(applyModeOrder(MODES, null))) === JSON.stringify(DEFAULT));
  check('an empty order is too', JSON.stringify(ids(applyModeOrder(MODES, []))) === JSON.stringify(DEFAULT));
}

console.log('\n  a saved order is honoured within each group:');
{
  // Ethan's own ask: Tuner, CD, Vinyl to the front of PREMIUM; Cassette to
  // the front of INCLUDED.
  const order = ['cassette', 'equalizer', 'orb', 'radio', 'cd', 'vinyl', 'horizon', 'disco'];
  const out = ids(applyModeOrder(MODES, order));
  check('free modes take their saved order', JSON.stringify(out.slice(0, 3)) === JSON.stringify(['cassette', 'equalizer', 'orb']), JSON.stringify(out));
  check('premium modes take theirs', JSON.stringify(out.slice(3)) === JSON.stringify(['radio', 'cd', 'vinyl', 'horizon', 'disco']), JSON.stringify(out));
}

console.log('\n  the free/premium split is never disturbed:');
{
  // A hostile order asking for premium modes first. The list must still come
  // back free-first — the sections are not the user's to rearrange.
  const hostile = ['disco', 'cd', 'radio', 'vinyl', 'horizon', 'cassette', 'orb', 'equalizer'];
  const out = applyModeOrder(MODES, hostile);
  check('every free mode still precedes every premium one',
    out.findIndex((x) => x.pro) === out.filter((x) => !x.pro).length,
    JSON.stringify(ids(out)));
  check('...and the free block is exactly the free modes',
    out.slice(0, 3).every((x) => !x.pro), JSON.stringify(ids(out)));
}

console.log('\n  an order that does not mention everything:');
{
  // A mode added in a later release, with an order saved before it existed.
  const partial = ['cd', 'radio'];
  const out = ids(applyModeOrder(MODES, partial));
  check('named premium modes come first in their group',
    JSON.stringify(out.slice(3, 5)) === JSON.stringify(['cd', 'radio']), JSON.stringify(out));
  check('the unnamed ones keep catalogue order behind them',
    JSON.stringify(out.slice(5)) === JSON.stringify(['vinyl', 'horizon', 'disco']), JSON.stringify(out));
  check('free modes are untouched', JSON.stringify(out.slice(0, 3)) === JSON.stringify(['equalizer', 'orb', 'cassette']), JSON.stringify(out));
}
{
  // A mode retired between releases, still named in a saved order.
  const stale = ['waves', 'cd', 'equalizer'];
  const out = ids(applyModeOrder(MODES, stale));
  check('a retired mode in the saved order is simply ignored',
    out.length === MODES.length && !out.includes('waves'), JSON.stringify(out));
}

console.log('\n  moving one step at a time:');
{
  let order = DEFAULT.slice();
  order = moveModeWithinGroup(order, 'cd', -1, proOf);
  const out = ids(applyModeOrder(MODES, order));
  check('CD moves up past Horizon', JSON.stringify(out.slice(3)) === JSON.stringify(['vinyl', 'radio', 'cd', 'horizon', 'disco']), JSON.stringify(out));
}
{
  // THE GUARD THAT MATTERS: the first premium mode moving "up" must not
  // swap with the last FREE mode — they are neighbours in the flat array but
  // in different groups.
  const order = DEFAULT.slice();
  const moved = moveModeWithinGroup(order, 'vinyl', -1, proOf);
  check('the top premium mode cannot move up into the free group',
    moved === order, JSON.stringify(moved));
}
{
  const order = DEFAULT.slice();
  const moved = moveModeWithinGroup(order, 'cassette', 1, proOf);
  check('the last free mode cannot move down into premium',
    moved === order, JSON.stringify(moved));
}
{
  const order = DEFAULT.slice();
  check('the first free mode cannot move up', moveModeWithinGroup(order, 'equalizer', -1, proOf) === order);
  check('the last premium mode cannot move down', moveModeWithinGroup(order, 'disco', 1, proOf) === order);
}
{
  // Round-trip: up then down is where you started.
  let order = DEFAULT.slice();
  order = moveModeWithinGroup(order, 'cd', -1, proOf);
  order = moveModeWithinGroup(order, 'cd', 1, proOf);
  check('up then down returns to the original order',
    JSON.stringify(ids(applyModeOrder(MODES, order))) === JSON.stringify(DEFAULT), JSON.stringify(order));
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  a driver can reorder the modes, and the paywall split holds\n');
process.exit(fails ? 1 : 0);
