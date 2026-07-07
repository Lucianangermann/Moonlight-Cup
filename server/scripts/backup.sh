#!/bin/bash
# Moonlight Cup — hourly SQLite backup.
#
# Installed via cron (see README §Backup). Uses sqlite3's .backup (WAL-safe;
# a plain file copy of a WAL database is NOT a valid backup). Writes to the
# local backups dir and, when mounted, mirrors to the big SD card so a dying
# boot disk doesn't take the only copies with it. Keeps 72 hourly snapshots
# (3 days) per target.
set -u
umask 077  # backups contain full participant PII — never world/group readable

DB=/home/pi/Moonlight-Cup/server/moonlight_cup.db
LOCAL_DIR=/home/pi/backups
SD_DIR=/media/pi/9E6E-8730/moonlightcup-backups
STAMP=$(date +%F-%H%M)
KEEP=72

[ -f "$DB" ] || exit 0
mkdir -p "$LOCAL_DIR"

sqlite3 "$DB" ".backup '$LOCAL_DIR/mc-$STAMP.db'" || exit 1

# Mirror to the SD card only if it is actually mounted — writing into an
# unmounted /media path would silently fill the boot disk instead.
if mountpoint -q "$(dirname "$SD_DIR")"; then
  mkdir -p "$SD_DIR"
  cp "$LOCAL_DIR/mc-$STAMP.db" "$SD_DIR/mc-$STAMP.db"
  ls -1t "$SD_DIR"/mc-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
fi

ls -1t "$LOCAL_DIR"/mc-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
