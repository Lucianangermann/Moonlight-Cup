"""
Admin area — every route guarded by login_required.

Reads use load_state() for the live tournament view; writes call into
db_state.py helpers (which wrap the pure functions in tournament_logic.py).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

from flask import (
    Blueprint, render_template, redirect, url_for, flash, request, abort,
)

from blueprints.auth import login_required
from database import get_db
from db_state import (
    add_participant, advance_durchgang, all_matches_done,
    confirm_anmeldung, current_durchgang_done, delete_anmeldung,
    delete_round, delete_timer, deactivate_timer,
    get_active_timer, list_anmeldungen, load_state, persist_round,
    remove_participant, reset_tournament, save_match_result,
    set_paused, set_stat_adjustment, set_timer, update_participant,
)
from forms.admin_forms import (
    AddParticipantForm, ConfirmAnmeldungForm, EditParticipantForm,
    MatchResultForm, StatAdjustmentForm, TimerForm,
)
from tournament_logic import (
    LEAGUES, build_final_runde, build_new_round, get_standings,
)

bp = Blueprint("admin", __name__, url_prefix="/admin")


# --- Dashboard ----------------------------------------------------------------

@bp.route("/")
@login_required
def dashboard():
    db = get_db()
    state = load_state(db)
    pending_n = len(list_anmeldungen(db, status="pending"))
    timer = get_active_timer(db)
    last_round = state.rounds[-1] if state.rounds else None
    last_result = None
    if last_round:
        done = [m for m in last_round.matches if m.done]
        if done:
            m = sorted(done, key=lambda x: (x.durchgang, x.field))[-1]
            last_result = f"R{last_round.round_number} F{m.field}: {m.score_a}:{m.score_b}"

    return render_template(
        "admin/dashboard.html",
        n_active=len(state.participants),
        n_paused=len(state.paused),
        n_pending=pending_n,
        n_rounds=len(state.rounds),
        last_round=last_round,
        last_result=last_result,
        timer=timer,
    )


# --- Teilnehmer (Anmeldungen + Roster) ----------------------------------------

@bp.route("/teilnehmer", methods=["GET", "POST"])
@login_required
def teilnehmer():
    db = get_db()

    add_form = AddParticipantForm(prefix="add")
    confirm_form = ConfirmAnmeldungForm(prefix="confirm")
    edit_form = EditParticipantForm(prefix="edit")

    if request.method == "POST":
        action = request.form.get("action")

        if action == "add" and add_form.validate_on_submit():
            add_participant(
                db,
                pid=secrets.token_hex(6),
                name=add_form.name.data.strip(),
                gender=add_form.gender.data,
                league=add_form.league.data,
                email=(add_form.email.data or "").strip() or None,
                verein=(add_form.verein.data or "").strip() or None,
            )
            flash("Teilnehmer hinzugefügt.", "success")
            return redirect(url_for("admin.teilnehmer"))

        if action == "confirm" and confirm_form.validate_on_submit():
            confirm_anmeldung(
                db, int(confirm_form.anmeldung_id.data),
                gender=confirm_form.gender.data,
                league=confirm_form.league.data,
            )
            flash("Anmeldung bestätigt — Spieler wurde zur Teilnehmerliste hinzugefügt.", "success")
            return redirect(url_for("admin.teilnehmer"))

        if action == "edit" and edit_form.validate_on_submit():
            update_participant(
                db, edit_form.pid.data,
                name=edit_form.name.data.strip(),
                gender=edit_form.gender.data,
                league=edit_form.league.data,
                email=(edit_form.email.data or "").strip() or None,
                verein=(edit_form.verein.data or "").strip() or None,
            )
            flash("Teilnehmer aktualisiert.", "success")
            return redirect(url_for("admin.teilnehmer"))

        if action == "delete_anmeldung":
            delete_anmeldung(db, int(request.form["anmeldung_id"]))
            flash("Anmeldung gelöscht.", "info")
            return redirect(url_for("admin.teilnehmer"))

        if action == "remove_participant":
            remove_participant(db, request.form["pid"])
            flash("Teilnehmer entfernt.", "info")
            return redirect(url_for("admin.teilnehmer"))

        if action == "pause":
            set_paused(db, request.form["pid"], True)
            flash("Spieler pausiert.", "info")
            return redirect(url_for("admin.teilnehmer"))

        if action == "resume":
            set_paused(db, request.form["pid"], False)
            flash("Spieler reaktiviert.", "success")
            return redirect(url_for("admin.teilnehmer"))

        flash("Ungültige Aktion oder Validierungsfehler.", "error")

    pending = list_anmeldungen(db, status="pending")
    state = load_state(db)
    return render_template(
        "admin/teilnehmer.html",
        add_form=add_form, confirm_form=confirm_form, edit_form=edit_form,
        pending=pending,
        active=state.participants, paused=state.paused,
        leagues=LEAGUES,
    )


# --- Spielplan (Runde starten / verwalten) ------------------------------------

@bp.route("/spielplan", methods=["GET", "POST"])
@login_required
def spielplan():
    db = get_db()

    if request.method == "POST":
        action = request.form.get("action")
        state = load_state(db)
        current = state.rounds[-1] if state.rounds else None

        if action == "start_round":
            # Block if a round is currently in progress.
            if current and not all_matches_done(db, current.id):
                flash("Aktuelle Runde ist noch nicht abgeschlossen.", "error")
            else:
                round_ = build_new_round(state)
                persist_round(db, round_)
                flash(f"Runde {round_.round_number} ausgelost.", "success")
            return redirect(url_for("admin.spielplan"))

        if action == "advance_durchgang":
            if current and current_durchgang_done(db, current.id) and current.current_durchgang == 1:
                advance_durchgang(db, current.id)
                flash("Durchgang 2 gestartet.", "success")
            else:
                flash("Durchgang 1 ist noch nicht abgeschlossen.", "error")
            return redirect(url_for("admin.spielplan"))

        if action == "start_final":
            if current and not all_matches_done(db, current.id):
                flash("Aktuelle Runde ist noch nicht abgeschlossen — erst beenden, dann Finale.", "error")
            elif any(r.is_final_runde for r in state.rounds):
                flash("Finale wurde bereits ausgelost.", "error")
            else:
                round_ = build_final_runde(state)
                persist_round(db, round_)
                flash("Finale ausgelost.", "success")
            return redirect(url_for("admin.spielplan"))

        if action == "delete_round":
            delete_round(db, int(request.form["round_id"]))
            flash("Runde gelöscht.", "info")
            return redirect(url_for("admin.spielplan"))

        if action == "reset":
            reset_tournament(db)
            flash("Turnier zurückgesetzt — Pausierte Spieler reaktiviert, Runden gelöscht.", "info")
            return redirect(url_for("admin.spielplan"))

    state = load_state(db)
    p_lookup = {p.id: p for p in [*state.participants, *state.paused]}

    def display_name(pid):
        p = p_lookup.get(pid)
        if not p:
            return f"#{pid}"
        if "," in p.name:
            ln, fn = p.name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return p.name

    rounds_ctx = []
    for rnd in state.rounds:
        rounds_ctx.append({
            "id": rnd.id,
            "round_number": rnd.round_number,
            "is_final": rnd.is_final_runde,
            "is_schnellrunde": rnd.is_schnellrunde,
            "current_durchgang": rnd.current_durchgang,
            "matches": [
                {
                    "id": m.id,
                    "field": m.field,
                    "durchgang": m.durchgang,
                    "team_a": [display_name(pid) for pid in m.team_a],
                    "team_b": [display_name(pid) for pid in m.team_b],
                    "score_a": m.score_a, "score_b": m.score_b,
                    "done": m.done, "winner": m.winner_team,
                    "match_type": m.match_type,
                }
                for m in sorted(rnd.matches, key=lambda x: (x.durchgang, x.field))
            ],
            "sitting_out": [display_name(pid) for pid in rnd.sitting_out],
            "all_done": all(m.done for m in rnd.matches),
        })

    current = rounds_ctx[-1] if rounds_ctx else None
    can_start_final = (
        len(state.rounds) > 0
        and current and current["all_done"]
        and not any(r.is_final_runde for r in state.rounds)
    )
    return render_template(
        "admin/spielplan.html",
        rounds=rounds_ctx,
        current=current,
        n_active=len(state.participants),
        can_start_final=can_start_final,
    )


# --- Ergebnisse erfassen ------------------------------------------------------

@bp.route("/ergebnisse", methods=["GET", "POST"])
@login_required
def ergebnisse():
    db = get_db()
    form = MatchResultForm()

    if request.method == "POST":
        action = request.form.get("action")
        if action == "save_result" and form.validate_on_submit():
            try:
                save_match_result(
                    db, int(form.match_id.data),
                    form.score_a.data, form.score_b.data,
                )
                flash("Ergebnis gespeichert.", "success")
            except ValueError as e:
                flash(str(e), "error")
            return redirect(url_for("admin.ergebnisse"))

        if action == "clear":
            from db_state import clear_match_result
            clear_match_result(db, int(request.form["match_id"]))
            flash("Ergebnis zurückgesetzt.", "info")
            return redirect(url_for("admin.ergebnisse"))

    state = load_state(db)
    p_lookup = {p.id: p for p in [*state.participants, *state.paused]}

    def display_name(pid):
        p = p_lookup.get(pid)
        if not p:
            return f"#{pid}"
        if "," in p.name:
            ln, fn = p.name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return p.name

    # Show matches per round (current round prominently, then older rounds collapsed).
    rounds_ctx = []
    for rnd in reversed(state.rounds):
        matches_data = [
            {
                "id": m.id, "field": m.field, "durchgang": m.durchgang,
                "team_a": [display_name(pid) for pid in m.team_a],
                "team_b": [display_name(pid) for pid in m.team_b],
                "score_a": m.score_a, "score_b": m.score_b,
                "done": m.done, "winner": m.winner_team,
                "match_type": m.match_type,
            }
            for m in sorted(rnd.matches, key=lambda x: (x.durchgang, x.field))
        ]
        rounds_ctx.append({
            "id": rnd.id,
            "round_number": rnd.round_number,
            "is_final": rnd.is_final_runde,
            "is_schnellrunde": rnd.is_schnellrunde,
            "matches": matches_data,
        })

    return render_template("admin/ergebnisse.html", rounds=rounds_ctx, form=form)


# --- Rangliste (Stat-Adjustments) ---------------------------------------------

@bp.route("/rangliste", methods=["GET", "POST"])
@login_required
def rangliste():
    db = get_db()
    form = StatAdjustmentForm()

    if request.method == "POST" and form.validate_on_submit():
        set_stat_adjustment(
            db, form.pid.data,
            games=form.games.data or 0,
            wins=form.wins.data or 0,
            diff=form.diff.data or 0,
        )
        flash("Stat-Adjustment gespeichert.", "success")
        return redirect(url_for("admin.rangliste"))

    state = load_state(db)
    standings = get_standings(state)
    p_lookup = {p.id: p for p in [*state.participants, *state.paused]}
    paused_ids = {p.id for p in state.paused}

    def display_name(name):
        if "," in name:
            ln, fn = name.split(",", 1)
            return f"{fn.strip()} {ln.strip()}"
        return name

    enriched = []
    for i, row in enumerate(standings):
        adj = state.stat_adjustments.get(row.id)
        enriched.append({
            "rank": i + 1, "id": row.id, "name": display_name(row.name),
            "league": row.league, "games": row.games, "wins": row.wins,
            "diff": row.diff, "points": row.points,
            "is_paused": row.id in paused_ids,
            "adj": {"games": adj.games if adj else 0,
                    "wins": adj.wins if adj else 0,
                    "diff": adj.diff if adj else 0},
        })

    return render_template("admin/rangliste.html", standings=enriched, form=form)


# --- Timer --------------------------------------------------------------------

@bp.route("/timer", methods=["GET", "POST"])
@login_required
def timer():
    db = get_db()
    form = TimerForm()

    if request.method == "POST":
        action = request.form.get("action")

        if action == "set" and form.validate_on_submit():
            # DateTimeLocalField returns a naive datetime. The browser sent it
            # in the user's local time, so we attach the server's local tz
            # (assumed to match) and convert to UTC for storage. The client-side
            # JS then parses the UTC ISO and renders in the viewer's local tz.
            dt_local = form.target_time.data
            if dt_local.tzinfo is None:
                dt_local = dt_local.astimezone()  # attach local tz
            dt_utc = dt_local.astimezone(timezone.utc)
            set_timer(db, label=form.label.data.strip(),
                      target_time_iso=dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ"))
            flash("Timer gesetzt.", "success")
            return redirect(url_for("admin.timer"))

        if action == "deactivate":
            deactivate_timer(db)
            flash("Timer deaktiviert.", "info")
            return redirect(url_for("admin.timer"))

        if action == "delete":
            delete_timer(db)
            flash("Timer gelöscht.", "info")
            return redirect(url_for("admin.timer"))

    active = get_active_timer(db)
    return render_template("admin/timer.html", form=form, active=active)
