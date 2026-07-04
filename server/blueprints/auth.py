"""
Admin-only authentication.

There is exactly one admin account; credentials live in `.env` as the
username and a bcrypt hash. We compare the submitted password against the
hash with `bcrypt.check_password_hash` (constant-time).

Login is rate-limited per-IP to make brute-force impractical even if
the password were weakened.
"""
from functools import wraps

from flask import (
    Blueprint, render_template, request, redirect, url_for, session, flash,
    current_app,
)

from forms.auth_forms import LoginForm

bp = Blueprint("auth", __name__)


def login_required(view):
    """Redirects to the login page if the session isn't authenticated."""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect(url_for("auth.login", next=request.path))
        return view(*args, **kwargs)
    return wrapper


@bp.route("/login", methods=["GET", "POST"])
def login():
    # The limiter decorator is attached dynamically in app.create_app() so
    # we don't import the Limiter instance here (avoids circular imports).
    form = LoginForm()

    if form.validate_on_submit():
        bcrypt = current_app.extensions["bcrypt"]
        username = form.username.data.strip().lower()
        password = form.password.data

        admin_username = current_app.config["ADMIN_USERNAME"].strip().lower()
        admin_hash = current_app.config["ADMIN_PASSWORD_HASH"]

        # Always run the bcrypt check, even if the username doesn't match,
        # to avoid timing leaks of "valid username but wrong pw".
        password_ok = bcrypt.check_password_hash(admin_hash, password) if admin_hash else False
        username_ok = username == admin_username and bool(admin_username)

        if username_ok and password_ok:
            session.clear()
            session["is_admin"] = True
            session.permanent = True  # respects PERMANENT_SESSION_LIFETIME
            next_url = request.args.get("next") or url_for("admin.dashboard")
            # Only allow redirects to relative paths (avoid open-redirect).
            if not next_url.startswith("/"):
                next_url = url_for("admin.dashboard")
            return redirect(next_url)

        flash("Benutzername oder Passwort ist falsch.", "error")

    return render_template("login.html", form=form)


@bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    flash("Erfolgreich abgemeldet.", "success")
    return redirect(url_for("public.index"))
