-- BE03c "Slice 12 lock order" position 6 under real concurrency (P2-S12-AC-276, AC-277 (3) "term merge versus a concurrent assignment"):
-- two or three independent sessions (dblink workers, the precedent of phase_02_slice_09_schema/000b-activation-lock.sqlinc) against COMMITTED
-- forged fixtures that this file removes again.  The writer side is the real position-6 helper (cms_lock_term_plan) and the real assignment
-- insert (cms_record_term_assignments); the merge side is exactly what cms_act_taxonomy_term does after authority is proven: the named term
-- rows FOR UPDATE in ascending id order (20261014120500:106-117), then cms_term_apply_merge with its in-transaction convergence.
--
--   0 control   a writer that only READS the term does not block the merge (so the wait in 1 is the share lock, not the harness);
--   1 (i)       a merge waits for a writer holding the FOR SHARE lock, then converges the writer's committed row (the term's assignment
--               is superseded and the survivor's is active; one committed command each, no deadlock);
--   2 (ii)      a writer arriving after the merge committed is refused term_unavailable; a restore planned before the merge and locked after
--               it is the retryable CONFLICT;
--   3 (iii)     a writer that CARRIES a term whose merge is in flight waits for the merge, then resolves deterministically to the survivor.
-- Fixture forgeries (labelled): the party, person, type, version, artifact, field definition, vocabulary version, terms, entry, revisions and two
-- assignments are inserted directly because no command builds a committed world inside a pgTAP file; everything is deleted in the cleanup block.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;

-- The probe runs in autocommit, BEFORE the pgTAP transaction, as the precedent does: this session then holds no table lock that could
-- delay the DDL of the setup and cleanup blocks of the worker sessions (a held ACCESS SHARE lock does not conflict with them, but a
-- failed earlier attempt of this file did time out on a lock); the temp objects live for the session.
create temp table cc_result(key text primary key, value text) ;
create temp table cc_pids(conn text primary key, pid integer) ;

-- ------------------------------------------------------------------------------------------------ helpers (this session)
create or replace function pg_temp.cc_drain(p_conn text) returns text language plpgsql as $body$
declare outcome text := 'ok'; n integer; v text;
begin
  for i in 1 .. 600 loop
    exit when extensions.dblink_is_busy(p_conn) = 0;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  if extensions.dblink_is_busy(p_conn) = 1 then return 'TIMEOUT'; end if;
  begin
    for i in 1 .. 4 loop
      select pg_catalog.count(*), pg_catalog.max(result.x) into n, v from extensions.dblink_get_result(p_conn, true) as result(x text);
      exit when n = 0;
      outcome := 'ok:' || coalesce(v, '');
    end loop;
  exception when others then
    outcome := sqlstate || ':' || sqlerrm;
    begin
      for i in 1 .. 4 loop
        perform pg_catalog.count(*) from extensions.dblink_get_result(p_conn, false) as result(x text);
      end loop;
    exception when others then null;
    end;
  end;
  return outcome;
end;
$body$;
-- a synchronous statement on a worker: 'ok:<first value>' or '<sqlstate>:<message>'
create or replace function pg_temp.cc_run(p_conn text, p_sql text) returns text language plpgsql as $body$
declare v text;
begin
  select result.x into v from extensions.dblink(p_conn, p_sql) as result(x text) limit 1;
  return 'ok:' || coalesce(v, '');
exception when others then
  return sqlstate || ':' || sqlerrm;
end;
$body$;
-- true when the worker's backend waits on a lock (polled up to 3 s)
create or replace function pg_temp.cc_waiting(p_conn text) returns boolean language plpgsql as $body$
begin
  for i in 1 .. 60 loop
    if exists (select 1 from pg_catalog.pg_stat_activity activity
                where activity.pid = (select pid from cc_pids where conn = p_conn) and activity.wait_event_type = 'Lock') then
      return true;
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  return false;
end;
$body$;

