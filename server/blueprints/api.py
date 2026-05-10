"""
Public JSON API.

Currently exposes only the active timer so the index page can poll it
every 30s without re-rendering the whole template. This avoids any
cookie/session machinery on a hot path.
"""
from flask import Blueprint, jsonify

from database import get_db

bp = Blueprint("api", __name__, url_prefix="/api")


@bp.route("/timer", methods=["GET"])
def timer():
    db = get_db()
    row = db.execute(
        "SELECT label, target_time, is_active "
        "FROM timer WHERE is_active = 1 "
        "ORDER BY id DESC LIMIT 1"
    ).fetchone()

    if row is None:
        return jsonify({"label": None, "target_time": None, "is_active": False})

    return jsonify({
        "label": row["label"],
        "target_time": row["target_time"],  # ISO-8601 UTC, parsed client-side
        "is_active": bool(row["is_active"]),
    })
