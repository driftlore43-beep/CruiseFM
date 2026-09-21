/**
 * WHO GETS A TASTE AND WHO GETS THE DRIVE — the paywall rule itself.
 *
 * `needsPreview` decides whether opening a station in a mode is the real
 * thing or the app's taste-then-paywall. It is asked at every doorway — the
 * home hero, a station's page, a widget tap, and changing mode mid-drive —
 * and a doorway that gets it wrong is either a paywall nobody can pass or a
 * paywall anybody can.
 *
 * IT GAINED THE STATION HALF ON 21.09, and until then it did not need it: a
 * locked FM row is simply not tappable on the Stations page, so a free user
 * had no way to reach a premium station at all. Pinning a widget to one is
 * the first way, because the picker offers the FM band to everyone and marks
 * it rather than hiding it — the same shop-window rule the Stations page
 * follows for its dimmed rows.
 *
 * The real STATIONS list is stubbed (it `require`s ten jpgs), but the rule
 * under test is the shipped one, transpiled.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  [ ok ] ${name}`);
  else { failures++; console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`); }
};

console.log('PREVIEW GATE\n');

const js = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/constants/modeCatalog.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;

const mod = { exports: {} };
new Function('require', 'module', 'exports', js)(
  (id) => {
    if (id === './stations') return {
      __esModule: true,
      STATIONS: [
        { id: 'sunset', premium: false },
        { id: 'night-run', premium: false },
        { id: 'tunnel', premium: true },
        { id: 'downtown', premium: true },
      ],
    };
    throw new Error(`unstubbed require: ${id}`);
  },
  mod, mod.exports,
);
const { needsPreview, isProStation, isProMode } = mod.exports;

// The catalogue is the real one, so these are the app's own answers.
check('the real mode catalogue loaded',
  isProMode('vinyl') === true && isProMode('equalizer') === false);

console.log('\n  a premium listener is never previewed:');
check('free mode, free station', needsPreview(true, 'sunset', 'equalizer') === false);
check('premium mode', needsPreview(true, 'sunset', 'vinyl') === false);
check('premium station', needsPreview(true, 'tunnel', 'equalizer') === false);
check('both', needsPreview(true, 'tunnel', 'vinyl') === false);

console.log('\n  a free listener gets the real drive only when nothing is locked:');
check('free mode on a free station is a real drive',
  needsPreview(false, 'sunset', 'equalizer') === false);
check('a premium MODE is a taste', needsPreview(false, 'sunset', 'vinyl') === true);
check('a premium STATION is a taste — the half added on 21.09',
  needsPreview(false, 'tunnel', 'equalizer') === true);
check('and both together is still just a taste',
  needsPreview(false, 'tunnel', 'vinyl') === true);

console.log('\n  the edges:');
// resolveAnyStation falls back for an id it does not know, and refusing a
// drive over an unrecognised id would be the worst possible reason to refuse
// one — a deleted pinned station, a hand-typed link, a stale widget.
check('an unknown station is not premium', isProStation('nope') === false);
check('so an unknown station still drives', needsPreview(false, 'nope', 'equalizer') === false);
// A station someone made themselves is never in STATIONS, so it takes the
// same path — which is the answer that matters, since the picker lists them.
check("a driver's own station is never premium", isProStation('custom-1712') === false);
check('an unknown mode is not premium either', isProMode('made-up') === false);
check('and an unknown mode still drives', needsPreview(false, 'sunset', 'made-up') === false);

console.log(`\n${failures === 0 ? 'ALL GOOD' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
