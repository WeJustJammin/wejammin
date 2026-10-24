-- Slice 12 lane template-digest: CMS-03C-01 refuses a well-formed caller blockRegistryDigest that differs from the
-- recomputed one with the closed token block_registry_digest_mismatch (BE03c 323-327, 373, 1273, 1323; DEC-186 item 2),
-- exactly as the pattern producers do (P0001, DETAIL ["/blockRegistryDigest"]).  Before the fix the template producer
-- raised the generic CONFLICT.  The generic CONFLICT stays for a stale expectedVersion and a taken first-version key.
-- Fixtures are the Slice 10 rolled-back authority world, as in phase_02_slice_12_template_authority.sql.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
select (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       'cms.template_designer', current_date, current_date + 1, true;

\ir phase_02_slice_12_template_digest/010-refusals.sqlinc
\ir phase_02_slice_12_template_digest/020-identity.sqlinc
\ir phase_02_slice_12_template_digest/030-replay.sqlinc

select finish();
rollback;
