-- Slice 10 evidence lane EA (P2-S10-AC-006, AC-012, AC-018, AC-024): the database half of the
-- principal / capability / ownership / scope / RLS boundary of CMS-03B-01..04.
--
--   * RLS: every private editorial table (entries, revisions, field values, relations, assignments,
--     CONFLICT RECORDS, restore-chain manifests, edit presence) has row security enabled AND forced
--     and no table privilege for anon, authenticated or service_role; each table is its own
--     assertion, and a role that tries to read it is refused with insufficient_privilege (42501).
--     A NEGATIVE CONTROL per property shows the predicate flips when the property is removed
--     (force RLS dropped, a grant added), so a table that lost its protection cannot pass.
--   * Scope and ownership: the acting party comes from the request context and the actor from the
--     verified claims.  A forged acting party, a non-member actor and a forged owner / actor member
--     are refused (NOT_FOUND concealment or INVALID_REQUEST) and write NOTHING, for the append, the
--     resolve and the restore.
--
-- Every call goes through the named worker-facing RPC exactly as the Worker calls it.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

-- ---- RLS and grants, one assertion per table ----------------------------------------------------
create or replace function pg_temp.s10u_locked(p_table text)
returns boolean
language sql
stable
as $body$
  select coalesce((
    select c.relrowsecurity and c.relforcerowsecurity
    from pg_class c where c.oid = to_regclass(p_table)), false)
  and not exists (
    select 1
    from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name),
         (values ('select'), ('insert'), ('update'), ('delete')) as privileges(privilege)
    where has_table_privilege(roles.role_name, p_table, privileges.privilege))
$body$;

create or replace function pg_temp.s10u_role_states(p_table text)
returns text
language plpgsql
as $body$
declare
  role_name text;
  observed text := '';
  sentinel constant text := 'S10U_SENTINEL_77aa';
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    begin
      begin
        execute format('set local role %I', role_name);
        execute format('select count(*) from %s', p_table);
        observed := observed || role_name || ':read;';
      exception when others then
        observed := observed || role_name || ':' || sqlstate || ';';
      end;
      raise exception '%', sentinel using errcode = 'P0001';
    exception when others then
      if sqlerrm <> sentinel then raise; end if;
    end;
  end loop;
  return observed;
end;
$body$;

select ok(pg_temp.s10u_locked('platform_private.cms_content_entries'),
  'RLS is enabled and forced on cms_content_entries and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_entry_revisions'),
  'RLS is enabled and forced on cms_entry_revisions and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_entry_field_values'),
  'RLS is enabled and forced on cms_entry_field_values and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_entry_relations'),
  'RLS is enabled and forced on cms_entry_relations and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_entry_assignments'),
  'RLS is enabled and forced on cms_entry_assignments and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_conflict_records'),
  'RLS is enabled and forced on cms_conflict_records and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_restore_chain_manifests'),
  'RLS is enabled and forced on cms_restore_chain_manifests and anon, authenticated and service_role hold no table privilege');
select ok(pg_temp.s10u_locked('platform_private.cms_edit_presence'),
  'RLS is enabled and forced on cms_edit_presence and anon, authenticated and service_role hold no table privilege');

select is(pg_temp.s10u_role_states('platform_private.cms_conflict_records'),
  'anon:42501;authenticated:42501;service_role:42501;',
  'a read of cms_conflict_records is refused with insufficient_privilege for anon, authenticated and service_role');
select is(pg_temp.s10u_role_states('platform_private.cms_entry_revisions'),
  'anon:42501;authenticated:42501;service_role:42501;',
  'a read of cms_entry_revisions is refused with insufficient_privilege for anon, authenticated and service_role');
select is(pg_temp.s10u_role_states('platform_private.cms_restore_chain_manifests'),
  'anon:42501;authenticated:42501;service_role:42501;',
  'a read of cms_restore_chain_manifests is refused with insufficient_privilege for anon, authenticated and service_role');

-- negative controls: the predicate is sensitive to each property it claims to prove
create or replace function pg_temp.s10u_mutated(p_mutation text, p_table text)
returns boolean
language plpgsql
as $body$
declare
  verdict boolean;
  sentinel constant text := 'S10U_SENTINEL_90bb';
begin
  begin
    execute p_mutation;
    verdict := pg_temp.s10u_locked(p_table);
    raise exception '%', sentinel using errcode = 'P0001';
  exception when others then
    if sqlerrm <> sentinel then raise; end if;
  end;
  return verdict;
end;
$body$;

select is(
  pg_temp.s10u_mutated('alter table platform_private.cms_conflict_records no force row level security',
    'platform_private.cms_conflict_records'),
  false, 'control: dropping FORCE ROW LEVEL SECURITY from cms_conflict_records makes the RLS predicate false');
