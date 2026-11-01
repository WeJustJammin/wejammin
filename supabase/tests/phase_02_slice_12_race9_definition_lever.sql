-- Slice 12 race9: a FOREIGN DEFINITION is not a lock lever (lane claude_s12_db9a; BE03b "Initial revision default template": "A concealed/foreign definition must not become a lock
-- lever"; BE03b lock-order rule 2; DEC-245(6): a definition, content type or template; tracker P2-S12-AC-294).  A session of organization A holds FOR UPDATE the content type row,
-- every version row of the bound content type and the default template version T1 (the rows a definition command of A would lock; the key-share probes below prove the holder
-- owns the strongest mode, so ANY lock request on them would wait).  A caller of organization B then names A's definitions through the request shapes BE03a / BE03c give it:
--   L0  CMS-03B-10 `cms_create_entry` (the command of AC-294 itself) naming A's `contentTypeId` + `contentTypeVersionId` (client-supplied, BE03b 276; resolved by a plain
--       owner-scoped SELECT before the version lock, 20261005018040:106-114) and the same request naming an absent pair; B holds a labelled cms.author grant
--   L1  CMS-03A-04 `cms_activate_schema` naming A's content type, version, dry run, plan and approvals (and the same shape with absent ids)
--   L2  CMS-03C-06 `cms_submit_governed_review` naming A's default template version as a `template_version` subject (and an absent template version id)
--   L3  unit level, no forgery: `cms_lock_default_template_shared(T1, B)` (the default template cannot be NAMED by a create request: no operand, BE03b 1726; the lock helper
--       puts the owner predicate in the locking statement, 20261022010000:37-41) returns at once, while `(T1, A)` is observed blocked
-- Each command returns the uniform concealed outcome, IDENTICAL to the absent-id outcome (no existence oracle), in well under the 1 s lock_timeout, and the holder is probed
-- STILL OPEN after each call, so B took no lock on A's rows.  The positive control: A's own create of the bound content type (which needs A's version rows and A's template)
-- and A's own lock helper call are observed blocked BY the same holder.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race8/030-create-helpers.sqlinc

create or replace function pg_temp.r9_keyshare(p_table text, p_where text) returns text language sql volatile as $b$
  select pg_temp.r7_do('p', format('perform 1 from %s where %s for key share nowait', p_table, p_where)) $b$;
