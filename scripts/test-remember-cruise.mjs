/**
 * THE WIDGETS FOLLOW THE DRIVE — checked offline, against the shipped code.
 *
 * Five widgets draw their station from the remembered cruise, and the
 * snapshot they read is written by the app. Two things therefore have to hold
 * and neither can be seen by looking at a phone for a few minutes:
 *
 *   1. SAVING THE CRUISE AND TELLING THE WIDGETS ARE ONE ACTION. They used to
 *      be two, at five separate call sites, and the second was simply never
 *      written — so the tiles only caught up when the app was backgrounded or
 *      a new song played, and for a companion-mode listener (no song) never.
 *
 *   2. A DRIVE STARTED FROM A WIDGET IS A DRIVE. The widget-tap path opened
 *      the deck and recorded nothing, so it was the one doorway that left no
 *      trace: missing from the streak, and — because it never updated the
 *      remembered cruise — unable to move the tiles off whatever station it
 *      had itself just started. Tap Sunset, get Sunset, for ever.
 *
 * Case 1 is tested by RUNNING the shipped module against stubs. Cases 2 and 3
 * are scans, because the code under test is a React focus callback: they
 * assert the SHAPE the app must keep, and each asserts it read something, so
 * a pattern that silently matches nothing cannot pass vacuously.
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

console.log('REMEMBER CRUISE\n');

/* ── 1. the shipped module: save AND publish, save first, publish non-fatal ── */

