// The rating ask, against the SHIPPED rule.
//
// Everything this decides ends in interrupting someone, and the promise the
// card makes is that it happens ONCE, is earned, and never lands mid-drive.
// A promise like that is worth a test rather than a comment.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/rateApp.ts';
let fails = 0;
const check = (name, ok, extra = '') => {
  if (ok) { console.log('  ok  ', name); return; }
  fails++; console.log('  FAIL', name, extra);
};

function load() {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const disk = new Map();
  const storage = {
    getItem: async (k) => (disk.has(k) ? disk.get(k) : null),
    setItem: async (k, v) => { disk.set(k, v); },
  };
  const m = { exports: {} };
  const req = (name) => {
    if (name === '@react-native-async-storage/async-storage') return storage;
    if (name === '@/utils/appStoreUpdate') return { APP_STORE_URL: 'https://apps.apple.com/app/id6793233679' };
    throw new Error('unstubbed: ' + name);
  };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { R: m.exports, disk };
}

const { R } = load();
const DAY = 24 * 60 * 60 * 1000;
const now = 1_800_000_000_000;
const settled = { firstSeenAt: now - 5 * DAY, askedAt: null };
const ask = (o) => R.shouldAskForRating({ now, state: settled, sessions: 5, inDrive: false, ...o });

console.log('\n  it asks when it has been earned:');
check('five sessions, a week in, not driving', ask({}) === true);
check('exactly the minimum sessions is enough', ask({ sessions: R.MIN_SESSIONS }) === true);

console.log('\n  and stays quiet otherwise:');
check('never during a drive', ask({ inDrive: true }) === false);
check('one session is not earned', ask({ sessions: 1 }) === false);
check('one short of the minimum', ask({ sessions: R.MIN_SESSIONS - 1 }) === false);
check('no sessions at all', ask({ sessions: 0 }) === false);
check('not on the first day, however keen they are',
  R.shouldAskForRating({ now, state: { firstSeenAt: now - 60_000, askedAt: null }, sessions: 40, inDrive: false }) === false);
check('just under a day', R.shouldAskForRating({
  now, state: { firstSeenAt: now - (DAY - 1000), askedAt: null }, sessions: 9, inDrive: false }) === false);
check('a day and a moment is fine', R.shouldAskForRating({
  now, state: { firstSeenAt: now - (DAY + 1000), askedAt: null }, sessions: 9, inDrive: false }) === true);

console.log('\n  ONCE means once — the whole point of the card:');
check('already asked, however long ago and however much they use it',
  R.shouldAskForRating({ now, state: { firstSeenAt: now - 400 * DAY, askedAt: now - 300 * DAY }, sessions: 900, inDrive: false }) === false);

console.log('\n  storage:');
{
  const { R: R2, disk } = load();
  const first = await R2.loadRateState(now);
  check('first look starts the clock rather than asking immediately', first.firstSeenAt === now && first.askedAt === null);
  check('...and it is persisted, so tomorrow it is a day old', disk.size === 1);

  const again = await R2.loadRateState(now + 10 * DAY);
  check('the clock is not restarted on a later visit', again.firstSeenAt === now);

  await R2.markAsked(now + 10 * DAY);
  const after = await R2.loadRateState(now + 11 * DAY);
  check('markAsked sticks', after.askedAt === now + 10 * DAY);
  check('and the rule now refuses', R2.shouldAskForRating({
    now: now + 11 * DAY, state: after, sessions: 50, inDrive: false }) === false);
}

console.log('\n  the link goes to the review sheet, not just the listing:');
check('write-review action present', /action=write-review/.test(R.REVIEW_URL), R.REVIEW_URL);
check('points at Cruise FM', /id6793233679/.test(R.REVIEW_URL), R.REVIEW_URL);

console.log('\n  the bar is set somewhere sane:');
check('more than one session, fewer than a fortnight of them',
  R.MIN_SESSIONS >= 2 && R.MIN_SESSIONS <= 10, String(R.MIN_SESSIONS));
check('waits at least a day', R.MIN_AGE_MS >= DAY);

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  asked once, earned, never mid-drive\n');
process.exit(fails ? 1 : 0);
