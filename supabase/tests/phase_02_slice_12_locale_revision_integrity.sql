commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_revision_locale_fkey'
      and contype = 'f'
  ),
  'target locale must match the immutable target revision locale'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_source_locale_fkey'
      and contype = 'f'
  ),
  'source locale must match the immutable source revision locale'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.cms_locale_variants')
      and conname = 'cms_locale_variants_source_revision_hash_fkey'
      and contype = 'f'
      and convalidated
  ),
  'source hash must match the immutable source revision payload hash'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select 'a9150000-0000-4000-8000-000000000001',
       (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'entryId'),
       2, (select value::uuid from s10_ids where key = 'draftVersionId'),
       null, '[]'::jsonb, '[]'::jsonb, 'fr-FR', repeat('b',64),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       (select value::uuid from s10_ids where key = 'organization'),
       'draft', 1, 'unknown', '{}'::jsonb,
       timestamptz '2026-09-27T12:00:00Z',
       timestamptz '2026-09-27T12:00:00Z';

select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9150000-0000-4000-8000-000000000002',
      (select value::uuid from s10_ids where key = 'organization'),
      1, (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'en-US',
      (select payload_hash from platform_private.cms_entry_revisions
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'variant cannot label an en-US target revision as fr-FR'
);
select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9150000-0000-4000-8000-000000000003',
      (select value::uuid from s10_ids where key = 'organization'),
      2, (select value::uuid from s10_ids where key = 'entryId'),
      'a9150000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'de-DE',
      (select payload_hash from platform_private.cms_entry_revisions
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'variant cannot label an en-US source revision as de-DE'
);
select lives_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9150000-0000-4000-8000-000000000004',
      (select value::uuid from s10_ids where key = 'organization'),
      3, (select value::uuid from s10_ids where key = 'entryId'),
      'a9150000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'en-US',
      (select payload_hash from platform_private.cms_entry_revisions
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  'variant may bind a real fr-FR target to a real en-US source'
);
select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      id, owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select 'a9150000-0000-4000-8000-000000000005',
      (select value::uuid from s10_ids where key = 'organization'),
      4, (select value::uuid from s10_ids where key = 'entryId'),
      'a9150000-0000-4000-8000-000000000001',
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'fr-FR', 'en-US', repeat('0',64),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23503', null,
  'variant cannot claim a hash different from its immutable source revision'
);

select finish();
rollback;
