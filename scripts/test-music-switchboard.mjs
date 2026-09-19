// EXACTLY ONE MUSIC SERVICE MAY BE DRIVING AT A TIME.
//
// Owner's screen recording, 04.08: on a Spotify drive the transport flapped
// between play and pause and the clock ran 0:09 → 0:06 → 0:10 → 0:11 → 0:13
// → 0:10. Two sources were reporting one song. `useMusicPlayback` handed the
// SAME `visible` flag to both players, with a comment claiming the unselected
// one "idles cheaply" — it does not: each polls its own service and writes the
// shared play state, so on any build carrying MusicKit both were live at once.
//
// THE FIX WAS ONE FLAG EACH, AND IT HAS NEVER BEEN CHECKED SINCE. That flag
// gates the poll, the adopt AND the AppState listener, so getting it wrong
// costs three things at once — and one of them is the repeating timer that
// iOS kills an app for (27.07, bug_type 309). It is also invisible in a
// browser sweep, because there is no MusicKit there: on web `useApple` is
// always false and the whole Apple branch is dark. Every case below is one a
// sweep structurally cannot reach.
//
// Driven against the SHIPPED switchboard on a minimum viable hook runtime,
// with each player stubbed to record the flag it was handed.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const SRC = `${REPO}/src/utils/useMusicPlayback.ts`;

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};
const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * `platform` is what the listener chose; `hasMusicKit` is whether this BUILD
 * carries the native module — the two are independent, and the pair that
 * matters most is "chose Apple Music, running a build without it".
 */
function mount({ platform = 'spotify', hasMusicKit = true, visible = true } = {}) {
  let isVisibleNow = visible;
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  // What each player was told. The LAST entry is what it is being asked to do
  // now; the history matters because a player that is briefly woken and then
  // stood down has still started a poll.
  const asked = { spotify: [], apple: [] };

  let slots = [];
  let idx = 0;
  let effects = [];
  let rendering = false;
  let result = null;

  const React = {
    useRef: (init) => {
      const i = idx++;
      if (!(i in slots)) slots[i] = { current: init };
      return slots[i];
    },
    useState: (init) => {
      const i = idx++;
      if (!(i in slots)) slots[i] = init;
      return [slots[i], (next) => {
        const v = typeof next === 'function' ? next(slots[i]) : next;
        if (Object.is(v, slots[i])) return;
        slots[i] = v;
        if (!rendering) render();
      }];
    },
    useEffect: (fn, deps) => { effects.push([fn, deps]); },
  };

  // Each player returns a value stamped with its own name, so the test can
  // tell WHICH ONE the switchboard handed back rather than assuming.
  const player = (name) => (isVisible) => {
    asked[name].push(!!isVisible);
    return { from: name, track: null, connected: true, play: () => {}, pause: () => {} };
  };

  const req = (n) => {
    if (n === 'react') return React;
    if (n === './musicPlatform') return { getSavedPlatform: async () => platform };
    if (n === './appleMusic') return { appleMusicAvailable: () => hasMusicKit };
    if (n === './useSpotifyPlayback') return { useSpotifyPlayback: player('spotify'), nextRepeat: () => 'off' };
    if (n === './useAppleMusicPlayback') return { useAppleMusicPlayback: player('apple') };
    if (n === './driveStats') return { noteTrackHeard: async () => {} };
    if (n === './widgetArtwork') return { noteSongForWidgets: async () => false };
    if (n === './widgetData') return { publishWidgetData: async () => {} };
    return new Proxy({}, { get: () => () => {} });
  };

  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, req);

  const prevDeps = new Map();
  function render() {
    rendering = true;
    idx = 0;
    effects = [];
    result = m.exports.useMusicPlayback(isVisibleNow);
    rendering = false;
    effects.forEach(([fn, deps], i) => {
      const before = prevDeps.get(i);
      const changed = !before || !deps
        || deps.length !== before.length
        || deps.some((d, k) => !Object.is(d, before[k]));
      if (changed) { prevDeps.set(i, deps); fn(); }
    });
  }

  render();
  return {
    asked,
    settle: async () => { await tick(); await tick(); },
    result: () => result,
    /** The screen going away mid-drive — minimised, or the deck closed. */
    setVisible: (v) => { isVisibleNow = v; render(); },
  };
}

/** The flag each player is being asked to run under, right now. */
const now = (h) => ({
  spotify: h.asked.spotify[h.asked.spotify.length - 1],
  apple: h.asked.apple[h.asked.apple.length - 1],
});

