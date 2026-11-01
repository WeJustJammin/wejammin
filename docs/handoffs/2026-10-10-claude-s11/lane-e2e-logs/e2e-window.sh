#!/usr/bin/env bash
# Lane "e2e" verification window. Run it INSIDE the CI lock and the quiet lock, from the snapshot checkout:
#   flock -s /tmp/wejammin-quiet.lock bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-e2e.sh \
#     "$SNAP" bash <this file> <tag> <parts>
# (lane-e2e.sh takes /tmp/wejammin-supabase-ci.lock for the whole run and resets the shared stack to the snapshot's
# migrations first.) <parts> is any of, comma separated:
#   units     max-input (UNITS_VARIANTS="lane committed" runs the lane's file and HEAD's copy, 5 rounds each), the DST helper, the sweep deadline
#   s10red    the committed (pre-fix) S10 entry-list spec: RED
#   rrred     the committed (pre-fix) S11 workflow spec, RR-06 and RR-07 only, 5 repeats: RED / flake rate
#   probe     the confirmation-lifetime and short-grant probes (measurements only)
#   rrflake   the lane's S11 workflow spec as it stands, RR-05/06/07/09 only, 10 repeats: the confirmation-race rate
#   fixed     the fixed S10 entry-list and S11 workflow specs, 3 repeats: GREEN
#   targeted  the intermittent S09 / S12 specs plus the two fixed specs, once
#   full      one `pnpm test:e2e` (functional project, then the real-route suite)
# Output: <tag>-<part>*.log under lane-e2e-logs/. Every part waits (up to 10 minutes) for a 1-minute load average
# below 1.5, and samples the load and the busiest processes before and after, so the report can state how quiet it was.
set -uo pipefail
WT=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
SNAP=/home/rob/.codex/worktrees/phase2-slice11/lane-e2e-snap
OUT="$WT/docs/handoffs/2026-10-10-claude-s11/lane-e2e-logs"
TAG="${1:?usage: e2e-window.sh <tag> <parts>}"
PARTS="${2:-units,s10red,rrred,probe,fixed,targeted}"
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
cd "$SNAP" || exit 4

S10=tests/e2e/phase-02-slice-10-entry-list-real-route.spec.ts
S11=tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts
MAXIN=apps/worker/src/cms-editorial/a11y-structural/max-input.test.ts
PROBE_FILES=(
  apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts
  tests/e2e/zz-lane-e2e-probe.spec.ts
  playwright.lane-e2e-probe.config.ts
  apps/worker/src/cms-editorial/a11y-structural/max-input-committed.test.ts
)

sample() {
  echo "[$1] $(date +%T) loadavg $(cut -d' ' -f1-3 /proc/loadavg)"
  ps -eo pcpu,pid,args --sort=-pcpu | sed -n '2,6p' | cut -c1-150
}

wait_quiet() {
  local waited=0 load
  while :; do
    load=$(cut -d' ' -f1 /proc/loadavg)
    if awk -v l="$load" 'BEGIN { exit !(l < 1.5) }'; then break; fi
    if [ "$waited" -ge 600 ]; then echo "[wait_quiet] gave up after 600 s at load $load"; break; fi
    sleep 15
    waited=$((waited + 15))
  done
  echo "[wait_quiet] waited ${waited} s, load $(cut -d' ' -f1-3 /proc/loadavg)"
}

restore_owned() {
  # Whatever a part swapped in the snapshot, the lane's versions are the ones left behind.
  for f in "$S10" "$S11" "$MAXIN"; do cp "$WT/$f" "$SNAP/$f"; done
  rm -f "${PROBE_FILES[@]}"
}

vmstat -n 5 >"$OUT/$TAG-vmstat.log" 2>&1 &
VMSTAT=$!
cleanup() { restore_owned; kill "$VMSTAT" 2>/dev/null; }
trap cleanup EXIT

has() { case ",$PARTS," in *,"$1",*) return 0 ;; *) return 1 ;; esac; }
PW=(pnpm exec playwright test --config=playwright.s09-real.config.ts)

