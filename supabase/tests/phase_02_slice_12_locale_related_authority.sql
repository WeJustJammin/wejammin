commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  to_regclass('platform_private.cms_locale_variants') is not null
    and to_regclass('platform_private.cms_related_content_rules') is not null,
  'locale variants and related-content rules persist privately'
);
select ok(
  coalesce((
    select count(*) = 2 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private'
      and c.relname = any(array[
        'cms_locale_variants', 'cms_related_content_rules']::name[])
  ), false),
  'locale and related-content tables enforce forced RLS'
);
select ok(
  coalesce((
    select count(*) = 6 and bool_and(
      not has_table_privilege(role_name, table_name, 'select')
      and not has_table_privilege(role_name, table_name, 'insert')
      and not has_table_privilege(role_name, table_name, 'update')
      and not has_table_privilege(role_name, table_name, 'delete')
    )
    from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    cross join (values
      ('platform_private.cms_locale_variants'),
      ('platform_private.cms_related_content_rules')
    ) tables(table_name)
    where to_regclass(table_name) is not null
  ), false),
  'browser and service roles have no direct locale or relation grants'
);
select ok(
  coalesce((
    select count(*) = 2
    from pg_policy p
    where p.polrelid in (
      to_regclass('platform_private.cms_locale_variants'),
      to_regclass('platform_private.cms_related_content_rules')
    )
      and pg_get_expr(p.polqual, p.polrelid) like '%cms_rpc_context_valid%'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%cms_rpc_context_valid%'
  ), false),
  'locale and relation rows require verified CMS RPC context'
);
select ok(
  to_regclass('platform_private.cms_locale_variants_entry_locale_source_version_key')
    is not null
    and to_regclass('platform_private.cms_related_content_rules_source_target_mode_version_key')
      is not null
    and to_regclass('platform_private.cms_related_content_rules_derived_version_key')
      is not null,
  'locale and related-content snapshots have unique version identities'
);
select ok(
  coalesce((
    select count(*) = 4
    from pg_trigger t
    where t.tgrelid in (
      to_regclass('platform_private.cms_locale_variants'),
      to_regclass('platform_private.cms_related_content_rules')
    ) and not t.tgisinternal
      and (t.tgname like '%write_guard' or t.tgname like '%immutable_guard')
  ), false),
  'locale and related-content versions reject direct writes and mutation'
);
select ok(
  exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_locale_variants')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_entry_revisions')
  ) and exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_related_content_rules')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_content_entries')
  ),
  'localization binds real revisions and relation rules bind real entries'
);
select ok(
  coalesce((
    select count(*) = 8 and bool_and(attnotnull)
    from pg_attribute
    where attrelid = to_regclass('platform_private.cms_locale_variants')
      and attname = any(array[
        'owner_id','state','version','entry_id','revision_id',
        'source_revision_id','locale','source_hash']::name[])
  ), false),
  'locale snapshot retains source revision, locale, and source hash'
);
select ok(
  coalesce((
    select count(*) = 7 and bool_and(attnotnull)
    from pg_attribute
    where attrelid = to_regclass('platform_private.cms_related_content_rules')
      and attname = any(array[
        'owner_id','state','version','source_entry_id','mode',
        'reason_code','created_by']::name[])
  ), false),
  'related-content rule retains source, mode, reason, and actor'
);

-- Rolled-back rows exercise the immutable snapshot boundary. The translated
-- revision has the correct structural locale but is not a proof of field-level
-- translation policy or related-target eligibility.
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select 'a9120000-0000-4000-8000-000000000303',
       (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'entryId'),
       2, (select value::uuid from s10_ids where key = 'draftVersionId'),
       null, '[]'::jsonb, '[]'::jsonb, 'fr-FR', repeat('b',64),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       (select value::uuid from s10_ids where key = 'organization'),
       'draft', 1, 'unknown', '{}'::jsonb,
       timestamptz '2026-09-27T12:00:00Z',
       timestamptz '2026-09-27T12:00:00Z';

insert into platform_private.cms_locale_variants(
  id, owner_id, version, entry_id, revision_id, source_revision_id,
  locale, source_locale, source_hash, created_by
)
select 'a9120000-0000-4000-8000-000000000301',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryId'),
       'a9120000-0000-4000-8000-000000000303',
       (select value::uuid from s10_ids where key = 'entryRevisionId'),
       'fr-FR', 'en-US',
       (select payload_hash from platform_private.cms_entry_revisions
        where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
       (select value::uuid from s10_ids where key = 'creatorAuth');

insert into platform_private.cms_related_content_rules(
  id, owner_id, version, source_entry_id, rule_key, rule_version,
  mode, reason_code, created_by
)
select 'a9120000-0000-4000-8000-000000000302',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryId'),
       'similar-genre', 1, 'derived', 'MATCHED_RULE',
       (select value::uuid from s10_ids where key = 'creatorAuth');

select throws_ok(
  $$update platform_private.cms_locale_variants set state = 'stale'
    where id = 'a9120000-0000-4000-8000-000000000301'$$,
  'P0001', 'IMMUTABLE_RECORD', 'locale snapshots are append-only'
);
select throws_ok(
  $$delete from platform_private.cms_related_content_rules
    where id = 'a9120000-0000-4000-8000-000000000302'$$,
  'P0001', 'IMMUTABLE_RECORD', 'related-content rules are append-only'
);
select throws_ok(
  $$insert into platform_private.cms_locale_variants(
      owner_id, version, entry_id, revision_id, source_revision_id,
      locale, source_locale, source_hash, created_by
    ) select (select value::uuid from s10_ids where key = 'organization'),
      2, (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'),
      'en-US', 'en-us',
      (select payload_hash from platform_private.cms_entry_revisions
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23514', null, 'locale variant cannot target its source locale'
);
select throws_ok(
  $$insert into platform_private.cms_related_content_rules(
      owner_id, version, source_entry_id, target_entry_id, mode,
      reason_code, created_by
    ) select (select value::uuid from s10_ids where key = 'organization'),
      2, (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'entryId'),
      'derived', 'MATCHED_RULE',
      (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23514', null, 'derived rule cannot hardcode a target entry'
);

select finish();
rollback;
