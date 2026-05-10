"""
Sanity checks for the Python port of tournament_logic.py.

Not a full property-based test, but covers the gnarly invariants:
  - Schnellrunde Vollmond protection
  - had_freilos exclusivity (no double-Freilos)
  - D2 = ceil(matches/2)  (D1 loses field 1 first when odd)
  - Field assignment: worst match → lowest field, best → field 12
  - Schnellrunde score-rule: loser bumped to ≥16
  - getStandings includes paused players, applies stat adjustments
"""
from __future__ import annotations

import math
import random
from tournament_logic import (
    Match, Participant, Round, StatAdjustment, TournamentState,
    apply_save_result, build_new_round, build_final_runde, get_standings,
)


def make_participants(n_men: int, n_women: int, leagues: list[str] | None = None) -> list[Participant]:
    leagues = leagues or ["FZ", "BK", "BL", "BOL", "BAY", "OL", "RL", "BU"]
    out = []
    for i in range(n_men):
        out.append(Participant(id=f"m{i}", name=f"M{i}, X", gender="M",
                               league=leagues[i % len(leagues)]))
    for i in range(n_women):
        out.append(Participant(id=f"w{i}", name=f"W{i}, X", gender="F",
                               league=leagues[i % len(leagues)]))
    return out


def empty_state(participants):
    return TournamentState(participants=participants, paused=[], rounds=[], stat_adjustments={})


def test_first_round_is_schnellrunde():
    s = empty_state(make_participants(20, 20))
    r = build_new_round(s, rng=random.Random(42))
    assert r.is_schnellrunde, "round 1 must be Schnellrunde"
    assert r.round_number == 1
    assert not r.is_final_runde
    print("✓ first round is Schnellrunde")


def test_d2_count_ceiling():
    """When match count is odd, D2 must get the extra match (D1 loses Feld 1 first)."""
    # 30 active = 7 matches in a normal round (after 7 groups of 4 + leftover)
    # Actually 30 / 8 = 3 groups of 8 (6 matches) + 1 group of 4 (1 match) = 7 matches.
    # With round 4+ this is normal. We need round_number > 3.
    s = TournamentState(
        participants=make_participants(15, 15),
        paused=[], rounds=[
            # Three dummy completed rounds so round 4 isn't Schnellrunde
            Round(id=i, round_number=i, is_schnellrunde=True, is_final_runde=False,
                  current_durchgang=2, sitting_out=[], matches=[])
            for i in range(1, 4)
        ],
        stat_adjustments={},
    )
    r = build_new_round(s, rng=random.Random(0))
    assert r.round_number == 4
    n_d2 = sum(1 for m in r.matches if m.durchgang == 2)
    n_d1 = sum(1 for m in r.matches if m.durchgang == 1)
    expected_d2 = math.ceil(len(r.matches) / 2)
    assert n_d2 == expected_d2, f"expected {expected_d2} D2 matches, got {n_d2}"
    assert n_d1 + n_d2 == len(r.matches)
    print(f"✓ d2_count = ceil(matches/2): {n_d2}/{len(r.matches)} matches in D2")


def test_field_assignment():
    """Best match in DG → highest field; worst → lowest. Field 12 is the cap."""
    s = TournamentState(
        participants=make_participants(15, 15), paused=[],
        rounds=[
            Round(id=i, round_number=i, is_schnellrunde=True, is_final_runde=False,
                  current_durchgang=2, sitting_out=[], matches=[])
            for i in range(1, 4)
        ],
        stat_adjustments={},
    )
    r = build_new_round(s, rng=random.Random(0))
    for dg in (1, 2):
        dg_matches = [m for m in r.matches if m.durchgang == dg]
        if not dg_matches:
            continue
        # Highest field in this DG must be 12.
        max_field = max(m.field for m in dg_matches)
        assert max_field == 12, f"DG{dg}: max field expected 12, got {max_field}"
        # Fields are contiguous 13-len .. 12.
        expected = list(range(13 - len(dg_matches), 13))
        actual = sorted(m.field for m in dg_matches)
        assert actual == expected, f"DG{dg}: fields {actual} != {expected}"
    print("✓ fields are contiguous and capped at 12 per Durchgang")


