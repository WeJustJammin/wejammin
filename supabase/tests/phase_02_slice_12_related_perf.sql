-- Slice 12 related-content performance (BE03c Security, performance, and recovery tests 1633; tracker
-- P2-S12-AC-279, related part): 64 related targets meet the RPC < 300 ms target for the CMS-03C-05 write and
-- the CMS-03C-21 projection.  A separate suite from phase_02_slice_12_related_content.sql and
-- phase_02_slice_12_related_public_targets.sql on purpose: these are wall-clock assertions, so they belong with
-- the other host-sensitive gates (run on a quiet host, like phase_02_slice_12_locale_perf.sql), and a loaded
-- machine must not fail the functional suites.  Each budget is a p95 over repeated samples, not one sample.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/004-lineage.sqlinc
\ir phase_02_slice_12_related_content/000-helpers.sqlinc
\ir phase_02_slice_12_related_content/001-world.sqlinc
\ir phase_02_slice_12_related_perf/001-bench.sqlinc

select * from finish();
rollback;