select is(
  pg_temp.s10u_mutated('alter table platform_private.cms_conflict_records disable row level security',
    'platform_private.cms_conflict_records'),
  false, 'control: disabling row level security on cms_conflict_records makes the RLS predicate false');
select is(
  pg_temp.s10u_mutated('grant select on platform_private.cms_conflict_records to authenticated',
    'platform_private.cms_conflict_records'),
  false, 'control: granting select on cms_conflict_records to authenticated makes the predicate false');
select is(
  pg_temp.s10u_mutated('grant insert on platform_private.cms_entry_revisions to service_role',
    'platform_private.cms_entry_revisions'),
  false, 'control: granting insert on cms_entry_revisions to service_role makes the predicate false');

-- ---- scope and ownership: forged acting party, non-member actor, forged owner / actor member -----
create temp table s10u_calls(label text primary key, state text, message text, response jsonb) on commit drop;
create or replace function pg_temp.s10u_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb;
begin
  begin
    execute p_sql into result;
    insert into s10u_calls values (p_label, '00000', null, result)
    on conflict (label) do update set state = excluded.state, message = null, response = excluded.response;
  exception when others then
    insert into s10u_calls values (p_label, sqlstate, sqlerrm, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, response = null;
  end;
end;
$body$;

create or replace function pg_temp.s10u_counts()
returns text
language sql
stable
as $body$
  select pg_temp.s10r_counts() || '/'
      || (select count(*) from platform_private.cms_restore_chain_manifests)::text
$body$;

-- Runs install + call inside a subtransaction that is always rolled back; reports the failure
-- message and whether any table changed.
create or replace function pg_temp.s10u_run(p_install text, p_call text)
returns jsonb
language plpgsql
as $body$
declare
  before_counts text;
  after_counts text;
  failure text;
  sentinel constant text := 'S10U_SENTINEL_c3d4';
begin
  begin
    execute p_install;
    before_counts := pg_temp.s10u_counts();
    begin
      execute p_call;
    exception when others then
      failure := sqlerrm;
    end;
    after_counts := pg_temp.s10u_counts();
    raise exception '%', sentinel using errcode = 'P0001';
  exception when others then
    if sqlerrm <> sentinel then raise; end if;
  end;
  return jsonb_build_object('failure', failure, 'unchanged', before_counts = after_counts);
end;
$body$;

select pg_temp.s10u_call('create', pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'A'), 's10-ea-auth-create-0001'));
create temp table s10u_entry on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as rev1
from s10u_calls where label = 'create';
select pg_temp.s10u_call('theirs', pg_temp.s10r_revision_sql((select entry_id from s10u_entry),
  jsonb_build_object('title', 'B'), '1', '1', 's10-ea-auth-theirs-0001'));
select pg_temp.s10u_call('yours', pg_temp.s10r_revision_sql((select entry_id from s10u_entry),
  jsonb_build_object('title', 'C'), '1', '2', 's10-ea-auth-yours-0001'));
create temp table s10u_conflict on commit drop as
select id as conflict_id from platform_private.cms_conflict_records
 where entry_id = (select entry_id::uuid from s10u_entry) and state = 'open';
select is((select count(*)::integer from s10u_conflict), 1, 'fixture: one open conflict exists for the resolve probes');

-- The three request bodies (jsonb) the Worker would send.
create or replace function pg_temp.s10u_append()
returns jsonb language sql stable as $body$
  select pg_temp.s10r_revision_request((select entry_id from s10u_entry),
    jsonb_build_object('title', 'Z'), '2', '2', 's10-ea-auth-append')
$body$;
create or replace function pg_temp.s10u_resolve()
returns jsonb language sql stable as $body$
  select jsonb_build_object(
    'entryId', (select entry_id from s10u_entry), 'conflictId', (select conflict_id from s10u_conflict),
    'baseRevision', '1',
    'choices', jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')),
    'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', 's10-ea-auth-resolve',
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))
$body$;
create or replace function pg_temp.s10u_restore()
returns jsonb language sql stable as $body$
  select jsonb_build_object(
    'entryId', (select entry_id from s10u_entry), 'revisionId', (select rev1 from s10u_entry),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10r_ids where key = 'typeId'),
        (select value::uuid from s10r_ids where key = 'versionId'),
        (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', '2', 'idempotencyKey', 's10-ea-auth-restore',
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))
$body$;

create or replace function pg_temp.s10u_sql(p_op text, p_request jsonb)
returns text language sql immutable as $body$
  select 'select platform_api.' || case p_op
    when 'append' then 'cms_create_revision'
    when 'resolve' then 'cms_resolve_conflict'
    else 'cms_restore_revision' end || '(' || quote_literal(p_request::text) || '::jsonb)'
