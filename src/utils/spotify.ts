import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID     = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET!;
// Must match EXACTLY what is registered in the Spotify dashboard.
const REDIRECT_URI  = 'cruisefm://auth';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const TOKEN_KEY         = 'spotify_access_token';
const SCOPE_KEY         = 'spotify_granted_scopes';
const REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const EXPIRY_KEY        = 'spotify_token_expiry';
const VERIFIER_KEY      = 'spotify_pkce_verifier';

export const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint:         'https://accounts.spotify.com/api/token',
};

// ── PKCE helpers ─────────────────────────────────────────────────────────────
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Manual base64 (Hermes has no global btoa).
function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[b2 & 63] : '=';
  }
  return out;
}

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncode(bytes: Uint8Array): string {
  return toBase64Url(bytesToBase64(bytes));
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return toBase64Url(digest);
}

/**
 * Opens the Spotify login. The PKCE verifier is persisted first, so whether the
 * redirect returns via the in-app browser (iOS) OR deep-links into the app and
 * is handled by the /auth route (Android), the token exchange can complete.
 * Returns true if connected via the in-app browser path.
 */
export async function connectSpotify(): Promise<boolean> {
  try {
    const verifier  = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    await AsyncStorage.setItem(VERIFIER_KEY, verifier);

    const authUrl =
      `${discovery.authorizationEndpoint}?` +
      formEncode({
        response_type:         'code',
        client_id:             CLIENT_ID,
        scope:                 SCOPES,
        redirect_uri:          REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge:        challenge,
      });

    const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
    if (result.type !== 'success' || !result.url) return false;

    const match = result.url.match(/[?&]code=([^&]+)/);
    const code = match ? decodeURIComponent(match[1]) : null;
    if (!code) return false;

    return await completeSpotifyAuth(code);
  } catch {
    return false;
  }
}

/**
 * Completes the token exchange using the persisted PKCE verifier. Idempotent:
 * the verifier is consumed once, so if both the in-app browser return AND the
 * /auth deep-link route fire, only the first succeeds and the second no-ops.
 */
export async function completeSpotifyAuth(code: string): Promise<boolean> {
  const verifier = await AsyncStorage.getItem(VERIFIER_KEY);
  if (!verifier) return false;
  await AsyncStorage.removeItem(VERIFIER_KEY);
  return exchangeCodeForToken(code, verifier);
}

