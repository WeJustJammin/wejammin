\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- P2-S12-AC-016..021: the four private taxonomy records are the durable
-- foundation for the named CMS-03C-03 RPC. No direct browser/table authority.
select ok(
  to_regclass('platform_private.cms_taxonomy_versions') is not null
    and to_regclass('platform_private.cms_terms') is not null
    and to_regclass('platform_private.cms_term_labels') is not null
    and to_regclass('platform_private.cms_term_assignments') is not null,
  '03c taxonomy, term, label, and assignment tables all exist privately'
);

select ok(
  coalesce((
    select count(*) = 4 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private'
      and c.relname = any(array[
        'cms_taxonomy_versions', 'cms_terms', 'cms_term_labels',
        'cms_term_assignments']::name[])
  ), false),
  'every taxonomy table has enabled and forced RLS'
);

select ok(
  coalesce((
    select bool_and(
      not has_table_privilege(role_name, table_name, 'select')
      and not has_table_privilege(role_name, table_name, 'insert')
      and not has_table_privilege(role_name, table_name, 'update')
      and not has_table_privilege(role_name, table_name, 'delete')
    )
    from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    cross join (values
      ('platform_private.cms_taxonomy_versions'),
      ('platform_private.cms_terms'),
      ('platform_private.cms_term_labels'),
      ('platform_private.cms_term_assignments')
    ) tables(table_name)
    where to_regclass(table_name) is not null
  ), false)
  and (
    select count(*) from (values
      ('platform_private.cms_taxonomy_versions'),
      ('platform_private.cms_terms'),
      ('platform_private.cms_term_labels'),
      ('platform_private.cms_term_assignments')
    ) tables(table_name)
    where to_regclass(table_name) is not null
  ) = 4,
  'anon authenticated and service roles have no direct taxonomy table grants'
);

select ok(
  coalesce((
    select count(*) = 4
    from pg_policy p
    where p.polrelid in (
      to_regclass('platform_private.cms_taxonomy_versions'),
      to_regclass('platform_private.cms_terms'),
      to_regclass('platform_private.cms_term_labels'),
      to_regclass('platform_private.cms_term_assignments')
    )
      and pg_get_expr(p.polqual, p.polrelid) like '%cms_rpc_context_valid%'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%cms_rpc_context_valid%'
  ), false),
  'taxonomy row policies require verified CMS RPC context'
);

select ok(
  to_regclass('platform_private.cms_taxonomy_versions_key_version_key') is not null
    and to_regclass('platform_private.cms_terms_taxonomy_key_version_key') is not null
    and to_regclass('platform_private.cms_term_labels_term_locale_version_key') is not null
    and to_regclass('platform_private.cms_term_assignments_revision_field_term_version_key') is not null,
  'immutable taxonomy identity and version uniqueness is indexed'
);

select ok(
  coalesce((
    select bool_and(attnotnull)
    from pg_attribute
    where attrelid = to_regclass('platform_private.cms_taxonomy_versions')
      and attname = any(array[
        'owner_id', 'state', 'version', 'taxonomy_key',
        'owner_capability', 'shape', 'content_hash', 'created_by']::name[])
  ), false)
  and (
    select count(*) from pg_attribute
    where attrelid = to_regclass('platform_private.cms_taxonomy_versions')
      and attname = any(array[
        'owner_id', 'state', 'version', 'taxonomy_key',
        'owner_capability', 'shape', 'content_hash', 'created_by']::name[])
  ) = 8,
  'taxonomy version persists the closed definition and owner capability'
);

select ok(
  coalesce((
    select count(*) = 1 from pg_attribute
    where attrelid = to_regclass('platform_private.cms_terms')
      and attname = 'lifecycle' and attnotnull
  ), false)
  and not exists (
    select 1 from pg_attribute
    where attrelid = to_regclass('platform_private.cms_terms')
      and attname = 'state' and not attisdropped
  ),
  'term lifecycle is the sole physical state envelope'
);

select ok(
  coalesce((
    select count(*) = 4
    from pg_trigger t
    where t.tgrelid in (
      to_regclass('platform_private.cms_taxonomy_versions'),
      to_regclass('platform_private.cms_terms'),
      to_regclass('platform_private.cms_term_labels'),
      to_regclass('platform_private.cms_term_assignments')
    )
      and not t.tgisinternal
      and t.tgname like '%write_guard'
  ), false),
  'all taxonomy records reject writes without the named RPC authority'
);

select ok(
  coalesce((
    select count(*) = 2
    from pg_trigger t
    where t.tgrelid in (
      to_regclass('platform_private.cms_term_labels'),
      to_regclass('platform_private.cms_term_assignments')
    )
      and not t.tgisinternal
      and t.tgname like '%immutable_guard'
  ), false),
  'label and assignment version rows reject UPDATE and DELETE'
);

select ok(
  exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_terms')
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%successor_id <> id%'
  ),
  'a term cannot redirect to itself'
);

select ok(
  exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_term_assignments')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_entry_revisions')
  )
  and exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_term_assignments')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_field_definition_versions')
  ),
  'term assignment binds a real revision and schema field definition'
);

