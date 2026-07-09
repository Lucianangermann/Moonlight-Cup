"""
Public Anmeldungs-Formular.

Registrations are auto-confirmed while there is room: the submitter lands
directly on the participants list (visible in the app's Teilnehmer tab
within one poll), since the form collects everything a participant row
needs (gender, league). Once MAX_PARTICIPANTS is reached, registrations
are accepted onto the WAITLIST instead (anmeldung stays status='pending');
the admin promotes waitlisted players from the app's Teilnehmer tab when
a spot frees up. The anmeldungen row doubles as the audit trail and
carries the meal answers the participant row doesn't need.
"""
from functools import wraps

from flask import Blueprint, render_template, redirect, url_for, flash, session, make_response

from blueprints.api import _invalidate_cache
from config import Config
from database import get_db
from db_state import confirm_anmeldung, create_anmeldung, list_anmeldungen, participants_full
from forms.public_forms import AnmeldungForm
from mailer import is_configured as mail_configured, send_registration_receipt
from tournament_logic import LEAGUES, MAX_PARTICIPANTS

bp = Blueprint("anmeldung", __name__)

_LEAGUE_LABELS = dict(LEAGUES)
_GENDER_LABELS = {"M": "Herr", "F": "Dame"}
_STATUS_LABELS = {"pending": "Warteliste", "confirmed": "Bestätigt", "rejected": "Abgelehnt"}


def _admin_required(view):
    """Page-route guard (redirect, not the JSON 401 blueprints.auth.login_required
    uses) — this dashboard is server-rendered HTML, not an API endpoint."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            flash("Bitte zuerst einloggen.", "error")
            return redirect(url_for("anmeldung.anmeldung"))
        return view(*args, **kwargs)
    return wrapper


def _privacy_contact() -> str:
    return Config.PRIVACY_CONTACT_EMAIL or Config.MAIL_FROM.split("<")[-1].rstrip(">").strip()


@bp.route("/datenschutz")
def datenschutz():
    return render_template("datenschutz.html", contact=_privacy_contact())


@bp.route("/impressum")
def impressum():
    return render_template("impressum.html")


def _format_created_at(raw: str) -> str:
    # Stored as "YYYY-MM-DD HH:MM:SS" (sqlite datetime('now'), UTC).
    try:
        date_part, time_part = raw.split(" ")
        return f"{date_part[8:10]}.{date_part[5:7]}.{date_part[2:4]} {time_part[:5]}"
    except (ValueError, IndexError):
        return raw


@bp.route("/dashboard")
@_admin_required
def dashboard():
    db = get_db()
    rows = list_anmeldungen(db)  # every status — the whole registration history
    entries = []
    for r in rows:
        midnight_meal_line = "Nein"
        if r["midnight_meal"]:
            art = "Vegetarisch" if r["midnight_meal_type"] == "vegetarisch" else "Nicht vegetarisch"
            midnight_meal_line = f"Ja ({art})"
        breakfast_line = "Nein"
        if r["breakfast"]:
            art = "Weißwurscht" if r["breakfast_type"] == "weisswurscht" else "Vegetarisch"
            breakfast_line = f"Ja ({art})"
        entries.append({
            "id": r["id"],
            "name": r["name"],
            "email": r["email"],
            "age": r["age"],
            "gender": _GENDER_LABELS.get(r["gender"], r["gender"] or "—"),
            "verein": r["verein"] or "—",
            "league": _LEAGUE_LABELS.get(r["league"], r["league"] or "—"),
            "midnightMeal": midnight_meal_line,
            "breakfast": breakfast_line,
            "status": r["status"],
            "statusLabel": _STATUS_LABELS.get(r["status"], r["status"]),
            "createdAt": _format_created_at(r["created_at"]),
            "search": " ".join(filter(None, [r["name"], r["email"], r["verein"]])).lower(),
            # Raw values (not the display strings above) for the edit modal.
            "raw": {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "age": r["age"],
                "gender": r["gender"],
                "verein": r["verein"] or "",
                "league": r["league"],
                "midnightMeal": bool(r["midnight_meal"]),
                "midnightMealType": r["midnight_meal_type"],
                "breakfast": bool(r["breakfast"]),
                "breakfastType": r["breakfast_type"],
            },
        })
    counts = {
        "total": len(entries),
        "confirmed": sum(1 for e in entries if e["status"] == "confirmed"),
        "pending": sum(1 for e in entries if e["status"] == "pending"),
        "rejected": sum(1 for e in entries if e["status"] == "rejected"),
    }
    resp = make_response(render_template(
        "dashboard.html", entries=entries, counts=counts, leagues=LEAGUES,
    ))
    # PII-heavy page — never let a shared/public browser cache it.
    resp.headers["Cache-Control"] = "no-store"
    return resp


@bp.route("/anmeldung", methods=["GET", "POST"])
def anmeldung():
    form = AnmeldungForm()
    contact = _privacy_contact()

    if form.validate_on_submit():
        db = get_db()
        email = form.email.data.strip().lower()

        already = db.execute(
            "SELECT 1 FROM participants WHERE lower(email) = ?", (email,)
        ).fetchone()
        if not already:
            already = db.execute(
                "SELECT 1 FROM anmeldungen WHERE status = 'pending' AND lower(email) = ?",
                (email,),
            ).fetchone()
        if already:
            flash("Mit dieser E-Mail-Adresse ist bereits jemand angemeldet.", "error")
            return render_template("anmeldung.html", form=form, contact=contact)

        waitlisted = participants_full(db, MAX_PARTICIPANTS)

        midnight_meal = form.midnight_meal.data == "ja"
        breakfast = form.breakfast.data == "ja"
        anmeldung_id = create_anmeldung(
            db,
            name=form.name.data.strip(),
            email=email,
            verein=form.verein.data.strip(),
            age=form.age.data,
            gender=form.gender.data,
            league=form.league.data,
            midnight_meal=midnight_meal,
            midnight_meal_type=form.midnight_meal_type.data if midnight_meal else None,
            breakfast=breakfast,
            breakfast_type=form.breakfast_type.data if breakfast else None,
        )
        if not waitlisted:
            confirm_anmeldung(db, anmeldung_id, gender=form.gender.data, league=form.league.data)
            _invalidate_cache()  # new participant must show up on the next poll

        send_registration_receipt(
            name=form.name.data.strip(),
            email=email,
            age=form.age.data,
            verein=form.verein.data.strip(),
            league=form.league.data,
            midnight_meal=midnight_meal,
            midnight_meal_type=form.midnight_meal_type.data if midnight_meal else None,
            breakfast=breakfast,
            breakfast_type=form.breakfast_type.data if breakfast else None,
            waitlisted=waitlisted,
        )

        if waitlisted:
            msg = ("Die Teilnehmerliste ist voll — du stehst auf der Warteliste. "
                   "Sobald ein Platz frei wird, melden wir uns bei dir.")
        else:
            msg = "Du bist angemeldet und stehst ab sofort auf der Teilnehmerliste!"
        if mail_configured():
            msg += " Eine Bestätigung ist unterwegs an deine E-Mail-Adresse."
        flash(msg, "success")
        return redirect(url_for("anmeldung.anmeldung"))

    return render_template("anmeldung.html", form=form, contact=contact)
