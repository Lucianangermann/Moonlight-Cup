"""
JSON API consumed by the React/Expo web app (served from blueprints/webapp.py).

Public routes (`/api/tournament`, `/api/timer`) are read-only and safe for
every visitor to poll. Every mutating route requires the admin session
(`login_required`, from blueprints/auth.py) — there is exactly one admin
account, same as the old HTML admin panel this replaces.

All routes here reuse db_state.py / tournament_logic.py directly — no
tournament business logic is duplicated in this file. JSON keys are
camelCase to match what the RN screens already expect from the (now
removed) local-only tournament.js store.
"""
from __future__ import annotations

import secrets

from flask import Blueprint, jsonify, request

from blueprints.auth import login_required
from database import get_db
from db_state import (
    add_participant, advance_durchgang, all_matches_done,
    clear_match_result, confirm_anmeldung, current_durchgang_done,
    delete_anmeldung, delete_round, delete_timer, deactivate_timer,
    get_active_timer, list_anmeldungen, load_state, persist_round,
    remove_participant, reset_tournament, save_match_result,
    set_paused, set_stat_adjustment, set_timer, swap_match_players,
    update_participant,
)
from tournament_logic import build_final_runde, build_new_round, get_standings

bp = Blueprint("api", __name__, url_prefix="/api")


# --- Serialization -------------------------------------------------------------

def _serialize_participant(p) -> dict:
    return {
        "id": p.id, "name": p.name, "gender": p.gender, "league": p.league,
        "email": p.email, "verein": p.verein,
    }


def _serialize_match(m) -> dict:
    return {
        "id": m.id, "teamA": m.team_a, "teamB": m.team_b,
        "matchType": m.match_type, "durchgang": m.durchgang, "field": m.field,
        "scoreA": m.score_a, "scoreB": m.score_b, "done": m.done,
        "winnerTeam": m.winner_team,
    }


def _serialize_round(r) -> dict:
    return {
        "id": r.id, "roundNumber": r.round_number,
        "isSchnellrunde": r.is_schnellrunde, "isFinalRunde": r.is_final_runde,
        "currentDurchgang": r.current_durchgang,
        "sittingOut": r.sitting_out,
        "matches": [_serialize_match(m) for m in sorted(r.matches, key=lambda x: (x.durchgang, x.field))],
    }


def _serialize_standing(row) -> dict:
    return {
        "id": row.id, "name": row.name, "gender": row.gender, "league": row.league,
        "games": row.games, "wins": row.wins, "diff": row.diff, "points": row.points,
    }


def _serialize_anmeldung(row) -> dict:
    return {
        "id": row["id"], "name": row["name"], "email": row["email"],
        "verein": row["verein"], "createdAt": row["created_at"],
    }


# --- Tournament (public reads) -------------------------------------------------

@bp.route("/tournament", methods=["GET"])
def tournament():
    db = get_db()
    state = load_state(db)
    standings = get_standings(state)
    current = state.rounds[-1] if state.rounds else None
    return jsonify({
        "participants": [_serialize_participant(p) for p in state.participants],
        "pausedParticipants": [_serialize_participant(p) for p in state.paused],
        "rounds": [_serialize_round(r) for r in state.rounds],
        "currentRound": current.id if current else None,
        "standings": [_serialize_standing(r) for r in standings],
        "statAdjustments": {
            pid: {"games": adj.games, "wins": adj.wins, "diff": adj.diff}
            for pid, adj in state.stat_adjustments.items()
        },
    })


@bp.route("/timer", methods=["GET"])
def timer():
    row = get_active_timer(get_db())
    if row is None:
        return jsonify({
            "label": None, "targetTime": None, "isActive": False,
            "phase": None, "totalSeconds": None,
        })
    return jsonify({
        "label": row["label"],
        "targetTime": row["target_time"],  # ISO-8601 UTC, parsed client-side
        "isActive": bool(row["is_active"]),
        "phase": row["phase"],             # 'prep'|'warmup'|'game' — drives ring color
        "totalSeconds": row["total_seconds"],  # full phase duration for the progress arc
    })


# --- Anmeldungen (admin) --------------------------------------------------------

@bp.route("/anmeldungen", methods=["GET"])
@login_required
def anmeldungen():
    rows = list_anmeldungen(get_db(), status="pending")
    return jsonify([_serialize_anmeldung(r) for r in rows])


@bp.route("/anmeldungen/<int:anmeldung_id>/confirm", methods=["POST"])
@login_required
def anmeldung_confirm(anmeldung_id):
    data = request.get_json(silent=True) or {}
    gender, league = data.get("gender"), data.get("league")
    if gender not in ("M", "F") or not league:
        return jsonify({"error": "gender ('M'/'F') and league are required"}), 400
    try:
        pid = confirm_anmeldung(get_db(), anmeldung_id, gender=gender, league=league)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({"pid": pid})


@bp.route("/anmeldungen/<int:anmeldung_id>", methods=["DELETE"])
@login_required
def anmeldung_delete(anmeldung_id):
    delete_anmeldung(get_db(), anmeldung_id)
    return "", 204


# --- Participants (admin) -------------------------------------------------------

@bp.route("/participants", methods=["POST"])
@login_required
def participant_add():
    data = request.get_json(silent=True) or {}
    name, gender, league = data.get("name"), data.get("gender"), data.get("league")
    if not name or gender not in ("M", "F") or not league:
        return jsonify({"error": "name, gender ('M'/'F') and league are required"}), 400
    pid = secrets.token_hex(6)
    add_participant(
        get_db(), pid=pid, name=name.strip(), gender=gender, league=league,
        email=(data.get("email") or "").strip() or None,
        verein=(data.get("verein") or "").strip() or None,
    )
    return jsonify({"id": pid}), 201


