// AN APPLE MUSIC LISTENER MUST NEVER BE SENT TO CHECK SPOTIFY.
//
// Every message the app shows when music fails to start is ADVICE, and advice
// aimed at the wrong service is worse than none: it sends someone to open an
// app they do not use, to fix a thing that was never wrong. It has happened
// twice.
//
//   03.08  the "Waking Spotify…" nudge flashed on an Apple Music drive, where
//          there is nothing to wake — the music plays on this phone.
//   25.08  Apple Music's own timeout was added, which made `'error'` the one
//          verdict reachable from BOTH services — and its message names
//          Spotify, so an Apple listener whose station failed was told to
//          check Spotify was open and logged in.
//
// Both were fixed and neither was ever checked, because the rule lived inside
// the provider where nothing could reach it. It is `noticeFor` now, pure and
// exported for exactly that reason, the way `startActionFor` already is.
//
// THE REACHABLE SET IS READ OUT OF THE APP, NOT LISTED HERE. Which verdicts
// an Apple listener can actually receive is decided by the Apple branch of
// `playStationMusic`, so this suite parses that branch and checks whatever it
// finds. A verdict added there tomorrow is covered without anyone remembering
// to add it, which is the only way a list like this stays true.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const CONTEXT = `${REPO}/src/context/NowPlayingContext.tsx`;

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const src = fs.readFileSync(CONTEXT, 'utf8');
const compile = (text) => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;

// The pure rule, with everything it imports stubbed away.
const pure = { exports: {} };
new Function('module', 'exports', 'require', 'React', compile(src))(
  pure, pure.exports,
  () => new Proxy({}, { get: () => () => ({ then: () => ({ catch: () => {} }), catch: () => {} }) }),
  { createElement: () => null, createContext: () => ({ Provider: () => null }) },
);
const { noticeFor } = pure.exports;

/** Every verdict the Apple branch of playStationMusic can return. */
function appleReachable() {
  const start = src.indexOf("if (appleMusicAvailable() && (await getSavedPlatform()) === 'appleMusic') {");
  if (start < 0) throw new Error('could not find the Apple branch — has it moved?');
  // Walk the braces so the slice is the branch itself and nothing after it.
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const branch = src.slice(start, end);
  const found = new Set([...branch.matchAll(/return '([a-z-]+)'/g)].map((m) => m[1]));
  // startApplePlaylist's own two verdicts, which the branch returns wholesale.
  found.add('playing');
  found.add('error');
  return { branch, results: [...found] };
}

