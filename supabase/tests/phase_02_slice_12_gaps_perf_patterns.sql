-- Slice 12 perf lane (claude_s12_gaps_perf): the database share of the pattern latency targets, measured on the real
-- platform_api RPCs at the spec's bounded sizes (BE03c "Security, performance, and recovery tests": 512-node pattern bounds).
--
--   CMS-03C-12 pattern save   Tier 2 p95 < 1,200 ms, RPC < 300 ms  P2-S12-AC-103, AC-279   512-node forest (flat and nested), successor
--   CMS-03C-13 selector       Tier 1 p95 <   750 ms                P2-S12-AC-109            limit 50 from 63 active versions, first and cursor page
--   CMS-03C-14 update diff    Tier 1 p95 <   750 ms                P2-S12-AC-115            128 changed paths (the bound), linked instance
--   CMS-03C-15 pattern update Tier 2 p95 < 1,200 ms                P2-S12-AC-121            32 instances accepted and 32 detached per request
--   cmsPatternLatestRead      Tier 2 p95 < 1,200 ms                P2-S12-AC-174            512-node latest version
--   CMS-03C-02 placement      Tier 2 p95 < 1,200 ms, RPC < 300 ms  P2-S12-AC-279            512 rows (32 references x 16 roots) and 32 rows
--
-- The RPC share is necessary, not sufficient, for the API p95 (DEC-226); the end-to-end measurement is the real-stack apispec
-- tests/postgrest/phase-02-slice-12-latency.apispec.ts, run by root.  Every pattern is a REAL active pattern (CMS-03C-12 and the governed
-- chain 06/08/07/09); a placement and an update are the real producers; no row is inserted by hand and no trigger is disabled.
-- Lean runners (g12p_call) replace the full-store before/after snapshots of the functional suites, which would dominate the timing.
-- Stage lane `none`: promoted migrations only.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/010-lean.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/020-define.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/030-place-update.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/040-reads.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc

select * from finish();
rollback;