-- ------------------------------------------------------------------------------------------------ fixture SQL (fixed ids)
create temp table cc_sql(key text primary key, body text not null) ;
insert into cc_sql values ('cleanup', $cleanup$
do $body$
begin
  alter table platform_private.cms_term_assignments disable trigger user;
  alter table platform_private.cms_terms disable trigger user;
  alter table platform_private.cms_taxonomy_versions disable trigger user;
  alter table platform_private.cms_entry_revisions disable trigger user;
  alter table platform_private.cms_content_entries disable trigger user;
  alter table platform_private.cms_field_definition_versions disable trigger user;
  alter table platform_private.cms_content_type_versions disable trigger cms_content_type_versions_no_delete;
  alter table platform_private.cms_content_types disable trigger cms_content_types_no_delete;
  drop trigger if exists cms_schema_artifacts_z_compile_guard on platform_private.cms_schema_artifacts;
  delete from platform_private.cms_term_assignments where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_terms where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_taxonomy_versions where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_entry_revisions where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_content_entries where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_field_definition_versions where owner_id = 'a9300000-0000-4000-8000-00000000c003';
  delete from platform_private.cms_schema_artifacts where id = 'a9300000-0000-4000-8000-00000000c006';
  delete from platform_private.cms_content_type_versions where id = 'a9300000-0000-4000-8000-00000000c005';
  delete from platform_private.cms_content_types where id = 'a9300000-0000-4000-8000-00000000c004';
  delete from platform_private.person_party where party_id = 'a9300000-0000-4000-8000-00000000c002';
  delete from platform_private.party where id in ('a9300000-0000-4000-8000-00000000c002', 'a9300000-0000-4000-8000-00000000c003');
  delete from auth.users where id = 'a9300000-0000-4000-8000-00000000c001';
  create trigger cms_schema_artifacts_z_compile_guard before update or delete on platform_private.cms_schema_artifacts
    for each row execute function platform_private.cms_schema_artifact_guard();
  alter table platform_private.cms_content_type_versions enable trigger cms_content_type_versions_no_delete;
  alter table platform_private.cms_content_types enable trigger cms_content_types_no_delete;
  alter table platform_private.cms_term_assignments enable trigger user;
  alter table platform_private.cms_terms enable trigger user;
  alter table platform_private.cms_taxonomy_versions enable trigger user;
  alter table platform_private.cms_entry_revisions enable trigger user;
  alter table platform_private.cms_content_entries enable trigger user;
  alter table platform_private.cms_field_definition_versions enable trigger user;
end;
$body$;
$cleanup$);
insert into cc_sql values ('setup', $setup$
do $body$
begin
  alter table platform_private.cms_term_assignments disable trigger user;
  alter table platform_private.cms_terms disable trigger user;
  alter table platform_private.cms_taxonomy_versions disable trigger user;
  alter table platform_private.cms_entry_revisions disable trigger user;
  alter table platform_private.cms_content_entries disable trigger user;
  alter table platform_private.cms_field_definition_versions disable trigger user;
  insert into auth.users(id, is_sso_user, is_anonymous) values ('a9300000-0000-4000-8000-00000000c001', false, false);
  insert into platform_private.party(id, kind) values
    ('a9300000-0000-4000-8000-00000000c002', 'person'), ('a9300000-0000-4000-8000-00000000c003', 'organization');
  insert into platform_private.person_party(party_id, auth_user_id, account_state)
  values ('a9300000-0000-4000-8000-00000000c002', 'a9300000-0000-4000-8000-00000000c001', 'active');
  insert into platform_private.cms_content_types(id, owner_id, state, version, type_key, owner_capability, built_in, created_by)
  values ('a9300000-0000-4000-8000-00000000c004', 'a9300000-0000-4000-8000-00000000c003', 'retired', 1, 's12_cc_probe',
          'cms.schema_designer', false, 'a9300000-0000-4000-8000-00000000c001');
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, version, content_type_id, version_no, labels, workflow_key, workflow_version, source_locale, default_locale,
    supported_locales, fallback_chains, locale_config_hash, schema_artifact_id, definition_hash, compatibility, created_by)
  values ('a9300000-0000-4000-8000-00000000c005', 'a9300000-0000-4000-8000-00000000c003', 'review', 1,
    'a9300000-0000-4000-8000-00000000c004', 1, '{}'::jsonb, 'editorial', 1, 'en-US', 'en-US', '["en-US"]'::jsonb, '{}'::jsonb,
    '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860', 'a9300000-0000-4000-8000-00000000c006', repeat('e', 64),
    'additive', 'a9300000-0000-4000-8000-00000000c001');
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, state, version, content_type_version_id, compiler_version, zod_contract_ref, editor_manifest, renderer_manifest,
    artifact_hash, compiled_at)
  values ('a9300000-0000-4000-8000-00000000c006', 'a9300000-0000-4000-8000-00000000c003', 'compiled', 1,
    'a9300000-0000-4000-8000-00000000c005', '1', 'cms/content-type/s12_cc_probe/v1', '{}'::jsonb, '{}'::jsonb, repeat('e', 64), clock_timestamp());
  insert into platform_private.cms_field_definition_versions(owner_id, content_type_version_id, stable_field_id, field_key, kind, created_by)
  values ('a9300000-0000-4000-8000-00000000c003', 'a9300000-0000-4000-8000-00000000c005', 'a9300000-0000-4000-8000-00000000c008',
          'cc_tags', 'taxonomy', 'a9300000-0000-4000-8000-00000000c001');
  insert into platform_private.cms_taxonomy_versions(id, owner_id, state, version, taxonomy_key, owner_capability, shape,
    allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by, taxonomy_id)
  values ('a9300000-0000-4000-8000-00000000c010', 'a9300000-0000-4000-8000-00000000c003', 'active', 1, 'cc-tax', 'cms.taxonomy_curator', 'flat',
    '["s12_cc_probe"]'::jsonb, '["cc_tags"]'::jsonb, repeat('a', 64), 'a9300000-0000-4000-8000-00000000c001',
    'a9300000-0000-4000-8000-00000000c010');
  insert into platform_private.cms_terms(id, owner_id, lifecycle, version, taxonomy_version_id, term_key, created_by, taxonomy_id)
  select ('a9300000-0000-4000-8000-00000000c0' || n)::uuid, 'a9300000-0000-4000-8000-00000000c003', 'active', 1,
         'a9300000-0000-4000-8000-00000000c010', 'cc-' || key, 'a9300000-0000-4000-8000-00000000c001', 'a9300000-0000-4000-8000-00000000c010'
    from (values ('21', 't'), ('22', 's'), ('23', 'u1'), ('24', 's2'), ('25', 'u2'), ('26', 's3'), ('27', 't0'), ('28', 's0')) v(n, key);
  insert into platform_private.cms_content_entries(id, owner_id, content_type_id, owner_party_id, lifecycle, current_draft_revision_id, version, created_by)
  values ('a9300000-0000-4000-8000-00000000c030', 'a9300000-0000-4000-8000-00000000c003', 'a9300000-0000-4000-8000-00000000c004',
          'a9300000-0000-4000-8000-00000000c003', 'active', null, 1, 'a9300000-0000-4000-8000-00000000c001');
  insert into platform_private.cms_entry_revisions(id, owner_id, entry_id, revision_number, schema_version_id, template_version_id,
    taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version, validation_state, validation_report)
  select ('a9300000-0000-4000-8000-00000000c0' || n)::uuid, 'a9300000-0000-4000-8000-00000000c003', 'a9300000-0000-4000-8000-00000000c030',
         rev, 'a9300000-0000-4000-8000-00000000c005', null, '[]'::jsonb, '[]'::jsonb, 'en-US', repeat('b', 64),
         'a9300000-0000-4000-8000-00000000c002', 'a9300000-0000-4000-8000-00000000c003', 'draft', 1, 'valid', '{}'::jsonb
    from (values ('31', 1), ('32', 2), ('33', 3), ('34', 4), ('35', 5), ('36', 6)) v(n, rev);
  insert into platform_private.cms_term_assignments(owner_id, state, version, revision_id, field_definition_id, term_id, taxonomy_version_id,
    position, provenance, created_by)
  select 'a9300000-0000-4000-8000-00000000c003', 'active', 1, v.revision_id::uuid, field.id, v.term_id::uuid,
         'a9300000-0000-4000-8000-00000000c010', 0, 'authored', 'a9300000-0000-4000-8000-00000000c001'
    from (values ('a9300000-0000-4000-8000-00000000c032', 'a9300000-0000-4000-8000-00000000c023'),
                 ('a9300000-0000-4000-8000-00000000c033', 'a9300000-0000-4000-8000-00000000c025')) v(revision_id, term_id)
    cross join platform_private.cms_field_definition_versions field
   where field.stable_field_id = 'a9300000-0000-4000-8000-00000000c008';
  alter table platform_private.cms_term_assignments enable trigger user;
  alter table platform_private.cms_terms enable trigger user;
  alter table platform_private.cms_taxonomy_versions enable trigger user;
  alter table platform_private.cms_entry_revisions enable trigger user;
  alter table platform_private.cms_content_entries enable trigger user;
  alter table platform_private.cms_field_definition_versions enable trigger user;
