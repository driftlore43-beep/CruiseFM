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

    await saveTokens(data.access_token, data.refresh_token, data.expires_in);
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

    await saveTokens(data.access_token, data.refresh_token ?? refreshToken, data.expires_in);
    return data.access_token;
  } catch {
    return null;
  }
}

async function saveTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  const expiry = Date.now() + expiresIn * 1000;
  await AsyncStorage.multiSet([
    [TOKEN_KEY,         accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
    [EXPIRY_KEY,        String(expiry)],
  ]);
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
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRY_KEY, RESTRICTED_KEY]);
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

/** 403 body sniff: allowlist rejection vs. premium-required. */
async function classify403(res: Response): Promise<'restricted' | 'premium-required'> {
  try {
    const text = await res.text();
    if (/not registered/i.test(text)) {
      setRestricted(true);
      return 'restricted';
    }
  } catch {
    // fall through
  }
  return 'premium-required';
}


// ── Timed fetch — a drive must never stall on a sleepy network ───────────────
// Spotify calls sit between "user pressed play" and music/handoff; an
// unanswered request should give up fast so the fallback path can run.
const FETCH_TIMEOUT_MS = 4000;
function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
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
  if (res.status === 403) return classify403(res);
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
  if (res.status === 403) return classify403(res);

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

/**
 * The songs in a playlist, so a drive can jump straight to one instead of
 * skipping there or hopping out to Spotify (owner, 03.08).
 *
 * Capped at 100 — Spotify's own page size, and a list you thumb through at
 * the wheel has no business being longer. Local tracks and podcast episodes
 * come back with a null uri and are dropped: neither can be started with the
 * play call below.
 */
export async function getPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
  const data = await spotifyFetch(
    `/playlists/${playlistId}/tracks?limit=100&fields=items(track(uri,name,duration_ms,artists(name)))`,
  );
  const items: any[] = data?.items ?? [];
  return items
    .map((it) => it?.track)
    .filter((t) => t?.uri && !t.is_local)
    .map((t) => ({
      uri: t.uri as string,
      title: (t.name as string) ?? '',
      artist: (t.artists ?? []).map((a: any) => a?.name).filter(Boolean).join(', '),
      durationMs: (t.duration_ms as number) ?? 0,
    }));
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
