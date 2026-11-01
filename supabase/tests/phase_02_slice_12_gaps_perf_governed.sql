-- Slice 12 perf lane (claude_s12_gaps_perf): the database share of the governed-review latency targets, measured on the
-- real platform_api RPCs at the spec's bounded data sizes, the way phase_02_slice_11_reads_bench128.sql measures Slice 11.
--
--   CMS-03C-06 submit        Tier 2 p95 < 1,200 ms  P2-S12-AC-067   110 submissions
--   CMS-03C-08 assignment    Tier 2 p95 < 1,200 ms  P2-S12-AC-079   110 creates, 20 revokes, 16-active review
--   CMS-03C-07 decision      Tier 2 p95 < 1,200 ms  P2-S12-AC-073   48 approvals
--   CMS-03C-09 activation    Tier 2 p95 < 1,200 ms  P2-S12-AC-085   24 activations, 24 schedules, 24 retirements
--   CMS-03C-10 detail        Tier 1 p95 <   750 ms  P2-S12-AC-091   16 active + 20 revoked assignments, protected review
--   CMS-03C-11 queue         Tier 1 p95 <   750 ms  P2-S12-AC-097   limit 50 from 111 assigned reviews, first and cursor page
--
-- An RPC share is necessary, not sufficient, for an API p95 (DEC-226: a tier label never proves a p95): the end-to-end
-- measurement through Worker + PostgREST is tests/postgrest/phase-02-slice-12-latency.apispec.ts, run by root.  Every number
-- here is the database share the Worker waits for; the production decision to split them is Slice 11's (see reads_bench128).
--
-- Real fixtures only (the governed-a/b worlds): S09 owner initialization, real CMS-03A-15 grants, real CMS-03C-01 templates and
-- CMS-03C-06/-08/-07/-09 commands; nothing governed is inserted by hand.  Run on a quiet host.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc
\ir phase_02_slice_12_gaps_perf_governed/010-world.sqlinc
\ir phase_02_slice_12_gaps_perf_governed/020-writes.sqlinc
\ir phase_02_slice_12_gaps_perf_governed/030-detail-bound.sqlinc
\ir phase_02_slice_12_gaps_perf_governed/040-reads.sqlinc
\ir phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc

select * from finish();
rollback;
