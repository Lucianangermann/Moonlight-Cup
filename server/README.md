# Moonlight Cup Server

Flask + SQLite Turniermanager — gehostet auf einem Raspberry Pi 5, öffentlich erreichbar via Cloudflare Tunnel unter **https://moonlightcup.lucianangermann.com**.

Seit dem Umbau auf die React/Expo-Web-App als "eigentliches Programm" hat dieser Server zwei Aufgaben:
1. **Anmeldeformular** (`/anmeldung`, Jinja-Template) — der einzige klassische HTML-Bereich.
2. **JSON-API** (`/api/*`) + **Ausliefern der Expo-Web-App** (`/`, alles andere) — die React-App unter `../src/`/`../App.js` läuft hier als Single-Page-App und ist das eigentliche Turnier-Management-Tool (Admin: volle Kontrolle; alle anderen: nur Ergebnisse/Rangliste/Timer lesend).

## Architektur in 30 Sekunden

```
            ┌──────────────────┐
Internet ──▶│ Cloudflare Edge  │── HTTPS terminiert hier
            └────────┬─────────┘
                     │ Cloudflare Tunnel (cloudflared)
                     ▼
            ┌──────────────────────────────────────┐
            │ Raspberry Pi 5                        │
            │  systemd ──▶ Gunicorn (127.0.0.1:5000) │
            │              │                         │
            │              ├─▶ "/"        → server/webapp/ (Expo-Web-Build, SPA)
            │              ├─▶ "/anmeldung" → Jinja-Template
            │              ├─▶ "/api/*"    → JSON-API (session-cookie-basierter Admin-Login)
            │              └─▶ SQLite (WAL mode)
            └──────────────────────────────────────┘
```

- **Kein Port-Forwarding** am Router. Der Pi ist nicht direkt aus dem Internet erreichbar.
- **HTTPS** wird komplett von Cloudflare übernommen.
- **Gunicorn** lauscht nur auf 127.0.0.1 — kein Public-Listener auf dem Pi.
- **Kein CORS nötig**: Die Expo-Web-App wird vom selben Flask-Prozess/derselben Origin ausgeliefert wie die API — Admin-Login läuft über dasselbe Session-Cookie (SameSite=Strict).

## Inhaltsverzeichnis

