"""
Registration receipt mails.

Provider-agnostic SMTP (STARTTLS) configured entirely via .env — designed
for iCloud Mail (smtp.mail.me.com + app-specific password, via a custom
e-mail domain on lucianangermann.com) but any STARTTLS SMTP works. If
MAIL_HOST is unset the feature is off and send_registration_receipt() is a
silent no-op, so the registration flow never depends on mail being configured.

Sending happens on a daemon thread: the submitter gets their redirect
immediately, and an SMTP hiccup can never fail a registration.
"""
from __future__ import annotations

import logging
import smtplib
import threading
from email.message import EmailMessage

from config import Config
from tournament_logic import LEAGUES

log = logging.getLogger(__name__)

_LEAGUE_LABELS = dict(LEAGUES)


def is_configured() -> bool:
    return bool(Config.MAIL_HOST and Config.MAIL_USERNAME and Config.MAIL_PASSWORD and Config.MAIL_FROM)


def build_receipt(*, name: str, email: str, age: int, verein: str, league: str,
                  midnight_meal: bool, breakfast: bool,
                  breakfast_type: str | None, waitlisted: bool = False) -> EmailMessage:
    """Pure message assembly — unit-testable without an SMTP server."""
    parts = name.split(",")
    display_name = f"{parts[1].strip()} {parts[0].strip()}" if len(parts) > 1 else name.strip()

    breakfast_line = "Nein"
    if breakfast:
        art = "Weißwurscht" if breakfast_type == "weisswurscht" else "Vegetarisch"
        breakfast_line = f"Ja ({art})"

    if waitlisted:
        subject = "Deine Anmeldung zum Moonlight Cup — Warteliste"
        status_text = (
            "die Teilnehmerliste ist bereits voll — du stehst auf der\n"
            "Warteliste. Sobald ein Platz frei wird, melden wir uns bei dir!"
        )
        closing = "Drück uns die Daumen — vielleicht klappt's noch! 🏸"
    else:
        subject = "Deine Anmeldung zum Moonlight Cup"
        status_text = (
            "deine Anmeldung zum Moonlight Cup ist eingegangen — du stehst\n"
            "ab sofort auf der Teilnehmerliste!"
        )
        closing = "Wir sehen uns auf dem Feld! 🏸"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = Config.MAIL_FROM
    msg["To"] = email
    msg.set_content(
        f"""Hallo {display_name},

{status_text}

Deine Angaben:
  Name:              {name}
  Alter:             {age}
  Verein:            {verein}
  Liga:              {_LEAGUE_LABELS.get(league, league)}
  Mitternachtsessen: {"Ja" if midnight_meal else "Nein"}
  Frühstück:         {breakfast_line}

Am Turnierabend läuft alles live — Spielplan, Ergebnisse und Rangliste:
https://moonlightcup.lucianangermann.com

{closing}

☽ Moonlight Cup
"""
    )
    return msg


def _send(msg: EmailMessage) -> None:
    try:
        with smtplib.SMTP(Config.MAIL_HOST, Config.MAIL_PORT, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            smtp.send_message(msg)
        log.info("registration receipt sent to %s", msg["To"])
    except Exception:
        # Receipt mail is best-effort; the registration itself already
        # succeeded. Log loudly enough to notice a misconfigured .env.
        log.exception("failed to send registration receipt to %s", msg["To"])


def send_registration_receipt(**kwargs) -> None:
    """Fire-and-forget. No-op when mail isn't configured."""
    if not is_configured():
        return
    msg = build_receipt(**kwargs)
    threading.Thread(target=_send, args=(msg,), daemon=True).start()
