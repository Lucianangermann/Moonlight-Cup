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


def _esc(value) -> str:
    """Minimal HTML-escape for values interpolated into the receipt HTML —
    registration fields (name, verein) are free text an admin/user can set,
    see the same concern in src/utils/html.js for the RN print builders."""
    return (
        str(value)
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace('"', "&quot;").replace("'", "&#39;")
    )


def _build_html(*, display_name: str, name: str, age: int, verein: str, league_label: str,
                 midnight_meal_line: str, breakfast_line: str, waitlisted: bool,
                 status_text: str, closing: str) -> str:
    """Inline-styled, table-based HTML for broad email-client support (no
    external fonts/images/CSS — keeps the spam score low and renders
    consistently in Outlook/Gmail/iOS Mail alike)."""
    badge_bg, badge_fg, badge_text = (
        ("#3A2E0A", "#F0C040", "AUF DER WARTELISTE") if waitlisted
        else ("#0B3A2E", "#00C896", "ANGEMELDET")
    )
    rows = "".join(f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #1C2A44;color:#7E8DB0;font-size:13px;font-family:Arial,Helvetica,sans-serif;width:40%;">{label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #1C2A44;color:#EEF2FF;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">{value}</td>
        </tr>""" for label, value in [
        ("Name", _esc(name)), ("Alter", _esc(age)), ("Verein", _esc(verein)),
        ("Liga", _esc(league_label)),
        ("Mitternachtsessen", _esc(midnight_meal_line)),
        ("Frühstück", _esc(breakfast_line)),
    ])
    return f"""\
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background-color:#f2f3f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background-color:#0B1020;border-radius:16px;overflow:hidden;border:1px solid #1C2A44;">
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;">
        <div style="color:#F0C040;font-size:28px;line-height:1;">☽</div>
        <div style="color:#EEF2FF;font-size:20px;font-weight:800;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;margin-top:8px;">MOONLIGHT CUP</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr><td style="background-color:{badge_bg};color:{badge_fg};font-size:11px;font-weight:800;letter-spacing:1px;padding:6px 14px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;">{badge_text}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 4px;color:#EEF2FF;font-size:15px;font-family:Arial,Helvetica,sans-serif;">
        Hallo {_esc(display_name)},
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 24px;color:#C8D4E8;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        {status_text}
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px 8px;text-align:center;">
        <a href="https://moonlightcup.lucianangermann.com" style="display:inline-block;background-color:#F0C040;color:#060912;font-size:13px;font-weight:800;letter-spacing:0.5px;text-decoration:none;padding:14px 28px;border-radius:12px;font-family:Arial,Helvetica,sans-serif;">SPIELPLAN &amp; ERGEBNISSE ANSEHEN</a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 32px;text-align:center;color:#7E8DB0;font-size:13px;font-family:Arial,Helvetica,sans-serif;">
        {closing}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;border-top:1px solid #1C2A44;text-align:center;color:#4A5578;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
        ☽ Moonlight Cup · <a href="https://moonlightcup.lucianangermann.com/datenschutz" style="color:#4A5578;">Datenschutz</a>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def build_receipt(*, name: str, email: str, age: int, verein: str, league: str,
                  midnight_meal: bool, midnight_meal_type: str | None, breakfast: bool,
                  breakfast_type: str | None, waitlisted: bool = False) -> EmailMessage:
    """Pure message assembly — unit-testable without an SMTP server. Builds
    a multipart/alternative message (plain text + HTML) so clients that
    can't/won't render HTML still get a readable fallback."""
    parts = name.split(",")
    display_name = f"{parts[1].strip()} {parts[0].strip()}" if len(parts) > 1 else name.strip()
    league_label = _LEAGUE_LABELS.get(league, league)

    midnight_meal_line = "Nein"
    if midnight_meal:
        art = "Vegetarisch" if midnight_meal_type == "vegetarisch" else "Nicht vegetarisch"
        midnight_meal_line = f"Ja ({art})"

    breakfast_line = "Nein"
    if breakfast:
        art = "Weißwurscht" if breakfast_type == "weisswurscht" else "Vegetarisch"
        breakfast_line = f"Ja ({art})"

    if waitlisted:
        subject = "Deine Anmeldung zum Moonlight Cup — Warteliste"
        status_text = (
            "die Teilnehmerliste ist bereits voll — du stehst auf der "
            "Warteliste. Sobald ein Platz frei wird, melden wir uns bei dir!"
        )
        closing = "Drück uns die Daumen — vielleicht klappt's noch! 🏸"
    else:
        subject = "Deine Anmeldung zum Moonlight Cup"
        status_text = (
            "deine Anmeldung zum Moonlight Cup ist eingegangen — du stehst "
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
  Liga:              {league_label}
  Mitternachtsessen: {midnight_meal_line}
  Frühstück:         {breakfast_line}

Am Turnierabend läuft alles live — Spielplan, Ergebnisse und Rangliste:
https://moonlightcup.lucianangermann.com

{closing}

☽ Moonlight Cup
"""
    )
    msg.add_alternative(
        _build_html(
            display_name=display_name, name=name, age=age, verein=verein,
            league_label=league_label, midnight_meal_line=midnight_meal_line,
            breakfast_line=breakfast_line, waitlisted=waitlisted,
            status_text=status_text, closing=closing,
        ),
        subtype="html",
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