function runRememberCruise({ publishThrows = false } = {}) {
  const src = fs.readFileSync(path.join(root, 'src/utils/rememberCruise.ts'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const calls = [];
  const stubs = {
    './lastCruise': {
      __esModule: true,
      saveLastCruise: async (c) => { calls.push(['save', c.stationId, c.mode]); },
    },
    './widgetData': {
      __esModule: true,
      publishWidgetData: async () => {
        calls.push(['publish']);
        if (publishThrows) throw new Error('no bridge');
      },
    },
  };
  const mod = { exports: {} };
  const req = (id) => {
    if (stubs[id]) return stubs[id];
    throw new Error(`unstubbed require: ${id}`);
  };
  new Function('require', 'module', 'exports', js)(req, mod, mod.exports);
  return { mod, calls };
}

{
  const { mod, calls } = runRememberCruise();
  await mod.exports.rememberCruise({ stationId: 'night-run', mode: 'disco' });
  check('saving a cruise also tells the widgets',
    calls.length === 2 && calls[0][0] === 'save' && calls[1][0] === 'publish',
    JSON.stringify(calls));
  check('the station and mode reach storage unchanged',
    calls[0][1] === 'night-run' && calls[0][2] === 'disco', JSON.stringify(calls[0]));
}

{
  // The order matters: a publish reads the cruise back out of storage, so a
  // publish that ran first would hand the widgets the PREVIOUS station.
  const { mod, calls } = runRememberCruise();
  await mod.exports.rememberCruise({ stationId: 'coastal', mode: 'cd' });
  check('the cruise is stored BEFORE the widgets are told',
    calls[0][0] === 'save' && calls[1][0] === 'publish', JSON.stringify(calls));
}

{
  let threw = false;
  const { mod, calls } = runRememberCruise({ publishThrows: true });
  try { await mod.exports.rememberCruise({ stationId: 'sunset', mode: 'vinyl' }); }
  catch { threw = true; }
  check('a widget failure never costs the driver their place',
    !threw && calls[0][0] === 'save', threw ? 'rememberCruise rejected' : '');
}

/* ── 2. nothing may save the cruise without telling the widgets ── */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(path.join(root, 'src'));
check('the scan found the app', files.length > 50, `${files.length} files`);

const OWNERS = ['src/utils/lastCruise.ts', 'src/utils/rememberCruise.ts'];
const offenders = [];
let sawRemember = 0;
for (const f of files) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  const src = fs.readFileSync(f, 'utf8');
  if (/\brememberCruise\s*\(/.test(src)) sawRemember++;
  if (OWNERS.includes(rel)) continue;
  if (/\bsaveLastCruise\s*\(/.test(src)) offenders.push(rel);
}
check('every caller goes through rememberCruise, not saveLastCruise',
  offenders.length === 0, offenders.join(', '));
check('and the scan genuinely found those callers', sawRemember >= 4,
  `${sawRemember} files call rememberCruise`);

/* ── 3. a drive started from a widget is remembered and counted ── */

const cruiseSrc = fs.readFileSync(path.join(root, 'src/app/(tabs)/cruise.tsx'), 'utf8');
const consumer = /consumeDriveRequest\(\)[\s\S]*?\n {6}\}/.exec(cruiseSrc)?.[0] ?? '';
check('found the widget-tap handler', consumer.length > 200, `${consumer.length} chars`);
check('a widget tap remembers where it went', /\brememberCruise\s*\(/.test(consumer));
check('a widget tap counts as a session', /\brecordDriveStart\s*\(/.test(consumer));
check('a free taste of premium is not recorded as a drive',
  /needsPreview\s*\(/.test(consumer) && /if\s*\(!preview\)/.test(consumer));

/* ── 4. every doorway judges a taste the same way ── */

// `needsPreview` is one answer in one place because it is asked at every way
// in, and a doorway that forgets half of it is a doorway through the paywall.
// It used to be written inline as `!isPro && isProMode(mode)`, which was
// complete while only MODES were premium — pinning a widget to an FM station
// is the first way a free user can reach a premium STATION.
{
  const inline = [];
  let sawNeeds = 0;
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const src = fs.readFileSync(f, 'utf8');
    if (/\bneedsPreview\s*\(/.test(src)) sawNeeds++;
    if (rel === 'src/constants/modeCatalog.ts') continue;
    // The comparison itself, not a mention: `isProMode` is still the right
    // question for a MODE picker (ModeSheet dims a locked chip with it).
    if (/!\s*isPro[A-Za-z.]*\s*&&\s*isProMode\s*\(/.test(src)) inline.push(rel);
  }
  check('no doorway decides a taste for itself', inline.length === 0, inline.join(', '));
  check('and the scan found the doorways', sawNeeds >= 3, `${sawNeeds} files`);
}

/* ── 5. the padlock on the FM band has to lead somewhere ── */

// A DEAD PADLOCK WAS SEVEN OF THE TEN STATIONS (03.11). The row used to read
// `onPress={isPro ? () => setSelectedStation(station) : undefined}`, so a free
// user pressing Sunset got no page, no taste and no paywall: the dial is the
// app's biggest surface and it produced no paywall views at all. The lock
// belongs in the player (`needsPreview`, which `open` applies centrally), not
// in whether a row can be pressed — a row that cannot be pressed is the one
// shape that can never show anybody what sits behind the price.
{
  const stationsSrc = fs.readFileSync(path.join(root, 'src/app/(tabs)/stations.tsx'), 'utf8');
  const fmRow = /<BandHeader band="FM"[\s\S]*?\/>\s*\)\)\}/.exec(stationsSrc)?.[0] ?? '';
  check('found the FM band rows', fmRow.length > 200, `${fmRow.length} chars`);
  check('a locked FM row still opens its station page',
    /onPress=\{\(\) => setSelectedStation\(station\)\}/.test(fmRow) &&
    !/onPress=\{isPro \?/.test(fmRow));

  // Both station-page doorways judge the STATION, not just the mode: the
  // sheet's own `selectedIsLocked` only ever looked at the mode, so a free
  // mode on a premium station would be recorded as a real drive — saved as
  // the last cruise and counted toward the badges.
  for (const rel of ['src/app/(tabs)/stations.tsx', 'src/app/(tabs)/cruise.tsx']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const handler = /onStartDrive=\{\(mode, preview\) => \{[\s\S]*?\n {8}\}\}/.exec(src)?.[0] ?? '';
    check(`found ${rel.split('/').pop()}'s start handler`, handler.length > 150, `${handler.length} chars`);
    check(`${rel.split('/').pop()} judges the station, not only the mode`,
      /needsPreview\s*\(\s*isPro\s*,/.test(handler) && /if\s*\(!taste\)/.test(handler));
  }
}

/* ── 6. the gate names what is locked, and carries it to the paywall ── */

// The card used to say "<mode> is a Premium mode" whatever the session was,
// which was only ever safe because a premium STATION could not be reached.
// With the row open, a free mode on a premium station would have announced
// "Cassette is a Premium mode" — and Cassette is free.
{
  const gate = fs.readFileSync(path.join(root, 'src/components/PreviewGate.tsx'), 'utf8');
  check('the gate asks about the station too', /isProStation\s*\(/.test(gate));
  check('the gate says "Premium station" when that is what is locked',
    /Premium station/.test(gate) && /are both Premium/.test(gate));
  check('and it no longer hardcodes the mode wording',
    !/\{label\} is a Premium mode/.test(gate));
  check('See Premium carries what they were looking at',
    /router\.push\(\{\s*pathname: '\/premium'/.test(gate) && /params\.scene = mode/.test(gate));
  // The session still has to END: a preview left alive could be resumed from
  // the mini-player, which is a hole straight through the paywall.
  check('and the taste still ends', /np\.stop\(\);/.test(gate));
}

/* ── 7. the paywall opens on the mode they were tasting ── */

{
  const show = fs.readFileSync(path.join(root, 'src/components/PaywallShowcase.tsx'), 'utf8');
  const ids = [...show.matchAll(/\{ id: '([a-z]+)', label: '[^']+' \}/g)].map((m) => m[1]);
  check('read the showcase scenes', ids.length >= 5, ids.join(', '));
  check('the showcase takes a starting scene', /startWith\?: string/.test(show));
  check('and offsets the rotation by it',
    /SCENES\.findIndex\(\(sc\) => sc\.id === startWith\)/.test(show) &&
    /\(startAt \+ slot\) % SCENES\.length/.test(show));
  check('a requested scene holds before rotating', /const hold = asked >= 0 \? HOLD_S : 0;/.test(show));

  // The arithmetic itself, replicated against the real scene list: the named
  // scene must be the FIRST one shown, an unknown id must fall back to the
  // normal rotation rather than blanking the stage, and it must still wrap.
  const SCENE_S = Number(/const SCENE_S = ([\d.]+)/.exec(show)[1]);
  const HOLD_S = Number(/const HOLD_S = ([\d.]+)/.exec(show)[1]);
  check('read the scene timings', SCENE_S > 0 && HOLD_S > 0, `scene ${SCENE_S}s, hold ${HOLD_S}s`);

  // The rule as the component computes it, replicated against the real
  // scene list and the real timings.
  const sceneAtTime = (startWith, t) => {
    const asked = ids.findIndex((id) => id === startWith);
    const startAt = Math.max(0, asked);
    const hold = asked >= 0 ? HOLD_S : 0;
    const firstLen = SCENE_S + hold;
    const inFirst = hold > 0 && t < firstLen;
    const slot = inFirst ? 0 : hold > 0 ? 1 + Math.floor((t - firstLen) / SCENE_S) : Math.floor(t / SCENE_S);
    return ids[(startAt + slot) % ids.length];
  };
  check('a named mode is the first thing shown',
    sceneAtTime('cd', 0) === 'cd' && sceneAtTime('disco', 0) === 'disco');
  // THE HEADLINE AND THE PICTURE MUST STILL AGREE WHILE SOMEBODY READS IT.
  // At the plain 4.2s dwell the stage had moved on to another mode before
  // the sentence naming this one had been read.
  check('and it is still on screen ten seconds in',
    sceneAtTime('cd', 10) === 'cd' && sceneAtTime('disco', 10) === 'disco');
  check('then the rotation takes over',
    sceneAtTime('cd', SCENE_S + HOLD_S + 0.1) === ids[(ids.indexOf('cd') + 1) % ids.length]);
  check('an unknown or free mode keeps the normal rotation',
    sceneAtTime('cassette', 0) === ids[0] && sceneAtTime(undefined, 0) === ids[0]);
  // With nothing requested the timings must be exactly what they were.
  check('and an unasked showcase is unchanged',
    sceneAtTime(undefined, SCENE_S * 2 + 0.1) === ids[2] &&
    sceneAtTime(undefined, SCENE_S * 5 + 0.1) === ids[0]);
  check('the rotation still wraps', sceneAtTime('cd', SCENE_S * ids.length + HOLD_S + 0.1) === 'cd');

  const paywall = fs.readFileSync(path.join(root, 'src/app/premium.tsx'), 'utf8');
  check('the paywall reads what brought them', /useLocalSearchParams/.test(paywall));
  check('it passes the scene to the showcase', /startWith=\{scene\}/.test(paywall));
  check('and it names the thing they came for', /Unlock \$\{focus\}/.test(paywall));
}

console.log(`\n${failures === 0 ? 'ALL GOOD' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