end;
$body$;
$setup$);
-- the merger, a session-local function of its worker: what cms_act_taxonomy_term does after authority (lock the named rows, then apply the merge)
insert into cc_sql values ('merger', $merger$
create function pg_temp.cc_merge(p_key text, p_survivor uuid) returns text language plpgsql as $f$
declare locked uuid;
begin
  for locked in
    select term.id from platform_private.cms_terms term
     where term.taxonomy_id = 'a9300000-0000-4000-8000-00000000c010' and term.owner_id = 'a9300000-0000-4000-8000-00000000c003'
       and (term.term_key = p_key or term.id = p_survivor)
     order by term.id for update
  loop null; end loop;
  perform platform_private.cms_term_apply_merge('a9300000-0000-4000-8000-00000000c001'::uuid, 'a9300000-0000-4000-8000-00000000c003'::uuid,
    'a9300000-0000-4000-8000-00000000c010'::uuid, jsonb_build_object('termKey', p_key, 'survivorId', p_survivor::text), pg_catalog.gen_random_uuid());
  return 'merged';
end
$f$;
$merger$);

-- request pieces
create or replace function pg_temp.cc_values(p_term text) returns text language sql as $body$
  select format('jsonb_build_object(%L, jsonb_build_object(''termIds'', jsonb_build_array(%L)))', 'a9300000-0000-4000-8000-00000000c008', p_term) $body$;
