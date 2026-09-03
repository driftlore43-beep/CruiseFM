/**
 * A SKIP MUST NOT MOVE THE CLOCK.
 *
 * WHY THIS EXISTS (owner, 03.09, with a screen recording): "whenever I change
 * songs the bar likes to jump back to 0:00 and the time when I changed the
 * songs. So it looks like it's jumping around."
 *
 * MEASURED FROM THAT CLIP, frame by frame at 10fps: the elapsed readout ran
 * 0:11 on a 3:32 song, dropped to 0:00 for exactly half a second, and came
 * back at 0:12 — SAME SONG, SAME DURATION, same title in the dot-matrix
 * window. Three times in thirteen seconds.
 *
 * THE CAUSE was `resetTrack = () => progress.setValue(0)`, wired into every
 * skip button in five modes. It zeroed the bar the instant a thumb landed —
 * before Spotify had been asked, let alone answered — and then the first chase
 * poll, still reporting the old track, put it back. It dated from 11 July,
 * when the bar was a local demo loop with no service to consult and zeroing on
 * skip was the only sensible thing; it has been making an unverifiable claim
 * ever since the clock started following a real song a week later.
 *
 * IT IS THE 11.08 RULE IN NEW CLOTHES, and that is why it is worth a test
 * rather than just a fix: THE TRANSPORT MAY BE OPTIMISTIC, THE CLOCK MAY NOT.
 * A button that waits feels broken, so it flips at once. A position readout
 * makes a falsifiable claim about where in the song we are, so it waits for
 * the service's own verdict.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'src/components';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('Mode.tsx'));

/** Anything that would move the position readout or the bar. */
const TOUCHES_CLOCK = /\bprogress\b|setValue|setCurrentTimeMs/;

/**
 * ONE LEVEL OF INDIRECTION, and it is the whole reason this test needed a
 * second draft: the real bug was not `progress.setValue(0)` written in the
 * handler, it was `resetTrack()` — a one-line local helper whose NAME contains
 * none of the words above. A rule that only reads the handler text would have
 * passed the exact code it exists to catch, which is how a check ends up being
 * read as evidence while checking nothing. So local helpers that touch the
 * clock are collected first and counted as touching it themselves.
 */
function clockHelpers(src) {
  const names = new Set();
  for (const m of src.matchAll(/^\s*const (\w+) = \([^)]*\) =>([^\n]*)$/gm)) {
    if (TOUCHES_CLOCK.test(m[2])) names.add(m[1]);
  }
  return names;
}

const problems = [];
let modes = 0;
let skipSites = 0;
let sharedClock = 0;

/**
 * The handler a skip is wired to. These are one-liners in every mode, but read
 * the balanced arrow body where there is one rather than trusting that — a
 * handler split over two lines would otherwise slip past unread.
 */
function handlerAt(src, idx) {
  const open = src.lastIndexOf('=> {', idx);
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  if (open === -1 || open < lineStart - 200) {
    return src.slice(lineStart, src.indexOf('\n', idx));
  }
  let depth = 0;
  for (let i = open + 3; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(lineStart, src.indexOf('\n', idx));
}

for (const f of files) {
  modes += 1;
  const p = path.join(DIR, f);
  let src = fs.readFileSync(p, 'utf8');

  // Prove the check can fail before believing it passes: put the real bug back
  // — the helper AND the call, exactly as it was written — and expect the rules
  // below to catch it.
  if (process.env.SELFTEST === '1' && /=\{spotify\.next\}/.test(src)) {
    src = src
      .replace(/=\{spotify\.next\}/, '={() => { resetTrack(); spotify.next(); }}')
      .replace(/\n  return \(/, '\n  const resetTrack = () => progress.setValue(0);\n  return (');
  }

  const helpers = clockHelpers(src);
  const touches = (body) =>
    TOUCHES_CLOCK.test(body) || [...helpers].some((n) => new RegExp(`\\b${n}\\s*\\(`).test(body));

  // RULE 1 — a skip's handler may not touch the clock, directly or through a
  // helper of its own.
  for (const m of src.matchAll(/spotify\.(prev|next)\b/g)) {
    skipSites += 1;
    const body = handlerAt(src, m.index);
    if (touches(body)) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(`${p}:${line} a skip handler moves the progress clock: ${body.trim().slice(0, 90)}`);
    }
  }

  // RULE 3 — A HANDLER THAT RETURNS THE FUNCTION NEVER CALLS IT, and I wrote
  // exactly that mid-fix: a sweep turned `() => { resetTrack(); spotify.next(); }`
  // into `() => spotify.next`, which type-checks, renders, and silently does
  // nothing when pressed. Every skip button in five modes was dead for the
  // length of one edit. It is invisible to tsc, so it belongs here.
  for (const m of src.matchAll(/=\{\(\)\s*=>\s*spotify\.(prev|next)\s*\}/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    problems.push(`${p}:${line} handler returns spotify.${m[1]} instead of calling it — the button does nothing`);
  }

  // RULE 2 — a mode on the shared clock never sets the clock's own value.
  // useTrackClock owns it: it is the one thing that knows what the service has
  // actually said. Vinyl and Cassette keep their own clocks (they predate the
  // shared one) and are excluded by this test, not allowlisted past it.
  if (/useTrackClock\(\{/.test(src)) {
    sharedClock += 1;
    for (const m of src.matchAll(/\bprogress\.setValue\(/g)) {
      const line = src.slice(0, m.index).split('\n').length;
      problems.push(`${p}:${line} sets the shared clock's value directly`);
    }
  }
}

// A check that cannot fail is worse than none, so say plainly what was read.
const vacuous = [];
if (modes < 8) vacuous.push(`only ${modes} mode files scanned`);
if (skipSites < 10) vacuous.push(`only ${skipSites} skip call sites found`);
if (sharedClock < 5) vacuous.push(`only ${sharedClock} modes on the shared clock`);

if (process.env.SELFTEST === '1') {
  if (problems.length === 0) {
    console.error('SELFTEST: the reintroduced bug was NOT caught — this test proves nothing.');
    process.exit(1);
  }
  console.log(`SELFTEST ok — caught ${problems.length} reintroduced fault(s).`);
  process.exit(0);
}

if (vacuous.length) {
  console.error(`skip-clock: the scan looks empty (${vacuous.join('; ')}) — fix the scan, not the code.`);
  process.exit(1);
}
if (problems.length) {
  console.error('skip-clock FAILED:\n' + problems.map((s) => `  - ${s}`).join('\n'));
  console.error('\nA skip must leave the bar alone. The clock lands on the truth when the');
  console.error('service reports the new track; anything sooner is a guess that springs back.');
  process.exit(1);
}
console.log(`skip-clock ok — ${modes} modes, ${skipSites} skip sites, ${sharedClock} on the shared clock.`);