export async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<boolean> {
  try {
    const body = formEncode({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      client_id:     CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const res = await fetch(discovery.tokenEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json();
    if (!data.access_token) return false;

    await saveTokens(data.access_token, data.refresh_token, data.expires_in, data.scope);
    return true;
  } catch {
    return false;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    // PKCE refresh: client_id in body, no client secret / Basic auth needed.
    const body = formEncode({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
    });

    const res = await fetch(discovery.tokenEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json();
    if (!data.access_token) return null;

    await saveTokens(data.access_token, data.refresh_token ?? refreshToken, data.expires_in, data.scope);
    return data.access_token;
  } catch {
    return null;
  }
}

async function saveTokens(
  accessToken: string, refreshToken: string, expiresIn: number, scope?: string,
) {
  const expiry = Date.now() + expiresIn * 1000;
  await AsyncStorage.multiSet([
    [TOKEN_KEY,         accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
    [EXPIRY_KEY,        String(expiry)],
  ]);
  // Spotify names the granted scopes in the token response, and a refresh
  // NEVER adds one that wasn't granted at sign-in. Keeping them means the
  // question "does this connection have permission to read playlists?" can be
  // ANSWERED rather than argued about — two rounds were lost to guessing.
  if (scope) await AsyncStorage.setItem(SCOPE_KEY, scope);
}

/** The scopes Spotify granted this connection, or null if unknown (a token
 *  minted before this was recorded). */
export async function getGrantedScopes(): Promise<string | null> {
  try { return await AsyncStorage.getItem(SCOPE_KEY); } catch { return null; }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const [[, token], [, expiry]] = await AsyncStorage.multiGet([TOKEN_KEY, EXPIRY_KEY]);
    if (!token) return null;
    if (expiry && Date.now() < Number(expiry) - 60000) return token;
    return await refreshAccessToken();
  } catch {
    return null;
  }
}

export async function isSpotifyConnected(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

export async function disconnectSpotify(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRY_KEY, RESTRICTED_KEY, SCOPE_KEY]);
  restrictedCache = null;
}

// ── Dev-mode allowlist detection ─────────────────────────────────────────────
// A connected account that isn't on the app's Spotify allowlist gets 403
// "user not registered" on every API call. We remember that and the app
// falls back to handing drives to the Spotify app directly.

const RESTRICTED_KEY = 'spotify_restricted_account';
let restrictedCache: boolean | null = null;

export async function isRestrictedAccount(): Promise<boolean> {
  if (restrictedCache != null) return restrictedCache;
  try {
    restrictedCache = (await AsyncStorage.getItem(RESTRICTED_KEY)) === 'true';
  } catch {
    restrictedCache = false;
  }
  return restrictedCache;
}

function setRestricted(on: boolean) {
  if (restrictedCache === on) return;
  restrictedCache = on;
  AsyncStorage.setItem(RESTRICTED_KEY, on ? 'true' : 'false').catch(() => {});
}

/** classify403 narrowed to the vocabulary the start path speaks. */
async function startResult403(res: Response): Promise<'restricted' | 'premium-required'> {
  const kind = await classify403(res);
  return kind === 'restricted' ? 'restricted' : 'premium-required';
}

/**
 * 403 body sniff. Spotify uses one status code for several unrelated
 * refusals, and they have completely different fixes, so the body is the only
 * thing that can tell them apart:
 *
 *  - "not registered"       — this account isn't on the dev-mode allowlist.
 *  - "Insufficient client scope" — the token was minted before Cruise FM
 *    asked for a permission it now needs. RECONNECTING FIXES IT, and nothing
 *    else does; the account and the playlist are both fine.
 *  - anything else          — Spotify is refusing this particular resource.
 *    For a playlist that means one of its own (a Daily Mix, Discover Weekly,
 *    an editorial list), which apps outside Spotify cannot read.
 */
async function classify403(res: Response): Promise<'restricted' | 'scope' | 'premium-required'> {
  return (await classify403Detailed(res)).kind;
}

/** As classify403, but also hands back what Spotify actually said, for the
 *  screens that can show it. Reads the body ONCE — a Response body cannot be
 *  consumed twice, so everything that wants it goes through here. */
async function classify403Detailed(
  res: Response,
): Promise<{ kind: 'restricted' | 'scope' | 'premium-required'; detail?: string }> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return { kind: 'premium-required' };
  }
  let detail: string | undefined;
  try {
    detail = JSON.parse(text)?.error?.message || undefined;
  } catch {
    detail = text.slice(0, 200) || undefined;
  }
  if (/not registered/i.test(text)) {
    setRestricted(true);
    return { kind: 'restricted', detail };
  }
  if (/scope/i.test(text)) return { kind: 'scope', detail };
  return { kind: 'premium-required', detail };
}


// ── Timed fetch — a drive must never stall on a sleepy network ───────────────
// Spotify calls sit between "user pressed play" and music/handoff; an
// unanswered request should give up fast so the fallback path can run.
const FETCH_TIMEOUT_MS = 4000;
function timedFetch(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ── Playback controls ────────────────────────────────────────────────────────

async function spotifyFetch(endpoint: string, method = 'GET', body?: object) {
  const token = await getAccessToken();
  if (!token) return null;
  let res: Response;
  try {
    res = await timedFetch(`https://api.spotify.com/v1${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return null; // timed out / offline — callers treat null as "no data"
  }
  if (res.ok && restrictedCache) setRestricted(false); // e.g. after being allowlisted
  if (res.status === 403) { classify403(res); return null; }
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

/** Why a request came back with nothing. `spotifyFetch` folds all of these
 *  into null, which is right for the polling paths — a drive must not stop to
 *  explain itself — but wrong for a screen the user is looking at. */
export type FailReason =
  | 'offline' | 'auth' | 'scope' | 'restricted' | 'forbidden' | 'notfound' | 'busy' | 'error';

export type FetchResult =
  | { ok: true; data: any }
  | { ok: false; reason: FailReason; detail?: string };

/**
 * The same call as spotifyFetch, but it says what happened.
 *
 * Use this anywhere a person is waiting on the answer: "couldn't read this"
 * and "this is empty" look identical to the caller otherwise, which is
 * exactly how the song list ended up telling the owner her playlist had no
 * songs in it (03.08). The timeout is separate too — the 4s used everywhere
 * else exists so a start attempt fails over to the handoff path quickly, and
 * it is far too impatient for a list fetched over a moving car's signal.
 */
export async function spotifyFetchDetailed(endpoint: string, timeoutMs = 12000): Promise<FetchResult> {
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: 'auth' };
  let res: Response;
  try {
    res = await timedFetch(
      `https://api.spotify.com/v1${endpoint}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } },
      timeoutMs,
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.ok && restrictedCache) setRestricted(false);
  if (res.status === 401) return { ok: false, reason: 'auth' };
  // Awaited, unlike the polling path's fire-and-forget: which 403 this is
  // decides what the screen tells the user to do about it.
  if (res.status === 403) {
    // Spotify's own words, carried all the way to the screen. Two rounds of
    // theorising about this 403 (missing scope? an editorial playlist?) were
    // both wrong, and each cost the owner a reconnect that could never have
    // helped. Whatever it says next is the answer, so stop paraphrasing it.
    const { kind, detail } = await classify403Detailed(res);
    if (kind === 'restricted') return { ok: false, reason: 'restricted', detail };
    return { ok: false, reason: kind === 'scope' ? 'scope' : 'forbidden', detail };
  }
  if (res.status === 404) return { ok: false, reason: 'notfound' };
  if (res.status === 429) return { ok: false, reason: 'busy' };
  if (!res.ok) return { ok: false, reason: 'error' };
  try { return { ok: true, data: await res.json() }; } catch { return { ok: false, reason: 'error' }; }
}

export async function getPlaybackState() {
  return spotifyFetch('/me/player');
}

// Playlist names by id — tiny session cache so the "playing from" pill can
// name the playlist actually feeding the music without a fetch per poll.
const playlistNameCache: Record<string, string> = {};
const PROFILE_NAME_KEY = 'cruise_spotify_display_name';
let profileNameCache: string | null = null;

/** The listener's Spotify display name, for the share card's "X is listening
 *  on …" line. Cached in memory and on disk — it never changes mid-drive, and
 *  the card must not wait on a network round trip to render. Returns null when
 *  Spotify isn't connected, and callers fall back to a name-free line. */
export async function getProfileName(): Promise<string | null> {
  if (profileNameCache) return profileNameCache;
  const stored = await AsyncStorage.getItem(PROFILE_NAME_KEY);
  if (stored) { profileNameCache = stored; return stored; }
  const data = await spotifyFetch('/me');
  const name: string | null = data?.display_name ?? null;
  if (name) {
    profileNameCache = name;
    AsyncStorage.setItem(PROFILE_NAME_KEY, name).catch(() => {});
  }
  return name;
}

export async function getPlaylistName(playlistId: string): Promise<string | null> {
  if (playlistNameCache[playlistId]) return playlistNameCache[playlistId];
  const data = await spotifyFetch(`/playlists/${playlistId}?fields=name`);
  const name = data?.name ?? null;
  if (name) playlistNameCache[playlistId] = name;
  return name;
}

export async function play(contextUri?: string) {
  return spotifyFetch('/me/player/play', 'PUT', contextUri ? { context_uri: contextUri } : undefined);
}

export type Device = { id: string; is_active: boolean; name: string; type: string };

export async function getDevices(): Promise<Device[]> {
  const data = await spotifyFetch('/me/player/devices');
  return data?.devices ?? [];
}

export type StartResult =
  /** Spotify was opened to wake it before playing. */
  | 'waking'
  | 'playing'
  | 'no-device'
  | 'premium-required'
  | 'restricted'      // account not on the dev-mode allowlist
  | 'handoff'         // playlist handed to the Spotify app (set by the caller)
  | 'no-playlist'     // station has no linked playlist — nothing to play (set by the caller)
  | 'error';

/**
 * Best-effort "just start playing": finds an available Spotify device (the
 * user's phone app counts once it's been opened at least once), wakes it, and
 * resumes playback. Returns 'no-device' if Spotify isn't running anywhere —
 * the caller should then open the Spotify app so it becomes a device — and
 * 'premium-required' when Spotify refuses remote control (free accounts).
 */
export async function startPlayback(
  contextUri?: string,
  /** Start partway into the context — the in-drive song list uses this to
   *  begin at a chosen track without losing the playlist. */
  offset?: { uri: string },
): Promise<StartResult> {
  try {
    return await startPlaybackInner(contextUri, offset);
  } catch {
    // Timed out / offline mid-sequence — report error so the caller can
    // fall back (e.g. hand the playlist to the Spotify app) without waiting.
    return 'error';
  }
}

async function startPlaybackInner(contextUri?: string, offset?: { uri: string }): Promise<StartResult> {
  const token = await getAccessToken();
  if (!token) return 'error';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };
  const body = contextUri
    ? JSON.stringify(offset ? { context_uri: contextUri, offset } : { context_uri: contextUri })
    : undefined;
  const attempt = (query = '') =>
    timedFetch(`https://api.spotify.com/v1/me/player/play${query}`, { method: 'PUT', headers, body });

  // Fast path: when a device is already active (the usual case mid-drive),
  // one round trip starts the music — no device lookup first.
  let res = await attempt();
  if (res.ok || res.status === 204) return 'playing';
  // A start refused for want of a permission is not a scope Cruise FM asks
  // for on this call, so it can only mean the account or the plan — report it
  // the way the notice card already knows how to explain.
  if (res.status === 403) return startResult403(res);
  if (res.status !== 404) return 'error';

  // No active session — the phone's Spotify has dozed off (Android does
  // this within seconds of pausing). Find it and wake it by id.
  const devices = await getDevices();
  if (devices.length === 0) return 'no-device';
  const target =
    devices.find((d) => d.is_active) ??
    devices.find((d) => d.type === 'Smartphone') ??
    devices[0];

  res = await attempt(`?device_id=${encodeURIComponent(target.id)}`);
  if (res.ok || res.status === 204) return 'playing';
  if (res.status === 403) return startResult403(res);

  // Deep asleep — transfer playback onto the device with play=true, which
  // resumes where it left off and is the most reliable wake-up Spotify has.
  const transfer = await timedFetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ device_ids: [target.id], play: true }),
  });
  if (!(transfer.ok || transfer.status === 204)) {
    return transfer.status === 404 ? 'no-device' : 'error';
  }
  if (contextUri) {
    // Transfer resumed the old queue — nudge it onto the requested playlist
    // once the device has had a moment to come alive. Best-effort: the music
    // is already playing either way.
    await new Promise((r) => setTimeout(r, 700));
    await attempt(`?device_id=${encodeURIComponent(target.id)}`);
  }
  return 'playing';
}

