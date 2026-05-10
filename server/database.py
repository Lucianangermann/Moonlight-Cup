"""
SQLite connection helpers and one-shot schema bootstrap.

The schema covers everything the original RN app held in localStorage:
  - participants (active)
  - paused_participants (kept in standings, excluded from draws)
  - rounds + matches (full tournament history)
  - stat_adjustments (manual overrides on top of computed stats)
  - anmeldungen (public sign-ups, pending until admin confirms)
  - timer (single active countdown)

Usage:
  from database import get_db, close_db, init_db

  init_db()          # CLI: `python database.py`
  with get_db() as db:
      rows = db.execute("SELECT ...").fetchall()
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from flask import g, current_app

from config import Config


# --- Connection plumbing -----------------------------------------------------

def _connect(db_path: str) -> sqlite3.Connection:
    """Open SQLite with sensible defaults for a server context."""
    conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    # WAL: lets readers and a single writer co-exist without blocking — important
    # for the 30s timer poll while admin is editing.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def get_db() -> sqlite3.Connection:
    """Return per-request connection (cached on flask.g)."""
    if "db" not in g:
        g.db = _connect(current_app.config["DATABASE_PATH"])
    return g.db


def close_db(_exc=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


@contextmanager
def standalone_db() -> Iterator[sqlite3.Connection]:
    """For scripts/CLI where there's no Flask app context."""
    conn = _connect(Config.DATABASE_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# --- Schema ------------------------------------------------------------------

SCHEMA = """
-- Active tournament participants. `gender` and `league` mirror the RN model.
CREATE TABLE IF NOT EXISTS participants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,                       -- "Nachname, Vorname"
    gender      TEXT NOT NULL CHECK (gender IN ('M','F')),
    league      TEXT NOT NULL,                       -- 'FZ','BK','BL','BOL','BAY','OL','RL','BU'
    is_paused   INTEGER NOT NULL DEFAULT 0,          -- 0 active, 1 paused (still in standings, no draws)
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Round metadata. Matches live in their own table referencing this.
CREATE TABLE IF NOT EXISTS rounds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    round_number    INTEGER NOT NULL,                -- 1-indexed
    is_final_runde  INTEGER NOT NULL DEFAULT 0,
    is_schnellrunde INTEGER NOT NULL DEFAULT 0,
    sitting_out     TEXT NOT NULL DEFAULT '[]',      -- JSON array of participant ids (Freilos)
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A single match in a round. teamA/teamB are JSON arrays of two participant ids.
CREATE TABLE IF NOT EXISTS matches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id    INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    durchgang   INTEGER NOT NULL CHECK (durchgang IN (1,2)),
    field       INTEGER NOT NULL,                    -- 1..N (Feld-Nr.)
    team_a      TEXT NOT NULL,                       -- JSON [id, id]
    team_b      TEXT NOT NULL,                       -- JSON [id, id]
    match_type  TEXT NOT NULL CHECK (match_type IN ('MM','FF','MF')),
    score_a     INTEGER,
    score_b     INTEGER,
    done        INTEGER NOT NULL DEFAULT 0
);

-- Manual additive adjustments on top of computed stats. One row per participant.
CREATE TABLE IF NOT EXISTS stat_adjustments (
    participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    games          INTEGER NOT NULL DEFAULT 0,
    wins           INTEGER NOT NULL DEFAULT 0,
    diff           INTEGER NOT NULL DEFAULT 0,
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Public sign-up form submissions. Admin promotes to participants table.
CREATE TABLE IF NOT EXISTS anmeldungen (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,                       -- "Nachname, Vorname"
    email       TEXT NOT NULL,
    verein      TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'      -- 'pending'|'confirmed'|'rejected'
                CHECK (status IN ('pending','confirmed','rejected')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single-row table; we only ever keep one active timer.
CREATE TABLE IF NOT EXISTS timer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT NOT NULL,
    target_time TEXT NOT NULL,                       -- ISO-8601, UTC
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Speed up frequent lookups.
CREATE INDEX IF NOT EXISTS idx_matches_round    ON matches(round_id);
CREATE INDEX IF NOT EXISTS idx_anmeldungen_stat ON anmeldungen(status, created_at);
CREATE INDEX IF NOT EXISTS idx_timer_active     ON timer(is_active);
"""


def init_db() -> None:
    """Create the schema if missing. Idempotent — safe to call repeatedly."""
    with standalone_db() as conn:
        conn.executescript(SCHEMA)
    print(f"[database] schema ensured at {Config.DATABASE_PATH}")


if __name__ == "__main__":
    init_db()
