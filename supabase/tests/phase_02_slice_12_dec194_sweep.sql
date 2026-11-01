-- DEC-194 bounded merge-convergence recovery sweep suite, lane dec194 (fix wave F3: table renamed by DEC-212).
-- Normative: BE03c "Merge convergence recovery (DEC-194; BE00 571 domain recovery reference)" (platform_api.cms_reconcile_taxonomy_merge_converge,
-- private body platform_private.cms_reconcile_taxonomy_merge_converge, answer { requested }), BE03c 1377 and 1334 (convergence and its job),
-- BE00 571; owner decision DEC-194; tracker P2-S12-AC-226.
-- Real fixtures only: the taxonomy-terms world (real vocabularies, real merge commands, real BE00 claim/outcome and the real continuation
-- handler).  The only labelled forgeries are those of taxonomy_terms/000-world.sqlinc (assignment rows) and dec194_sweep/000-helpers.sqlinc
-- (job requests as an earlier merge would have made them, and "time passes" by shifting the job timestamps back).  See dec194_sweep/README.md.

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
\ir phase_02_slice_12_dec194_sweep/000-helpers.sqlinc
\ir phase_02_slice_12_dec194_sweep/001-support-helpers.sqlinc
\ir phase_02_slice_12_dec194_sweep/010-surface.sqlinc
\ir phase_02_slice_12_dec194_sweep/020-no-work.sqlinc
\ir phase_02_slice_12_dec194_sweep/030-gates.sqlinc
\ir phase_02_slice_12_dec194_sweep/040-request.sqlinc
\ir phase_02_slice_12_dec194_sweep/050-generations.sqlinc
\ir phase_02_slice_12_dec194_sweep/060-idempotency-expiry.sqlinc
\ir phase_02_slice_12_dec194_sweep/070-atomicity.sqlinc
\ir phase_02_slice_12_dec194_sweep/080-routing-prefilter.sqlinc

select finish();
rollback;
