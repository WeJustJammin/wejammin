#!/usr/bin/env bash
# Lane "e2e" verification window. Run it INSIDE the CI lock and the quiet lock, from the snapshot checkout:
#   flock -s /tmp/wejammin-quiet.lock bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh \
#     "$SNAP" bash <this file> <tag> <parts>
# <parts> is any of: units, red, targeted, full (comma separated). Output files are <tag>-*.log under lane-e2e-logs/.
# The snapshot is a copy of the worktree made with rsync (see the lane report); every part runs from it, so a
# concurrent lane's edit never changes the tree under a running browser suite.
set -uo pipefail
SNAP=/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-snap
OUT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin/docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs
TAG="$1"
PARTS="${2:-units,targeted,full}"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$SNAP" || exit 4

sample() {
  echo "[$1] $(date +%T) loadavg $(cut -d' ' -f1-3 /proc/loadavg)"
  ps -eo pcpu,pid,args --sort=-pcpu | sed -n '2,6p' | cut -c1-170
}

vmstat -n 5 >"$OUT/$TAG-vmstat.log" 2>&1 &
VMSTAT=$!
trap 'kill "$VMSTAT" 2>/dev/null' EXIT

case ",$PARTS," in
  *,units,*)
    for round in 1 2 3; do
      {
        sample "units round $round start"
        pnpm exec vitest run \
          apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts \
          apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts \
          tests/e2e/support/s11-dst-gap.test.ts 2>&1
        echo "[units round $round] exit=$?"
        sample "units round $round end"
      } >"$OUT/$TAG-units-$round.log" 2>&1
    done
    ;;
esac

case ",$PARTS," in
  *,red,*)
    # RED for the two Slice 11 specs: the pre-fix spec (commit 0fd4bf31, the base this lane started from) run on the
    # snapshot. RR-06 three times (it is serial with RR-07, so RR-07 runs in its own invocation), then the fixed spec
    # is restored from the worktree.
    WT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
    SPEC=tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts
    git -C "$WT" show "0fd4bf31:$SPEC" >"$SNAP/$SPEC"
    {
      sample "red RR-06 start"
      timeout 3600 pnpm exec playwright test --config=playwright.s09-real.config.ts "$SPEC" \
        --grep 'S11-RR-06' --repeat-each=3 2>&1
      echo "[red RR-06] exit=$?"
      sample "red RR-06 end"
    } >"$OUT/$TAG-red-rr06.log" 2>&1
    {
      sample "red RR-07 start"
      timeout 3600 pnpm exec playwright test --config=playwright.s09-real.config.ts "$SPEC" \
        --grep 'S11-RR-07' 2>&1
      echo "[red RR-07] exit=$?"
      sample "red RR-07 end"
    } >"$OUT/$TAG-red-rr07.log" 2>&1
    cp "$WT/$SPEC" "$SNAP/$SPEC"
    ;;
esac

case ",$PARTS," in
  *,targeted,*)
    {
      sample "targeted start"
      timeout 5400 pnpm exec playwright test --config=playwright.s09-real.config.ts \
        tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts \
        tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts \
        tests/e2e/phase-02-slice-12-locale-real-route.spec.ts \
        tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts \
        tests/e2e/phase-02-slice-09-review-layout-real-route.spec.ts \
        tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts \
        tests/e2e/phase-02-slice-09-web-vitals-real-route.spec.ts 2>&1
      echo "[targeted] exit=$?"
      sample "targeted end"
    } >"$OUT/$TAG-targeted.log" 2>&1
    ;;
esac

case ",$PARTS," in
  *,full,*)
    {
      sample "full start"
      timeout 7200 pnpm test:e2e 2>&1
      echo "[full] exit=$?"
      sample "full end"
    } >"$OUT/$TAG-full.log" 2>&1
    ;;
esac
