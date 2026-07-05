"""
Sanity checks for db_state.py against an in-memory SQLite DB.

Same plain-assert style as test_logic.py — no pytest dependency.
Focused on swap_match_players, the one function with no client-side
precedent to compare against (everything else here mirrors a tested
JS/Python pair already covered by test_logic.py).
"""
from __future__ import annotations

import json
import sqlite3

from database import SCHEMA
from db_state import swap_match_players


def make_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def insert_round_with_matches(db: sqlite3.Connection, matches: list[tuple[list, list]]) -> list[int]:
    db.execute(
        "INSERT INTO rounds (round_number, sitting_out) VALUES (1, '[]')"
    )
    round_id = db.execute("SELECT id FROM rounds").fetchone()["id"]
    ids = []
    for team_a, team_b in matches:
        cur = db.execute(
            "INSERT INTO matches (round_id, durchgang, field, team_a, team_b, match_type) "
            "VALUES (?, 1, 1, ?, ?, 'MM')",
            (round_id, json.dumps(team_a), json.dumps(team_b)),
        )
        ids.append(cur.lastrowid)
    db.commit()
    return ids


def teams_of(db: sqlite3.Connection, match_id: int) -> tuple[list, list]:
    row = db.execute("SELECT team_a, team_b FROM matches WHERE id = ?", (match_id,)).fetchone()
    return json.loads(row["team_a"]), json.loads(row["team_b"])


def test_swap_across_two_matches():
    """Swapping team_a[0] of match1 with team_b[1] of match2 exchanges exactly those two players."""
    db = make_db()
    m1, m2 = insert_round_with_matches(db, [
        (["a1", "a2"], ["a3", "a4"]),
        (["b1", "b2"], ["b3", "b4"]),
    ])
    swap_match_players(db, match1_id=m1, team1="A", idx1=0, match2_id=m2, team2="B", idx2=1)

    a_team_a, a_team_b = teams_of(db, m1)
    b_team_a, b_team_b = teams_of(db, m2)
    assert a_team_a == ["b4", "a2"], f"match1 team_a should have b4 swapped in, got {a_team_a}"
    assert a_team_b == ["a3", "a4"], f"match1 team_b must be untouched, got {a_team_b}"
    assert b_team_a == ["b1", "b2"], f"match2 team_a must be untouched, got {b_team_a}"
    assert b_team_b == ["b3", "a1"], f"match2 team_b should have a1 swapped in, got {b_team_b}"
    print("✓ swap across two matches exchanges exactly the two targeted players")


def test_swap_within_same_match():
    """Swapping two slots within the same match (team1 == team2) must not corrupt data."""
    db = make_db()
    (m1,) = insert_round_with_matches(db, [(["a1", "a2"], ["a3", "a4"])])
    swap_match_players(db, match1_id=m1, team1="A", idx1=0, match2_id=m1, team2="A", idx2=1)

    team_a, team_b = teams_of(db, m1)
    assert team_a == ["a2", "a1"], f"expected team_a slots swapped in place, got {team_a}"
    assert team_b == ["a3", "a4"], f"team_b must be untouched, got {team_b}"
    print("✓ swap within the same match (team1 == team2) swaps in place without corruption")


def test_swap_same_match_different_teams():
    """Swapping across team_a/team_b of the SAME match (e.g. fixing a gender conflict)."""
    db = make_db()
    (m1,) = insert_round_with_matches(db, [(["a1", "a2"], ["a3", "a4"])])
    swap_match_players(db, match1_id=m1, team1="A", idx1=1, match2_id=m1, team2="B", idx2=0)

    team_a, team_b = teams_of(db, m1)
    assert team_a == ["a1", "a3"], f"expected a3 swapped into team_a[1], got {team_a}"
    assert team_b == ["a2", "a4"], f"expected a2 swapped into team_b[0], got {team_b}"
    print("✓ swap across team_a/team_b within the same match works correctly")


def test_swap_nonexistent_match_raises():
    db = make_db()
    (m1,) = insert_round_with_matches(db, [(["a1", "a2"], ["a3", "a4"])])
    try:
        swap_match_players(db, match1_id=m1, team1="A", idx1=0, match2_id=99999, team2="A", idx2=0)
        assert False, "expected ValueError for nonexistent match id"
    except ValueError:
        pass
    print("✓ swap with a nonexistent match id raises ValueError")


if __name__ == "__main__":
    tests = [
        test_swap_across_two_matches,
        test_swap_within_same_match,
        test_swap_same_match_different_teams,
        test_swap_nonexistent_match_raises,
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
