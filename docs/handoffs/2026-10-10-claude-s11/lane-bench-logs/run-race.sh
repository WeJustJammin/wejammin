#!/usr/bin/env bash
# run-race.sh <label> <node-script> [reset=1] -- reset the main stack to the Slice 11 worktree migrations (unless reset=0),
# then run the race runner under the supabase-ci lock and a SHARED quiet lock. Log: lane-bench-logs/race-<label>.log
set -uo pipefail
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
LABEL="$1"; SCRIPT="$2"; RESET="${3:-1}"
SUPA=$LANE/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGDIR="$LANE/docs/handoffs/2026-10-10-claude-s11/lane-bench-logs"; mkdir -p "$LOGDIR" "$LANE/.lane-logs"
LOG="$LOGDIR/race-$LABEL.log"
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || exit 3
exec 8>/tmp/wejammin-quiet.lock; flock -s --wait 7200 8 || exit 3
cd "$LANE" || exit 4
if [ "$RESET" = 1 ]; then
  flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$LANE" > "$LANE/.lane-logs/race-reset-$LABEL.log" 2>&1 || { echo "RESET FAILED"; tail -20 "$LANE/.lane-logs/race-reset-$LABEL.log"; exit 2; }
  echo "[race] reset ok $(date +%T)"
fi
node "$SCRIPT" > "$LOG" 2>&1; RC=$?
echo "[race] $LABEL exit=$RC log=$LOG"
grep -E "^ok - |^# |ASSERTION FAILED|Error" "$LOG" | cut -c1-260 | head -80
exit $RC
