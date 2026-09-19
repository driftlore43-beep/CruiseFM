// STARTING A STATION MUST NOT THROW AWAY THE SONG IT IS ALREADY PLAYING.
//
// Ethan, 18.09, third round of Apple Music reports: "I'm still having sync
// issues and it's auto restarting the playlist. I'm not sure if it's just
// because of the widget but just thought I'd let you know! I believe pressing
// on the widget might be also telling the app to reset?"
//
// He is right, and it was never only the widget. Queueing an Apple Music
// playlist starts it at track one, and the Apple branch of `playStationMusic`
// queued unconditionally — so every drive start on the same station restarted
// it. Every widget deep-links into a drive, which is why a tap "resets" the
// music, but opening a deck did it too. Spotify has been spared this since
// 18.08 by `startActionFor`; the Apple side never had anything to compare
// against, because MusicKit reports nothing about where its queue came from.
//
// TWO SEPARATE CAUSES OF "AUTO RESTARTING", and this covers both:
//   (A) the start itself re-queueing a playlist already playing;
//   (B) `verifyPlaylistTook` acting on ONE early reading — the system player
//       is known to answer "not playing" for seconds after a start, so a
//       healthy playlist was being "recovered" by restarting it from the top.
//       That is the 27.08 lesson, which `verifyResume` learned and this did
//       not.
//
// (B) is proven against the ORIGINAL source text, read via `git show` so the
// working tree is never touched. (A)'s control is the original's own text:
// the function that now prevents it did not exist, and the branch ran
// straight into startApplePlaylist with nothing in between.
//
// ADVANCE BY COUNTED READS, NEVER WALL-CLOCK SLEEPS (the rule
// test-apple-resume-blip.mjs learned the hard way): the stub counts every
// currentEntry call and the test waits for a specific read NUMBER, so it is
// deterministic however the timers land.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const APPLE = `${REPO}/src/utils/appleMusic.ts`;
const CONTEXT = `${REPO}/src/context/NowPlayingContext.tsx`;

/** Pinned, not HEAD: a control tied to a moving reference stops being one
 *  the moment the fix is committed. 72ab100 is the commit before this round. */
const PRE_FIX = '72ab100';

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const compile = (src) => ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;

/**
 * The module under test, with a bridge that answers exactly what a case
 * wants and a store that behaves like AsyncStorage.
 *
 * `setTimeout` is passed in as a PARAMETER so it shadows the global inside
 * the module: the real waits are 3.5s and 2.5s, and a suite that genuinely
 * slept those would be six seconds per case. Divided by 50 the ORDER of
 * everything is unchanged and the whole file runs in under a second.
 */
function load({ src, entries, tracks = [], stored = null, trackFail = false } = {}) {
  const calls = [];
  let reads = 0;
  const bridge = {
    currentEntry: async () => { const e = entries(reads++); return e; },
    playPlaylist: async (id) => { calls.push(['playPlaylist', id]); },
    play: async () => { calls.push(['play']); },
    pause: async () => { calls.push(['pause']); },
    seekTo: async (ms) => { calls.push(['seekTo', Math.round(ms)]); },
    playlistTracks: async (id) => {
      calls.push(['playlistTracks', id]);
      if (trackFail) throw new Error('library refused');
      return tracks.map((t, i) => ({ id: `t${i}`, title: t, artist: 'A', durationMs: 1000 }));
    },
  };
  const store = new Map();
  if (stored) store.set('cruisefm_apple_queue_uri', stored);
  const asyncStorage = {
    __esModule: true,
    default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => { store.set(k, v); },
    },
  };
  const req = (name) => {
    if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => bridge };
    if (name === 'react-native') return { NativeModules: {}, Platform: { OS: 'ios' } };
    if (name === '@react-native-async-storage/async-storage') return asyncStorage;
    return new Proxy({}, { get: () => () => {} });
  };
  const fast = (fn, ms) => setTimeout(fn, Math.max(0, Math.round((ms ?? 0) / 50)));
  const m = { exports: {} };
  new Function('module', 'exports', 'require', 'setTimeout', compile(src))(m, m.exports, req, fast);
  return { A: m.exports, calls, store, readCount: () => reads };
}

/** Wait until the module has taken its nth reading of the player. */
async function untilRead(h, n, capMs = 4000) {
  const until = Date.now() + capMs;
  while (h.readCount() < n && Date.now() < until) await sleep(4);
  if (h.readCount() < n) throw new Error(`only ${h.readCount()} reads, wanted ${n}`);
}

const FIXED = fs.readFileSync(APPLE, 'utf8');
const ORIGINAL = execSync(`git show ${PRE_FIX}:src/utils/appleMusic.ts`, { cwd: REPO, encoding: 'utf8' });
const URI = 'applemusic:playlist:p.station';
const OTHER = 'applemusic:playlist:p.other';
const playing = (title) => ({ title, artist: 'A', artworkUrl: null, durationMs: 200000, positionMs: 61000, isPlaying: true });
const paused = (title) => ({ ...playing(title), isPlaying: false });

// `startActionFor` is the SHIPPED rule, transpiled rather than restated —
// a test that reimplements the thing it checks proves nothing about the app.
const ctx = { exports: {} };
new Function('module', 'exports', 'require', compile(fs.readFileSync(CONTEXT, 'utf8')))(
  ctx, ctx.exports,
  () => new Proxy({}, { get: () => () => ({ then: () => ({ catch: () => {} }), catch: () => {} }) }),
);
const { startActionFor } = ctx.exports;

