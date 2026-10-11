#!/usr/bin/env bash
# Bench-lane runner on the SECOND local Supabase stack (project wejammin_ev). Derived from lanes/lane-db-alt.sh and
# keeps its lock discipline: quiet lock first, then /tmp/wejammin-altdb.lock, resets under /tmp/wejammin-reset.lock.
#   altrun.sh reset                      reset the alt stack to the worktree's migrations (quiet lock SHARED)
#   altrun.sh run <abs-sql-file>...      no reset; quiet lock SHARED; pg_prove the files (mounts: worktree tests at
#                                        /w/supabase/tests, SCRATCH at /w/scratch)
#   altrun.sh bench <label> <runs> <file> no reset; quiet lock EXCLUSIVE; waits for the 1-minute load < 1.5; <runs> runs
set -uo pipefail
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
ALT=/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb
SUPA=$LANE/node_modules/.bin/supabase
SCRATCH=/tmp/claude-1000/-home-rob-Projects-WeJammin/7aaa9e49-fdde-440a-9c62-f82994358a13/scratchpad
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LOGS=$LANE/docs/handoffs/2026-10-10-claude-s11/lane-bench-logs; mkdir -p "$LOGS"; STAMP=$(date +%H%M%S)-$$
[ "$(readlink -f "$ALT/supabase/migrations")" = "$(readlink -f "$LANE/supabase/migrations")" ] || { echo "[alt] alt stack is not linked to $LANE"; exit 5; }
MODE="$1"; shift
exec 7>/tmp/wejammin-quiet.lock
if [ "$MODE" = bench ] || [ "$MODE" = ab ] || [ "$MODE" = abc ]; then
  echo "[alt] waiting for EXCLUSIVE quiet lock $(date +%T)"; flock -x --wait 7200 7 || { echo "[alt] quiet lock timeout"; exit 3; }
else
  flock -s --wait 7200 7 || { echo "[alt] quiet lock timeout"; exit 3; }
