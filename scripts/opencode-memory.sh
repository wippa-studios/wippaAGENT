#!/usr/bin/env bash
# Report and reclaim space in the OpenCode data directory.
#
# The default run is read-only. Nothing is removed without --apply, and the
# database is only backed up and compacted with --vacuum --yes.
set -euo pipefail
umask 077

program=${0##*/}

usage() {
  cat <<'EOF'
Usage: opencode-memory.sh [--apply] [--vacuum --yes]

Report the OpenCode data directory and the size of the database, WAL, log and
snapshot directory. The default is a dry run: no file is changed and it works
while OpenCode is running.

Options:
  --apply     Remove the contents of snapshot/ and rotate log/opencode.log to
              log/opencode.log.1. The database and tool-output/, repos/ and
              shell/ are never touched. Requires no running opencode process:
              a live process holds the log descriptor and snapshots are revert
              points.
  --vacuum    Implies --apply. Take a consistent SQLite backup of opencode.db
              with .backup to opencode.db.bak-<YYYYmmddHHMMSS>.XXXXXX (mode
              600), then run PRAGMA wal_checkpoint(TRUNCATE) and VACUUM
              through sqlite3. Requires --yes, sqlite3, and no running
              opencode process.
  --yes       Confirm the database backup and compaction for --vacuum.
  -h, --help  Print this help and exit.

Environment:
  OPENCODE_DATA_DIR   Data directory override.
  XDG_DATA_HOME       Used as $XDG_DATA_HOME/opencode when the override is unset.

The process check asks fuser whether any process holds opencode.db. When fuser
is unavailable it falls back to pgrep -x opencode, which matches only that exact
process name and can miss a differently named launcher. If neither tool is
available, --apply and --vacuum refuse to run.
EOF
}

size_kb() {
  local path=$1 output status size detail
  if [ ! -e "$path" ] && [ ! -L "$path" ]; then
    printf '0\n'
    return 0
  fi
  if command -v du >/dev/null 2>&1; then
    output=$(du -sk "$path" 2>&1) && status=0 || status=$?
    if [ "$status" -eq 0 ]; then
      size=$(printf '%s\n' "$output" | awk 'END { print $1 }')
      case "$size" in
        ''|*[!0-9]*)
          printf 'error: cannot measure %s: unexpected du output\n' "$path" >&2
          return 1
          ;;
      esac
      printf '%s\n' "$size"
      return 0
    fi
    detail=$(printf '%s\n' "$output" | sed -n '1p')
    if [ -z "$detail" ]; then
      detail="du failed with status $status"
    fi
    printf 'error: cannot measure %s: %s\n' "$path" "$detail" >&2
    return "$status"
  fi
  # Portable fallback only when du itself is unavailable.
  if [ -f "$path" ]; then
    if output=$(wc -c < "$path" 2>/dev/null); then
      size=$(printf '%s' "$output" | tr -d '[:space:]')
      case "$size" in
        ''|*[!0-9]*)
          printf 'error: cannot measure %s: unexpected wc output\n' "$path" >&2
          return 1
          ;;
      esac
      printf '%s\n' "$(( (size + 1023) / 1024 ))"
      return 0
    fi
    printf 'error: cannot read %s: permission denied\n' "$path" >&2
    return 1
  fi
  printf 'error: cannot measure %s: du is unavailable and the path is not a regular file\n' "$path" >&2
  return 1
}

human_kb() {
  awk -v kb="$1" 'BEGIN {
    if (kb >= 1048576) printf "%.1f GiB", kb / 1048576
    else if (kb >= 1024) printf "%.1f MiB", kb / 1024
    else printf "%d KiB", kb
  }'
}

describe_size() {
  local kb=$1
  if [ "$kb" -eq 0 ]; then
    printf '0 KiB'
  else
    printf '%s (%s KiB)' "$(human_kb "$kb")" "$kb"
  fi
}

count_entries() {
  local dir=$1 output status count detail
  if [ ! -e "$dir" ] && [ ! -L "$dir" ]; then
    printf '0\n'
    return 0
  fi
  if [ ! -d "$dir" ]; then
    printf 'error: cannot count entries in %s: not a directory\n' "$dir" >&2
    return 1
  fi
  output=$(find "$dir" -mindepth 1 -maxdepth 1 -print 2>&1) && status=0 || status=$?
  if [ "$status" -ne 0 ]; then
    detail=$(printf '%s\n' "$output" | sed -n '1p')
    if [ -z "$detail" ]; then
      detail="find failed with status $status"
    fi
    printf 'error: cannot read %s: %s\n' "$dir" "$detail" >&2
    return "$status"
  fi
  count=$(printf '%s' "$output" | awk 'END { print NR }')
  printf '%s\n' "${count:-0}"
}

