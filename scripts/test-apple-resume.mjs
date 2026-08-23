// THE APPLE MUSIC RESUME RECOVERY — reported by a listener on 23.08: "after
// pausing the song through the app it completely freezes trying to play it
// again and it desyncs from Apple Music… most of the time the music won't
// play from the app itself and you have to keep going back to Apple Music."
//
// THIS CANNOT BE REPRODUCED FROM HERE and the test says so by what it does
// NOT claim: there is no device, no Apple Music subscription, and Swift
// cannot be compiled in this environment. What is testable is the RULE — that
// the recovery re-queues what the app itself started, resumes at the right
// place, and can never fight the user or hijack music it did not start.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const SRC = '/home/user/CruiseFM/src/utils/appleMusic.ts';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

function load({ hasBridge = true, playlistThrows = false } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const calls = [];
  const bridge = {
    playPlaylist: async (id) => { calls.push(['playPlaylist', id]); if (playlistThrows) throw new Error('no queue'); },
    seekTo: async (ms) => { calls.push(['seekTo', Math.round(ms)]); },
    play: async () => { calls.push(['play']); },
  };
  const m = { exports: {} };
  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => (hasBridge ? bridge : null) };
    if (name === 'react-native') return { NativeModules: {}, Platform: { OS: 'ios' } };
    return new Proxy({}, { get: () => () => {} });
  };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);
  return { A: m.exports, calls };
}

const URI = 'applemusic:playlist:p.abc123';

console.log('\n  it only recovers what the app itself started:');
{
  const { A } = load();
  check('nothing queued yet — refuses rather than hijacking the Music app',
    (await A.recoverApplePlayback(60_000)) === false);
  check('and says so honestly', A.lastAppleQueueUri() === null);
}

console.log('\n  after the app starts a playlist:');
{
  const { A, calls } = load();
  await A.startApplePlaylist(URI);
  check('the queue is remembered', A.lastAppleQueueUri() === URI);
  calls.length = 0;
  const ok = await A.recoverApplePlayback(96_000);
  check('recovery succeeds', ok === true);
  check('it re-queues that same playlist',
    calls.some(([f, id]) => f === 'playPlaylist' && id === 'p.abc123'), JSON.stringify(calls));
  check('...and seeks back to where the song was, not the top',
    calls.some(([f, ms]) => f === 'seekTo' && ms === 96_000), JSON.stringify(calls));
}

console.log('\n  it does not seek when there is nowhere sensible to go:');
{
  const { A, calls } = load();
  await A.startApplePlaylist(URI);
  calls.length = 0;
  await A.recoverApplePlayback(null);
  check('unknown position — re-queue only, no seek', !calls.some(([f]) => f === 'seekTo'));
  calls.length = 0;
  await A.recoverApplePlayback(400);
  check('barely started — no seek, the top IS where they were',
    !calls.some(([f]) => f === 'seekTo'));
}

console.log('\n  it never throws, whatever the bridge does:');
{
  const { A } = load({ playlistThrows: true });
  await A.startApplePlaylist(URI).catch(() => {});
  let threw = false, ok = null;
  try { ok = await A.recoverApplePlayback(30_000); } catch { threw = true; }
  check('a refusing queue is reported, not thrown', threw === false && ok === false);
}
{
  const { A } = load({ hasBridge: false });
  let threw = false, ok = null;
  try { ok = await A.recoverApplePlayback(30_000); } catch { threw = true; }
  check('no module at all (web, old builds) — safe no-op', threw === false && ok === false);
}

console.log('\n  the caller guards the driver intent:');
{
  const hook = fs.readFileSync('/home/user/CruiseFM/src/utils/useAppleMusicPlayback.ts', 'utf8');
  check('the check is armed on play', /applePlay\(\);\s*after\(\);\s*verifyResume\(\)/.test(hook));
  check('it gives up if the transport was touched again',
    /lastControlRef\.current !== askedAt/.test(hook));
  check('it gives up if the screen has gone', /cancelledRef\.current/.test(hook));
  check('it does nothing when the music did start', /entry\?\.isPlaying\) return/.test(hook));
  check('pause is NOT verified — only a resume can fail this way',
    !/applePause\(\);\s*after\(\);\s*verifyResume/.test(hook));
}

console.log(fails ? `\n  ${fails} failure(s)\n` : '\n  the recovery is bounded and cannot hijack playback\n');
process.exit(fails ? 1 : 0);
