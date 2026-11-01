#!/usr/bin/env bash
# bench.sh <LANE> <label> <runs> [sqlfile]
# Reset main stack to LANE's migrations (supabase-ci lock), then run the bench <runs> times while holding
# the quiet lock EXCLUSIVELY. Prints load before/after each run and the diag lines.
set -uo pipefail
LANE="$1"; LABEL="$2"; RUNS="$3"; FILE="${4:-supabase/tests/phase_02_slice_09_evidence_bench128.sql}"
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs"; mkdir -p "$LOGS"
exec 9>/tmp/wejammin-supabase-ci.lock
echo "[bench] waiting supabase-ci lock $(date +%T)"; flock --wait 3600 9 || exit 3
echo "[bench] acquired $(date +%T)"; cd "$LANE" || exit 4
if ! flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$LANE" > "$LOGS/bench-reset-$LABEL.log" 2>&1; then
  echo "[bench] RESET FAILED"; tail -25 "$LOGS/bench-reset-$LABEL.log"; exit 2; fi
echo "[bench] reset ok $(date +%T)"
sleep 20
exec 8>/tmp/wejammin-quiet.lock
flock -x --wait 7200 8 || { echo "quiet lock timeout"; exit 3; }
for i in $(seq 1 90); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<2.0)}" && break; sleep 5; done
echo "[bench] quiet lock held exclusively $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)"
for i in $(seq 1 "$RUNS"); do
  echo "[bench] run $i load_before=$(cut -d' ' -f1-3 /proc/loadavg)"
  node "$LANE/infra/run-pgtap-verbose.mjs" --out "$LOGS/bench-$LABEL-$i.tap" "$FILE" > /dev/null; RC=$?
  echo "[bench] run $i exit=$RC load_after=$(cut -d' ' -f1-3 /proc/loadavg)"
  grep -E '^# (create128|dry_run|submit|assign|decide|activate)' "$LOGS/bench-$LABEL-$i.tap" | sed 's/\[P2.*//'
  grep -E '^(not ok|Result)' "$LOGS/bench-$LABEL-$i.tap" | head
done
