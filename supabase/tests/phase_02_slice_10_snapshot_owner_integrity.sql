\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(10);

-- BE03b requires both immutable snapshot tables to copy the revision/entry
-- owner. A single-column FK proves identity, but does not bind that owner.
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_field_values')
      and conname = 'cms_entry_field_values_revision_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (revision_id, owner_id) REFERENCES platform_private.cms_entry_revisions(id, owner_id)'
  ),
  'field value revision reference binds the owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_field_values')
      and conname = 'cms_entry_field_values_definition_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (field_definition_id, owner_id) REFERENCES platform_private.cms_field_definition_versions(id, owner_id)'
  ),
  'field value definition reference binds the owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_relations')
      and conname = 'cms_entry_relations_revision_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (revision_id, owner_id) REFERENCES platform_private.cms_entry_revisions(id, owner_id)'
  ),
  'relation revision reference binds the owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_relations')
      and conname = 'cms_entry_relations_definition_owner_fkey'
      and contype = 'f' and convalidated
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (field_definition_id, owner_id) REFERENCES platform_private.cms_field_definition_versions(id, owner_id)'
  ),
  'relation definition reference binds the owner'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
select throws_ok(
  $$insert into platform_private.cms_entry_field_values(
      id, owner_id, state, version, revision_id, field_id,
      field_definition_id, locale, value, provenance, value_hash,
      created_at, updated_at
    ) select 'a9150000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      'active', 1,
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'typeFieldId'),
      (select value::uuid from s10_ids where key = 'typeFieldId'),
      'fr-FR', to_jsonb('Cross-owner'::text), 'authored', null,
      timestamptz '2026-09-27T12:00:00Z',
      timestamptz '2026-09-27T12:00:00Z'$$,
  '23503', null,
  'field value cannot claim a different owner from its revision'
);
select throws_ok(
  $$insert into platform_private.cms_entry_relations(
      id, owner_id, state, version, revision_id, field_id,
      field_definition_id, target_kind, target_id, expected_target_version,
      position, on_unavailable, created_at, updated_at
    ) select 'a9150000-0000-4000-8000-000000000002',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      'active', 1,
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'typeRelationFieldId'),
      (select value::uuid from s10_ids where key = 'typeRelationFieldId'),
      'content', 'a9150000-0000-4000-8000-000000000003', null,
      1, 'omit', timestamptz '2026-09-27T12:00:00Z',
      timestamptz '2026-09-27T12:00:00Z'$$,
  '23503', null,
  'relation cannot claim a different owner from its revision'
);

select finish();
rollback;
