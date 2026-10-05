\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_table(
  'platform_private',
  'db_harness_fixture',
  'the database harness fixture table exists in the private schema'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'platform_private'
      and pg_class.relname = 'db_harness_fixture'
  ),
  'the fixture table has row-level security enabled'
);
select ok(
  (
    select relforcerowsecurity
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'platform_private'
      and pg_class.relname = 'db_harness_fixture'
  ),
  'the fixture table forces row-level security for table owners'
);
select ok(
  not has_schema_privilege('authenticated', 'platform_private', 'usage'),
  'authenticated callers cannot resolve the private schema directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'platform_private.db_harness_fixture',
    'select'
  ),
  'authenticated callers cannot select the private fixture table directly'
);
select ok(
  not has_table_privilege(
    'anon',
    'platform_private.db_harness_fixture',
    'select'
  ),
  'anonymous callers cannot select the private fixture table'
);
select ok(
  has_function_privilege(
    'authenticated',
    'platform_api.list_harness_fixtures()',
    'execute'
  ),
  'authenticated callers can execute the named RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'platform_api.list_harness_fixtures()',
    'execute'
  ),
  'anonymous callers cannot execute the named RPC'
);
select ok(
  not has_function_privilege(
    'service_role',
    'platform_api.list_harness_fixtures()',
    'execute'
  ),
  'service role is not granted a blanket harness RPC path'
);
select ok(
  not (
    select prosecdef
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'platform_api'
      and pg_proc.proname = 'list_harness_fixtures'
  ),
  'the harness RPC executes with caller privileges (SECURITY INVOKER)'
);
select ok(
  (
    select coalesce(array_to_string(proconfig, ','), '') like 'search_path=%'
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'platform_api'
      and pg_proc.proname = 'list_harness_fixtures'
  ),
  'the harness RPC pins an empty function search path'
);
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'platform_private'
      and tablename = 'db_harness_fixture'
      and policyname = 'db_harness_fixture_owner_select'
      and qual like '%auth.uid%'
  ),
  'the RLS policy binds visibility to the server-derived auth.uid value'
);
select ok(
  has_table_privilege(
    'authenticated',
    'platform_api.db_harness_fixture_read',
    'select'
  ),
  'authenticated callers receive SELECT only on the allowlisted projection'
);
select ok(
  not has_table_privilege(
    'anon',
    'platform_api.db_harness_fixture_read',
    'select'
  ),
  'anonymous callers cannot select the allowlisted projection'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'platform_api.db_harness_fixture_read',
    'insert'
  ),
  'the allowlisted projection has no authenticated write privilege'
);
select is(
  (select count(*) from platform_private.db_harness_fixture),
  2::bigint,
  'the deterministic seed loads exactly two synthetic fixtures'
);

set local role authenticated;
select pg_temp.set_jwt_claim('sub',
  '00000000-0000-0000-0000-000000000101',
  true
);
select results_eq(
  $$ select label from platform_api.list_harness_fixtures() $$,
  $$ values ('database harness synthetic fixture alice'::text) $$,
  'the invoker RPC returns only the authenticated user row'
);
select results_eq(
  $$ select owner_id from platform_api.list_harness_fixtures() $$,
  $$ values ('00000000-0000-0000-0000-000000000101'::uuid) $$,
  'the invoker RPC preserves the authenticated owner identity'
);

select pg_temp.set_jwt_claim('sub',
  '00000000-0000-0000-0000-000000000202',
  true
);
select results_eq(
  $$ select label from platform_api.list_harness_fixtures() $$,
  $$ values ('database harness synthetic fixture bob'::text) $$,
  'a wrong valid user cannot read the first user fixture'
);
select results_eq(
  $$ select id from platform_api.list_harness_fixtures() $$,
  $$ values ('00000000-0000-0000-0000-000000000002'::uuid) $$,
  'a wrong valid user receives only its own resource identifier'
);

reset role;
set local role anon;
select throws_ok(
  $$ select * from platform_private.db_harness_fixture $$,
  '42501',
  'permission denied for schema platform_private',
  'anonymous direct table access is denied'
);
select throws_ok(
  $$ select * from platform_api.list_harness_fixtures() $$,
  '42501',
  'permission denied for function list_harness_fixtures',
  'anonymous RPC execution is denied'
);

select ok(
  not has_schema_privilege('anon', 'platform_private', 'usage'),
  'anonymous callers cannot resolve the private schema'
);
select ok(
  has_schema_privilege('authenticated', 'platform_api', 'usage'),
  'authenticated callers can resolve the explicitly allowlisted API schema'
);

select * from finish();

rollback;