export async function pause() {
  return spotifyFetch('/me/player/pause', 'PUT');
}

export async function seekTo(positionMs: number) {
  return spotifyFetch(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, 'PUT');
}

export async function setShuffle(state: boolean) {
  return spotifyFetch(`/me/player/shuffle?state=${state ? 'true' : 'false'}`, 'PUT');
}

export async function setRepeat(state: 'off' | 'context' | 'track') {
  return spotifyFetch(`/me/player/repeat?state=${state}`, 'PUT');
}

export async function skipNext() {
  return spotifyFetch('/me/player/next', 'POST');
}

export async function skipPrev() {
  return spotifyFetch('/me/player/previous', 'POST');
}

export async function getCurrentTrack() {
  return spotifyFetch('/me/player/currently-playing');
}

/** One row of a playlist, for the in-drive song list. */
export type PlaylistTrack = {
  uri: string;
  title: string;
  artist: string;
  durationMs: number;
};

export type PlaylistTracksResult =
  | { ok: true; tracks: PlaylistTrack[] }
  | { ok: false; reason: FailReason; detail?: string };

/** Spotify's own page size. Three of them is 300 songs, which is more than
 *  anyone thumbs through at the wheel and still covers a long playlist. */
const TRACK_PAGE = 100;
const MAX_PAGES = 3;

