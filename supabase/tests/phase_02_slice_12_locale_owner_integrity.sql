commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_entry_revisions')
      and conname = 'cms_entry_revisions_entry_owner_fkey'
      and contype = 'f'
  ),
  'a revision itself cannot claim a different owner from its entry'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_entry_owner_fkey'
      and contype = 'f'
  ),
  'locale variant entry reference binds the owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_revision_entry_owner_fkey'
      and contype = 'f'
  ),
  'locale variant revision reference binds the entry and owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_source_entry_owner_fkey'
      and contype = 'f'
  ),
  'locale variant source reference binds the entry and owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_related_content_rules')
      and conname = 'cms_related_content_rules_source_owner_fkey'
      and contype = 'f'
  ),
  'related-content source reference binds the owner'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
select throws_ok(
  $$insert into platform_private.cms_entry_revisions(
      id, owner_id, entry_id, revision_number, schema_version_id,
      template_version_id, taxonomy_version_ids, parent_revision_ids,
      locale, payload_hash, author_person_id, acting_party_id, state,
      version, validation_state, validation_report, created_at, updated_at
    ) select 'a9140000-0000-4000-8000-000000000005',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      (select value::uuid from s10_ids where key = 'entryId'),
      2, (select value::uuid from s10_ids where key = 'draftVersionId'),
      null, '[]'::jsonb, '[]'::jsonb, 'en-US', repeat('a',64),
      (select value::uuid from s10_ids where key = 'creatorPerson'),
      (select value::uuid from s10_ids where key = 'organization'),
      'draft', 1, 'valid', '{}'::jsonb,
      timestamptz '2026-09-27T12:00:00Z',
      timestamptz '2026-09-27T12:00:00Z'$$,
  '23503', null,
  'revision cannot attach a foreign owner to an existing entry'
);
insert into platform_private.cms_content_entries(
  id, owner_id, content_type_id, owner_party_id, lifecycle,
  current_draft_revision_id, version, created_by, created_at, updated_at
)
select 'a9140000-0000-4000-8000-000000000001',
       (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'typeId'),
       (select value::uuid from s10_ids where key = 'organization'),
       'active', null, 1,
       (select value::uuid from s10_ids where key = 'creatorAuth'),
       timestamptz '2026-09-27T12:00:00Z',
       timestamptz '2026-09-27T12:00:00Z';

select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9140000-0000-4000-8000-000000000002',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      1, (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'en-US', repeat('a',64),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'locale variant cannot claim another owner for an existing entry'
);
select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9140000-0000-4000-8000-000000000003',
      (select value::uuid from s10_ids where key = 'organization'),
      1, 'a9140000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'en-US', repeat('a',64),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'locale variant cannot link revisions from another entry'
);
select throws_ok(
  $$insert into platform_private.cms_related_content_rules(
      id, owner_id, version, source_entry_id, rule_key, rule_version,
      mode, reason_code, created_by
    ) select 'a9140000-0000-4000-8000-000000000004',
      (select value::uuid from s10_ids where key = 'strangerPerson'),
      1, (select value::uuid from s10_ids where key = 'entryId'),
      'same-tag', 1, 'derived', 'MATCHED_RULE',
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'related-content source cannot claim another owner'
);

select finish();
rollback;
