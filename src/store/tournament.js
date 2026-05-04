import { useState, createContext, useContext } from 'react';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Müller, Max' },
    { id: '2', name: 'Lang, Lisa' },
    { id: '3', name: 'Wolf, Tom' },
    { id: '4', name: 'Bauer, Anna' },
    { id: '5', name: 'Koch, Ben' },
    { id: '6', name: 'Berg, Sara' },
  ]);

  const [rounds, setRounds] = useState([
    {
      id: 1,
      matches: [
        { id: 'm1', playerA: '1', playerB: '5', scoreA: 21, scoreB: 18, done: true },
        { id: 'm2', playerA: '4', playerB: '2', scoreA: 15, scoreB: 21, done: true },
        { id: 'm3', playerA: '3', playerB: '6', scoreA: 21, scoreB: 11, done: true },
      ],
    },
  ]);

  const [currentRound, setCurrentRound] = useState(1);

  const addParticipant = (name) => {
    const id = Date.now().toString();
    setParticipants((prev) => [...prev, { id, name }]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const saveResult = (matchId, scoreA, scoreB) => {
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        matches: r.matches.map((m) =>
          m.id === matchId ? { ...m, scoreA, scoreB, done: true } : m
        ),
      }))
    );
  };

  const startNewRound = () => {
    const ids = participants.map((p) => p.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const matches = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      matches.push({
        id: `r${rounds.length + 1}m${i}`,
        playerA: shuffled[i],
        playerB: shuffled[i + 1],
        scoreA: null,
        scoreB: null,
        done: false,
      });
    }
    const newRound = { id: rounds.length + 1, matches };
    setRounds((prev) => [...prev, newRound]);
    setCurrentRound(rounds.length + 1);
  };

  const getStandings = () => {
    const stats = {};
    participants.forEach((p) => {
      stats[p.id] = { id: p.id, name: p.name, points: 0, wins: 0, games: 0, diff: 0 };
    });
    rounds.forEach((r) =>
      r.matches.forEach((m) => {
        if (!m.done) return;
        stats[m.playerA].games++;
        stats[m.playerB].games++;
        stats[m.playerA].diff += (m.scoreA - m.scoreB);
        stats[m.playerB].diff += (m.scoreB - m.scoreA);
        if (m.scoreA > m.scoreB) {
          stats[m.playerA].wins++;
          stats[m.playerA].points += 2;
        } else {
          stats[m.playerB].wins++;
          stats[m.playerB].points += 2;
        }
      })
    );
    return Object.values(stats).sort((a, b) => b.points - a.points || b.diff - a.diff);
  };

  const getCurrentRoundData = () => rounds.find((r) => r.id === currentRound);

  const allMatchesDone = () => {
    const r = getCurrentRoundData();
    return r ? r.matches.every((m) => m.done) : true;
  };

  return (
    <TournamentContext.Provider
      value={{
        participants, addParticipant, removeParticipant,
        rounds, currentRound, saveResult, startNewRound,
        getStandings, getCurrentRoundData, allMatchesDone,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);