function readTracks(items: any[]): PlaylistTrack[] {
  return items
    .map((it) => it?.track)
    // Local files and podcast episodes come back without a playable uri —
    // neither can be started by the play call below, so they never list.
    .filter((t) => t?.uri && typeof t.uri === 'string' && t.uri.startsWith('spotify:track:'))
    .map((t) => ({
      uri: t.uri as string,
      title: (t.name as string) ?? '',
      artist: (t.artists ?? []).map((a: any) => a?.name).filter(Boolean).join(', '),
      durationMs: (t.duration_ms as number) ?? 0,
    }));
}

/**
 * The songs in a playlist, so a drive can jump straight to one instead of
 * skipping there or hopping out to Spotify (owner, 03.08).
 *
 * Returns a RESULT, not a list. The first cut returned a bare array and every
 * failure — offline, timed out, rate-limited, a playlist Spotify won't hand
 * over — arrived as `[]`, so the sheet told the owner her playlist had no
 * songs in it. A screen someone is reading has to be able to say which.
 *
 * `total` is asked for alongside the items precisely so the two can be told
 * apart from the other side too: total 0 is genuinely empty, while total > 0
 * with nothing readable means the projection or the page came back wrong, and
 * that retries without the projection rather than reporting an empty list.
 */
/**
 * Ask Spotify the same question four ways and report each answer verbatim.
 *
 * WHY THIS EXISTS: the owner hit a bare "Forbidden" on reading a playlist
 * while playback, the playlist picker and now-playing all worked. Two
 * diagnoses argued from plausibility were both wrong and both cost her a
 * pointless reconnect. This returns FACTS — which endpoints answer, which
 * refuse, and what permissions the connection actually holds.
 */