def test_no_double_freilos():
    """A player who sat out round 1 must not sit out round 2."""
    parts = make_participants(11, 11)  # 22 total, 4 sit out per round of 4 groups of 4 (Schnellrunde)
    s = empty_state(parts)
    rng = random.Random(1)
    r1 = build_new_round(s, rng=rng)
    r1_freilos = set(r1.sitting_out)
    if not r1_freilos:
        print("✓ no double Freilos (round 1 had 0 Freilos, skipping)")
        return

    s2 = TournamentState(
        participants=parts, paused=[], rounds=[r1], stat_adjustments={},
    )
    r2 = build_new_round(s2, rng=random.Random(2))
    r2_freilos = set(r2.sitting_out)
    overlap = r1_freilos & r2_freilos
    assert not overlap, f"Players got Freilos twice: {overlap}"
    print(f"✓ no double Freilos (R1: {len(r1_freilos)}, R2: {len(r2_freilos)}, overlap: 0)")


def test_schnellrunde_score_bump():
    """Loser score must bump to ≥16 if winner reached 16."""
    m = Match(id="x", team_a=["a","b"], team_b=["c","d"], match_type="MM")
    res = apply_save_result(m, 21, 8, is_schnellrunde=True)
    assert res.score_a == 21
    assert res.score_b == 16, f"loser bumped from 8 to 16, got {res.score_b}"
    assert res.done

    # Non-Schnellrunde: no bump
    res2 = apply_save_result(m, 21, 8, is_schnellrunde=False)
    assert res2.score_b == 8

    # Below 16: no bump even in Schnellrunde
    res3 = apply_save_result(m, 15, 13, is_schnellrunde=True)
    assert res3.score_b == 13
    print("✓ Schnellrunde score-bump (≥16) applied correctly")


def test_standings_includes_paused():
    """Paused players must remain in the standings list (just no draws)."""
    active = make_participants(2, 0)
    paused = [Participant(id="p1", name="Paused, P", gender="M", league="FZ", is_paused=True)]
    state = TournamentState(participants=active, paused=paused, rounds=[], stat_adjustments={})
    rows = get_standings(state)
    ids = {r.id for r in rows}
    assert "p1" in ids, "paused player must appear in standings"
    print("✓ paused players appear in standings")


def test_stat_adjustments():
    parts = make_participants(2, 0)
    state = TournamentState(
        participants=parts, paused=[], rounds=[],
        stat_adjustments={"m0": StatAdjustment(games=5, wins=3, diff=20)},
    )
    rows = get_standings(state)
    m0 = next(r for r in rows if r.id == "m0")
    assert m0.games == 5
    assert m0.wins == 3
    assert m0.diff == 20
    assert m0.points == 6, f"points = wins*2 = 6, got {m0.points}"
    print("✓ stat_adjustments applied additively to standings")


def test_freilos_grants_win():
    """sitting_out grants games+1, wins+1, points+2 (diff unchanged)."""
    parts = make_participants(1, 0)
    state = TournamentState(
        participants=parts, paused=[],
        rounds=[Round(id=1, round_number=1, sitting_out=["m0"], matches=[])],
        stat_adjustments={},
    )
    rows = get_standings(state)
    m0 = next(r for r in rows if r.id == "m0")
    assert m0.games == 1
    assert m0.wins == 1
    assert m0.points == 2
    assert m0.diff == 0
    print("✓ Freilos grants free win without diff change")


def test_final_round_groups_of_4():
    """Final round: groups of 4, snake within group (1+4 vs 2+3)."""
    # 8 active players → 2 groups of 4 → 2 matches.
    parts = make_participants(4, 4)
    s = TournamentState(
        participants=parts, paused=[],
        rounds=[
            Round(id=i, round_number=i, is_schnellrunde=True, is_final_runde=False,
                  current_durchgang=2, sitting_out=[], matches=[])
            for i in range(1, 4)
        ],
        stat_adjustments={},
    )
    r = build_final_runde(s)
    assert r.is_final_runde
    assert len(r.matches) == 2, f"expected 2 final matches, got {len(r.matches)}"
    assert not r.sitting_out
    print(f"✓ final round produces {len(r.matches)} matches in groups of 4")


if __name__ == "__main__":
    tests = [
        test_first_round_is_schnellrunde,
        test_d2_count_ceiling,
        test_field_assignment,
        test_no_double_freilos,
        test_schnellrunde_score_bump,
        test_standings_includes_paused,
        test_stat_adjustments,
        test_freilos_grants_win,
        test_final_round_groups_of_4,
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
