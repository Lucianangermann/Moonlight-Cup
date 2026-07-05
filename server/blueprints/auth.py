"""
Admin-only authentication.

There is exactly one admin account; credentials live in `.env` as the
username and a bcrypt hash. We compare the submitted password against the
hash with `bcrypt.check_password_hash` (constant-time).

Login is rate-limited per-IP to make brute-force impractical even if
the password were weakened.

Session-cookie based (SameSite=Strict, HttpOnly, Secure — see config.py),
consumed by the React/Expo web app served from blueprints/webapp.py. Same
origin, so no CORS/token scheme is needed — see server/README.md.
"""
from functools import wraps

from flask import Blueprint, jsonify, request, session, current_app

bp = Blueprint("auth", __name__, url_prefix="/api")


def login_required(view):
    """Returns 401 JSON if the session isn't authenticated."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "unauthorized"}), 401
        return view(*args, **kwargs)
    return wrapper


@bp.route("/login", methods=["POST"])
def login():
    # The limiter decorator is attached dynamically in app.create_app() so
    # we don't import the Limiter instance here (avoids circular imports).
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))

    bcrypt = current_app.extensions["bcrypt"]
    admin_username = current_app.config["ADMIN_USERNAME"].strip().lower()
    admin_hash = current_app.config["ADMIN_PASSWORD_HASH"]

    # Always run the bcrypt check, even if the username doesn't match,
    # to avoid timing leaks of "valid username but wrong pw".
    try:
        password_ok = bcrypt.check_password_hash(admin_hash, password) if admin_hash else False
    except ValueError:
        # Malformed ADMIN_PASSWORD_HASH in .env — fail as 401, not 500.
        password_ok = False
    username_ok = username == admin_username and bool(admin_username)

    if username_ok and password_ok:
        session.clear()
        session["is_admin"] = True
        session.permanent = True  # respects PERMANENT_SESSION_LIFETIME
        return jsonify({"isAdmin": True})

    return jsonify({"error": "Benutzername oder Passwort ist falsch."}), 401


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({})


@bp.route("/session", methods=["GET"])
def session_status():
    return jsonify({"isAdmin": bool(session.get("is_admin"))})
