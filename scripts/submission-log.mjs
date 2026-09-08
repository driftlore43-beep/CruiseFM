#!/usr/bin/env node
/**
 * Print what App Store Connect actually said about a failed submission.
 *
 * WHY THIS EXISTS: `eas submit` fails with "Something went wrong when
 * submitting your app to Apple App Store Connect." and exits 1, naming
 * nothing — the same shape as the Xcode error that cost builds 40 and 41 two
 * rounds each. The reason lives in the submission's own `error.message` /
 * `error.errorCode`, and the detail behind that lives in `logFiles`, read out
 * of eas-cli's SubmissionFragment (graphql/types/Submission.js) rather than
 * guessed.
 *
 * A submission log is JSON-lines with a `msg` field. If the shape is ever
 * something else this falls back to raw text and SAYS SO — printing nothing
 * reads identically to "no problem", which is the vacuous-pass failure this
 * repo keeps catching.
 *
 * Usage: node scripts/submission-log.mjs <file>
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.log(`(no submission log at ${file || '<none>'})`);
  process.exit(0);
}

const raw = fs.readFileSync(file, 'utf8');
if (!raw.trim()) {
  console.log('(submission log was empty)');
  process.exit(0);
}

const lines = raw.split('\n').filter((l) => l.trim());
let parsed = 0;
const out = lines.map((l) => {
  try {
    const o = JSON.parse(l);
    if (o && typeof o === 'object' && 'msg' in o) {
      parsed++;
      const lvl = o.level && o.level !== 'info' ? `[${o.level}] ` : '';
      return `${lvl}${o.msg}`;
    }
  } catch {
    /* not JSON — fall through to the raw line */
  }
  return l;
});

if (parsed === 0) console.log('(not JSON-lines — printing raw)');
console.log(out.slice(-80).join('\n'));
