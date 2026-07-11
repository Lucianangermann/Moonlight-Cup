import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { usePolling } from '../hooks/usePolling';

const TournamentContext = createContext(null);

// Mirrors LEAGUES in server/tournament_logic.py — keep the two in sync.
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

// Optimistic score entry: reflect the result on the match instantly, before
// the server confirms. Standings aren't recomputed here (that's the server's
// job) — they update ~200ms later when the mutation response's authoritative
// state arrives. Higher score wins; equal = no winner (badminton has none,
// but stay safe). Pure — returns a new snapshot.
function applyOptimisticResult(snap, matchId, scoreA, scoreB) {
  const winnerTeam = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
  return {
    ...snap,
    rounds: snap.rounds.map((r) => ({
      ...r,
      matches: r.matches.map((m) =>
        m.id === matchId ? { ...m, scoreA, scoreB, done: true, winnerTeam } : m
      ),
    })),
  };
}

export function TournamentProvider({ children }) {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  // loaded flips once after the first successful poll (before that the app
  // must show a loading state, not a fake-empty tournament). online +
  // staleSince feed the honest LIVE/Stand-HH:MM indicator.
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(true);
  const [staleSince, setStaleSince] = useState(null);

  // Perf: the vast majority of the ~4,300 polls per phone per evening return
  // byte-identical data. Comparing the raw response text and skipping the
  // state update (plus keeping lastSync in a ref, not state) means an
  // unchanged poll triggers ZERO re-renders of the mounted screens.
  const lastTextRef = useRef(null);
  const lastSyncRef = useRef(null);

  // Local-only UI signals for the CURRENT device's TimerScreen (vibration /
  // Spotify playback only make sense per-device, not synced). TimerScreen
  // additionally broadcasts the shared countdown to the server itself so
  // every other viewer sees the same live timer — see src/screens/TimerScreen.js.
  const [autoTimerTrigger, setAutoTimerTrigger] = useState(null);
  const triggerAutoTimer = useCallback((durchgang, isFirstRound = false) =>
    setAutoTimerTrigger({ durchgang, isFirstRound, at: Date.now() }), []);
  const [timerResetTrigger, setTimerResetTrigger] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const text = await api.getTournamentRaw();
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        setSnapshot(JSON.parse(text));
      }
      lastSyncRef.current = Date.now();
      setOnline(true);       // no-op re-render when already true
      setStaleSince(null);
      setLoaded(true);
    } catch (e) {
      setOnline(false);
      setStaleSince((prev) => prev ?? lastSyncRef.current);
      throw e; // usePolling swallows it; rethrow so manual callers can react
    }
  }, []);

  usePolling(refresh, 5000);

  // Downgrade "online" if polls stop succeeding (e.g. a request hangs or the
  // device slept through ticks) — the catch above only fires on hard errors.
  useEffect(() => {
    const id = setInterval(() => {
      if (lastSyncRef.current && Date.now() - lastSyncRef.current >= 15000) {
        setOnline(false);
        setStaleSince((prev) => prev ?? lastSyncRef.current);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(() => {
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

    // Apply the state a mutation returns (under "tournament") directly — no
    // second GET. Returns true when it did; false when the response carried
    // no state (caller then falls back to a refresh()).
    const applyReturnedState = (res) => {
      if (res && res.tournament) {
        lastTextRef.current = null;       // let the next poll re-baseline dedup
        lastSyncRef.current = Date.now();
        setSnapshot(res.tournament);
        return true;
      }
      return false;
    };

    // --- Mutations — the API 401s for non-admins; screens additionally hide
    // the affordances to reach these. The mutation response carries the fresh
    // state, so the admin's device reflects the change in one round-trip
    // instead of mutate-then-GET.
    const withRefresh = (fn) => async (...args) => {
      const res = await fn(...args);
      if (!applyReturnedState(res)) await refresh();
    };

    return {
      loaded, online, staleSince,
      participants, pausedParticipants,
      addParticipant: withRefresh((name, gender, league) => api.addParticipant({ name, gender, league })),
      removeParticipant: withRefresh((id) => api.removeParticipant(id)),
      updateParticipant: withRefresh((id, changes) => api.updateParticipant(id, changes)),
      pauseParticipant: withRefresh((id) => api.pauseParticipant(id)),
      resumeParticipant: withRefresh((id) => api.resumeParticipant(id)),
      statAdjustments,
      setStatAdjustment: withRefresh((id, adj) => api.setStatAdjustment(id, adj)),
      autoTimerTrigger, triggerAutoTimer, timerResetTrigger,
      rounds, currentRound,
      // Optimistic: show the score the instant it's entered, then reconcile
      // with the server's authoritative state (which also recomputes
      // standings). On failure, refetch to snap back to the truth.
      saveResult: async (matchId, scoreA, scoreB) => {
        // Keep lastTextRef as-is: an in-flight 5s poll that returns the
        // still-unchanged server text is then deduped away, so it can't
        // clobber the optimistic view before our own response lands.
        setSnapshot((snap) => applyOptimisticResult(snap, matchId, scoreA, scoreB));
        try {
          const res = await api.saveResult(matchId, scoreA, scoreB);
          if (!applyReturnedState(res)) await refresh();
        } catch (e) {
          // Force a re-apply of server truth so the optimistic update reverts
          // even if the response text matches the pre-optimistic baseline.
          lastTextRef.current = null;
          await refresh().catch(() => {});
          throw e;
        }
      },
      startNewRound: withRefresh(() => api.startRound()),
      startFinalRunde: withRefresh(() => api.startFinalRunde()),
      getStandings, getCurrentRoundData, allMatchesDone,
      advanceDurchgang: withRefresh(() => {
        const cur = getCurrentRoundData();
        return cur ? api.advanceDurchgang(cur.id) : Promise.resolve();
      }),
      currentDurchgangDone,
      deleteCurrentRound: withRefresh(() =>
        currentRound == null ? Promise.resolve() : api.deleteRound(currentRound)),
      deleteRound: withRefresh((roundId) => api.deleteRound(roundId)),
      swapMatchPlayers: withRefresh((m1id, team1, idx1, m2id, team2, idx2) =>
        api.swapMatchPlayers(m1id, team1, idx1, m2id, team2, idx2)),
      resetTournament: withRefresh(async () => {
        await api.resetTournament();
        await api.deleteTimer().catch(() => {}); // best-effort — shared timer isn't tournament-critical
        setTimerResetTrigger(Date.now());
      }),
      // Post-season deletion of all participant/registration PII (name,
      // e-mail, age, verein, meal preferences) — distinct from
      // resetTournament, which keeps the roster. See db_state.py.
      purgeAllParticipantData: withRefresh(async () => {
        await api.purgeAllParticipantData();
        setTimerResetTrigger(Date.now());
      }),
    };
  }, [snapshot, loaded, online, staleSince, autoTimerTrigger, timerResetTrigger, refresh, triggerAutoTimer]);

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);