1. [Lokale Entwicklung](#1-lokale-entwicklung)
2. [Pi 5 vorbereiten](#2-raspberry-pi-5-vorbereiten)
3. [App auf den Pi kopieren](#3-app-auf-den-pi-kopieren)
4. [.env konfigurieren](#4-env-konfigurieren)
5. [systemd-Service einrichten](#5-systemd-service-einrichten)
6. [Cloudflare Tunnel](#6-cloudflare-tunnel)
7. [Firewall (ufw)](#7-firewall-ufw)
8. [Web-App (RN-Frontend) deployen](#8-web-app-rn-frontend-deployen)
9. [Updates ausrollen](#9-updates-ausrollen)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Lokale Entwicklung

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# .env aus Vorlage kopieren
cp .env.example .env

# Secrets generieren
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "from flask_bcrypt import Bcrypt; print('ADMIN_PASSWORD_HASH=' + Bcrypt().generate_password_hash('DEIN_PW').decode())"

# Werte in .env eintragen, dann DB initialisieren
python database.py

# Server starten (Dev-Modus)
python app.py
# → http://127.0.0.1:5000
```

Solange `server/webapp/` noch nicht befüllt ist (siehe [Abschnitt 8](#8-web-app-rn-frontend-deployen)), liefert `/` einen 503-Platzhaltertext statt der App — `/anmeldung` und `/api/*` funktionieren trotzdem sofort.

Login (in der Web-App über das Schloss-Icon): `ADMIN_USERNAME` aus `.env`, Passwort = das, das du vorher gehasht hast.

Algorithmus- und DB-Tests:

```bash
python test_logic.py
python test_db_state.py
```

---

## 2. Raspberry Pi 5 vorbereiten

Voraussetzung: Pi mit **Raspberry Pi OS Lite (64-bit)**, SSH aktiviert.

```bash
ssh pi@<PI-IP>

sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git

python3 --version    # sollte 3.11+ sein
```

---

## 3. App auf den Pi kopieren

Eine der folgenden Optionen. Der tatsächliche Pfad auf dem Pi ist `/home/pi/Moonlight-Cup` (Großschreibung, entspricht dem Repo-Namen).

### Variante A — über Git (empfohlen für laufende Updates)

```bash
cd /home/pi
git clone https://github.com/Lucianangermann/Moonlight-Cup.git Moonlight-Cup
cd Moonlight-Cup/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Variante B — über `scp`

Vom Mac aus:

```bash
rsync -av --exclude venv --exclude '*.db*' --exclude __pycache__ --exclude webapp \
  /pfad/zu/MoonlightCup/server/ pi@<PI-IP>:/home/pi/Moonlight-Cup/server/
```

Dann auf dem Pi:

```bash
cd /home/pi/Moonlight-Cup/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 4. `.env` konfigurieren

```bash
cd /home/pi/Moonlight-Cup/server
cp .env.example .env

# Secrets generieren — niemals zweimal denselben Hash verwenden
SK=$(python -c "import secrets; print(secrets.token_hex(32))")
PW_HASH=$(python -c "from flask_bcrypt import Bcrypt; print(Bcrypt().generate_password_hash('DEIN_STARKES_PASSWORT').decode())")

# .env bearbeiten — Werte einfügen
nano .env
```

`.env` muss enthalten:

```
SECRET_KEY=<64 hex chars>
DATABASE_PATH=moonlight_cup.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$...
PORT=5000
```

DB initialisieren:

```bash
python database.py
```

Smoke-Test (nur lokal auf dem Pi):

```bash
./venv/bin/gunicorn --workers 2 --bind 127.0.0.1:5000 app:app
# in einem anderen Terminal: curl http://127.0.0.1:5000/anmeldung  → sollte 200 zurückgeben
```

`Ctrl+C` und weiter mit systemd.

---

## 5. systemd-Service einrichten

Der Service heißt `moonlightcup` (ohne Bindestrich).

```bash
sudo cp /home/pi/Moonlight-Cup/server/moonlightcup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable moonlightcup
sudo systemctl start moonlightcup
sudo systemctl status moonlightcup
```

Logs live verfolgen:

```bash
sudo journalctl -u moonlightcup -f
```

Bei Code-Änderungen einfach neu starten:

```bash
sudo systemctl restart moonlightcup
```

---

## 6. Cloudflare Tunnel

> Vorbedingung: `lucianangermann.com` ist bereits registriert. Falls die Domain noch nicht über Cloudflare DNS läuft, zuerst die Domain als Site zu Cloudflare hinzufügen und die Nameserver beim Registrar umstellen — sonst schlägt `tunnel route dns` fehl.

### 6.1 `cloudflared` installieren

```bash
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### 6.2 Bei Cloudflare einloggen

```bash
cloudflared tunnel login
```

Öffnet einen Browser-Link. Auf einem Headless-Pi: URL kopieren, im Browser einer anderen Maschine öffnen, mit deinem Cloudflare-Account einloggen, `lucianangermann.com` autorisieren. Der Pi schreibt dann `~/.cloudflared/cert.pem`.

### 6.3 Tunnel anlegen

```bash
cloudflared tunnel create moonlight-cup
# → "Created tunnel moonlight-cup with id <UUID>"
# → "/home/pi/.cloudflared/<UUID>.json" wurde geschrieben
```

Die UUID merken (oder gleich kopieren).

### 6.4 Config-Datei einrichten

```bash
cp /home/pi/Moonlight-Cup/server/cloudflared-config.yml.example /home/pi/.cloudflared/config.yml
nano /home/pi/.cloudflared/config.yml
```

`REPLACE_WITH_TUNNEL_ID` durch die UUID aus 6.3 ersetzen. Inhalt sollte so aussehen:

```yaml
tunnel: moonlight-cup
credentials-file: /home/pi/.cloudflared/abc123-...-def.json

ingress:
  - hostname: moonlightcup.lucianangermann.com
    service: http://127.0.0.1:5000
  - service: http_status:404
```

### 6.5 DNS-Record anlegen

```bash
cloudflared tunnel route dns moonlight-cup moonlightcup.lucianangermann.com
```

Cloudflare legt automatisch einen CNAME-Record `moonlightcup → <UUID>.cfargotunnel.com` an.

### 6.6 Als systemd-Service installieren

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

Logs:

```bash
sudo journalctl -u cloudflared -f
```

### 6.7 Erste Anfrage testen

Vom Laptop:

```bash
curl -I https://moonlightcup.lucianangermann.com/anmeldung
# → HTTP/2 200
```

Im Browser: <https://moonlightcup.lucianangermann.com> → die Turnier-App (sobald `server/webapp/` deployed ist, siehe Abschnitt 8).
Anmeldung: <https://moonlightcup.lucianangermann.com/anmeldung>.
Admin-Login läuft **innerhalb der App** über das Schloss-Icon, nicht über eine eigene `/login`-Seite.

---

## 7. Firewall (ufw)

Cloudflare Tunnel öffnet ausgehende Verbindungen — kein Inbound nötig. Wir lassen nur SSH zu:

```bash
sudo apt install -y ufw
sudo ufw allow ssh
sudo ufw enable
sudo ufw status verbose
```

Ports 80/443 bleiben **geschlossen** — Cloudflare braucht sie nicht.

---

## 8. Web-App (RN-Frontend) deployen

Die React/Expo-App (`../src/`, `../App.js`) wird als statischer Web-Export gebaut und von Flask unter `server/webapp/` ausgeliefert (siehe `blueprints/webapp.py`). Es gibt dafür **keine automatische CI/CD-Pipeline** (bewusst — ein GitHub-Actions-Runner auf dem Pi wäre unverhältnismäßiger Aufwand für ein Ein-Personen-Jahresevent-Tool); stattdessen ein manueller Build+Rsync-Schritt, analog zum restlichen Deployment:

```bash
# Auf deinem Mac, im Repo-Root (nicht in server/)
npx expo export --platform web --clear

# Build auf den Pi kopieren
rsync -av --delete dist/ pi@<PI-IP>:/home/pi/Moonlight-Cup/server/webapp/

# Service neu starten, damit Flask den neuen Build ausliefert
ssh pi@<PI-IP> 'sudo systemctl restart moonlightcup'
```

`--delete` auf dem rsync-Ziel verhindert, dass alte, gehashte JS-Bundle-Dateien aus vorherigen Builds sich ansammeln. `server/webapp/` ist gitignored — sie lebt nur auf dem Pi (und lokal, falls du sie zum Testen dorthin kopierst).

**Wann neu deployen?** Nach jeder Änderung an `src/`, `App.js` oder `app.json`. Änderungen an `server/` (Backend) brauchen dagegen nur `git pull` + `systemctl restart` (Abschnitt 9) — kein neuer Web-Build nötig.

---

## 9. Updates ausrollen

```bash
ssh pi@<PI-IP>
cd /home/pi/Moonlight-Cup
git pull
cd server
source venv/bin/activate
pip install -r requirements.txt    # nur wenn requirements.txt sich geändert hat
sudo systemctl restart moonlightcup
sudo journalctl -u moonlightcup -f
```

Bei Schema-Migrationen einfach `python database.py` zwischen `git pull` und `restart` laufen lassen — `init_db()` ist idempotent (`IF NOT EXISTS`).

Falls sich `src/`/`App.js` geändert haben, zusätzlich Abschnitt 8 (Web-App neu bauen + rsyncen) durchführen.

---

## 10. Troubleshooting

### App startet nicht

```bash
sudo systemctl status moonlightcup
sudo journalctl -u moonlightcup -n 50 --no-pager
```

Häufige Ursachen:
- `.env` fehlt oder `ADMIN_PASSWORD_HASH` ist nicht gesetzt
- Falscher Pfad in `WorkingDirectory=` (überprüfe `.service` File)
- DB-Datei nicht beschreibbar: `ls -l server/moonlight_cup.db`

### `/` zeigt nur einen 503-Text

`server/webapp/` ist leer oder fehlt — die Web-App wurde noch nicht deployed. Siehe Abschnitt 8.

### 502 Bad Gateway über Cloudflare

Die App ist down. Prüfe `sudo systemctl status moonlightcup` und Logs.

### Tunnel verbindet sich nicht

```bash
sudo journalctl -u cloudflared -n 50 --no-pager
```

Häufig: `cert.pem` fehlt (→ erneut `cloudflared tunnel login`) oder die Tunnel-UUID in `config.yml` stimmt nicht mit der `.json`-Credentials-Datei überein.

### Login schlägt mit „falsch" fehl, obwohl PW richtig

Die `.env` wurde nicht neu geladen. Nach Änderung: `sudo systemctl restart moonlightcup`.

### Rate-Limit greift bei lokaler Tests

Nach 5 fehlgeschlagenen Logins / 15 Minuten / IP wird geblockt (`POST /api/login`). Den Limiter-Speicher leerst du mit Service-Neustart (`memory://` ist prozesslokal).

### DB versehentlich beschädigt

Backup wiederherstellen oder bei leerer DB einfach löschen:

```bash
sudo systemctl stop moonlightcup
rm /home/pi/Moonlight-Cup/server/moonlight_cup.db*
cd /home/pi/Moonlight-Cup/server
./venv/bin/python database.py
sudo systemctl start moonlightcup
```

### Backup

WAL-Mode ist aktiv → einfach kopieren reicht **nicht**. Korrekt:

```bash
sqlite3 /home/pi/Moonlight-Cup/server/moonlight_cup.db ".backup '/home/pi/backups/mc-$(date +%F).db'"
```

In Cron für tägliches Backup:

```cron
0 3 * * * sqlite3 /home/pi/Moonlight-Cup/server/moonlight_cup.db ".backup '/home/pi/backups/mc-$(date +\%F).db'"
```

---

## Routenübersicht

| Pfad                          | Auth  | Zweck                                              |
|--------------------------------|-------|-----------------------------------------------------|
| `/`, alle sonstigen Pfade      | —     | Expo-Web-App (SPA, `server/webapp/`) — Ergebnisse/Rangliste/Timer für alle, Runde/Teilnehmer nur für eingeloggten Admin |
| `/anmeldung`                   | —     | Öffentliches Anmeldeformular (Jinja)                |
| `/api/tournament`              | —     | Teilnehmer, Runden, Rangliste (JSON, gepollt)        |
| `/api/timer`                   | —     | Aktueller Timer-Status (JSON, gepollt)               |
| `/api/session`                 | —     | Prüft ob eine Admin-Session aktiv ist                |
| `/api/login`, `/api/logout`    | —     | Admin-Login/-Logout (rate-limited)                   |
| `/api/anmeldungen*`            | Admin | Anmeldungen einsehen/bestätigen/ablehnen             |
| `/api/participants*`           | Admin | Teilnehmer anlegen/bearbeiten/entfernen/pausieren    |
| `/api/rounds*`, `/api/matches*`| Admin | Runde starten/Finale/Ergebnis erfassen/Spieler tauschen |
| `/api/standings/<id>/adjustment`| Admin| Stat-Adjustments                                    |
| `/api/timer` (POST/DELETE)     | Admin | Timer setzen/deaktivieren/löschen                    |
| `/api/tournament/reset`        | Admin | Turnier zurücksetzen                                |

## Sicherheitsentscheidungen

- **Bcrypt** mit 12 Rounds für das Admin-Passwort.
- **Session-Cookies**: HttpOnly, Secure, SameSite=Strict, 24h Laufzeit — dasselbe Cookie authentifiziert sowohl die Web-App als auch die API (same-origin, kein Token-Schema nötig).
- **CSRF**: `/anmeldung` läuft über Flask-WTF (Formular-Token). `/api/*` und `/api/login`/`/api/logout` sind CSRF-exempt (wie schon das ursprüngliche `/api/timer`) — die praktische CSRF-Absicherung dafür ist `SameSite=Strict`, da ein nativer/JS-Fetch-Client kein Formular-Token mitschicken kann.
- **CSP**: strikt gesetzt, nur eigene Origin + Google Fonts + Spotify (Timer-Screen, optional) erlaubt.
- **Rate-Limit**: 5 Login-Versuche / 15 Minuten / IP auf `/api/login`.
- **Talisman**: HSTS, X-Content-Type-Options, X-Frame-Options=DENY.
- **`force_https=False`**: Cloudflare terminiert TLS und leitet HTTP weiter — Talisman trotzdem für HSTS-Header.
- **Gunicorn bind 127.0.0.1**: Pi ist niemals direkt im Internet exponiert.