create or replace function pg_temp.cc_lock_sql(p_source text, p_values text, p_changed text) returns text language sql as $body$
  select format('select platform_private.cms_lock_term_plan(%L::uuid, %L::uuid, %s, %s, %s)::text',
    'a9300000-0000-4000-8000-00000000c003', 'a9300000-0000-4000-8000-00000000c005', p_source, p_values, p_changed) $body$;
create or replace function pg_temp.cc_record_sql(p_revision text, p_source text, p_values text, p_changed text) returns text language sql as $body$
  select format('select platform_private.cms_record_term_assignments(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %s, %s, %s)::text',
    p_revision, 'a9300000-0000-4000-8000-00000000c003', 'a9300000-0000-4000-8000-00000000c001', 'a9300000-0000-4000-8000-00000000c005',
    p_source, p_values, p_changed) $body$;
create or replace function pg_temp.cc_state(p_term uuid) returns text language sql stable as $body$
  select lifecycle || coalesce('>' || successor_id::text, '') from platform_private.cms_terms where id = p_term $body$;
create or replace function pg_temp.cc_rows(p_revision text) returns text language sql stable as $body$
  select coalesce(string_agg(term.term_key || ':' || assignment.state || ':' || assignment.version, '|' order by term.term_key, assignment.version), '')
    from platform_private.cms_term_assignments assignment join platform_private.cms_terms term on term.id = assignment.term_id
   where assignment.revision_id = p_revision::uuid $body$;

-- baseline row counts (the leak check)
create temp table cc_base as
select (select count(*) from platform_private.cms_terms) as terms, (select count(*) from platform_private.cms_term_assignments) as assignments,
       (select count(*) from platform_private.cms_entry_revisions) as revisions, (select count(*) from platform_private.party) as parties,
       (select count(*) from auth.users) as users, (select count(*) from platform_private.cms_content_types) as types;

-- ------------------------------------------------------------------------------------------------ the sessions
set local statement_timeout = 0;
do $probe$
declare
  conn_string constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  t constant text := 'a9300000-0000-4000-8000-00000000c021'; s constant text := 'a9300000-0000-4000-8000-00000000c022';
  u1 constant text := 'a9300000-0000-4000-8000-00000000c023'; s2 constant text := 'a9300000-0000-4000-8000-00000000c024';
  u2 constant text := 'a9300000-0000-4000-8000-00000000c025'; s3 constant text := 'a9300000-0000-4000-8000-00000000c026';
  t0 constant text := 'a9300000-0000-4000-8000-00000000c027'; s0 constant text := 'a9300000-0000-4000-8000-00000000c028';
  r1 constant text := 'a9300000-0000-4000-8000-00000000c031'; rs2 constant text := 'a9300000-0000-4000-8000-00000000c032';
  rs3 constant text := 'a9300000-0000-4000-8000-00000000c033'; r3 constant text := 'a9300000-0000-4000-8000-00000000c034';
  r0 constant text := 'a9300000-0000-4000-8000-00000000c035';
  fid constant text := 'a9300000-0000-4000-8000-00000000c008';
  changed constant text := format('array[%L]::text[]', fid);
  none_changed constant text := 'array[]::text[]';
  waited boolean;
  outcome text;
  conn text;
