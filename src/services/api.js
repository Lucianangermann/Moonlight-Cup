// Thin fetch client for the Flask JSON API (server/blueprints/api.py + auth.py).
// Same-origin in production (served from the same Flask process as this
// build, see server/blueprints/webapp.py) — BASE_URL is only ever set for
// local dev against a separately-running Flask dev server on another port.
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function rawRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // On gym Wi-Fi a request can black-hole for minutes (AP roam, phone
    // sleep); without a timeout that freezes the whole poll loop. 8s turns
    // a hang into a normal retry on the next tick.
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  return res;
}

async function request(path, opts) {
  const res = await rawRequest(path, opts);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Reads
  getTournament: () => request('/api/tournament'),
  // Raw text variant: the store compares response bodies to skip re-renders
  // for unchanged data, so it wants the string, not a fresh object graph.
  getTournamentRaw: () => rawRequest('/api/tournament').then((r) => r.text()),
  getTimer: () => request('/api/timer'),
  getSession: () => request('/api/session'),
  getAnmeldungen: () => request('/api/anmeldungen'),

  // Auth
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),

  // Anmeldungen
  confirmAnmeldung: (id, { gender, league }) =>
    request(`/api/anmeldungen/${id}/confirm`, { method: 'POST', body: { gender, league } }),
  deleteAnmeldung: (id) => request(`/api/anmeldungen/${id}`, { method: 'DELETE' }),

  // Participants
  addParticipant: (data) => request('/api/participants', { method: 'POST', body: data }),
  updateParticipant: (pid, changes) => request(`/api/participants/${pid}`, { method: 'PATCH', body: changes }),
  removeParticipant: (pid) => request(`/api/participants/${pid}`, { method: 'DELETE' }),
  pauseParticipant: (pid) => request(`/api/participants/${pid}/pause`, { method: 'POST' }),
  resumeParticipant: (pid) => request(`/api/participants/${pid}/resume`, { method: 'POST' }),

  // Rounds
  startRound: () => request('/api/rounds', { method: 'POST' }),
  startFinalRunde: () => request('/api/rounds/final', { method: 'POST' }),
  advanceDurchgang: (roundId) => request(`/api/rounds/${roundId}/advance-durchgang`, { method: 'POST' }),
  deleteRound: (roundId) => request(`/api/rounds/${roundId}`, { method: 'DELETE' }),
  resetTournament: () => request('/api/tournament/reset', { method: 'POST' }),
  purgeAllParticipantData: () => request('/api/gdpr/purge', { method: 'POST' }),

  // Matches
  saveResult: (matchId, scoreA, scoreB) =>
    request(`/api/matches/${matchId}/result`, { method: 'POST', body: { scoreA, scoreB } }),
  swapMatchPlayers: (m1id, team1, idx1, m2id, team2, idx2) =>
    request('/api/matches/swap', {
      method: 'POST',
      body: { match1Id: m1id, team1, idx1, match2Id: m2id, team2, idx2 },
    }),

  // Standings
  setStatAdjustment: (pid, adj) => request(`/api/standings/${pid}/adjustment`, { method: 'POST', body: adj }),

  // Timer
  setTimer: (label, targetTimeIso, phase, totalSeconds) =>
    request('/api/timer', { method: 'POST', body: { label, targetTime: targetTimeIso, phase, totalSeconds } }),
  deactivateTimer: () => request('/api/timer/deactivate', { method: 'POST' }),
  deleteTimer: () => request('/api/timer', { method: 'DELETE' }),
};
