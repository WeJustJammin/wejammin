-- CMS-03C-03 (platform_api.cms_act_taxonomy_term: create, rename, alias, deprecate, merge) RED/GREEN suite, lane taxonomy-terms.
-- Normative: BE03c 161 (route row), 372-374 and 408-410 (validation), 1344 (lock positions), 1369-1377 (taxonomy versions, DEC-135, term actions),
-- 1428-1429 (term and label rows), 1478 (authorization), 1506 (transaction seam), 1539 (term state machine), 1554-1561 (event and outbox
-- identity); contracts taxonomy-term.ts, canonical-taxonomy-match.ts; tracker P2-S12-AC-003, AC-016 .. AC-021.
-- Real fixtures only: S09 owner initialization, real CMS-03A-15 grants, real active content types, REAL taxonomy vocabularies created,
-- submitted, assigned, approved and activated through CMS-03C-16, -06, -08, -07 and -09 under the real service_role.  The only labelled
-- forgeries are listed in taxonomy_terms/000-world.sqlinc.  See taxonomy_terms/README.md.

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
\ir phase_02_slice_12_taxonomy_terms/020-surface.sqlinc
\ir phase_02_slice_12_taxonomy_terms/030-create.sqlinc
\ir phase_02_slice_12_taxonomy_terms/040-validation.sqlinc
\ir phase_02_slice_12_taxonomy_terms/050-authority.sqlinc
\ir phase_02_slice_12_taxonomy_terms/060-hierarchy.sqlinc
\ir phase_02_slice_12_taxonomy_terms/070-rename-alias-deprecate.sqlinc
\ir phase_02_slice_12_taxonomy_terms/080-merge.sqlinc
\ir phase_02_slice_12_taxonomy_terms/085-continuation.sqlinc
\ir phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc
\ir phase_02_slice_12_taxonomy_terms/094-continuation-authority.sqlinc
\ir phase_02_slice_12_taxonomy_terms/095-lineage-storage.sqlinc
\ir phase_02_slice_12_taxonomy_terms/096-job-fence.sqlinc
\ir phase_02_slice_12_taxonomy_terms/097-bulk-continuation.sqlinc
\ir phase_02_slice_12_taxonomy_terms/0971-chained-continuation.sqlinc
\ir phase_02_slice_12_taxonomy_terms/098-locale-canonical.sqlinc
\ir phase_02_slice_12_taxonomy_terms/099-registry-drift.sqlinc

select finish();
rollback;
