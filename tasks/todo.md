# Moonlight Cup → Flask Migration

Ziel: Vollständige Flask + SQLite Webanwendung auf Raspberry Pi 5, deployed via Cloudflare Tunnel.
Verhalten der Tournament-Logik bleibt 1:1 erhalten (Schnellrunde, Finale, Freilos-Eindeutigkeit, Vollmond/Halbmond/Neumond mit fixen 33ern, D2-Bevorzugung, Stat-Adjustments, Pause).

## Phase 1 — Projekt-Skeleton + Auth ✅ **VERIFIED**
- [x] Verzeichnisstruktur `server/`
- [x] `requirements.txt` (inkl. email-validator)
- [x] `.env.example` + `.gitignore`-Update
- [x] `config.py` (dotenv, Session-Config: HttpOnly+Secure+SameSite=Strict, 24h)
- [x] `database.py` (SQLite-Schema mit allen Tabellen, WAL-Mode, FK)
- [x] `app.py` (Flask, Blueprints, Talisman, Limiter, Bcrypt, CSRF)
- [x] `templates/base.html` mit Moonlight Dark Theme + Topbar
- [x] `static/css/style.css` mit Sternenfeld (3 Layer, prefers-reduced-motion)
- [x] `static/js/timer.js` (Countdown-Logik, 30s Polling)
- [x] `forms/auth_forms.py` (LoginForm)
- [x] `blueprints/auth.py` (Login/Logout, Rate-Limit, login_required)
- [x] `templates/login.html`
- [x] **Smoke-Test grün**: alle Routes 200/302, Login-Flow funktioniert

## Phase 2 — Tournament-Logik in Python portieren ✅ **VERIFIED**
- [x] `tournament_logic.py` mit reinen Funktionen 1:1 zur RN-Implementierung
- [x] `db_state.py` als SQLite ↔ TournamentState Bridge
- [x] DB-Schema mit `current_durchgang`, `email`, `verein` ergänzt
- [x] `test_logic.py` mit 9 Sanity-Tests — alle grün

## Phase 3 — Public Pages ✅ **VERIFIED**
- [x] `templates/rangliste.html` Vollmond/Halbmond/Neumond
- [x] `templates/ergebnisse.html` Runden-Übersicht
- [x] `templates/spielplan.html` Aktuelle Runde + Durchgang
- [x] `templates/anmeldung.html` Public Form
- [x] `blueprints/public.py`, `anmeldung.py`, `api.py` mit DB-Anbindung

## Phase 4 — Admin-Bereich ✅ **VERIFIED**
- [x] `templates/admin/dashboard.html` mit Live-Counts
- [x] `templates/admin/teilnehmer.html` Anmeldungen + Roster
- [x] `templates/admin/spielplan.html` Runde/Durchgang/Finale/Reset
- [x] `templates/admin/ergebnisse.html` Score-Eingabe
- [x] `templates/admin/rangliste.html` Stat-Adjustments
- [x] `templates/admin/timer.html` Timer-Verwaltung
- [x] `forms/admin_forms.py` mit allen Forms
- [x] **E2E-Test**: anmeldung→confirm→runde→public views→timer→logout

## Phase 5 — Deployment ✅
- [x] `README.md` mit Pi-5-Setup, systemd, cloudflared-Anleitung
- [x] `moonlight-cup.service` mit Hardening
- [x] `cloudflared-config.yml.example` für moonlightcup.lucianangermann.com

## Review-Notizen

**Status:** Alle 5 Phasen abgeschlossen und verifiziert.

**Verifikation:**
- 9/9 Algorithmus-Tests grün (`python test_logic.py`)
- E2E-Flow getestet: Anmeldung→Bestätigung→Teilnehmer→Runde→Public Views→Timer→Logout
- Alle 16 Routes registriert, Sessions/CSRF/Rate-Limit/Talisman aktiv

**Wichtige Designentscheidungen:**
- Pure functions in `tournament_logic.py` getrennt von DB-Layer in `db_state.py` — macht den Algorithmus-Port testbar.
- SQLite WAL-Mode → erlaubt Reader (z.B. `/api/timer` Polling) parallel zum Admin-Schreibzugriff.
- Anmeldungen-Tabelle bleibt nach `confirm` als Audit-Trail erhalten (status='confirmed' statt delete).
- `participant.id` wird bei manuellem Add aus `secrets.token_hex(6)`, bei Anmeldungs-Promotion aus `f"a{anmeldung_id}"` deterministisch generiert.
- Timer wird in UTC ISO gespeichert; Client-JS rendert in der Browser-Zeit des Betrachters.

**Noch offen / Ideen für später:**
- Automatischer DB-Backup-Cron (in README dokumentiert, aber nicht installiert).
- Print-Funktion für Rangliste (aktuell nur in der RN-App, nicht in Flask).
- Schnellrunde 1 → automatischer Timer-Trigger (in RN-App vorhanden, hier nicht).
