-- Slice 12 race9: a create whose relation target becomes UNASSIGNED while it waits (lane claude_s12_db9a; BE03b "Write-path lock order and authority fencing" rule 2:
-- "a target bumped, archived or unassigned between check and use is observed (the writer is refused with the same uniform refusal)"; DEC-143 migration 20261005011300
-- revokes the person's entry assignments in the same transaction as the grant or tenure end; refute8 REACHABILITY CORRECTION; tracker P2-S12-AC-294).
-- The caller (designer2) creates with cms.author; both relation targets T2 and T3 are visible to it ONLY through its cms.editor grant plus its cms.editor assignment.
--   U0  control: the same create succeeds while both are visible (held, then rolled back)
--   U2  an assignment-level revocation (the row write the migration's seam performs, held open as a stand-in: no command revokes a single assignment) owns T3's
--       editor assignment: the create is observed blocked BY it at POSITION 2 (it already holds T3's entry row, not yet the template (3) or the content type version (4));
--       after the release the second recheck finds T3 invisible: uniform VALIDATION_FAILED at /fields/{relation field}, nothing written
--   U1  the REAL CMS-03A-17 revocation of designer2's editor grant (`platform_api.cms_revoke_capability_grant`, held open): the create is observed blocked BY it,
--       at the authority rows (the revocation owns the grant row, which every write path share-locks at position 1), holding no position 2 / 3 / 4 lock; after the
--       commit (which also revoked the assignment, DEC-143) the create answers the same uniform VALIDATION_FAILED, nothing written
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc
\ir phase_02_slice_12_race8/030-create-helpers.sqlinc

create or replace function pg_temp.r9_assignments(p_entry text) returns text language sql stable as $b$
  select coalesce((select string_agg(capability_key || ':' || state, ',' order by capability_key) from platform_private.cms_entry_assignments
    where entry_id = p_entry::uuid and assignee_person_id = pg_temp.r7_get('designer_person')::uuid), '') $b$;
create or replace function pg_temp.r9_visible(p_entry text) returns text language sql stable as $b$
  select platform_private.cms_relation_target_visible(pg_temp.r7_get('designer_auth')::uuid, pg_temp.r7_get('owner_org')::uuid, p_entry::uuid, 'article')::text $b$;
create or replace function pg_temp.r9_grants() returns text language sql stable as $b$
  select string_agg(capability_code || ':' || active::text, ',' order by capability_code) from identity_private.organization_actor_grant
   where organization_id = pg_temp.r7_get('owner_org')::uuid and person_id = pg_temp.r7_get('designer_person')::uuid and capability_code in ('cms.author', 'cms.editor') $b$;

-- The row a blocked session is waiting on, from the live lock manager: a waiter on a row lock holds the heavyweight `tuple` lock of that row (relation, page, offset); the
-- tuple is resolved to a readable key for the two relations of this file.  '' when the session holds no tuple lock.
create or replace function pg_temp.r9_wait_tuple(p_conn text) returns text language plpgsql volatile as $b$
declare r record; out text := ''; key text;
begin
  for r in select l.relation::regclass::text as rel, l.page, l.tuple from pg_catalog.pg_locks l
            where l.pid = pg_temp.r7_pid(p_conn) and l.locktype = 'tuple' order by 1, 2, 3 loop
    key := '?';
    if r.rel = 'identity_private.organization_actor_grant' then
      execute format('select capability_code || ''/'' || person_id::text from identity_private.organization_actor_grant where ctid = %L::tid', format('(%s,%s)', r.page, r.tuple)) into key;
    elsif r.rel = 'platform_private.cms_entry_assignments' then
      execute format('select capability_key || ''/'' || entry_id::text from platform_private.cms_entry_assignments where ctid = %L::tid', format('(%s,%s)', r.page, r.tuple)) into key;
    end if;
    out := out || r.rel || ':' || coalesce(key, '?') || ';';
  end loop;
  return out;
end;
$b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race9/020-unassigned-world.sqlinc
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

  -- ---- U0: control, the create succeeds while the targets are visible (rolled back, so the bound content type stays empty)
  perform pg_temp.r7_note('u0_h', pg_temp.r7_hold('h', 'u0'));
  perform pg_temp.r7_note('u0_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('u0_entries_after', pg_temp.r8_bound_entries());

  -- ---- U2: an assignment-level revocation in flight owns T3's editor assignment; the create waits at position 2
  perform pg_temp.r7_note('u2_h', pg_temp.r7_hold_raw('h', format(
    'update platform_private.cms_entry_assignments set state = ''revoked'', version = version + 1, updated_at = pg_catalog.clock_timestamp() where entry_id = %L::uuid and assignee_person_id = %L::uuid and capability_key = ''cms.editor''',
    pg_temp.r7_get('t3'), pg_temp.r7_get('designer_person'))));
  perform pg_temp.r7_note('u2_pos2_before', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('t3'))));
  perform pg_temp.r7_send('b', 'u2');
  perform pg_temp.r7_note('u2_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('u2_waits_for', coalesce(pg_temp.r7_waiting_for('b'), '-'));
  perform pg_temp.r7_note('u2_wait_tuple', pg_temp.r9_wait_tuple('b'));
  perform pg_temp.r7_note('u2_pos2', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('t3'))));
  perform pg_temp.r7_note('u2_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('u2_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version'))));
  perform pg_temp.r7_note('u2_visible_during', pg_temp.r9_visible(pg_temp.r7_get('t3')));
  perform pg_temp.r7_note('u2_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('u2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('u2_visible_after', pg_temp.r9_visible(pg_temp.r7_get('t3')));
  perform pg_temp.r7_note('u2_assignments_after', pg_temp.r9_assignments(pg_temp.r7_get('t3')));
  perform pg_temp.r7_note('u2_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('u2_reserved', pg_temp.r8_reserved('r9-u2-key'));

  -- ---- U1: the REAL authority revocation (CMS-03A-17) in flight; the create waits behind it
  perform pg_temp.r7_note('u1_h', pg_temp.r7_hold('h', 'revoke_editor'));
  perform pg_temp.r7_send('b', 'u1');
  perform pg_temp.r7_note('u1_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('u1_waits_for', coalesce(pg_temp.r7_waiting_for('b'), '-'));
  perform pg_temp.r7_note('u1_wait_tuple', pg_temp.r9_wait_tuple('b'));
  perform pg_temp.r7_note('u1_pos2', pg_temp.r7_row_locked('p', 'platform_private.cms_content_entries', format('id = %L::uuid', pg_temp.r7_get('t2'))));
  perform pg_temp.r7_note('u1_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', pg_temp.r7_get('template'))));
  perform pg_temp.r7_note('u1_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', pg_temp.r7_get('bound_version'))));
  perform pg_temp.r7_note('u1_visible_during', pg_temp.r9_visible(pg_temp.r7_get('t2')));
  perform pg_temp.r7_note('u1_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('u1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('u1_visible_after', pg_temp.r9_visible(pg_temp.r7_get('t2')));
  perform pg_temp.r7_note('u1_assignments_after', pg_temp.r9_assignments(pg_temp.r7_get('t2')));
  perform pg_temp.r7_note('u1_grants_after', pg_temp.r9_grants());
  perform pg_temp.r7_note('u1_entries_after', pg_temp.r8_bound_entries());
  perform pg_temp.r7_note('u1_reserved', pg_temp.r8_reserved('r9-u1-key'));

  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['b', 'h', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_diag('u0_h=' || left(coalesce(pg_temp.r7_get('u0_h'), '?'), 300) || ' | u2_h=' || coalesce(pg_temp.r7_get('u2_h'), '?') || ' | u2_b=' || left(coalesce(pg_temp.r7_get('u2_b'), '?'), 300) || ' | u1_h=' || left(coalesce(pg_temp.r7_get('u1_h'), '?'), 200) || ' | u1_b=' || left(coalesce(pg_temp.r7_get('u1_b'), '?'), 300));
select pg_temp.r7_diag('world: grants=' || coalesce(pg_temp.r7_get('grants'), '?') || ' t2_asg=' || coalesce(pg_temp.r7_get('t2_assignments'), '?') || ' t3_asg=' || coalesce(pg_temp.r7_get('t3_assignments'), '?') || ' vis=' || coalesce(pg_temp.r7_get('visible_t2'), '?') || '/' || coalesce(pg_temp.r7_get('visible_t3'), '?'));
select pg_temp.r7_diag('wait tuples: u2=' || coalesce(pg_temp.r7_get('u2_wait_tuple'), '?') || ' u1=' || coalesce(pg_temp.r7_get('u1_wait_tuple'), '?'));
select pg_temp.r7_diag('waits: u2=' || coalesce(pg_temp.r7_get('u2_waits_for'), '?') || ' u1=' || coalesce(pg_temp.r7_get('u1_waits_for'), '?') || ' | pos u2 ' || coalesce(pg_temp.r7_get('u2_pos2'), '?') || '/' || coalesce(pg_temp.r7_get('u2_pos3'), '?') || '/' || coalesce(pg_temp.r7_get('u2_pos4'), '?') || ' u1 ' || coalesce(pg_temp.r7_get('u1_pos2'), '?') || '/' || coalesce(pg_temp.r7_get('u1_pos3'), '?') || '/' || coalesce(pg_temp.r7_get('u1_pos4'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every unassigned-target scenario without an error of its own [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed') || '/' || pg_temp.r7_get('world_premises_failed'), '0/0', 'the committed create world built with no failed fixture assertion and no failed premise [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('editor_grant') || '/' || pg_temp.r7_get('author_grant') || '/' || pg_temp.r7_get('t2_state') || '/' || pg_temp.r7_get('t3_state'), 'OK/OK/00000/00000',
  'fixture: the caller holds cms.editor (granted first by the real command) and cms.author (granted after) and created both targets through the real create command [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('grants') = 'cms.author:true,cms.editor:true' and pg_temp.r7_get('t2_assignments') = 'cms.editor:active' and pg_temp.r7_get('t3_assignments') = 'cms.editor:active'
    and pg_temp.r7_get('visible_t2') = 'true' and pg_temp.r7_get('visible_t3') = 'true',
  'fixture: the caller''s own capability for a create is cms.author, yet both targets are visible to it only through the editor grant and an editor assignment (no author assignment on either) [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('u0_h') like 'ok:%' and pg_temp.r7_get('u0_entries_after') = pg_temp.r7_get('entries_before'),
  'control: while both targets are visible the same create succeeds (rolled back afterwards, so no entry remains) [P2-S12-AC-294]');

-- U2
select pg_temp.r7_ok(pg_temp.r7_get('u2_h') = '00000' and pg_temp.r7_get('u2_pos2_before') = '00000' and pg_temp.r7_get('u2_visible_during') = 'true',
  'fixture: an uncommitted revocation of the caller''s editor assignment on T3 is in flight; T3''s entry row is free and T3 is still visible on the committed state [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u2_blocked_by_h'), 'true', 'a create naming T3 is observed blocked BY the assignment revocation in flight (the caller''s assignment rows over the target) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u2_wait_tuple'), 'platform_private.cms_entry_assignments:cms.editor/' || pg_temp.r7_get('t3') || ';',
  'the lock the create waits on is the caller''s cms.editor assignment row over T3 (pg_locks tuple), the authority row it locks at position 2 after the target entry row [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u2_pos2') || '/' || pg_temp.r7_get('u2_pos3') || '/' || pg_temp.r7_get('u2_pos4'), '55P03/00000/00000',
  'while it waits the create already holds the relation target entry row (position 2) and has taken neither the default template (3) nor the content type version (4): no late position 2 [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u2_b'), 'P0001:VALIDATION_FAILED|["/fields/' || pg_temp.r7_get('relation_field') || '"]',
  'the target is rechecked after the wait: once the assignment is revoked the create is the uniform VALIDATION_FAILED at /fields/{relation field} [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('u2_visible_after') = 'false' and pg_temp.r7_get('u2_assignments_after') = 'cms.editor:revoked',
  'the revocation committed: the target is no longer visible to the caller although the caller still holds cms.author and cms.editor grants [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('u2_entries_after') = pg_temp.r7_get('entries_before') and pg_temp.r7_get('u2_reserved') = '0',
  'the refused create wrote nothing: no entry exists and the Idempotency-Key holds no record [P2-S12-AC-294]');

-- U1
select pg_temp.r7_ok(pg_temp.r7_get('u1_h') like 'ok:%' and pg_temp.r7_get('u1_visible_during') = 'true',
  'fixture: the real CMS-03A-17 revocation of the caller''s cms.editor grant is open and uncommitted; T2 is still visible on the committed state [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u1_blocked_by_h'), 'true', 'a create naming T2 is observed blocked BY the real authority revocation in flight [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u1_wait_tuple'), 'identity_private.organization_actor_grant:cms.editor/' || pg_temp.r7_get('designer_person') || ';',
  'the lock the create waits on is the revoked grant itself: its row lock, read from pg_locks, is the tuple of identity_private.organization_actor_grant at the caller''s cms.editor projection row, the authority row every write path share-locks at position 1 [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u1_pos2') || '/' || pg_temp.r7_get('u1_pos3') || '/' || pg_temp.r7_get('u1_pos4'), '00000/00000/00000',
  'while it waits behind the real revocation the create holds no later position: not the relation target entry row (2), the default template (3) or the content type version (4) [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('u1_b'), 'P0001:VALIDATION_FAILED|["/fields/' || pg_temp.r7_get('relation_field') || '"]',
  'after the real revocation commits, the create whose own capability is cms.author answers the uniform VALIDATION_FAILED at /fields/{relation field} [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('u1_visible_after') = 'false' and pg_temp.r7_get('u1_assignments_after') = 'cms.editor:revoked' and pg_temp.r7_get('u1_grants_after') = 'cms.author:true,cms.editor:false',
  'the real revocation committed the grant end and the same-transaction assignment revocation (DEC-143): the caller keeps cms.author and the target is invisible [P2-S12-AC-294]');
select pg_temp.r7_ok(pg_temp.r7_get('u1_entries_after') = pg_temp.r7_get('entries_before') and pg_temp.r7_get('u1_reserved') = '0',
  'the create refused after the real revocation wrote no entry and left no Idempotency-Key record [P2-S12-AC-294]');

select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-294]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-294]');
select * from pg_temp.r7_finish();
