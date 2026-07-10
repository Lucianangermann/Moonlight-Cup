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

import hashlib
import json
import secrets
import sqlite3
import threading
import time

from flask import Blueprint, Response, jsonify, request

from blueprints.auth import login_required
from database import get_db
from db_state import (
    add_participant, advance_durchgang, all_matches_done,
    clear_match_result, confirm_anmeldung, current_durchgang_done,
    delete_anmeldung, delete_round, delete_timer, deactivate_timer,
    get_active_timer, list_anmeldungen, load_state, participants_full,
    persist_round, purge_all_participant_data, remove_participant,
    reset_tournament, save_match_result,
    set_paused, set_stat_adjustment, set_timer, swap_match_players,
    update_anmeldung, update_participant,
)
from tournament_logic import (
    LEAGUES, MAX_PARTICIPANTS, build_final_runde, build_new_round, get_standings,
)

bp = Blueprint("api", __name__, url_prefix="/api")


# --- Poll-endpoint micro-cache --------------------------------------------------
#
# /api/tournament and /api/timer are polled every 5s by every phone in the
# gym (60 phones ≈ 24 req/s), yet the data only changes when the admin acts.
# Each poll response is cached per worker for a short TTL and served with an
# ETag, so identical polls become 304s (no body, no recompute). Admin
# mutations call _invalidate_cache() so the admin's own follow-up refresh
# sees the write immediately in this worker; the other gunicorn worker
# serves at most CACHE_TTL seconds of stale data to viewers.

CACHE_TTL = 1.0
_cache_lock = threading.Lock()
_cache: dict[str, tuple[float, str, str]] = {}  # name -> (expires, body, etag)


def _invalidate_cache() -> None:
    with _cache_lock:
        _cache.clear()


@bp.after_request
def _bust_cache_on_mutation(resp):
    # Any successful non-GET on this blueprint may have changed tournament
    # or timer state — one hook instead of remembering it in 17 routes.
    if request.method not in ("GET", "HEAD", "OPTIONS") and resp.status_code < 400:
        _invalidate_cache()
    return resp


def _cached_json_response(name: str, build) -> Response:
    now = time.monotonic()
    with _cache_lock:
        hit = _cache.get(name)
        if hit and hit[0] > now:
            _, body, etag = hit
        else:
            body = json.dumps(build(), separators=(",", ":"))
            etag = '"' + hashlib.md5(body.encode()).hexdigest() + '"'
            _cache[name] = (now + CACHE_TTL, body, etag)

    if request.headers.get("If-None-Match") == etag:
        resp = Response(status=304)
    else:
        resp = Response(body, mimetype="application/json")
    resp.headers["ETag"] = etag
    # no-cache = "revalidate with the ETag", NOT "don't cache" — exactly
    # the conditional-request behavior the polling clients rely on.
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# --- Serialization -------------------------------------------------------------

def _serialize_participant(p) -> dict:
    # No "email" here: /api/tournament is public (polled by every viewer's
    # phone, no login_required) and nothing in the app reads participant
    # e-mail from it — TeilnehmerScreen's pending-Anmeldungen list gets
    # e-mail from the separate admin-only GET /api/anmeldungen instead.
    return {
        "id": p.id, "name": p.name, "gender": p.gender, "league": p.league,
        "verein": p.verein,
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
        # Collected by the public form since the waitlist rework — lets the
        # admin's confirm dialog prefill instead of guessing M/FZ.
        "age": row["age"], "gender": row["gender"], "league": row["league"],
    }


# --- Tournament (public reads) -------------------------------------------------

def _build_tournament_payload() -> dict:
    state = load_state(get_db())
    standings = get_standings(state)
    current = state.rounds[-1] if state.rounds else None
    return {
        "participants": [_serialize_participant(p) for p in state.participants],
        "pausedParticipants": [_serialize_participant(p) for p in state.paused],
        "rounds": [_serialize_round(r) for r in state.rounds],
        "currentRound": current.id if current else None,
        "standings": [_serialize_standing(r) for r in standings],
        "statAdjustments": {
            pid: {"games": adj.games, "wins": adj.wins, "diff": adj.diff}
            for pid, adj in state.stat_adjustments.items()
        },
    }


@bp.route("/tournament", methods=["GET"])
def tournament():
    return _cached_json_response("tournament", _build_tournament_payload)


