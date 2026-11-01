#!/usr/bin/env bash
# Lane queue-perf: `supabase db lint` (the db:lint stage of db:verify) against the ALT stack's current state.
# Holds the quiet lock shared and the alt-stack lock like lane-db-alt.sh; does not reset (run lane-db-alt.sh first).
set -uo pipefail
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/node_modules/.bin/supabase
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
exec 7>/tmp/wejammin-quiet.lock; flock -s --wait 7200 7 || { echo "quiet lock timeout"; exit 3; }
exec 9>/tmp/wejammin-altdb.lock; flock --wait 3600 9 || { echo "alt lock timeout"; exit 3; }
"$SUPA" db lint --local --workdir "$ALT" --level warning --schema platform_private,audit_private,platform_api,public_api
echo "lint exit=$?"
