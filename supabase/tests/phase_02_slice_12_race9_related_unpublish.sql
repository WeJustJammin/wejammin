-- Slice 12 race9: a RELATED TARGET UNPUBLISHED BY THE PRODUCTION WRITER while its pin is curated (lane claude_s12_db9a; BE03c concurrency tests 1817
-- "related target unpublish", CMS-03C-05 1700, Public projection 1571; DEC-245(7): a stand-in must take exactly the production locks; refute8 MODEL FINDING
-- on race8 U3; tracker P2-S12-AC-277).  The unpublish is the real scheduled one: CMS-03B-07 `platform_api.cms_schedule_publication` (action unpublish),
-- claimed by the real `platform_api.cms_claim_due_publication_schedules` once it really falls due (about 75 s; no clock is forged) and executed by the real
-- CMS-03B-20 `platform_api.cms_execute_publication_schedule` (migration 20261005017740: the target ENTRY ROW FOR SHARE at position 0, the review FOR UPDATE, the
-- schedule row FOR UPDATE, the lineage advisory lock).  The curation is the real CMS-03C-05 `platform_api.cms_curate_related_content` (the target entry row FOR SHARE
-- at position 2).  FOR SHARE does not conflict with FOR SHARE, so the deterministic outcome in BOTH orders is that nobody waits; a hand-held FOR UPDATE on the
-- target entry row (what a 03B revision writer takes) is the positive control that both production commands DO wait on the entry row.
--   O1  executor first: the execute stays OPEN (entry row FOR SHARE held) and the curation completes WITHOUT waiting under a 1 s lock_timeout; the unpublish
--       then commits; the pin is stored; the projection drops the target
--   O2  curation first: the curation stays OPEN (source row FOR UPDATE, target FOR SHARE) and the execute completes without waiting; the curation then commits
--   O3  control: a holder owns the target entry row FOR UPDATE: BOTH the curation and the execute are observed blocked BY it (pg_blocking_pids), and both
--       commit after it releases with the same end state
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race7/020-sys.sqlinc
\ir phase_02_slice_12_race8/090-related-helpers.sqlinc

create or replace function pg_temp.r9_sched(p_revision text) returns text language sql stable as $b$
  select coalesce((select state::text || ':' || version::text || ':' || coalesce(reason_code, '-') from platform_private.cms_publication_schedules where revision_id = p_revision::uuid), '-') $b$;
create or replace function pg_temp.r9_outcome(p_out text) returns text language sql immutable as $b$
  select case when p_out like 'ok:%' then (substr(p_out, 4)::jsonb)->>'outcome' else p_out end $b$;
create or replace function pg_temp.r9_eligible(p_out text) returns text language sql immutable as $b$
  select case when p_out like 'ok:%' then (substr(p_out, 4)::jsonb)->>'eligibleCount' else p_out end $b$;
