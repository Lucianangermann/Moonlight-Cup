"""Public sign-up form. Phase 3 fills in the POST handler + DB insert."""
from flask import Blueprint, render_template

bp = Blueprint("anmeldung", __name__)


@bp.route("/anmeldung", methods=["GET", "POST"])
def anmeldung():
    return render_template("anmeldung.html")
