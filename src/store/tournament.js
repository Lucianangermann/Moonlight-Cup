import { useState, createContext, useContext } from 'react';

const TournamentContext = createContext(null);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function TournamentProvider({ children }) {
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Müller, Max',  gender: 'M' },
    { id: '2', name: 'Lang, Lisa',   gender: 'F' },
    { id: '3', name: 'Wolf, Tom',    gender: 'M' },
    { id: '4', name: 'Bauer, Anna',  gender: 'F' },
    { id: '5', name: 'Koch, Ben',    gender: 'M' },
    { id: '6', name: 'Berg, Sara',   gender: 'F' },
    { id: '7', name: 'Huber, Felix', gender: 'M' },
    { id: '8', name: 'Klein, Mia',   gender: 'F' },
  ]);

  // Match structure: { id, teamA: [id, id], teamB: [id, id], type: 'MM'|'FF'|'MF', scoreA, scoreB, done }
  // Round: { id, matches, sittingOut: [id, ...] }
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);

  const addParticipant = (name, gender) => {
    const id = Date.now().toString();
    setParticipants((prev) => [...prev, { id, name, gender }]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const saveResult = (matchId, scoreA, scoreB) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (!r.matches.some((m) => m.id === matchId)) return r;
        let effA = scoreA;
        let effB = scoreB;
        if (r.isSchnellrunde) {
          if (scoreA > scoreB) effB = Math.max(16, scoreB);
          else if (scoreB > scoreA) effA = Math.max(16, scoreA);
        }
        return {
          ...r,
          matches: r.matches.map((m) =>
            m.id === matchId ? { ...m, scoreA: effA, scoreB: effB, done: true } : m
          ),
        };
      })
    );
  };

  const startNewRound = () => {
    const men   = shuffle(participants.filter((p) => p.gender === 'M').map((p) => p.id));
    const women = shuffle(participants.filter((p) => p.gender === 'F').map((p) => p.id));

    const matches = [];
    const roundId = rounds.length + 1;
    let idx = 0;

    const makeMatch = (teamA, teamB, type) => ({
      id: `r${roundId}m${idx++}`,
      teamA, teamB, type,
      scoreA: null, scoreB: null, done: false,
    });

    // Men's doubles: 4 men per match
    while (men.length >= 4) {
      matches.push(makeMatch(
        [men.pop(), men.pop()],
        [men.pop(), men.pop()],
        'MM'
      ));
    }

    // Women's doubles: 4 women per match
    while (women.length >= 4) {
      matches.push(makeMatch(
        [women.pop(), women.pop()],
        [women.pop(), women.pop()],
        'FF'
      ));
    }

    // Mixed doubles: 2 men + 2 women per match (1M+1F vs 1M+1F)
    while (men.length >= 2 && women.length >= 2) {
      matches.push(makeMatch(
        [men.pop(), women.pop()],
        [men.pop(), women.pop()],
        'MF'
      ));
    }

    const sittingOut = [...men, ...women];

    const newRound = { id: roundId, matches, sittingOut, isSchnellrunde: roundId <= 3 };
    setRounds((prev) => [...prev, newRound]);
    setCurrentRound(roundId);
  };

  const getStandings = () => {
    const stats = {};
    participants.forEach((p) => {
      stats[p.id] = { id: p.id, name: p.name, gender: p.gender, points: 0, wins: 0, games: 0, diff: 0 };
    });
    rounds.forEach((r) =>
      r.matches.forEach((m) => {
        if (!m.done) return;
        [...m.teamA, ...m.teamB].forEach((id) => {
          if (stats[id]) stats[id].games++;
        });
        m.teamA.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreA - m.scoreB); });
        m.teamB.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreB - m.scoreA); });
        const winners = m.scoreA > m.scoreB ? m.teamA : m.teamB;
        winners.forEach((id) => {
          if (stats[id]) { stats[id].wins++; stats[id].points += 2; }
        });
      })
    );
    return Object.values(stats).sort((a, b) => b.points - a.points || b.diff - a.diff);
  };

  const getCurrentRoundData = () => rounds.find((r) => r.id === currentRound);

  const allMatchesDone = () => {
    const r = getCurrentRoundData();
    if (!r) return true;
    return r.matches.every((m) => m.done);
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
