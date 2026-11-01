-- Slice 12 race8: CMS-03C-09 governed activation WAITS AT EACH LOCK POSITION (lane claude_s12_db8; BE03c "Slice 12 lock order" 1500-1530 row CMS-03C-09:
-- 1 authority rows, 3 the subject version row, 3 the lineage's active row and the dependency graph (4 the bound content type version rows),
-- 5 the review row, the lineage advisory lock last; activation steps 1490-1495; tracker P2-S12-AC-085; refute7 finding 4 / item 6: "a wait at position 3
-- and at position 4 of CMS-03C-09").  race7_activation.sql observed the waits at position 5 and at the advisory lock; this file observes the waits at
-- position 1, at the subject row (3), at the lineage's ACTIVE row (3b) and at the content type version row (4), each with a probe of every other position
-- from a third session WHILE the real command is blocked: positions before the wait are held (55P03), positions after it are free (00000).
-- The command under test is the real platform_api.cms_activate_governed_subject under service_role on a dblink session; the holder is a raw lock owner.
--   W1  the holder owns the activator's grant row (position 1): nothing after it is taken (3, 3b, 4, 5 and the advisory lock free)
--   W3  the holder owns the SUBJECT version row (position 3): position 1 is held, 4, 5 and the advisory lock free
--   W3b the holder owns the lineage's ACTIVE row (the predecessor): position 1 and the subject row are held, 4, 5 and the advisory lock free
--   W4  the holder owns the bound content type version row (position 4): positions 1, 3, 3b are held, 5 and the advisory lock free
-- After each wait the holder rolls back and the activation completes (the subject is `active`): a wait delays, never loses.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race8/010-activation-helpers.sqlinc

-- Every position of the activation, probed from p: grant rows (1), subject row (3), the active predecessor (3b, '-' without one), the content type
-- version row (4), the review row (5) and the lineage advisory lock.  '55P03' = held by another session, '00000' = free.
create or replace function pg_temp.r8_positions(p_conn text, p_subject uuid, p_prev uuid, p_type uuid, p_review uuid, p_lineage uuid) returns text language sql volatile as $b$
  select 'p1=' || pg_temp.r7_row_locked(p_conn, 'identity_private.organization_actor_grant', pg_temp.r8_grant_where())
    || ' p3=' || pg_temp.r7_row_locked(p_conn, 'platform_private.cms_template_versions', format('id = %L::uuid', p_subject))
    || ' p3b=' || case when p_prev is null then '-' else pg_temp.r7_row_locked(p_conn, 'platform_private.cms_template_versions', format('id = %L::uuid', p_prev)) end
    || ' p4=' || pg_temp.r7_row_locked(p_conn, 'platform_private.cms_content_type_versions', format('id = %L::uuid', p_type))
    || ' p5=' || pg_temp.r7_row_locked(p_conn, 'platform_private.cms_governed_reviews', format('id = %L::uuid', p_review))
    || ' adv=' || pg_temp.r7_advisory_probe(p_conn, pg_temp.r8_lock_key(p_lineage)) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race7/010-governed-world.sqlinc
-- W1 / W3 / W4: one approved review each, each in its own lineage
select pg_temp.s12gb_approved('q1');
select pg_temp.s12gb_approved('q3');
select pg_temp.s12gb_approved('q4');
-- W3b: lineage m with an ACTIVE version (m1, activated by the real command) and an approved successor (m2)
select pg_temp.s12gb_approved('m1');
select pg_temp.s12gb_act('r8-m1-activate', 'owner', pg_temp.s12ga_review('m1'));
select pg_temp.s12gb_successor('m2', 'm1', array['typeA']);
select pg_temp.s12gb_approve('m2');
select pg_temp.r7_stash_act(t) from unnest(array['q1', 'q3', 'q4', 'm2']) t;
select pg_temp.r7_note('m1_state_in_world', (select state::text from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('m1')));
select pg_temp.r7_note('subject:m1', pg_temp.s12ga_subject('m1')::text);
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
select pg_temp.r7_note('world_reviews_approved', (select count(*)::text from platform_private.cms_governed_reviews where state = 'approved'));
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  type_version uuid; c text; w text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  type_version := pg_temp.r7_get('type_version_a')::uuid;
  for c in select unnest(array['b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;

  -- ---- W1: the holder owns the activator's grant row (position 1)
  perform pg_temp.r7_note('w1_h', pg_temp.r7_hold_raw('h', format('perform 1 from identity_private.organization_actor_grant where %s for update', pg_temp.r8_grant_where())));
  perform pg_temp.r7_send('b', 'act:q1');
  perform pg_temp.r7_note('w1_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('w1_positions', pg_temp.r8_positions('p', pg_temp.r7_get('subject:q1')::uuid, null, type_version, pg_temp.r7_get('review:q1')::uuid, pg_temp.r7_get('lineage:q1')::uuid));
  perform pg_temp.r7_note('w1_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('w1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('w1_state', pg_temp.r8_state_of(pg_temp.r7_get('subject:q1')::uuid));

  -- ---- W3: the holder owns the subject version row (position 3)
  perform pg_temp.r7_note('w3_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_template_versions where id = %L::uuid for update', pg_temp.r7_get('subject:q3'))));
  perform pg_temp.r7_send('b', 'act:q3');
  perform pg_temp.r7_note('w3_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('w3_positions', pg_temp.r8_positions('p', pg_temp.r7_get('subject:q3')::uuid, null, type_version, pg_temp.r7_get('review:q3')::uuid, pg_temp.r7_get('lineage:q3')::uuid));
  perform pg_temp.r7_note('w3_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('w3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('w3_state', pg_temp.r8_state_of(pg_temp.r7_get('subject:q3')::uuid));

  -- ---- W3b: the holder owns the lineage's ACTIVE row (m1); the activation of its successor m2 holds the subject row m2 first
  perform pg_temp.r7_note('w3b_before', pg_temp.r8_states(pg_temp.r7_get('lineage:m2')::uuid));
  perform pg_temp.r7_note('w3b_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_template_versions where id = %L::uuid for update', pg_temp.r7_get('subject:m1'))));
  perform pg_temp.r7_send('b', 'act:m2');
  perform pg_temp.r7_note('w3b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('w3b_positions', pg_temp.r8_positions('p', pg_temp.r7_get('subject:m2')::uuid, pg_temp.r7_get('subject:m1')::uuid, type_version, pg_temp.r7_get('review:m2')::uuid, pg_temp.r7_get('lineage:m2')::uuid));
  perform pg_temp.r7_note('w3b_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('w3b_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('w3b_after', pg_temp.r8_states(pg_temp.r7_get('lineage:m2')::uuid));

  -- ---- W4: the holder owns the bound content type version row (position 4); a lineage with no active row, so positions 3 and 3b are the subject only
  perform pg_temp.r7_note('w4_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_type_versions where id = %L::uuid for update', type_version)));
  perform pg_temp.r7_send('b', 'act:q4');
  perform pg_temp.r7_note('w4_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('w4_positions', pg_temp.r8_positions('p', pg_temp.r7_get('subject:q4')::uuid, null, type_version, pg_temp.r7_get('review:q4')::uuid, pg_temp.r7_get('lineage:q4')::uuid));
  perform pg_temp.r7_note('w4_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('w4_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('w4_state', pg_temp.r8_state_of(pg_temp.r7_get('subject:q4')::uuid));

  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('w1=' || coalesce(pg_temp.r7_get('w1_positions'), '?') || ' | w3=' || coalesce(pg_temp.r7_get('w3_positions'), '?') || ' | w3b=' || coalesce(pg_temp.r7_get('w3b_positions'), '?') || ' | w4=' || coalesce(pg_temp.r7_get('w4_positions'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every wait scenario without an error of its own [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed governed world built with no failed fixture assertion [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('m1_state_in_world'), 'active', 'fixture: the lineage of the W3b scenario has an ACTIVE version before the race [P2-S12-AC-085]');

-- W1
select pg_temp.r7_is(pg_temp.r7_get('w1_h'), '00000', 'fixture: the holder owns the activator''s grant row FOR UPDATE (position 1) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w1_blocked_by_h'), 'true', 'CMS-03C-09 activate is observed blocked BY the holder of the authority rows, the position 1 lock [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w1_positions'), 'p1=55P03 p3=00000 p3b=- p4=00000 p5=00000 adv=00000',
  'blocked at position 1 the activation holds nothing after it: the subject row (3), the content type version row (4), the review row (5) and the advisory lock are all free [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('w1_b') like 'ok:%' and pg_temp.r7_get('w1_state') = 'active',
  'once the position 1 holder releases the activation completes and the subject is active [P2-S12-AC-085]');

-- W3
select pg_temp.r7_is(pg_temp.r7_get('w3_h'), '00000', 'fixture: the holder owns the subject version row FOR UPDATE (position 3) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w3_blocked_by_h'), 'true', 'CMS-03C-09 activate is observed blocked BY the holder of the subject version row, the position 3 lock [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w3_positions'), 'p1=55P03 p3=55P03 p3b=- p4=00000 p5=00000 adv=00000',
  'blocked at the subject row (position 3) the activation already holds position 1 and holds nothing after: content type version row (4), review row (5) and advisory lock free [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('w3_b') like 'ok:%' and pg_temp.r7_get('w3_state') = 'active',
  'once the position 3 holder releases the activation completes and the subject is active [P2-S12-AC-085]');

-- W3b
select pg_temp.r7_is(pg_temp.r7_get('w3b_before'), 'active,approved', 'fixture: the lineage holds an active version and the approved successor before the race [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w3b_blocked_by_h'), 'true', 'CMS-03C-09 activate is observed blocked BY the holder of the lineage''s ACTIVE row, taken after the subject row [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w3b_positions'), 'p1=55P03 p3=55P03 p3b=55P03 p4=00000 p5=00000 adv=00000',
  'blocked at the lineage''s active row the activation holds position 1 and the subject row, and nothing after it: content type version row (4), review row (5), advisory lock free [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('w3b_b') like 'ok:%' and pg_temp.r7_get('w3b_after') = 'superseded,active',
  'once the active-row holder releases the activation completes: the predecessor is superseded and the successor active [P2-S12-AC-085]');

-- W4
select pg_temp.r7_is(pg_temp.r7_get('w4_h'), '00000', 'fixture: the holder owns the bound content type version row FOR UPDATE (position 4) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w4_blocked_by_h'), 'true', 'CMS-03C-09 activate is observed blocked BY the holder of the bound content type version row, the position 4 lock [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('w4_positions'), 'p1=55P03 p3=55P03 p3b=- p4=55P03 p5=00000 adv=00000',
  'blocked at the content type version row (position 4) the activation already holds positions 1 and 3, and the review row (5) and the advisory lock are still free [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('w4_b') like 'ok:%' and pg_temp.r7_get('w4_state') = 'active',
  'once the position 4 holder releases the activation completes and the subject is active [P2-S12-AC-085]');

-- cleanup
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-085]');
select * from pg_temp.r7_finish();
