-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-276, BE03c "Slice 12 lock order" rows CMS-03C-01 / CMS-03C-16 and rule 1, under REAL concurrency
-- (review V13-05; root decision 2026-10-28).  Two independent sessions (a dblink holder, the precedent of
-- phase_02_slice_09_schema/000b-activation-lock.sqlinc) against COMMITTED forged fixtures that this file removes again; the command under test is
-- the real public wrapper (platform_api.cms_define_template, platform_api.cms_create_taxonomy_version) called from THIS session.
--   world 1  an organization whose person holds cms.template_designer (the revocation interleaving, position 1);
--   world 2  an organization with an ACTIVE content type and version and the designer and curator grants (position 4).
--   S0  control   nothing is held: a define returns at once (so every wait below is the lock, not the harness);
--   S1  the holder owns FOR UPDATE on the active content type version row (what a schema activation holds): a define and a taxonomy create
--       that names the type wait for it and, with a 1 s lock_timeout, answer the retryable CONFLICT with nothing written (position 4);
--   S2  the holder releases after 2 s with no change: the define waits (>= 1 s) and then commits exactly one draft;
--   S3  the holder supersedes the type version and commits after 2 s: the define that waited re-proves the compatibility under the lock and
--       is VALIDATION_FAILED with nothing written, never a draft pinned to a version that was superseded meanwhile (deterministic);
--   S4a the define took the designer grant rows FOR SHARE (position 1) and holds them: a concurrent revocation of the grant WAITS (55P03);
--   S4b a revocation is in flight (uncommitted) and then commits: the define that waited re-proves the capability under the lock and is
--       FORBIDDEN with nothing written (a revocation committed first wins).
-- The whole scenario runs in autocommit BEFORE the pgTAP transaction, as the precedent does; the assertions read the recorded outcomes.
-- Fixture forgeries (labelled FIXTURE FORGERY): the auth user, person, organizations, tenures, grants, acting-context bindings, content types,
-- versions and artifacts are inserted directly because no command builds a committed world inside a pgTAP file; the cleanup block removes them.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;

create temp table p4_result(key text primary key, value text not null);
create temp table p4_sql(key text primary key, body text not null);

