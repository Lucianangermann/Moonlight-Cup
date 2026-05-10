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

## Phase 2 — Tournament-Logik in Python portieren
- [ ] `tournament_logic.py` mit folgenden Funktionen 1:1 zur RN-Implementierung:
  - [ ] `compute_standings()` (statAdjustments, paused players in standings)
  - [ ] `start_new_round()` (hadFreilos-Set, Schnellrunde-Heuristik, normale Runde)
  - [ ] `start_schnellrunde()`
  - [ ] `start_final_runde()` (Vollmond/Halbmond/Neumond, fixe 33er)
  - [ ] Field-Allocation mit D2-Bevorzugung (`d2Count = ceil(matches/2)`)
  - [ ] `pause_participant()` / `reactivate_participant()`
  - [ ] `set_stat_adjustment()` mit Validierung wins ≤ games
- [ ] DB-Schema erweitern: `participants`, `paused_participants`, `rounds`, `matches`, `stat_adjustments`, `anmeldungen`, `timer`

## Phase 3 — Public Pages
- [ ] `templates/index.html` (Startseite mit Live-Countdown)
- [ ] `templates/rangliste.html` (Vollmond/Halbmond/Neumond Anzeige + Drucken)
- [ ] `templates/ergebnisse.html` (Runden-Übersicht)
- [ ] `templates/spielplan.html` (Aktuelle Runde + Historie)
- [ ] `templates/anmeldung.html` (Public Form)
- [ ] `blueprints/public.py` (Routes)
- [ ] `blueprints/anmeldung.py` (POST-Handler)
- [ ] `blueprints/api.py` (GET /api/timer)

## Phase 4 — Admin-Bereich
- [ ] `templates/admin/dashboard.html`
- [ ] `templates/admin/teilnehmer.html` (Anmeldungen bestätigen, Spieler verwalten)
- [ ] `templates/admin/spielplan.html` (Runde starten, Schnellrunde, Finale)
- [ ] `templates/admin/ergebnisse.html` (Ergebnisse eintragen)
- [ ] `templates/admin/rangliste.html` (Stat-Adjustments, Recompute)
- [ ] `templates/admin/timer.html` (Timer setzen/aktivieren/löschen)
- [ ] `forms/admin_forms.py` (alle Admin-Formulare)
- [ ] `blueprints/admin.py` (alle Admin-Routes mit Auth-Decorator)

## Phase 5 — Deployment
- [ ] `README.md` mit Pi-5-Setup, systemd-Service, cloudflared-Setup
- [ ] `moonlight-cup.service` (systemd-Unit)
- [ ] `cloudflared-config.yml.example`

## Review-Notizen
_Wird nach Abschluss gefüllt._