@bp.route("/participants/<pid>", methods=["PATCH"])
@login_required
def participant_update(pid):
    data = request.get_json(silent=True) or {}
    update_participant(get_db(), pid, **data)
    return jsonify({})


@bp.route("/participants/<pid>", methods=["DELETE"])
@login_required
def participant_remove(pid):
    remove_participant(get_db(), pid)
    return "", 204


@bp.route("/participants/<pid>/pause", methods=["POST"])
@login_required
def participant_pause(pid):
    set_paused(get_db(), pid, True)
    return jsonify({})


@bp.route("/participants/<pid>/resume", methods=["POST"])
@login_required
def participant_resume(pid):
    set_paused(get_db(), pid, False)
    return jsonify({})


# --- Rounds (admin) --------------------------------------------------------------

@bp.route("/rounds", methods=["POST"])
@login_required
def rounds_start():
    db = get_db()
    state = load_state(db)
    current = state.rounds[-1] if state.rounds else None
    if current and not all_matches_done(db, current.id):
        return jsonify({"error": "Aktuelle Runde ist noch nicht abgeschlossen."}), 409
    round_ = build_new_round(state)
    persist_round(db, round_)
    # Re-load rather than patch round_ in place: its matches still carry the
    # tournament_logic-internal placeholder ids (e.g. "r1m0") assigned before
    # persistence, not the real autoincrement match ids SQLite just assigned.
    fresh_round = load_state(db).rounds[-1]
    return jsonify(_serialize_round(fresh_round)), 201


@bp.route("/rounds/final", methods=["POST"])
@login_required
def rounds_start_final():
    db = get_db()
    state = load_state(db)
    current = state.rounds[-1] if state.rounds else None
    if current and not all_matches_done(db, current.id):
        return jsonify({"error": "Aktuelle Runde ist noch nicht abgeschlossen — erst beenden, dann Finale."}), 409
    if any(r.is_final_runde for r in state.rounds):
        return jsonify({"error": "Finale wurde bereits ausgelost."}), 409
    round_ = build_final_runde(state)
    persist_round(db, round_)
    fresh_round = load_state(db).rounds[-1]
    return jsonify(_serialize_round(fresh_round)), 201


@bp.route("/rounds/<int:round_id>/advance-durchgang", methods=["POST"])
@login_required
def rounds_advance_durchgang(round_id):
    db = get_db()
    if not current_durchgang_done(db, round_id):
        return jsonify({"error": "Durchgang 1 ist noch nicht abgeschlossen."}), 409
    advance_durchgang(db, round_id)
    return jsonify({})


@bp.route("/rounds/<int:round_id>", methods=["DELETE"])
@login_required
def rounds_delete(round_id):
    delete_round(get_db(), round_id)
    return "", 204


@bp.route("/tournament/reset", methods=["POST"])
@login_required
def tournament_reset():
    reset_tournament(get_db())
    return jsonify({})


# --- Matches (admin) ---------------------------------------------------------------

@bp.route("/matches/<int:match_id>/result", methods=["POST"])
@login_required
def match_save_result(match_id):
    data = request.get_json(silent=True) or {}
    try:
        score_a, score_b = int(data["scoreA"]), int(data["scoreB"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "scoreA and scoreB (integers) are required"}), 400
    try:
        save_match_result(get_db(), match_id, score_a, score_b)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({})


@bp.route("/matches/<int:match_id>/result", methods=["DELETE"])
@login_required
def match_clear_result(match_id):
    clear_match_result(get_db(), match_id)
    return "", 204


@bp.route("/matches/swap", methods=["POST"])
@login_required
def matches_swap():
    data = request.get_json(silent=True) or {}
    try:
        swap_match_players(
            get_db(),
            match1_id=int(data["match1Id"]), team1=data["team1"], idx1=int(data["idx1"]),
            match2_id=int(data["match2Id"]), team2=data["team2"], idx2=int(data["idx2"]),
        )
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({})


# --- Standings (admin) ---------------------------------------------------------------

@bp.route("/standings/<pid>/adjustment", methods=["POST"])
@login_required
def standings_adjustment(pid):
    data = request.get_json(silent=True) or {}
    set_stat_adjustment(
        get_db(), pid,
        games=int(data.get("games") or 0),
        wins=int(data.get("wins") or 0),
        diff=int(data.get("diff") or 0),
    )
    return jsonify({})


# --- Timer (admin writes) ---------------------------------------------------------------

@bp.route("/timer", methods=["POST"])
@login_required
def timer_set():
    data = request.get_json(silent=True) or {}
    label, target_time = data.get("label"), data.get("targetTime")
    if not label or not target_time:
        return jsonify({"error": "label and targetTime (ISO-8601 UTC) are required"}), 400
    phase = data.get("phase")
    total_seconds = data.get("totalSeconds")
    set_timer(
        get_db(), label=label.strip(), target_time_iso=target_time,
        phase=phase if phase in ("prep", "warmup", "game") else None,
        total_seconds=int(total_seconds) if total_seconds else None,
    )
    return jsonify({})


@bp.route("/timer/deactivate", methods=["POST"])
@login_required
def timer_deactivate_route():
    deactivate_timer(get_db())
    return jsonify({})


@bp.route("/timer", methods=["DELETE"])
@login_required
def timer_delete_route():
    delete_timer(get_db())
    return "", 204
