"""
Flask app factory.

Boot order matters here:
  1. Load Config (which loaded .env at import time).
  2. Wire up Bcrypt, Limiter, Talisman, CSRF.
  3. Register teardown to close per-request DB connections.
  4. Register blueprints.

Everything is created inside `create_app()` so tests/CLI can spin up
isolated instances without polluting module-level state.
"""
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from flask_wtf.csrf import CSRFProtect

from config import Config
from database import close_db


# CSP: allow same-origin assets + Google Fonts (Cinzel/Rajdhani via @font-face).
# 'unsafe-inline' for styles is unfortunate but Google Fonts CSS uses inline
# directives; alternative is to vendor the fonts (TODO if hardening required).
CSP = {
    "default-src": "'self'",
    "script-src": "'self'",
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:"],
    "connect-src": "'self'",
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
}


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(Config)

    # --- Extensions ---
    bcrypt = Bcrypt(app)
    app.extensions["bcrypt"] = bcrypt

    csrf = CSRFProtect(app)

    # Cloudflare Tunnel terminates TLS, so force_https=False is correct here.
    # Talisman still adds HSTS/X-Content-Type-Options/etc.
    Talisman(
        app,
        force_https=False,
        strict_transport_security=True,
        strict_transport_security_max_age=31536000,
        content_security_policy=CSP,
        content_security_policy_nonce_in=["script-src"],
        referrer_policy="strict-origin-when-cross-origin",
        frame_options="DENY",
    )

    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[],  # no global limit; we apply per-route below
        storage_uri="memory://",
    )

    # --- Per-request DB teardown ---
    app.teardown_appcontext(close_db)

    # --- Blueprints ---
    from blueprints import auth as auth_bp
    from blueprints import public as public_bp
    from blueprints import anmeldung as anmeldung_bp
    from blueprints import admin as admin_bp
    from blueprints import api as api_bp

    app.register_blueprint(auth_bp.bp)
    app.register_blueprint(public_bp.bp)
    app.register_blueprint(anmeldung_bp.bp)
    app.register_blueprint(admin_bp.bp)
    # /api/timer is public, but it's read-only and served as JSON — exempt CSRF.
    csrf.exempt(api_bp.bp)
    app.register_blueprint(api_bp.bp)

    # Wrap the login view with a rate-limit (5 attempts / 15 min / IP).
    # Done after registration so the endpoint exists in app.view_functions.
    app.view_functions["auth.login"] = limiter.limit("5 per 15 minutes")(
        app.view_functions["auth.login"]
    )

    return app


app = create_app()


if __name__ == "__main__":
    # Dev only: production uses gunicorn behind systemd (see README).
    app.run(host="127.0.0.1", port=Config.PORT, debug=True)
