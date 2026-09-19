// THE ALBUM COVER HAS TO REACH THE WIDGET, AND ON APPLE MUSIC IT NEVER DID.
//
// Ethan, 18.09: "the Album Artwork doesn't show in the widgets as well it
// just shows the Station background."
//
// Three of the widget looks draw the station's own photograph on purpose
// (the owner's call, 03.09: "do it the station cover so people can add their
// photos in"), so some of what he saw is by design. The CD look is the
// exception — it draws the SONG first — and it was falling back too, which is
// what makes this a bug rather than a preference.
//
// THE CAUSE IS A RACE BETWEEN A SONG AND ITS COVER. MusicKit returns nothing
// for a library track's artwork (04.08), so an Apple Music cover comes from
// the public catalogue lookup, which runs alongside the poll and patches the
// url into the track a beat AFTER the song itself appears. Two separate
// gates then threw it away:
//
//   1. `useMusicPlayback` keyed its song-changed effect on title+artist, so
//      it never ran again once the url arrived.
//   2. `noteLastPlayed` returned false for anything with the same title and
//      artist, whatever happened to the artwork — so even a forced second
//      call would have declined to ship it.
//
// Net effect: every song was handed to the widgets with `artUrl: null`, for
// every Apple Music listener, for as long as the widgets have existed.
// Spotify sends its cover in the first poll, which is why it was never seen.
//
// Both gates are proven against the ORIGINAL source (via `git show`, never
// touching the working tree) before the fix is tested.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const PRE_FIX = '72ab100';
let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

const compile = (src) => ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function load(src) {
  const store = new Map();
  const asyncStorage = {
    __esModule: true,
    default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => { store.set(k, v); },
    },
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', compile(src))(
    m, m.exports,
    (name) => (name === '@react-native-async-storage/async-storage'
      ? asyncStorage
      : new Proxy({}, { get: () => () => {} })),
  );
  return { L: m.exports, store };
}

const FIXED = fs.readFileSync(`${REPO}/src/utils/lastPlayed.ts`, 'utf8');
const ORIGINAL = execSync(`git show ${PRE_FIX}:src/utils/lastPlayed.ts`, { cwd: REPO, encoding: 'utf8' });
const ART = 'https://is1-ssl.mzstatic.com/image/thumb/cover/240x240bb.jpg';

await (async () => {
  console.log('\n  the control — the original dropped a cover that arrived late:');
  {
    const { L } = load(ORIGINAL);
    await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', null);
    const again = await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', ART);
    check('the ORIGINAL refuses the late cover (control — must be false)', again === false);
  }

  console.log('\n  a song, then its cover a beat later — the Apple Music order:');
  {
    const { L } = load(FIXED);
    check('the song itself is news', await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', null) === true);
    check('the same song again is not', await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', null) === false);
    check('the cover arriving IS news', await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', ART) === true);
    check('...and it is written down', (await L.getLastPlayed()).artUrl === ART);
    check('the same cover again is not news', await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', ART) === false);
  }

  console.log('\n  and it only counts in that one direction:');
  {
    const { L } = load(FIXED);
    await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', ART);
    check('a null after a real cover is not news', await L.noteLastPlayed('Zero', 'The Smashing Pumpkins', null) === false);
    check('...and the good cover is kept', (await L.getLastPlayed()).artUrl === ART);
  }

  console.log('\n  Spotify, which sends the cover with the song, is unchanged:');
  {
    const { L } = load(FIXED);
    check('first sighting is news', await L.noteLastPlayed('Starboy', 'The Weeknd', ART) === true);
    check('the poll five seconds later is not', await L.noteLastPlayed('Starboy', 'The Weeknd', ART) === false);
    check('a genuinely new song is', await L.noteLastPlayed('Blinding Lights', 'The Weeknd', ART) === true);
  }

  console.log('\n  the hook asks again when the cover lands:');
  {
    const now = fs.readFileSync(`${REPO}/src/utils/useMusicPlayback.ts`, 'utf8');
    const was = execSync(`git show ${PRE_FIX}:src/utils/useMusicPlayback.ts`, { cwd: REPO, encoding: 'utf8' });
    const key = (s) => /const heard =([\s\S]*?);\n/.exec(s)?.[1] ?? '';
    check('the ORIGINAL key ignored the cover (control)', !/albumArt/.test(key(was)), key(was).trim());
    check('the key now carries it', /albumArt/.test(key(now)), key(now).trim());
    check('...and still carries the song itself',
      /title/.test(key(now)) && /artist/.test(key(now)));
  }

  console.log(fails === 0
    ? '\n  a cover that arrives after its song still reaches the widgets\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
