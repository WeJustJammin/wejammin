#!/usr/bin/env bash
# Diagnosis job: why does create128 take longer inside the canonical suite than alone on a fresh reset?
source "$(dirname "$0")/b2lib.sh"
b2_init diag
b2_reset fresh
b2_probe fresh-prof probe-prof.sql 120
b2_probe fresh-chain probe-chain-prof.sql 150
b2_reset v1
b2_prefix v1
b2_probe v1-state probe-state.sql 200
b2_bench v1-in-suite-pristine
b2_probe v1-prof probe-prof.sql 120
b2_probe v1-chain probe-chain-prof.sql 150
b2_probe v1-plans probe-plans.sql 200
b2_reset v2
b2_prefix v2
b2_probe v2-analyze probe-analyze.sql 20
b2_bench v2-after-analyze
b2_reset v3
b2_prefix v3
b2_probe v3-vacuum probe-vacuum-analyze.sql 20
b2_bench v3-after-vacuum-analyze
# Two more pristine in-suite baselines (reset, the 94 preceding files, the unmodified bench): runs 2 and 3 of the BEFORE series
# (run 1 is v1-in-suite-pristine above).
for n in 2 3; do
  b2_reset base$n
  b2_prefix base$n
  b2_bench base$n-in-suite-pristine
done
echo "[b2] diag job done $(date +%T)" | tee -a "$SUMMARY"
# Statement profiles (the first attempt in this job failed: pg_stat_statements.track is superuser-only; the probes now connect as
# supabase_admin and `set role postgres` for the fixtures and commands).
b2_reset pfresh
b2_probe fresh-prof2 probe-prof.sql 130
b2_probe fresh-chain2 probe-chain-prof.sql 160
b2_reset psuite
b2_prefix psuite
b2_probe suite-prof2 probe-prof.sql 130
b2_probe suite-chain2 probe-chain-prof.sql 160
b2_probe suite-plans2 probe-plans.sql 200
echo "[b2] statement-profile part done $(date +%T)" | tee -a "$SUMMARY"
# Fresh-reset controls under the same lock/load discipline (reset, then only the unmodified bench file).
for n in 1 2; do
  b2_reset ctrl$n
  b2_bench fresh-control$n
done
echo "[b2] controls done $(date +%T)" | tee -a "$SUMMARY"
# Function-level profiles (track_functions) of the whole bench chain, fresh and in-suite.
b2_reset ffresh
b2_probe fresh-func probe-func-prof.sql 200
b2_reset fsuite
b2_prefix fsuite
b2_probe suite-func probe-func-prof.sql 200
echo "[b2] function-profile part done $(date +%T)" | tee -a "$SUMMARY"