create or replace function pg_temp.r9_entry_lock(p_conn text, p_entry text, p_mode text) returns text language sql volatile as $b$
  select pg_temp.r7_do(p_conn, format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for %s nowait', p_entry, p_mode)) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race9/010-publication-world.sqlinc
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  x text; c text; waited integer := 0; s platform_private.cms_publication_schedules;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  -- the three unpublish schedules really fall due
  while waited < 200 and (select max(resolved_at_utc) from platform_private.cms_publication_schedules
        where revision_id in (pg_temp.r7_get('revision_a')::uuid, pg_temp.r7_get('revision_b')::uuid, pg_temp.r7_get('revision_c')::uuid)) > clock_timestamp() loop
    perform pg_catalog.pg_sleep(1); waited := waited + 1;
  end loop;
  perform pg_temp.r7_note('waited_for_due', (waited < 200)::text);
  perform pg_temp.r8_conn_plain('cur');
  for c in select unnest(array['ex', 'h', 'p', 'cl']) loop perform pg_temp.r7_conn(c); end loop;
  foreach x in array array['a', 'b', 'c'] loop
    perform pg_temp.r7_note('lineage_before_' || x, pg_temp.r8_lineage(pg_temp.r7_get('target_' || x)::uuid));
    perform pg_temp.r7_note('sched_before_' || x, pg_temp.r9_sched(pg_temp.r7_get('revision_' || x)));
  end loop;
  perform pg_temp.r7_note('claim', pg_temp.r7_sql('cl', pg_temp.r7_call_sql('claim')));
  foreach x in array array['a', 'b', 'c'] loop
    select * into s from platform_private.cms_publication_schedules where revision_id = pg_temp.r7_get('revision_' || x)::uuid;
    perform pg_temp.r7_note('sched_claimed_' || x, pg_temp.r9_sched(pg_temp.r7_get('revision_' || x)));
    perform pg_temp.r7_stash_sys('exec:' || x, 'platform_api.cms_execute_publication_schedule', jsonb_build_object(
      'scheduleId', s.id, 'expectedVersion', s.version::text, 'leaseId', s.lease_id, 'evidence', pg_temp.r11_evidence(pg_temp.r7_get('revision_' || x)::uuid)));
    perform pg_temp.r7_stash_copy('exec:' || x || ':lt', 'exec:' || x, '{"lock_timeout": "1s"}'::jsonb);
    perform pg_temp.r7_stash_copy('curate:' || x || ':lt', 'curate:' || x, '{"lock_timeout": "1s"}'::jsonb);
  end loop;

  -- ---- O1: the executor first
  perform pg_temp.r7_note('o1_h', pg_temp.r7_hold('ex', 'exec:a'));
  perform pg_temp.r7_note('o1_lineage_during', pg_temp.r8_lineage(pg_temp.r7_get('target_a')::uuid));
  perform pg_temp.r7_note('o1_update_lock', pg_temp.r9_entry_lock('p', pg_temp.r7_get('target_a'), 'update'));
  perform pg_temp.r7_note('o1_share_lock', pg_temp.r9_entry_lock('p', pg_temp.r7_get('target_a'), 'share'));
  perform pg_temp.r7_send('cur', 'curate:a:lt');
  perform pg_temp.r7_note('o1_b', pg_temp.r7_collect('cur', 20));
  perform pg_temp.r7_note('o1_update_lock_after', pg_temp.r9_entry_lock('p', pg_temp.r7_get('target_a'), 'update'));
  perform pg_temp.r7_note('o1_pins_during', pg_temp.r8_pins(pg_temp.r7_get('source_a')::uuid));
  perform pg_temp.r7_note('o1_projection_during', pg_temp.r8_projection(pg_temp.r7_get('source_a')::uuid));
  perform pg_temp.r7_note('o1_sched_during', pg_temp.r9_sched(pg_temp.r7_get('revision_a')));
  perform pg_temp.r7_note('o1_h_end', pg_temp.r7_end('ex'));
  perform pg_temp.r7_note('o1_lineage_after', pg_temp.r8_lineage(pg_temp.r7_get('target_a')::uuid));
  perform pg_temp.r7_note('o1_pins_after', pg_temp.r8_pins(pg_temp.r7_get('source_a')::uuid));
  perform pg_temp.r7_note('o1_projection_after', pg_temp.r8_projection(pg_temp.r7_get('source_a')::uuid));
  perform pg_temp.r7_note('o1_sched_after', pg_temp.r9_sched(pg_temp.r7_get('revision_a')));

  -- ---- O2: the curation first
  perform pg_temp.r7_note('o2_h', pg_temp.r7_hold('cur', 'curate:b'));
  perform pg_temp.r7_note('o2_source_locked', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('source_b'))));
  perform pg_temp.r7_note('o2_update_lock', pg_temp.r9_entry_lock('p', pg_temp.r7_get('target_b'), 'update'));
  perform pg_temp.r7_note('o2_share_lock', pg_temp.r9_entry_lock('p', pg_temp.r7_get('target_b'), 'share'));
  perform pg_temp.r7_send('ex', 'exec:b:lt');
  perform pg_temp.r7_note('o2_b', pg_temp.r7_collect('ex', 20));
  perform pg_temp.r7_note('o2_source_locked_after', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('source_b'))));
  perform pg_temp.r7_note('o2_lineage_during', pg_temp.r8_lineage(pg_temp.r7_get('target_b')::uuid));
  perform pg_temp.r7_note('o2_pins_during', pg_temp.r8_pins(pg_temp.r7_get('source_b')::uuid));
  perform pg_temp.r7_note('o2_sched_during', pg_temp.r9_sched(pg_temp.r7_get('revision_b')));
  perform pg_temp.r7_note('o2_h_end', pg_temp.r7_end('cur'));
  perform pg_temp.r7_note('o2_pins_after', pg_temp.r8_pins(pg_temp.r7_get('source_b')::uuid));
  perform pg_temp.r7_note('o2_projection_after', pg_temp.r8_projection(pg_temp.r7_get('source_b')::uuid));
  perform pg_temp.r7_note('o2_lineage_after', pg_temp.r8_lineage(pg_temp.r7_get('target_b')::uuid));

  -- ---- O3: control, a holder owns the target entry row FOR UPDATE; both production commands wait behind it
  perform pg_temp.r7_note('o3_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for update', pg_temp.r7_get('target_c'))));
  perform pg_temp.r7_send('cur', 'curate:c');
  perform pg_temp.r7_send('ex', 'exec:c');
  perform pg_temp.r7_note('o3_cur_blocked_by_h', pg_temp.r7_blocked_by('cur', 'h')::text);
  perform pg_temp.r7_note('o3_ex_blocked_by_h', pg_temp.r7_blocked_by('ex', 'h')::text);
  perform pg_temp.r7_note('o3_cur_waits_for', coalesce(pg_temp.r7_waiting_for('cur'), '-'));
  perform pg_temp.r7_note('o3_ex_waits_for', coalesce(pg_temp.r7_waiting_for('ex'), '-'));
  perform pg_temp.r7_note('o3_pins_during', pg_temp.r8_pins(pg_temp.r7_get('source_c')::uuid));
  perform pg_temp.r7_note('o3_lineage_during', pg_temp.r8_lineage(pg_temp.r7_get('target_c')::uuid));
  perform pg_temp.r7_note('o3_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('o3_cur', pg_temp.r7_collect('cur', 30));
  perform pg_temp.r7_note('o3_ex', pg_temp.r7_collect('ex', 30));
  perform pg_temp.r7_note('o3_pins_after', pg_temp.r8_pins(pg_temp.r7_get('source_c')::uuid));
  perform pg_temp.r7_note('o3_projection_after', pg_temp.r8_projection(pg_temp.r7_get('source_c')::uuid));
  perform pg_temp.r7_note('o3_lineage_after', pg_temp.r8_lineage(pg_temp.r7_get('target_c')::uuid));
  perform pg_temp.r7_note('o3_sched_after', pg_temp.r9_sched(pg_temp.r7_get('revision_c')));

  perform pg_temp.r7_cleanup(array['cur', 'ex', 'h', 'p', 'cl']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['cur', 'ex', 'h', 'p', 'cl']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('world_errors=' || coalesce(pg_temp.r7_get('pub_world_errors_text'), 'none') || ' | publish=' || coalesce(pg_temp.r7_get('publish_out_a'), '?') || ' | schedule=' || coalesce(pg_temp.r7_get('schedule_out_a'), '?') || ' | claim=' || left(coalesce(pg_temp.r7_get('claim'), '?'), 300));
select pg_temp.r7_diag('o1_h=' || left(coalesce(pg_temp.r7_get('o1_h'), '?'), 300) || ' | o1_b=' || left(coalesce(pg_temp.r7_get('o1_b'), '?'), 300));
select pg_temp.r7_diag('o2_h=' || left(coalesce(pg_temp.r7_get('o2_h'), '?'), 300) || ' | o2_b=' || left(coalesce(pg_temp.r7_get('o2_b'), '?'), 300));
select pg_temp.r7_diag('o3_cur=' || left(coalesce(pg_temp.r7_get('o3_cur'), '?'), 300) || ' | o3_ex=' || left(coalesce(pg_temp.r7_get('o3_ex'), '?'), 300));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every unpublish scenario without an error of its own [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('rel_world_errors') || '/' || pg_temp.r7_get('pub_world_errors'), '0/0/0',
  'the committed related-content and publication world built with no failed fixture assertion and no world error [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('publish_out_a') || pg_temp.r7_get('publish_out_b') || pg_temp.r7_get('publish_out_c') || '|' || pg_temp.r7_get('schedule_out_a') || pg_temp.r7_get('schedule_out_b') || pg_temp.r7_get('schedule_out_c'),
  '00000:00000:00000:|00000:00000:00000:', 'fixture: three targets were published by the real CMS-03B-09 command and each got a pending unpublish schedule from the real CMS-03B-07 command [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('waited_for_due') = 'true' and pg_temp.r7_get('lineage_before_a') || pg_temp.r7_get('lineage_before_b') || pg_temp.r7_get('lineage_before_c') = 'publish:activepublish:activepublish:active'
    and pg_temp.r7_get('sched_before_a') = 'pending:1:-',
  'fixture: the unpublish schedules really fall due (no clock forged) while every target is still published (active publish head) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('claim') like 'ok:%' and jsonb_array_length(substr(pg_temp.r7_get('claim'), 4)::jsonb) = 3
    and pg_temp.r7_get('sched_claimed_a') like 'executing:2:%' and pg_temp.r7_get('sched_claimed_c') like 'executing:2:%',
  'fixture: the real claim command claimed the three due schedules (executing at version 2, each under its own lease) [P2-S12-AC-277]');

-- O1
select pg_temp.r7_ok(pg_temp.r9_outcome(pg_temp.r7_get('o1_h')) = 'completed' and pg_temp.r7_get('o1_lineage_during') = 'publish:active',
  'fixture: the real execute command (CMS-03B-20) has applied the unpublish in an open transaction: the committed lineage head is still the active publish [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o1_update_lock') || '/' || pg_temp.r7_get('o1_share_lock'), '55P03/00000',
  'the production unpublisher holds the target entry row FOR SHARE (FOR UPDATE NOWAIT is refused, FOR SHARE NOWAIT is granted), exactly the lock the curation takes at position 2 [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r9_eligible(pg_temp.r7_get('o1_b')) = '1' and pg_temp.r7_get('o1_update_lock_after') = '55P03',
  'the real curation pinning the target completes WITHOUT waiting for the unpublish in flight (under a 1 s lock_timeout, while the unpublisher is still open) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o1_pins_during'), pg_temp.r7_get('target_a'), 'the pin of the target is committed while its unpublish is still uncommitted [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_a') in pg_temp.r7_get('o1_projection_during')) = 1,
  'while the unpublish is uncommitted the public projection still lists the published target, pinned first [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('o1_sched_during') like 'executing:%', 'the schedule is still executing (the executor''s transaction owns its schedule row update) while the curation commits [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o1_lineage_after'), 'publish:active,unpublish:revoked', 'the scheduled unpublish commits as a revoked tombstone after the active publish [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('o1_sched_after') like 'completed:%' and pg_temp.r7_get('o1_pins_after') = pg_temp.r7_get('target_a'),
  'the schedule is completed and the unpublished target stays pinned in the stored rule set (history is private, not removed) [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_a') in pg_temp.r7_get('o1_projection_after')) = 0 and pg_temp.r7_get('o1_projection_after') <> '',
  'once the scheduled unpublish has committed the public projection no longer lists the target (it still projects the source''s other eligible targets) [P2-S12-AC-277]');