begin
  foreach conn in array array['cc_s', 'cc_a', 'cc_b', 'cc_c'] loop
    begin perform extensions.dblink_disconnect(conn); exception when others then null; end;
    perform extensions.dblink_connect(conn, conn_string);
    perform extensions.dblink_exec(conn, 'set app.cms_rpc = ''true''');
    perform extensions.dblink_exec(conn, 'set statement_timeout = ''15s''');
    perform extensions.dblink_exec(conn, 'set lock_timeout = ''10s''');
    insert into cc_pids select conn, pid from extensions.dblink(conn, 'select pg_backend_pid()') as result(pid integer);
  end loop;
  raise notice 'CC step cleanup0';
  perform extensions.dblink_exec('cc_s', (select body from cc_sql where key = 'cleanup'));
  raise notice 'CC step setup';
  perform extensions.dblink_exec('cc_s', (select body from cc_sql where key = 'setup'));
  raise notice 'CC step setup done';
  perform extensions.dblink_exec('cc_b', (select body from cc_sql where key = 'merger'));
  insert into cc_result values ('fixture_terms', (select value from extensions.dblink('cc_s',
    'select count(*)::text from platform_private.cms_terms where owner_id = ''a9300000-0000-4000-8000-00000000c003''') as result(value text)));

  raise notice 'CC step %', '';
  -- ---- 0 control: a writer that only READS the term (no lock) does not hold the merge up ---------------------------------------
  perform extensions.dblink_exec('cc_a', 'begin');
  perform pg_temp.cc_run('cc_a', format('select lifecycle from platform_private.cms_terms where id = %L', t0));
  perform extensions.dblink_exec('cc_b', 'begin');
  insert into cc_result values ('control_merge', pg_temp.cc_run('cc_b', format('select pg_temp.cc_merge(%L, %L::uuid)', 'cc-t0', s0)));
  perform extensions.dblink_exec('cc_b', 'commit');
  perform extensions.dblink_exec('cc_a', 'commit');

  raise notice 'CC step %', '';
  -- ---- 1 (i) a merge waits for a writer holding the position-6 share lock, then converges the writer's committed row ----------
  perform extensions.dblink_exec('cc_a', 'begin');
  insert into cc_result values ('w1_lock', pg_temp.cc_run('cc_a', pg_temp.cc_lock_sql('null::uuid', pg_temp.cc_values(t), changed)));
  perform extensions.dblink_exec('cc_b', 'begin');
  perform extensions.dblink_send_query('cc_b', format('select pg_temp.cc_merge(%L, %L::uuid)', 'cc-t', s));
  waited := pg_temp.cc_waiting('cc_b');
  insert into cc_result values ('m1_waits', waited::text);
  insert into cc_result values ('m1_still_busy', (extensions.dblink_is_busy('cc_b') = 1)::text);
  -- only now does the writer append its row, while the merge is still held up by the lock alone (the row's own foreign-key share lock comes too late to matter)
  insert into cc_result values ('w1_record', pg_temp.cc_run('cc_a', pg_temp.cc_record_sql(r1, 'null::uuid', pg_temp.cc_values(t), changed)));
  perform extensions.dblink_exec('cc_a', 'commit');
  outcome := pg_temp.cc_drain('cc_b');
  insert into cc_result values ('m1_done', outcome);
  perform extensions.dblink_exec('cc_b', 'commit');

  raise notice 'CC step %', '';
  -- ---- 2 (ii) a writer arriving after the merge committed -----------------------------------------------------------------------
  perform extensions.dblink_exec('cc_c', 'begin');
  insert into cc_result values ('late_writer', pg_temp.cc_run('cc_c', pg_temp.cc_lock_sql('null::uuid', pg_temp.cc_values(t), changed)));
  perform extensions.dblink_exec('cc_c', 'rollback');
  perform extensions.dblink_exec('cc_c', 'begin');
  perform extensions.dblink_exec('cc_c', format($p$create temp table cc_plan on commit drop as select platform_private.cms_restore_term_plan(
    'a9300000-0000-4000-8000-00000000c003'::uuid, %L::uuid, 'a9300000-0000-4000-8000-00000000c005'::uuid, '{}'::jsonb) as plan$p$, rs2));
  insert into cc_result values ('plan_rows', pg_temp.cc_run('cc_c', 'select jsonb_array_length(plan->''rows'')::text from cc_plan'));
  perform extensions.dblink_exec('cc_b', 'begin');
  insert into cc_result values ('merge_between', pg_temp.cc_run('cc_b', format('select pg_temp.cc_merge(%L, %L::uuid)', 'cc-u1', s2)));
  perform extensions.dblink_exec('cc_b', 'commit');
  insert into cc_result values ('stale_restore', pg_temp.cc_run('cc_c', format(
    'select platform_private.cms_restore_lock_term_plan(%L::uuid, %L::uuid, %L::uuid, ''{}''::jsonb, (select plan from cc_plan))::text',
    'a9300000-0000-4000-8000-00000000c003', rs2, 'a9300000-0000-4000-8000-00000000c005')));
  perform extensions.dblink_exec('cc_c', 'rollback');

  raise notice 'CC step %', '';
  -- ---- 3 (iii) a writer carrying a term whose merge is in flight waits, then resolves to the survivor --------------------------
  perform extensions.dblink_exec('cc_b', 'begin');
  insert into cc_result values ('inflight_merge', pg_temp.cc_run('cc_b', format('select pg_temp.cc_merge(%L, %L::uuid)', 'cc-u2', s3)));
  perform extensions.dblink_exec('cc_a', 'begin');
  perform extensions.dblink_send_query('cc_a', pg_temp.cc_lock_sql(format('%L::uuid', rs3), '''{}''::jsonb', none_changed));
  waited := pg_temp.cc_waiting('cc_a');
  insert into cc_result values ('w3_waits', waited::text);
  perform extensions.dblink_exec('cc_b', 'commit');
  outcome := pg_temp.cc_drain('cc_a');
  insert into cc_result values ('w3_lock', outcome);
  insert into cc_result values ('w3_record', pg_temp.cc_run('cc_a', pg_temp.cc_record_sql(r3, format('%L::uuid', rs3), '''{}''::jsonb', none_changed)));
  perform extensions.dblink_exec('cc_a', 'commit');

  insert into cc_result values ('states', (select string_agg(pg_temp.cc_state(id), ',' order by id)
    from unnest(array[t, s, u1, s2, u2, s3, t0, s0]::uuid[]) id));
  insert into cc_result values ('rows_r1', pg_temp.cc_rows(r1));
  insert into cc_result values ('rows_rs2', pg_temp.cc_rows(rs2));
  insert into cc_result values ('rows_rs3', pg_temp.cc_rows(rs3));
  insert into cc_result values ('rows_r3', pg_temp.cc_rows(r3));

  raise notice 'CC step cleanup';
  perform extensions.dblink_exec('cc_s', (select body from cc_sql where key = 'cleanup'));
  foreach conn in array array['cc_s', 'cc_a', 'cc_b', 'cc_c'] loop
    perform extensions.dblink_disconnect(conn);
  end loop;
exception when others then
  insert into cc_result values ('probe_error', sqlstate || ':' || sqlerrm) on conflict (key) do nothing;
  foreach conn in array array['cc_a', 'cc_b', 'cc_c'] loop
    begin
      if extensions.dblink_is_busy(conn) = 1 then perform extensions.dblink_cancel_query(conn); end if;
    exception when others then null; end;
    begin perform pg_temp.cc_drain(conn); exception when others then null; end;
    begin perform extensions.dblink_exec(conn, 'rollback'); exception when others then null; end;
  end loop;
  begin perform extensions.dblink_exec('cc_s', (select body from cc_sql where key = 'cleanup')); exception when others then null; end;
  foreach conn in array array['cc_s', 'cc_a', 'cc_b', 'cc_c'] loop
    begin perform extensions.dblink_disconnect(conn); exception when others then null; end;
  end loop;
end;
$probe$;

-- ------------------------------------------------------------------------------------------------ assertions
begin;
select no_plan();
select is((select value from cc_result where key = 'probe_error'), null, 'the dblink probe ran to the end without a harness error');
select is((select value from cc_result where key = 'fixture_terms'), '8', 'fixture: the committed forged vocabulary holds eight terms');
select is((select value from cc_result where key = 'control_merge'), 'ok:merged',
  'control: a session that only READS the term holds no lock, so a concurrent merge completes at once [P2-S12-AC-277]');
select is((select value from cc_result where key = 'w1_lock') || '/' || (select value from cc_result where key = 'w1_record'), 'ok:/ok:1',
  '(i) the writer takes the position-6 FOR SHARE lock, and appends its one assignment row only after the merge is seen waiting [P2-S12-AC-276]');
select is((select value from cc_result where key = 'm1_waits') || '/' || (select value from cc_result where key = 'm1_still_busy'), 'true/true',
  '(i) the merge, started while the writer holds the share lock, waits on the lock (pg_stat_activity wait_event_type Lock) and has not finished [P2-S12-AC-276]');
select is((select value from cc_result where key = 'm1_done'), 'ok:merged',
  '(i) after the writer commits the merge completes: one committed command each, no deadlock, no timeout [P2-S12-AC-277]');
select is((select value from cc_result where key = 'rows_r1'), 'cc-s:active:1|cc-t:active:1|cc-t:superseded:2',
  '(i) the merge converged the writer''s committed row: the retired term''s assignment is superseded (version 2) and the survivor''s is active [P2-S12-AC-277]');
select is((select value from cc_result where key = 'late_writer'), 'P0001:term_unavailable',
  '(ii) a writer arriving after the merge committed is refused term_unavailable under its own lock [P2-S12-AC-277]');
select is((select value from cc_result where key = 'plan_rows'), 'ok:1', '(ii) the restore plan computed before the merge carries the one assignment');
select is((select value from cc_result where key = 'merge_between'), 'ok:merged', '(ii) the merge commits between the plan and the lock');
select is((select value from cc_result where key = 'stale_restore'), 'P0001:CONFLICT',
  '(ii) the restore planned before the merge and locked after it is the retryable CONFLICT [P2-S12-AC-277]');
select is((select value from cc_result where key = 'inflight_merge'), 'ok:merged', '(iii) the merge is applied and still uncommitted (it holds the term rows FOR UPDATE)');
select is((select value from cc_result where key = 'w3_waits'), 'true',
  '(iii) a writer carrying the term whose merge is in flight waits on the lock [P2-S12-AC-276]');
select is((select value from cc_result where key = 'w3_lock') || '/' || (select value from cc_result where key = 'w3_record'), 'ok:/ok:1',
  '(iii) when the merge commits the writer''s lock completes and its record statement writes the one row: no deadlock [P2-S12-AC-277]');
select is((select value from cc_result where key = 'rows_r3'), 'cc-s3:active:1',
  '(iii) the writer''s new revision carries the SURVIVOR, never the merged term: a deterministic result [P2-S12-AC-277]');
select is((select value from cc_result where key = 'rows_rs3'), 'cc-s3:active:1|cc-u2:active:1|cc-u2:superseded:2',
  '(iii) the source revision was converged by the merge in the same way [P2-S12-AC-277]');
select is((select value from cc_result where key = 'states'),
  'merged>a9300000-0000-4000-8000-00000000c022,active,merged>a9300000-0000-4000-8000-00000000c024,active,merged>a9300000-0000-4000-8000-00000000c026,active,merged>a9300000-0000-4000-8000-00000000c028,active',
  'every retired term ended merged into its own survivor and every survivor stayed active: one committed result per scenario [P2-S12-AC-277]');
select is(
  (select (select count(*) from platform_private.cms_terms) = terms and (select count(*) from platform_private.cms_term_assignments) = assignments
      and (select count(*) from platform_private.cms_entry_revisions) = revisions and (select count(*) from platform_private.party) = parties
      and (select count(*) from auth.users) = users and (select count(*) from platform_private.cms_content_types) = types
     from cc_base),
  true, 'the committed fixture is gone: every counted table is back to its baseline');

select * from finish();
rollback;