select ok(
  coalesce((
    select count(*) = 8 and bool_and(
      not has_function_privilege(role_name, p.oid, 'execute')
    )
    from (values ('public'::name), ('anon'::name),
      ('authenticated'::name), ('service_role'::name)) roles(role_name)
    cross join pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in (
        'cms_taxonomy_versions_lifecycle_guard',
        'cms_terms_lifecycle_guard'
      )
  ), false),
  'private taxonomy lifecycle guards are not directly executable by API roles'
);

-- Exercise guards with rolled-back real local authority fixtures. These are
-- database invariants, not a substitute for the curator RPC and browser flow.
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
)
select 'a9120000-0000-4000-8000-000000000101',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'test-taxonomy', 'cms.taxonomy_curator', 'flat',
       '[]'::jsonb, '[]'::jsonb, repeat('a', 64),
       (select value::uuid from s10_ids where key = 'creatorAuth');

insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key, created_by
)
select 'a9120000-0000-4000-8000-000000000102',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9120000-0000-4000-8000-000000000101', 'first-term',
       (select value::uuid from s10_ids where key = 'creatorAuth');
insert into platform_private.cms_terms(
  id, owner_id, version, taxonomy_version_id, term_key, created_by
)
select 'a9120000-0000-4000-8000-000000000103',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9120000-0000-4000-8000-000000000101', 'survivor-term',
       (select value::uuid from s10_ids where key = 'creatorAuth');

insert into platform_private.cms_term_labels(
  id, owner_id, version, term_id, locale, label, created_by
)
select 'a9120000-0000-4000-8000-000000000104',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'a9120000-0000-4000-8000-000000000102', 'en-US', 'First',
       (select value::uuid from s10_ids where key = 'creatorAuth');

insert into platform_private.cms_term_assignments(
  id, owner_id, version, revision_id, field_definition_id,
  term_id, taxonomy_version_id, position, provenance, created_by
)
select 'a9120000-0000-4000-8000-000000000105',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       (select value::uuid from s10_ids where key = 'typeFieldId'),
       'a9120000-0000-4000-8000-000000000102',
       'a9120000-0000-4000-8000-000000000101', 0, 'authored',
       (select value::uuid from s10_ids where key = 'creatorAuth');

select throws_ok(
  $$update platform_private.cms_taxonomy_versions
    set content_hash = repeat('b', 64)
    where id = 'a9120000-0000-4000-8000-000000000101'$$,
  'P0001', 'CONFLICT', 'taxonomy definition is immutable after creation'
);
select throws_ok(
  $$update platform_private.cms_term_labels set label = 'Changed'
    where id = 'a9120000-0000-4000-8000-000000000104'$$,
  'P0001', 'IMMUTABLE_RECORD', 'a label version cannot be changed in place'
);
select throws_ok(
  $$delete from platform_private.cms_term_assignments
    where id = 'a9120000-0000-4000-8000-000000000105'$$,
  'P0001', 'IMMUTABLE_RECORD', 'an assignment version cannot be deleted'
);
select throws_ok(
  $$update platform_private.cms_terms set lifecycle = 'merged'
    where id = 'a9120000-0000-4000-8000-000000000102'$$,
  'P0001', 'CONFLICT', 'merge requires a permanent survivor redirect'
);
select lives_ok(
  $$update platform_private.cms_terms
    set aliases = '["nickname"]'::jsonb, version = 2,
        updated_at = clock_timestamp()
    where id = 'a9120000-0000-4000-8000-000000000102'$$,
  'alias action can advance the stable term version for CAS'
);
select throws_ok(
  $$insert into platform_private.cms_terms(
      id, owner_id, version, taxonomy_version_id, term_key, created_by
    )
    select 'a9120000-0000-4000-8000-000000000106',
           (select value::uuid from s10_ids where key = 'organization'),
           1, 'a9120000-0000-4000-8000-000000000101', 'first-term',
           (select value::uuid from s10_ids where key = 'creatorAuth')$$,
  '23505', null,
  'a new term cannot reuse a stable key after the original term advances its version'
);
select lives_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'merged',
        successor_id = 'a9120000-0000-4000-8000-000000000103',
        version = 3,
        updated_at = clock_timestamp()
    where id = 'a9120000-0000-4000-8000-000000000102'$$,
  'merge can retain a survivor redirect'
);
select throws_ok(
  $$update platform_private.cms_terms set lifecycle = 'active'
    where id = 'a9120000-0000-4000-8000-000000000102'$$,
  'P0001', 'CONFLICT', 'a merged term cannot reactivate'
);
select set_config('app.cms_rpc', '', true);
select throws_ok(
  $$update platform_private.cms_terms
    set lifecycle = 'deprecated', version = 2, updated_at = clock_timestamp()
    where id = 'a9120000-0000-4000-8000-000000000103'$$,
  'P0001', 'DIRECT_CMS_TABLE_WRITE',
  'a direct term write is denied outside the named RPC context'
);

select finish();
rollback;
