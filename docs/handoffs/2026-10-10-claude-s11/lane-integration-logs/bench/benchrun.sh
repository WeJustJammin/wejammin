#!/usr/bin/env bash
# benchrun.sh <LANE> <label> <runs> [sqlfile]  -- NO reset; holds quiet lock exclusively
set -uo pipefail
LANE="$1"; LABEL="$2"; RUNS="$3"; FILE="${4:-supabase/tests/phase_02_slice_09_evidence_bench128.sql}"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS="/home/rob/.codex/worktrees/phase2-slice11/WeJammin/.lane-logs"; mkdir -p "$LOGS"
exec 9>/tmp/wejammin-supabase-ci.lock
flock --wait 3600 9 || exit 3
exec 8>/tmp/wejammin-quiet.lock
flock -x --wait 7200 8 || { echo "quiet lock timeout"; exit 3; }
# wait for the 1-minute load to fall below 2.0 (max 5 min)
for i in $(seq 1 60); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<2.0)}" && break; sleep 5; done
echo "[bench] $LABEL start load=$(cut -d' ' -f1-3 /proc/loadavg)"
for i in $(seq 1 "$RUNS"); do
  b=$(cut -d' ' -f1 /proc/loadavg)
  node "$LANE/infra/run-pgtap-verbose.mjs" --out "$LOGS/bench-$LABEL-$i.tap" "$FILE" > /dev/null; RC=$?
  echo "[bench] $LABEL run $i exit=$RC load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg)"
  grep -E '^# (create128|dry_run|submit|assign|decide|activate)' "$LOGS/bench-$LABEL-$i.tap" | grep -v "non-normative" | sed 's/\[P2.*//'
  grep -E '^not ok' "$LOGS/bench-$LABEL-$i.tap" | head -3
done
