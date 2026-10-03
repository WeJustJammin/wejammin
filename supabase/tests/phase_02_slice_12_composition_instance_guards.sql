\ir support/jwt-claims.sqlinc
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Catalog check: the admission guard trigger must exist. This fails RED
-- against the pre-guard schema.
select ok(
  exists (
    select 1 from pg_trigger t
     where t.tgrelid = to_regclass('platform_private.cms_composition_instances')
       and not t.tgisinternal
       and t.tgname = 'cms_composition_instances_target_revision_guard'
  ),
  'composition instance draft-target admission guard trigger exists'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);

-- Fixture pattern version reused by the linked-mode control instance below.
insert into platform_private.cms_pattern_versions(
  id, owner_id, version, pattern_key, block_tree, block_registry_digest,
  content_hash, owner_capability, created_by
)
select 'a9150000-0000-4000-8000-000000000001',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'guard-pattern', '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb,
       repeat('a', 64), repeat('b', 64), 'cms.template_designer',
       (select value::uuid from s10_ids where key = 'creatorAuth');

-- Valid control: the fixture draft revision hosts an acyclic two-node tree.
insert into platform_private.cms_composition_instances(
  id, owner_id, version, revision_id, path, slot_key,
  block_key, block_version, pattern_id, pattern_version,
  block_registry_digest, link_mode, created_by
)
select 'a9150000-0000-4000-8000-000000000010',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       '/parent', 'primary', 'profile.header', 1,
       'a9150000-0000-4000-8000-000000000001', 1, repeat('a', 64), 'linked',
       (select value::uuid from s10_ids where key = 'creatorAuth');

insert into platform_private.cms_composition_instances(
  id, owner_id, version, revision_id, path, slot_key,
  block_key, block_version, block_registry_digest, link_mode,
  parent_instance_id, created_by
)
select 'a9150000-0000-4000-8000-000000000011',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       '/parent/child', 'primary', 'profile.header', 1,
       repeat('a', 64), 'detached',
       'a9150000-0000-4000-8000-000000000010',
       (select value::uuid from s10_ids where key = 'creatorAuth');

select is(
  (select count(*)::int from platform_private.cms_composition_instances
   where id in ('a9150000-0000-4000-8000-000000000010',
                'a9150000-0000-4000-8000-000000000011')),
  2,
  'valid draft revision hosts an acyclic same-revision tree'
);

-- CMSCOMP-DRAFT-TARGET: seed a non-draft (submitted) revision in the same
-- entry/owner, mirroring the terminal-state fixture approach used elsewhere.
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select 'a9150000-0000-4000-8000-000000000020', owner_id, entry_id, 2,
       schema_version_id, template_version_id, taxonomy_version_ids,
       '[]'::jsonb, locale, payload_hash, author_person_id, acting_party_id,
       'submitted', version, validation_state, validation_report,
       created_at, updated_at
  from platform_private.cms_entry_revisions
 where id = (select value::uuid from s10_ids where key = 'entryRevisionId');

select throws_ok(
  $$insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, block_registry_digest, link_mode, created_by
    )
    select 'a9150000-0000-4000-8000-000000000021',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9150000-0000-4000-8000-000000000020',
           '/submitted', 'primary', 'profile.header', 1,
           repeat('a', 64), 'detached',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  'P0001', 'VALIDATION_FAILED',
  'submitted revision cannot be assigned as the composition target revision'
);

select is(
  (select count(*)::int from platform_private.cms_composition_instances
   where revision_id = 'a9150000-0000-4000-8000-000000000020'),
  0,
  'no composition instance row was written for the submitted revision'
);

-- A missing target revision keeps the existing owner-bound FK boundary:
-- the admission guard returns NEW and the FK surfaces 23503.
select throws_ok(
  $$insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, block_registry_digest, link_mode, created_by
    )
    select 'a9150000-0000-4000-8000-000000000009',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9150000-0000-4000-8000-000000000099',
           '/absent', 'primary', 'profile.header', 1,
           repeat('a', 64), 'detached',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'missing target revision is rejected by the existing owner-bound revision FK'
);

select set_config('app.cms_rpc', '', true);

select finish();
rollback;
commit;
