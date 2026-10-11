#!/usr/bin/env bash
# Bench2 lane library (sourced by the job scripts in this directory). Derived from lane-bench-logs/altrun.sh, which is
# derived from lanes/lane-db-alt.sh, and keeps its lock discipline: quiet lock first (EXCLUSIVE here, because every job
# measures), then /tmp/wejammin-altdb.lock, resets under /tmp/wejammin-reset.lock.
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=$LANE/node_modules/.bin/supabase
SCRATCH=/tmp/claude-1000/-home-rob-Projects-WeJammin/7aaa9e49-fdde-440a-9c62-f82994358a13/scratchpad
PROBES=$SCRATCH/bench2-lane
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS=$LANE/docs/handoffs/2026-10-10-claude-s11/lane-bench2-logs; mkdir -p "$LOGS"
BENCH=phase_02_slice_09_evidence_bench128.sql
b2_init() { # b2_init <job-name>
  JOB="$1"; STAMP=$(date +%Y%m%d-%H%M%S); SUMMARY="$LOGS/$JOB-$STAMP.summary"
  [ "$(readlink -f "$ALT/supabase/migrations")" = "$(readlink -f "$LANE/supabase/migrations")" ] || { echo "[b2] alt stack is not linked to $LANE"; exit 5; }
  exec 7>/tmp/wejammin-quiet.lock
  echo "[b2] $JOB waiting for EXCLUSIVE quiet lock $(date +%T)" | tee -a "$SUMMARY"
  flock -x --wait 14400 7 || { echo "[b2] quiet lock timeout" | tee -a "$SUMMARY"; exit 3; }
  exec 9>/tmp/wejammin-altdb.lock
  flock --wait 3600 9 || { echo "[b2] alt lock timeout" | tee -a "$SUMMARY"; exit 3; }
  echo "[b2] $JOB locks held $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg) HEAD=$(git -C "$LANE" rev-parse --short HEAD) dirty=$(git -C "$LANE" status --porcelain | wc -l)" | tee -a "$SUMMARY"
  echo "[b2] migrations of this lane in the tree: $(cd "$LANE/supabase/migrations" && ls 202610101[67]*.sql | tr '\n' ' ')" | tee -a "$SUMMARY"
  echo "[b2] sha256 of those migrations: $(cd "$LANE/supabase/migrations" && sha256sum 2026101016[67]*.sql 2026101017*.sql 2>/dev/null | cut -c1-12 | tr '\n' ' ')" | tee -a "$SUMMARY"
  IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'supabase/pg_prove:')
  PW=$(docker inspect supabase_db_wejammin_ev --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
}
b2_reset() { # b2_reset <label>
  if ! flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$ALT" > "$LOGS/$JOB-$STAMP-reset-$1.log" 2>&1; then
    echo "[b2] RESET FAILED:" | tee -a "$SUMMARY"; grep -v '^$' "$LOGS/$JOB-$STAMP-reset-$1.log" | tail -25 | tee -a "$SUMMARY"; exit 2; fi
  echo "[b2] reset ok ($1) $(date +%T)" | tee -a "$SUMMARY"
}
b2_prove() { # b2_prove <tap-out> <container-path>...   (container paths: /w/supabase/tests/<f> or /w/scratch/bench2-lane/<f>)
  local tap="$1"; shift
  PGPASSWORD="$PW" docker run --rm --network supabase_network_wejammin_ev -v "$LANE/supabase/tests:/w/supabase/tests:ro" -v "$SCRATCH:/w/scratch:ro" \
    -e PGHOST=supabase_db_wejammin_ev -e PGUSER=postgres -e PGPASSWORD -e PGDATABASE=postgres \
    "$IMAGE" pg_prove -v --ext .sql "$@" > "$tap" 2>&1
}
b2_prefix() { # run every test file that sorts before the bench file, in pg_prove's order, exactly as the canonical suite does
  local files=() f
  while IFS= read -r f; do files+=("/w/supabase/tests/$f"); done < <(cd "$LANE/supabase/tests" && ls *.sql | LC_ALL=C sort | sed "/^$BENCH\$/,\$d")
  local t0=$(date +%s)
  b2_prove "$LOGS/$JOB-$STAMP-prefix-$1.tap" "${files[@]}"; local rc=$?
  echo "[b2] prefix ($1): ${#files[@]} files, exit=$rc, $(( $(date +%s) - t0 ))s, failing: $(grep -cE '^\s*not ok' "$LOGS/$JOB-$STAMP-prefix-$1.tap") $(date +%T)" | tee -a "$SUMMARY"
}
b2_waitload() { # wait for the 1-minute load average < 1.5 (at most 15 minutes)
  local i l
  for i in $(seq 1 180); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<1.5)}" && break; sleep 5; done
}
b2_bench() { # b2_bench <label>: the unmodified bench file
  b2_waitload
  local b=$(cut -d' ' -f1 /proc/loadavg) tap="$LOGS/$JOB-$STAMP-bench-$1.tap"
  b2_prove "$tap" "/w/supabase/tests/$BENCH"; local rc=$?
  echo "[b2] bench ($1) exit=$rc load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg) $(date +%T)" | tee -a "$SUMMARY"
  grep -E '^# (activate|assign|create128|decide|dry_run|submit) p50' "$tap" | tee -a "$SUMMARY"
  grep -E '^\s*not ok' "$tap" | head -5 | tee -a "$SUMMARY"
}
b2_probe() { # b2_probe <label> <probe-file> : a probe from $PROBES, after waiting for load
  b2_waitload
  local tap="$LOGS/$JOB-$STAMP-$1.tap"
  b2_prove "$tap" "/w/scratch/bench2-lane/$2"; echo "[b2] probe $1 ($2) load_after=$(cut -d' ' -f1 /proc/loadavg) tap=$tap" | tee -a "$SUMMARY"
  grep -E '^# ' "$tap" | head -${3:-150} | tee -a "$SUMMARY.$1"
}
