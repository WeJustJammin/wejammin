commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a "transform registry"): the code-owned, versioned
-- registry resolved by the dry-run scan and the backfill executor.  Members are
-- seeded by a forward migration with a digest equal to the lowercase SHA-256 of
-- the JCS canonical JSON of the member definition; an unregistered pair never
-- resolves and CMS-03A-10 refuses it.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select ok(pg_temp.s09d_rls('cms_schema_transform_registry') and pg_temp.s09d_no_direct_grants('cms_schema_transform_registry'),
  'the registry table has forced RLS and no browser or service-role table grant');
select ok(pg_temp.s09d_has_columns('cms_schema_transform_registry', array['id','owner_id','state','version','created_at',
  'updated_at','transform_key','transform_version','digest','source_constraints','target_constraints',
  'accepted_field_kinds','behavior']), 'the registry row carries the IA envelope and the BE03a member fields');
select is((select count(*)::integer from platform_private.cms_schema_transform_registry), 2,
  'exactly the two evidenced members are seeded');
select ok((select bool_and(transform_version = 1 and state = 'seeded') from platform_private.cms_schema_transform_registry),
  'both initial members are version 1 and seeded');
select is((select digest::text from platform_private.cms_schema_transform_registry where transform_key = 'identity.revalidate'),
  '9088ab84f3c3ec40733e76e1e5a8320da14388e5a1be9272b5259140dc1d7578',
  'identity.revalidate digest equals the Worker registry literal (JCS SHA-256 of the member definition)');
select is((select digest::text from platform_private.cms_schema_transform_registry where transform_key = 'default.fill_literal'),
  'b69bfde9fa248844245f8c19fb31b60d41f0fae850dd93e5c75c4c9a8979023e',
  'default.fill_literal digest equals the Worker registry literal');
select ok((select bool_and(digest::text = platform_private.cms_transform_registry_digest(transform_key, transform_version,
    source_constraints, target_constraints, accepted_field_kinds, behavior))
  from platform_private.cms_schema_transform_registry), 'every stored digest equals the recomputation of its own columns');
select is((select jsonb_array_length(accepted_field_kinds) from platform_private.cms_schema_transform_registry
  where transform_key = 'identity.revalidate'), 14, 'identity.revalidate accepts every IA field kind');
select is((select accepted_field_kinds from platform_private.cms_schema_transform_registry where transform_key = 'default.fill_literal'),
  '["short_text","long_text","boolean","integer","decimal","date","datetime","enum"]'::jsonb,
  'default.fill_literal accepts exactly the eight literal-default kinds');
select ok(platform_private.cms_transform_registry_member('identity.revalidate', 1)->>'digest' =
  '9088ab84f3c3ec40733e76e1e5a8320da14388e5a1be9272b5259140dc1d7578'
  and platform_private.cms_transform_registry_member_valid('default.fill_literal', 1),
  'the resolver returns the verified member and the pair validity predicate accepts it');
select ok(platform_private.cms_transform_registry_member('identity.revalidate', 2) is null
  and platform_private.cms_transform_registry_member('unknown.transform', 1) is null
  and platform_private.cms_transform_registry_member(null, 1) is null
  and platform_private.cms_transform_registry_member('identity.revalidate', null) is null
  and not platform_private.cms_transform_registry_member_valid('cms.schema.migrate', 1),
  'an unregistered, wrong-version or null pair never resolves');
select ok(not pg_temp.s09d_try($q$update platform_private.cms_schema_transform_registry set behavior = 'x'$q$)
  and not pg_temp.s09d_try($q$delete from platform_private.cms_schema_transform_registry$q$),
  'registry rows are immutable: UPDATE and DELETE are refused');
select set_config('app.cms_rpc', 'false', true);
select ok(not pg_temp.s09d_try($q$insert into platform_private.cms_schema_transform_registry(owner_id, version, transform_key,
    transform_version, digest, source_constraints, target_constraints, accepted_field_kinds, behavior)
  values (extensions.gen_random_uuid(), 1, 'rogue.transform', 1, repeat('a', 64), '{}', '{}', '["short_text"]', 'rogue')$q$),
  'a hand-written registry insert outside an RPC context is refused');
select ok(not exists (select 1 from information_schema.routine_privileges
    where routine_schema = 'platform_private' and routine_name like 'cms_transform_registry%'
      and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')),
  'no registry function is executable by a browser or service role');

-- A tampered row never resolves (digest recomputation fails closed).
create or replace function pg_temp.s09r_tampered() returns boolean language plpgsql as $body$
declare resolved jsonb;
begin
  begin
    alter table platform_private.cms_schema_transform_registry disable trigger user;
    perform set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_schema_transform_registry set behavior = behavior || ';tampered'
      where transform_key = 'default.fill_literal';
    resolved := platform_private.cms_transform_registry_member('default.fill_literal', 1);
    raise exception 'ROLLBACK_OBSERVATION:%', coalesce(resolved::text, 'null');
  exception when others then
    return sqlerrm = 'ROLLBACK_OBSERVATION:null';
  end;
end;
$body$;
select ok(pg_temp.s09r_tampered(), 'a member whose columns no longer match its digest resolves to NULL');

-- CMS-03A-10 refuses an unregistered pair and accepts a registered one.
select pg_temp.s09d_create_type('a', 'regscan');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_tighten('b', 50);
select pg_temp.s09d_dry_run('b', 'owner', 'cms.schema.migrate', '1', 's09r-unreg-0001');
select is(pg_temp.s09d_outcome('b:dryRun'), 'VALIDATION_FAILED',
  'CMS-03A-10 refuses a conditional attempt whose transform pair is not a registered member');
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '2', 's09r-unreg-0002');
select is(pg_temp.s09d_outcome('b:dryRun'), 'VALIDATION_FAILED',
  'CMS-03A-10 refuses a registered key with an unregistered version');
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1', 's09r-reg-0001');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'CMS-03A-10 accepts the registered identity.revalidate version 1 pair');
select is((select transform_key || '@' || transform_version from platform_private.cms_schema_migration_plans
  where id = pg_temp.s09d_id('b:plan')), 'identity.revalidate@1', 'the plan stores the resolved key and version');

select * from finish();
rollback;