apply=0
vacuum=0
yes=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=1
      ;;
    --vacuum)
      vacuum=1
      apply=1
      ;;
    --yes)
      yes=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'error: unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

primary_dir="${OPENCODE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/opencode}"
data_dir=$primary_dir
mac_dir=""
if [ ! -d "$data_dir" ] && [ "$(uname -s 2>/dev/null || true)" = "Darwin" ]; then
  mac_dir="$HOME/Library/Application Support/opencode"
  if [ -d "$mac_dir" ]; then
    data_dir=$mac_dir
  fi
fi
if [ ! -d "$data_dir" ]; then
  if [ -n "$mac_dir" ]; then
    printf 'error: OpenCode data directory not found (tried %s and %s)\n' \
      "$primary_dir" "$mac_dir" >&2
  else
    printf 'error: OpenCode data directory not found: %s\n' "$primary_dir" >&2
  fi
  exit 1
fi

db="$data_dir/opencode.db"
wal="$data_dir/opencode.db-wal"
log_dir="$data_dir/log"
log_file="$log_dir/opencode.log"
rotated_log="${log_file}.1"
snapshot_dir="$data_dir/snapshot"

opencode_running() {
  local status
  # Prefer the database holder: the process that matters is the one that has
  # the log descriptor and the database open, whatever its process name is.
  if command -v fuser >/dev/null 2>&1; then
    fuser -s "$db" >/dev/null 2>&1
    status=$?
    if [ "$status" -eq 0 ]; then
      return 0
    fi
    if [ "$status" -eq 1 ]; then
      return 1
    fi
    return 2
  fi
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -x opencode >/dev/null 2>&1
    status=$?
    if [ "$status" -eq 0 ]; then
      return 0
    fi
    if [ "$status" -eq 1 ]; then
      return 1
    fi
    return 2
  fi
  return 2
}

require_stopped() {
  local action=$1 status
  opencode_running && status=0 || status=$?
  case "$status" in
    0)
      printf 'error: refusing %s: an opencode process is running; stop OpenCode first; the running process holds the log descriptor and snapshots are revert points\n' \
        "$action" >&2
      return 1
      ;;
    2)
      printf 'error: refusing %s: cannot determine whether opencode is running (fuser and pgrep are missing or failed)\n' \
        "$action" >&2
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

if [ "$vacuum" -eq 1 ] && [ "$yes" -ne 1 ]; then
  printf 'error: refusing --vacuum without --yes: it backs up and rewrites the database; re-run as --vacuum --yes\n' >&2
  exit 1
fi

if [ "$apply" -eq 1 ]; then
  action=--apply
  if [ "$vacuum" -eq 1 ]; then
    action=--vacuum
  fi
  if ! require_stopped "$action"; then
    exit 1
  fi
fi

if [ "$vacuum" -eq 1 ]; then
  if ! command -v sqlite3 >/dev/null 2>&1; then
    printf 'error: refusing --vacuum: sqlite3 is not installed or not on PATH\n' >&2
    exit 1
  fi
  if [ ! -s "$db" ]; then
    printf 'error: refusing --vacuum: database is missing or zero bytes: %s\n' "$db" >&2
    exit 1
  fi
fi

if [ "$apply" -eq 0 ]; then
  db_kb=$(size_kb "$db")
  wal_kb=$(size_kb "$wal")
  log_kb=$(size_kb "$log_file")
  snapshot_kb=$(size_kb "$snapshot_dir")
  snapshot_entries=$(count_entries "$snapshot_dir")

  printf 'OpenCode data directory: %s\n\n' "$data_dir"
  printf '  %-20s %s\n' "opencode.db" "$(describe_size "$db_kb")"
  printf '  %-20s %s\n' "opencode.db-wal" "$(describe_size "$wal_kb")"
  printf '  %-20s %s\n' "log/opencode.log" "$(describe_size "$log_kb")"
  printf '  %-20s %s, %s entries\n' "snapshot/" "$(describe_size "$snapshot_kb")" "$snapshot_entries"
  printf '\nNo files were changed (dry run).\n\n'
  printf '%s\n' '--apply would:'
  printf '  - remove the contents of %s (%s entries)\n' "$snapshot_dir" "$snapshot_entries"
  printf '  - rotate %s (%s) to %s\n' "$log_file" "$(human_kb "$log_kb")" "$rotated_log"
  printf '%s\n' '--vacuum would:'
  printf '  - do the above, then take a consistent SQLite backup of %s to %s/opencode.db.bak-<YYYYmmddHHMMSS>.XXXXXX (mode 600)\n' "$db" "$data_dir"
  printf '%s\n' '  - run PRAGMA wal_checkpoint(TRUNCATE) and VACUUM through sqlite3'
  printf '%s\n' '  - require --yes and a stopped opencode process'
  exit 0
