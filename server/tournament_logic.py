"""
Pure tournament logic, ported 1:1 from src/store/tournament.js.

This module is intentionally side-effect free: every function takes a
`TournamentState` snapshot, does its work, and returns either a value or
a *new* state. The DB layer (`db_state.py`) handles persistence.

Why pure?
  Two reasons. First, the algorithms are tricky (Schnellrunde Heuristik,
  Vollmond-Schutz, hadFreilos-Set, D2-Bevorzugung) and the only way to be
  sure we got the port right is to test them in isolation. Second, the
  logic must produce *identical* results to the RN app — pure functions
  make that property easy to verify.

Mirrors of the JS source:
  - LEAGUE_RANK             (line ~247)
  - shuffle                 (line ~52)
  - get_standings()         ↔ getStandings()        (~499)
  - start_new_round()       ↔ startNewRound()       (~249)
  - start_final_runde()     ↔ startFinalRunde()     (~422)
  - save_result()           ↔ saveResult()          (~226)
  - advance_durchgang()     ↔ advanceDurchgang()    (~486)
  - current_durchgang_done  ↔ currentDurchgangDone  (~492)
  - all_matches_done        ↔ allMatchesDone        (~569)
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional


# Same league-strength order as the JS module. Higher = stronger.
LEAGUE_RANK = {
    "FZ": 0, "BK": 1, "BL": 2, "BOL": 3, "BAY": 4, "OL": 5, "RL": 6, "BU": 7,
}

# Hard cap of the whole tournament model: the Rangliste is built from three
# fixed moon groups (Vollmond/Halbmond/Neumond) of 33 players each.
MAX_PARTICIPANTS = 99

LEAGUES = [
    ("FZ",  "Freizeitspieler"),
    ("BK",  "Bezirksklasse"),
    ("BL",  "Bezirksliga"),
    ("BOL", "Bezirksoberliga"),
    ("BAY", "Bayernliga"),
    ("OL",  "Oberliga"),
    ("RL",  "Regionalliga"),
    ("BU",  "Bundesliga"),
]


# --- Data model ---------------------------------------------------------------

@dataclass
class Participant:
    id: str
    name: str
    gender: str          # 'M' | 'F'
    league: str
    is_paused: bool = False
    email: Optional[str] = None
    verein: Optional[str] = None


@dataclass
class Match:
    id: str              # e.g. "r3m5" or DB integer rendered as str
    team_a: list[str]    # [participant_id, participant_id]
    team_b: list[str]
    match_type: str      # 'MM' | 'FF' | 'MF'
    durchgang: int = 1
    field: int = 0
    score_a: Optional[int] = None
    score_b: Optional[int] = None
    done: bool = False

    @property
    def winner_team(self) -> Optional[str]:
        if not self.done or self.score_a is None or self.score_b is None:
            return None
        if self.score_a > self.score_b: return "A"
        if self.score_b > self.score_a: return "B"
        return None


@dataclass
class Round:
    id: int
    round_number: int
    is_schnellrunde: bool = False
    is_final_runde: bool = False
    current_durchgang: int = 1
    sitting_out: list[str] = field(default_factory=list)
    matches: list[Match] = field(default_factory=list)


@dataclass
class StatAdjustment:
    games: int = 0
    wins: int = 0
    diff: int = 0


@dataclass
class TournamentState:
    """Snapshot of the entire tournament. Cheap to load (<1k rows total)."""
    participants: list[Participant]              # active only
    paused: list[Participant]                    # excluded from draws, kept in standings
    rounds: list[Round]
    stat_adjustments: dict[str, StatAdjustment]  # keyed by participant id


@dataclass
class StandingRow:
    id: str
    name: str
    gender: str
    league: str
    games: int = 0
    wins: int = 0
    diff: int = 0
    points: int = 0


# --- Pure helpers -------------------------------------------------------------

def shuffle(items: list, rng: random.Random | None = None) -> list:
    """Fisher-Yates, deterministic if `rng` is provided. Returns a NEW list."""
    out = list(items)
    r = rng or random
    for i in range(len(out) - 1, 0, -1):
        j = r.randint(0, i)
        out[i], out[j] = out[j], out[i]
    return out


# --- Standings ----------------------------------------------------------------

def get_standings(state: TournamentState) -> list[StandingRow]:
    """
    Mirrors getStandings() in tournament.js.

    Rules (in order applied):
      1. Active + paused players are seeded with zero stats.
      2. For each completed match: every participating player gets +1 game.
         The diff is point-difference relative to opponent (signed).
         Winners (winner_team set) get wins+1 and points+2.
      3. For each sitting_out (Freilos) entry: the player gets games+1, wins+1,
         points+2 — Freilos counts as a free win, diff stays untouched.
      4. Stat adjustments are added on top (additive). points += wins * 2.
      5. Sort: wins DESC, then diff DESC. (Same key as the RN version.)
    """
    rows: dict[str, StandingRow] = {}
    for p in [*state.participants, *state.paused]:
        rows[p.id] = StandingRow(
            id=p.id, name=p.name, gender=p.gender, league=p.league or "FZ",
        )

    for rnd in state.rounds:
        for m in rnd.matches:
            if not m.done or m.score_a is None or m.score_b is None:
                continue
            for pid in [*m.team_a, *m.team_b]:
                if pid in rows:
                    rows[pid].games += 1
            for pid in m.team_a:
                if pid in rows:
                    rows[pid].diff += (m.score_a - m.score_b)
            for pid in m.team_b:
                if pid in rows:
                    rows[pid].diff += (m.score_b - m.score_a)
            winners = (
                m.team_a if m.winner_team == "A"
                else m.team_b if m.winner_team == "B"
                else []
            )
            for pid in winners:
                if pid in rows:
                    rows[pid].wins += 1
                    rows[pid].points += 2
        # Freilos: sitting_out players get a free win for that round.
        for pid in rnd.sitting_out:
            if pid in rows:
                rows[pid].games += 1
                rows[pid].wins += 1
                rows[pid].points += 2

    # Manual stat adjustments (admin-set).
    for pid, adj in state.stat_adjustments.items():
        if pid not in rows:
            continue
        rows[pid].games += adj.games
        rows[pid].wins  += adj.wins
        rows[pid].diff  += adj.diff
        rows[pid].points += adj.wins * 2

    # Identical sort key to the RN: wins desc, then diff desc.
    return sorted(rows.values(), key=lambda r: (-r.wins, -r.diff))


# --- Save result --------------------------------------------------------------

def apply_save_result(match: Match, score_a: int, score_b: int, is_schnellrunde: bool) -> Match:
    """
    Returns a new Match with done=True and adjusted scores.

    Schnellrunde rule: in early rounds, the loser score is bumped to at least
    16 if the winner reached 16 — this damps the diff impact (mirrors the
    saveResult() block in tournament.js, lines ~233).
    """
    eff_a = score_a
    eff_b = score_b
    if is_schnellrunde and max(score_a, score_b) >= 16:
        if score_a > score_b:
            eff_b = max(16, score_b)
        elif score_b > score_a:
            eff_a = max(16, score_a)

    return Match(
        id=match.id,
        team_a=list(match.team_a),
        team_b=list(match.team_b),
        match_type=match.match_type,
        durchgang=match.durchgang,
        field=match.field,
        score_a=eff_a,
        score_b=eff_b,
        done=True,
    )


# --- Round generation: shared helpers -----------------------------------------

def _match_type(team_a: list[str], team_b: list[str], gender_of: dict[str, str]) -> str:
    """JS: matchType() — all-male=MM, all-female=FF, otherwise MF."""
    men_count = sum(1 for pid in [*team_a, *team_b] if gender_of.get(pid) == "M")
    if men_count == 4: return "MM"
    if men_count == 0: return "FF"
    return "MF"


def _fix_conflict(team_a: list[str], team_b: list[str], gender_of: dict[str, str]) -> tuple[list[str], list[str]]:
    """
    JS: fixConflict() — only invalid composition is one all-male team vs one
    all-female team. Resolves by swapping the second player of each team.
    """
    a_all_f = all(gender_of.get(pid) == "F" for pid in team_a)
    b_all_m = all(gender_of.get(pid) == "M" for pid in team_b)
    a_all_m = all(gender_of.get(pid) == "M" for pid in team_a)
    b_all_f = all(gender_of.get(pid) == "F" for pid in team_b)
    if (a_all_f and b_all_m) or (a_all_m and b_all_f):
        return [team_a[0], team_b[1]], [team_b[0], team_a[1]]
    return team_a, team_b


def _assign_durchgang_and_fields(matches: list[Match], standings: list[StandingRow]) -> list[Match]:
    """
    JS: D1/D2-Aufteilung + assignFields() — the shared field-allocation logic
    used by both startNewRound() and startFinalRunde() (lines ~388 & ~460).

    Algorithm (verbatim from the source):
      1. Score each match by the rank of its best player (lowest standings index).
      2. Sort matches by score ASC. The first ceil(len/2) → D2 (better matches).
         Ceil ensures D2 gets the extra game when match count is odd, so that
         D1 loses Feld 1 (the lowest field) before D2 does.
      3. Within each Durchgang, the worst match gets the lowest field number.
         Field 12 is "best", field (13 - len) is "worst" in that group.
    """
    if not matches:
        return []

    standing_index = {row.id: i for i, row in enumerate(standings)}
    n_total = len(standings)

    def match_score(m: Match) -> int:
        # Best player's standing rank → low number means strong match.
        ids = [*m.team_a, *m.team_b]
        return min(standing_index.get(pid, n_total) for pid in ids)

    # D2 gets the better matches (lower scores).
    by_score = sorted(matches, key=match_score)
    d2_count = math.ceil(len(matches) / 2)
    d2_ids = {m.id for m in by_score[:d2_count]}

    # Stamp durchgang on each match (return a new list, don't mutate).
    stamped = [
        Match(
            id=m.id, team_a=list(m.team_a), team_b=list(m.team_b),
            match_type=m.match_type,
            durchgang=2 if m.id in d2_ids else 1,
            field=0, score_a=m.score_a, score_b=m.score_b, done=m.done,
        )
        for m in matches
    ]

    def assign_fields(dg_matches: list[Match]) -> list[Match]:
        if not dg_matches:
            return []
        start_field = 13 - len(dg_matches)
        # Worst-first → lowest field number.
        ordered = sorted(dg_matches, key=lambda m: -match_score(m))
        out = []
        for i, m in enumerate(ordered):
            out.append(Match(
                id=m.id, team_a=list(m.team_a), team_b=list(m.team_b),
                match_type=m.match_type, durchgang=m.durchgang,
                field=start_field + i,
                score_a=m.score_a, score_b=m.score_b, done=m.done,
            ))
        return out

    d1 = [m for m in stamped if m.durchgang == 1]
    d2 = [m for m in stamped if m.durchgang == 2]
    return [*assign_fields(d1), *assign_fields(d2)]


# --- Round generation: Schnellrunde -------------------------------------------

def _build_schnellrunde(
    state: TournamentState,
    round_id: int,
    standings: list[StandingRow],
    rng: random.Random,
) -> tuple[list[Match], list[str]]:
    """
    Mirrors the `if (isSchnellrunde)` branch of startNewRound() (lines ~268-323).

    - Match types are picked at random from MM/FF/MF where possible.
    - Within a match, partners are arranged to balance the league strength on
      both sides (balanceMatch() in JS).
    - Vollmond players (top third by standings) and players with prior Freilos
      are pushed to the END of the priority queue; pop() takes from the end,
      so they get *placed first* and never end up sitting out.
    """
    p_map = {p.id: p for p in state.participants}

    def league_str(pid: str) -> int:
        p = p_map.get(pid)
        return LEAGUE_RANK.get(p.league if p else "FZ", 0)

    def balance_match(team_a: list[str], team_b: list[str], match_type: str) -> tuple[list[str], list[str]]:
        if match_type == "MF":
            m1, w1 = team_a
            m2, w2 = team_b
            d1 = abs((league_str(m1) + league_str(w1)) - (league_str(m2) + league_str(w2)))
            d2 = abs((league_str(m1) + league_str(w2)) - (league_str(m2) + league_str(w1)))
            if d2 < d1:
                return [m1, w2], [m2, w1]
            return team_a, team_b
        # MM or FF: try all 3 pairings of 4 players, pick the one with smallest diff.
        p1, p2, p3, p4 = [*team_a, *team_b]
        candidates = [
            ([p1, p2], [p3, p4]),
            ([p1, p3], [p2, p4]),
            ([p1, p4], [p2, p3]),
        ]
        best = candidates[0]
        best_d = math.inf
        for a, b in candidates:
            d = abs((league_str(a[0]) + league_str(a[1])) - (league_str(b[0]) + league_str(b[1])))
            if d < best_d:
                best_d = d
                best = (a, b)
        return list(best[0]), list(best[1])

    # Vollmond protection: top 1/3 must never get Freilos.
    gs_protect = math.ceil(len(standings) / 3) if standings else 0
    vollmond_ids = {row.id for row in standings[:gs_protect]}
    had_freilos = set()
    for r in state.rounds:
        had_freilos.update(r.sitting_out)

    def prioritize(arr: list[str]) -> list[str]:
        # Tier 1: clean — pop()'d last, so they sit out first.
        # Tier 2: previously sat out — protected from a second Freilos.
        # Tier 3: vollmond — fully protected.
        # Putting later tiers at the END means pop() handles them FIRST,
        # leaving tier-1 players to be the leftovers.
        clean = [pid for pid in arr if pid not in vollmond_ids and pid not in had_freilos]
        had   = [pid for pid in arr if pid not in vollmond_ids and pid in had_freilos]
        voll  = [pid for pid in arr if pid in vollmond_ids]
        return [*clean, *had, *voll]

    men   = prioritize(shuffle([p.id for p in state.participants if p.gender == "M"], rng))
    women = prioritize(shuffle([p.id for p in state.participants if p.gender == "F"], rng))

    matches: list[Match] = []
    idx = 0

    def make(team_a: list[str], team_b: list[str], match_type: str) -> Match:
        nonlocal idx
        a, b = balance_match(team_a, team_b, match_type)
        m = Match(id=f"r{round_id}m{idx}", team_a=a, team_b=b, match_type=match_type)
        idx += 1
        return m

    while True:
        options = []
        if len(men) >= 4: options.append("MM")
        if len(women) >= 4: options.append("FF")
        if len(men) >= 2 and len(women) >= 2: options.append("MF")
        if not options:
            break
        match_type = options[rng.randrange(len(options))]
        if match_type == "MM":
            matches.append(make([men.pop(), men.pop()], [men.pop(), men.pop()], "MM"))
        elif match_type == "FF":
            matches.append(make([women.pop(), women.pop()], [women.pop(), women.pop()], "FF"))
        else:
            matches.append(make([men.pop(), women.pop()], [men.pop(), women.pop()], "MF"))

    sitting_out = [*men, *women]
    return matches, sitting_out


# --- Round generation: Normale Runde ------------------------------------------

def _build_normal_round(
    state: TournamentState,
    round_id: int,
    standings: list[StandingRow],
) -> tuple[list[Match], list[str]]:
    """
    Mirrors the `else` branch of startNewRound() (lines ~325-386).

    Process:
      1. Compute a per-round ranking using ONLY tournament results so far
         (NOT global standings — note this is different from get_standings()
         because it ignores stat_adjustments and Freilos bonuses).
      2. Stable-sort: players with prior Freilos move to the back; the splice
         operates from the front, so leftovers (== back) are protected.
      3. Snake pairing in groups of 8: 1+8 vs 2+7 ; 3+6 vs 4+5.
      4. If 4 players remain at the end: 1+4 vs 2+3.
      5. Anything else (≤3) sits out.
    """
    p_map = {p.id: p for p in state.participants}

    def gender_of(pid: str) -> str:
        p = p_map.get(pid)
        return p.gender if p else "M"

    # Per-round stats: only completed matches; no Freilos bonus, no adjustments.
    stats: dict[str, dict] = {p.id: {"id": p.id, "points": 0, "diff": 0} for p in state.participants}
    for r in state.rounds:
        for m in r.matches:
            if not m.done or m.score_a is None or m.score_b is None:
                continue
            for pid in m.team_a:
                if pid in stats: stats[pid]["diff"] += (m.score_a - m.score_b)
            for pid in m.team_b:
                if pid in stats: stats[pid]["diff"] += (m.score_b - m.score_a)
            winners = m.team_a if m.winner_team == "A" else m.team_b if m.winner_team == "B" else []
            for pid in winners:
                if pid in stats: stats[pid]["points"] += 2

    ranked = [s["id"] for s in sorted(stats.values(), key=lambda x: (-x["points"], -x["diff"]))]

    # Push prior-Freilos players to the back so they don't sit out again.
    had_freilos = set()
    for r in state.rounds:
        had_freilos.update(r.sitting_out)
    # Sort key in JS: (hadFreilos.has(a) ? 0 : 1) - (hadFreilos.has(b) ? 0 : 1)
    # → had_freilos players sort lower than clean ones, so they end up first…
    # Wait — JS uses a stable sort, and 0 < 1, so had_freilos goes BEFORE clean.
    # But the comment says "ans Ende der Leftover-Reihenfolge" (back of pool).
    # Reading more carefully: pool.splice(0, 8) takes from the FRONT. Players
    # at the BACK are leftovers. JS sort puts had_freilos ids first (key 0),
    # so clean players are at the back → clean players become leftovers (Freilos).
    # That's the OPPOSITE of what we want. Let me re-check the JS...
    #
    # Actually the JS line is:
    #   ranked.sort((a, b) => (hadFreilos.has(a) ? 0 : 1) - (hadFreilos.has(b) ? 0 : 1));
    # which evaluates to: had_freilos=0, clean=1 → had_freilos sorts FIRST.
    # The comment claims this protects had_freilos players. Looking at the
    # algorithm: pool.splice(0, 8) takes the FIRST 8. If had_freilos players
    # are first, they get matched. Leftovers (last in pool) are the clean ones
    # who haven't had Freilos yet — those are eligible for a fresh Freilos.
    # So the JS comment is misleading but the behavior is correct: clean players
    # are eligible to sit out. We mirror it exactly.
    ranked.sort(key=lambda pid: 0 if pid in had_freilos else 1)

    matches: list[Match] = []
    idx = 0

    def make(team_a: list[str], team_b: list[str]) -> Match:
        nonlocal idx
        m = Match(
            id=f"r{round_id}m{idx}",
            team_a=team_a, team_b=team_b,
            match_type=_match_type(team_a, team_b, {pid: gender_of(pid) for pid in [*team_a, *team_b]}),
        )
        idx += 1
        return m

    pool = list(ranked)
    while len(pool) >= 8:
        g = pool[:8]; del pool[:8]
        gender_map = {pid: gender_of(pid) for pid in g}
        a1, b1 = _fix_conflict([g[0], g[7]], [g[1], g[6]], gender_map)
        matches.append(make(a1, b1))
        a2, b2 = _fix_conflict([g[2], g[5]], [g[3], g[4]], gender_map)
        matches.append(make(a2, b2))
    if len(pool) >= 4:
        g = pool[:4]; del pool[:4]
        gender_map = {pid: gender_of(pid) for pid in g}
        a, b = _fix_conflict([g[0], g[3]], [g[1], g[2]], gender_map)
        matches.append(make(a, b))

    sitting_out = list(pool)
    return matches, sitting_out


# --- Public round-start API ---------------------------------------------------

def build_new_round(state: TournamentState, rng: random.Random | None = None) -> Round:
    """
    Returns a fully-formed Round (with matches, durchgang, fields) ready to
    be persisted. Does NOT mutate `state`.

    round_number = current round count + 1. The first three rounds are
    Schnellrunden (random match types, league-balanced). Round 4+ uses snake
    pairing on per-round results.
    """
    rng = rng or random.Random()
    round_number = len(state.rounds) + 1
    is_schnellrunde = round_number <= 3
    standings = get_standings(state)

    if is_schnellrunde:
        matches, sitting_out = _build_schnellrunde(state, round_number, standings, rng)
    else:
        matches, sitting_out = _build_normal_round(state, round_number, standings)

    matches = _assign_durchgang_and_fields(matches, standings)

    # Sort by durchgang then field for stable display order.
    matches.sort(key=lambda m: (m.durchgang, m.field))

    return Round(
        id=0,  # filled in by DB layer on insert
        round_number=round_number,
        is_schnellrunde=is_schnellrunde,
        is_final_runde=False,
        current_durchgang=1,
        sitting_out=sitting_out,
        matches=matches,
    )


def build_final_runde(state: TournamentState) -> Round:
    """
    Mirrors startFinalRunde() (~422). Groups of 4 by current standings:
    Platz 1+4 vs 2+3, Platz 5+8 vs 6+7, etc. Identical D1/D2/field logic.
    """
    round_number = len(state.rounds) + 1
    standings = get_standings(state)

    p_map = {p.id: p for p in state.participants}

    def gender_of(pid: str) -> str:
        p = p_map.get(pid)
        return p.gender if p else "M"

    matches: list[Match] = []
    idx = 0

    def make(team_a: list[str], team_b: list[str]) -> Match:
        nonlocal idx
        gender_map = {pid: gender_of(pid) for pid in [*team_a, *team_b]}
        m = Match(
            id=f"r{round_number}m{idx}",
            team_a=team_a, team_b=team_b,
            match_type=_match_type(team_a, team_b, gender_map),
        )
        idx += 1
        return m

    # Only ACTIVE players play the final (paused stay in standings but don't play).
    active_ids = {p.id for p in state.participants}
    pool = [row.id for row in standings if row.id in active_ids]

    while len(pool) >= 4:
        g = pool[:4]; del pool[:4]
        gender_map = {pid: gender_of(pid) for pid in g}
        a, b = _fix_conflict([g[0], g[3]], [g[1], g[2]], gender_map)
        matches.append(make(a, b))
    sitting_out = list(pool)

    matches = _assign_durchgang_and_fields(matches, standings)
    matches.sort(key=lambda m: (m.durchgang, m.field))

    return Round(
        id=0,
        round_number=round_number,
        is_schnellrunde=False,
        is_final_runde=True,
        current_durchgang=1,
        sitting_out=sitting_out,
        matches=matches,
    )
