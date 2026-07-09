"""
Contract tests for the HTTP surface.

The RN app depends on the exact JSON key names below (camelCase mapping in
blueprints/api.py) — a rename would break every phone at the event and no
algorithm test would notice. Same plain-assert style as test_logic.py:
run with `python test_api.py`.
"""
from __future__ import annotations

import json
import os
import re
import tempfile

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-test_api")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "test_api.db")

from flask_bcrypt import Bcrypt

os.environ["ADMIN_PASSWORD_HASH"] = Bcrypt().generate_password_hash("testpw").decode()

# Import AFTER the env is prepared — config.py reads it at import time.
from app import create_app  # noqa: E402
from database import init_db  # noqa: E402
from tournament_logic import MAX_PARTICIPANTS  # noqa: E402

init_db()
app = create_app()
client = app.test_client()


def login():
    r = client.post("/api/login", json={"username": "admin", "password": "testpw"})
    assert r.status_code == 200 and r.get_json() == {"isAdmin": True}


def logout():
    assert client.post("/api/logout").status_code == 200


def csrf_token():
    html = client.get("/anmeldung").get_data(as_text=True)
    return re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)


def test_auth_guards():
    logout()
    assert client.get("/api/session").get_json() == {"isAdmin": False}
    # Every mutating route must 401 without a session.
    checks = [
        ("POST", "/api/participants", {"name": "X, Y", "gender": "M", "league": "FZ"}),
        ("PATCH", "/api/participants/x", {"name": "Z"}),
        ("DELETE", "/api/participants/x", None),
        ("POST", "/api/rounds", None),
        ("POST", "/api/rounds/final", None),
        ("DELETE", "/api/rounds/1", None),
        ("POST", "/api/tournament/reset", None),
        ("POST", "/api/matches/1/result", {"scoreA": 1, "scoreB": 2}),
        ("POST", "/api/matches/swap", {}),
        ("POST", "/api/standings/x/adjustment", {}),
        ("POST", "/api/timer", {"label": "x", "targetTime": "t"}),
        ("POST", "/api/timer/deactivate", None),
        ("DELETE", "/api/timer", None),
        ("GET", "/api/anmeldungen", None),
        ("POST", "/api/anmeldungen/1/confirm", {"gender": "M", "league": "FZ"}),
        ("DELETE", "/api/anmeldungen/1", None),
    ]
    for method, path, body in checks:
        r = client.open(path, method=method, json=body)
        assert r.status_code == 401, f"{method} {path} -> {r.status_code}, expected 401"
    # Wrong password -> 401, session stays unauthenticated
    r = client.post("/api/login", json={"username": "admin", "password": "nope"})
    assert r.status_code == 401
    print(f"✓ auth guards: {len(checks)} mutating routes 401 without session")


def test_tournament_contract():
    login()
    r = client.post("/api/participants", json={"name": "Contract, Carla", "gender": "F", "league": "BK", "verein": "TSV"})
    assert r.status_code == 201 and "id" in r.get_json()
    # 2 women + 2 men -> a Mixed pairing is always possible in round 1.
    for name, gender in [("Filler, Fiona", "F"), ("Filler, Franz", "M"), ("Filler, Fred", "M")]:
        client.post("/api/participants", json={"name": name, "gender": gender, "league": "FZ"})
    r = client.post("/api/rounds")
    assert r.status_code == 201

    data = client.get("/api/tournament").get_json()
    assert set(data.keys()) == {
        "participants", "pausedParticipants", "rounds", "currentRound",
        "standings", "statAdjustments",
    }
    p = data["participants"][0]
    assert set(p.keys()) == {"id", "name", "gender", "league", "verein"}
    assert "email" not in p, "public /api/tournament must never expose participant e-mail"
    rnd = data["rounds"][0]
    assert set(rnd.keys()) == {
        "id", "roundNumber", "isSchnellrunde", "isFinalRunde",
        "currentDurchgang", "sittingOut", "matches",
    }
    m = rnd["matches"][0]
    assert set(m.keys()) == {
        "id", "teamA", "teamB", "matchType", "durchgang", "field",
        "scoreA", "scoreB", "done", "winnerTeam",
    }
    s = data["standings"][0]
    assert set(s.keys()) == {"id", "name", "gender", "league", "games", "wins", "diff", "points"}
    assert data["currentRound"] == rnd["id"]
    print("✓ /api/tournament camelCase contract intact (participants/rounds/matches/standings)")


def test_round_guards_and_results():
    # Current round is unfinished -> starting another must 409.
    assert client.post("/api/rounds").status_code == 409
    assert client.post("/api/rounds/final").status_code == 409

    data = client.get("/api/tournament").get_json()
    matches = data["rounds"][0]["matches"]
    for m in matches:
        r = client.post(f"/api/matches/{m['id']}/result", json={"scoreA": 21, "scoreB": 15})
        assert r.status_code == 200
    data = client.get("/api/tournament").get_json()
    assert all(m["done"] for m in data["rounds"][0]["matches"])
    assert data["standings"][0]["wins"] >= 1

    # All done -> next round may start again.
    assert client.post("/api/rounds").status_code == 201
    print("✓ round guards: 409 while unfinished, results save, next round after completion")


