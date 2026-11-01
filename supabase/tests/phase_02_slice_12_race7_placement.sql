-- Slice 12 race7: CMS-03C-02 pattern placement under REAL concurrency (lane claude_s12_race7; BE03c "Slice 12 lock order" 1500-1530 row CMS-03C-02, DEC-185
-- "computed under the revision/slot lock", rule 4 typed deadlock; tracker P2-S12-AC-013, AC-218, AC-276).
-- Independent sessions (dblink; the precedent of phase_02_slice_09_schema/000b-activation-lock.sqlinc) drive the REAL command
-- platform_api.cms_insert_pattern_instance under the real service_role against REAL active patterns (created by CMS-03C-12 and activated through the governed
-- chain) and a real template; the entries are the guarded direct inserts the placement suite uses (phase_02_slice_12_pattern_placement/000-fixtures).  The world is
-- committed and removed again by the harness.  The command under test is the lock holder (an open transaction):
--   P1  A places a 2-root pattern into slot /main and stays open; B places a 1-root pattern into the SAME slot of the SAME revision: B is observed blocked on A
--       (the entry row, position 0, which is the revision/slot lock), A commits, B resumes and takes the next position: the revision holds positions 0, 1, 2, each
--       path once, in commit order                                                                                      [AC-013, AC-218]
--   P2  A and B place the SAME pattern into the same slot: B waits for A and then answers the path-uniqueness CONFLICT with nothing written; exactly one row
--       exists per (revision, path)                                                                                     [AC-013, AC-218]
--   P3  a holder owns the entry row (position 0): the command waits there holding NOTHING later (authority, pattern and content type rows are free); a lock
--       timeout is the retryable CONFLICT with nothing committed and the same request then succeeds                     [AC-218, AC-276]
--   P4  a holder owns the pattern version row (position 3): the command waits there already holding the entry row (0) and the authority rows (1) and not yet the
--       content type version row (4); on release it completes                                                          [AC-218, AC-276]
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc

create or replace function pg_temp.r7_rows(p_revision uuid) returns text language sql stable as $b$
  select coalesce(string_agg(path || '@' || position, ',' order by position, path), '') from platform_private.cms_composition_instances where revision_id = p_revision $b$;
create or replace function pg_temp.r7_dups(p_revision uuid) returns bigint language sql stable as $b$
  select count(*) - count(distinct path) from platform_private.cms_composition_instances where revision_id = p_revision $b$;
create or replace function pg_temp.r7_entry_version(p_entry uuid) returns text language sql stable as $b$
  select version::text from platform_private.cms_content_entries where id = p_entry $b$;
create or replace function pg_temp.r7_stores() returns text language sql stable as $b$
  select 'audit=' || (select count(*) from audit_private.audit_events) || ' outbox=' || (select count(*) from platform_private.outbox_events)
    || ' idem=' || (select count(*) from platform_private.idempotency_records) || ' rows=' || (select count(*) from platform_private.cms_composition_instances) $b$;
create or replace function pg_temp.r7_grant_where() returns text language sql stable as $b$
  select format('organization_id = %L::uuid and person_id = %L::uuid and capability_code = ''cms.author''', pg_temp.r7_get('owner_org'), pg_temp.r7_get('owner_person')) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
-- two real active patterns: pa = [hero{title}, cta] (block roots hero, cta), p1r = [only]
select * from pg_temp.s12pl_pattern('pa', 's12pl-pa', jsonb_build_array(
  pg_temp.s12pd_block('hero', jsonb_build_array(pg_temp.s12pd_block('title'))), pg_temp.s12pd_block('cta')));
select * from pg_temp.s12pl_pattern('p1r', 's12pl-p1r', jsonb_build_array(pg_temp.s12pd_block('only')));
-- a real draft template with the slots main, side, fresh (the entries below are bound to it, so the slotPath names a slot)
select pg_temp.s09d_rpc('s12pl-template', 'platform_api.cms_define_template', 'owner', jsonb_build_object(
  'templateKey', 's12pl-tpl', 'compatibleTypeIds', jsonb_build_array((select id from s12pd_types where ordinal = 1)),
  'slots', jsonb_build_array(
    jsonb_build_object('key', 'main', 'required', false, 'allowedBlocks', '[]'::jsonb, 'maxCount', 128),
    jsonb_build_object('key', 'side', 'required', false, 'allowedBlocks', '[]'::jsonb, 'maxCount', 128),
    jsonb_build_object('key', 'fresh', 'required', false, 'allowedBlocks', '[]'::jsonb, 'maxCount', 128)),
  'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
  'idempotencyKey', 's12pl-template-0001'), true);
