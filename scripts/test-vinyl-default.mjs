// THE REALISTIC RECORD IS THE ONE THE APP OPENS WITH — and an explicit "no"
// still means no.
//
// Classic Vinyl shipped OFF on 25.08 so nobody's deck changed under them, and
// became the DEFAULT on 13.09 once it was the look worth showing a stranger.
// Flipping a default is the easy half; the half that goes wrong is the people
// who already answered. `=== 'true'` made "never asked" and "said no"
// identical, so reading it that way would have overruled everyone who had
// deliberately chosen the neon look — silently, with nothing to report.
//
// Transpiles the SHIPPED module against a fake AsyncStorage, so it tests the
// real rule rather than a copy of it.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/motionSettings.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load(initial = {}, { broken = false } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const store = { ...initial };
  const AsyncStorage = broken
    ? { getItem: async () => { throw new Error('unreadable'); }, setItem: async () => { throw new Error('unreadable'); } }
    : {
      getItem: async (k) => (k in store ? store[k] : null),
      setItem: async (k, v) => { store[k] = v; },
    };
  // Returned DIRECTLY, never wrapped in { default } — TS's __importDefault
  // helper wraps anything without __esModule, so a hand-wrapped stub gets
  // wrapped twice and every call lands on undefined, which the module's own
  // try/catch then swallows into a plausible-looking answer.
  const req = (name) => {
    if (name === '@react-native-async-storage/async-storage') return AsyncStorage;
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { mod: m.exports, store };
}

const KEY = 'cruise_vinyl_classic';

console.log('\n  the default:');
{
  const { mod } = load({});
  check('a phone that has never seen the toggle gets the real record',
    (await mod.getVinylClassic()) === true);
}

console.log('\n  and an answer already given is kept:');
{
  const { mod } = load({ [KEY]: 'false' });
  check('someone who turned it OFF still gets the neon look',
    (await mod.getVinylClassic()) === false);
}
{
  const { mod } = load({ [KEY]: 'true' });
  check('someone who turned it ON is unaffected', (await mod.getVinylClassic()) === true);
}

console.log('\n  the switch still writes both answers explicitly:');
{
  const { mod, store } = load({});
  await mod.setVinylClassicStored(false);
  check('off is recorded as a real "false", not as an absence', store[KEY] === 'false');
  check('...and reads back as off', (await mod.getVinylClassic()) === false);
  await mod.setVinylClassicStored(true);
  check('on is recorded', store[KEY] === 'true');
  check('...and reads back as on', (await mod.getVinylClassic()) === true);
}

console.log('\n  storage that will not answer:');
{
  const { mod } = load({}, { broken: true });
  let threw = false, got;
  try { got = await mod.getVinylClassic(); } catch { threw = true; }
  check('does not throw', !threw);
  check('falls back to the DEFAULT, not to its opposite', got === true, `got ${got}`);
}

console.log('\n  a stray value is not an answer:');
{
  const { mod } = load({ [KEY]: 'yes' });
  check('anything but an explicit "false" means the default',
    (await mod.getVinylClassic()) === true);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : '\n  the real record opens by default, and nobody who said otherwise is overruled\n');
process.exit(fails ? 1 : 0);
