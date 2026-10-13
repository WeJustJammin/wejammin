#!/usr/bin/env bash
# Verification job: <runs> in-suite reproductions (reset, the test files that sort before the bench file, the unmodified bench file).
#   verify-job.sh <label> [runs=3]
source "$(dirname "$0")/b2lib.sh"
LABEL="${1:?label}"; RUNS="${2:-3}"
b2_init "verify-$LABEL"
for n in $(seq 1 "$RUNS"); do
  b2_reset "$LABEL-r$n"
  b2_prefix "$LABEL-r$n"
  b2_bench "$LABEL-r$n-in-suite"
done
echo "[b2] verify job $LABEL done $(date +%T)" | tee -a "$SUMMARY"
