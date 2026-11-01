#!/usr/bin/env bash
# Lane evidence-gaps: does the latency world disturb the suites that share the committed Slice 11 database?
# One reset, then the latency apispec FIRST, then the two suites that read the shared owner's registry and creatable types.
# Usage: api-coupling-check.sh <checkout-abs-path> <out-dir>   (run under `flock -s /tmp/wejammin-quiet.lock`)
set -uo pipefail
LANE="$1"; OUT="$2"; mkdir -p "$OUT"
SUPA="$LANE/node_modules/.bin/supabase"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
exec 9>/tmp/wejammin-supabase-ci.lock
flock --wait 3600 9 || { echo "[coupling] CI lock timeout"; exit 3; }
cd "$LANE" || exit 4
flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$LANE" > "$OUT/coupling-reset.log" 2>&1 || { echo "[coupling] RESET FAILED"; exit 2; }
pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/phase-02-slice-11-read-latency.apispec.ts > "$OUT/coupling-1-latency.log" 2>&1; echo "[coupling] latency rc=$?"
pnpm exec vitest run --config vitest.postgrest.config.ts tests/postgrest/worker-round-trip.apispec.ts tests/postgrest/phase-02-slice-11-world-isolation.apispec.ts tests/postgrest/phase-02-slice-11-read-queue.apispec.ts tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts > "$OUT/coupling-2-neighbours.log" 2>&1; echo "[coupling] neighbours rc=$?"
grep -E '×|FAIL|Test Files|Tests  ' "$OUT"/coupling-?-*.log | head -30