await (async () => {
  console.log('\n  the selected service drives, and only it:');
  {
    const h = mount({ platform: 'appleMusic', hasMusicKit: true });
    await h.settle();
    check('an Apple Music listener wakes Apple', now(h).apple === true);
    check('...and Spotify is stood down', now(h).spotify === false);
    check('...and the value returned is Apple\'s', h.result().from === 'apple');
    check('...carrying the platform for anyone who asks', h.result().platform === 'appleMusic');
    /**
     * SPOTIFY IS WOKEN FOR THE FIRST FRAME AND THAT IS CORRECT, NOT A LEAK.
     * The saved platform is read from storage, so the first render happens
     * before the answer arrives and Spotify holds the seat by default. What
     * matters is that it is stood down the instant the answer lands, and that
     * the frame cannot do any harm: useSpotifyPlayback's mount effect checks
     * its own cancel flag immediately after `isSpotifyConnected()`, and the
     * cleanup sets that flag — so it never reaches the service or writes the
     * shared play state. Do NOT "fix" this by racing the platform read; the
     * property to protect is the one below.
     */
    check('Spotify is woken once at most, and only at the start',
      h.asked.spotify.filter(Boolean).length <= 1, JSON.stringify(h.asked.spotify));
    check('...and it does not flap back on',
      h.asked.spotify.lastIndexOf(true) < h.asked.spotify.lastIndexOf(false),
      JSON.stringify(h.asked.spotify));
  }
  {
    const h = mount({ platform: 'spotify', hasMusicKit: true });
    await h.settle();
    check('a Spotify listener wakes Spotify', now(h).spotify === true);
    check('...and Apple is stood down', now(h).apple === false);
    check('...and the value returned is Spotify\'s', h.result().from === 'spotify');
    check('Apple was NEVER woken, not even for a frame',
      !h.asked.apple.some(Boolean), JSON.stringify(h.asked.apple));
  }

  console.log('\n  a build without MusicKit falls back rather than going dead:');
  {
    // Web, and every build before the native module shipped. Choosing Apple
    // Music there must not leave the app with no player at all.
    const h = mount({ platform: 'appleMusic', hasMusicKit: false });
    await h.settle();
    check('Spotify takes the seat', now(h).spotify === true);
    check('Apple stays asleep', now(h).apple === false);
    check('the value returned is Spotify\'s', h.result().from === 'spotify');
    check('...but the platform still reports what was CHOSEN',
      h.result().platform === 'appleMusic');
  }

  console.log('\n  before the saved platform is known:');
  {
    // Storage is async, so the first render happens with nothing loaded.
    const h = mount({ platform: 'appleMusic', hasMusicKit: true });
    check('Spotify holds the seat — the historic default', now(h).spotify === true);
    check('...and Apple is not also running', now(h).apple === false);
    await h.settle();
    check('Apple takes over once the answer arrives', now(h).apple === true);
    check('...and Spotify stands down in the same breath', now(h).spotify === false);
  }

  console.log('\n  nothing polls when the screen is gone (the 27.07 rule):');
  {
    const h = mount({ platform: 'appleMusic', hasMusicKit: true, visible: false });
    await h.settle();
    check('Apple is not running', now(h).apple === false);
    check('Spotify is not running', now(h).spotify === false);
    check('neither was EVER woken', !h.asked.apple.some(Boolean) && !h.asked.spotify.some(Boolean));
  }
  {
    const h = mount({ platform: 'spotify', hasMusicKit: true, visible: false });
    await h.settle();
    check('the same with Spotify chosen',
      now(h).spotify === false && now(h).apple === false);
  }

  console.log('\n  ...and it stops when the screen goes AWAY, which is the real case:');
  {
    /**
     * WHY THIS IS SEPARATE FROM THE CASES ABOVE, and it was found by
     * mutation-testing this very suite: mounting with `visible: false` cannot
     * catch a missing gate, because the saved platform is itself only read
     * while visible — so nothing ever selects Apple and the player stays
     * asleep for the wrong reason. The gate only shows when a RUNNING drive
     * is taken off screen, which is also what actually happens: minimising
     * the app, or closing the deck. A poll left running there is the repeating
     * timer iOS kills an app for (27.07).
     */
    const h = mount({ platform: 'appleMusic', hasMusicKit: true, visible: true });
    await h.settle();
    check('Apple is running while the drive is on screen', now(h).apple === true);
    h.setVisible(false);
    await h.settle();
    check('the screen goes — Apple stops', now(h).apple === false);
    check('...and Spotify does not take over', now(h).spotify === false);
    h.setVisible(true);
    await h.settle();
    check('coming back wakes Apple again', now(h).apple === true);
    check('...and still not Spotify', now(h).spotify === false);
  }
  {
    const h = mount({ platform: 'spotify', hasMusicKit: true, visible: true });
    await h.settle();
    check('the same for a Spotify drive', now(h).spotify === true);
    h.setVisible(false);
    await h.settle();
    check('...it stops when the screen goes', now(h).spotify === false);
  }

  console.log('\n  and never both, in any combination:');
  {
    let both = 0, cases = 0;
    for (const platform of ['spotify', 'appleMusic', 'none', null]) {
      for (const hasMusicKit of [true, false]) {
        for (const visible of [true, false]) {
          const h = mount({ platform, hasMusicKit, visible });
          await h.settle();
          cases++;
          const n = now(h);
          if (n.spotify && n.apple) {
            both++;
            console.log(`       both live: platform=${platform} musicKit=${hasMusicKit} visible=${visible}`);
          }
        }
      }
    }
    check(`no combination runs both players (${cases} checked)`, both === 0);
    check('...and enough combinations were actually tried', cases === 16);
  }

  console.log(fails === 0
    ? '\n  one service drives, the other is genuinely asleep\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
