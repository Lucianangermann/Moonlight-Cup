"""
Public read-only routes: index, Rangliste, Ergebnisse, Spielplan.

Heavy reads: getStandings rebuilds stats from all matches every call. For
~100 players × ~10 rounds that's <50ms even on a Pi 5, well below the
30-second timer-poll cadence. We don't cache.
"""
from flask import Blueprint, render_template

from database import get_db
from db_state import load_state
from tournament_logic import LEAGUES, get_standings


bp = Blueprint("public", __name__)


# Group definitions mirror RanglisteScreen.js
FIXED_GROUP_SIZE = 33
GROUP_DEFS = [
    {"key": "vollmond", "label": "Vollmond", "full": "Vollmondgruppe", "sub": "Stärkste Spieler"},
    {"key": "halbmond", "label": "Halbmond", "full": "Halbmondgruppe", "sub": "Mittelfeld"},
    {"key": "neumond",  "label": "Neumond",  "full": "Neumondgruppe",  "sub": "Aufsteiger"},
]


def _split_groups(standings):
    """Vollmond/Halbmond fixed at 33; Neumond gets the rest."""
    return [
        standings[:FIXED_GROUP_SIZE],
        standings[FIXED_GROUP_SIZE:FIXED_GROUP_SIZE * 2],
        standings[FIXED_GROUP_SIZE * 2:],
    ]


def _participant_lookup(state):
    """Build {id: Participant} including paused for display purposes."""
    return {p.id: p for p in [*state.participants, *state.paused]}


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/rangliste")
def rangliste():
    state = load_state(get_db())
    standings = get_standings(state)
    groups = _split_groups(standings)
    paused_ids = {p.id for p in state.paused}

    # Pre-format names for the template (Vorname Nachname).
    def display_name(name: str) -> str:
        if "," in name:
            ln, fn = name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return name.strip()

    enriched = []
    for i, row in enumerate(standings):
        enriched.append({
            "rank": i + 1,
            "id": row.id,
            "name": display_name(row.name),
            "league": row.league,
            "games": row.games,
            "wins": row.wins,
            "diff": row.diff,
            "points": row.points,
            "is_paused": row.id in paused_ids,
        })

    grouped = []
    offsets = [0, FIXED_GROUP_SIZE, FIXED_GROUP_SIZE * 2]
    for i, defn in enumerate(GROUP_DEFS):
        start = offsets[i]
        end = offsets[i] + len(groups[i])
        grouped.append({
            **defn,
            "players": enriched[start:end],
            "range": f"Platz {start + 1}–{end}" if end > start else "—",
        })

    return render_template(
        "rangliste.html",
        groups=grouped,
        total_players=len(standings),
    )


@bp.route("/ergebnisse")
def ergebnisse():
    state = load_state(get_db())
    p_lookup = _participant_lookup(state)

    def name(pid: str) -> str:
        p = p_lookup.get(pid)
        if not p:
            return f"#{pid}"
        if "," in p.name:
            ln, fn = p.name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return p.name

    # Show rounds newest first; only completed matches.
    rounds_ctx = []
    for rnd in reversed(state.rounds):
        completed = [m for m in rnd.matches if m.done]
        if not completed and not rnd.sitting_out:
            continue
        rounds_ctx.append({
            "round_number": rnd.round_number,
            "is_final": rnd.is_final_runde,
            "is_schnellrunde": rnd.is_schnellrunde,
            "matches": [
                {
                    "field": m.field,
                    "durchgang": m.durchgang,
                    "team_a": [name(pid) for pid in m.team_a],
                    "team_b": [name(pid) for pid in m.team_b],
                    "score_a": m.score_a,
                    "score_b": m.score_b,
                    "winner": m.winner_team,
                }
                for m in sorted(completed, key=lambda x: (x.durchgang, x.field))
            ],
            "sitting_out": [name(pid) for pid in rnd.sitting_out],
        })

    return render_template("ergebnisse.html", rounds=rounds_ctx)


@bp.route("/spielplan")
def spielplan():
    state = load_state(get_db())
    p_lookup = _participant_lookup(state)

    def name(pid: str) -> str:
        p = p_lookup.get(pid)
        if not p:
            return f"#{pid}"
        if "," in p.name:
            ln, fn = p.name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return p.name

    # Show ALL matches in the current (latest) round, including pending ones.
    current = state.rounds[-1] if state.rounds else None
    rounds_ctx = []
    if current:
        rounds_ctx.append({
            "round_number": current.round_number,
            "is_final": current.is_final_runde,
            "is_schnellrunde": current.is_schnellrunde,
            "current_durchgang": current.current_durchgang,
            "matches": [
                {
                    "field": m.field,
                    "durchgang": m.durchgang,
                    "team_a": [name(pid) for pid in m.team_a],
                    "team_b": [name(pid) for pid in m.team_b],
                    "score_a": m.score_a,
                    "score_b": m.score_b,
                    "done": m.done,
                    "winner": m.winner_team,
                    "match_type": m.match_type,
                }
                for m in sorted(current.matches, key=lambda x: (x.durchgang, x.field))
            ],
            "sitting_out": [name(pid) for pid in current.sitting_out],
        })

    return render_template("spielplan.html", rounds=rounds_ctx, has_round=bool(current))
