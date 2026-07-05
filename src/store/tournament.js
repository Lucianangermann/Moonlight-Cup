import { createContext, useContext, useState } from 'react';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';

const TournamentContext = createContext(null);

export const LEAGUES = [
  { key: 'FZ',  label: 'Freizeitspieler' },
  { key: 'BK',  label: 'Bezirksklasse' },
  { key: 'BL',  label: 'Bezirksliga' },
  { key: 'BOL', label: 'Bezirksoberliga' },
  { key: 'BAY', label: 'Bayernliga' },
  { key: 'OL',  label: 'Oberliga' },
  { key: 'RL',  label: 'Regionalliga' },
  { key: 'BU',  label: 'Bundesliga' },
];

const EMPTY_SNAPSHOT = {
  participants: [], pausedParticipants: [], rounds: [], currentRound: null,
  standings: [], statAdjustments: {},
};

export function TournamentProvider({ children }) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);

  // Local-only UI signals for the CURRENT device's TimerScreen (vibration /
  // Spotify playback only make sense per-device, not synced). TimerScreen
  // additionally broadcasts the shared countdown to the server itself so
  // every other viewer sees the same live timer — see src/screens/TimerScreen.js.
  const [autoTimerTrigger, setAutoTimerTrigger] = useState(null);
  const triggerAutoTimer = (durchgang, isFirstRound = false) =>
    setAutoTimerTrigger({ durchgang, isFirstRound, at: Date.now() });
  const [timerResetTrigger, setTimerResetTrigger] = useState(null);

  const refresh = async () => {
    const data = await api.getTournament();
    setSnapshot(data);
  };

  usePolling(refresh, 5000);

  const { participants, pausedParticipants, rounds, currentRound, statAdjustments } = snapshot;

  // --- Reads (server already computes these — no client-side algorithm) ---
  const getStandings = () => snapshot.standings;
  const getCurrentRoundData = () => rounds.find((r) => r.id === currentRound);
  const allMatchesDone = () => {
    const r = getCurrentRoundData();
    return !r || r.matches.every((m) => m.done);
  };
  const currentDurchgangDone = () => {
    const r = getCurrentRoundData();
    if (!r) return false;
    const dm = r.matches.filter((m) => m.durchgang === r.currentDurchgang);
    return dm.length > 0 && dm.every((m) => m.done);
  };

  // --- Mutations — the API 401s for non-admins; screens additionally hide
  // the affordances to reach these in the first place (see App.js tab
  // gating and the isAdmin checks inside Ergebnisse/Rangliste/Timer). Each
  // refetches once immediately so the admin's own device reflects the
  // change instantly instead of waiting for the next 5s poll tick.
  const addParticipant = async (name, gender, league) => {
    await api.addParticipant({ name, gender, league });
    await refresh();
  };

  const removeParticipant = async (id) => {
    await api.removeParticipant(id);
    await refresh();
  };

  const updateParticipant = async (id, changes) => {
    await api.updateParticipant(id, changes);
    await refresh();
  };

  const pauseParticipant = async (id) => {
    await api.pauseParticipant(id);
    await refresh();
  };

  const resumeParticipant = async (id) => {
    await api.resumeParticipant(id);
    await refresh();
  };

  const setStatAdjustment = async (id, adj) => {
    await api.setStatAdjustment(id, adj);
    await refresh();
  };

  const saveResult = async (matchId, scoreA, scoreB) => {
    await api.saveResult(matchId, scoreA, scoreB);
    await refresh();
  };

  const startNewRound = async () => {
    await api.startRound();
    await refresh();
  };

  const startFinalRunde = async () => {
    await api.startFinalRunde();
    await refresh();
  };

  const advanceDurchgang = async () => {
    const cur = getCurrentRoundData();
    if (!cur) return;
    await api.advanceDurchgang(cur.id);
    await refresh();
  };

  const deleteCurrentRound = async () => {
    if (currentRound == null) return;
    await api.deleteRound(currentRound);
    await refresh();
  };

  const deleteRound = async (roundId) => {
    await api.deleteRound(roundId);
    await refresh();
  };

  const swapMatchPlayers = async (m1id, team1, idx1, m2id, team2, idx2) => {
    await api.swapMatchPlayers(m1id, team1, idx1, m2id, team2, idx2);
    await refresh();
  };

  const resetTournament = async () => {
    await api.resetTournament();
    await api.deleteTimer().catch(() => {}); // best-effort — shared timer isn't tournament-critical
    setTimerResetTrigger(Date.now());
    await refresh();
  };

  return (
    <TournamentContext.Provider
      value={{
        participants, pausedParticipants,
        addParticipant, removeParticipant, updateParticipant,
        pauseParticipant, resumeParticipant,
        statAdjustments, setStatAdjustment,
        autoTimerTrigger, triggerAutoTimer, timerResetTrigger,
        rounds, currentRound, saveResult, startNewRound, startFinalRunde,
        getStandings, getCurrentRoundData, allMatchesDone,
        advanceDurchgang, currentDurchgangDone,
        deleteCurrentRound, deleteRound, swapMatchPlayers, resetTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);
