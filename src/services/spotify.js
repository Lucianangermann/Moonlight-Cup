// Spotify PKCE OAuth + Connect API
// Steuert Spotify (Handy/Desktop) ohne eigenen Player — einfach pausieren/starten.

const SCOPES = 'user-read-playback-state user-modify-playback-state';

// Feste Redirect URI — muss exakt so im Spotify Developer Dashboard eingetragen sein
const REDIRECT_URI = 'https://moonlightcup.lucianangermann.com';

const getRedirectUri = () => REDIRECT_URI;

export const getRedirectUriDisplay = () => REDIRECT_URI;

const generateRandom = (len) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => chars[b % chars.length])
    .join('');
};

const sha256 = async (plain) => {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
};

const base64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

// ── OAuth ────────────────────────────────────────────────────────────────────

export const initiateLogin = async (clientId) => {
  const verifier = generateRandom(128);
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem('sp_verifier', verifier);
  localStorage.setItem('sp_client_id', clientId);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
};

export const handleCallback = async () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  // URL sofort sauber machen
  window.history.replaceState({}, '', window.location.pathname);

  const verifier = localStorage.getItem('sp_verifier');
  const clientId = localStorage.getItem('sp_client_id');
  if (!verifier || !clientId) return false;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });

  const data = await res.json();
  if (!data.access_token) return false;

  localStorage.setItem('sp_token', data.access_token);
  localStorage.setItem('sp_refresh', data.refresh_token);
  localStorage.setItem('sp_expiry', Date.now() + data.expires_in * 1000);
  localStorage.removeItem('sp_verifier');
  return true;
};

const refreshToken = async () => {
  const refresh = localStorage.getItem('sp_refresh');
  const clientId = localStorage.getItem('sp_client_id');
  if (!refresh || !clientId) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: clientId,
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  localStorage.setItem('sp_token', data.access_token);
  localStorage.setItem('sp_expiry', Date.now() + data.expires_in * 1000);
  if (data.refresh_token) localStorage.setItem('sp_refresh', data.refresh_token);
  return data.access_token;
};

const getToken = async () => {
  const token = localStorage.getItem('sp_token');
  const expiry = Number(localStorage.getItem('sp_expiry') || 0);
  if (token && Date.now() < expiry - 60_000) return token;
  return refreshToken();
};

// ── Connect API ───────────────────────────────────────────────────────────────

const api = async (path, method = 'PUT', body = null) => {
  const token = await getToken();
  if (!token) return;
  try {
    await fetch(`https://api.spotify.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (_) {}
};

export const spotifyPlay  = () => api('/me/player/play');
export const spotifyPause = () => api('/me/player/pause');

// ── Verbindungsstatus ─────────────────────────────────────────────────────────

export const isConnected = () => !!localStorage.getItem('sp_token');

export const getClientId = () => localStorage.getItem('sp_client_id') || '';

export const disconnect = () => {
  ['sp_token', 'sp_refresh', 'sp_expiry', 'sp_verifier', 'sp_client_id'].forEach(
    (k) => localStorage.removeItem(k)
  );
};
