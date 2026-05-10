"""Public Anmeldungs-Formular: ein Eintrag landet als 'pending' in der DB."""
from flask import Blueprint, render_template, redirect, url_for, flash

from database import get_db
from db_state import create_anmeldung
from forms.public_forms import AnmeldungForm

bp = Blueprint("anmeldung", __name__)


@bp.route("/anmeldung", methods=["GET", "POST"])
def anmeldung():
    form = AnmeldungForm()

    if form.validate_on_submit():
        create_anmeldung(
            get_db(),
            name=form.name.data.strip(),
            email=form.email.data.strip().lower(),
            verein=(form.verein.data or "").strip() or None,
        )
        flash("Deine Anmeldung ist eingegangen!", "success")
        return redirect(url_for("anmeldung.anmeldung"))

    return render_template("anmeldung.html", form=form)