create or replace function pg_temp.r9_held() returns text language sql volatile as $b$
  select pg_temp.r9_keyshare('platform_private.cms_content_types', format('id = %L::uuid', pg_temp.r7_get('bound_type')))
    || '/' || pg_temp.r9_keyshare('platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version')))
    || '/' || pg_temp.r9_keyshare('platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))) $b$;
create or replace function pg_temp.r9_stores() returns text language sql stable as $b$
  select (select count(*) from platform_private.idempotency_records where operation like 'CMS-%')::text
    || '/' || (select count(*) from platform_private.cms_governed_reviews)::text
    || '/' || (select string_agg(state::text, ',' order by state::text) from platform_private.cms_content_type_versions where content_type_id = pg_temp.r7_get('bound_type')::uuid)
    || '/' || (select state::text from platform_private.cms_template_versions where id = pg_temp.r7_get('template')::uuid) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race9/030-definition-world.sqlinc
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  c text; k text; t0 timestamptz;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  for c in select unnest(array['b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;
  perform pg_temp.r7_note('stores_before', pg_temp.r9_stores());
  perform pg_temp.r7_note('free_before', pg_temp.r9_held());
  perform pg_temp.r7_note('entries_before', pg_temp.r8_bound_entries());

  perform pg_temp.r7_note('holder', pg_temp.r7_hold_raw('h', format(
    'perform 1 from platform_private.cms_content_types where id = %L::uuid for update; perform 1 from platform_private.cms_content_type_versions where content_type_id = %L::uuid order by id for update; perform 1 from platform_private.cms_template_versions where id = %L::uuid for update',
    pg_temp.r7_get('bound_type'), pg_temp.r7_get('bound_type'), pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('held_before', pg_temp.r9_held());
  foreach k in array array['b_create', 'b_create_absent', 'b_activate', 'b_activate_absent', 'b_submit', 'b_submit_absent'] loop
    t0 := clock_timestamp();
    perform pg_temp.r7_send('b', k || ':lt');
    perform pg_temp.r7_note('out_' || k, pg_temp.r7_collect('b', 15));
    perform pg_temp.r7_note('ms_' || k, (extract(epoch from clock_timestamp() - t0) * 1000)::integer::text);
    perform pg_temp.r7_note('held_after_' || k, pg_temp.r9_held());
  end loop;
  -- L3: the lock helper called directly, as B and as A
  t0 := clock_timestamp();
  perform pg_temp.r7_note('l3_b', pg_temp.r7_do('b', format('set local lock_timeout = ''1s''; perform platform_private.cms_lock_default_template_shared(%L::uuid, %L::uuid)',
    pg_temp.r7_get('template'), pg_temp.r7_get('other_org'))));
  perform pg_temp.r7_note('l3_b_ms', (extract(epoch from clock_timestamp() - t0) * 1000)::integer::text);
  perform pg_temp.r7_note('l3_held_after', pg_temp.r9_held());
  perform pg_temp.r7_note('stores_during', pg_temp.r9_stores());

  -- controls: A's own helper call and A's own create need A's rows, so they wait behind the same holder
  perform extensions.dblink_exec('b', 'set lock_timeout = ''20s''');
  perform pg_temp.r7_send_raw('b', format('select platform_private.cms_lock_default_template_shared(%L::uuid, %L::uuid)::text',
    pg_temp.r7_get('template'), pg_temp.r7_get('owner_org')));
  perform pg_temp.r7_conn('c');
  perform pg_temp.r7_send('c', 'a_create');
  perform pg_temp.r7_note('l3_control_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('control_blocked_by_h', pg_temp.r7_blocked_by('c', 'h')::text);
  perform pg_temp.r7_note('control_waits_for', coalesce(pg_temp.r7_waiting_for('c'), '-'));
  perform pg_temp.r7_note('holder_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('l3_control_out', pg_temp.r7_collect('b', 30));
  perform pg_temp.r7_note('control_out', pg_temp.r7_collect('c', 30));
  perform pg_temp.r7_note('entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('stores_after', pg_temp.r9_stores());

  perform pg_temp.r7_cleanup(array['b', 'c', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'c', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('b_create=' || left(coalesce(pg_temp.r7_get('out_b_create'), '?'), 200) || ' | absent=' || left(coalesce(pg_temp.r7_get('out_b_create_absent'), '?'), 200) || ' | ms=' || coalesce(pg_temp.r7_get('ms_b_create'), '?') || '/' || coalesce(pg_temp.r7_get('ms_b_create_absent'), '?') || '/' || coalesce(pg_temp.r7_get('ms_b_activate'), '?') || '/' || coalesce(pg_temp.r7_get('ms_b_activate_absent'), '?') || '/' || coalesce(pg_temp.r7_get('ms_b_submit'), '?') || '/' || coalesce(pg_temp.r7_get('ms_b_submit_absent'), '?') || ' l3=' || coalesce(pg_temp.r7_get('l3_b'), '?') || ' ' || coalesce(pg_temp.r7_get('l3_b_ms'), '?'));
select pg_temp.r7_diag('b_activate=' || left(coalesce(pg_temp.r7_get('out_b_activate'), '?'), 300) || ' | absent=' || left(coalesce(pg_temp.r7_get('out_b_activate_absent'), '?'), 300));
select pg_temp.r7_diag('b_submit=' || left(coalesce(pg_temp.r7_get('out_b_submit'), '?'), 300) || ' | absent=' || left(coalesce(pg_temp.r7_get('out_b_submit_absent'), '?'), 300) || ' | control=' || left(coalesce(pg_temp.r7_get('control_out'), '?'), 200) || ' | l3 control=' || coalesce(pg_temp.r7_get('l3_control_out'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran the foreign-definition scenarios without an error of its own [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('world_premises_failed'), '0/0', 'the committed world built with no failed fixture assertion and no failed premise [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('free_before') = '00000/00000/00000' and pg_temp.r7_get('bound_type_row_state') = 'active',
  'fixture: before the holder, the content type row, its bound version row and the default template row of organization A are all free [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('holder') = '00000' and pg_temp.r7_get('held_before') = '55P03/55P03/55P03',
  'fixture: a session of organization A holds the content type row, its version rows and the default template row FOR UPDATE (a FOR KEY SHARE request on each is refused) [P2-S12-AC-294]');
-- L0: the create command of AC-294 itself
select pg_temp.r7_is(pg_temp.r7_get('out_b_create'), 'P0001:NOT_FOUND',
  'a caller of organization B sending the real create (CMS-03B-10) with organization A''s contentTypeId and contentTypeVersionId is the concealed NOT_FOUND while A''s session holds those rows FOR UPDATE [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('out_b_create'), pg_temp.r7_get('out_b_create_absent'),
  'the create naming A''s existing content type and version and the create naming an absent pair answer the identical outcome, message and DETAIL: no existence oracle [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('ms_b_create')::integer < 900 and pg_temp.r7_get('ms_b_create_absent')::integer < 900
    and pg_temp.r7_get('held_after_b_create') = '55P03/55P03/55P03' and pg_temp.r7_get('held_after_b_create_absent') = '55P03/55P03/55P03',
  'the create completed in under 0.9 s, inside its 1 s lock_timeout, and A''s holder still owned the content type row, its versions and the template AFTER the call (probed): B requested no lock on them [P2-S12-AC-294]');
-- L1 / L2
select pg_temp.r7_is(pg_temp.r7_get('out_b_activate'), 'P0001:NOT_FOUND',
  'a caller of organization B naming organization A''s content type and version in a schema activation is the concealed NOT_FOUND [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('out_b_activate'), pg_temp.r7_get('out_b_activate_absent'),
  'the activation naming A''s existing definition and the activation naming absent ids answer the identical outcome: no existence oracle [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('out_b_submit') like 'P0001:NOT_FOUND%' and pg_temp.r7_get('out_b_submit') = pg_temp.r7_get('out_b_submit_absent'),
  'a caller of organization B submitting A''s default template version is the concealed NOT_FOUND, identical to the outcome for an absent template version id [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('ms_b_activate')::integer < 900 and pg_temp.r7_get('ms_b_activate_absent')::integer < 900
    and pg_temp.r7_get('ms_b_submit')::integer < 900 and pg_temp.r7_get('ms_b_submit_absent')::integer < 900
    and pg_temp.r7_get('held_after_b_activate') = '55P03/55P03/55P03' and pg_temp.r7_get('held_after_b_activate_absent') = '55P03/55P03/55P03'
    and pg_temp.r7_get('held_after_b_submit') = '55P03/55P03/55P03' and pg_temp.r7_get('held_after_b_submit_absent') = '55P03/55P03/55P03',
  'each of the activation and submit calls completed in under 0.9 s, inside its 1 s lock_timeout, and A''s holder still owned the definition rows AFTER each call (probed): B requested no lock on A''s rows [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('stores_during'), pg_temp.r7_get('stores_before'), 'the refused calls changed nothing: no idempotency record, no review, the version and template states are unchanged [P2-S12-AC-294]');
-- L3
select pg_temp.r7_ok(pg_temp.r7_get('l3_b') = '00000' and pg_temp.r7_get('l3_b_ms')::integer < 900 and pg_temp.r7_get('l3_held_after') = '55P03/55P03/55P03',
  'the default template lock helper called for organization B returns at once (under 0.9 s inside a 1 s lock_timeout) while A''s holder owns template T1 FOR UPDATE and still does afterwards: the owner predicate sits in the locking statement [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('l3_control_blocked_by_h'), 'true',
  'control: the same helper called for the owner of T1 is observed blocked BY the holder of T1 (pg_blocking_pids) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('control_blocked_by_h'), 'true',
  'control: organization A''s own create of the bound content type is observed blocked BY the same holder (the probe sees a wait on these rows when one is requested) [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('l3_control_out') = 'ok:' and pg_temp.r7_get('control_out') like 'ok:%' and pg_temp.r7_get('entries_after') = '1' and pg_temp.r7_get('entries_before') = '0',
  'control: once the holder releases, A''s lock helper call returns and A''s create completes and stores its entry [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-294]');
select * from pg_temp.r7_finish();
