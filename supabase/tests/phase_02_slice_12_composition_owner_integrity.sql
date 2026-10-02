commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_composition_instances')
      and conname = 'cms_composition_instances_revision_owner_fkey'
      and contype = 'f'
  ),
  'composition revision reference binds the same owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_composition_instances')
      and conname = 'cms_composition_instances_pattern_owner_fkey'
      and contype = 'f'
  ),
  'composition pattern reference binds the same owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_composition_instances')
      and conname = 'cms_composition_instances_parent_owner_fkey'
      and contype = 'f'
  ),
  'nested composition parent reference binds the same owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_composition_instances')
      and conname = 'cms_composition_instances_parent_revision_owner_fkey'
      and contype = 'f'
      and convalidated
  ),
  'nested composition parent reference binds the same revision and owner'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_pattern_versions(
  id, owner_id, version, pattern_key, block_tree, block_registry_digest,
  content_hash, owner_capability, created_by
)
select 'a9130000-0000-4000-8000-000000000001',
       (select value::uuid from s10_ids where key = 'strangerPerson'),
       1, 'foreign-pattern', '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb,
       repeat('a', 64), repeat('b', 64), 'cms.template_designer',
       (select value::uuid from s10_ids where key = 'strangerAuth');

select throws_ok(
  $$insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, block_registry_digest, link_mode, created_by
    )
    select 'a9130000-0000-4000-8000-000000000002',
           (select value::uuid from s10_ids where key = 'strangerPerson'),
           1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
           '/foreign-revision', 'primary', 'profile.header', 1,
           repeat('a', 64), 'detached',
           (select value::uuid from s10_ids where key = 'strangerAuth')$$,
  '23503', null,
  'cross-owner revision cannot be used as a composition target'
);
select throws_ok(
  $$insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, pattern_id, pattern_version,
      block_registry_digest, link_mode, created_by
    )
    select 'a9130000-0000-4000-8000-000000000003',
           (select value::uuid from s10_ids where key = 'organization'),
           1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
           '/foreign-pattern', 'primary', 'profile.header', 1,
           'a9130000-0000-4000-8000-000000000001', 1,
           repeat('a', 64), 'linked',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'cross-owner pattern cannot be linked into a composition'
);

-- A shared owner is insufficient: a parent in revision A must never become a
-- node in revision B's composition tree.
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select 'a9130000-0000-4000-8000-000000000010', owner_id, entry_id, 2,
       schema_version_id, template_version_id, taxonomy_version_ids,
       '[]'::jsonb, locale, payload_hash, author_person_id, acting_party_id,
       state, version, validation_state, validation_report, created_at, updated_at
from platform_private.cms_entry_revisions
where id = (select value::uuid from s10_ids where key = 'entryRevisionId');

insert into platform_private.cms_composition_instances(
  id, owner_id, version, revision_id, path, slot_key,
  block_key, block_version, block_registry_digest, link_mode, created_by
)
select 'a9130000-0000-4000-8000-000000000011',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       '/parent', 'primary', 'profile.header', 1, repeat('a', 64), 'detached',
       (select value::uuid from s10_ids where key = 'creatorAuth');

select throws_ok(
  $$insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, block_registry_digest, link_mode,
      parent_instance_id, created_by
    )
    select 'a9130000-0000-4000-8000-000000000012',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9130000-0000-4000-8000-000000000010',
           '/parent/child', 'primary', 'profile.header', 1,
           repeat('a', 64), 'detached',
           'a9130000-0000-4000-8000-000000000011',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'same-owner composition parent from another revision is rejected'
);

insert into platform_private.cms_composition_instances(
  id, owner_id, version, revision_id, path, slot_key,
  block_key, block_version, block_registry_digest, link_mode,
  parent_instance_id, created_by
)
select 'a9130000-0000-4000-8000-000000000013',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       '/parent/valid-child', 'primary', 'profile.header', 1,
       repeat('a', 64), 'detached',
       'a9130000-0000-4000-8000-000000000011',
       (select value::uuid from s10_ids where key = 'creatorAuth');
select is(
  (select count(*)::int from platform_private.cms_composition_instances
   where id = 'a9130000-0000-4000-8000-000000000013'),
  1,
  'same-revision composition parent remains valid'
);

select finish();
rollback;
