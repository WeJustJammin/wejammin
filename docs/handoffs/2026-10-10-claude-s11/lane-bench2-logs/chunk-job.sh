#!/usr/bin/env bash
# Re-run of regression chunks that contain a timing assertion, on a quiet host: quiet lock EXCLUSIVE, reset, wait for the
# 1-minute load below 1.5, then the files of the chunk list written by regress.sh (regress-<label>.files, chunk number).
#   chunk-job.sh <label> <chunk-number>
source "$(dirname "$0")/b2lib.sh"
LABEL="${1:?label}"; N="${2:?chunk}"
b2_init "chunk$N-$LABEL"
mapfile -t ALL < "$LOGS/regress-$LABEL.files"
START=$(( (N-1)*60 )); CH=("${ALL[@]:$START:60}")
FILES=(); for f in "${CH[@]}"; do FILES+=("/w/supabase/tests/$(basename "$f")"); done
b2_reset "chunk$N"
b2_waitload
b=$(cut -d' ' -f1 /proc/loadavg)
b2_prove "$LOGS/chunk$N-$LABEL-$STAMP.tap" "${FILES[@]}"; rc=$?
echo "[b2] chunk $N (${#FILES[@]} files) exit=$rc load_before=$b load_after=$(cut -d' ' -f1 /proc/loadavg) $(grep -E '^Files=|^Result:' "$LOGS/chunk$N-$LABEL-$STAMP.tap" | tr '\n' ' ')" | tee -a "$SUMMARY"
grep -E '^\s*not ok' "$LOGS/chunk$N-$LABEL-$STAMP.tap" | head | tee -a "$SUMMARY"
grep -E '^# (activate|assign|create128|decide|dry_run|submit) p50' "$LOGS/chunk$N-$LABEL-$STAMP.tap" | tee -a "$SUMMARY"
