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
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRY_KEY]);
}

// ── Playback controls ────────────────────────────────────────────────────────

async function spotifyFetch(endpoint: string, method = 'GET', body?: object) {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

export async function getPlaybackState() {
  return spotifyFetch('/me/player');
}

export async function play(contextUri?: string) {
  return spotifyFetch('/me/player/play', 'PUT', contextUri ? { context_uri: contextUri } : undefined);
}

export type Device = { id: string; is_active: boolean; name: string; type: string };

export async function getDevices(): Promise<Device[]> {
  const data = await spotifyFetch('/me/player/devices');
  return data?.devices ?? [];
}

export type StartResult = 'playing' | 'no-device' | 'premium-required' | 'error';

/**
 * Best-effort "just start playing": finds an available Spotify device (the
 * user's phone app counts once it's been opened at least once), wakes it, and
 * resumes playback. Returns 'no-device' if Spotify isn't running anywhere —
 * the caller should then open the Spotify app so it becomes a device — and
 * 'premium-required' when Spotify refuses remote control (free accounts).
 */
export async function startPlayback(contextUri?: string): Promise<StartResult> {
  const token = await getAccessToken();
  if (!token) return 'error';

  const devices = await getDevices();
  if (devices.length === 0) return 'no-device';

  const target = devices.find((d) => d.is_active) ?? devices[0];
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(target.id)}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: contextUri ? JSON.stringify({ context_uri: contextUri }) : undefined,
    },
  );
  if (res.ok || res.status === 204) return 'playing';
  if (res.status === 403) return 'premium-required';
  if (res.status === 404) return 'no-device';
  return 'error';
}

export async function pause() {
  return spotifyFetch('/me/player/pause', 'PUT');
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

export async function getUserPlaylists() {
  return spotifyFetch('/me/playlists?limit=50');
}
