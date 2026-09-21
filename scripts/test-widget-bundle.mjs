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
  // made by putting each half in a different bundle.
  //
  // THERE ARE FOUR BUNDLES NOW, NOT TWO, and this check said so the moment
  // there were: the iPad gets its own list with Start Drive left out (13.09),
  // so each half legitimately appears in two of them. "Registered exactly
  // once, in a different bundle from its twin" was never the property — it
  // was the shape the property happened to have while there were two
  // bundles, which is the same class of mistake as the `else` this file
  // replaced. Only ONE bundle ever runs in a process, so what actually
  // matters is: each half is reachable somewhere, no single bundle holds
  // both, and no bundle lists either twice.
  const intentName = s.match(/struct (\w+): Widget \{\s*\n\s*var body: some WidgetConfiguration \{\s*\n\s*AppIntentConfiguration/)?.[1];
  const staticName = s.match(new RegExp(
    `struct (\\w+): Widget \\{\\s*\\n\\s*var body: some WidgetConfiguration \\{\\s*\\n\\s*StaticConfiguration\\(kind: "${kind}"`))?.[1];
  check(`${f}: both halves of the pair are named`, !!intentName && !!staticName,
    `intent ${intentName}, static ${staticName}`);
  if (intentName && staticName) {
    const timesIn = (w, body) =>
      (body.match(new RegExp(`^\\s*${w}\\(\\)\\s*$`, 'gm')) ?? []).length;
    const homes = (w) => Object.entries(bundleBodies)
      .filter(([, body]) => timesIn(w, body) > 0).map(([n]) => n);
    const inIntent = homes(intentName), inStatic = homes(staticName);
    check(`${f}: both halves are registered somewhere`,
      inIntent.length >= 1 && inStatic.length >= 1,
      `${intentName} in [${inIntent}], ${staticName} in [${inStatic}]`);
    const together = Object.entries(bundleBodies)
      .filter(([, body]) => timesIn(intentName, body) > 0 && timesIn(staticName, body) > 0)
      .map(([n]) => n);
    check(`${f}: no bundle holds both halves`, together.length === 0,
      `${together} would register kind "${kind}" twice in one process`);
    const doubled = Object.entries(bundleBodies)
      .filter(([, body]) => timesIn(intentName, body) > 1 || timesIn(staticName, body) > 1)
      .map(([n]) => n);
    check(`${f}: no bundle lists a half twice`, doubled.length === 0, String(doubled));
  }
}

// ── a bundle nobody launches is a list that never reaches the gallery ─────
// Four bundles are picked between by plain statements in `main()`, above the
// result builder, so a new one is easy to write and just as easy to leave
// unreachable — which looks exactly like a widget that failed to appear.
for (const name of Object.keys(bundleBodies)) {
  check(`${name} is reachable from main()`,
    new RegExp(`\\b${name}\\.main\\(\\)`).test(bundle), 'declared but never launched');
}

// ── a placeholder must be real content, not an empty entry ───────────────
// WidgetKit draws `placeholder` REDACTED: every piece of text becomes a grey
// capsule. So a placeholder built from nothing renders as a blank grey tile —
// which is indistinguishable from a widget that failed outright, and is
// exactly what the owner could not find a cause for on 14.09. Reading the
// snapshot costs one synchronous read the timeline makes anyway, and it lets
// the two cases tell themselves apart.
for (const [f, s2] of Object.entries(src)) {
  for (const m of s2.matchAll(/func placeholder\(in [^)]*\) -> (\w+) \{([\s\S]*?)\n  \}/g)) {
    const [, type, body] = m;
    // JUST LOOK FOR `ready: false` IN THE BODY. The first version of this
    // matched `${type}\\([^)]*ready: false`, and a bracket class cannot cross
    // the `)` in `Date()` — so it never matched the one shape it exists to
    // catch and passed on the real fault when that was put back deliberately.
    // The negative test is the only reason it was noticed.
    check(`${f}: ${type} placeholder is not an empty entry`,
      !/ready:\s*false/.test(body.replace(/\/\/.*$/gm, '')),
      'a redacted empty entry IS the blank grey tile');
  }
}