-- O2
select pg_temp.r7_ok(pg_temp.r9_eligible(pg_temp.r7_get('o2_h')) = '1' and pg_temp.r7_get('o2_source_locked') = '55P03' and pg_temp.r7_get('o2_update_lock') = '55P03' and pg_temp.r7_get('o2_share_lock') = '00000',
  'fixture: the real curation is open and holds the source entry row (position 0) FOR UPDATE and the target entry row (position 2) FOR SHARE [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r9_outcome(pg_temp.r7_get('o2_b')) = 'completed' and pg_temp.r7_get('o2_source_locked_after') = '55P03',
  'the real execute command unpublishing the pinned target completes WITHOUT waiting for the curation in flight (under a 1 s lock_timeout, while the curation is still open) [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('o2_lineage_during') = 'publish:active,unpublish:revoked' and pg_temp.r7_get('o2_pins_during') = '' and pg_temp.r7_get('o2_sched_during') like 'completed:%',
  'the unpublish is committed while the curation is not: no pin is visible yet [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o2_pins_after'), pg_temp.r7_get('target_b'), 'once the curation commits the unpublished target is pinned (a target unpublished before the curation commits is still a valid pin) [P2-S12-AC-277]');
select pg_temp.r7_ok(position(pg_temp.r7_get('target_b') in pg_temp.r7_get('o2_projection_after')) = 0 and pg_temp.r7_get('o2_projection_after') <> '',
  'whichever command committed last, the public projection does not list the unpublished target [P2-S12-AC-277]');

