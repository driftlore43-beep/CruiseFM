// THE STATION PAGE MUST NOT ASK A STRANGER FOR A SPOTIFY LINK.
//
// Owner, 11.09, off a TestFlight station page: "when I go in a station it
// asks for a Spotify link, due to the Spotify user cap. We can't do that."
//
// The picker stopped offering Spotify on 01.09. The station page never
// caught up: an unset platform was treated as Spotify
// (`p === 'spotify' || p == null`), so first-run and skipped listeners
// landed on "Drop in your own Spotify playlist".
//
// The property: Spotify linking is ONLY for people who already saved
// Spotify. Everyone else is offered Apple Music when the build can play
// it, or is a visual companion. A skip is never a lock on Start Drive.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');

let fails = 0;
const check = (n, ok, extra = '') => {
  if (ok) { console.log('  ok  ', n); return; }
  fails += 1;
  console.log('  FAIL', n, extra);
};

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const mpSrc = fs.readFileSync(path.join(ROOT, 'src/utils/musicPlatform.ts'), 'utf8');
const js = ts.transpileModule(mpSrc, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const m = { exports: {} };
const stubRequire = (id) => {
  if (String(id).includes('async-storage')) {
    return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  }
  if (id === 'react-native') {
    return { Linking: { canOpenURL: async () => false, openURL: async () => {} } };
  }
  return require(id);
};
new Function('module', 'exports', 'require', js)(m, m.exports, stubRequire);
const {
  offersSpotifyPlaylist,
  offersAppleMusicConnect,
  gatesStartOnPlaylist,
  playlistSheetKind,
} = m.exports;

let modal = fs.readFileSync(path.join(ROOT, 'src/components/StationDetailModal.tsx'), 'utf8');
let sheet = fs.readFileSync(path.join(ROOT, 'src/components/PlaylistSheet.tsx'), 'utf8');
let card = fs.readFileSync(path.join(ROOT, 'src/components/ConnectMusicCard.tsx'), 'utf8');
const hint = fs.readFileSync(path.join(ROOT, 'src/components/WakeSpotifyHint.tsx'), 'utf8');

// SELFTEST reintroduces the 11.09 shape: helper names gone, paste un-gated,
// and the old "unset means Spotify" line back in live code. Proven to FAIL
// before the pass is believed.
if (process.env.SELFTEST) {
  modal = modal.replace(/\boffersSpotifyPlaylist\b/g, 'NOT_THE_HELPER');
  sheet = sheet.replace(/\bplaylistSheetKind\b/g, 'NOT_THE_HELPER');
  sheet = sheet.replace("{kind === 'spotify' && (", '{true && (');
  card = card.replace(/\boffersAppleMusicConnect\b/g, 'NOT_THE_HELPER');
  modal += "\nsetSpotifyPlatform(p === 'spotify' || p == null);\n";
}

console.log('\n  Spotify linking is only for people already on it:');
check('saved Spotify is the only Spotify offer', offersSpotifyPlaylist('spotify') === true);
check('first-run is not a Spotify offer', offersSpotifyPlaylist(null) === false);
check('a skip is not a Spotify offer', offersSpotifyPlaylist('none') === false);
check('Apple Music is not a Spotify offer', offersSpotifyPlaylist('appleMusic') === false);
check('YouTube is not a Spotify offer', offersSpotifyPlaylist('youtubeMusic') === false);

console.log('\n  the home card offers Apple Music to the same people:');
check('Apple Music listeners see it', offersAppleMusicConnect('appleMusic') === true);
check('first-run sees it', offersAppleMusicConnect(null) === true);
check('skipped sees it', offersAppleMusicConnect('none') === true);
check('YouTube does not', offersAppleMusicConnect('youtubeMusic') === false);
check('saved Spotify does not', offersAppleMusicConnect('spotify') === false);

console.log('\n  Start Drive only waits when this platform can play in-app:');
check('Spotify always gates (they can paste a link)', gatesStartOnPlaylist('spotify', false) === true);
check('skipped never gates — visuals still start', gatesStartOnPlaylist('none', true) === false);
check('YouTube never gates', gatesStartOnPlaylist('youtubeMusic', true) === false);
check('first-run gates only when MusicKit is there', gatesStartOnPlaylist(null, true) === true);
check('first-run does not gate without MusicKit', gatesStartOnPlaylist(null, false) === false);
check('Apple Music gates when MusicKit is there', gatesStartOnPlaylist('appleMusic', true) === true);
check('Apple Music does not gate without MusicKit', gatesStartOnPlaylist('appleMusic', false) === false);

console.log('\n  the sheet kind matches the offer:');
check('saved Spotify opens the Spotify paste sheet', playlistSheetKind('spotify', true) === 'spotify');
check('first-run + MusicKit opens Apple', playlistSheetKind(null, true) === 'apple');
check('skipped + MusicKit still offers Apple (not a lock)', playlistSheetKind('none', true) === 'apple');
check('no MusicKit is companion', playlistSheetKind(null, false) === 'companion');
check('YouTube is companion even with MusicKit', playlistSheetKind('youtubeMusic', true) === 'companion');
check('Apple Music + MusicKit opens Apple', playlistSheetKind('appleMusic', true) === 'apple');

console.log('\n  the screens actually call the helpers (not a comment that claims it):');
check('station page calls offersSpotifyPlaylist', /\boffersSpotifyPlaylist\(/.test(modal));
check('station page calls playlistSheetKind', /\bplaylistSheetKind\(/.test(modal));
check('station page calls gatesStartOnPlaylist', /\bgatesStartOnPlaylist\(/.test(modal));
check('playlist sheet calls playlistSheetKind', /\bplaylistSheetKind\(/.test(sheet));
check('home card calls offersAppleMusicConnect', /\boffersAppleMusicConnect\(/.test(card));
check('home card saves Apple Music on connect', /savePlatform\(\s*['"]appleMusic['"]\s*\)/.test(card));
check('picking an Apple playlist saves the platform', /kind === 'apple'[\s\S]{0,80}savePlatform\(\s*['"]appleMusic['"]\s*\)/.test(sheet));

const modalLive = stripComments(modal);
const sheetLive = stripComments(sheet);
console.log('\n  the old "unset means Spotify" line is gone from live code:');
check('station page no longer treats null as Spotify',
  !/p === ['"]spotify['"]\s*\|\|\s*p == null/.test(modalLive));
check('Spotify paste copy sits behind spotifyOffer',
  /spotifyOffer[\s\S]{0,120}Drop in your own Spotify playlist/.test(modalLive));
check('paste box is gated on kind === spotify',
  /kind === ['"]spotify['"][\s\S]{0,2000}PasteLinkRow/.test(sheetLive));
check('the helpers were found at all (vacuous-pass guard)',
  /\boffersSpotifyPlaylist\(/.test(modal) && /\bplaylistSheetKind\(/.test(sheet)
    && typeof offersSpotifyPlaylist === 'function');

console.log('\n  the in-drive note does not send strangers to Spotify:');
check('wake hint uses the same offer helpers',
  /\boffersSpotifyPlaylist\(/.test(hint) && /\boffersAppleMusicConnect\(/.test(hint));
check('wake hint names Apple Music for people the picker still offers it to',
  /Connect Apple Music from the home page/.test(hint));

console.log(fails === 0 ? '\n  ALL PASS' : `\n  ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
