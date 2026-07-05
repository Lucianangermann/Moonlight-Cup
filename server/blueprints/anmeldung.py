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
from flask import Blueprint, render_template, redirect, url_for, flash

from database import get_db
from db_state import confirm_anmeldung, create_anmeldung
from forms.public_forms import AnmeldungForm
from mailer import is_configured as mail_configured, send_registration_receipt
from tournament_logic import MAX_PARTICIPANTS

bp = Blueprint("anmeldung", __name__)


@bp.route("/anmeldung", methods=["GET", "POST"])
def anmeldung():
    form = AnmeldungForm()

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
            return render_template("anmeldung.html", form=form)

        n_participants = db.execute("SELECT COUNT(*) FROM participants").fetchone()[0]
        waitlisted = n_participants >= MAX_PARTICIPANTS

        breakfast = form.breakfast.data == "ja"
        anmeldung_id = create_anmeldung(
            db,
            name=form.name.data.strip(),
            email=email,
            verein=form.verein.data.strip(),
            age=form.age.data,
            gender=form.gender.data,
            league=form.league.data,
            midnight_meal=form.midnight_meal.data == "ja",
            breakfast=breakfast,
            breakfast_type=form.breakfast_type.data if breakfast else None,
        )
        if not waitlisted:
            confirm_anmeldung(db, anmeldung_id, gender=form.gender.data, league=form.league.data)

        send_registration_receipt(
            name=form.name.data.strip(),
            email=email,
            age=form.age.data,
            verein=form.verein.data.strip(),
            league=form.league.data,
            midnight_meal=form.midnight_meal.data == "ja",
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

    return render_template("anmeldung.html", form=form)
