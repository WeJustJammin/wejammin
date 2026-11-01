-- Slice 12 race8: CMS-03B-10 initial entry creation REPLAYS ITS PREMISES AFTER EVERY WAIT (lane claude_s12_db8; BE03b "Initial revision default template" and
-- "Write-path lock order and authority fencing" rules 1 and 2; DEC-202; tracker P2-S12-AC-294; race7 report open item 5 and refute7 follow-up 6).
-- The command under test is the real platform_api.cms_create_entry under service_role on a dblink session; the holders are real commands wherever one
-- exists (CMS-03B-01 cms_create_revision, CMS-03A-04 cms_activate_schema) and a raw revocation UPDATE for the authority (the precedent of race7 S4b).
--   A3  the target entry is BUMPED while the create waits for it at position 2: the pinned expectedTargetVersion is decided after the lock, so the create is
--       the uniform VALIDATION_FAILED at /fields/{relation field}; positions 3 (default template) and 4 (content type version) were still free while it waited
--   A5  a concealed target (visible to nobody: another content type) is refused at once, with a holder owning its entry row: no lock lever; the same
--       refusal as an absent id (no existence oracle)
--   A6  two relation targets: the set is locked in ASCENDING id order (a holder on the higher id leaves the lower one held by the create, a holder on the
--       lower id leaves the higher one free), with the caller's assignment rows of the lower target
--   A4  a revocation of the author grant is in flight: the create waits at position 1 and re-proves the capability under the lock: refused, nothing written
--   A1  a schema activation holds position 1 FOR UPDATE: the create waits, then finds its exact schema superseded: VALIDATION_FAILED at /contentTypeVersionId
--       and no entry, no pin, no idempotency record (last: it supersedes the schema the other scenarios use)
-- (A2, the exact default template rechecked after a wait at position 3, is race8_entry_default.sql: it retires T1 and so needs a world of its own.)
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
\ir phase_02_slice_12_race8/025-many-relation-world.sqlinc
select pg_temp.r8_stash_create('s3pin1', pg_temp.r7_get('target')::uuid, '1');
select pg_temp.r8_stash_create('s3pin2', pg_temp.r7_get('target')::uuid, '2');
select pg_temp.r8_stash_create('s5conceal', pg_temp.r7_get('e2')::uuid);
select pg_temp.r8_stash_create('s5absent', 'a9a94000-0000-4000-8000-0000000000e2'::uuid);
select pg_temp.r8_stash_create('s1create', null);
select pg_temp.r8_stash_create('s4create', null);
select pg_temp.r7_stash_cmd('bump', 'owner', 'platform_api.cms_create_revision', jsonb_build_object(
    'entryId', pg_temp.r7_get('target'), 'baseRevision', '1', 'locale', 'en-US', 'expectedVersion', '1', 'ifMatch', '1',
    'changedPaths', jsonb_build_array('/fields/' || (select stable_field_id::text from platform_private.cms_field_definition_versions
       where content_type_version_id = pg_temp.s09d_id('edtl-target:version') and field_key = 'title')),
    'values', jsonb_build_object((select stable_field_id::text from platform_private.cms_field_definition_versions
       where content_type_version_id = pg_temp.s09d_id('edtl-target:version') and field_key = 'title'), 'R8 TARGET BUMPED'),
    'idempotencyKey', 'r8-bump-key'), pg_temp.s09d_context('owner', true));
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

  -- ---- A3: the target is bumped (a real revision append, held open) while the create waits for the target entry row
  perform pg_temp.r7_note('a3_h', pg_temp.r7_hold('h', 'bump'));
  perform pg_temp.r7_note('a3_target_version_held', pg_temp.r8_entry_version(pg_temp.r7_get('target')::uuid));
  perform pg_temp.r7_send('b', 's3pin1');
  perform pg_temp.r7_note('a3_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('a3_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('a3_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version'))));
  perform pg_temp.r7_note('a3_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('a3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('a3_target_version_after', pg_temp.r8_entry_version(pg_temp.r7_get('target')::uuid));
  perform pg_temp.r7_note('a3_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a3_reserved', pg_temp.r8_reserved('r8-s3pin1'));
  -- control (rolled back, so the bound content type stays empty for the schema activation of A1): the same create pinned to the new target version succeeds
  perform pg_temp.r7_note('a3_control', pg_temp.r7_hold('h', 's3pin2'));
  perform extensions.dblink_exec('h', 'reset role');
  perform pg_temp.r7_note('a3_control_pin', pg_temp.r7_sql('h', format(
    'select r.template_version_id::text from platform_private.cms_entry_revisions r join platform_private.cms_content_entries e on e.id = r.entry_id where e.content_type_id = %L::uuid order by r.created_at desc, r.revision_number desc limit 1',
    pg_temp.r7_get('bound_type'))));
  perform pg_temp.r7_note('a3_control_end', pg_temp.r7_end('h', 'rollback'));

  -- ---- A5: a concealed target is not a lock lever
  perform pg_temp.r7_note('a5_entries_before', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a5_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for update', pg_temp.r7_get('e2'))));
  perform pg_temp.r7_note('a5_held', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('e2'))));
  perform pg_temp.r7_send('b', 's5conceal');
  perform pg_temp.r7_note('a5_b', pg_temp.r7_collect('b', 8));
  perform pg_temp.r7_note('a5_absent', pg_temp.r7_sql('b', pg_temp.r7_call_sql('s5absent')));
  perform pg_temp.r7_note('a5_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('a5_entries_after', pg_temp.r8_bound_entries());

  -- ---- A6: the complete target set is locked in ASCENDING id order: a holder on the HIGHER target leaves the lower one already held by the create,
  --      a holder on the LOWER target leaves the higher one still free
  perform pg_temp.r7_note('a6_h_high', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for update', pg_temp.r7_get('high_target'))));
  perform pg_temp.r7_note('a6_low_before', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('low_target'))));
  perform pg_temp.r7_send('b', 'many-high');
  perform pg_temp.r7_note('a6_high_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('a6_low_while_waiting_high', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('low_target'))));
  perform pg_temp.r7_note('a6_low_assignment_while_waiting_high', pg_temp.r7_row_locked('p', 'platform_private.cms_entry_assignments', format('entry_id = %L::uuid', pg_temp.r7_get('low_target'))));
  perform pg_temp.r7_note('a6_h_high_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('a6_b_high', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('a6_h_low', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_content_entries where id = %L::uuid for update', pg_temp.r7_get('low_target'))));
  perform pg_temp.r7_send('b', 'many-low');
  perform pg_temp.r7_note('a6_low_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('a6_high_while_waiting_low', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('high_target'))));
  perform pg_temp.r7_note('a6_h_low_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('a6_b_low', pg_temp.r7_collect('b'));

  -- ---- A4: a revocation of the author grant is in flight; the create re-proves the capability under the position 1 lock
  perform pg_temp.r7_note('a4_entries_before', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a4_r', pg_temp.r7_hold_raw('h', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r8_grant_where('cms.author'))));
  perform pg_temp.r7_send('b', 's4create');
  perform pg_temp.r7_note('a4_blocked_by_r', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('a4_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('a4_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('a4_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a4_reserved', pg_temp.r8_reserved('r8-s4create'));
  perform pg_temp.r7_note('a4_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r8_grant_where('cms.author'))));

  -- ---- A1: a schema activation (real command, held open) owns position 1; the create waits, then the exact schema is superseded
  perform pg_temp.r7_note('a1_entries_before', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a1_h', pg_temp.r7_hold('h', 'actsucc'));
  perform pg_temp.r7_send('b', 's1create');
  perform pg_temp.r7_note('a1_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('a1_pos2', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('target'))));
  perform pg_temp.r7_note('a1_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('a1_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('a1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('a1_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('a1_reserved', pg_temp.r8_reserved('r8-s1create'));
  perform pg_temp.r7_note('a1_states', pg_temp.r8_version_states());

  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('a3=' || coalesce(pg_temp.r7_get('a3_b'), '?') || ' | a5=' || coalesce(pg_temp.r7_get('a5_b'), '?') || ' | a4=' || coalesce(pg_temp.r7_get('a4_b'), '?') || ' | a1=' || coalesce(pg_temp.r7_get('a1_b'), '?'));
select pg_temp.r7_diag('succ_steps=' || coalesce(pg_temp.r7_get('succ_steps'), '?') || ' | actsucc_request=' || coalesce(pg_temp.r7_get('actsucc_request'), '?'));
select pg_temp.r7_diag('a1_h=' || left(coalesce(pg_temp.r7_get('a1_h'), '?'), 300));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every create scenario without an error of its own [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('world_premises_failed'), '0/0', 'the committed create world built with no failed fixture assertion and no failed premise [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('e2_create_state'), '00000', 'fixture: the concealed target (an entry of another content type) was created by the real command [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('entries_before'), '0', 'fixture: the bound content type holds no entry before the scenarios [P2-S12-AC-294]');

-- A3: position 2, the pinned target version
select pg_temp.r7_ok(pg_temp.r7_get('a3_h') like 'ok:%' and pg_temp.r7_get('a3_target_version_held') = '1',
  'fixture: the target is being bumped by a real revision append that stays open; the committed target version is still 1 [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a3_blocked_by_h'), 'true',
  'the create naming the target with expectedTargetVersion 1 is observed blocked BY the open revision append on the target entry (position 2) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a3_pos3') || '/' || pg_temp.r7_get('a3_pos4'), '00000/00000',
  'while the create waits at the relation target (position 2) it holds neither the default template row (3) nor the content type version row (4): position 2 is never acquired after 3 or 4 [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a3_b'), 'P0001:VALIDATION_FAILED|["/fields/' || pg_temp.r7_get('relation_field') || '"]',
  'the pinned target version is decided after the wait: the bumped target is the uniform VALIDATION_FAILED at /fields/{relation field} [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a3_target_version_after') = '2' and pg_temp.r7_get('a3_entries_after') = pg_temp.r7_get('entries_before') and pg_temp.r7_get('a3_reserved') = '0',
  'the refused create wrote nothing: the bump committed (target version 2), no entry exists and the Idempotency-Key holds no record [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a3_control') like 'ok:%' and pg_temp.r7_get('a3_control_pin') = 'ok:' || pg_temp.r7_get('template'),
  'control: the same create pinned to the new target version succeeds and records the exact default template as its first pin (rolled back afterwards) [P2-S12-AC-294]');

-- A5: no lock lever
select pg_temp.r7_is(pg_temp.r7_get('a5_held'), '55P03', 'fixture: a holder owns the entry row of the concealed target FOR UPDATE [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a5_b'), 'P0001:VALIDATION_FAILED|["/fields/' || pg_temp.r7_get('relation_field') || '"]',
  'a create naming a concealed target answers the uniform VALIDATION_FAILED while the holder still owns the target''s entry row: no lock is taken on it, no lock lever [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a5_absent'), pg_temp.r7_get('a5_b'),
  'a concealed target and an absent target id are refused with the identical outcome: no existence oracle [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a5_entries_after'), pg_temp.r7_get('a5_entries_before'), 'the concealed-target refusals wrote no entry [P2-S12-AC-294]');

select pg_temp.r7_diag('a6_b_high=' || left(coalesce(pg_temp.r7_get('a6_b_high'), '?'), 300) || ' | a6_b_low=' || left(coalesce(pg_temp.r7_get('a6_b_low'), '?'), 300));
-- A6: ascending order of the position 2 set
select pg_temp.r7_is(pg_temp.r7_get('t2_create_state') || '/' || pg_temp.r7_get('many_active') || '/' || pg_temp.r7_get('a6_h_high') || '/' || pg_temp.r7_get('a6_low_before'), '00000/active/00000/00000',
  'fixture: a content type with a two-target relation is active, a second article target exists, and the holder of the HIGHER target id owns it while the lower one is free [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a6_high_blocked_by_h'), 'true', 'a create naming two targets is observed blocked BY the holder of the higher-id target (position 2) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a6_low_while_waiting_high') || '/' || pg_temp.r7_get('a6_low_assignment_while_waiting_high'), '55P03/55P03',
  'while it waits for the higher-id target the create already holds the lower-id target entry row and the caller''s assignment rows on it: the set is locked in ascending id order [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a6_b_high') like 'ok:%', 'once the higher-id holder releases the create completes [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a6_low_blocked_by_h'), 'true', 'a create naming the same two targets is observed blocked BY the holder of the lower-id target (position 2) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a6_high_while_waiting_low'), '00000',
  'while it waits for the lower-id target the create has not yet touched the higher-id target: no later id is locked before an earlier one [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a6_b_low') like 'ok:%', 'once the lower-id holder releases the create completes [P2-S12-AC-294]');