-- ---------------------------------------------------------------------------------------------------------- fixture SQL
-- The trigger switches are their own committed statements: ALTER TABLE refuses while the same transaction has pending (deferred foreign key)
-- trigger events, so the rows are written and removed between them.
insert into p4_sql values ('triggers_off', $off$
do $body$
begin
  alter table platform_private.cms_content_type_versions disable trigger user;
  alter table platform_private.cms_content_types disable trigger user;
  alter table platform_private.cms_template_versions disable trigger user;
  alter table platform_private.cms_taxonomy_versions disable trigger user;
  drop trigger if exists cms_schema_artifacts_z_compile_guard on platform_private.cms_schema_artifacts;
end;
$body$;
$off$);
insert into p4_sql values ('triggers_on', $on$
do $body$
begin
  create trigger cms_schema_artifacts_z_compile_guard before update or delete on platform_private.cms_schema_artifacts
    for each row execute function platform_private.cms_schema_artifact_guard();
  alter table platform_private.cms_content_type_versions enable trigger user;
  alter table platform_private.cms_content_types enable trigger user;
  alter table platform_private.cms_template_versions enable trigger user;
  alter table platform_private.cms_taxonomy_versions enable trigger user;
end;
$body$;
$on$);
insert into p4_sql values ('cleanup', $cleanup$
do $body$
declare world integer;
begin
  for world in 1 .. 2 loop
    delete from platform_private.cms_template_versions where owner_id = ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid;
    delete from platform_private.cms_taxonomy_versions where owner_id = ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid;
    delete from platform_private.cms_schema_artifacts where id = ('a9440000-0000-4000-8000-00000000' || world || '008')::uuid;
    delete from platform_private.cms_content_type_versions where id = ('a9440000-0000-4000-8000-00000000' || world || '007')::uuid;
    delete from platform_private.cms_content_types where id = ('a9440000-0000-4000-8000-00000000' || world || '006')::uuid;
    delete from platform_private.acting_context_binding where id = ('a9440000-0000-4000-8000-00000000' || world || '005')::uuid;
    delete from identity_private.organization_actor_grant where organization_id = ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid;
    delete from identity_private.membership_tenure where id = ('a9440000-0000-4000-8000-00000000' || world || '004')::uuid;
    delete from identity.auth_user_bindings where auth_user_id = ('a9440000-0000-4000-8000-00000000' || world || '001')::uuid;
    delete from platform_private.person_party where party_id = ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid;
    delete from identity_private.organization_party where party_id = ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid;
    delete from platform_private.party
     where id in (('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid);
    delete from auth.users where id = ('a9440000-0000-4000-8000-00000000' || world || '001')::uuid;
  end loop;
end;
$body$;
$cleanup$);
insert into p4_sql values ('setup', $setup$
do $body$
declare world integer;
begin
  for world in 1 .. 2 loop
    -- FIXTURE FORGERY (position-4 race): throwaway person, organization, membership, grants, binding, type, version and artifact
    insert into auth.users(id, is_sso_user, is_anonymous) values (('a9440000-0000-4000-8000-00000000' || world || '001')::uuid, false, false);
    insert into platform_private.party(id, kind) values
      (('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, 'person'), (('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'organization');
    insert into platform_private.person_party(party_id, auth_user_id, account_state)
    values (('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '001')::uuid, 'active');
    insert into identity.auth_user_bindings(auth_user_id, person_id, state)
    values (('a9440000-0000-4000-8000-00000000' || world || '001')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, 'active');
    insert into identity_private.organization_party(party_id, ownership_state, governance_mode, lifecycle)
    values (('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'owned', 'ungoverned', 'active');
    insert into identity_private.membership_tenure(id, organization_id, person_id, state, provenance, governance_mode, starts_on, accepted_at, actor_id)
    values (('a9440000-0000-4000-8000-00000000' || world || '004')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid,
            ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, 'confirmed', 'invitation', 'ungoverned', current_date, clock_timestamp(),
            ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid);
    insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, active)
    select ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid, capability, current_date, true
      from (values ('cms.template_designer'), ('cms.taxonomy_curator')) c(capability);
    insert into platform_private.acting_context_binding(id, person_id, acting_party_id, context_kind, client_binding_id, state, selected_at, last_seen_at,
      expires_at, projection_version, version)
    values (('a9440000-0000-4000-8000-00000000' || world || '005')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '002')::uuid,
            ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'organization', 's12-p4-' || world, 'active', clock_timestamp(), clock_timestamp(),
            clock_timestamp() + interval '1 hour', 1, 1);
    insert into platform_private.cms_content_types(id, owner_id, state, version, type_key, owner_capability, built_in, created_by)
    values (('a9440000-0000-4000-8000-00000000' || world || '006')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'active', 1,
            's12_p4_probe' || world, 'cms.schema_designer', false, ('a9440000-0000-4000-8000-00000000' || world || '001')::uuid);
    insert into platform_private.cms_content_type_versions(
      id, owner_id, state, version, content_type_id, version_no, labels, workflow_key, workflow_version, source_locale, default_locale,
      supported_locales, fallback_chains, locale_config_hash, schema_artifact_id, definition_hash, compatibility, created_by,
      activation_workflow_policy_key, activation_workflow_policy_version, activation_workflow_policy_hash, activation_required_decision_count,
      activation_required_capabilities, activation_approval_evidence_hash)
    values (('a9440000-0000-4000-8000-00000000' || world || '007')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'active', 1,
            ('a9440000-0000-4000-8000-00000000' || world || '006')::uuid, 1, '{}'::jsonb, 'editorial', 1, 'en-US', 'en-US', '["en-US"]'::jsonb, '{}'::jsonb,
            '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860', ('a9440000-0000-4000-8000-00000000' || world || '008')::uuid,
            repeat('e', 64), 'additive', ('a9440000-0000-4000-8000-00000000' || world || '001')::uuid,
            'editorial', 1, repeat('c', 64), 1, '["cms.reviewer"]'::jsonb, repeat('d', 64));
    insert into platform_private.cms_schema_artifacts(id, owner_id, state, version, content_type_version_id, compiler_version, zod_contract_ref,
      editor_manifest, renderer_manifest, artifact_hash, compiled_at)
    values (('a9440000-0000-4000-8000-00000000' || world || '008')::uuid, ('a9440000-0000-4000-8000-00000000' || world || '003')::uuid, 'compiled', 1,
            ('a9440000-0000-4000-8000-00000000' || world || '007')::uuid, '1', 'cms/content-type/s12_p4_probe' || world || '/v1', '{}'::jsonb, '{}'::jsonb,
            repeat(world::text, 64), clock_timestamp());
  end loop;
end;
$body$;
$setup$);
-- fixture removal in the only safe order: triggers off, rows out, triggers on
create or replace function pg_temp.p4_cleanup() returns void language plpgsql as $body$
begin
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'triggers_off'));
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'cleanup'));
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'triggers_on'));
end;
$body$;

