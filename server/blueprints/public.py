"""
Public, no-login routes: index (with countdown), Rangliste, Ergebnisse, Spielplan.
Filled in during Phase 3.
"""
from flask import Blueprint, render_template

bp = Blueprint("public", __name__)


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/rangliste")
def rangliste():
    return render_template("rangliste.html", groups=[], standings=[])


@bp.route("/ergebnisse")
def ergebnisse():
    return render_template("ergebnisse.html", rounds=[])


@bp.route("/spielplan")
def spielplan():
    return render_template("spielplan.html", rounds=[])
