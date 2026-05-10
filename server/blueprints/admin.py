"""Admin area. All routes guarded by login_required. Phase 4 fills these in."""
from flask import Blueprint, render_template

from blueprints.auth import login_required

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/")
@login_required
def dashboard():
    return render_template("admin/dashboard.html")


@bp.route("/teilnehmer")
@login_required
def teilnehmer():
    return render_template("admin/teilnehmer.html")


@bp.route("/spielplan")
@login_required
def spielplan():
    return render_template("admin/spielplan.html")


@bp.route("/ergebnisse")
@login_required
def ergebnisse():
    return render_template("admin/ergebnisse.html")


@bp.route("/rangliste")
@login_required
def rangliste():
    return render_template("admin/rangliste.html")


@bp.route("/timer")
@login_required
def timer():
    return render_template("admin/timer.html")