-- ---------------------------------------------------------------------------------------------------------- helpers (this session)
-- Runs p_sql in a sub-transaction that is ALWAYS rolled back (so no row lock of the command outlives the call); returns '00000:' || p_probe
-- (evaluated inside the sub-transaction, before the rollback) on success, or '<sqlstate>:<message>' on failure.
create or replace function pg_temp.p4_try(p_sql text, p_probe text default 'select ''ok''') returns text language plpgsql as $body$
declare outcome text;
begin
  begin
    execute p_sql;
    execute p_probe into outcome;
    outcome := '00000:' || coalesce(outcome, '');
    raise exception 'p4 rollback' using errcode = 'P4RB0';
  exception when others then
    if sqlstate = 'P4RB0' then return outcome; end if;
    return sqlstate || ':' || sqlerrm;
  end;
end;
$body$;
-- The actor of world p_world as the Worker would publish it (the helper s10_rpc_as publishes the same settings).
create or replace function pg_temp.p4_act_as(p_world integer) returns void language plpgsql as $body$
declare auth_user text := 'a9440000-0000-4000-8000-00000000' || p_world || '001';
begin
  perform pg_temp.set_jwt_claim('role', 'authenticated', true);
  perform pg_temp.set_jwt_claim('sub', auth_user, true);
  perform pg_catalog.set_config('app.auth_user_id', auth_user, true);
  perform pg_catalog.set_config('app.actor_auth_user_id', auth_user, true);
  perform pg_catalog.set_config('app.actor_person_id', 'a9440000-0000-4000-8000-00000000' || p_world || '002', true);
  perform pg_catalog.set_config('app.acting_party_id', 'a9440000-0000-4000-8000-00000000' || p_world || '003', true);
  perform pg_catalog.set_config('app.acting_context_id', '', true);
end;
$body$;
create or replace function pg_temp.p4_context(p_world integer) returns jsonb language sql as $body$
  select jsonb_build_object('actingPartyId', 'a9440000-0000-4000-8000-00000000' || p_world || '003',
    'actingContextId', 'a9440000-0000-4000-8000-00000000' || p_world || '005', 'correlationId', 'a9440000-0000-4000-8000-00000000' || p_world || '009') $body$;
create or replace function pg_temp.p4_define_sql(p_world integer, p_key text) returns text language sql as $body$
  select format('select platform_api.cms_define_template(%L::jsonb)', jsonb_build_object(
    'templateKey', p_key, 'compatibleTypeIds', jsonb_build_array('a9440000-0000-4000-8000-00000000' || p_world || '006'), 'slots', '[]'::jsonb,
    'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'), 'bindings', '{}'::jsonb, 'locale', 'en-US',
    'audience', 'public', 'expectedVersion', null, 'idempotencyKey', 's12-p4-' || p_key || '-0001', 'context', pg_temp.p4_context(p_world))::text) $body$;
create or replace function pg_temp.p4_taxonomy_sql(p_world integer, p_key text) returns text language sql as $body$
  select format('select platform_api.cms_create_taxonomy_version(%L::jsonb)', jsonb_build_object(
    'taxonomyKey', p_key, 'shape', 'flat', 'allowedTypeKeys', jsonb_build_array('s12_p4_probe' || p_world), 'allowedFieldKeys', jsonb_build_array('p4_field'),
    'canonicalOverlapDomains', '[]'::jsonb, 'expectedVersion', null, 'idempotencyKey', 's12-p4-' || p_key || '-0001',
    'context', pg_temp.p4_context(p_world))::text) $body$;
