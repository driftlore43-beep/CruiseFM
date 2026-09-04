#!/usr/bin/env node
/**
 * HOW FAR BEHIND IS THE PUBLIC APP?
 *
 * WHY THIS EXISTS. Pushing to this branch publishes to PREVIEW automatically —
 * the owner's phone and the TestFlight testers. Production is deliberately
 * manual, so that a commit can never change what a stranger is running or what
 * Apple is reviewing. That is the right design and it has one failure mode:
 * it is silent. Nothing anywhere goes red when the public app falls behind.
 *
 * It has now happened twice. In August the production channel went two weeks
 * and thirty commits without a publish while preview kept moving, so nobody
 * who had the app from the App Store received any of that work. The fix
 * written down at the time was A HABIT — remember to ask. That habit failed
 * again on 4 September, with a bug the owner had reported herself sitting
 * fixed on preview and broken on the store.
 *
 * So this is the mechanical version. It turns "did we remember?" into a
 * question with an answer:
 *
 *     node scripts/production-lag.mjs
 *
 * WHERE THE TRUTH COMES FROM. Not from these notes, and not from anyone's
 * memory of publishing — from the workflow's own run history. A production
 * publish is a run whose job is named `eas update --branch production` AND
 * whose "Publish" step actually succeeded. Both halves matter: a DIAGNOSE run
 * carries the identical job name and publishes nothing, so matching on the
 * name alone would report a check as a release.
 *
 * The repo is public, so this needs no token.
 */

import { execFileSync } from 'node:child_process';

const OWNER = 'driftlore43-beep';
const REPO = 'CruiseFM';
const WORKFLOW = 'ota-update.yml';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

/** Paths an over-the-air update can actually carry. A docs or Swift change
 *  cannot reach a phone this way, so counting it would cry wolf. */
const OTA_PATHS = ['src/', 'assets/', 'app.json', 'package.json', 'package-lock.json'];

// THROUGH CURL, NOT `fetch`, and that is deliberate. This environment sends
// outbound HTTPS through a proxy that curl picks up from the environment and
// Node's own fetch does not — so fetch here comes back 403 while curl is fine.
// curl also works unchanged anywhere else, so this costs nothing.
function api(path) {
  const out = execFileSync('curl', [
    '-sS', '--fail-with-body',
    '-H', 'accept: application/vnd.github+json',
    '-H', 'user-agent: cruisefm-lag',
    API + path,
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(out);
}

/** The commit of the last run that genuinely published to production. */
function lastProductionPublish() {
  const runs = api(`/actions/workflows/${WORKFLOW}/runs?per_page=40&status=success`);
  for (const run of runs.workflow_runs ?? []) {
    const { jobs = [] } = api(`/actions/runs/${run.id}/jobs`);
    for (const job of jobs) {
      if (!job.name?.includes('--branch production')) continue;
      // A diagnose run has the same job name and publishes nothing, so the
      // Publish step's own conclusion is the only honest signal.
      const published = (job.steps ?? []).some(
        (s) => s.name === 'Publish' && s.conclusion === 'success');
      if (published) return { sha: run.head_sha, at: run.updated_at, url: run.html_url };
    }
  }
  return null;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

// SELFTEST=1 forces the caught-up case. A check that has only ever been
// watched to FAIL is half-tested, and this repo has shipped several that
// quietly matched nothing and read as a pass. Both directions, or neither.
const last = process.env.SELFTEST
  ? { sha: git('rev-parse', 'HEAD'), at: new Date().toISOString(), url: '(selftest)' }
  : lastProductionPublish();
if (!last) {
  console.log('Could not find a production publish in the last 40 runs.');
  console.log('That is not proof there was none — widen the search before acting on it.');
  process.exit(2);
}

let behind = [];
try {
  const out = git('log', '--oneline', `${last.sha}..HEAD`, '--', ...OTA_PATHS);
  behind = out ? out.split('\n') : [];
} catch {
  console.log(`The last production publish (${last.sha.slice(0, 7)}) is not in this clone.`);
  console.log('Fetch the branch and run again.');
  process.exit(2);
}

const days = Math.floor((Date.now() - Date.parse(last.at)) / 86400000);
const when = `${days} day${days === 1 ? '' : 's'} ago`;

console.log(`Last production publish: ${last.sha.slice(0, 7)}, ${when} (${last.at.slice(0, 10)})`);
console.log(last.url);
console.log('');

if (behind.length === 0) {
  console.log('The public app is up to date. Nothing to publish.');
  process.exit(0);
}

console.log(`THE PUBLIC APP IS ${behind.length} COMMIT${behind.length === 1 ? '' : 'S'} BEHIND.`);
console.log('Each of these can reach real phones over the air and has not:');
console.log('');
for (const line of behind) console.log('  ' + line);
console.log('');
console.log('To send them: Actions -> Ship OTA update -> channel production, mode publish.');
console.log('Run mode `diagnose` first — never publish while a build is in App Store review.');
process.exit(1);
