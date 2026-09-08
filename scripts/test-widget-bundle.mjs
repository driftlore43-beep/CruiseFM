/**
 * THE WIDGET BUNDLE'S OWN WIRING, checked where it is checkable.
 *
 * Swift cannot be compiled in this environment, so a mistake in the extension
 * is invisible until a build runs — and a build costs a review cycle. These
 * are the errors that have actually happened here, or are one slip away:
 *
 *   A WIDGET WRITTEN BUT NEVER REGISTERED. It compiles, it ships, and it is
 *   simply absent from the gallery with nothing logged anywhere.
 *
 *   A CONFIGURABLE WIDGET REGISTERED WITHOUT ITS FALLBACK, or the pair given
 *   different `kind`s. The kind is what iOS uses to keep a widget already on
 *   someone's Home Screen; a changed one makes it vanish, which is why the
 *   Deck's pair share "CruiseFMVinyl" (build 39 had already placed it).
 *
 *   AN AppIntentConfiguration NOT MARKED iOS 17+. It does not exist before
 *   then, so an unguarded one fails to build for older deployment targets.
 *
 *   A LOOK CASE LEFT BEHIND. The owner dropped the Deck's third look on
 *   03.09; a `case .set` surviving in a switch is a compile error, and a
 *   stale DisplayRepresentation is a setting that offers something that
 *   cannot be drawn.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'targets/widgets';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.swift'));
const src = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]));
const src_ = src;
const all = Object.values(src).join('\n');
const bundle = src['CruiseWidgetBundle.swift'] ?? '';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `  ${detail}`}`);
  if (!ok) fails += 1;
};

console.log('\n  the extension is wired up:');
check('found the Swift', files.length >= 8, `${files.length} files`);
check('there is a @main entry point', /@main/.test(bundle));

// ── THE BUNDLE BODY MAY NOT CONTAIN AN `else` ─────────────────────────────
//
// THIS IS THE CHECK BUILD 40 DIED FOR WANT OF. `@WidgetBundleBuilder` is not
// `@ViewBuilder`: it supplies `buildOptional`, so `if #available { … }` with
// no else compiles, but it supplies no `buildEither`, so adding an `else`
// rejects the entire body with "closure containing control flow statement
// cannot be used with result builder 'WidgetBundleBuilder'". The shape reads
// perfectly well and cannot be compiled here, which is exactly the kind of
// mistake this file exists to catch.
//
// AND THE OLD VERSION OF THIS TEST ASSERTED THE BROKEN SHAPE. It required
// `if #available(…) { … } else {` to be present in the bundle — so it was
// holding the fault in place and reporting it as correct. A check that pins
// your assumption rather than the property is worse than no check, because it
// is read as evidence.
const bundleBodies = Object.fromEntries(
  [...bundle.matchAll(/struct (\w+): WidgetBundle \{([\s\S]*?)\n\}/g)].map((m) => [m[1], m[2]]));
check('the bundles are declared', Object.keys(bundleBodies).length >= 1,
  Object.keys(bundleBodies).join(', '));
const decomment = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
for (const [name, body] of Object.entries(bundleBodies)) {
  // Comments stripped first: the bundle's own note explains why there must
  // never be an `else`, and a check that trips over its own documentation is
  // noise rather than a finding.
  check(`${name}: no else inside the WidgetBundleBuilder`, !/\belse\b/.test(decomment(body)),
    'WidgetBundleBuilder has no buildEither — an else here fails to compile');
}

// ── every declared Widget is registered, and vice versa ───────────────────
const declared = [...all.matchAll(/struct (\w+): Widget \{/g)].map((m) => m[1]);
const registered = [...bundle.matchAll(/^\s*(\w+)\(\)\s*$/gm)].map((m) => m[1])
  .filter((n) => declared.includes(n));
check('found the widget structs', declared.length >= 5, declared.join(', '));
for (const w of declared) {
  check(`${w} is registered in the bundle`, registered.includes(w));
}

// ── kinds: each pair shares one, and nothing else collides ────────────────
const kinds = {};
for (const [f, s] of Object.entries(src)) {
  for (const m of s.matchAll(/(?:StaticConfiguration|AppIntentConfiguration)\(kind: "([^"]+)"/g)) {
    (kinds[m[1]] ??= []).push(f);
  }
}
check('every widget declares a kind', Object.keys(kinds).length >= 5, Object.keys(kinds).join(', '));
for (const [kind, where] of Object.entries(kinds)) {
  // Two is the configurable/fallback pair and must be in ONE file; three is a
  // mistake, and two across two files means an unrelated widget collided.
  const ok = where.length === 1 || (where.length === 2 && where[0] === where[1]);
  check(`kind "${kind}" is used by one widget`, ok, where.join(' + '));
}

// ── a configurable widget always has a fallback, both guarded correctly ───
for (const [f, s] of Object.entries(src)) {
  if (!/AppIntentConfiguration\(kind:/.test(s)) continue;
  const kind = s.match(/AppIntentConfiguration\(kind: "([^"]+)"/)[1];
  check(`${f}: has a pre-17 fallback on the same kind`,
    new RegExp(`StaticConfiguration\\(kind: "${kind}"`).test(s));
  // The struct holding the AppIntentConfiguration must be availability-gated.
  const guarded = /@available\(iOSApplicationExtension 17\.0, \*\)\s*\nstruct \w+: Widget \{\s*\n\s*var body: some WidgetConfiguration \{\s*\n\s*AppIntentConfiguration/.test(s);
  check(`${f}: the configurable widget is marked iOS 17+`, guarded);
  // The property that matters is not HOW the choice is written but that only
  // ONE of the pair is ever registered — two widgets sharing a `kind` in one
  // bundle is a duplicate registration. Since the `else` is gone, the split is
  // made by putting each half in a different bundle, and that is what is
  // checked: the modern one and the legacy one, never both in either.
  const intentName = s.match(/struct (\w+): Widget \{\s*\n\s*var body: some WidgetConfiguration \{\s*\n\s*AppIntentConfiguration/)?.[1];
  const staticName = s.match(new RegExp(
    `struct (\\w+): Widget \\{\\s*\\n\\s*var body: some WidgetConfiguration \\{\\s*\\n\\s*StaticConfiguration\\(kind: "${kind}"`))?.[1];
  check(`${f}: both halves of the pair are named`, !!intentName && !!staticName,
    `intent ${intentName}, static ${staticName}`);
  if (intentName && staticName) {
    const homes = (w) => Object.entries(bundleBodies)
      .filter(([, body]) => new RegExp(`^\\s*${w}\\(\\)\\s*$`, 'm').test(body)).map(([n]) => n);
    const inIntent = homes(intentName), inStatic = homes(staticName);
    check(`${f}: each half is registered exactly once`,
      inIntent.length === 1 && inStatic.length === 1,
      `${intentName} in [${inIntent}], ${staticName} in [${inStatic}]`);
    check(`${f}: the pair is split across two bundles`,
      inIntent.length === 1 && inStatic.length === 1 && inIntent[0] !== inStatic[0],
      `both in ${inIntent[0]} would register one kind twice`);
  }
}

// ── every AppEnum look has a display representation for each case ─────────
for (const [f, s] of Object.entries(src)) {
  for (const em of s.matchAll(/enum (\w+): String, AppEnum \{([\s\S]*?)\n\}/g)) {
    const [, name, body] = em;
    const cases = [...body.matchAll(/^\s*case (\w+)\s*$/gm)].map((m) => m[1]);
    const reps = [...body.matchAll(/\.(\w+): DisplayRepresentation\(/g)].map((m) => m[1]);
    check(`${name}: every case has a name people see`,
      cases.length > 0 && cases.every((c) => reps.includes(c)),
      `cases ${cases.join(',')} / shown ${reps.join(',')}`);
    check(`${name}: nothing is offered that no longer exists`,
      reps.every((r) => cases.includes(r)),
      `shown ${reps.join(',')} / cases ${cases.join(',')}`);
    // The style enum the drawing switches on must carry the same cases, or a
    // look silently falls through to the default.
    // SEARCH EVERY FILE, NOT THIS ONE. DeckStyle lives in VinylWidget.swift
    // while DeckLook lives in DeckLook.swift, so a same-file search skipped
    // the Deck silently — and the Deck is exactly where a look was just
    // removed. A check that quietly matches nothing is worse than no check.
    const styleName = name.replace(/Look$/, 'Style');
    const sm = all.match(new RegExp(`enum ${styleName} \\{ case ([^}]+)\\}`));
    check(`${styleName} exists to switch on`, !!sm);
    if (sm) {
      const styles = sm[1].split(',').map((x) => x.trim()).filter(Boolean);
      check(`${styleName} matches ${name} case for case`,
        styles.length === cases.length && cases.every((c) => styles.includes(c)),
        `${styles.join(',')} vs ${cases.join(',')}`);
    }
  }
}

// ── nothing declared twice ───────────────────────────────────────────────
// Every file here compiles into ONE module, so two files each declaring a
// `Triangle` is a redeclaration error — the sort of thing Swift catches in a
// second and this environment cannot catch at all. Both new widgets wanted a
// play triangle and a disc; they share one of each because of this check.
{
  const names = [...all.matchAll(/^(?:private )?(?:struct|enum|func) (\w+)/gm)].map((m) => m[1]);
  const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  check('nothing is declared twice across the target', dupes.length === 0, dupes.join(', '));
}

// ── the look the owner dropped is gone everywhere ────────────────────────
check('the Deck\'s dropped third look is gone', !/DeckLook\.set|case \.set:|case set\b/.test(all),
  'a stale `set` case would not compile and would offer a look nothing draws');

// ── the needle points where the station actually is ──────────────────────
// THIS IS THE WIDGET'S ONE FACTUAL CLAIM. Everything else on the dial is a
// printed face; the needle says "your station is HERE on the band". It was
// pinned at a hardcoded 38% when this shipped, which is a lie dressed as an
// instrument, so the arithmetic is mirrored here and checked against the
// bands the app's own Tuner uses (BAND_CFG: FM 87.5–108.5, AM 530–1600).
{
  const swift = src['OnAirWidget.swift'] ?? '';
  check('the needle is derived, not hardcoded',
    /w \* position/.test(swift) && !/w \* 0\.38/.test(swift),
    'a fixed offset would point at the wrong frequency for every station');

  // The same rule, written out, so the numbers can be checked.
  const place = (dial) => {
    const [number, band = ''] = dial.split(' ');
    const v = parseFloat(number);
    if (!(v > 0)) return 0.5;
    const [lo, hi] = band.toUpperCase().startsWith('F') ? [87.5, 108.5] : [530, 1600];
    return Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  };
  const cases = [
    ['530 AM', 0], ['1600 AM', 1], ['1065 AM', 0.5],
    ['87.5 FM', 0], ['108.5 FM', 1], ['98 FM', 0.5],
    ['810 AM', 0.2617],           // Night Run, a real one
  ];
  for (const [dial, want] of cases) {
    check(`${dial} lands at ${(want * 100).toFixed(0)}% of its band`,
      Math.abs(place(dial) - want) < 0.001, place(dial).toFixed(4));
  }
  // A dial it cannot read parks in the MIDDLE, never at an edge: the middle
  // reads as "somewhere here", an edge reads as a specific wrong answer.
  for (const bad of ['', 'AM', '—', 'zero FM']) {
    check(`an unreadable dial (${JSON.stringify(bad)}) parks in the middle`, place(bad) === 0.5);
  }
}

// ── no widget can show an empty picture slot ─────────────────────────────
// The album cover only exists once someone has driven with a service that
// reports the track, which for most listeners is never — Spotify caps full
// playback at five accounts. So every slot that draws a cover has to say what
// it draws when there isn't one, and "nothing" is not an answer: the first
// cut fell back to a grey rectangle, an empty hole, and a flat accent disc in
// three different widgets.
{
  const drawers = ['LastPlayedWidget.swift', 'ModeWidget.swift', 'VinylWidget.swift'];
  for (const f of drawers) {
    const swift = src[f] ?? '';
    if (!/Art\.(cover|lastPlayed)\(/.test(swift)) continue;
    check(`${f}: never falls back to a grey slab`,
      !/Color\(white: 0\.8\d?\)\)\.padding/.test(swift),
      'a grey rectangle reads as broken rather than as empty');
    // Every `if let art = ...` that draws a picture needs an else.
    const opens = (swift.match(/if let art = Art\.\w+\(/g) || []).length;
    const elses = (swift.match(/if let art = Art\.\w+\([\s\S]{0,320}?\} else \{/g) || []).length;
    check(`${f}: every cover has something to fall back to`, opens === elses,
      `${opens} slot(s), ${elses} with a fallback`);
  }
  // THE ORDER IS THE DECISION, not an implementation detail, and there are two
  // of them. Flipping the terms of a `??` is invisible in review and would
  // undo an owner's call silently, so both are pinned — and so is WHICH
  // widget uses WHICH, because the two helpers differ by one word and reading
  // the wrong one at a call site would look perfectly fine.
  const art = src['Artwork.swift'] ?? '';
  check('the general rule is station first, cover second',
    /static func cover\(station id: String\?\) -> Image\? \{\s*station\(id\) \?\? lastPlayed\(\)/.test(art),
    'the owner chose this "so people can add their photos in"');
  check('the CD\'s rule is cover first, station second',
    /static func songCover\(station id: String\?\) -> Image\? \{\s*lastPlayed\(\) \?\? station\(id\)/.test(art),
    'owner, 03.09: "I\'d rather keep the album art for the cd mode"');
  check('only the CD uses the song-first rule',
    (all.match(/Art\.songCover\(/g) || []).length === 1,
    'a second caller means someone reached for whichever helper was nearer');
  check('the CD is the one that calls it',
    /Art\.songCover\(/.test(src['ModeWidget.swift'] ?? ''));
  // The Deck's Road look must NOT use it — the station photo is already its
  // backdrop, so the same picture would appear twice at two sizes.
  check('the Deck\'s Road look does not print the backdrop twice',
    !/Art\.cover\(/.test(src['VinylWidget.swift'] ?? ''));
}

// ── a check that cannot fail is worse than none ──────────────────────────
if (declared.length < 5 || Object.keys(kinds).length < 5) {
  console.error('\n  the scan looks empty — fix the scan, not the code.');
  process.exit(1);
}


// ── a modifier may not be chained onto an if/else ────────────────────────
//
// THIS IS WHAT BUILD 40 AND BUILD 41 DIED ON, and the shape reads perfectly:
//
//     if family == .systemSmall { … } else { … }
//     .padding(family == .systemSmall ? 13 : 16)
//
// Inside a @ViewBuilder an if/else is a STATEMENT, not an expression, so
// there is no view for the modifier to attach to. Swift reports it as
// "instance member 'padding' cannot be used on type 'View'" — a message that
// names neither the file nor the conditional, which is why two rounds went on
// reading the wrong files. The fix is either a `Group { }` around the
// conditional or the modifier inside each branch.
//
// Swift cannot be compiled here, so this file is the compiler. Checked
// structurally rather than by any keyword: a modifier line whose immediately
// preceding sibling is a closing brace AT THE SAME INDENT, where that brace
// closes a conditional.
{
  const strip = (t) => t.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/.*$/, '');
  for (const [f, src] of Object.entries(src_)) {
    const L = src.split('\n');
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/^(\s+)\.[A-Za-z_]\w*\s*\(/);
      if (!m) continue;
      const indent = m[1].length;
      // nearest real line above
      let j = i - 1;
      while (j >= 0 && (!L[j].trim() || L[j].trim().startsWith('//'))) j--;
      if (j < 0) continue;
      if (L[j].trim() !== '}' || (L[j].match(/^\s*/) || [''])[0].length !== indent) continue;
      // walk back to the brace this one closes
      let depth = 0, opener = -1;
      for (let k = j; k >= 0; k--) {
        const t = strip(L[k]);
        for (let c = t.length - 1; c >= 0; c--) {
          if (t[c] === '}') depth++;
          else if (t[c] === '{') { depth--; if (depth === 0) { opener = k; break; } }
        }
        if (opener >= 0) break;
      }
      if (opener < 0) continue;
      const head = L[opener].trim();
      if (/^(if |switch |\} else\b|else \{)/.test(head)) {
        check(`${f}:${i + 1} does not chain a modifier onto a conditional`, false,
          `\`${L[i].trim()}\` follows \`${head}\` — wrap it in Group { } or move it into each branch`);
      }
    }
  }
  check('checked every Swift file for modifiers on conditionals',
    Object.keys(src_).length >= 8, `${Object.keys(src_).length} files`);
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the widget bundle hangs together\n');
process.exit(fails ? 1 : 0);