-- the number of drafts of the template key / taxonomy key visible inside the sub-transaction
create or replace function pg_temp.p4_rows_sql(p_table text, p_key_column text, p_key text) returns text language sql as $body$
  select format('select ''rows='' || count(*) from platform_private.%I where %I = %L', p_table, p_key_column, p_key) $body$;
-- wait until a dblink connection is idle, then drain its results (the extra zero-row read consumes the terminator)
create or replace function pg_temp.p4_drain(p_conn text) returns void language plpgsql as $body$
declare n integer;
begin
  for i in 1 .. 600 loop
    exit when extensions.dblink_is_busy(p_conn) = 0;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  for i in 1 .. 6 loop
    select pg_catalog.count(*) into n from extensions.dblink_get_result(p_conn, false) as result(value text);
    exit when n = 0;
  end loop;
exception when others then
  null;
end;
$body$;
-- a statement on the holder: '00000' on success, the SQLSTATE on failure (the session is never left in an aborted state)
create or replace function pg_temp.p4_holder(p_sql text) returns text language plpgsql as $body$
begin
  perform extensions.dblink_exec('p4_a', p_sql);
  return '00000';
exception when others then
  return sqlstate;
end;
$body$;
-- the revocation seam: an UPDATE of the designer grant, with a short lock_timeout, on the holder session
create or replace function pg_temp.p4_revoke_attempt() returns text language plpgsql as $body$
begin
  perform extensions.dblink_exec('p4_a', 'set lock_timeout = ''500ms''');
  return pg_temp.p4_holder($u$update identity_private.organization_actor_grant set active = false
    where organization_id = 'a9440000-0000-4000-8000-000000001003'::uuid and capability_code = 'cms.template_designer'$u$);
end;
$body$;

-- ---------------------------------------------------------------------------------------------------------- the scenario
set statement_timeout = 0;
do $probe$
declare
  conn_string constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  type_version constant text := 'a9440000-0000-4000-8000-000000002007';
  grant_where constant text := $w$organization_id = 'a9440000-0000-4000-8000-000000001003'::uuid and capability_code = 'cms.template_designer'$w$;
  hold_sql constant text := format($h$do $b$ begin perform 1 from platform_private.cms_content_type_versions where id = %L::uuid for update; end $b$$h$, type_version);
  started timestamptz;
  outcome text;