fi
exec 9>/tmp/wejammin-altdb.lock
echo "[alt] waiting for alt lock $(date +%T)"; flock --wait 3600 9 || { echo "[alt] lock timeout"; exit 3; }
echo "[alt] lock acquired $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)"
reset() {
  if ! flock --wait 900 /tmp/wejammin-reset.lock "$SUPA" db reset --local --workdir "$ALT" > "$LOGS/alt-reset-$STAMP.log" 2>&1; then
    echo "[alt] RESET FAILED - last lines:"; grep -v '^$' "$LOGS/alt-reset-$STAMP.log" | tail -25; exit 2; fi
  echo "[alt] reset ok $(date +%T)"
}
IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 'supabase/pg_prove:')
PW=$(docker inspect supabase_db_wejammin_ev --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^POSTGRES_PASSWORD=//p')
prove() { # prove <tap-out> <container-path>...
  local tap="$1"; shift
  PGPASSWORD="$PW" docker run --rm --network supabase_network_wejammin_ev -v "$LANE/supabase/tests:/w/supabase/tests:ro" -v "$SCRATCH:/w/scratch:ro" \
    -e PGHOST=supabase_db_wejammin_ev -e PGUSER=postgres -e PGPASSWORD -e PGDATABASE=postgres \
    "$IMAGE" pg_prove -v --ext .sql "$@" > "$tap" 2>&1
  return $?
}
case "$MODE" in
  reset) reset ;;
  reset-run) reset; TAP="$LOGS/alt-tap-$STAMP.tap"; T=(); for p in "$@"; do q="${p/#$SCRATCH//w/scratch}"; T+=("${q/#$LANE//w}"); done; prove "$TAP" "${T[@]}"; RC=$?
     echo "[alt] exit=$RC tap=$TAP"; exit $RC ;;
  run) TAP="$LOGS/alt-tap-$STAMP.tap"; T=(); for p in "$@"; do q="${p/#$SCRATCH//w/scratch}"; T+=("${q/#$LANE//w}"); done; prove "$TAP" "${T[@]}"; RC=$?
     echo "[alt] exit=$RC tap=$TAP"; exit $RC ;;
  xrun) # xrun <file>...: like run, but the quiet lock is converted to EXCLUSIVE and the 1-minute load must be < 1.5 first
    flock -x --wait 7200 7 || { echo "[xrun] quiet lock timeout"; exit 3; }
    for i in $(seq 1 120); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<1.5)}" && break; sleep 5; done
    echo "[xrun] start load=$(cut -d' ' -f1-3 /proc/loadavg)"
    TAP="$LOGS/xrun-tap-$STAMP.tap"; T=(); for p in "$@"; do q="${p/#$SCRATCH//w/scratch}"; T+=("${q/#$LANE//w}"); done; prove "$TAP" "${T[@]}"; RC=$?
    echo "[xrun] exit=$RC load_after=$(cut -d' ' -f1-3 /proc/loadavg) tap=$TAP"; exit $RC ;;
  abc) # abc <label> <rounds> <file>: per round A = old create + old bound, B = migration 166000 only, C = 166000 + 166100; bench after each
    LABEL="$1"; RUNS="$2"; FILE="$3"
    for r in $(seq 1 "$RUNS"); do
      for v in A B C; do
        case "$v" in
          A) INSTALL=(/w/scratch/bench-lane/install-old.sql /w/scratch/bench-lane/install-old-bound.sql) ;;
          B) INSTALL=(/w/scratch/bench-lane/apply-new.sql) ;;
          C) INSTALL=(/w/scratch/bench-lane/apply-bound.sql) ;;
        esac
        for f in "${INSTALL[@]}"; do prove "$LOGS/abc-install-$LABEL-$r-$v-$(basename "$f").tap" "$f"; grep -E "ERROR" "$LOGS/abc-install-$LABEL-$r-$v-$(basename "$f").tap" | head -3; done
        for i in $(seq 1 120); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<1.5)}" && break; sleep 5; done
        b=$(cut -d' ' -f1-3 /proc/loadavg)
        TAP="$LOGS/abc-$LABEL-$r-$v.tap"; prove "$TAP" "/w/supabase/tests/${FILE#supabase/tests/}"; RC=$?
        echo "[abc] $LABEL round $r $v exit=$RC load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg)"
        grep -E '^# (create128|dry_run|submit|assign|decide|activate)' "$TAP" | grep -v non-normative | sed 's/\[P2.*//'
        grep -E '^\s*not ok' "$TAP" | head -3
      done
    done ;;
  ab) # ab <label> <rounds> <file>: per round install the OLD body (scratch install-old.sql), bench, install the NEW one (scratch apply-new.sql), bench
    LABEL="$1"; RUNS="$2"; FILE="$3"
    for r in $(seq 1 "$RUNS"); do
      for v in old new; do
        if [ "$v" = old ]; then SQLF=/w/scratch/bench-lane/install-old.sql; else SQLF=/w/scratch/bench-lane/apply-new.sql; fi
        prove "$LOGS/ab-install-$LABEL-$r-$v.tap" "$SQLF"; grep -E "ERROR" "$LOGS/ab-install-$LABEL-$r-$v.tap" | head -3
        for i in $(seq 1 120); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<1.5)}" && break; sleep 5; done
        b=$(cut -d' ' -f1-3 /proc/loadavg)
        TAP="$LOGS/ab-$LABEL-$r-$v.tap"; prove "$TAP" "/w/supabase/tests/${FILE#supabase/tests/}"; RC=$?
        echo "[ab] $LABEL round $r $v exit=$RC load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg)"
        grep -E '^# (create128|dry_run|submit|assign|decide|activate)' "$TAP" | grep -v non-normative | sed 's/\[P2.*//'
        grep -E '^\s*not ok' "$TAP" | head -3
      done
    done ;;
  bench)
    LABEL="$1"; RUNS="$2"; FILE="$3"
    for i in $(seq 1 120); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l<1.5)}" && break; sleep 5; done
    echo "[bench] $LABEL quiet lock EXCLUSIVE, start load=$(cut -d' ' -f1-3 /proc/loadavg) $(date +%T)"
    for i in $(seq 1 "$RUNS"); do
      b=$(cut -d' ' -f1 /proc/loadavg)
      TAP="$LOGS/bench-$LABEL-$i.tap"; prove "$TAP" "/w/supabase/tests/${FILE#supabase/tests/}"; RC=$?
      echo "[bench] $LABEL run $i exit=$RC load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg)"
      grep -E '^# (create128|dry_run|submit|assign|decide|activate)' "$TAP" | grep -v non-normative | sed 's/\[P2.*//'
      grep -E '^\s*not ok' "$TAP" | head -3
    done ;;
esac