/** What the drive-start path would decide, given a queue state. */
const decide = (state) => startActionFor(
  state ? state.uri : undefined,
  state ? state.isPlaying : undefined,
  URI,
);

await (async () => {
  console.log('\n  the control — the original code had nothing to compare against:');
  {
    const oldCtx = execSync(`git show ${PRE_FIX}:src/context/NowPlayingContext.tsx`, { cwd: REPO, encoding: 'utf8' });
    check('the original branch queued unconditionally',
      /isApplePlaylist\(linked\.uri\)\) return 'no-playlist';\s*\n\s*return await startApplePlaylist\(linked\.uri\);/.test(oldCtx),
      'the old Apple branch is not the shape this fix replaced — re-read it');
    check('...and no queue check existed to call', !/appleQueueState/.test(ORIGINAL));
  }

  console.log('\n  what is already playing decides what a start does:');
  {
    const h = load({ src: FIXED, entries: () => null });
    check('nothing loaded at all → start it', decide(await h.A.appleQueueState(URI)) === 'start');
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One'] });
    check('loaded but we have never queued anything → start',
      decide(await h.A.appleQueueState(URI)) === 'start');
    check('...and it did not waste a library read', !h.calls.some((c) => c[0] === 'playlistTracks'));
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One'], stored: OTHER });
    check('a DIFFERENT playlist is loaded → start', decide(await h.A.appleQueueState(URI)) === 'start');
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One', 'Song Two'], stored: URI });
    check('THIS playlist, playing → leave it alone', decide(await h.A.appleQueueState(URI)) === 'leave');
  }
  {
    const h = load({ src: FIXED, entries: () => paused('Song Two'), tracks: ['Song One', 'Song Two'], stored: URI });
    check('THIS playlist, paused → resume in place', decide(await h.A.appleQueueState(URI)) === 'resume');
  }

  console.log('\n  memory alone is not enough — the song has to be in the playlist:');
  {
    const h = load({ src: FIXED, entries: () => playing('Something Else'), tracks: ['Song One'], stored: URI });
    check('they queued their own music in the Music app → start, do not adopt it',
      decide(await h.A.appleQueueState(URI)) === 'start');
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), stored: URI, trackFail: true });
    check('the library will not answer → start rather than guess',
      decide(await h.A.appleQueueState(URI)) === 'start');
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: [], stored: URI });
    check('an empty track list is not evidence', decide(await h.A.appleQueueState(URI)) === 'start');
  }

  console.log('\n  the memory survives a cold start, which is the widget case:');
  {
    // Nothing queued in THIS session — the app has just been launched by a
    // tap on a widget while the Music app carried on playing.
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One'], stored: URI });
    check('a widget tap finds the playlist still loaded',
      decide(await h.A.appleQueueState(URI)) === 'leave');
    check('...and nothing was re-queued', !h.calls.some((c) => c[0] === 'playPlaylist'));
  }
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One'] });
    await h.A.startApplePlaylist(URI);
    check('queueing writes the memory down for next launch',
      h.store.get('cruisefm_apple_queue_uri') === URI);
  }

  console.log('\n  resuming does not re-queue:');
  {
    const h = load({ src: FIXED, entries: () => playing('Song One'), tracks: ['Song One'], stored: URI });
    await h.A.resumeAppleQueue(URI);
    check('it presses play', h.calls.some((c) => c[0] === 'play'));
    check('...and never hands the playlist back', !h.calls.some((c) => c[0] === 'playPlaylist'));
  }

  console.log('\n  a slow starter is not a failed one (control first):');
  {
    // The player answers "not playing" on the first look and "playing" on the
    // second — exactly the window the owner's own recording measured.
    const slow = (i) => (i === 0 ? paused('Song One') : playing('Song One'));
    const ctl = load({ src: ORIGINAL, entries: slow });
    await ctl.A.startApplePlaylist(URI);
    await untilRead(ctl, 1);
    await sleep(120);
    check('the ORIGINAL restarts it from the top (control — must fail)',
      ctl.calls.filter((c) => c[0] === 'playPlaylist').length > 1,
      `calls: ${JSON.stringify(ctl.calls)}`);

    const fix = load({ src: FIXED, entries: slow });
    await fix.A.startApplePlaylist(URI);
    await untilRead(fix, 2);
    await sleep(120);
    check('the fix looks twice and leaves it alone',
      fix.calls.filter((c) => c[0] === 'playPlaylist').length === 1,
      `calls: ${JSON.stringify(fix.calls)}`);
  }
  {
    // A genuinely silent start still gets its one recovery.
    const dead = () => paused('Song One');
    const h = load({ src: FIXED, entries: dead });
    await h.A.startApplePlaylist(URI);
    await untilRead(h, 2);
    await sleep(160);
    check('a start that really did not take is still recovered',
      h.calls.filter((c) => c[0] === 'playPlaylist').length > 1,
      `calls: ${JSON.stringify(h.calls)}`);
    check('...and the recovery keeps the position instead of restarting blind',
      h.calls.some((c) => c[0] === 'seekTo' && c[1] === 61000),
      `calls: ${JSON.stringify(h.calls)}`);
  }

  console.log(fails === 0
    ? '\n  a drive start leaves music it is already playing, and a slow start is not restarted\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