begin
  begin perform extensions.dblink_disconnect('p4_a'); exception when others then null; end;
  perform extensions.dblink_connect('p4_a', conn_string);
  perform extensions.dblink_exec('p4_a', 'set app.cms_rpc = ''true''');
  perform extensions.dblink_exec('p4_a', 'set statement_timeout = ''30s''');
  perform pg_temp.p4_cleanup();
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'triggers_off'));
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'setup'));
  perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'triggers_on'));
  insert into p4_result values ('fixture_world_2_type_version', (select value from extensions.dblink('p4_a',
    format('select state::text from platform_private.cms_content_type_versions where id = %L::uuid', type_version)) as result(value text)));
  perform set_config('lock_timeout', '10s', true);

  -- S0 control: nothing held
  perform pg_temp.p4_act_as(2);
  started := clock_timestamp();
  outcome := pg_temp.p4_try(pg_temp.p4_define_sql(2, 'p4-control'), pg_temp.p4_rows_sql('cms_template_versions', 'template_key', 'p4-control'));
  insert into p4_result values ('s0_define', outcome), ('s0_fast', (clock_timestamp() - started < interval '1 second')::text);

  -- S1: the holder owns the active content type version row FOR UPDATE; a short lock_timeout turns the wait into the retryable CONFLICT
  perform extensions.dblink_exec('p4_a', 'begin');
  perform extensions.dblink_exec('p4_a', hold_sql);
  perform set_config('lock_timeout', '1s', true);
  started := clock_timestamp();
  insert into p4_result values ('s1_define', pg_temp.p4_try(pg_temp.p4_define_sql(2, 'p4-s1'), pg_temp.p4_rows_sql('cms_template_versions', 'template_key', 'p4-s1')));
  insert into p4_result values ('s1_define_waited', (clock_timestamp() - started >= interval '900 milliseconds')::text);
  insert into p4_result values ('s1_taxonomy', pg_temp.p4_try(pg_temp.p4_taxonomy_sql(2, 'p4-tax-s1'), pg_temp.p4_rows_sql('cms_taxonomy_versions', 'taxonomy_key', 'p4-tax-s1')));

  -- S2: the holder releases after 2 s, no change: the define waits and then writes exactly one draft
  perform set_config('lock_timeout', '10s', true);
  perform extensions.dblink_send_query('p4_a', 'select pg_sleep(2)::text; commit;');
  started := clock_timestamp();
  insert into p4_result values ('s2_define', pg_temp.p4_try(pg_temp.p4_define_sql(2, 'p4-s2'), pg_temp.p4_rows_sql('cms_template_versions', 'template_key', 'p4-s2')));
  insert into p4_result values ('s2_waited', (clock_timestamp() - started >= interval '1 second')::text);
  perform pg_temp.p4_drain('p4_a');

  -- S3: the holder supersedes the type version and commits after 2 s: the waiting define re-proves the compatibility under the lock
  perform extensions.dblink_exec('p4_a', 'alter table platform_private.cms_content_type_versions disable trigger user');
  perform extensions.dblink_exec('p4_a', 'begin');
  perform extensions.dblink_exec('p4_a', hold_sql);
  perform extensions.dblink_send_query('p4_a', format('select pg_sleep(2)::text; update platform_private.cms_content_type_versions set state = ''superseded'' where id = %L::uuid; commit;', type_version));
  started := clock_timestamp();
  insert into p4_result values ('s3_define', pg_temp.p4_try(pg_temp.p4_define_sql(2, 'p4-s3'), pg_temp.p4_rows_sql('cms_template_versions', 'template_key', 'p4-s3')));
  insert into p4_result values ('s3_waited', (clock_timestamp() - started >= interval '1 second')::text);
  perform pg_temp.p4_drain('p4_a');
  perform extensions.dblink_exec('p4_a', 'alter table platform_private.cms_content_type_versions enable trigger user');
  insert into p4_result values ('s3_type_state', (select value from extensions.dblink('p4_a',
    format('select state::text from platform_private.cms_content_type_versions where id = %L::uuid', type_version)) as result(value text)));

  -- S4a: a define holding the position-1 grant locks makes a concurrent revocation wait
  perform pg_temp.p4_act_as(1);
  insert into p4_result values ('s4a_define', pg_temp.p4_try(pg_temp.p4_define_sql(1, 'p4-s4a'), 'select ''revocation='' || pg_temp.p4_revoke_attempt()'));
  perform extensions.dblink_exec('p4_a', 'reset lock_timeout');
  perform pg_temp.p4_holder(format('update identity_private.organization_actor_grant set active = true where %s', grant_where));

  -- S4b: a revocation is in flight and commits after 2 s: the waiting define is refused FORBIDDEN, nothing written
  perform extensions.dblink_exec('p4_a', 'begin');
  perform extensions.dblink_exec('p4_a', format('update identity_private.organization_actor_grant set active = false where %s', grant_where));
  perform extensions.dblink_send_query('p4_a', 'select pg_sleep(2)::text; commit;');
  started := clock_timestamp();
  insert into p4_result values ('s4b_define', pg_temp.p4_try(pg_temp.p4_define_sql(1, 'p4-s4b'), pg_temp.p4_rows_sql('cms_template_versions', 'template_key', 'p4-s4b')));
  insert into p4_result values ('s4b_waited', (clock_timestamp() - started >= interval '1 second')::text);
  perform pg_temp.p4_drain('p4_a');

  perform pg_temp.p4_cleanup();
  perform extensions.dblink_disconnect('p4_a');
exception when others then
  raise notice 'P4 harness error % %', sqlstate, sqlerrm;
  insert into p4_result values ('harness_error', sqlstate || ':' || sqlerrm) on conflict (key) do update set value = excluded.value;
  begin perform pg_temp.p4_drain('p4_a'); exception when others then null; end;
  begin perform extensions.dblink_exec('p4_a', 'rollback'); exception when others then null; end;
  begin perform extensions.dblink_exec('p4_a', 'reset lock_timeout'); exception when others then null; end;
  begin perform pg_temp.p4_cleanup(); exception when others then null; end;
  begin perform extensions.dblink_exec('p4_a', (select body from p4_sql where key = 'triggers_on')); exception when others then null; end;
  begin perform extensions.dblink_disconnect('p4_a'); exception when others then null; end;
