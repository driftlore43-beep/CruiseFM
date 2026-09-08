// Pull the real compiler complaints out of an EAS Xcode build log.
//
// WHY THIS EXISTS: EAS's `error.message` on a build is a SUMMARY — it names
// the complaint ("instance member 'padding' cannot be used on type 'View'")
// and never the file or the line. Swift cannot be compiled in this
// environment, so a failed build IS the compiler, and two rounds went on
// guessing which of eleven files could produce that message before anyone
// went and read the log.
//
// THE LOG IS JSON-LINES, which is why the first attempt found nothing: each
// line is an object whose text sits in a quoted field with escaped newlines,
// so a plain `grep error:` matches zero lines and reads exactly like a clean
// build — the vacuous-pass shape this project keeps recording. Decode first,
// then look.
//
// Lives in a file rather than inline in the workflow because two attempts at
// inlining it died on shell quoting, which is its own kind of noise.
import fs from 'node:fs';

const path = process.argv[2];
if (!path || !fs.existsSync(path)) {
  console.log('(no log file)');
  process.exit(0);
}
const raw = fs.readFileSync(path, 'utf8');

/** Every line of human-readable text the log carries, decoded. */
function textLines(src) {
  const out = [];
  for (const line of src.split('\n')) {
    let text = line;
    const t = line.trim();
    if (t.startsWith('{')) {
      try {
        const o = JSON.parse(t);
        // Any string field could be the message; the shape is not documented,
        // so take them all rather than betting on a key name.
        text = Object.values(o).filter((v) => typeof v === 'string').join(' ');
      } catch { /* not JSON — use the raw line */ }
    }
    for (const part of text.split(/\\n|\n/)) out.push(part);
  }
  return out;
}

const INTERESTING = /error:|cannot be used on type|\.swift:\d+|note:.*declared here/;
const NOISE = /^\s*$|linker command failed|clang: error: the following/;

const lines = textLines(raw);
const hits = [];
for (const l of lines) {
  const s = l.trim();
  if (INTERESTING.test(s) && !NOISE.test(s) && !hits.includes(s)) hits.push(s);
}

if (hits.length) {
  console.log(hits.slice(0, 60).join('\n'));
} else {
  // NEVER report silence as success — the whole point of this script is that
  // an empty result was previously indistinguishable from a passing build.
  console.log('(no compiler errors matched; last 2000 chars of the log follow)');
  console.log(lines.join('\n').slice(-2000));
}
