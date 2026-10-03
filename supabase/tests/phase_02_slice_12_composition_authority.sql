\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select ok(
  to_regclass('platform_private.cms_pattern_versions') is not null
    and to_regclass('platform_private.cms_composition_instances') is not null,
  'pattern definitions and composition instances persist privately'
);
select ok(
  coalesce((
    select count(*) = 2 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private'
      and c.relname = any(array[
        'cms_pattern_versions', 'cms_composition_instances']::name[])
  ), false),
  'both composition tables enforce forced RLS'
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
      ('platform_private.cms_pattern_versions'),
      ('platform_private.cms_composition_instances')
    ) tables(table_name)
    where to_regclass(table_name) is not null
  ), false),
  'browser and service roles have no direct composition table grants'
);
select ok(
  coalesce((
    select count(*) = 2
    from pg_policy p
    where p.polrelid in (
      to_regclass('platform_private.cms_pattern_versions'),
      to_regclass('platform_private.cms_composition_instances')
    )
      and pg_get_expr(p.polqual, p.polrelid) like '%cms_rpc_context_valid%'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%cms_rpc_context_valid%'
  ), false),
  'composition row policies require verified CMS RPC context'
);
select ok(
  to_regclass('platform_private.cms_pattern_versions_key_version_key') is not null
    and to_regclass('platform_private.cms_composition_instances_revision_path_version_key') is not null,
  'pattern and composition versions have stable unique identities'
);
select ok(
  coalesce((
    select count(*) = 2
    from pg_trigger t
    where t.tgrelid in (
      to_regclass('platform_private.cms_pattern_versions'),
      to_regclass('platform_private.cms_composition_instances')
    ) and not t.tgisinternal and t.tgname like '%write_guard'
  ), false),
  'both composition records reject writes outside the named RPC'
);
select ok(
  exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('platform_private.cms_composition_instances')
      and not t.tgisinternal and t.tgname like '%immutable_guard'
  ),
  'composition instance versions reject UPDATE and DELETE'
);
select ok(
  exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_composition_instances')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_entry_revisions')
  ) and exists (
    select 1 from pg_constraint c
    where c.conrelid = to_regclass('platform_private.cms_composition_instances')
      and c.contype = 'f'
      and c.confrelid = to_regclass('platform_private.cms_pattern_versions')
  ),
  'composition instance binds real revision and optional pattern version'
);
select ok(
  coalesce((
    select count(*) = 7 and bool_and(attnotnull)
    from pg_attribute
    where attrelid = to_regclass('platform_private.cms_pattern_versions')
      and attname = any(array[
        'owner_id','state','version','pattern_key','block_tree',
        'block_registry_digest','content_hash']::name[])
  ), false),
  'pattern versions persist a bounded tree and server block digest'
);
select ok(
  coalesce((
    select count(*) = 8 and bool_and(attnotnull)
    from pg_attribute
    where attrelid = to_regclass('platform_private.cms_composition_instances')
      and attname = any(array[
        'owner_id','state','version','revision_id','path',
        'block_key','block_version','link_mode']::name[])
  ), false),
  'composition versions retain the revision path and block identity'
);
select ok(
  platform_private.cms_pattern_tree_keys_valid(
    '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb
  ) and not platform_private.cms_pattern_tree_keys_valid(
    '{"nodes":[{"blockKey":"Profile<HTML>"}]}'::jsonb
  ),
  'nested pattern block keys obey the canonical grammar'
);
select ok(
  coalesce((
    select count(*) = 8 and bool_and(
      not has_function_privilege(role_name, p.oid, 'execute')
    )
    from (values ('public'::name), ('anon'::name),
      ('authenticated'::name), ('service_role'::name)) roles(role_name)
    cross join pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in (
        'cms_pattern_tree_keys_valid', 'cms_pattern_versions_lifecycle_guard'
      )
  ), false),
  'new private composition helpers are not directly executable by API roles'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_pattern_versions(
  id, owner_id, version, pattern_key, block_tree, block_registry_digest,
  content_hash, owner_capability, created_by
)
select 'a9120000-0000-4000-8000-000000000201',
       (select value::uuid from s10_ids where key = 'organization'),
       1, 'test-pattern', '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb,
       repeat('a',64), repeat('b',64), 'cms.template_designer',
       (select value::uuid from s10_ids where key = 'creatorAuth');
insert into platform_private.cms_composition_instances(
  id, owner_id, version, revision_id, path, slot_key,
  block_key, block_version, pattern_id, pattern_version,
  block_registry_digest, link_mode, created_by
)
select 'a9120000-0000-4000-8000-000000000202',
       (select value::uuid from s10_ids where key = 'organization'),
       1, (select value::uuid from s10_ids where key = 'entryRevisionId'),
       '/primary', 'primary', 'profile.header', 1,
       'a9120000-0000-4000-8000-000000000201', 1, repeat('a',64),
       'linked', (select value::uuid from s10_ids where key = 'creatorAuth');
select throws_ok(
  $$update platform_private.cms_pattern_versions
    set block_tree = '{}'::jsonb
    where id = 'a9120000-0000-4000-8000-000000000201'$$,
  'P0001', 'CONFLICT', 'pattern definition cannot mutate in place'
);
select throws_ok(
  $$update platform_private.cms_composition_instances
    set state = 'active'
    where id = 'a9120000-0000-4000-8000-000000000202'$$,
  'P0001', 'IMMUTABLE_RECORD',
  'composition instance version cannot mutate after creation'
);
select set_config('app.cms_rpc', '', true);
select throws_ok(
  $$update platform_private.cms_pattern_versions
    set state = 'review', updated_at = clock_timestamp()
    where id = 'a9120000-0000-4000-8000-000000000201'$$,
  'P0001', 'DIRECT_CMS_TABLE_WRITE',
  'direct pattern state transition cannot bypass named RPC authority'
);

select finish();
rollback;
