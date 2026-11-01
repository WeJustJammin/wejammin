#!/usr/bin/env bash
# Regression driver on the alt stack: one reset to the tree, then the Slice 09, 10, 11 and 12+ SQL suites in chunks of at
# most 60 files (the pg_prove image truncates its arguments when the command line is long).  Quiet lock SHARED.
#   regress.sh <label> [glob-prefix...]     default: phase_02_slice_09_ and phase_02_slice_1[0-9]_
set -uo pipefail
LANE=/home/rob/.codex/worktrees/phase2-slice11/WeJammin
RUN=$LANE/docs/handoffs/2026-10-10-claude-s11/lane-bench-logs/altrun.sh
LOGS=$LANE/docs/handoffs/2026-10-10-claude-s11/lane-bench2-logs
export PATH="/home/rob/.local/share/wejammin-toolchain/bin:$PATH"
LABEL="${1:?label}"; shift
cd "$LANE/supabase/tests" || exit 4
if [ $# -eq 0 ]; then FILES=$(ls phase_02_slice_09_*.sql phase_02_slice_1[0-9]_*.sql); else FILES=$(for g in "$@"; do ls ${g}*.sql; done); fi
echo "$FILES" | sed "s#^#$LANE/supabase/tests/#" > "$LOGS/regress-$LABEL.files"
echo "[regress] $(wc -l < "$LOGS/regress-$LABEL.files") files, label $LABEL"
bash "$RUN" reset > "$LOGS/regress-$LABEL.reset.out" 2>&1 || { echo "[regress] reset failed"; tail -5 "$LOGS/regress-$LABEL.reset.out"; exit 2; }
rm -f "$LOGS/regress-$LABEL.chunk."*; split -l 60 -d "$LOGS/regress-$LABEL.files" "$LOGS/regress-$LABEL.chunk."
i=0; rc_all=0
for list in "$LOGS/regress-$LABEL.chunk."??; do
  i=$((i+1)); mapfile -t chunk < "$list"
  out=$(bash "$RUN" run "${chunk[@]}" 2>&1); rc=$?
  tap=$(echo "$out" | sed -n 's/.*tap=//p' | tail -1)
  [ -n "$tap" ] && mv "$tap" "$LOGS/regress-$LABEL-chunk$i.tap"
  echo "[regress] chunk $i: ${#chunk[@]} files exit=$rc  $(grep -E '^Files=|^Result:' "$LOGS/regress-$LABEL-chunk$i.tap" | tr '\n' ' ')"
  grep -E '^\s*not ok' "$LOGS/regress-$LABEL-chunk$i.tap" | head -10
  [ $rc -ne 0 ] && rc_all=1
  rm -f "$list"
done
echo "[regress] done rc=$rc_all"
exit $rc_all
