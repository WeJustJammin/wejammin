#!/usr/bin/env bash
# Lane "e2e" diagnostic window (measurements only; nothing here is acceptance evidence). Run it inside the CI lock
# and the quiet lock, from the snapshot checkout, like e2e-window.sh:
#   flock -s /tmp/wejammin-quiet.lock bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh \
#     "$SNAP" bash <this file> <tag>
# It copies the temporary probe files from probe/ into the SNAPSHOT only, runs them, and removes them again:
#   1. max-input.test.ts verbose, three rounds (the whole-gate wall time the test sees);
#   2. a vitest probe that splits the maximum-node gate into JSON parse, schema validation and checker, with wall
#      and CPU time per round;
#   3. a Playwright probe that records how long the decision confirmation stays on the page (S11-RR-06) and what the
#      page says when a publisher whose grant ends in 30 days schedules a date after the grant (S11-RR-07).
set -uo pipefail
SNAP=/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-snap
OUT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs
TAG="$1"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$SNAP" || exit 4

sample() { echo "[$1] $(date +%T) loadavg $(cut -d' ' -f1-3 /proc/loadavg)"; }

STAGED=(
  apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts
  tests/e2e/zz-lane-e2e-probe.spec.ts
  playwright.lane-e2e-probe.config.ts
)
cleanup() { rm -f "${STAGED[@]}"; kill "$VMSTAT" 2>/dev/null; }
vmstat -n 5 >"$OUT/$TAG-vmstat.log" 2>&1 &
VMSTAT=$!
trap cleanup EXIT

cp "$OUT/probe/zz-lane-e2e-max-input-probe.test.ts" apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts
cp "$OUT/probe/zz-lane-e2e-probe.spec.ts" tests/e2e/zz-lane-e2e-probe.spec.ts
cp "$OUT/probe/playwright.lane-e2e-probe.config.ts" playwright.lane-e2e-probe.config.ts

for round in 1 2 3; do
  {
    sample "max-input verbose round $round"
    pnpm exec vitest run --reporter=verbose apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts 2>&1
    echo "[max-input verbose round $round] exit=$?"
  } >"$OUT/$TAG-max-input-verbose-$round.log" 2>&1
done

: >"$OUT/$TAG-max-input-phases.log"
{
  sample "max-input phases"
  PROBE_OUT="$OUT/$TAG-max-input-phases.log" pnpm exec vitest run \
    apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts 2>&1 | tail -8
  sample "max-input phases end"
} >"$OUT/$TAG-max-input-phases-run.log" 2>&1

: >"$OUT/$TAG-browser-probe.log"
{
  sample "browser probe"
  PROBE_OUT="$OUT/$TAG-browser-probe.log" timeout 3000 pnpm exec playwright test \
    --config=playwright.lane-e2e-probe.config.ts 2>&1
  echo "[browser probe] exit=$?"
  sample "browser probe end"
} >"$OUT/$TAG-browser-probe-run.log" 2>&1