def test_timer_roundtrip():
    r = client.post("/api/timer", json={
        "label": "Einspielen — Durchgang 1", "targetTime": "2030-01-01T00:00:00Z",
        "phase": "warmup", "totalSeconds": 180,
    })
    assert r.status_code == 200
    t = client.get("/api/timer").get_json()
    assert t == {
        "label": "Einspielen — Durchgang 1", "targetTime": "2030-01-01T00:00:00Z",
        "isActive": True, "phase": "warmup", "totalSeconds": 180,
    }
    assert client.post("/api/timer/deactivate").status_code == 200
    assert client.get("/api/timer").get_json()["isActive"] is False
    print("✓ timer roundtrip incl. phase/totalSeconds")


def test_etag_304():
    r1 = client.get("/api/tournament")
    etag = r1.headers["ETag"]
    r2 = client.get("/api/tournament", headers={"If-None-Match": etag})
    assert r2.status_code == 304
    # A mutation must invalidate the cached ETag.
    client.post("/api/participants", json={"name": "Neu, Nora", "gender": "F", "league": "FZ"})
    r3 = client.get("/api/tournament", headers={"If-None-Match": etag})
    assert r3.status_code == 200 and r3.headers["ETag"] != etag
    print("✓ ETag/304 + invalidation on mutation")


def test_consent_required_and_privacy_page():
    assert client.get("/datenschutz").status_code == 200
    assert client.get("/impressum").status_code == 200
    base = {
        "name": "Kein, Konsens", "email": "kein.konsens@gmail.com", "age": "30",
        "gender": "M", "verein": "TSV", "league": "FZ",
        "midnight_meal": "nein", "breakfast": "nein",
    }
    r = client.post("/anmeldung", data={**base, "csrf_token": csrf_token()}, follow_redirects=True)
    assert "Datenschutzhinweisen zustimmen" in r.get_data(as_text=True)
    data = client.get("/api/tournament").get_json()
    assert not any(p["name"] == "Kein, Konsens" for p in data["participants"])
    print("✓ registration without consent is rejected, /datenschutz renders")


def test_minimum_age_enforced():
    base = {
        "name": "Zu, Jung", "email": "zu.jung@gmail.com", "age": "17",
        "gender": "M", "verein": "TSV", "league": "FZ",
        "midnight_meal": "nein", "breakfast": "nein", "consent": "y",
    }
    r = client.post("/anmeldung", data={**base, "csrf_token": csrf_token()}, follow_redirects=True)
    assert "mindestens 18 Jahre alt" in r.get_data(as_text=True)
    data = client.get("/api/tournament").get_json()
    assert not any(p["name"] == "Zu, Jung" for p in data["participants"])
    print("✓ registration under 18 is rejected with a clear message")


def test_dashboard_requires_admin_and_shows_meal_answers():
    # Every test after test_tournament_contract relies on staying logged in
    # (none of them re-login) — restore that ambient state on every exit
    # path, including the early no-session check below.
    logout()
    try:
        r = client.get("/dashboard", follow_redirects=False)
        assert r.status_code == 302 and "/anmeldung" in r.headers["Location"]

        base = {
            "name": "Dash, Board", "email": "dash.board@gmail.com", "age": "42",
            "gender": "F", "verein": "Dashclub", "league": "FZ",
            "midnight_meal": "ja", "midnight_meal_type": "nicht_vegetarisch",
            "breakfast": "ja", "breakfast_type": "weisswurscht",
            "consent": "y",
        }
        client.post("/anmeldung", data={**base, "csrf_token": csrf_token()}, follow_redirects=True)

        login()
        r = client.get("/dashboard")
        assert r.status_code == 200
        assert r.headers["Cache-Control"] == "no-store"
        html = r.get_data(as_text=True)
        assert "Dash, Board" in html
        assert "dash.board@gmail.com" in html
        assert "Nicht vegetarisch" in html  # midnight_meal_type answer surfaced
        assert "Weißwurscht" in html  # breakfast_type answer surfaced, not just yes/no
    finally:
        login()
    print("✓ /dashboard: 302 without session, shows meal answers once logged in")


def _dashboard_raw_entry(name):
    html = client.get("/dashboard").get_data(as_text=True)
    raw = json.loads(re.search(r'id="dash-raw-data">(.*?)</script>', html, re.S).group(1))
    return next(r for r in raw if r["name"] == name)


