-- Slice 12 taxonomy preflight provider cms.taxonomy.assignment_integrity version 1 (BE03c Preflight providers registered by
-- Slice 12; BE03b Publication preflight registry): registry row, provider predicates, reason precedence and the deployed
-- evaluator's dispatch.  Criteria P2-S12-AC-239, AC-241.  RED before the 2026102410xxxx taxonomy-integrity migrations, GREEN after.
-- Fixture: the Slice 10 RPC world and the Slice 11 helper world (h11doc type with a taxonomy field `tags`); every revision is
-- written by the real cms_create_entry.

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
\ir phase_02_slice_12_taxonomy_integrity/000-world.sqlinc
select pg_temp.s10_rpc_as((select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
\ir phase_02_slice_12_taxonomy_integrity/040-provider.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/045-provider-context.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/046-provider-cap.sqlinc

select * from finish();
rollback;