fi

printf 'Applying cleanup in %s\n' "$data_dir"

if [ -d "$snapshot_dir" ]; then
  snapshot_entries=$(count_entries "$snapshot_dir")
  if [ "$snapshot_entries" -eq 0 ]; then
    printf '%s\n' 'snapshot/: already empty; nothing to prune.'
  else
    if ! find "$snapshot_dir" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; then
      printf 'error: failed to remove the contents of %s\n' "$snapshot_dir" >&2
      exit 1
    fi
    printf 'snapshot/: removed %s entries.\n' "$snapshot_entries"
  fi
else
  printf '%s\n' 'snapshot/: directory not present; nothing to prune.'
fi

if [ -s "$log_file" ]; then
  log_kb=$(size_kb "$log_file")
  if ! mv -f "$log_file" "$rotated_log"; then
    printf 'error: failed to rotate %s\n' "$log_file" >&2
    exit 1
  fi
  if ! : > "$log_file"; then
    printf 'error: failed to create an empty %s\n' "$log_file" >&2
    exit 1
  fi
  printf 'log/opencode.log: rotated %s to log/opencode.log.1.\n' "$(human_kb "$log_kb")"
elif [ -e "$log_file" ]; then
  printf '%s\n' 'log/opencode.log: already empty; not rotated.'
else
  printf '%s\n' 'log/opencode.log: not present; nothing to rotate.'
fi

if [ "$vacuum" -eq 0 ]; then
  printf 'Cleanup complete. Database untouched: %s\n' "$db"
  exit 0
fi

# Re-check the stopped process before writing the backup, in case something
# started between the preflight and the cleanup.
if ! require_stopped "--vacuum"; then
  printf '%s\n' 'No backup was written; the database was not vacuumed.' >&2
  exit 1
fi

db_before_kb=$(size_kb "$db")

# mktemp creates the path exclusively, so a predictable name cannot be
# pre-created to redirect the backup. The random suffix keeps the path
# unpredictable between runs.
backup_template="$data_dir/opencode.db.bak-$(date +%Y%m%d%H%M%S).XXXXXX"
if ! backup=$(mktemp "$backup_template"); then
  printf 'error: refusing --vacuum: could not create a unique backup path in %s\n' "$data_dir" >&2
  exit 1
fi
if [ -L "$backup" ] || [ ! -f "$backup" ]; then
  printf 'error: refusing --vacuum: backup path is not a regular file: %s\n' "$backup" >&2
  exit 1
fi

if ! sqlite3 "$db" ".backup '$backup'"; then
  rm -f -- "$backup" || true
  if [ -e "$backup" ] || [ -L "$backup" ]; then
    printf 'error: SQLite .backup failed; partial backup could not be removed: %s; database was not vacuumed\n' "$backup" >&2
  else
    printf 'error: SQLite .backup failed; no backup written to %s; database was not vacuumed\n' "$backup" >&2
  fi
  exit 1
fi
if ! chmod 600 "$backup"; then
  printf 'error: backup written but its mode could not be set to 600: %s; database was not vacuumed\n' "$backup" >&2
  exit 1
fi
printf 'Backup written to %s\n' "$backup"

if ! sqlite3 "$db" "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;" >/dev/null; then
  printf 'error: vacuum failed; backup retained at %s\n' "$backup" >&2
  exit 1
fi

db_after_kb=$(size_kb "$db")
printf 'Database before: %s\n' "$(describe_size "$db_before_kb")"
printf 'Database after:  %s\n' "$(describe_size "$db_after_kb")"
printf 'Vacuum complete. Backup retained at %s\n' "$backup"