end;
$probe$;

-- ---------------------------------------------------------------------------------------------------------- assertions
begin;
select no_plan();

select is((select value from p4_result where key = 'harness_error'), null,
  'the committed-fixture harness ran every scenario without an error of its own [P2-S12-AC-276]');
select is((select value from p4_result where key = 'fixture_world_2_type_version'), 'active',
  'fixture: the forged content type version of world 2 is ACTIVE before the scenarios [P2-S12-AC-276]');
select is((select value from p4_result where key = 's0_define'), '00000:rows=1',
  'control: with nothing held a real CMS-03C-01 define commits one draft [P2-S12-AC-276]');
select is((select value from p4_result where key = 's0_fast'), 'true',
  'control: the uncontended define returns in under a second, so the waits below are the lock and not the harness [P2-S12-AC-276]');
select is((select value from p4_result where key = 's1_define'), 'P0001:CONFLICT',
  'CMS-03C-01 define waits on the content type version row a concurrent activation holds (position 4) and a lock timeout is the retryable CONFLICT [P2-S12-AC-276]');
select is((select value from p4_result where key = 's1_define_waited'), 'true',
  'CMS-03C-01 define spent its whole 1 s lock_timeout waiting for the held content type version row [P2-S12-AC-276]');
select is((select value from p4_result where key = 's1_taxonomy'), 'P0001:CONFLICT',
  'CMS-03C-16 taxonomy create waits on the content type version row its allowedTypeKeys name (position 4) and a lock timeout is the retryable CONFLICT [P2-S12-AC-276]');
select is((select value from p4_result where key = 's2_define'), '00000:rows=1',
  'CMS-03C-01 define that waited for a released content type version row writes exactly one draft [P2-S12-AC-276]');
select is((select value from p4_result where key = 's2_waited'), 'true',
  'CMS-03C-01 define did wait at least a second for the holder before it wrote [P2-S12-AC-276]');
select is((select value from p4_result where key = 's3_type_state'), 'superseded',
  'fixture: the holder committed the supersession of the content type version [P2-S12-AC-276]');
select is((select value from p4_result where key = 's3_define'), 'P0001:VALIDATION_FAILED',
  'CMS-03C-01 define that waited re-proves the compatibility under the lock: a type version superseded meanwhile is VALIDATION_FAILED and nothing is written [P2-S12-AC-276]');
select is((select value from p4_result where key = 's3_waited'), 'true',
  'CMS-03C-01 define waited for the superseding transaction before it decided [P2-S12-AC-276]');
select is((select value from p4_result where key = 's4a_define'), '00000:revocation=55P03',
  'CMS-03C-01 define holds the designer grant rows FOR SHARE (position 1): a concurrent revocation of the grant waits and times out [P2-S12-AC-276]');
select is((select value from p4_result where key = 's4b_define'), 'P0001:FORBIDDEN',
  'CMS-03C-01 define that waited for a committing revocation re-proves the capability under the lock: FORBIDDEN and nothing written [P2-S12-AC-276]');
select is((select value from p4_result where key = 's4b_waited'), 'true',
  'CMS-03C-01 define waited for the revoking transaction before it decided [P2-S12-AC-276]');
select is((select pg_catalog.count(*)::integer from platform_private.cms_content_types where id::text like 'a9440000-0000-4000-8000-%'), 0,
  'cleanup: no forged content type of this file remains committed [P2-S12-AC-276]');
select is((select pg_catalog.count(*)::integer from platform_private.party where id::text like 'a9440000-0000-4000-8000-%'), 0,
  'cleanup: no forged party of this file remains committed [P2-S12-AC-276]');
select is((select count(*)::integer from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private' and c.relname in ('cms_content_type_versions', 'cms_content_types', 'cms_template_versions', 'cms_taxonomy_versions')
      and not t.tgisinternal and t.tgenabled = 'D'), 0,
  'cleanup: every user trigger the fixture switched off is enabled again [P2-S12-AC-276]');

select * from finish();
rollback;
