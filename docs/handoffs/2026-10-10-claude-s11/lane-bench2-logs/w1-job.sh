#!/usr/bin/env bash
# Measurement job for a change set: <label> in-suite runs (reset, the test files that sort before the bench file, the
# unmodified bench file) and one function-level profile of the benchmark chain in the same in-suite state.
#   w1-job.sh <label> [runs=3]
source "$(dirname "$0")/b2lib.sh"
LABEL="${1:?label}"; RUNS="${2:-3}"
b2_init "$LABEL"
for n in $(seq 1 "$RUNS"); do
  b2_reset "$LABEL-r$n"
  b2_prefix "$LABEL-r$n"
  b2_bench "$LABEL-r$n-in-suite"
done
b2_reset "$LABEL-prof"
b2_prefix "$LABEL-prof"
b2_probe "$LABEL-suite-func" probe-func-prof.sql 200
echo "[b2] job $LABEL done $(date +%T)" | tee -a "$SUMMARY"
# EXPLAIN (ANALYZE, BUFFERS) of the 128-row field insert on a fresh reset, to set against the in-suite plan (diag job, v1-plans).
b2_reset "$LABEL-plansfresh"
b2_probe "$LABEL-fresh-plans" probe-plans.sql 200
echo "[b2] plans part $LABEL done $(date +%T)" | tee -a "$SUMMARY"
