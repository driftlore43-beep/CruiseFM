// A SPOTIFY LISTENER WHO HAS NEVER SIGNED IN IS ASKED ONCE, NEVER BLOCKED.
//
//   node scripts/test-spotify-connect-ask.mjs
//
// THE BUG IT PINS (owner, 14.09, on a fresh iPad): "when I clicked on the
// station card it opened to Spotify with needing to sign in." Choosing Spotify
// in the picker does not sign you in — the connection is a separate, per-device
// thing — so pressing Start with no token fell straight through to the
// hand-off, which deep-links the playlist into the Spotify app. On a device
// where that app is not signed in either, the whole journey is: tap a station,
// get thrown out to another app's login, with nothing said.
//
// AND WHY IT MUST NOT BECOME A BLOCK, which is the harder half. Spotify grants
// in-app control to five invited accounts and refuses everyone else at its own
// sign-in page, BEFORE any token exists — so `isRestrictedAccount`, which is
// set by a 403 on a call we make WITH a token, is never set for them. The app
// therefore cannot tell who could connect, and refusing to hand off until
// someone had connected would strand every uninvited listener with no music at
// all. One ask, then out of the way for ever.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};

// ── the flag itself, against a fake AsyncStorage ──────────────────────────
const js = ts.transpileModule(
  readFileSync(`${ROOT}/src/utils/spotifyConnectAsk.ts`, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function load(store, { broken = false } = {}) {
  const AsyncStorage = {
    getItem: async (k) => { if (broken) throw new Error('unreadable'); return store[k] ?? null; },
    setItem: async (k, v) => { if (broken) throw new Error('unreadable'); store[k] = v; },
    removeItem: async (k) => { if (broken) throw new Error('unreadable'); delete store[k]; },
  };
  const mod = { exports: {} };
  // RETURN THE MODULE ITSELF, not { default: ... }. TypeScript emits
  // `__importDefault`, which wraps anything without an `__esModule` marker —
  // so handing it a pre-wrapped object nests it one deep, every call throws,
  // and the module's own catch branch answers every question. The first cut
  // of this test did exactly that and reported a fresh device as "already
  // asked", which looks like a real finding rather than a broken stub.
  new Function('module', 'exports', 'require', js)(mod, mod.exports,
    (n) => (n === '@react-native-async-storage/async-storage' ? AsyncStorage : {}));
  return mod.exports;
}

{
  const store = {};
  const M = load(store);
  check('a fresh device has not been asked', (await M.spotifyConnectAsked()) === false);
  check('reading does NOT spend it', Object.keys(store).length === 0,
    'a flag a check can spend is a flag something invisible can spend');
  await M.markSpotifyConnectAsked();
  check('after asking, it is spent', (await M.spotifyConnectAsked()) === true);
  await M.clearSpotifyConnectAsked();
  check('connecting (or disconnecting) resets it', (await M.spotifyConnectAsked()) === false);
}
{
  // FAILS TOWARD THE HAND-OFF. If storage cannot be read we must not ask —
  // a broken read is not a reason to withhold somebody's music.
  const M = load({}, { broken: true });
  check('unreadable storage is treated as already asked', (await M.spotifyConnectAsked()) === true);
}

// ── and the player must actually consult it, before handing off ───────────
const ctx = readFileSync(`${ROOT}/src/context/NowPlayingContext.tsx`, 'utf8');
check('the player imports the ask', /spotifyConnectAsked/.test(ctx) && /markSpotifyConnectAsked/.test(ctx));
const askAt = ctx.indexOf('spotifyConnectAsked()');
const handoffAt = ctx.indexOf('if (await openInSpotify(linked.uri)) return \'handoff\';');
check('it is checked BEFORE the hand-off', askAt > 0 && handoffAt > 0 && askAt < handoffAt,
  'asking after the app has already opened Spotify would be pointless');
check('it only applies to Spotify listeners', /getSavedPlatform\(\)\) === 'spotify'/.test(ctx));
check('a connected listener is never asked', /!connected && !restricted/.test(ctx));
check('the ask is spent when it is shown, not when it is checked',
  /await markSpotifyConnectAsked\(\);\s*\n\s*return 'not-connected';/.test(ctx));
check('there is a message for it', /'not-connected':\s*'[^']+'/.test(ctx));

// Connecting and disconnecting both clear it, or a reconnect would never be
// offered again on a device that had already used its one ask.
const sp = readFileSync(`${ROOT}/src/utils/spotify.ts`, 'utf8');
check('a successful sign-in clears the ask',
  /if \(scope\) await AsyncStorage\.setItem\(SCOPE_KEY, scope\);[\s\S]{0,400}?clearSpotifyConnectAsked\(\)/.test(sp));
check('disconnecting clears it too',
  /disconnectSpotify[\s\S]{0,400}?clearSpotifyConnectAsked\(\)/.test(sp));
check("'not-connected' is a real StartResult", /\|\s*'not-connected'/.test(sp));

console.log(fails ? `\n${fails} failure(s)` : '\nasked once, then out of the way');
process.exit(fails ? 1 : 0);
