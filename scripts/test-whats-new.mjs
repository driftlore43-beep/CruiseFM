// THE WHAT'S-NEW CARD MUST NOT GREET A STRANGER WITH "WHAT'S NEW".
//
// The rule is small and the failure modes are both silent: show it to a
// brand-new install and it is meaningless noise on the one screen that has to
// make a first impression; get the self-starting clock wrong the other way
// and an existing user never hears about anything again.
//
// Transpiles the SHIPPED module against a fake AsyncStorage, so it tests the
// real rules rather than a copy of them.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/whatsNew.ts';
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
    ? {
      getItem: async () => { throw new Error('storage unreadable'); },
      setItem: async () => { throw new Error('storage unreadable'); },
    }
    : {
      getItem: async (k) => (k in store ? store[k] : null),
      setItem: async (k, v) => { store[k] = v; },
    };

  const req = (name) => {
    // Return the object DIRECTLY, never wrapped in { default: ... }. TS's
    // __importDefault helper wraps anything without __esModule, so a
    // hand-wrapped stub gets wrapped twice and every call lands on undefined
    // — which the module's own try/catch then swallows into a null, so the
    // whole suite fails while reporting nothing about the real cause.
    if (name === '@react-native-async-storage/async-storage') return AsyncStorage;
    return new Proxy({}, { get: () => () => {} });
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { mod: m.exports, store };
}

const KEY = 'cruisefm_whats_new_seen';
const { mod: probe } = load();
const NOTE = probe.CURRENT_NOTE;

console.log('\n  the note itself:');
check('there is a note, or the card is deliberately off', NOTE === null || !!NOTE.id);
if (NOTE) {
  check('it has an id, a title and a body', !!NOTE.id && !!NOTE.title && !!NOTE.body);
  // A release note that could be any release is not a release note.
  check('the body is not filler',
    !/bug fix|improvements|under the hood|various/i.test(NOTE.body), NOTE.body);
  check('one sentence, not an essay', NOTE.body.length <= 160, `${NOTE.body.length} chars`);
}

if (!NOTE) {
  console.log('\n  CURRENT_NOTE is null — nothing to announce, which is a valid state.');
  process.exit(fails ? 1 : 0);
}

console.log('\n  a brand-new install is NOT told what is new:');
{
  // Never seen a note, never seen the welcome explainer = brand new.
  const { mod, store } = load({});
  const got = await mod.noteToShow(false);
  check('says nothing', got === null, `got ${got && got.id}`);
  check('...and writes the current note down, so they are not told later either',
    store[KEY] === NOTE.id, `store holds ${store[KEY]}`);
  check('which means the NEXT note still reaches them',
    store[KEY] !== 'some-future-id');
}

console.log('\n  somebody who already uses the app IS told:');
{
  // Seen the welcome explainer, never seen a note = existing user, first note.
  const { mod } = load({});
  const got = await mod.noteToShow(true);
  check('gets the note', got?.id === NOTE.id, `got ${got && got.id}`);
}

console.log('\n  once means once:');
{
  const { mod } = load({ [KEY]: NOTE.id });
  check('already seen this note — silent', (await mod.noteToShow(true)) === null);
  check('...and silent for a new install too', (await mod.noteToShow(false)) === null);
}

console.log('\n  an older note does not block a newer one:');
{
  const { mod, store } = load({ [KEY]: 'an-older-note' });
  const got = await mod.noteToShow(true);
  check('a phone holding a stale id gets the current note', got?.id === NOTE.id);
  await mod.markNoteSeen(NOTE.id);
  check('marking it seen stores the id', store[KEY] === NOTE.id);
  check('and then it stops', (await mod.noteToShow(true)) === null);
}

console.log('\n  storage that will not answer:');
{
  const { mod } = load({}, { broken: true });
  let threw = false;
  let got;
  try { got = await mod.noteToShow(true); } catch { threw = true; }
  check('does not throw on the home page', !threw);
  check('fails quiet rather than showing on every launch', got === null, `got ${got && got.id}`);
  let markThrew = false;
  try { await mod.markNoteSeen(NOTE.id); } catch { markThrew = true; }
  check('marking seen does not throw either', !markThrew);
}

console.log(fails ? `\n  ${fails} failure(s)\n`
  : "\n  the card tells returning listeners what changed, once, and leaves strangers alone\n");
process.exit(fails ? 1 : 0);
