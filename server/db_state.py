"""
Bridge between SQLite rows and the pure data classes in `tournament_logic`.

`load_state(db)` rehydrates a full TournamentState from the DB.
`persist_round(db, round_)` writes a freshly-built Round (matches included).
`save_match_result(db, match_id, score_a, score_b)` updates a match in place.
`reset_tournament(db)` mirrors resetTournament() in tournament.js.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Optional

from tournament_logic import (
    Match, Participant, Round, StatAdjustment, TournamentState,
    apply_save_result,
)


# --- Load --------------------------------------------------------------------

def _participant_from_row(row: sqlite3.Row) -> Participant:
    return Participant(
        id=row["id"],
        name=row["name"],
        gender=row["gender"],
        league=row["league"],
        is_paused=bool(row["is_paused"]),
        email=row["email"] if "email" in row.keys() else None,
        verein=row["verein"] if "verein" in row.keys() else None,
    )


def _match_from_row(row: sqlite3.Row) -> Match:
    return Match(
        id=str(row["id"]),
        team_a=json.loads(row["team_a"]),
        team_b=json.loads(row["team_b"]),
        match_type=row["match_type"],
        durchgang=row["durchgang"],
        field=row["field"],
        score_a=row["score_a"],
        score_b=row["score_b"],
        done=bool(row["done"]),
    )


def load_state(db: sqlite3.Connection) -> TournamentState:
    """One query per table, then assemble. Cheap even for 100s of matches."""
    parts = db.execute(
        "SELECT id, name, gender, league, email, verein, is_paused FROM participants ORDER BY created_at"
    ).fetchall()
    active = [_participant_from_row(r) for r in parts if not r["is_paused"]]
    paused = [_participant_from_row(r) for r in parts if r["is_paused"]]

    round_rows = db.execute(
        "SELECT id, round_number, is_final_runde, is_schnellrunde, "
        "current_durchgang, sitting_out FROM rounds ORDER BY round_number"
    ).fetchall()

    rounds: list[Round] = []
    for rr in round_rows:
        match_rows = db.execute(
            "SELECT id, durchgang, field, team_a, team_b, match_type, "
            "score_a, score_b, done FROM matches WHERE round_id = ? "
            "ORDER BY durchgang, field",
            (rr["id"],),
        ).fetchall()
        rounds.append(Round(
            id=rr["id"],
            round_number=rr["round_number"],
            is_schnellrunde=bool(rr["is_schnellrunde"]),
            is_final_runde=bool(rr["is_final_runde"]),
            current_durchgang=rr["current_durchgang"],
            sitting_out=json.loads(rr["sitting_out"]),
            matches=[_match_from_row(m) for m in match_rows],
        ))

    adj_rows = db.execute(
        "SELECT participant_id, games, wins, diff FROM stat_adjustments"
    ).fetchall()
    stat_adjustments = {
        r["participant_id"]: StatAdjustment(games=r["games"], wins=r["wins"], diff=r["diff"])
        for r in adj_rows
    }

    return TournamentState(
        participants=active,
        paused=paused,
        rounds=rounds,
        stat_adjustments=stat_adjustments,
    )


# --- Persist -----------------------------------------------------------------

def persist_round(db: sqlite3.Connection, round_: Round) -> int:
    """
    Insert a new round + all its matches inside one transaction.
    Returns the new round_id.
    """
    cur = db.execute(
        "INSERT INTO rounds (round_number, is_final_runde, is_schnellrunde, "
        "current_durchgang, sitting_out) VALUES (?, ?, ?, ?, ?)",
        (
            round_.round_number,
            int(round_.is_final_runde),
            int(round_.is_schnellrunde),
            round_.current_durchgang,
            json.dumps(round_.sitting_out),
        ),
    )
    round_id = cur.lastrowid

    for m in round_.matches:
        db.execute(
            "INSERT INTO matches (round_id, durchgang, field, team_a, team_b, "
            "match_type, score_a, score_b, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                round_id, m.durchgang, m.field,
                json.dumps(m.team_a), json.dumps(m.team_b),
                m.match_type, m.score_a, m.score_b, int(m.done),
            ),
        )
    db.commit()
    return round_id


def save_match_result(db: sqlite3.Connection, match_id: int, score_a: int, score_b: int) -> None:
    """
    Apply the Schnellrunde min-loser-score rule and persist.
    Reads the parent round to know whether the rule applies.
    """
    row = db.execute(
        "SELECT m.id, m.durchgang, m.field, m.team_a, m.team_b, m.match_type, "
        "m.score_a, m.score_b, m.done, r.is_schnellrunde "
        "FROM matches m JOIN rounds r ON m.round_id = r.id "
        "WHERE m.id = ?",
        (match_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"match {match_id} not found")

    match = _match_from_row(row)
    is_schnellrunde = bool(row["is_schnellrunde"])
    updated = apply_save_result(match, score_a, score_b, is_schnellrunde)

    db.execute(
        "UPDATE matches SET score_a = ?, score_b = ?, done = 1 WHERE id = ?",
        (updated.score_a, updated.score_b, match_id),
    )
    db.commit()


def clear_match_result(db: sqlite3.Connection, match_id: int) -> None:
    """Undo a result so admin can re-enter (sets done=0, scores NULL)."""
    db.execute(
        "UPDATE matches SET score_a = NULL, score_b = NULL, done = 0 WHERE id = ?",
        (match_id,),
    )
    db.commit()


def swap_match_players(
    db: sqlite3.Connection, *,
    match1_id: int, team1: str, idx1: int,
    match2_id: int, team2: str, idx2: int,
) -> None:
    """
    Swap the participant at team{team1}[idx1] of match1 with the participant
    at team{team2}[idx2] of match2. team1/team2 in {'A','B'}, idx1/idx2 in {0,1}.
    Mirrors swapMatchPlayers() in src/store/tournament.js (lines 549-567) —
    both target values are read before either is written, so a swap within
    the same match (match1_id == match2_id) is safe even when team1 == team2.
    """
    rows = {}
    for mid in {match1_id, match2_id}:
        row = db.execute("SELECT team_a, team_b FROM matches WHERE id = ?", (mid,)).fetchone()
        if row is None:
            raise ValueError(f"match {mid} not found")
        rows[mid] = {"team_a": json.loads(row["team_a"]), "team_b": json.loads(row["team_b"])}

    team1_list = rows[match1_id]["team_a" if team1 == "A" else "team_b"]
    team2_list = rows[match2_id]["team_a" if team2 == "A" else "team_b"]

    pid1, pid2 = team1_list[idx1], team2_list[idx2]
    team1_list[idx1] = pid2
    team2_list[idx2] = pid1

    for mid, teams in rows.items():
        db.execute(
            "UPDATE matches SET team_a = ?, team_b = ? WHERE id = ?",
            (json.dumps(teams["team_a"]), json.dumps(teams["team_b"]), mid),
        )
    db.commit()


def advance_durchgang(db: sqlite3.Connection, round_id: int) -> None:
    db.execute("UPDATE rounds SET current_durchgang = 2 WHERE id = ?", (round_id,))
    db.commit()


def current_durchgang_done(db: sqlite3.Connection, round_id: int) -> bool:
    row = db.execute(
        "SELECT current_durchgang FROM rounds WHERE id = ?", (round_id,)
    ).fetchone()
    if row is None:
        return False
    dg = row["current_durchgang"]
    n_total, n_done = db.execute(
        "SELECT COUNT(*), COALESCE(SUM(done), 0) FROM matches "
        "WHERE round_id = ? AND durchgang = ?",
        (round_id, dg),
    ).fetchone()
    return n_total > 0 and n_total == n_done


def all_matches_done(db: sqlite3.Connection, round_id: int) -> bool:
    n_total, n_done = db.execute(
        "SELECT COUNT(*), COALESCE(SUM(done), 0) FROM matches WHERE round_id = ?",
        (round_id,),
    ).fetchone()
    return n_total > 0 and n_total == n_done


def get_current_round(db: sqlite3.Connection) -> Optional[sqlite3.Row]:
    """Returns the latest round (highest round_number) or None."""
    return db.execute(
        "SELECT id, round_number, is_final_runde, is_schnellrunde, "
        "current_durchgang, sitting_out FROM rounds "
        "ORDER BY round_number DESC LIMIT 1"
    ).fetchone()


# --- Tournament-wide mutations -----------------------------------------------

def reset_tournament(db: sqlite3.Connection) -> None:
    """
    Mirrors resetTournament() in tournament.js:
      - paused players are reactivated (moved back to active),
      - all rounds + matches are deleted (FK cascades),
      - all stat adjustments are deleted,
      - timer is left untouched (separate concern).
    """
    db.execute("UPDATE participants SET is_paused = 0 WHERE is_paused = 1")
    db.execute("DELETE FROM rounds")           # cascade deletes matches
    db.execute("DELETE FROM stat_adjustments")
    db.commit()


def delete_round(db: sqlite3.Connection, round_id: int) -> None:
    """Drop a round and renumber subsequent rounds."""
    row = db.execute("SELECT round_number FROM rounds WHERE id = ?", (round_id,)).fetchone()
    if not row:
        return
    rn = row["round_number"]
    db.execute("DELETE FROM rounds WHERE id = ?", (round_id,))
    db.execute("UPDATE rounds SET round_number = round_number - 1 WHERE round_number > ?", (rn,))
    db.commit()


# --- Participants ------------------------------------------------------------

def add_participant(
    db: sqlite3.Connection, *,
    pid: str, name: str, gender: str, league: str,
    email: Optional[str] = None, verein: Optional[str] = None,
) -> None:
    db.execute(
        "INSERT INTO participants (id, name, gender, league, email, verein) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (pid, name, gender, league, email, verein),
    )
    db.commit()


def update_participant(db: sqlite3.Connection, pid: str, **fields) -> None:
    allowed = {"name", "gender", "league", "email", "verein"}
    sets = [f"{k} = ?" for k in fields if k in allowed]
    if not sets:
        return
    values = [fields[k] for k in fields if k in allowed]
    db.execute(f"UPDATE participants SET {', '.join(sets)} WHERE id = ?", (*values, pid))
    db.commit()


def remove_participant(db: sqlite3.Connection, pid: str) -> None:
    db.execute("DELETE FROM participants WHERE id = ?", (pid,))
    db.execute("DELETE FROM stat_adjustments WHERE participant_id = ?", (pid,))
    db.commit()


def set_paused(db: sqlite3.Connection, pid: str, paused: bool) -> None:
    db.execute("UPDATE participants SET is_paused = ? WHERE id = ?", (int(paused), pid))
    db.commit()


def set_stat_adjustment(db: sqlite3.Connection, pid: str, games: int, wins: int, diff: int) -> None:
    db.execute(
        "INSERT INTO stat_adjustments (participant_id, games, wins, diff, updated_at) "
        "VALUES (?, ?, ?, ?, datetime('now')) "
        "ON CONFLICT(participant_id) DO UPDATE SET "
        "games = excluded.games, wins = excluded.wins, diff = excluded.diff, "
        "updated_at = datetime('now')",
        (pid, games, wins, diff),
    )
    db.commit()


# --- Anmeldungen --------------------------------------------------------------

def create_anmeldung(db: sqlite3.Connection, *, name: str, email: str, verein: Optional[str]) -> int:
    cur = db.execute(
        "INSERT INTO anmeldungen (name, email, verein) VALUES (?, ?, ?)",
        (name, email, verein),
    )
    db.commit()
    return cur.lastrowid


def list_anmeldungen(db: sqlite3.Connection, *, status: Optional[str] = None) -> list[sqlite3.Row]:
    if status:
        return db.execute(
            "SELECT * FROM anmeldungen WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
    return db.execute("SELECT * FROM anmeldungen ORDER BY created_at DESC").fetchall()


def confirm_anmeldung(
    db: sqlite3.Connection, anmeldung_id: int, *,
    gender: str, league: str,
) -> str:
    """
    Promote an anmeldung to a participant. Returns the new participant id.
    Anmeldung row is marked 'confirmed' (kept for audit).
    """
    row = db.execute("SELECT * FROM anmeldungen WHERE id = ?", (anmeldung_id,)).fetchone()
    if row is None:
        raise ValueError(f"anmeldung {anmeldung_id} not found")

    pid = f"a{anmeldung_id}"  # stable, deterministic id
    db.execute(
        "INSERT INTO participants (id, name, gender, league, email, verein) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (pid, row["name"], gender, league, row["email"], row["verein"]),
    )
    db.execute("UPDATE anmeldungen SET status = 'confirmed' WHERE id = ?", (anmeldung_id,))
    db.commit()
    return pid


def delete_anmeldung(db: sqlite3.Connection, anmeldung_id: int) -> None:
    db.execute("DELETE FROM anmeldungen WHERE id = ?", (anmeldung_id,))
    db.commit()


# --- Timer -------------------------------------------------------------------

def get_active_timer(db: sqlite3.Connection) -> Optional[sqlite3.Row]:
    return db.execute(
        "SELECT * FROM timer WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()


def set_timer(
    db: sqlite3.Connection, *,
    label: str, target_time_iso: str,
    phase: Optional[str] = None, total_seconds: Optional[int] = None,
) -> None:
    """Setting a new timer deactivates any previous one (single active row)."""
    db.execute("UPDATE timer SET is_active = 0 WHERE is_active = 1")
    db.execute(
        "INSERT INTO timer (label, target_time, phase, total_seconds, is_active, updated_at) "
        "VALUES (?, ?, ?, ?, 1, datetime('now'))",
        (label, target_time_iso, phase, total_seconds),
    )
    db.commit()


def deactivate_timer(db: sqlite3.Connection) -> None:
    db.execute("UPDATE timer SET is_active = 0, updated_at = datetime('now') WHERE is_active = 1")
    db.commit()


def delete_timer(db: sqlite3.Connection) -> None:
    db.execute("DELETE FROM timer")
    db.commit()