-- O3
select pg_temp.r7_is(pg_temp.r7_get('o3_h'), '00000', 'fixture: a holder owns the target entry row FOR UPDATE (what a 03B revision writer takes) [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o3_cur_blocked_by_h') || '/' || pg_temp.r7_get('o3_ex_blocked_by_h'), 'true/true',
  'control: the curation and the scheduled unpublish are each observed blocked BY a holder of the target entry row FOR UPDATE, so the no-wait outcomes above are real [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('o3_cur_waits_for') || '/' || pg_temp.r7_get('o3_ex_waits_for'), 'transactionid/transactionid',
  'control: both wait for the holder''s transaction on a row lock [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('o3_pins_during') = '' and pg_temp.r7_get('o3_lineage_during') = 'publish:active',
  'while both wait nothing has been written: no pin, and the lineage head is the active publish [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r9_eligible(pg_temp.r7_get('o3_cur')) = '1' and pg_temp.r9_outcome(pg_temp.r7_get('o3_ex')) = 'completed',
  'once the holder releases, both commit: the curation pins the target and the execute completes the unpublish [P2-S12-AC-277]');
select pg_temp.r7_ok(pg_temp.r7_get('o3_lineage_after') = 'publish:active,unpublish:revoked' and pg_temp.r7_get('o3_pins_after') = pg_temp.r7_get('target_c') and pg_temp.r7_get('o3_sched_after') like 'completed:%'
    and position(pg_temp.r7_get('target_c') in pg_temp.r7_get('o3_projection_after')) = 0 and pg_temp.r7_get('o3_projection_after') <> '',
  'the end state is the same in every order: unpublish tombstone, schedule completed, pin stored, target absent from the public projection [P2-S12-AC-277]');

select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-277]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-277]');
select * from pg_temp.r7_finish();