/**
 * The songs QUEUED UP in the player — a completely different thing from a
 * playlist's contents, and the reason it is worth trying.
 *
 * MEASURED on the owner's phone, 03.08, after everything else was ruled out:
 * `/playlists/{id}` answers 200 but hands back an EMPTY track list, and
 * `/playlists/{id}/tracks` answers 403, with every playlist permission
 * granted. Spotify will not give a development-tier app the contents of a
 * playlist by any route. The queue is player state rather than playlist
 * content, and it rides `user-read-playback-state`, which demonstrably works
 * here — so it can show what is coming up even when the playlist itself is
 * closed to us.
 *
 * Returns null when the queue is unavailable, so callers can tell "nothing
 * queued" from "couldn't ask".
 */
export async function getPlaybackQueue(): Promise<PlaylistTrack[] | null> {
  const res = await spotifyFetchDetailed('/me/player/queue');
  if (!res.ok) return null;
  const items: any[] = res.data?.queue ?? [];
  // The queue is a bare list of tracks, not playlist items wrapping a track.
  return readTracks(items.map((t) => ({ track: t })));
}

export async function diagnoseSpotify(playlistId: string | null): Promise<string[]> {
  const out: string[] = [];
  const token = await getAccessToken();
  if (!token) return ['No Spotify connection at all.'];

  const probe = async (label: string, path: string) => {
    try {
      const res = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
      let note = '';
      if (!res.ok) {
        const body = await res.text();
        try { note = ` — ${JSON.parse(body)?.error?.message ?? ''}`; } catch { note = ''; }
      }
      out.push(`${label}: ${res.status}${note}`);
    } catch {
      out.push(`${label}: no answer`);
    }
  };

  await probe('Your account', '/me');
  await probe('Your playlists', '/me/playlists?limit=1');
  if (playlistId) {
    await probe('This playlist', `/playlists/${playlistId}`);
    await probe('Its songs', `/playlists/${playlistId}/tracks?limit=1`);
    // The probes above only check the STATUS — reading nothing is exactly how
    // the first fallback looked fine here while failing in the app. This one
    // does the real read, the way the song list does it.
    const viaObj = await spotifyFetchDetailed(
      `/playlists/${playlistId}?fields=tracks(items(track(uri,name,duration_ms,artists(name))))`,
    );
    out.push(
      viaObj.ok
        ? `Songs via the playlist: ${readTracks(viaObj.data?.tracks?.items ?? []).length} found`
        : `Songs via the playlist: failed (${viaObj.reason})`,
    );
  }
  const q = await getPlaybackQueue();
  out.push(q ? `Songs in the queue: ${q.length} found` : 'Songs in the queue: unavailable');

  const scopes = await getGrantedScopes();
  out.push(
    scopes
      ? `Permissions granted: ${scopes.split(' ').join(', ')}`
      : 'Permissions granted: not recorded (reconnect once to record them)',
  );
  return out;
}

