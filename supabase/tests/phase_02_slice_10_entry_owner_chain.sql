commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(10);

-- BE03a/BE03b copy the owner from content type through its version, entry,
-- revision and assignment. Single-column parent FKs do not enforce that copy.
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_content_type_versions')
      and conname = 'cms_content_type_versions_type_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (content_type_id, owner_id) REFERENCES platform_private.cms_content_types(id, owner_id)'
  ),
  'a content type version belongs to the same owner as its type'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_content_entries')
      and conname = 'cms_content_entries_type_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (content_type_id, owner_id) REFERENCES platform_private.cms_content_types(id, owner_id)'
  ),
  'an entry belongs to the same owner as its content type'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_revisions')
      and conname = 'cms_entry_revisions_schema_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (schema_version_id, owner_id) REFERENCES platform_private.cms_content_type_versions(id, owner_id)'
  ),
  'a revision belongs to the same owner as its schema version'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_assignments')
      and conname = 'cms_entry_assignments_entry_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (entry_id, owner_id) REFERENCES platform_private.cms_content_entries(id, owner_id)'
  ),
  'an entry assignment belongs to the same owner as its entry'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
select throws_ok(
  $$insert into platform_private.cms_content_entries(
      id, owner_id, content_type_id, owner_party_id, lifecycle,
      current_draft_revision_id, version, created_by, created_at, updated_at
    ) select 'a9160000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      (select value::uuid from s10_ids where key = 'typeId'),
      (select value::uuid from s10_ids where key = 'organization'),
      'active', null, 1,
      (select value::uuid from s10_ids where key = 'creatorAuth'),
      timestamptz '2026-09-27T12:00:00Z',
      timestamptz '2026-09-27T12:00:00Z'$$,
  '23503', null,
  'entry insert cannot claim a different owner from its content type'
);
select throws_ok(
  $$insert into platform_private.cms_entry_assignments(
      id, owner_id, entry_id, assignee_person_id, capability_key,
      state, version, created_at, updated_at
    ) select 'a9160000-0000-4000-8000-000000000002',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'editorPerson'),
      'cms.author', 'active', 1,
      timestamptz '2026-09-27T12:00:00Z',
      timestamptz '2026-09-27T12:00:00Z'$$,
  '23503', null,
  'assignment insert cannot claim a different owner from its entry'
);

select finish();
rollback;
