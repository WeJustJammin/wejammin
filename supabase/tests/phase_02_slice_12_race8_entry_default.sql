-- Slice 12 race8: CMS-03B-10 re-reads the EXACT stored default template after waiting for it (lane claude_s12_db8; BE03b "Initial revision default template":
-- "Before schema4, complete all visible external relation-target locks at2, then ... take its FOR SHARE lock at3", "After waits, re-read/recheck the exact
-- requested schema and its stored default", "retired or blocked default -> 409 CONFLICT"; DEC-202; tracker P2-S12-AC-294).
-- The holder is the REAL CMS-03C-09 retire of the active default template T1 (held open: it owns T1's row FOR UPDATE); the contender is the real
-- platform_api.cms_create_entry naming the visible target T as a relation, so at the moment it waits it already holds position 2:
--   D2  the create is observed blocked BY the retire while it already holds the target entry row (2: free before, held by the create while it waits at 3);
--       the retire commits and the create, which re-reads the default after the wait, is the typed 409 CONFLICT with no entry, no pin and no record
-- Own file because the retire is permanent for the world's default (race8_entry_create.sql needs T1 active).
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race8/030-create-helpers.sqlinc

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race8/020-edtl-world.sqlinc
select pg_temp.r8_stash_create('d2create', pg_temp.r7_get('target')::uuid);
select pg_temp.r7_stash_cmd('retire', 'owner', 'platform_api.cms_activate_governed_subject', jsonb_build_object(
    'reviewId', pg_temp.s12ga_review('edtl-template'), 'action', 'retire',
    'expectedVersion', pg_temp.s12ga_rver(pg_temp.s12ga_review('edtl-template')), 'ifMatch', pg_temp.s12ga_rver(pg_temp.s12ga_review('edtl-template')),
    'idempotencyKey', 'r8-retire-key'));
select pg_temp.r7_note('template_state_in_world', (select state::text from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('edtl-template')));
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  c text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  for c in select unnest(array['b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;
  perform pg_temp.r7_note('entries_before', pg_temp.r8_bound_entries());

  perform pg_temp.r7_note('d2_h', pg_temp.r7_hold('h', 'retire'));
  perform pg_temp.r7_note('d2_pos3_held', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('d2_pos4_before', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version'))));
  perform pg_temp.r7_note('d2_pos2_before', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('target'))));
  perform pg_temp.r7_send('b', 'd2create');
  perform pg_temp.r7_note('d2_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('d2_pos2', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('target'))));
  perform pg_temp.r7_note('d2_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version'))));
  perform pg_temp.r7_note('d2_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('d2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('d2_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('d2_reserved', pg_temp.r8_reserved('r8-d2create'));
  perform pg_temp.r7_note('d2_template_state', (select state::text from platform_private.cms_template_versions where id = pg_temp.r7_get('template')::uuid));

  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('d2_h=' || left(coalesce(pg_temp.r7_get('d2_h'), '?'), 300) || ' | d2_b=' || left(coalesce(pg_temp.r7_get('d2_b'), '?'), 300));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran the default-template scenario without an error of its own [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('world_premises_failed'), '0/0', 'the committed create world built with no failed fixture assertion and no failed premise [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('template_state_in_world') = 'active' and pg_temp.r7_get('entries_before') = '0',
  'fixture: the default template T1 is active and the bound content type holds no entry before the race [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('d2_h') like 'ok:%' and pg_temp.r7_get('d2_pos3_held') = '55P03' and pg_temp.r7_get('d2_pos2_before') = '00000',
  'fixture: the real retire of T1 stays open and owns the template row, the target entry row is still free [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('d2_blocked_by_h'), 'true',
  'the create is observed blocked BY the open retire of its exact stored default template, the position 3 lock [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('d2_pos2_before') || '/' || pg_temp.r7_get('d2_pos2'), '00000/55P03',
  'while the create waits at the default template (3) it already holds the relation target entry row (2), which no other session held before: position 2 precedes 3 [P2-S12-AC-294]');
select pg_temp.r7_diag('observation: the retire holder owns the content type version row itself (a retire locks its bound types): d2_pos4_before=' || coalesce(pg_temp.r7_get('d2_pos4_before'), '?') || ' d2_pos4_during=' || coalesce(pg_temp.r7_get('d2_pos4'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('d2_b'), 'P0001:CONFLICT',
  'the exact stored default is re-read after the wait: the retired default is the typed 409 CONFLICT [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('d2_template_state') = 'retired' and pg_temp.r7_get('d2_entries_after') = pg_temp.r7_get('entries_before') and pg_temp.r7_get('d2_reserved') = '0',
  'the retire committed and the refused create stored no entry, no pin and no Idempotency-Key record [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-294]');
select * from pg_temp.r7_finish();
