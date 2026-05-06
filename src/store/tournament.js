import { useState, createContext, useContext } from 'react';

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
    { id: '1',  name: 'Müller, Max',    gender: 'M', league: 'FZ'  },
    { id: '2',  name: 'Lang, Lisa',     gender: 'F', league: 'BK'  },
    { id: '3',  name: 'Wolf, Tom',      gender: 'M', league: 'BL'  },
    { id: '4',  name: 'Bauer, Anna',    gender: 'F', league: 'BL'  },
    { id: '5',  name: 'Koch, Ben',      gender: 'M', league: 'BOL' },
    { id: '6',  name: 'Berg, Sara',     gender: 'F', league: 'BOL' },
    { id: '7',  name: 'Huber, Felix',   gender: 'M', league: 'BAY' },
    { id: '8',  name: 'Klein, Mia',     gender: 'F', league: 'BAY' },
    { id: '9',  name: 'Fischer, Jonas', gender: 'M', league: 'OL'  },
    { id: '10', name: 'Braun, Laura',   gender: 'F', league: 'OL'  },
    { id: '11', name: 'Richter, Lukas', gender: 'M', league: 'RL'  },
    { id: '12', name: 'Hoffmann, Eva',  gender: 'F', league: 'RL'  },
    { id: '13', name: 'Schäfer, Nico',  gender: 'M', league: 'BU'  },
    { id: '14', name: 'Krause, Julia',  gender: 'F', league: 'BU'  },
    { id: '15', name: 'Weber, Finn',    gender: 'M', league: 'FZ'  },
    { id: '16', name: 'Schulz, Lena',   gender: 'F', league: 'BK'  },
  ]);

  // Match structure: { id, teamA: [id, id], teamB: [id, id], type: 'MM'|'FF'|'MF', scoreA, scoreB, done }
  // Round: { id, matches, sittingOut: [id, ...] }
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);

  const addParticipant = (name, gender, league = 'FZ') => {
    const id = Date.now().toString();
    setParticipants((prev) => [...prev, { id, name, gender, league }]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const saveResult = (matchId, scoreA, scoreB) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (!r.matches.some((m) => m.id === matchId)) return r;
        const winnerTeam = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : null;
        let effA = scoreA;
        let effB = scoreB;
        if (r.isSchnellrunde && Math.max(scoreA, scoreB) >= 16) {
          if (scoreA > scoreB) effB = Math.max(16, scoreB);
          else if (scoreB > scoreA) effA = Math.max(16, scoreA);
        }
        return {
          ...r,
          matches: r.matches.map((m) =>
            m.id === matchId ? { ...m, scoreA: effA, scoreB: effB, winnerTeam, done: true } : m
          ),
        };
      })
    );
  };

  const LEAGUE_RANK = { FZ: 0, BK: 1, BL: 2, BOL: 3, BAY: 4, OL: 5, RL: 6, BU: 7 };

  const startNewRound = () => {
    const roundId = rounds.length + 1;
    const isSchnellrunde = roundId <= 3;
    const matches = [];
    let idx = 0;
    let sittingOut = [];

    const makeMatch = (teamA, teamB, type) => ({
      id: `r${roundId}m${idx++}`,
      teamA, teamB, type,
      scoreA: null, scoreB: null, done: false,
    });

    if (isSchnellrunde) {
      // ── Schnellrunden: vollständig zufällig, dann ligabasiert ausbalancieren ──
      const pMap = Object.fromEntries(participants.map((p) => [p.id, p]));
      const str = (id) => LEAGUE_RANK[pMap[id]?.league ?? 'FZ'] ?? 0;

      const balanceMatch = (match) => {
        if (match.type === 'MF') {
          const [m1, w1] = match.teamA;
          const [m2, w2] = match.teamB;
          const d1 = Math.abs((str(m1) + str(w1)) - (str(m2) + str(w2)));
          const d2 = Math.abs((str(m1) + str(w2)) - (str(m2) + str(w1)));
          return d2 < d1 ? { ...match, teamA: [m1, w2], teamB: [m2, w1] } : match;
        }
        const [p1, p2, p3, p4] = [...match.teamA, ...match.teamB];
        const opts = [[[p1,p2],[p3,p4]], [[p1,p3],[p2,p4]], [[p1,p4],[p2,p3]]];
        const best = opts.reduce((acc, [a, b]) => {
          const d = Math.abs((str(a[0]) + str(a[1])) - (str(b[0]) + str(b[1])));
          return d < acc.d ? { a, b, d } : acc;
        }, { a: opts[0][0], b: opts[0][1], d: Infinity });
        return { ...match, teamA: best.a, teamB: best.b };
      };

      const men   = shuffle(participants.filter((p) => p.gender === 'M').map((p) => p.id));
      const women = shuffle(participants.filter((p) => p.gender === 'F').map((p) => p.id));

      while (men.length >= 4) {
        matches.push(balanceMatch(makeMatch([men.pop(), men.pop()], [men.pop(), men.pop()], 'MM')));
      }
      while (women.length >= 4) {
        matches.push(balanceMatch(makeMatch([women.pop(), women.pop()], [women.pop(), women.pop()], 'FF')));
      }
      while (men.length >= 2 && women.length >= 2) {
        matches.push(balanceMatch(makeMatch([men.pop(), women.pop()], [men.pop(), women.pop()], 'MF')));
      }
      sittingOut = [...men, ...women];

    } else {
      // ── Normale Runden: Schlangenauslosung nach Gesamtrangliste ──
      // Rangliste über alle Spieler (unabhängig vom Geschlecht)
      const pMap = Object.fromEntries(participants.map((p) => [p.id, p]));
      const genderOf = (id) => pMap[id]?.gender ?? 'M';

      const stats = {};
      participants.forEach((p) => { stats[p.id] = { id: p.id, points: 0, diff: 0 }; });
      rounds.forEach((r) => r.matches.forEach((m) => {
        if (!m.done) return;
        m.teamA.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreA - m.scoreB); });
        m.teamB.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreB - m.scoreA); });
        const winners = m.winnerTeam === 'A' ? m.teamA : m.winnerTeam === 'B' ? m.teamB : [];
        winners.forEach((id) => { if (stats[id]) stats[id].points += 2; });
      }));

      // Gesamtrangliste: Platz 1 bis N, gemischt
      const ranked = Object.values(stats)
        .sort((a, b) => b.points - a.points || b.diff - a.diff)
        .map((p) => p.id);

      // Spieltyp aus den tatsächlichen Geschlechtern der 4 Spieler
      const matchType = (tA, tB) => {
        const men = [...tA, ...tB].filter((id) => genderOf(id) === 'M').length;
        return men === 4 ? 'MM' : men === 0 ? 'FF' : 'MF';
      };

      // Einzige ungültige Konstellation: ein Team ausschließlich Damen,
      // das andere ausschließlich Herren → letzten Spieler beider Teams tauschen
      const fixConflict = (tA, tB) => {
        const aF = tA.every((id) => genderOf(id) === 'F');
        const bM = tB.every((id) => genderOf(id) === 'M');
        const aM = tA.every((id) => genderOf(id) === 'M');
        const bF = tB.every((id) => genderOf(id) === 'F');
        if ((aF && bM) || (aM && bF)) {
          return [[tA[0], tB[1]], [tB[0], tA[1]]];
        }
        return [tA, tB];
      };

      const pool = [...ranked];

      // Gruppen von 8: Platz 1+8 vs 2+7, Platz 3+6 vs 4+5
      while (pool.length >= 8) {
        const g = pool.splice(0, 8);
        const [a1, b1] = fixConflict([g[0], g[7]], [g[1], g[6]]);
        matches.push(makeMatch(a1, b1, matchType(a1, b1)));
        const [a2, b2] = fixConflict([g[2], g[5]], [g[3], g[4]]);
        matches.push(makeMatch(a2, b2, matchType(a2, b2)));
      }
      // Restgruppe von 4: Platz 1+4 vs 2+3
      if (pool.length >= 4) {
        const g = pool.splice(0, 4);
        const [a, b] = fixConflict([g[0], g[3]], [g[1], g[2]]);
        matches.push(makeMatch(a, b, matchType(a, b)));
      }
      sittingOut = [...pool];
    }

    setRounds((prev) => [...prev, { id: roundId, matches, sittingOut, isSchnellrunde }]);
    setCurrentRound(roundId);
  };

  const getStandings = () => {
    const stats = {};
    participants.forEach((p) => {
      stats[p.id] = { id: p.id, name: p.name, gender: p.gender, league: p.league ?? 'FZ', points: 0, wins: 0, games: 0, diff: 0 };
    });
    rounds.forEach((r) =>
      r.matches.forEach((m) => {
        if (!m.done) return;
        [...m.teamA, ...m.teamB].forEach((id) => {
          if (stats[id]) stats[id].games++;
        });
        m.teamA.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreA - m.scoreB); });
        m.teamB.forEach((id) => { if (stats[id]) stats[id].diff += (m.scoreB - m.scoreA); });
        const winners = m.winnerTeam === 'A' ? m.teamA : m.winnerTeam === 'B' ? m.teamB : [];
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