def _build_timer_payload() -> dict:
    row = get_active_timer(get_db())
    if row is None:
        return {
            "label": None, "targetTime": None, "isActive": False,
            "phase": None, "totalSeconds": None,
        }
    return {
        "label": row["label"],
        "targetTime": row["target_time"],  # ISO-8601 UTC, parsed client-side
        "isActive": bool(row["is_active"]),
        "phase": row["phase"],             # 'prep'|'warmup'|'game' — drives ring color
        "totalSeconds": row["total_seconds"],  # full phase duration for the progress arc
    }


@bp.route("/timer", methods=["GET"])
def timer():
    return _cached_json_response("timer", _build_timer_payload)


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
    db = get_db()
    if participants_full(db, MAX_PARTICIPANTS):
        return jsonify({"error": f"Teilnehmerliste ist voll ({MAX_PARTICIPANTS} Plätze)."}), 409
    try:
        pid = confirm_anmeldung(db, anmeldung_id, gender=gender, league=league)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except sqlite3.IntegrityError:
        # Double-tap on the confirm button: the participant id a<id> already
        # exists. 409 instead of a 500.
        return jsonify({"error": "Diese Anmeldung wurde bereits bestätigt."}), 409
    return jsonify({"pid": pid})


@bp.route("/anmeldungen/<int:anmeldung_id>", methods=["PATCH"])
@login_required
def anmeldung_update(anmeldung_id):
    """Edits a registration record — used by the admin dashboard's edit
    form. Shared fields (incl. gender/league) sync onto a linked
    participant, see db_state.update_anmeldung."""
    data = request.get_json(silent=True) or {}
    if "name" in data and not str(data["name"]).strip():
        return jsonify({"error": "name must not be empty"}), 400
    if "email" in data and not str(data["email"]).strip():
        return jsonify({"error": "email must not be empty"}), 400
    if "gender" in data and data["gender"] not in ("M", "F"):
        return jsonify({"error": "gender must be 'M' or 'F'"}), 400
    # league now syncs onto participants (NOT NULL there) — reject unknown
    # keys instead of letting them flow into draws/standings displays.
    if "league" in data and data["league"] not in {key for key, _ in LEAGUES}:
        return jsonify({"error": "league must be a valid league key"}), 400
    if "midnight_meal_type" in data and data["midnight_meal_type"] not in ("vegetarisch", "nicht_vegetarisch", None):
        return jsonify({"error": "midnight_meal_type must be 'vegetarisch', 'nicht_vegetarisch' or null"}), 400
    if "breakfast_type" in data and data["breakfast_type"] not in ("vegetarisch", "weisswurscht", None):
        return jsonify({"error": "breakfast_type must be 'vegetarisch', 'weisswurscht' or null"}), 400
    if "age" in data and data["age"] is not None:
        try:
            data["age"] = int(data["age"])
        except (TypeError, ValueError):
            return jsonify({"error": "age must be a number"}), 400
    update_anmeldung(get_db(), anmeldung_id, **data)
    return jsonify({})


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
    # Validate before the UPDATE — invalid values would otherwise hit the
    # table's CHECK constraints and surface as a 500.
    if "gender" in data and data["gender"] not in ("M", "F"):
        return jsonify({"error": "gender must be 'M' or 'F'"}), 400
    if "league" in data and not data["league"]:
        return jsonify({"error": "league must not be empty"}), 400
    if "name" in data and not str(data["name"]).strip():
        return jsonify({"error": "name must not be empty"}), 400
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


@bp.route("/gdpr/purge", methods=["POST"])
@login_required
def gdpr_purge():
    """Post-season deletion of all participant/registration PII — see
    db_state.purge_all_participant_data for exactly what's removed."""
    purge_all_participant_data(get_db())
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
    try:
        games = int(data.get("games") or 0)
        wins = int(data.get("wins") or 0)
        diff = int(data.get("diff") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "games, wins and diff must be integers"}), 400
    set_stat_adjustment(get_db(), pid, games=games, wins=wins, diff=diff)
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
    try:
        total_seconds = int(total_seconds) if total_seconds else None
    except (TypeError, ValueError):
        return jsonify({"error": "totalSeconds must be an integer"}), 400
    set_timer(
        get_db(), label=label.strip(), target_time_iso=target_time,
        phase=phase if phase in ("prep", "warmup", "game") else None,
        total_seconds=total_seconds,
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
