// ONE STATION, ONE PLAYLIST PER SERVICE — AND NEITHER MAY EAT THE OTHER.
//
// Owner, 04.08 and again 11.08: there was a single slot per station, so
// linking an Apple Music playlist overwrote the Spotify one and vice versa.
// Trying the other service ONCE silently threw away every playlist you had
// chosen, and the station page went on showing a link that playback then
// refused — an Apple player cannot open a `spotify:` uri.
//
// WHY THIS SUITE EXISTS AT ALL: the 11.08 fix was verified, thoroughly, in a
// scratchpad file (`scratchpad/plt/t.mjs`, 12 cases) — and scratchpad files
// do not survive a container reset, so the coverage was gone within days and
// nothing has checked this store since. It is the single most Apple-specific
// piece of state in the app, it is invisible when it breaks (the page shows a
// link; playback refuses it), and it was the thing a real listener reported
// twice. Committed this time.
//
// Every case runs against the SHIPPED module, transpiled, on a fake
// AsyncStorage — so the migration, the slot rules and the reverse lookup are
// the app's own, not a restatement of them.
import fs from 'node:fs';
import ts from '/home/user/CruiseFM/node_modules/typescript/lib/typescript.js';

const REPO = '/home/user/CruiseFM';
const SRC = `${REPO}/src/utils/stationPlaylists.ts`;
const KEY = 'cruise_station_playlists';

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails++; console.log('  FAIL', n, extra);
};

/** `platform` is what the listener has chosen; `seed` is what is on disk. */
function load({ platform = 'spotify', seed = null } = {}) {
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const store = new Map();
  if (seed !== null) store.set(KEY, JSON.stringify(seed));
  const asyncStorage = {
    __esModule: true,
    default: {
      getItem: async (k) => (store.has(k) ? store.get(k) : null),
      setItem: async (k, v) => { store.set(k, v); },
    },
  };
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, (name) => {
    if (name === '@react-native-async-storage/async-storage') return asyncStorage;
    if (name === '@/utils/musicPlatform') return { getSavedPlatform: async () => platform };
    return new Proxy({}, { get: () => () => {} });
  });
  return { P: m.exports, raw: () => JSON.parse(store.get(KEY) ?? '{}') };
}

const SPOT = { uri: 'spotify:playlist:37i9dQ', name: 'Night Drive' };
const APPL = { uri: 'applemusic:playlist:p.abc123', name: 'Late Shift' };