$body$;

create or replace function pg_temp.s10u_forge(p_kind text, p_request jsonb)
returns jsonb language sql stable as $body$
  select case p_kind
    when 'forged acting party' then jsonb_set(p_request, '{context,actingPartyId}',
      to_jsonb((select value from s10_ids where key = 'strangerPerson')))
    when 'forged owner member' then p_request
      || jsonb_build_object('ownerId', (select value from s10_ids where key = 'strangerPerson'))
    when 'forged actor member' then p_request
      || jsonb_build_object('actorId', (select value from s10_ids where key = 'strangerAuth'))
    else p_request end
$body$;

create temp table s10u_probes on commit drop as
select ops.op, kinds.kind,
       pg_temp.s10u_run(kinds.install,
         pg_temp.s10u_sql(ops.op, pg_temp.s10u_forge(kinds.kind, ops.request))) as run
from (values
  ('append', pg_temp.s10u_append()),
  ('resolve', pg_temp.s10u_resolve()),
  ('restore', pg_temp.s10u_restore())) as ops(op, request)
cross join (values
  ('control', 'select 1'),
  ('forged acting party', 'select 1'),
  ('forged owner member', 'select 1'),
  ('forged actor member', 'select 1'),
  ('non-member actor',
   'select pg_temp.s10_rpc_as(''' || (select value from s10_ids where key = 'strangerAuth')
     || '''::uuid, ''' || (select value from s10_ids where key = 'organization') || '''::uuid)')
) as kinds(kind, install);

create or replace function pg_temp.s10u_verdict(p_op text, p_kind text)
returns text language sql stable as $body$
  select coalesce(run->>'failure', 'OK') || '/' || case when (run->>'unchanged')::boolean then 'unchanged' else 'written' end
  from s10u_probes where op = p_op and kind = p_kind
$body$;

select is(pg_temp.s10u_verdict('append', 'control'), 'OK/written',
  'control: the unforged append is accepted and writes');
select is(pg_temp.s10u_verdict('resolve', 'control'), 'OK/written',
  'control: the unforged resolve is accepted and writes');
select is(pg_temp.s10u_verdict('restore', 'control'), 'OK/written',
  'control: the unforged restore is accepted and writes');

select is(pg_temp.s10u_verdict('append', 'forged acting party'), 'NOT_FOUND/unchanged',
  'append: a forged acting party is concealed as NOT_FOUND and writes nothing');
select is(pg_temp.s10u_verdict('resolve', 'forged acting party'), 'NOT_FOUND/unchanged',
  'resolve: a forged acting party is concealed as NOT_FOUND and writes nothing');
select is(pg_temp.s10u_verdict('restore', 'forged acting party'), 'NOT_FOUND/unchanged',
  'restore: a forged acting party is concealed as NOT_FOUND and writes nothing');

select is(pg_temp.s10u_verdict('append', 'non-member actor'), 'NOT_FOUND/unchanged',
  'append: an actor who is not a member of the owner is concealed as NOT_FOUND and writes nothing');
select is(pg_temp.s10u_verdict('resolve', 'non-member actor'), 'NOT_FOUND/unchanged',
  'resolve: an actor who is not a member of the owner is concealed as NOT_FOUND and writes nothing');
select is(pg_temp.s10u_verdict('restore', 'non-member actor'), 'NOT_FOUND/unchanged',
  'restore: an actor who is not a member of the owner is concealed as NOT_FOUND and writes nothing');

select is(pg_temp.s10u_verdict('append', 'forged owner member'), 'INVALID_REQUEST/unchanged',
  'append: a request member naming an owner is INVALID_REQUEST and writes nothing');
select is(pg_temp.s10u_verdict('resolve', 'forged owner member'), 'INVALID_REQUEST/unchanged',
  'resolve: a request member naming an owner is INVALID_REQUEST and writes nothing');
select is(pg_temp.s10u_verdict('restore', 'forged owner member'), 'INVALID_REQUEST/unchanged',
  'restore: a request member naming an owner is INVALID_REQUEST and writes nothing');

select is(pg_temp.s10u_verdict('append', 'forged actor member'), 'INVALID_REQUEST/unchanged',
  'append: a request member naming an actor is INVALID_REQUEST and writes nothing');
select is(pg_temp.s10u_verdict('resolve', 'forged actor member'), 'INVALID_REQUEST/unchanged',
  'resolve: a request member naming an actor is INVALID_REQUEST and writes nothing');
select is(pg_temp.s10u_verdict('restore', 'forged actor member'), 'INVALID_REQUEST/unchanged',
  'restore: a request member naming an actor is INVALID_REQUEST and writes nothing');

select * from finish();
rollback;
