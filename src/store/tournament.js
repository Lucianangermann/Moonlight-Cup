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
  const [pausedParticipants, setPausedParticipants] = useState([]);
  // { [id]: { games: number, wins: number, diff: number } } — additive adjustments on top of computed stats
  const [statAdjustments, setStatAdjustments] = useState({});
  // { durchgang: 1|2, at: number } — signal for TimerScreen to auto-start
  const [autoTimerTrigger, setAutoTimerTrigger] = useState(null);
  const triggerAutoTimer = (durchgang) => setAutoTimerTrigger({ durchgang, at: Date.now() });

  const [participants, setParticipants] = useState([
    { id: '1',  name: 'Müller, Max',          gender: 'M', league: 'FZ'  },
    { id: '2',  name: 'Lang, Lisa',           gender: 'F', league: 'BK'  },
    { id: '3',  name: 'Wolf, Tom',            gender: 'M', league: 'BL'  },
    { id: '4',  name: 'Bauer, Anna',          gender: 'F', league: 'BL'  },
    { id: '5',  name: 'Koch, Ben',            gender: 'M', league: 'BOL' },
    { id: '6',  name: 'Berg, Sara',           gender: 'F', league: 'BOL' },
    { id: '7',  name: 'Huber, Felix',         gender: 'M', league: 'BAY' },
    { id: '8',  name: 'Klein, Mia',           gender: 'F', league: 'BAY' },
    { id: '9',  name: 'Fischer, Jonas',       gender: 'M', league: 'OL'  },
    { id: '10', name: 'Braun, Laura',         gender: 'F', league: 'OL'  },
    { id: '11', name: 'Richter, Lukas',       gender: 'M', league: 'RL'  },
    { id: '12', name: 'Hoffmann, Eva',        gender: 'F', league: 'RL'  },
    { id: '13', name: 'Schäfer, Nico',        gender: 'M', league: 'BU'  },
    { id: '14', name: 'Krause, Julia',        gender: 'F', league: 'BU'  },
    { id: '15', name: 'Weber, Finn',          gender: 'M', league: 'FZ'  },
    { id: '16', name: 'Schulz, Lena',         gender: 'F', league: 'BK'  },
    { id: '17', name: 'Schmidt, Jan',         gender: 'M', league: 'BK'  },
    { id: '18', name: 'Meier, Sophie',        gender: 'F', league: 'FZ'  },
    { id: '19', name: 'Wagner, Erik',         gender: 'M', league: 'BL'  },
    { id: '20', name: 'Becker, Marie',        gender: 'F', league: 'BK'  },
    { id: '21', name: 'Vogel, Paul',          gender: 'M', league: 'BOL' },
    { id: '22', name: 'Zimmermann, Emma',     gender: 'F', league: 'BL'  },
    { id: '23', name: 'Hartmann, Leon',       gender: 'M', league: 'FZ'  },
    { id: '24', name: 'Graf, Lea',            gender: 'F', league: 'BOL' },
    { id: '25', name: 'Roth, Moritz',         gender: 'M', league: 'BK'  },
    { id: '26', name: 'Keller, Hannah',       gender: 'F', league: 'BL'  },
    { id: '27', name: 'König, Simon',         gender: 'M', league: 'BL'  },
    { id: '28', name: 'Schwarz, Johanna',     gender: 'F', league: 'BAY' },
    { id: '29', name: 'Brandt, Klaus',        gender: 'M', league: 'BAY' },
    { id: '30', name: 'Fuchs, Maja',          gender: 'F', league: 'FZ'  },
    { id: '31', name: 'Werner, Hans',         gender: 'M', league: 'BK'  },
    { id: '32', name: 'Neumann, Nina',        gender: 'F', league: 'OL'  },
    { id: '33', name: 'Lange, Peter',         gender: 'M', league: 'BOL' },
    { id: '34', name: 'Peters, Sandra',       gender: 'F', league: 'BL'  },
    { id: '35', name: 'Winkler, Michael',     gender: 'M', league: 'BK'  },
    { id: '36', name: 'Haas, Claudia',        gender: 'F', league: 'BAY' },
    { id: '37', name: 'Gruber, Stefan',       gender: 'M', league: 'OL'  },
    { id: '38', name: 'Sommer, Monika',       gender: 'F', league: 'BL'  },
    { id: '39', name: 'Baumann, Thomas',      gender: 'M', league: 'BL'  },
    { id: '40', name: 'Lehmann, Petra',       gender: 'F', league: 'FZ'  },
    { id: '41', name: 'Kramer, Andreas',      gender: 'M', league: 'BK'  },
    { id: '42', name: 'Stein, Sabine',        gender: 'F', league: 'BOL' },
    { id: '43', name: 'Maier, Martin',        gender: 'M', league: 'BAY' },
    { id: '44', name: 'Lorenz, Ursula',       gender: 'F', league: 'BK'  },
    { id: '45', name: 'Frank, Christian',     gender: 'M', league: 'BL'  },
    { id: '46', name: 'Böhm, Brigitte',       gender: 'F', league: 'OL'  },
    { id: '47', name: 'Weiss, Daniel',        gender: 'M', league: 'FZ'  },
    { id: '48', name: 'Hahn, Karin',          gender: 'F', league: 'BL'  },
    { id: '49', name: 'Jung, Markus',         gender: 'M', league: 'BOL' },
    { id: '50', name: 'Kaiser, Gabi',         gender: 'F', league: 'BAY' },
    { id: '51', name: 'Kern, Tobias',         gender: 'M', league: 'BK'  },
    { id: '52', name: 'Lenz, Stefanie',       gender: 'F', league: 'BL'  },
    { id: '53', name: 'Mayer, Sebastian',     gender: 'M', league: 'BK'  },
    { id: '54', name: 'Naumann, Andrea',      gender: 'F', league: 'BOL' },
    { id: '55', name: 'Ott, Alexander',       gender: 'M', league: 'OL'  },
    { id: '56', name: 'Pfeiffer, Bianca',     gender: 'F', league: 'FZ'  },
    { id: '57', name: 'Rauch, Florian',       gender: 'M', league: 'BL'  },
    { id: '58', name: 'Sauer, Christina',     gender: 'F', league: 'BK'  },
    { id: '59', name: 'Thiele, Patrick',      gender: 'M', league: 'BAY' },
    { id: '60', name: 'Voigt, Diana',         gender: 'F', league: 'BL'  },
    { id: '61', name: 'Walter, David',        gender: 'M', league: 'BL'  },
    { id: '62', name: 'Ziegler, Elena',       gender: 'F', league: 'BOL' },
    { id: '63', name: 'Hofmann, Philipp',     gender: 'M', league: 'FZ'  },
    { id: '64', name: 'Schreiber, Franziska', gender: 'F', league: 'BAY' },
    { id: '65', name: 'Kühn, Kevin',          gender: 'M', league: 'BK'  },
    { id: '66', name: 'Heinrich, Greta',      gender: 'F', league: 'BL'  },
    { id: '67', name: 'Berger, Sven',         gender: 'M', league: 'BOL' },
    { id: '68', name: 'Lindner, Iris',        gender: 'F', league: 'OL'  },
    { id: '69', name: 'Albrecht, Jens',       gender: 'M', league: 'BK'  },
    { id: '70', name: 'Probst, Jana',         gender: 'F', league: 'BL'  },
    { id: '71', name: 'Gross, Ralf',          gender: 'M', league: 'FZ'  },
    { id: '72', name: 'Steiner, Katharina',   gender: 'F', league: 'BAY' },
    { id: '73', name: 'Kiefer, Wolfgang',     gender: 'M', league: 'BOL' },
    { id: '74', name: 'Wolff, Linda',         gender: 'F', league: 'BK'  },
    { id: '75', name: 'Schmitt, Bernd',       gender: 'M', league: 'BL'  },
    { id: '76', name: 'Meyer, Maria',         gender: 'F', league: 'BOL' },
    { id: '77', name: 'Schneider, Werner',    gender: 'M', league: 'BAY' },
    { id: '78', name: 'Kraus, Nora',          gender: 'F', league: 'FZ'  },
    { id: '79', name: 'Schuster, Horst',      gender: 'M', league: 'BK'  },
    { id: '80', name: 'Jäger, Olga',          gender: 'F', league: 'BL'  },
    { id: '81', name: 'Pfister, Uwe',         gender: 'M', league: 'OL'  },
    { id: '82', name: 'Biermann, Paula',      gender: 'F', league: 'BOL' },
    { id: '83', name: 'Gottwald, Karl',       gender: 'M', league: 'BAY' },
    { id: '84', name: 'Theimer, Renate',      gender: 'F', league: 'BL'  },
    { id: '85', name: 'Ulbrich, Otto',        gender: 'M', league: 'BK'  },
    { id: '86', name: 'Voss, Silvia',         gender: 'F', league: 'BAY' },
    { id: '87', name: 'Westermann, Gerhard',  gender: 'M', league: 'OL'  },
    { id: '88', name: 'Zacharias, Tanja',     gender: 'F', league: 'BL'  },
    { id: '89', name: 'Seidl, Erich',         gender: 'M', league: 'BOL' },
    { id: '90', name: 'Wimmer, Ulrike',       gender: 'F', league: 'FZ'  },
    { id: '91', name: 'Reiter, Harald',       gender: 'M', league: 'BK'  },
    { id: '92', name: 'Grunewald, Vera',      gender: 'F', league: 'OL'  },
    { id: '93', name: 'Brandl, Rainer',       gender: 'M', league: 'BL'  },
    { id: '94', name: 'Mühlbauer, Wanda',     gender: 'F', league: 'BOL' },
    { id: '95', name: 'Schindler, Joachim',   gender: 'M', league: 'RL'  },
    { id: '96', name: 'Haller, Yvonne',       gender: 'F', league: 'BAY' },
    { id: '97', name: 'Frey, Günter',         gender: 'M', league: 'BK'  },
    { id: '98', name: 'Eder, Zoe',            gender: 'F', league: 'RL'  },
    { id: '99', name: 'Söller, Helmut',       gender: 'M', league: 'BU'  },
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
    setPausedParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const updateParticipant = (id, changes) => {
    setParticipants((prev) => prev.map((p) => p.id === id ? { ...p, ...changes } : p));
    setPausedParticipants((prev) => prev.map((p) => p.id === id ? { ...p, ...changes } : p));
  };

  const pauseParticipant = (id) => {
    setParticipants((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) setPausedParticipants((pp) => [...pp, p]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const setStatAdjustment = (id, adj) => {
    setStatAdjustments((prev) => ({ ...prev, [id]: adj }));
  };

  const resumeParticipant = (id) => {
    setPausedParticipants((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) setParticipants((pp) => [...pp, p]);
      return prev.filter((x) => x.id !== id);
    });
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

    // Vollmond-Schutz: Vollmondspieler dürfen kein Freilos bekommen
    const currentStandings = getStandings();
    const gsProtect = Math.ceil(currentStandings.length / 3);
    const vollmondIds = new Set(currentStandings.slice(0, gsProtect).map((p) => p.id));

    if (isSchnellrunde) {
      // ── Schnellrunden: komplett zufällig, Spieltyp wird pro Spiel zufällig gewählt ──
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

      // Vollmond-Spieler ans Ende → pop() verarbeitet sie zuerst → kein Freilos
      const prioritize = (arr) => [
        ...arr.filter((id) => !vollmondIds.has(id)),
        ...arr.filter((id) => vollmondIds.has(id)),
      ];

      const men   = prioritize(shuffle(participants.filter((p) => p.gender === 'M').map((p) => p.id)));
      const women = prioritize(shuffle(participants.filter((p) => p.gender === 'F').map((p) => p.id)));

      const canMM = () => men.length >= 4;
      const canFF = () => women.length >= 4;
      const canMF = () => men.length >= 2 && women.length >= 2;

      while (canMM() || canFF() || canMF()) {
        // Welche Spieltypen sind gerade möglich?
        const options = [];
        if (canMM()) options.push('MM');
        if (canFF()) options.push('FF');
        if (canMF()) options.push('MF');
        if (options.length === 0) break;

        // Zufällig einen Spieltyp wählen
        const type = options[Math.floor(Math.random() * options.length)];

        if (type === 'MM') {
          matches.push(balanceMatch(makeMatch([men.pop(), men.pop()], [men.pop(), men.pop()], 'MM')));
        } else if (type === 'FF') {
          matches.push(balanceMatch(makeMatch([women.pop(), women.pop()], [women.pop(), women.pop()], 'FF')));
        } else {
          matches.push(balanceMatch(makeMatch([men.pop(), women.pop()], [men.pop(), women.pop()], 'MF')));
        }
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

    // Schlechtere Spieler (Neumond/untere Halbmond) → D1, bessere (Vollmond/obere Halbmond) → D2
    // Dazu jedes Spiel nach dem Durchschnitt der Ranglistenposition seiner 4 Spieler bewerten.
    const standingIndex = Object.fromEntries(currentStandings.map((p, i) => [p.id, i]));
    // Score = Rang des besten Spielers im Match (niedrigster Index = höchster Rang)
    // → Match mit Platz 1 hat Score 0 und bekommt Feld 12 / geht in D2
    const matchScore = (m) => {
      const ids = [...m.teamA, ...m.teamB];
      return Math.min(...ids.map((id) => standingIndex[id] ?? currentStandings.length));
    };
    // Aufsteigend sortieren: niedrigster Score = beste Spieler → kommen in D2
    const sorted = [...matches].sort((a, b) => matchScore(a) - matchScore(b));
    const d2Count = Math.floor(matches.length / 2);
    const d2Ids = new Set(sorted.slice(0, d2Count).map((m) => m.id));
    const matchesWithD = matches.map((m) => ({ ...m, durchgang: d2Ids.has(m.id) ? 2 : 1 }));

    // Feldzuweisung: schlechtestes Spiel im DG → niedrigstes Feld, bestes → Feld 12
    // Bei weniger als 12 Spielen pro DG fallen die untersten Felder weg (Feld 1 zuerst)
    const assignFields = (dgMatches) => {
      if (dgMatches.length === 0) return [];
      const startField = 13 - dgMatches.length;
      // Schlechteste Spieler zuerst → niedrigste Feldnummer
      const byScore = [...dgMatches].sort((a, b) => matchScore(b) - matchScore(a));
      return byScore.map((m, i) => ({ ...m, feld: startField + i }));
    };
    const withFields = [
      ...assignFields(matchesWithD.filter((m) => m.durchgang === 1)),
      ...assignFields(matchesWithD.filter((m) => m.durchgang === 2)),
    ];

    setRounds((prev) => [...prev, { id: roundId, matches: withFields, sittingOut, isSchnellrunde, currentDurchgang: 1 }]);
    setCurrentRound(roundId);
  };

  const advanceDurchgang = () => {
    setRounds((prev) =>
      prev.map((r) => r.id === currentRound ? { ...r, currentDurchgang: 2 } : r)
    );
  };

  const currentDurchgangDone = () => {
    const r = getCurrentRoundData();
    if (!r) return false;
    const dm = r.matches.filter((m) => m.durchgang === r.currentDurchgang);
    return dm.length > 0 && dm.every((m) => m.done);
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
    rounds.forEach((r) => {
      (r.sittingOut ?? []).forEach((id) => {
        if (!stats[id]) return;
        stats[id].games += 1;
        stats[id].wins += 1;
        stats[id].points += 2;
        // diff bleibt +-0 (Freilos = Sieg ohne Punkte)
      });
    });
    Object.entries(statAdjustments).forEach(([id, adj]) => {
      if (!stats[id]) return;
      stats[id].games += adj.games ?? 0;
      stats[id].wins  += adj.wins  ?? 0;
      stats[id].diff  += adj.diff  ?? 0;
      stats[id].points += (adj.wins ?? 0) * 2;
    });
    return Object.values(stats).sort((a, b) => b.wins - a.wins || b.diff - a.diff);
  };

  const getCurrentRoundData = () => rounds.find((r) => r.id === currentRound);

  const deleteCurrentRound = () => {
    setRounds((prev) => prev.filter((r) => r.id !== currentRound));
    setCurrentRound((prev) => Math.max(0, prev - 1));
  };

  const deleteRound = (roundId) => {
    setRounds((prev) => prev.filter((r) => r.id !== roundId));
    setCurrentRound((prev) => (roundId === prev ? Math.max(0, prev - 1) : prev));
  };

  const swapMatchPlayers = (m1id, team1, idx1, m2id, team2, idx2) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.id !== currentRound) return r;
        const matches = r.matches.map((m) => ({
          ...m,
          teamA: [...m.teamA],
          teamB: [...m.teamB],
        }));
        const match1 = matches.find((m) => m.id === m1id);
        const match2 = matches.find((m) => m.id === m2id);
        const pid1 = (team1 === 'A' ? match1.teamA : match1.teamB)[idx1];
        const pid2 = (team2 === 'A' ? match2.teamA : match2.teamB)[idx2];
        if (team1 === 'A') match1.teamA[idx1] = pid2; else match1.teamB[idx1] = pid2;
        if (team2 === 'A') match2.teamA[idx2] = pid1; else match2.teamB[idx2] = pid1;
        return { ...r, matches };
      })
    );
  };

  const allMatchesDone = () => {
    const r = getCurrentRoundData();
    if (!r) return true;
    return r.matches.every((m) => m.done);
  };

  return (
    <TournamentContext.Provider
      value={{
        participants, pausedParticipants,
        addParticipant, removeParticipant, updateParticipant,
        pauseParticipant, resumeParticipant,
        statAdjustments, setStatAdjustment,
        autoTimerTrigger, triggerAutoTimer,
        rounds, currentRound, saveResult, startNewRound,
        getStandings, getCurrentRoundData, allMatchesDone,
        advanceDurchgang, currentDurchgangDone,
        deleteCurrentRound, deleteRound, swapMatchPlayers,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);
