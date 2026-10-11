#!/usr/bin/env bash
# probe.sh <label> <sqlfile relative to $S/probe> -- NO reset; both locks; waits for load<2.0 (max 3 min)
set -uo pipefail
S=/tmp/claude-1000/-home-rob-Projects-WeJammin/7aaa9e49-fdde-440a-9c62-f82994358a13/scratchpad
LABEL="$1"; FILE="$2"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
exec 9>/tmp/wejammin-supabase-ci.lock; flock --wait 3600 9 || exit 3
exec 8>/tmp/wejammin-quiet.lock; flock -x --wait 7200 8 || exit 3
for i in $(seq 1 36); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<2.0)}" && break; sleep 5; done
echo "[probe] $LABEL load_before=$(cut -d' ' -f1-3 /proc/loadavg)"
node $S/probe/infra/run-pgtap-verbose.mjs --out $S/probe-$LABEL.tap "$FILE" > /dev/null; RC=$?
echo "[probe] $LABEL exit=$RC load_after=$(cut -d' ' -f1-3 /proc/loadavg)"
grep -E '^(# |not ok|Result)|ERROR|rror:' $S/probe-$LABEL.tap | grep -v NOTICE | head -80