await (async () => {
  console.log('\n  the bug this store exists to prevent:');
  {
    // Link on Spotify, switch service, link on Apple. Before 11.08 the second
    // link destroyed the first.
    const a = load({ platform: 'spotify' });
    await a.P.setStationPlaylist('night-run', SPOT);
    const seed = a.raw();

    const b = load({ platform: 'appleMusic', seed });
    await b.P.setStationPlaylist('night-run', APPL);

    const back = load({ platform: 'spotify', seed: b.raw() });
    check('the Spotify choice survives linking an Apple one',
      (await back.P.getStationPlaylist('night-run'))?.uri === SPOT.uri);
    const onApple = load({ platform: 'appleMusic', seed: b.raw() });
    check('...and the Apple one is there too',
      (await onApple.P.getStationPlaylist('night-run'))?.uri === APPL.uri);
  }

  console.log('\n  a playlist is filed by its OWN service, not the one selected:');
  {
    // An Apple Music listener pastes a Spotify link. It must land in the
    // Spotify slot, or a stale platform setting corrupts the file.
    const h = load({ platform: 'appleMusic' });
    await h.P.setStationPlaylist('coastal', SPOT);
    check('a Spotify link saved by an Apple listener lands in the Spotify slot',
      h.raw()['coastal']?.spotify?.uri === SPOT.uri, JSON.stringify(h.raw()));
    check('...and NOT in the Apple slot', !h.raw()['coastal']?.appleMusic);
    check('so playback on Apple correctly finds nothing',
      (await h.P.getStationPlaylist('coastal')) === null);
  }
  { check('platformOfUri reads an Apple uri', load({}).P.platformOfUri(APPL.uri) === 'appleMusic'); }
  { check('platformOfUri reads a Spotify uri', load({}).P.platformOfUri(SPOT.uri) === 'spotify'); }

  console.log('\n  the old one-slot-per-station file is migrated, not lost:');
  {
    const h = load({ platform: 'spotify', seed: { 'night-run': SPOT } });
    check('a v1 Spotify entry is readable on Spotify',
      (await h.P.getStationPlaylist('night-run'))?.uri === SPOT.uri);
    const onApple = load({ platform: 'appleMusic', seed: { 'night-run': SPOT } });
    check('...and is correctly NOT offered to an Apple listener',
      (await onApple.P.getStationPlaylist('night-run')) === null);
  }
  {
    const h = load({ platform: 'appleMusic', seed: { coastal: APPL } });
    check('a v1 Apple entry migrates into the Apple slot',
      (await h.P.getStationPlaylist('coastal'))?.uri === APPL.uri);
  }
  {
    // A v2 file must survive being read and written again unchanged — a
    // migration that re-migrates its own output is how data quietly rots.
    const seed = { 'night-run': { spotify: SPOT, appleMusic: APPL } };
    const h = load({ platform: 'spotify', seed });
    await h.P.setStationPlaylist('coastal', SPOT);
    check('an already-migrated file round-trips untouched',
      JSON.stringify(h.raw()['night-run']) === JSON.stringify(seed['night-run']),
      JSON.stringify(h.raw()['night-run']));
  }

  console.log('\n  unlinking takes one service, deleting a station takes both:');
  {
    const seed = { 'night-run': { spotify: SPOT, appleMusic: APPL } };
    const h = load({ platform: 'appleMusic', seed });
    await h.P.clearStationPlaylist('night-run');
    check('unlinking on Apple removes the Apple slot', !h.raw()['night-run']?.appleMusic);
    check('...and leaves Spotify alone', h.raw()['night-run']?.spotify?.uri === SPOT.uri);
  }
  {
    const seed = { 'night-run': { spotify: SPOT, appleMusic: APPL } };
    const h = load({ platform: 'spotify', seed });
    await h.P.clearStationPlaylistAll('night-run');
    check('deleting a station clears both services', !h.raw()['night-run']);
  }
  {
    const seed = { 'night-run': { appleMusic: APPL } };
    const h = load({ platform: 'appleMusic', seed });
    await h.P.clearStationPlaylist('night-run');
    check('the last slot going takes the station entry with it', !h.raw()['night-run']);
  }

  console.log('\n  the reverse lookup answers "whose playlist is this":');
  {
    const seed = { 'night-run': { spotify: SPOT }, coastal: { appleMusic: APPL } };
    // Deliberately asked while the OTHER service is selected: a uri names its
    // own service, so the answer must not depend on what is chosen today.
    const h = load({ platform: 'appleMusic', seed });
    check('a Spotify uri finds its station', await h.P.stationForPlaylist(SPOT.uri) === 'night-run');
    check('an Apple uri finds its station', await h.P.stationForPlaylist(APPL.uri) === 'coastal');
    check('an unknown uri finds nothing', await h.P.stationForPlaylist('spotify:playlist:zzz') === null);
    check('no uri at all is not an error', await h.P.stationForPlaylist(null) === null);
  }

  console.log('\n  a damaged file degrades instead of taking the app down:');
  {
    const seed = { 'night-run': { spotify: SPOT }, broken: { spotify: { name: 'no uri' } }, nope: 'string' };
    const h = load({ platform: 'spotify', seed });
    check('the good entry still reads',
      (await h.P.getStationPlaylist('night-run'))?.uri === SPOT.uri);
    check('a slot with no uri is dropped', (await h.P.getStationPlaylist('broken')) === null);
    check('a station whose value is nonsense is dropped', (await h.P.getStationPlaylist('nope')) === null);
  }
  {
    const h = load({ platform: 'spotify' });
    check('an empty store is not an error', (await h.P.getStationPlaylist('night-run')) === null);
  }

  console.log('\n  someone who never chose a service reads the Spotify slot:');
  {
    const seed = { 'night-run': { spotify: SPOT, appleMusic: APPL } };
    const h = load({ platform: 'none', seed });
    check('...so the deep-link handoff still has something to open',
      (await h.P.getStationPlaylist('night-run'))?.uri === SPOT.uri);
  }

  console.log(fails === 0
    ? '\n  each service keeps its own playlist, and neither can destroy the other\n'
    : `\n  ${fails} FAILED\n`);
  process.exit(fails === 0 ? 0 : 1);
})();