export async function getPlaylistTracks(playlistId: string): Promise<PlaylistTracksResult> {
  const tracks: PlaylistTrack[] = [];
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * TRACK_PAGE;
    const res = await spotifyFetchDetailed(
      `/playlists/${playlistId}/tracks?limit=${TRACK_PAGE}&offset=${offset}`
      + `&fields=total,items(track(uri,name,duration_ms,artists(name)))`,
    );
    // A refusal on the FIRST page is worth one more try without the field
    // projection, in case the projection itself is what is being refused.
    if (!res.ok && page === 0 && (res.reason === 'forbidden' || res.reason === 'error')) {
      const bare = await spotifyFetchDetailed(`/playlists/${playlistId}/tracks?limit=${TRACK_PAGE}`);
      if (bare.ok) return { ok: true, tracks: readTracks(bare.data?.items ?? []) };
      // THE ROUTE THAT WORKS. Measured on the owner's phone, 03.08:
      //   /playlists/{id}          → 200
      //   /playlists/{id}/tracks   → 403 Forbidden
      // Only the sub-endpoint is refused, and the playlist OBJECT carries its
      // own first page of tracks — so ask for those instead.
      //
      // THE `fields` PROJECTION IS LOAD-BEARING HERE, and leaving it off is
      // why the first attempt at this route still failed. A bare playlist
      // object expands every track's album and artists AND their
      // `available_markets` — ~180 country codes per track and per album — so
      // 100 songs arrive as megabytes, and reading that on a phone blew the
      // 12s budget. The projection asks for four fields per track and the
      // reply lands in kilobytes. (The diagnostic probe missed this because
      // it only reads the STATUS on success, never the body.)
      const obj = await spotifyFetchDetailed(
        `/playlists/${playlistId}?fields=tracks(items(track(uri,name,duration_ms,artists(name))))`,
      );
      if (obj.ok && Array.isArray(obj.data?.tracks?.items)) {
        const viaObject = readTracks(obj.data.tracks.items);
        if (viaObject.length) return { ok: true, tracks: viaObject };
      }
      return { ok: false, reason: bare.reason, detail: bare.detail ?? res.detail };
    }
    if (!res.ok) return page === 0 ? res : { ok: true, tracks }; // keep what we have
    const items: any[] = res.data?.items ?? [];
    total = res.data?.total ?? 0;

    if (page === 0 && items.length === 0 && total > 0) {
      // The playlist has songs but this projection returned none. Ask again
      // without `fields` — bigger payload, but no projection to disagree with.
      const plain = await spotifyFetchDetailed(`/playlists/${playlistId}/tracks?limit=${TRACK_PAGE}`);
      if (!plain.ok) return plain;
      return { ok: true, tracks: readTracks(plain.data?.items ?? []) };
    }

    tracks.push(...readTracks(items));
    if (items.length < TRACK_PAGE) break;
  }

  return { ok: true, tracks };
}

