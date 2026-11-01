-- CMS-03C-16 author-only RED suite: P2-S12-AC-124..128; DEC-135/188.
-- Normative: BE03c:178,208,215,218-219,401-402,1314-1322,1371-1375,1447,1502.
-- Contract: packages/contracts/src/cms-composition/taxonomy-version.ts:27-84.
-- cms_create_taxonomy_version is a spec-named operation. Its (jsonb)->jsonb
-- transport below is a DERIVED PROPOSAL, not a normative or deployed signature.
-- No taxonomy-version producer existed when authored. No runtime RED/GREEN
-- result is claimed. The term-only Worker fail-closed adapter is not a producer.
-- All fixture/command writes roll back. No fabricated active definition, guard
-- override, receipt-owner shortcut, migration, or shared fixture edit is used.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();
\ir phase_02_slice_12_taxonomy_definition/000-harness.sqlinc
\ir phase_02_slice_12_taxonomy_definition/010-identities.sqlinc
\ir phase_02_slice_12_taxonomy_definition/020-oracles.sqlinc
\ir phase_02_slice_12_taxonomy_definition/030-create.sqlinc
\ir phase_02_slice_12_taxonomy_definition/040-validation.sqlinc
\ir phase_02_slice_12_taxonomy_definition/050-authority.sqlinc
\ir phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc
\ir phase_02_slice_12_taxonomy_definition/070-versions-read.sqlinc
\ir phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc
\ir phase_02_slice_12_taxonomy_definition/090-registry-read.sqlinc

select finish();
rollback;
