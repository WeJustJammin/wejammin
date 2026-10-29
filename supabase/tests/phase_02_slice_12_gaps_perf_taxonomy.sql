-- Slice 12 perf lane (claude_s12_gaps_perf): the database share of the taxonomy latency targets at the spec's bounded sizes, plus the
-- acting-context binding of the terms cursor.
--
--   CMS-03C-16 version save        Tier 2 p95 < 1,200 ms                P2-S12-AC-127   64 type keys, 64 field keys, 6 canonical domains
--   cmsTaxonomyVersionsRead        Tier 1 p95 <   750 ms                P2-S12-AC-180   a lineage of 50 versions (the page bound)
--   cmsTaxonomyTermsRead           Tier 1 p95 <   750 ms, RPC < 300 ms  P2-S12-AC-186, AC-279   50-term pages of a 120-term vocabulary
--   CMS-03C-17 selector            Tier 1 p95 <   750 ms                P2-S12-AC-133   limit 100 (the maximum) of 120 terms
--   P2-S12-AC-186 cl.1 "acting context": the page-1 signed cursor replayed as a different actor and as a different acting party.
-- The RPC share is necessary, not sufficient, for the API p95 (DEC-226); the end-to-end measurement is
-- tests/postgrest/phase-02-slice-12-latency.apispec.ts (root runs it).  Real fixtures only (the taxonomy-terms world).
-- Stage lane `none`: promoted migrations only.

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
\ir phase_02_slice_12_taxonomy_terms/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/010-setup.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/000-world.sqlinc
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc
\ir phase_02_slice_12_gaps_perf_taxonomy/010-world.sqlinc
\ir phase_02_slice_12_gaps_perf_taxonomy/020-measure.sqlinc
\ir phase_02_slice_12_gaps_perf_taxonomy/030-cursor-context.sqlinc
\ir phase_02_slice_12_gaps_perf_taxonomy/040-assert.sqlinc

select * from finish();
rollback;