select pg_temp.r7_note('template_outcome', pg_temp.s09d_outcome('s12pl-template'));
select pg_temp.s12pl_tentry(t) from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) t;

create or replace function pg_temp.r7_stash_place(p_key text, p_tag text, p_pattern text, p_slot text, p_idem text, p_bump integer default 0) returns void language plpgsql as $b$
declare request jsonb := pg_temp.s12pl_request(p_tag, p_pattern, p_slot, '{}'::jsonb, p_idem, 'linked', (pg_temp.s12pl_version(p_tag)::bigint + p_bump)::text);
begin
  perform pg_temp.r7_stash_cmd(p_key, 'owner', 'platform_api.cms_insert_pattern_instance', request - 'context', request->'context');
end;
$b$;
select pg_temp.r7_stash_place('p1:a', 'e1', 'pa', '/main', 'r7-p1-a-key');
select pg_temp.r7_stash_place('p1:b', 'e1', 'p1r', '/main', 'r7-p1-b-key', 1);
select pg_temp.r7_stash_place('p2:a', 'e2', 'pa', '/side', 'r7-p2-a-key');
select pg_temp.r7_stash_place('p2:b', 'e2', 'pa', '/side', 'r7-p2-b-key', 1);
select pg_temp.r7_stash_place('p3', 'e3', 'pa', '/fresh', 'r7-p3-key');
select pg_temp.r7_stash_copy('p3:lt', 'p3', '{"lock_timeout": "3s"}'::jsonb);
select pg_temp.r7_stash_place('p4', 'e4', 'pa', '/main', 'r7-p4-key');
select pg_temp.r7_stash_place('p5:a', 'e5', 'pa', '/main', 'r7-p5-a-key');
select pg_temp.r7_stash_place('p5:b', 'e6', 'pa', '/main', 'r7-p5-b-key');
select pg_temp.r7_note('owner_org', pg_temp.s09d_id('ownerOrg')::text);
select pg_temp.r7_note('owner_person', (select person_id::text from s09d_actor where key = 'owner'));
select pg_temp.r7_note('pattern_pa', pg_temp.s12pd_row('pa')->>'id');
select pg_temp.r7_note('type_version', (select version_id::text from s12pd_types where ordinal = 1));
select pg_temp.r7_note(t || ':entry', pg_temp.s12pl_entry_id(t)::text) from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) t;
select pg_temp.r7_note(t || ':rev', pg_temp.s12pl_rev(t)::text) from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) t;
select pg_temp.r7_note(t || ':v0', pg_temp.s12pl_version(t)) from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) t;
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare c text; e1 uuid; e2 uuid; e3 uuid; e4 uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; pa uuid; tv uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  e1 := pg_temp.r7_get('e1:entry')::uuid; e2 := pg_temp.r7_get('e2:entry')::uuid; e3 := pg_temp.r7_get('e3:entry')::uuid; e4 := pg_temp.r7_get('e4:entry')::uuid;
  r1 := pg_temp.r7_get('e1:rev')::uuid; r2 := pg_temp.r7_get('e2:rev')::uuid; r3 := pg_temp.r7_get('e3:rev')::uuid; r4 := pg_temp.r7_get('e4:rev')::uuid;
  r5 := pg_temp.r7_get('e5:rev')::uuid; r6 := pg_temp.r7_get('e6:rev')::uuid;
  pa := pg_temp.r7_get('pattern_pa')::uuid; tv := pg_temp.r7_get('type_version')::uuid;
  for c in select unnest(array['a', 'b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;

  -- P1: two placements into one slot of one revision
  perform pg_temp.r7_note('p1_a', pg_temp.r7_hold('a', 'p1:a'));
  perform pg_temp.r7_send('b', 'p1:b');
  perform pg_temp.r7_note('p1_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('p1_b_waits_for', pg_temp.r7_waiting_for('b'));
  perform pg_temp.r7_note('p1_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('p1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('p1_rows', pg_temp.r7_rows(r1));
  perform pg_temp.r7_note('p1_dups', pg_temp.r7_dups(r1)::text);
  perform pg_temp.r7_note('p1_version', pg_temp.r7_entry_version(e1));

  -- P2: the same pattern into the same slot: exactly one winner of every path
  perform pg_temp.r7_note('p2_a', pg_temp.r7_hold('a', 'p2:a'));
  perform pg_temp.r7_send('b', 'p2:b');
  perform pg_temp.r7_note('p2_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('p2_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('p2_stores_after_a', pg_temp.r7_stores());
  perform pg_temp.r7_note('p2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('p2_stores_after_b', pg_temp.r7_stores());
  perform pg_temp.r7_note('p2_rows', pg_temp.r7_rows(r2));
  perform pg_temp.r7_note('p2_dups', pg_temp.r7_dups(r2)::text);
  perform pg_temp.r7_note('p2_version', pg_temp.r7_entry_version(e2));

  -- P3: a holder owns the entry row (position 0)
  perform pg_temp.r7_note('p3_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('p3_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for update', e3)));
  perform pg_temp.r7_send('b', 'p3:lt');
  perform pg_temp.r7_note('p3_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('p3_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('p3_probe_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_pattern_versions', format('id = %L::uuid', pa)));
  perform pg_temp.r7_note('p3_probe_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', tv)));
  perform pg_temp.r7_note('p3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('p3_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('p3_version_after_conflict', pg_temp.r7_entry_version(e3));
  perform pg_temp.r7_note('p3_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('p3_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('p3')));
  perform pg_temp.r7_note('p3_rows_after_retry', pg_temp.r7_rows(r3));

  -- P4: a holder owns the pattern version row (position 3)
  perform pg_temp.r7_note('p4_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_pattern_versions where id = %L::uuid for update', pa)));
  perform pg_temp.r7_send('b', 'p4');
  perform pg_temp.r7_note('p4_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('p4_probe_pos0', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', e4)));
  perform pg_temp.r7_note('p4_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('p4_probe_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', tv)));
  perform pg_temp.r7_note('p4_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('p4_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('p4_rows', pg_temp.r7_rows(r4));

  -- P5: the author capability is re-proved under the position 1 lock
  -- (a) the placement (held open) owns the authority rows FOR SHARE: a revocation waits and commits after it
  perform pg_temp.r7_conn('r');
  perform pg_temp.r7_note('p5a_a', pg_temp.r7_hold('a', 'p5:a'));
  perform pg_temp.r7_send_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('p5a_r_blocked_by_a', pg_temp.r7_blocked_by('r', 'a')::text);
  perform pg_temp.r7_note('p5a_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('p5a_r', pg_temp.r7_collect('r'));
  perform pg_temp.r7_note('p5a_rows', pg_temp.r7_rows(r5));
  perform pg_temp.r7_note('p5a_grant', (select active::text from identity_private.organization_actor_grant where organization_id = pg_temp.r7_get('owner_org')::uuid
    and person_id = pg_temp.r7_get('owner_person')::uuid and capability_code = 'cms.author'));
  perform pg_temp.r7_note('p5a_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_grant_where())));
  -- (b) a revocation in flight owns the grant row: the placement waits, then re-proves the capability and is refused
  perform pg_temp.r7_note('p5b_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('p5b_r', pg_temp.r7_hold_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_grant_where())));
  perform pg_temp.r7_send('b', 'p5:b');
  perform pg_temp.r7_note('p5b_b_blocked_by_r', pg_temp.r7_blocked_by('b', 'r')::text);
  perform pg_temp.r7_note('p5b_r_commit', pg_temp.r7_end('r'));
  perform pg_temp.r7_note('p5b_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('p5b_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('p5b_rows', pg_temp.r7_rows(r6));
  perform pg_temp.r7_note('p5b_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_grant_where())));
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p', 'r']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p', 'r']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every placement scenario without an error of its own [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed placement world built with no failed fixture assertion [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('template_outcome'), 'OK', 'fixture: the real CMS-03C-01 template with slots main, side and fresh exists [P2-S12-AC-218]');

-- P1
select pg_temp.r7_ok(pg_temp.r7_get('p1_a') like 'ok:%', 'the first placement (2 block roots into /main) commits while its session stays open [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p1_b_blocked_by_a'), 'true',
  'a second placement into the same slot of the same revision is observed blocked BY the first in the live lock manager (the revision/slot lock) [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('p1_b_waits_for'), 'transactionid',
  'the second placement waits for the first transaction to finish (the entry row, position 0, owned by the first) [P2-S12-AC-218]');
select pg_temp.r7_ok(pg_temp.r7_get('p1_b') like 'ok:%', 'once the first placement commits the second placement succeeds [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p1_rows'), '/main/hero@0,/main/cta@1,/main/only@2',
  'two simultaneous placements into one slot get disjoint consecutive positions 0, 1, 2 in commit order, each path once [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p1_rows'), '/main/hero@0,/main/cta@1,/main/only@2',
  'the placement under the revision/slot lock computes its positions after the winner committed: disjoint consecutive positions in commit order [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('p1_dups'), '0', 'no (revision_id, path) is duplicated after the concurrent placements [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p1_version'), pg_temp.r7_get('e1:v0')::bigint + 2 || '', 'both placements advanced the entry aggregate version by one each [P2-S12-AC-013]');

-- P2
select pg_temp.r7_ok(pg_temp.r7_get('p2_a') like 'ok:%', 'fixture: the first placement of the shared pattern into /side commits while its session stays open [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p2_b_blocked_by_a'), 'true', 'the competing placement of the same paths waits for the first [P2-S12-AC-013]');
select pg_temp.r7_is(pg_temp.r7_get('p2_b'), 'P0001:CONFLICT|["/slotPath"]',
  'exactly one winner on the same path: the loser answers the typed CONFLICT at /slotPath after waiting for the winner [P2-S12-AC-013]');
select pg_temp.r7_ok(pg_temp.r7_get('p2_stores_after_b') = pg_temp.r7_get('p2_stores_after_a'),
  'the loser wrote no composition row, audit, outbox or idempotency row: the stores equal what the winner left [P2-S12-AC-013]');
select pg_temp.r7_ok(pg_temp.r7_get('p2_rows') = '/side/hero@0,/side/cta@1' and pg_temp.r7_get('p2_dups') = '0'
    and pg_temp.r7_get('p2_version') = pg_temp.r7_get('e2:v0')::bigint + 1 || '',
  'the revision holds the winner''s two rows only, each path exactly once, and the entry advanced by the winner alone [P2-S12-AC-218]');

-- P3
select pg_temp.r7_is(pg_temp.r7_get('p3_b_blocked_by_h'), 'true', 'the placement is observed blocked BY the holder of the entry row (position 0) [P2-S12-AC-218]');
select pg_temp.r7_ok(pg_temp.r7_get('p3_probe_pos1') = '00000' and pg_temp.r7_get('p3_probe_pos3') = '00000' and pg_temp.r7_get('p3_probe_pos4') = '00000',
  'waiting at position 0 the placement holds no later position: the authority rows, the pattern version row and the content type version row are all free [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('p3_b'), 'P0001:CONFLICT',
  'a lock-acquisition failure (lock_timeout) at the entry row is the retryable P0001 CONFLICT of CMS-03C-02 [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('p3_stores_after') = pg_temp.r7_get('p3_stores_before') and pg_temp.r7_get('p3_version_after_conflict') = pg_temp.r7_get('e3:v0'),
  'the lock failure committed nothing: no row, audit, outbox or idempotency record and the entry version is unchanged [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('p3_retry') like 'ok:%' and pg_temp.r7_get('p3_rows_after_retry') = '/fresh/hero@0,/fresh/cta@1',
  'the same request (same Idempotency-Key) succeeds once the entry row is free: the key is reusable after the conflict [P2-S12-AC-276]');

-- P4
select pg_temp.r7_is(pg_temp.r7_get('p4_b_blocked_by_h'), 'true', 'the placement is observed blocked BY the holder of the pattern version row (position 3) [P2-S12-AC-218]');
select pg_temp.r7_ok(pg_temp.r7_get('p4_probe_pos0') = '55P03' and pg_temp.r7_get('p4_probe_pos1') = '55P03',
  'waiting at position 3 the placement already holds the entry row (position 0) and the authority rows (position 1) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('p4_probe_pos4'), '00000',
  'waiting at position 3 the placement does not yet hold the content type version row (position 4): no earlier position is taken after a later one [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('p4_b') like 'ok:%' and pg_temp.r7_get('p4_rows') = '/main/hero@0,/main/cta@1',
  'once the pattern row holder releases, the placement completes with positions 0 and 1 [P2-S12-AC-218]');

-- P5
select pg_temp.r7_ok(pg_temp.r7_get('p5a_a') like 'ok:%', 'the placement (held open) owns the author authority rows (position 1) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('p5a_r_blocked_by_a'), 'true', 'a revocation of the author grant arriving while the placement runs WAITS for it (the position 1 FOR SHARE lock) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('p5a_rows') = '/main/hero@0,/main/cta@1' and pg_temp.r7_get('p5a_grant') = 'false',
  'the placement committed first and the waiting revocation then committed: two rows exist and the grant is revoked [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('p5b_b_blocked_by_r'), 'true', 'a placement arriving while a revocation of its author grant is in flight waits for the revoking transaction [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('p5b_b'), 'P0001:capability_missing',
  'a revocation committed first wins: the placement re-proves the capability under the lock and is refused capability_missing [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('p5b_stores_after') = pg_temp.r7_get('p5b_stores_before') and pg_temp.r7_get('p5b_rows') = '',
  'the refused placement wrote nothing: no composition row, audit, outbox or idempotency record [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-218]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-218]');
select * from pg_temp.r7_finish();
