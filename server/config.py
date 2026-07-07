"""
App configuration loaded from environment variables.

All secrets live in `.env` (loaded via python-dotenv). The values here
are mostly Flask/extension settings — the actual sensitive data is read
on demand by `app.create_app()`.
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Load .env once at import time. In production systemd passes the same
# env via the unit file, so this is a no-op there.
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


class Config:
    # --- Core ---
    SECRET_KEY = os.environ.get("SECRET_KEY", "")

    # --- Database ---
    # Resolved to an absolute path so it works under systemd (which sets cwd).
    _db_path = os.environ.get("DATABASE_PATH", "moonlight_cup.db")
    DATABASE_PATH = (
        _db_path if os.path.isabs(_db_path) else str(BASE_DIR / _db_path)
    )

    # --- Admin (only one) ---
    ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "")
    ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")

    # --- Sessions ---
    # Cookie hardening — Cloudflare Tunnel terminates TLS, so SECURE is fine.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Strict"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)

    # --- Forms / CSRF ---
    WTF_CSRF_TIME_LIMIT = None  # session-bound; expires with session

    # --- Server ---
    PORT = int(os.environ.get("PORT", "5000"))

    # --- Mail (registration receipts; feature is OFF while MAIL_HOST unset) ---
    # Designed for iCloud Mail (bergerhq.de custom domain): host
    # smtp.mail.me.com, port 587, username = Apple-ID, password = an
    # app-specific password, MAIL_FROM = an address on that iCloud account.
    MAIL_HOST = os.environ.get("MAIL_HOST", "")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "")

    # --- Privacy contact (shown on /datenschutz for Art. 15/17 requests) ---
    # Falls back to MAIL_FROM (the receipt sender) if unset, since that's
    # already a real, monitored address once mail is configured.
    PRIVACY_CONTACT_EMAIL = os.environ.get("PRIVACY_CONTACT_EMAIL", "")

    # --- Web app (Expo web export of the RN app, served at "/") ---
    # Populated by `npx expo export --platform web` + rsync to the Pi — see
    # server/README.md's deploy runbook. Gitignored; absent until first deploy.
    WEBAPP_DIR = BASE_DIR / "webapp"
