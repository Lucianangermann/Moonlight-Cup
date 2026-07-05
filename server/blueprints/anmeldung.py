"""
Public Anmeldungs-Formular.

Registrations are auto-confirmed: the submitter lands directly on the
participants list (visible in the app's Teilnehmer tab within one poll),
since the form now collects everything a participant row needs (gender,
league). The anmeldungen row is kept as the audit trail and carries the
meal answers the participant row doesn't need.
"""
from flask import Blueprint, render_template, redirect, url_for, flash

from database import get_db
from db_state import confirm_anmeldung, create_anmeldung
from forms.public_forms import AnmeldungForm

bp = Blueprint("anmeldung", __name__)

# Rangliste groups are fixed at 33 per moon group → 99 is the hard cap the
# whole tournament model assumes (same limit the admin UI enforces).
MAX_PARTICIPANTS = 99


@bp.route("/anmeldung", methods=["GET", "POST"])
def anmeldung():
    form = AnmeldungForm()

    if form.validate_on_submit():
        db = get_db()
        email = form.email.data.strip().lower()

        already = db.execute(
            "SELECT 1 FROM participants WHERE lower(email) = ?", (email,)
        ).fetchone()
        if already:
            flash("Mit dieser E-Mail-Adresse ist bereits jemand auf der Teilnehmerliste.", "error")
            return render_template("anmeldung.html", form=form)

        n_participants = db.execute("SELECT COUNT(*) FROM participants").fetchone()[0]
        if n_participants >= MAX_PARTICIPANTS:
            flash(f"Die Teilnehmerliste ist voll ({MAX_PARTICIPANTS} Plätze belegt).", "error")
            return render_template("anmeldung.html", form=form)

        breakfast = form.breakfast.data == "ja"
        anmeldung_id = create_anmeldung(
            db,
            name=form.name.data.strip(),
            email=email,
            verein=(form.verein.data or "").strip() or None,
            age=form.age.data,
            gender=form.gender.data,
            league=form.league.data,
            midnight_meal=form.midnight_meal.data == "ja",
            breakfast=breakfast,
            breakfast_type=form.breakfast_type.data if breakfast else None,
        )
        confirm_anmeldung(db, anmeldung_id, gender=form.gender.data, league=form.league.data)

        flash("Du bist angemeldet und stehst ab sofort auf der Teilnehmerliste!", "success")
        return redirect(url_for("anmeldung.anmeldung"))

    return render_template("anmeldung.html", form=form)