await (async () => {
  console.log('\n  the rule itself:');
  check('noticeFor is exported at all', typeof noticeFor === 'function');
  check('an Apple error names Apple Music',
    /Apple Music/.test(noticeFor('error', 'appleMusic') ?? ''), noticeFor('error', 'appleMusic'));
  check('...and does NOT name Spotify',
    !/Spotify/i.test(noticeFor('error', 'appleMusic') ?? ''));
  check('a Spotify error still names Spotify',
    /Spotify/.test(noticeFor('error', 'spotify') ?? ''));
  check('an unknown platform keeps the Spotify wording — the historic default',
    noticeFor('error', null) === noticeFor('error', 'spotify'));
  check('a clean start says nothing at all', noticeFor('playing', 'appleMusic') === null);
  check('a handoff is explained by the panel, not a toast', noticeFor('handoff', 'spotify') === null);
  check('an unknown verdict is silent rather than blank',
    noticeFor('nonsense-verdict', 'spotify') === null);

  console.log('\n  an Apple listener who has not granted access is told THAT:');
  {
    // Found auditing this path: all three of "not authorised", "no playlist
    // linked" and "the linked playlist is Spotify's" returned 'no-playlist',
    // so someone who simply had not granted access was told their station had
    // no playlist and to add one — advice that cannot work, for a station
    // that may already have had one.
    const msg = noticeFor('not-connected', 'appleMusic') ?? '';
    check('it names Apple Music', /Apple Music/.test(msg), msg);
    check('...and points at the control that actually exists',
      /Connect Apple Music/.test(msg), msg);
    check('...and never mentions a playlist', !/playlist/i.test(msg), msg);
    check('...and never mentions Spotify', !/Spotify/i.test(msg), msg);
    check('control — a Spotify listener still gets the Spotify wording',
      /Spotify/.test(noticeFor('not-connected', 'spotify') ?? ''));
    check('control — the two differ',
      noticeFor('not-connected', 'appleMusic') !== noticeFor('not-connected', 'spotify'));
  }

  console.log('\n  nothing an Apple listener can receive mentions Spotify:');
  {
    const { results } = appleReachable();
    check('the Apple branch was actually read', results.length >= 3, JSON.stringify(results));
    for (const r of results) {
      const msg = noticeFor(r, 'appleMusic');
      check(`'${r}' is safe to show an Apple listener`,
        msg === null || !/Spotify/i.test(msg), msg ?? '');
    }
  }
  {
    // The control: the SAME verdicts on Spotify must still give Spotify's own
    // advice where there is any, or this suite would pass by saying nothing
    // useful to anybody.
    const spotifyErr = noticeFor('error', 'spotify');
    check('control — Spotify listeners are still advised', !!spotifyErr && /Spotify/.test(spotifyErr));
    check('control — the two differ', noticeFor('error', 'appleMusic') !== spotifyErr);
  }

  console.log('\n  and the wake nudge stands down on Apple Music (behavioural):');
  {
    // Mounted for real, because this one is not a table — it is a race
    // between a timer and a platform read inside startStationMusic.
    // THE SERVICE HAS TO BE SLOW, OR THE WHOLE SECTION PASSES VACUOUSLY.
    // The nudge only appears while a start is still in flight — it stands
    // down the instant a verdict lands. With instant stubs `settled` was
    // already true before the nudge's own async check ran, so NOBODY got a
    // notice and the Apple assertion was proving nothing. The control below
    // is what caught that. 80ms is a slow-ish network; the real thing is
    // seconds.
    const slow = (value) => () => new Promise((r) => setTimeout(() => r(value), 80));
    const mount = (platform, connected = true) => {
      let slots = [], idx = 0, effects = [], rendering = false, dirty = false, value = null;
      const React = {
        createContext: () => ({ Provider: () => null }),
        useContext: () => ({ isPro: true }),
        useCallback: (fn) => fn,
        useMemo: (fn) => { const v = fn(); value = v; return v; },
        useRef: (init) => { const i = idx++; if (!(i in slots)) slots[i] = { current: init }; return slots[i]; },
        useState: (init) => {
          const i = idx++;
          if (!(i in slots)) slots[i] = init;
          return [slots[i], (next) => {
            slots[i] = typeof next === 'function' ? next(slots[i]) : next;
            if (rendering) { dirty = true; return; }
            render();
          }];
        },
        useEffect: (fn) => { effects.push(fn); },
      };
      const req = (n) => {
        if (n === 'react') return React;
        if (n === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' } };
        if (n === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
        if (n === 'expo-keep-awake') return { activateKeepAwakeAsync: async () => {}, deactivateKeepAwake: () => {} };
        if (n === '@/constants/modeCatalog') return { isProMode: () => false };
        if (n === '@/context/EntitlementsContext') return { useEntitlements: () => ({ isPro: true }) };
        if (n === '@/utils/driveStats') return { noteDriveMode: async () => {}, recordDriveEnd: async () => null };
        if (n === '@/utils/lastCruise') return { saveLastCruise: async () => {} };
        if (n === '@/utils/spotifyHandoff') return { openInSpotify: async () => {} };
        if (n === '@/utils/musicPlatform') return { getSavedPlatform: async () => platform };
        if (n === '@/utils/appleMusic') return {
          appleMusicAvailable: () => true,
          applePause: async () => {}, applePlay: async () => {},
          appleQueueState: async () => null,
          isAppleMusicConnected: async () => connected && platform === 'appleMusic',
          isApplePlaylist: (u) => String(u).startsWith('applemusic:'),
          resumeAppleQueue: async () => {},
          startApplePlaylist: slow('playing'),
        };
        if (n === '@/utils/spotify') return {
          getPlaybackState: async () => null, isRestrictedAccount: async () => false,
          isSpotifyConnected: async () => true, looksOffline: () => false,
          pause: async () => {}, probePlaybackState: slow({ kind: 'state', data: null }),
          startPlayback: slow('playing'),
        };
        if (n === '@/utils/stationPlaylists') return {
          getStationPlaylist: async (id) => ({
            uri: platform === 'appleMusic' ? `applemusic:playlist:${id}` : `spotify:playlist:${id}`,
            name: id,
          }),
        };
        return new Proxy({}, { get: () => () => {} });
      };
      const m = { exports: {} };
      new Function('module', 'exports', 'require', 'React', compile(src))(
        m, m.exports, req, { ...React, createElement: () => null },
      );
      function render() {
        do {
          dirty = false; idx = 0; effects = []; rendering = true;
          m.exports.NowPlayingProvider({ children: null });
          rendering = false;
          effects.forEach((fn) => { try { fn(); } catch { /* stubbed away */ } });
        } while (dirty);
      }
      render();
      return { api: () => value };
    };

    /** Every distinct notice raised across a whole start, not one snapshot —
     *  the nudge is transient and a single reading can miss it either way. */
    const noticesDuring = async (platform, connected = true) => {
      const h = mount(platform, connected);
      const seen = new Set();
      h.api().open('equalizer', 'night-run');
      for (let i = 0; i < 40; i++) {
        const n = h.api().playbackNotice;
        if (n) seen.add(n);
        await new Promise((r) => setTimeout(r, 5));
      }
      return [...seen];
    };

    const appleSeen = await noticesDuring('appleMusic');
    check('an Apple drive is never told to wake Spotify',
      !appleSeen.some((n) => /Spotify/i.test(n)), JSON.stringify(appleSeen));

    // CONTROL: the nudge must still reach a Spotify listener, or the check
    // above passes because the nudge is broken rather than because it is
    // correctly held back.
    const spotSeen = await noticesDuring('spotify');
    check('control — a Spotify drive still gets the wake tip',
      spotSeen.some((n) => /Spotify/i.test(n)), JSON.stringify(spotSeen));

    // The whole point of the fix, end to end: chose Apple Music, never
    // granted access, pressed play.
    const ungranted = await noticesDuring('appleMusic', false);
    check('an unauthorised Apple drive is told to connect',
      ungranted.some((n) => /Connect Apple Music/.test(n)), JSON.stringify(ungranted));
    check('...and is NOT told its station has no playlist',
      !ungranted.some((n) => /doesn't have its own playlist/.test(n)), JSON.stringify(ungranted));
  }

  console.log(fails === 0
    ? '\n  every message names the service the listener is actually using\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