/**
 * Start a specific song WITHIN its playlist.
 *
 * The `offset` is what keeps the context: play the track on its own and
 * Spotify forgets the playlist, so the next/back buttons stop walking it and
 * the "playing from" pill empties. Reuses startPlayback's device-waking
 * sequence, because the phone's Spotify dozes off just as readily here.
 */
export async function playTrackInContext(contextUri: string, trackUri: string): Promise<StartResult> {
  return startPlayback(contextUri, { uri: trackUri });
}

export async function getUserPlaylists() {
  return spotifyFetch('/me/playlists?limit=50');
}

/**
 * CAN WE HAVE THE SONG'S BEAT MAP?
 *
 * A tester asked the question that matters — "are these visuals even following
 * the music?" — and the honest answer is no: the Circular EQ runs a hardcoded
 * ~100 BPM pattern and the Equalizer a timed loop. iOS lets no app hear
 * another app's audio, so the only way to make the visuals genuinely follow a
 * track is to ask the service what the track DOES: Spotify publishes a real
 * tempo, and a map of every beat, bar and section with timestamps. Combined
 * with the playback position we already poll, the bars could hit on the actual
 * snare of the actual song, and it would all ship over the air.
 *
 * The catch is that Spotify restricted these endpoints for apps registered
 * after November 2024, so ours may simply be refused — and there is no way to
 * know from here, because it depends on our app's registration date, not on
 * scopes or the account. Hence an instrument rather than an argument: run it
 * once on a real drive, read the statuses, and the question is settled.
 *
 * A 403 here means the route is closed and the fallback is a narrow, opt-in
 * microphone mode. A 200 means real beat-locked visuals are available.
 */
export async function probeBeatMap(): Promise<string[]> {
  const out: string[] = [];
  const token = await getAccessToken();
  if (!token) return ['No Spotify connection at all.'];

  const state = await spotifyFetch('/me/player');
  const id: string | undefined = state?.item?.id;
  const name: string | undefined = state?.item?.name;
  if (!id) return ['Nothing is playing — start a song and try again.'];
  out.push(`Track: ${name ?? id}`);

  const ask = async (label: string, path: string, describe?: (j: unknown) => string) => {
    try {
      const res = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        let note = '';
        try { note = ` — ${JSON.parse(await res.text())?.error?.message ?? ''}`; } catch { /* body not json */ }
        out.push(`${label}: ${res.status}${note}`);
        return;
      }
      const json: unknown = await res.json();
      out.push(`${label}: 200${describe ? ` — ${describe(json)}` : ''}`);
    } catch {
      out.push(`${label}: no answer`);
    }
  };

  await ask('Tempo & energy', `/audio-features/${id}`, (j) => {
    const f = j as { tempo?: number; time_signature?: number; energy?: number };
    return `${f.tempo ? Math.round(f.tempo) : '?'} BPM, ${f.time_signature ?? '?'}/4, energy ${f.energy?.toFixed(2) ?? '?'}`;
  });
  await ask('Beat map', `/audio-analysis/${id}`, (j) => {
    const a = j as { beats?: unknown[]; bars?: unknown[]; sections?: unknown[]; segments?: unknown[] };
    return `${a.beats?.length ?? 0} beats, ${a.bars?.length ?? 0} bars, `
      + `${a.sections?.length ?? 0} sections, ${a.segments?.length ?? 0} segments`;
  });

  return out;
}