def test_dashboard_edit_syncs_participant_and_delete_removes_both():
    login()
    base = {
        "name": "Edit, Erika", "email": "edit.erika@gmail.com", "age": "22",
        "gender": "F", "verein": "Editclub", "league": "FZ",
        "midnight_meal": "ja", "midnight_meal_type": "vegetarisch",
        "breakfast": "nein", "consent": "y",
    }
    client.post("/anmeldung", data={**base, "csrf_token": csrf_token()}, follow_redirects=True)

    entry = _dashboard_raw_entry("Edit, Erika")
    aid = entry["id"]
    data = client.get("/api/tournament").get_json()
    participant = next(p for p in data["participants"] if p["name"] == "Edit, Erika")
    pid = participant["id"]

    # Invalid gender is rejected before touching the DB.
    assert client.patch(f"/api/anmeldungen/{aid}", json={"gender": "X"}).status_code == 400

    # Edit: rename, change verein, flip Frühstück to Ja. name/verein must
    # sync onto the already-confirmed participant; age/meal prefs are
    # anmeldung-only and show up on the dashboard, not the public API.
    r = client.patch(f"/api/anmeldungen/{aid}", json={
        "name": "Edit, Erika-Neu", "email": "edit.erika@gmail.com", "age": 23,
        "gender": "F", "verein": "Neuer Verein", "league": "FZ",
        "midnight_meal": True, "midnight_meal_type": "vegetarisch",
        "breakfast": True, "breakfast_type": "weisswurscht",
    })
    assert r.status_code == 200

    data = client.get("/api/tournament").get_json()
    p = next(p for p in data["participants"] if p["id"] == pid)
    assert p["name"] == "Edit, Erika-Neu" and p["verein"] == "Neuer Verein"

    html = client.get("/dashboard").get_data(as_text=True)
    assert "Edit, Erika-Neu" in html and "Weißwurscht" in html

    # Delete: removes the anmeldung AND the linked participant entirely —
    # not just the audit row.
    assert client.delete(f"/api/anmeldungen/{aid}").status_code == 204
    data = client.get("/api/tournament").get_json()
    assert not any(p["id"] == pid for p in data["participants"])
    html = client.get("/dashboard").get_data(as_text=True)
    assert "Edit, Erika-Neu" not in html
    print("✓ dashboard edit syncs name/verein onto the participant; delete removes both")


def test_waitlist_cutover():
    client.post("/api/tournament/reset")
    data = client.get("/api/tournament").get_json()
    have = len(data["participants"])
    for i in range(MAX_PARTICIPANTS - have):
        r = client.post("/api/participants", json={"name": f"Cap, C{i}", "gender": "M", "league": "FZ"})
        assert r.status_code == 201
    # Public registration #100 -> waitlist (pending anmeldung, NOT a participant)
    r = client.post("/anmeldung", data={
        "csrf_token": csrf_token(),
        "name": "Warte, Willi", "email": "willi@gmail.com", "age": "30",
        "gender": "M", "verein": "TSV", "league": "FZ",
        "midnight_meal": "nein", "breakfast": "nein", "consent": "y",
    }, follow_redirects=True)
    assert "Warteliste" in r.get_data(as_text=True)
    data = client.get("/api/tournament").get_json()
    assert len(data["participants"]) == MAX_PARTICIPANTS

    wl = client.get("/api/anmeldungen").get_json()
    assert wl and wl[0]["name"] == "Warte, Willi"
    assert {"id", "name", "email", "verein", "createdAt", "age", "gender", "league"} <= set(wl[0].keys())

    # Confirm while full -> 409; free a slot -> promotion works; double-confirm -> 409.
    aid = wl[0]["id"]
    assert client.post(f"/api/anmeldungen/{aid}/confirm", json={"gender": "M", "league": "FZ"}).status_code == 409
    pid = data["participants"][0]["id"]
    assert client.delete(f"/api/participants/{pid}").status_code == 204
    assert client.post(f"/api/anmeldungen/{aid}/confirm", json={"gender": "M", "league": "FZ"}).status_code == 200
    client.delete(f"/api/participants/{data['participants'][1]['id']}")
    assert client.post(f"/api/anmeldungen/{aid}/confirm", json={"gender": "M", "league": "FZ"}).status_code == 409
    print("✓ waitlist cutover at 99, promotion, full/duplicate confirm -> 409")


if __name__ == "__main__":
    tests = [
        test_auth_guards,
        test_tournament_contract,
        test_round_guards_and_results,
        test_timer_roundtrip,
        test_etag_304,
        test_consent_required_and_privacy_page,
        test_minimum_age_enforced,
        test_dashboard_requires_admin_and_shows_meal_answers,
        test_dashboard_edit_syncs_participant_and_delete_removes_both,
        test_waitlist_cutover,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            print(f"✗ {t.__name__}: {e}")
            failed += 1
    print(f"\n{len(tests) - failed}/{len(tests)} tests passed")
    raise SystemExit(failed)
