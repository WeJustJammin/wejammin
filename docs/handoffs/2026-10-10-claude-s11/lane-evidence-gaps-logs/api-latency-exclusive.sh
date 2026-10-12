#!/usr/bin/env bash
# Composed read-latency measurement on the MAIN stack (lane evidence-gaps, items AC-052 / AC-058 / AC-064).
# Usage: api-latency-exclusive.sh <checkout-abs-path> <runs> <out-dir>
#
# Like lanes/lane-db-alt.sh's bench variant and lanes/gate-db-verify.sh, a latency measurement needs the host to itself:
# the quiet lock is taken EXCLUSIVELY (no lane runs beside it) before the CI lock, in the gate's order. Each run is
# reset -> wait for a one-minute load average under 1.5 -> the apispec, so every run measures a freshly built world on a
# freshly reset database. The apispec appends one JSON line per measurement (raw samples included) to S11_LATENCY_LOG.
set -uo pipefail
LANE="$1"; RUNS="$2"; OUT="$3"
SUPA="$LANE/node_modules/.bin/supabase"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
mkdir -p "$OUT"
exec 7>/tmp/wejammin-quiet.lock
flock -x --wait 14400 7 || { echo "[api-latency] quiet lock timeout"; exit 3; }
echo "[api-latency] quiet lock held exclusively $(date +%T)"
exec 9>/tmp/wejammin-supabase-ci.lock
flock --wait 3600 9 || { echo "[api-latency] CI lock timeout"; exit 3; }
echo "[api-latency] CI lock held $(date +%T)"
cd "$LANE" || exit 4
echo "[api-latency] HEAD=$(git rev-parse HEAD) node=$(node --version) pnpm=$(pnpm --version)" | tee "$OUT/runs.txt"
RC_ALL=0
for run in $(seq 1 "$RUNS"); do
  if ! flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$LANE" > "$OUT/reset-run$run.log" 2>&1; then
    echo "[api-latency] RESET FAILED (run $run)"; tail -25 "$OUT/reset-run$run.log"; exit 2; fi
  for _ in $(seq 1 360); do
    LOAD=$(cut -d' ' -f1 /proc/loadavg)
    if awk -v l="$LOAD" 'BEGIN{exit !(l < 1.5)}'; then break; fi
    sleep 5
  done
  echo "[api-latency] run $run load average before the apispec: $(cut -d' ' -f1-3 /proc/loadavg) at $(date +%T)" | tee -a "$OUT/runs.txt"
  : > "$OUT/samples-run$run.jsonl"
  S11_LATENCY_LOG="$OUT/samples-run$run.jsonl" pnpm exec vitest run --config vitest.postgrest.config.ts \
    tests/postgrest/phase-02-slice-11-read-latency.apispec.ts > "$OUT/vitest-run$run.log" 2>&1; RC=$?
  echo "[api-latency] run $run vitest exit=$RC load average after: $(cut -d' ' -f1-3 /proc/loadavg)" | tee -a "$OUT/runs.txt"
  grep -E '×|FAIL|Test Files|Tests  ' "$OUT/vitest-run$run.log" | head -20
  [ "$RC" -eq 0 ] || RC_ALL=1
done
exit $RC_ALL
