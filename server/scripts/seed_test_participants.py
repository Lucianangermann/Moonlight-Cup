"""
Seeds 99 test participants for a full-system dry run.

Goes through the real registration path (create_anmeldung -> confirm_anmeldung),
so the dashboard, the participant list, and the a{id} pid scheme all look
exactly like 99 genuine sign-ups — but WITHOUT touching the public form, so
no receipt mails are sent and no rate limits get in the way.

Run on the Pi:  cd server && source venv/bin/activate && python scripts/seed_test_participants.py
Remove again:   via the Teilnehmer tab's "Teilnehmerdaten nach Saisonende löschen"
                (purges everything) — or delete rows where email ends with @test.invalid.
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import standalone_db  # noqa: E402
from db_state import confirm_anmeldung, create_anmeldung  # noqa: E402
from tournament_logic import LEAGUES, MAX_PARTICIPANTS  # noqa: E402

FIRST_M = [
    "Max", "Lukas", "Jonas", "Felix", "Paul", "Leon", "Tim", "Jan", "Tom",
    "Ben", "Noah", "Elias", "David", "Simon", "Moritz", "Philipp", "Florian",
    "Tobias", "Sebastian", "Daniel", "Andreas", "Stefan", "Michael", "Thomas",
    "Christian", "Markus", "Martin", "Peter", "Wolfgang", "Johannes",
]
FIRST_F = [
    "Anna", "Lena", "Marie", "Laura", "Julia", "Lisa", "Sarah", "Hannah",
    "Emma", "Mia", "Sophie", "Clara", "Leonie", "Katharina", "Christina",
    "Stefanie", "Melanie", "Nicole", "Sandra", "Claudia", "Petra", "Monika",
    "Andrea", "Susanne", "Birgit",
]
LAST = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner",
    "Becker", "Schulz", "Hoffmann", "Koch", "Bauer", "Richter", "Klein",
    "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger",
    "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Krause", "Lehmann",
    "Huber", "Mayr", "Gruber", "Pichler", "Steiner", "Moser", "Brunner",
]
VEREINE = [
    "SpVgg Erdweg", "TSV Dachau", "BC Karlsfeld", "SV Odelzhausen",
    "TV Markt Indersdorf", "FC Schwabhausen", "TSV Altomünster",
    "SC Vierkirchen", "BC München-Nord", "TSV Bergkirchen",
]

# Weighted toward the lower leagues, like a real hobby tournament.
LEAGUE_KEYS = [k for k, _ in LEAGUES]
LEAGUE_WEIGHTS = [40, 20, 14, 10, 7, 5, 3, 1]

rng = random.Random(2026)  # deterministic — re-runs produce the same roster

_UMLAUTS = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})


def _email_part(s: str) -> str:
    return s.lower().translate(_UMLAUTS)


def main() -> None:
    with standalone_db() as db:
        existing = db.execute("SELECT COUNT(*) FROM participants").fetchone()[0]
        if existing:
            print(f"Abbruch: es existieren bereits {existing} Teilnehmer — "
                  "erst leeren (Saisonende-Löschung), dann neu seeden.")
            sys.exit(1)

        used_names = set()
        created = 0
        while created < MAX_PARTICIPANTS:
            gender = "M" if rng.random() < 0.6 else "F"
            first = rng.choice(FIRST_M if gender == "M" else FIRST_F)
            last = rng.choice(LAST)
            name = f"{last}, {first}"
            if name in used_names:
                continue
            used_names.add(name)

            league = rng.choices(LEAGUE_KEYS, weights=LEAGUE_WEIGHTS)[0]
            midnight = rng.random() < 0.75
            breakfast = rng.random() < 0.6
            aid = create_anmeldung(
                db,
                name=name,
                email=f"{_email_part(first)}.{_email_part(last)}{created}@test.invalid",
                verein=rng.choice(VEREINE),
                age=rng.randint(18, 65),
                gender=gender,
                league=league,
                midnight_meal=midnight,
                midnight_meal_type=(
                    ("vegetarisch" if rng.random() < 0.35 else "nicht_vegetarisch")
                    if midnight else None
                ),
                breakfast=breakfast,
                breakfast_type=(
                    ("vegetarisch" if rng.random() < 0.4 else "weisswurscht")
                    if breakfast else None
                ),
            )
            confirm_anmeldung(db, aid, gender=gender, league=league)
            created += 1

        total = db.execute("SELECT COUNT(*) FROM participants").fetchone()[0]
        men = db.execute("SELECT COUNT(*) FROM participants WHERE gender='M'").fetchone()[0]
        print(f"OK: {total} Teilnehmer angelegt ({men} Herren, {total - men} Damen).")


if __name__ == "__main__":
    main()
