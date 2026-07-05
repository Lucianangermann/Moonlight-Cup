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

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Reads
  getTournament: () => request('/api/tournament'),
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

  // Matches
  saveResult: (matchId, scoreA, scoreB) =>
    request(`/api/matches/${matchId}/result`, { method: 'POST', body: { scoreA, scoreB } }),
  clearResult: (matchId) => request(`/api/matches/${matchId}/result`, { method: 'DELETE' }),
  swapMatchPlayers: (m1id, team1, idx1, m2id, team2, idx2) =>
    request('/api/matches/swap', {
      method: 'POST',
      body: { match1Id: m1id, team1, idx1, match2Id: m2id, team2, idx2 },
    }),

  // Standings
  setStatAdjustment: (pid, adj) => request(`/api/standings/${pid}/adjustment`, { method: 'POST', body: adj }),

  // Timer
  setTimer: (label, targetTimeIso) => request('/api/timer', { method: 'POST', body: { label, targetTime: targetTimeIso } }),
  deactivateTimer: () => request('/api/timer/deactivate', { method: 'POST' }),
  deleteTimer: () => request('/api/timer', { method: 'DELETE' }),
};