-- A4: authority
select pg_temp.r7_is(pg_temp.r7_get('a4_r'), '00000', 'fixture: a revocation of the author grant is in flight (updated, not committed) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a4_blocked_by_r'), 'true', 'a create arriving while the revocation is in flight waits for the revoking transaction (position 1) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a4_b'), 'P0001:FORBIDDEN',
  'the capability is re-proved under the position 1 lock after the wait: a revocation committed first wins, the create is FORBIDDEN [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a4_entries_after') = pg_temp.r7_get('a4_entries_before') and pg_temp.r7_get('a4_reserved') = '0',
  'the create refused after the revocation wrote no entry and left no Idempotency-Key record [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a4_restore'), '00000', 'cleanup: the author grant is restored before the next scenario [P2-S12-AC-294]');

-- A1: exact schema
select pg_temp.r7_ok(pg_temp.r7_get('a1_h') like 'ok:%' and pg_temp.r7_get('succ_state_in_world') = 'approved',
  'fixture: the approved successor schema is being activated by the real command, which stays open [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a1_blocked_by_h'), 'true', 'a create of the superseded-to-be schema arriving during the activation is observed blocked BY it [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a1_pos2') || '/' || pg_temp.r7_get('a1_pos3'), '00000/00000',
  'while the create waits behind the activation it has taken neither the relation target (2) nor the default template (3) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a1_b'), 'P0001:VALIDATION_FAILED|["/contentTypeVersionId"]',
  'the exact schema is rechecked after the wait: the activation won, so the create is refused at /contentTypeVersionId [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('a1_entries_after') = pg_temp.r7_get('a1_entries_before') and pg_temp.r7_get('a1_reserved') = '0',
  'the refused create stored no entry, no unlocked replacement pin and no Idempotency-Key record [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('a1_states'), 'active,superseded,superseded',
  'the activation committed: the bound content type has one active version, the successor, and two superseded ones [P2-S12-AC-294]');

-- cleanup
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-294]');
select * from pg_temp.r7_finish();