if has units; then
  git -C "$WT" show "HEAD:$MAXIN" >"$SNAP/apps/worker/src/cms-editorial/a11y-structural/max-input-committed.test.ts"
  for variant in ${UNITS_VARIANTS:-lane}; do
    file="$MAXIN"
    [ "$variant" = committed ] && file=apps/worker/src/cms-editorial/a11y-structural/max-input-committed.test.ts
    for round in 1 2 3 4 5; do
      wait_quiet
      {
        sample "units max-input $variant round $round start"
        pnpm exec vitest run --reporter=verbose "$file" 2>&1
        echo "[units max-input $variant round $round] exit=$?"
        sample "units max-input $variant round $round end"
      } >"$OUT/$TAG-units-maxinput-$variant-$round.log" 2>&1
    done
  done
  rm -f apps/worker/src/cms-editorial/a11y-structural/max-input-committed.test.ts
  wait_quiet
  {
    sample "units other start"
    pnpm exec vitest run \
      apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts \
      tests/e2e/support/s11-dst-gap.test.ts 2>&1
    echo "[units other] exit=$?"
    sample "units other end"
  } >"$OUT/$TAG-units-other.log" 2>&1
fi

if has s10red; then
  git -C "$WT" show "HEAD:$S10" >"$SNAP/$S10"
  wait_quiet
  {
    sample "s10 red start"
    timeout 3000 "${PW[@]}" "$S10" 2>&1
    echo "[s10 red] exit=$?"
    sample "s10 red end"
  } >"$OUT/$TAG-s10red.log" 2>&1
  cp "$WT/$S10" "$SNAP/$S10"
fi

if has rrred; then
  git -C "$WT" show "HEAD:$S11" >"$SNAP/$S11"
  wait_quiet
  {
    sample "rr red start"
    timeout 3600 "${PW[@]}" "$S11" --grep 'S11-RR-0[67]' --repeat-each=5 2>&1
    echo "[rr red] exit=$?"
    sample "rr red end"
  } >"$OUT/$TAG-rrred.log" 2>&1
  cp "$WT/$S11" "$SNAP/$S11"
fi

if has probe; then
  cp "$OUT/probe/zz-lane-e2e-max-input-probe.test.ts" apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts
  cp "$OUT/probe/zz-lane-e2e-probe.spec.ts" tests/e2e/zz-lane-e2e-probe.spec.ts
  cp "$OUT/probe/playwright.lane-e2e-probe.config.ts" playwright.lane-e2e-probe.config.ts
  : >"$OUT/$TAG-probe-browser.txt"
  : >"$OUT/$TAG-probe-max-input.txt"
  wait_quiet
  {
    sample "probe max-input phases start"
    PROBE_OUT="$OUT/$TAG-probe-max-input.txt" pnpm exec vitest run \
      apps/worker/src/cms-editorial/a11y-structural/zz-lane-e2e-probe.test.ts 2>&1 | tail -8
    sample "probe max-input phases end"
  } >"$OUT/$TAG-probe-max-input-run.log" 2>&1
  wait_quiet
  {
    sample "probe start"
    PROBE_OUT="$OUT/$TAG-probe-browser.txt" timeout 3000 pnpm exec playwright test \
      --config=playwright.lane-e2e-probe.config.ts 2>&1
    echo "[probe] exit=$?"
    sample "probe end"
  } >"$OUT/$TAG-probe.log" 2>&1
  rm -f "${PROBE_FILES[@]}"
fi

if has rrflake; then
  wait_quiet
  {
    sample "rr flake start"
    timeout 3600 "${PW[@]}" "$S11" --grep 'S11-RR-0[5679]' --repeat-each=10 2>&1
    echo "[rr flake] exit=$?"
    sample "rr flake end"
  } >"$OUT/$TAG-rrflake.log" 2>&1
fi

if has fixed; then
  wait_quiet
  {
    sample "fixed start"
    timeout 3600 "${PW[@]}" "$S10" "$S11" --repeat-each=3 2>&1
    echo "[fixed] exit=$?"
    sample "fixed end"
  } >"$OUT/$TAG-fixed.log" 2>&1
fi

if has targeted; then
  wait_quiet
  {
    sample "targeted start"
    timeout 5400 "${PW[@]}" \
      "$S10" "$S11" \
      tests/e2e/phase-02-slice-12-locale-real-route.spec.ts \
      tests/e2e/phase-02-slice-09-capability-grants-real-route.spec.ts \
      tests/e2e/phase-02-slice-09-review-layout-real-route.spec.ts \
      tests/e2e/phase-02-slice-09-registry-layout-real-route.spec.ts \
      tests/e2e/phase-02-slice-09-web-vitals-real-route.spec.ts 2>&1
    echo "[targeted] exit=$?"
    sample "targeted end"
  } >"$OUT/$TAG-targeted.log" 2>&1
fi

if has full; then
  wait_quiet
  {
    sample "full start"
    timeout 7200 pnpm test:e2e 2>&1
    echo "[full] exit=$?"
    sample "full end"
  } >"$OUT/$TAG-full.log" 2>&1
fi
