# Moonlight Cup Server

Flask + SQLite Turniermanager — gehostet auf einem Raspberry Pi 5, öffentlich erreichbar via Cloudflare Tunnel unter **https://moonlightcup.lucianangermann.com**.

> **Status:** Noch nicht live deployed — die folgende Anleitung beschreibt den vollständigen Setup-Prozess für den ersten Rollout auf den Pi.

## Architektur in 30 Sekunden

```
            ┌──────────────────┐
Internet ──▶│ Cloudflare Edge  │── HTTPS terminiert hier
            └────────┬─────────┘
                     │ Cloudflare Tunnel (cloudflared)
                     ▼
            ┌──────────────────┐
            │ Raspberry Pi 5   │
            │  systemd ──▶ Gunicorn (127.0.0.1:5000)
            │              ▼
            │           Flask App ──▶ SQLite (WAL mode)
            └──────────────────┘
```

- **Kein Port-Forwarding** am Router. Der Pi ist nicht direkt aus dem Internet erreichbar.
- **HTTPS** wird komplett von Cloudflare übernommen.
- **Gunicorn** lauscht nur auf 127.0.0.1 — kein Public-Listener auf dem Pi.

## Inhaltsverzeichnis

1. [Lokale Entwicklung](#1-lokale-entwicklung)
2. [Pi 5 vorbereiten](#2-raspberry-pi-5-vorbereiten)
3. [App auf den Pi kopieren](#3-app-auf-den-pi-kopieren)
4. [.env konfigurieren](#4-env-konfigurieren)
5. [systemd-Service einrichten](#5-systemd-service-einrichten)
6. [Cloudflare Tunnel](#6-cloudflare-tunnel)
7. [Firewall (ufw)](#7-firewall-ufw)
8. [Updates ausrollen](#8-updates-ausrollen)
9. [Troubleshooting](#9-troubleshooting)

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

Login: `ADMIN_EMAIL` aus `.env`, Passwort = das, das du vorher gehasht hast.

Algorithmus-Tests:

```bash
python test_logic.py
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

Eine der folgenden Optionen.

### Variante A — über Git (empfohlen für laufende Updates)

```bash
cd /home/pi
git clone https://github.com/Lucianangermann/Moonlight-Cup.git moonlight-cup
cd moonlight-cup/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Variante B — über `scp`

Vom Mac aus:

```bash
rsync -av --exclude venv --exclude '*.db*' --exclude __pycache__ \
  /pfad/zu/MoonlightCup/server/ pi@<PI-IP>:/home/pi/moonlight-cup/server/
```

Dann auf dem Pi:

```bash
cd /home/pi/moonlight-cup/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 4. `.env` konfigurieren

```bash
cd /home/pi/moonlight-cup/server
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
ADMIN_EMAIL=admin@example.com
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
# in einem anderen Terminal: curl http://127.0.0.1:5000/  → sollte 200 zurückgeben
```

`Ctrl+C` und weiter mit systemd.

---

## 5. systemd-Service einrichten

```bash
sudo cp /home/pi/moonlight-cup/server/moonlight-cup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable moonlight-cup
sudo systemctl start moonlight-cup
sudo systemctl status moonlight-cup
```

Logs live verfolgen:

```bash
sudo journalctl -u moonlight-cup -f
```

Bei Code-Änderungen einfach neu starten:

```bash
sudo systemctl restart moonlight-cup
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
cp /home/pi/moonlight-cup/server/cloudflared-config.yml.example /home/pi/.cloudflared/config.yml
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
curl -I https://moonlightcup.lucianangermann.com/
# → HTTP/2 200
```

Im Browser: <https://moonlightcup.lucianangermann.com> → Startseite mit Countdown.
Admin-Login: <https://moonlightcup.lucianangermann.com/login>.

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

## 8. Updates ausrollen

```bash
ssh pi@<PI-IP>
cd /home/pi/moonlight-cup
git pull
cd server
source venv/bin/activate
pip install -r requirements.txt    # nur wenn requirements.txt sich geändert hat
sudo systemctl restart moonlight-cup
sudo journalctl -u moonlight-cup -f
```

Bei Schema-Migrationen einfach `python database.py` zwischen `git pull` und `restart` laufen lassen — `init_db()` ist idempotent (`IF NOT EXISTS`).

---

## 9. Troubleshooting

### App startet nicht

```bash
sudo systemctl status moonlight-cup
sudo journalctl -u moonlight-cup -n 50 --no-pager
```

Häufige Ursachen:
- `.env` fehlt oder `ADMIN_PASSWORD_HASH` ist nicht gesetzt
- Falscher Pfad in `WorkingDirectory=` (überprüfe `.service` File)
- DB-Datei nicht beschreibbar: `ls -l server/moonlight_cup.db`

### 502 Bad Gateway über Cloudflare

Die App ist down. Prüfe `sudo systemctl status moonlight-cup` und Logs.

### Tunnel verbindet sich nicht

```bash
sudo journalctl -u cloudflared -n 50 --no-pager
```

Häufig: `cert.pem` fehlt (→ erneut `cloudflared tunnel login`) oder die Tunnel-UUID in `config.yml` stimmt nicht mit der `.json`-Credentials-Datei überein.

### Login schlägt mit „falsch" fehl, obwohl PW richtig

Die `.env` wurde nicht neu geladen. Nach Änderung: `sudo systemctl restart moonlight-cup`.

### Rate-Limit greift bei lokaler Tests

Nach 5 fehlgeschlagenen Logins / 15 Minuten / IP wird geblockt. Den Limiter-Speicher leerst du mit Service-Neustart (`memory://` ist prozesslokal).

### DB versehentlich beschädigt

Backup wiederherstellen oder bei leerer DB einfach löschen:

```bash
sudo systemctl stop moonlight-cup
rm /home/pi/moonlight-cup/server/moonlight_cup.db*
cd /home/pi/moonlight-cup/server
./venv/bin/python database.py
sudo systemctl start moonlight-cup
```

### Backup

WAL-Mode ist aktiv → einfach kopieren reicht **nicht**. Korrekt:

```bash
sqlite3 /home/pi/moonlight-cup/server/moonlight_cup.db ".backup '/home/pi/backups/mc-$(date +%F).db'"
```

In Cron für tägliches Backup:

```cron
0 3 * * * sqlite3 /home/pi/moonlight-cup/server/moonlight_cup.db ".backup '/home/pi/backups/mc-$(date +\%F).db'"
```

---

## Routenübersicht

| Pfad                | Auth | Zweck                                |
|---------------------|------|--------------------------------------|
| `/`                 | —    | Startseite mit Live-Countdown        |
| `/rangliste`        | —    | Vollmond / Halbmond / Neumond Anzeige |
| `/ergebnisse`       | —    | Alle abgeschlossenen Matches          |
| `/spielplan`        | —    | Aktuelle Runde + Durchgang            |
| `/anmeldung`        | —    | Öffentliches Anmeldeformular          |
| `/api/timer`        | —    | JSON für den Live-Countdown           |
| `/login`            | —    | Admin-Login (rate-limited)            |
| `/logout`           | Admin| Logout                               |
| `/admin/`           | Admin| Dashboard                             |
| `/admin/teilnehmer` | Admin| Anmeldungen + Spieler verwalten       |
| `/admin/spielplan`  | Admin| Runde starten, Finale, Reset          |
| `/admin/ergebnisse` | Admin| Ergebnisse erfassen                   |
| `/admin/rangliste`  | Admin| Stat-Adjustments                      |
| `/admin/timer`      | Admin| Timer setzen / löschen                |

## Sicherheitsentscheidungen

- **Bcrypt** mit 12 Rounds für das Admin-Passwort.
- **Session-Cookies**: HttpOnly, Secure, SameSite=Strict, 24h Laufzeit.
- **CSRF**: Flask-WTF auf allen Formularen, Referer-Check (HTTPS-only) ebenfalls aktiv.
- **CSP**: strikt gesetzt, nur eigene Origin + Google Fonts erlaubt.
- **Rate-Limit**: 5 Login-Versuche / 15 Minuten / IP.
- **Talisman**: HSTS, X-Content-Type-Options, X-Frame-Options=DENY.
- **`force_https=False`**: Cloudflare terminiert TLS und leitet HTTP weiter — Talisman trotzdem für HSTS-Header.
- **Gunicorn bind 127.0.0.1**: Pi ist niemals direkt im Internet exponiert.
