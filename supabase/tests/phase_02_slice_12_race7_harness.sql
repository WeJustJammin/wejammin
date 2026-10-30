-- Slice 12 race7 harness self-test (lane claude_s12_race7).  Proves the pieces every race7 file relies on, against a REAL committed world
-- (the DEC-108 actors: auth users, persons, the owner organization and its grants, built by the real producers and committed):
--   * a held raw transaction blocks a sent statement, the harness observes it through pg_blocking_pids and the lock type it waits for;
--   * a row lock held by a session is visible to a third (probe) session as 55P03 under FOR UPDATE NOWAIT;
--   * a sent statement is collected with its exact outcome after the holder commits, and an error keeps its SQLSTATE, message and DETAIL;
--   * a stashed command runs through the remote r7_cmd under the real service_role with the verified actor settings;
--   * the snapshot / restore pair removes every row the committed world added and changes no pre-existing row.
-- Files: phase_02_slice_12_race7/000-harness.sqlinc (the harness), README.md beside it.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
select pg_temp.r7_note('owner_auth', (select auth_user_id::text from s09d_actor where key = 'owner'));
select pg_temp.r7_note('owner_person', (select person_id::text from s09d_actor where key = 'owner'));
select pg_temp.r7_stash_cmd('echo', 'owner', 'pg_catalog.to_jsonb', jsonb_build_object('probe', 'race7'), '{"ctx": true}'::jsonb);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare owner_row text; held text; sent_probe text;
begin
  perform pg_temp.r7_note('rolsuper', (select rolsuper::text from pg_roles where rolname = current_user));
  perform pg_temp.r7_note('rolbypassrls', (select rolbypassrls::text from pg_roles where rolname = current_user));
  perform pg_temp.r7_note('added_after_world', pg_temp.r7_added_total()::text);
  perform pg_temp.r7_conn('h'); perform pg_temp.r7_conn('b'); perform pg_temp.r7_conn('p');
  owner_row := pg_temp.r7_get('owner_auth');

  -- H takes the row, B asks for it
  held := pg_temp.r7_hold_raw('h', format('perform 1 from auth.users where id = %L::uuid for update', owner_row));
  perform pg_temp.r7_note('h_hold', held);
  perform pg_temp.r7_send_raw('b', format('select id::text from auth.users where id = %L::uuid for update', owner_row));
  perform pg_temp.r7_note('b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('b_waits_for', pg_temp.r7_waiting_for('b'));
  perform pg_temp.r7_note('probe_while_held', pg_temp.r7_row_locked('p', 'auth.users', format('id = %L::uuid', owner_row)));
  perform pg_temp.r7_note('h_commit', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('b_outcome', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('probe_after_release', pg_temp.r7_row_locked('p', 'auth.users', format('id = %L::uuid', owner_row)));
  perform pg_temp.r7_note('b_free', pg_temp.r7_not_blocked('b')::text);

  -- an error keeps its identity
  perform pg_temp.r7_send_raw('b', 'select (1/0)::text');
  perform pg_temp.r7_note('b_error', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('b_after_error', pg_temp.r7_sql('b', 'select ''alive'''));

  -- a stashed command through the remote function
  perform pg_temp.r7_note('echo', pg_temp.r7_sql('b', pg_temp.r7_call_sql('echo')));
  perform pg_temp.r7_stash_copy('echo2', 'echo', '{"lock_timeout": "1s"}'::jsonb);
  perform pg_temp.r7_note('echo2_setting', (select (body::jsonb->'settings'->>'lock_timeout') from r7_stash where key = 'echo2'));

  perform pg_temp.r7_cleanup(array['h', 'b', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['h', 'b', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('rolsuper=' || coalesce(pg_temp.r7_get('rolsuper'), '?') || ' rolbypassrls=' || coalesce(pg_temp.r7_get('rolbypassrls'), '?')
  || ' snapshot_rows=' || coalesce(pg_temp.r7_get('snapshot_rows'), '?') || ' restore=' || coalesce(pg_temp.r7_get('restore'), '?')
  || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the race7 harness ran every scenario without an error of its own');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed DEC-108 world built with no failed fixture assertion');
select pg_temp.r7_ok(pg_temp.r7_get('added_after_world')::bigint > 0, 'the committed world added rows that the restore has to remove');
select pg_temp.r7_is(pg_temp.r7_get('h_hold'), '00000', 'a raw holder transaction takes a row lock and stays open');
select pg_temp.r7_is(pg_temp.r7_get('b_blocked_by_h'), 'true', 'a sent statement is observed blocked BY the holder in the live lock manager');
select pg_temp.r7_ok(pg_temp.r7_get('b_waits_for') in ('transactionid', 'tuple'), 'the blocked session waits for a row-lock owner (transactionid or tuple), not for a sleep');
select pg_temp.r7_is(pg_temp.r7_get('probe_while_held'), '55P03', 'a probe session sees the held row as locked (FOR UPDATE NOWAIT is refused 55P03)');
select pg_temp.r7_is(pg_temp.r7_get('h_commit'), '00000', 'the holder commits');
select pg_temp.r7_is(pg_temp.r7_get('b_outcome'), 'ok:' || pg_temp.r7_get('owner_auth'), 'the blocked statement completes with its own result once the holder commits');
select pg_temp.r7_is(pg_temp.r7_get('probe_after_release'), '00000', 'after the release the probe session finds the row free');
select pg_temp.r7_is(pg_temp.r7_get('b_free'), 'true', 'the contender waits for nobody afterwards');
select pg_temp.r7_ok(pg_temp.r7_get('b_error') like '22012:division by zero%', 'an error keeps its SQLSTATE and message through the collect');
select pg_temp.r7_is(pg_temp.r7_get('b_after_error'), 'ok:alive', 'the connection is reusable after an error');
select pg_temp.r7_ok(substr(pg_temp.r7_get('echo'), 4)::jsonb->>'probe' = 'race7' and (substr(pg_temp.r7_get('echo'), 4)::jsonb->'context'->>'ctx')::boolean,
  'a stashed command runs through the remote r7_cmd with the request and its context');
select pg_temp.r7_is(pg_temp.r7_get('echo2_setting'), '1s', 'a stashed copy carries extra transaction-local settings');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'the restore removed every row the committed world added (' || coalesce(pg_temp.r7_get('added_where'), '') || ')');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'the restore left every pre-existing row unchanged');
select * from pg_temp.r7_finish();