// ── a small tile is not 158 points everywhere ─────────────────────────────
// Every hero size in The Mode was a constant tuned against an iPhone's ~158pt
// small widget — and a small widget is about 141 on a 768x1024 iPad, SMALLER
// than a phone's. A 144pt record in a 141pt tile is wider than the tile it
// sits in, which is what the owner photographed on 14.09; the CD's disc had
// the same fault against the jewel case's own interior. They are shares of
// the tile now, so this refuses a bare number creeping back in.
{
  const mode = src['ModeWidget.swift'] ?? '';
  // Match to the END OF THE LINE, not to the first `)`. CompactDisc's own
  // argument list contains a call (`Art.songCover(station:)`), so a lazy
  // bracket match stopped inside it and the check silently tested two heroes
  // out of three — a pass that costs nothing, which this file has shipped
  // more than once. The count assertion below is what caught it.
  const heroes = [...mode.matchAll(/^\s*(MirrorBall|CompactDisc|RecordView)\((.*)$/gm)]
    .filter((m) => /\bsize:/.test(m[2]));
  check('the three heroes are found at all', heroes.length >= 3,
    heroes.map((m) => m[1]).join(', '));
  for (const m of heroes) {
    const size = m[2].match(/size:\s*([^,)]+)/)?.[1]?.trim() ?? '';
    check(`${m[1]} sizes off the tile, not a constant`, /\bk\b/.test(size), `size: ${size}`);
  }
  // ...AND THE CD'S CASE IS A HERO'S FRAME, so it has to scale with the tile
  // too. Noted and not fixed on 15.09: `k` reached the three heroes and never
  // reached JewelCase, so on a 141pt iPad tile the disc came down to 117.7
  // while the case interior stayed 119 — a pressing touching its own hinge.
  // The clearance is what this is protecting, not the look.
  check('the jewel case scales with the tile', /JewelCase\(k: k\)/.test(mode),
    'a fixed-point case around a k-sized disc closes the gap on a small tile');
  for (const [name, re] of [['caseInset', /private var caseInset: CGFloat \{ [\d.]+ \* k \}/],
                            ['caseRadius', /private var caseRadius: CGFloat \{ [\d.]+ \* k \}/]]) {
    check(`${name} is a share of the tile`, re.test(mode),
      'a bare number here is the fault 15.09 wrote down and did not fix');
  }

  check('ModeView measures the tile', /GeometryReader \{ geo in/.test(mode) &&
    /min\(geo\.size\.width, geo\.size\.height\) \/ 158/.test(mode),
    'the 158 reference is what k is a share of');

  // ...AND THE MEASUREMENT MUST NOT COST THE CENTRING. A GeometryReader
  // aligns its content to `.topLeading`, not centre, and two of these three
  // heroes hold a child that insists on being bigger than the tile (the
  // ball's 190k beams, the CD's 192k glow). Pinned top-leading, that whole
  // overflow hangs off the bottom and the right and drags the object with
  // it — measured at 12-15% of the tile low off the owner's own screenshots
  // on 15.09, against 12.7% predicted. Framing the content to `geo.size`
  // puts it back; without it, adding `k` silently moved two widgets.
  check('ModeView centres its hero in the tile it measured',
    /\}\s*\n\s*\.frame\(width: geo\.size\.width, height: geo\.size\.height\)/.test(mode),
    'GeometryReader aligns top-leading — the hero needs an explicit frame');

  // ...AND NOR MAY A HERO BE NUDGED SIDEWAYS OFF IT. The CD's disc was
  // deliberately pushed 6pt right to sit in the middle of the case's INTERIOR
  // rather than the middle of the tile, since the hinge spine eats 12pt of
  // the left. Measured off the owner's own screenshot on 15.09 the geometry
  // was exact — 20px right of centre on a 523px render, i.e. 6.0pt — and the
  // spine it was clearing measured DEAD FLAT (72.7 down to 68.5 across x 2 to
  // x 24), so the offset was clearing a wall nobody can see while plainly
  // putting the disc off centre in its square. A widget is read against the
  // TILE's edges; nothing here may sit off that centre horizontally.
  //
  // The vertical `.offset(y:)` on the ball's stem and its group is left
  // alone — those position parts WITHIN a hero, not the hero within the tile.
  //
  // SCOPED TO ModeView's OWN THREE DRAWING FUNCTIONS, deliberately: inside a
  // hero (CompactDisc's gripper holes, say) an x-offset is how a part is
  // placed against its own object and is none of this check's business.
  {
    const start = mode.indexOf('struct ModeView');
    const end = mode.indexOf('private struct BeamField');
    const body = start >= 0 && end > start ? mode.slice(start, end) : '';
    check('the hero-placement code was actually read', body.length > 2000,
      `${body.length} chars between ModeView and BeamField`);
    // A LINE THAT *STARTS* WITH `.offset(` is placing the hero itself; one
    // that reaches it part-way along a chain (`.frame(...).offset(...)`, the
    // ball's stem inside its own overlay) is placing a PART within the hero,
    // which is none of this check's business. That is the whole distinction,
    // and it is why the rule is written against the start of the line.
    const nudged = [...body.matchAll(/^[ \t]*\.offset\(.*$/gm)]
      .map((m) => m[0].trim())
      .filter((l) => !/^\.offset\((x|y): 0[,)]/.test(l));
    check('no hero is nudged off the tile\'s own centre', nudged.length === 0,
      nudged.join(' | ') || 'none');
  }
}

// ── no widget may ask for a reload the instant it is handed over ──────────
// `.atEnd` on a timeline whose last entry is stamped `now` means "reload
// immediately", every time, for ever. iOS answers that by cutting the tile's
// refresh budget, and a tile with no budget shows the grey placeholder rather
// than anything the extension drew — which is what the owner photographed on
// 15.09, a square On Air tile stuck in placeholder beside a wide one drawing
// the same data fine. On Air was the ONLY widget in the target using `.atEnd`.
// It may still use it while there are real changeovers ahead; a timeline that
// has run out has to schedule instead.
{
  let scanned = 0;
  const offenders = [];
  for (const [f, s] of Object.entries(src)) {
    if (!/TimelineProvider|AppIntentTimelineProvider|Timeline\(/.test(s)) continue;
    scanned++;
    for (const m of s.matchAll(/^.*policy:\s*\.atEnd.*$/gm)) {
      if (/^\s*(\/\/|\*)/.test(m[0])) continue;
      // Guarded by an entry count is the shape that is safe: it can only be
      // reached while there is a FUTURE entry to wait for.
      if (/entries\.count > 1/.test(s)) continue;
      offenders.push(`${f}: ${m[0].trim()}`);
    }
  }
  check('the timeline providers were actually read', scanned >= 3, `${scanned} files`);
  check('no widget asks for an immediate reload when its timeline has run out',
    offenders.length === 0, offenders.join(' | ') || 'none');
}

// ── nothing may call onAir.first the CURRENT station ──────────────────────
// `onAir` is a TIMELINE — entry 0 is "now" as of when the app wrote it, and
// the rest are the day's changeovers. Reading entry 0 as the station on air
// is only true while the snapshot is fresh; hours later it names a station
// that went off air before lunch, and that is what the owner reported on
// 15.09 as every widget being "stuck" on After Hours FM (a 23:00-05:00
// station) in the afternoon. It does not read as a wrong station, it reads
// as a widget that has stopped working. Snapshot.currentOnAir(at:) picks the
// last changeover that has actually happened; this refuses the old shape.
{
  const offenders = [];
  let scanned = 0;
  for (const [f, s] of Object.entries(src)) {
    if (f === 'Snapshot.swift') continue;   // the note there quotes the old form
    scanned++;
    for (const m of s.matchAll(/^.*\bonAir\.first\b.*$/gm)) {
      if (/^\s*(\/\/|\*)/.test(m[0])) continue;   // a comment about it is fine
      offenders.push(`${f}: ${m[0].trim()}`);
    }
  }
  // A regex that quietly matched nothing would pass every case vacuously —
  // this is the guard that caught exactly that in the hero check above.
  check('the widget sources were actually read', scanned >= 5, `${scanned} files`);
  check('no widget treats onAir.first as the current station',
    offenders.length === 0, offenders.join(' | '));
  check('Snapshot offers the honest one instead',
    /func currentOnAir\(/.test(src['Snapshot.swift'] ?? '') &&
    /func currentOnAirIndex\(/.test(src['Snapshot.swift'] ?? ''),
    'currentOnAir(at:) / currentOnAirIndex(at:)');
  // ...and the timeline must date the CURRENT entry, not entry 0.
  check('the On Air timeline starts from the current changeover',
    /currentOnAirIndex\(at: now\)/.test(src['OnAirWidget.swift'] ?? '') &&
    !/let date = i == 0 \? now : when/.test(src['OnAirWidget.swift'] ?? ''),
    'entry 0 is only "now" while the snapshot is fresh');
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
    // Name every helper that can DRAW, or a rename quietly takes a file out
    // of this check and it reports a pass for a file it never looked at.
    if (!/Art\.(songCover|station|lastPlayed)\(/.test(swift)) continue;
    check(`${f}: never falls back to a grey slab`,
      !/Color\(white: 0\.8\d?\)\)\.padding/.test(swift),
      'a grey rectangle reads as broken rather than as empty');
    // Every `if let art = ...` that draws a picture needs an else.
    const opens = (swift.match(/if let art = Art\.\w+\(/g) || []).length;
    const elses = (swift.match(/if let art = Art\.\w+\([\s\S]{0,320}?\} else \{/g) || []).length;
    check(`${f}: every cover has something to fall back to`, opens === elses,
      `${opens} slot(s), ${elses} with a fallback`);
  }
  // THE ORDER IS THE DECISION, not an implementation detail. Flipping the
  // terms of a `??` is invisible in review and would undo an owner's call
  // silently, so it is pinned — and so is WHICH WIDGET IS ABOUT WHAT, because
  // that is the distinction the two rules encode and a call site reaching for
  // the wrong one would look perfectly fine.
  const art = src['Artwork.swift'] ?? '';
  check('the song-first rule is cover first, station second',
    /static func songCover\(station id: String\?\) -> Image\? \{\s*lastPlayed\(\) \?\? station\(id\)/.test(art),
    'the station is the fallback, so no cover still means a real picture');
  // 20.09: the station-first rule was deleted when Last Played flipped to the
  // song, because nothing was left calling it. Reintroducing it is allowed —
  // it is the owner's call — but it must come back with a caller, not sit
  // there looking like working machinery.
  check('the station-first rule is gone rather than unused',
    !/static func cover\(station/.test(art) && !/Art\.cover\(/.test(all),
    'a helper nothing calls reads as a decision that was made, and was not');
  // A SONG widget draws the song; a STATION widget draws the station. The
  // Deck's Road look is the sharpest case: the station photo is already its
  // backdrop, so drawing a cover there is not merely wrong, it is the one
  // place a picture would also appear twice at two sizes.
  const songWidgets = ['LastPlayedWidget.swift', 'ModeWidget.swift'];
  const stationWidgets = ['OnAirWidget.swift', 'StartDriveWidget.swift', 'VinylWidget.swift'];
  for (const f of songWidgets) {
    check(`${f}: a song widget draws the song's cover`,
      /Art\.songCover\(/.test(src[f] ?? ''),
      'it is named after the song, so the song is what it shows');
  }
  for (const f of stationWidgets) {
    check(`${f}: a station widget never draws the song's cover`,
      !/Art\.songCover\(/.test(src[f] ?? ''),
      'the station is the subject there, and on the Deck it is already the backdrop');
    check(`${f}: and does draw the station`,
      /Art\.station\(/.test(src[f] ?? ''),
      'if this stops matching the check above passes for the wrong reason');
  }
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

// ── a Home Screen widget fills its tile ──────────────────────────────────
//
// From iOS 17 WidgetKit insets a widget's content before drawing it, and the
// ring left over shows the container background — which every view here hands
// back as `.clear`, so on a Home Screen it reads as a pale border around the
// design. That is what build 43 looked like on the owner's phone, and it also
// quietly broke an instruction from 03.09 ("create the Winamp as if it's the
// shape of the widget"), because a window that fills its VIEW still cannot
// fill the TILE while the system is holding the view away from the edges.
//
// The property, rather than the call: any configuration offering a `.system`
// family disables the margin, and the Lock Screen's accessory families must
// NOT — their margin is what keeps text off the system's own curve.
{
  let seen = 0;
  for (const [f, s] of Object.entries(src_)) {
    const L = s.split('\n');
    for (let i = 0; i < L.length; i++) {
      const m = L[i].match(/\.supportedFamilies\(\[([^\]]*)\]\)/);
      if (!m) continue;
      seen += 1;
      // the next line that is neither blank nor a comment
      let j = i + 1;
      while (j < L.length && (!L[j].trim() || L[j].trim().startsWith('//'))) j++;
      const next = j < L.length ? L[j].trim() : '';
      const bleeds = next === '.cruiseFullBleed()';
      const home = /\.system/.test(m[1]);
      check(`${f}:${i + 1} ${home ? 'fills its tile' : 'keeps the accessory margin'}`,
        home ? bleeds : !bleeds,
        home ? `add .cruiseFullBleed() after supportedFamilies` : `remove .cruiseFullBleed()`);
    }
  }
  // A regex that quietly matched nothing would pass every case vacuously —
  // the seventh time this file has had to say so.
  check('and it actually found the configurations', seen >= 9, `${seen} found`);
  check('cruiseFullBleed is defined once, unguarded',
    (all.match(/func cruiseFullBleed\(/g) || []).length === 1
      && /func cruiseFullBleed\(\)\s*->\s*some WidgetConfiguration\s*\{\s*\n\s*contentMarginsDisabled\(\)/.test(all),
    'it must not branch on availability — the two arms return different types');
}

// ── a fill-mode image may not enlarge what it sits in ────────────────────
//
// `.aspectRatio(contentMode: .fill)` returns a size that COVERS the proposal,
// which is usually LARGER than it. So the image reports the bigger size as its
// own, and anything that trims it to its own bounds trims nothing.
//
// BUILD 43 SHIPPED BOTH WAYS OF GETTING THIS WRONG:
//
//   img.resizable().aspectRatio(contentMode: .fill).clipped()
//     — clips to the enlarged size, i.e. does nothing. The Start Drive small
//       tile rendered as a bare photograph with NO type on it at all: the
//       eyebrow, the dial and the name were drawn into a stack taller than
//       the tile, so WidgetKit centred it and the top and bottom rows fell
//       outside the widget's bounds.
//
//   img.resizable().aspectRatio(contentMode: .fill).clipShape(...)   <- on the
//   ...                                                                 IMAGE
//   .frame(width: 74, height: 74)                                    <- later
//     — the clip is applied before anything has fixed a size, and `.frame`
//       fixes what the stack REPORTS without trimming what is drawn inside
//       it. The Pocket Player's 74pt photo slot drew a photograph a widget
//       and a half tall, over the tile's rounded corners.
//
// So the property is ORDER: fix the size, THEN clip. Or use cruiseBackdrop,
// which is that order written down once.
{
  let seen = 0;
  for (const [f, s] of Object.entries(src_)) {
    const L = s.split('\n');
    for (let i = 0; i < L.length; i++) {
      if (!/contentMode:\s*\.fill/.test(L[i])) continue;
      // the doc comments above the helper and here quote the broken idiom
      if (/^(\/\/|\*|\/\*)/.test(L[i].trim())) continue;
      if (/func cruiseBackdrop/.test(L.slice(Math.max(0, i - 3), i).join('\n'))) continue;
      seen += 1;
      const win = L.slice(i, i + 40);
      const frameAt = win.findIndex((l) => /\.frame\(width:/.test(l));
      const clipAfter = frameAt < 0 ? -1
        : win.slice(frameAt).findIndex((l) => /\.clipped\(\)|\.clipShape\(/.test(l));
      check(`${f}:${i + 1} is sized before it is clipped`,
        frameAt >= 0 && clipAfter >= 0,
        frameAt < 0
          ? 'no .frame(width:height:) — use cruiseBackdrop()'
          : 'the clip must come AFTER the frame, or it trims the enlarged size');
      check(`${f}:${i + 1} does not clip on the same line as the fill`,
        !/contentMode:\s*\.fill\)\s*\.clipp?e?d?/.test(L[i]),
        'that clips to the enlarged size, i.e. to nothing');
    }
  }
  // A regex that quietly matched nothing would pass every case vacuously.
  check('and it actually found the images', seen >= 4, `${seen} found`);
  check('cruiseBackdrop clips against a box that accepts the proposal',
    /func cruiseBackdrop\(\)\s*->\s*some View\s*\{\s*\n\s*Color\.clear\.overlay\([^\n]*contentMode:\s*\.fill\)\)\.clipped\(\)/.test(all),
    'it must be Color.clear.overlay(...).clipped()');
}


// ── THE CD'S TRACKS MAY NOT DRIFT BACK INTO A RECORD'S GROOVES ────────────
//
// The two tiles sit in the same Look picker and one of them is a pressed disc
// whose tracks are a shimmer while the other is a record whose grooves are
// cut. They converged on each other from both sides: 10.09 widened the CD's
// pitch to 0.07 of the radius in the name of "CDs aren't that textured"
// (which is the opposite of what widening does) and 20.09 gave the record
// real grooves. So the relationship is pinned rather than each number alone,
// and BOTH sides are parsed out of the source — a constant copied into a test
// is a constant that goes stale silently.
{
  const cd = /fileprivate let TRACK_PITCH:\s*CGFloat\s*=\s*([\d.]+)/.exec(src['ModeWidget.swift'] ?? '');
  const discSize = /CompactDisc\(cover:[\s\S]*?size:\s*([\d.]+)\s*\*\s*k\)/.exec(src['ModeWidget.swift'] ?? '');
  const rec = /private var pitch:\s*CGFloat\s*\{\s*([\d.]+)\s*\}/.exec(src['Artwork.swift'] ?? '');
  check('the CD and the record both state their pitch', !!cd && !!discSize && !!rec,
    `TRACK_PITCH ${cd?.[1]} · disc ${discSize?.[1]} · record ${rec?.[1]}`);
  if (cd && discSize && rec) {
    const cdPt = Number(cd[1]) * Number(discSize[1]) / 2;
    check('the CD\'s tracks are no coarser than the record\'s grooves',
      cdPt <= Number(rec[1]) + 0.001,
      `${cdPt.toFixed(2)}pt against the record's ${rec[1]}pt — a CD's tracks are microns apart, a record's are not`);
    // Below about 1.2pt neighbouring rings moire against the pixel grid, which
    // is the record's own measured floor (20.09). Finer than that and the
    // harness is flattering the code.
    check('and not so fine that they moire', cdPt >= 1.2,
      `${cdPt.toFixed(2)}pt`);
  }
}

// ── THE PRESSING HAS AN EDGE OF ITS OWN ───────────────────────────────────
// The clear polycarbonate margin (21.09). Without it the cover runs off the
// rim and the only thing separating the disc from the case is the directional
// rim stroke. Falloff, never a stroke — a hard ring here is the stacking ring
// the owner had removed on 10.09.
{
  const m = src['ModeWidget.swift'] ?? '';
  check('the disc carries its clear polycarbonate margin',
    /location:\s*0\.945\)[\s\S]{0,200}?location:\s*0\.975\)/.test(m),
    'CompactDisc must darken the outer ~1.65pt into a clear margin');
  check('and it is falloff rather than a drawn ring',
    !/Circle\(\)\.stroke\([^)]*\)\s*\n\s*\.frame\(width: size \* 0\.9[5-9]/.test(m),
    'a hard ring at the rim reads as the stacking ring that was deleted');
}

// ── THE HUB IS METAL, NOT A PLATE ─────────────────────────────────────────
// A flat pale fill was the brightest thing on the tile with no light on it at
// all; it takes the RIM'S OWN bearing so the two catch the same lamp.
{
  const m = src['ModeWidget.swift'] ?? '';
  check('the clamping ring is lit rather than filled flat',
    !/Circle\(\)\.fill\(Color\(white: 0\.88\)\.opacity\(0\.60\)\)/.test(m),
    'a flat fill is a drawn circle — the rim, the ball\'s rim and the record\'s edge have each been talked out of exactly this');
  const hub = /hub ring and the four gripper holes[\s\S]{0,1400}?size \* 0\.31/.exec(m);
  check('and it is lit on the rim\'s own bearing',
    !!hub && /AngularGradient/.test(hub[0]) && /angle:\s*\.degrees\(-125\)/.test(hub[0]),
    'a second, differently-lit hub reads as a separate object sitting on the disc');
}

// ── PINNING A TILE TO A STATION ───────────────────────────────────────────
// Four widgets can be pinned, and the five that name a station must all reach
// it the same way. Before this, each wrote `lastDrive ?? currentOnAir()` for
// itself — five copies of one expression, and every one of them now has a
// pinned case to fall through first, which is exactly how five widgets end up
// disagreeing about which station they are on.
{
  const pick = src['StationPick.swift'] ?? '';
  check('the station picker exists', pick.length > 0);
  check('it is an AppEntity, so the list can include stations made after the build',
    /struct StationEntity: AppEntity/.test(pick),
    'an AppEnum is written into the binary and could never carry a custom station');
  check('and it is gated to iOS 17, like every other configuration here',
    /@available\(iOSApplicationExtension 17\.0, \*\)\s*\nstruct StationEntity/.test(pick));
  check('the picker is built from the snapshot, not a list in Swift',
    /SnapshotStore\.load\(\)/.test(pick) && /pickableStations/.test(pick),
    'suggestedEntities is asked while the app is not running');
  check('there is a row meaning "my last station"',
    /static let lastStation = StationEntity\(id: ""/.test(pick),
    'an optional parameter alone gives no reliable way back to unpinned');

  // THE PAYWALL IS NOT IN THE EXTENSION AND MUST NEVER BE. A widget reads a
  // file out of shared storage, so a lock decided from it is a lock anyone
  // can edit. `premium` and `isPro` mark a row in the picker; the real gate
  // is NowPlayingContext.open, which reads the live entitlement.
  const swiftFiles = Object.keys(src).filter((f) => f.endsWith('.swift'));
  const gating = swiftFiles.filter((f) =>
    f !== 'StationPick.swift' && f !== 'Snapshot.swift' &&
    // COMMENTS STRIPPED FIRST. Both the CD and the record carry a note about
    // what "premium" can mean at widget size — a quality of drawing, not a
    // paywall — and a scan that reads those is the 02.09 trap exactly: the
    // first `else` check in this file failed on the comment explaining why
    // there must never be one.
    /\b(isPro|premium)\b/.test(decomment(src[f])));
  check('no widget decides a paywall for itself', gating.length === 0, gating.join(', '));
  check('and the scan read the Swift', swiftFiles.length >= 8, `${swiftFiles.length} files`);

  // One way in, for all five.
  const snapSrc = src['Snapshot.swift'] ?? '';
  check('there is one place that answers "which station does this tile draw?"',
    /func station\(pinned id: String\?/.test(snapSrc));
  check('and an empty id means unpinned, so the sentinel and nil agree',
    /if let id, !id\.isEmpty/.test(snapSrc));

  const drawers = ['StartDriveWidget.swift', 'VinylWidget.swift',
                   'ModeWidget.swift', 'LastPlayedWidget.swift'];
  for (const f of drawers) {
    const t = src[f] ?? '';
    check(`${f}: goes through station(pinned:)`, /snap\.station\(pinned:/.test(t));
    check(`${f}: no longer picks the station for itself`,
      !/lastDrive \?\? snap\.currentOnAir\(\)/.test(t),
      'five copies of one expression is how five widgets start disagreeing');
  }

  // Every configurable intent must offer the setting, or that widget is the
  // one that quietly cannot be pinned.
  const intents = [
    ['DeckLook.swift', 'DeckLookIntent'],
    ['ModeWidget.swift', 'ModeLookIntent'],
    ['LastPlayedWidget.swift', 'LastPlayedLookIntent'],
    ['StartDriveWidget.swift', 'StartDriveStationIntent'],
  ];
  for (const [f, name] of intents) {
    const body = new RegExp(`struct ${name}: WidgetConfigurationIntent \\{[\\s\\S]*?\\n\\}`)
      .exec(src[f] ?? '')?.[0] ?? '';
    check(`${name}: found it`, body.length > 60, `${body.length} chars`);
    check(`${name}: offers the station setting`,
      /@Parameter\(title: "Station"\)\s*\n\s*var station: StationEntity\?/.test(body));
  }
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the widget bundle hangs together\n');
process.exit(fails ? 1 : 0);
