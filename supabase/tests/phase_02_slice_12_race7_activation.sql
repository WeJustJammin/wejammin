-- Slice 12 race7: CMS-03C-09 governed activation under REAL concurrency (lane claude_s12_race7; BE03c "Slice 12 lock order" 1500-1530 rows
-- CMS-03C-09, rules 1, 3 and 4 and the activation steps 1490; tracker P2-S12-AC-085, AC-086, AC-205, AC-276).
-- Two or more independent sessions (dblink; the precedent of phase_02_slice_09_schema/000b-activation-lock.sqlinc) drive the REAL command
-- platform_api.cms_activate_governed_subject under the real service_role against REAL approved governed reviews (the governed-b world, committed);
-- the harness (phase_02_slice_12_race7/000-harness.sqlinc) removes everything the world and the scenarios added.  The command under test is the
-- lock holder wherever it can be (an open transaction), so no lock is forged.
--   S1  two approved versions of one lineage with NO active version race: the first (held open) takes the lineage advisory lock last, the second
--       is observed blocked ON THAT ADVISORY LOCK, the first commits, the second answers P0001 activation_conflict and changes nothing; the same
--       request (same Idempotency-Key) then succeeds and supersedes the first                                              [AC-086, AC-205]
--   S2  a holder owns the REVIEW row (position 5): the command is observed blocked there while it already holds positions 1, 3 and 4 and not yet
--       the advisory lock (position order); a lock-acquisition failure (lock_timeout) is the retryable CONFLICT with nothing committed and the
--       same request then succeeds                                                                                       [AC-085, AC-276]
--   S3  a holder owns the lineage ADVISORY lock: the command is blocked on it only after the review row (position 5) and the subject row, the
--       content type version and the authority rows are held                                                              [AC-085]
--   S4  capability re-proved under the position 1 lock: a revocation committing first wins (403-class capability_missing, nothing written); a
--       revocation that arrives while the activation holds the authority rows waits and commits after it                    [AC-276]
--   S5  a real lock cycle (holder: review row then subject row; command: subject row then review row): PostgreSQL's deadlock_detected is
--       converted to the retryable CONFLICT, nothing is committed and the same Idempotency-Key then succeeds                  [AC-276]
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc

-- scoped images (session functions: they outlive the world transaction)
create or replace function pg_temp.r7_img(p_review uuid) returns text language sql stable as $b$
  select pg_catalog.md5(pg_catalog.jsonb_build_object(
    'review', (select pg_catalog.to_jsonb(r) from platform_private.cms_governed_reviews r where r.id = p_review),
    'subject', (select pg_catalog.to_jsonb(t) from platform_private.cms_template_versions t
                 where t.id = (select r.subject_id from platform_private.cms_governed_reviews r where r.id = p_review)),
    'decisions', (select pg_catalog.count(*) from platform_private.cms_governed_review_decisions d where d.review_id = p_review))::text) $b$;
create or replace function pg_temp.r7_stores() returns text language sql stable as $b$
  select 'audit=' || (select count(*) from audit_private.audit_events) || ' outbox=' || (select count(*) from platform_private.outbox_events)
    || ' idem=' || (select count(*) from platform_private.idempotency_records) $b$;
create or replace function pg_temp.r7_states(p_lineage uuid) returns text language sql stable as $b$
  select coalesce(pg_catalog.string_agg(state::text, ',' order by version), '') from platform_private.cms_template_versions where template_id = p_lineage $b$;
create or replace function pg_temp.r7_state_of(p_subject uuid) returns text language sql stable as $b$
  select state::text from platform_private.cms_template_versions where id = p_subject $b$;
create or replace function pg_temp.r7_lock_key(p_lineage uuid) returns text language sql stable as $b$
  select platform_private.cms_governed_lineage_lock_key('template_version', p_lineage)::text $b$;
create or replace function pg_temp.r7_grant_active() returns text language sql stable as $b$
  select active::text from identity_private.organization_actor_grant
   where organization_id = pg_temp.r7_get('owner_org')::uuid and person_id = pg_temp.r7_get('owner_person')::uuid
     and capability_code = 'cms.template_designer' $b$;
create or replace function pg_temp.r7_grant_where() returns text language sql stable as $b$
  select format('organization_id = %L::uuid and person_id = %L::uuid and capability_code = ''cms.template_designer''',
    pg_temp.r7_get('owner_org'), pg_temp.r7_get('owner_person')) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_12_race7/010-governed-world.sqlinc
-- S1: lineage L with two approved versions and no active one (rl2 is a real CMS-03C-01 successor of rl1)
select pg_temp.s12gb_approved('rl1');
select pg_temp.s12gb_successor('rl2', 'rl1', array['typeA']);
select pg_temp.s12gb_approve('rl2');
-- S2 / S3 / S4 / S5: one approved review each, each in its own lineage
select pg_temp.s12gb_approved('ro1');
select pg_temp.s12gb_approved('ro2');
select pg_temp.s12gb_approved('rc1');
select pg_temp.s12gb_approved('rc2');
select pg_temp.s12gb_approved('rd1');
select pg_temp.r7_stash_act(t) from unnest(array['rl1', 'rl2', 'ro1', 'ro2', 'rc1', 'rc2', 'rd1']) t;
select pg_temp.r7_stash_copy('act:ro1:lt', 'act:ro1', '{"lock_timeout": "4s"}'::jsonb);
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
select pg_temp.r7_note('world_reviews_approved', (select count(*)::text from platform_private.cms_governed_reviews where state = 'approved'));
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare
  review_ro1 uuid; review_ro2 uuid; subject_ro1 uuid; subject_ro2 uuid; type_version uuid; owner_org text; owner_person text;
  lineage_l uuid; lineage_ro2 uuid; subject_rl2 uuid; c text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  review_ro1 := pg_temp.r7_get('review:ro1')::uuid; review_ro2 := pg_temp.r7_get('review:ro2')::uuid;
  subject_ro1 := pg_temp.r7_get('subject:ro1')::uuid; subject_ro2 := pg_temp.r7_get('subject:ro2')::uuid;
  type_version := pg_temp.r7_get('type_version_a')::uuid;
  owner_org := pg_temp.r7_get('owner_org'); owner_person := pg_temp.r7_get('owner_person');
  lineage_l := pg_temp.r7_get('lineage:rl1')::uuid; lineage_ro2 := pg_temp.r7_get('lineage:ro2')::uuid;
  subject_rl2 := pg_temp.r7_get('subject:rl2')::uuid;
  for c in select unnest(array['a', 'b', 'h', 'r', 'p']) loop perform pg_temp.r7_conn(c); end loop;

  -- ---- S1: the lost race on a lineage with no active version
  perform pg_temp.r7_note('s1_lineage_before', pg_temp.r7_states(lineage_l));
  perform pg_temp.r7_note('s1_img_before', pg_temp.r7_img(pg_temp.r7_get('review:rl2')::uuid));
  perform pg_temp.r7_note('s1_a', pg_temp.r7_hold('a', 'act:rl1'));
  perform pg_temp.r7_send('b', 'act:rl2');
  perform pg_temp.r7_note('s1_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('s1_b_waits_for', pg_temp.r7_waiting_for('b'));
  perform pg_temp.r7_note('s1_lock_probe', pg_temp.r7_advisory_probe('p', pg_temp.r7_lock_key(lineage_l)));
  perform pg_temp.r7_note('s1_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('s1_stores_after_a', pg_temp.r7_stores());
  perform pg_temp.r7_note('s1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('s1_stores_after_b', pg_temp.r7_stores());
  perform pg_temp.r7_note('s1_img_after', pg_temp.r7_img(pg_temp.r7_get('review:rl2')::uuid));
  perform pg_temp.r7_note('s1_lineage_after_b', pg_temp.r7_states(lineage_l));
  perform pg_temp.r7_note('s1_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('act:rl2')));
  perform pg_temp.r7_note('s1_lineage_after_retry', pg_temp.r7_states(lineage_l));

  -- ---- S2: a holder owns the review row (position 5); a lock-acquisition failure is the retryable CONFLICT
  perform pg_temp.r7_note('s2_img_before', pg_temp.r7_img(review_ro1));
  perform pg_temp.r7_note('s2_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('s2_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_governed_reviews where id = %L::uuid for update', review_ro1)));
  perform pg_temp.r7_send('b', 'act:ro1:lt');
  perform pg_temp.r7_note('s2_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('s2_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('s2_probe_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', subject_ro1)));
  perform pg_temp.r7_note('s2_probe_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', type_version)));
  perform pg_temp.r7_note('s2_probe_advisory', pg_temp.r7_advisory_probe('p', pg_temp.r7_lock_key(pg_temp.r7_get('lineage:ro1')::uuid)));
  perform pg_temp.r7_note('s2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('s2_img_after', pg_temp.r7_img(review_ro1));
  perform pg_temp.r7_note('s2_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('s2_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('s2_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('act:ro1')));
  perform pg_temp.r7_note('s2_state_after_retry', pg_temp.r7_state_of(subject_ro1));

  -- ---- S3: a holder owns the lineage advisory lock; the command reaches it only after positions 1, 3, 4 and 5
  perform pg_temp.r7_note('s3_h', pg_temp.r7_hold_raw('h', format('perform pg_advisory_xact_lock(%s)', pg_temp.r7_lock_key(lineage_ro2))));
  perform pg_temp.r7_send('b', 'act:ro2');
  perform pg_temp.r7_note('s3_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('s3_b_waits_for', pg_temp.r7_waiting_for('b'));
  perform pg_temp.r7_note('s3_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('s3_probe_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_template_versions', format('id = %L::uuid', subject_ro2)));
  perform pg_temp.r7_note('s3_probe_pos4', pg_temp.r7_row_locked('p', 'platform_private.cms_content_type_versions', format('id = %L::uuid', type_version)));
  perform pg_temp.r7_note('s3_probe_pos5', pg_temp.r7_row_locked('p', 'platform_private.cms_governed_reviews', format('id = %L::uuid', review_ro2)));
  perform pg_temp.r7_note('s3_h_end', pg_temp.r7_end('h'));
  perform pg_temp.r7_note('s3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('s3_state_after', pg_temp.r7_state_of(subject_ro2));

  -- ---- S4: capability re-proved under the position 1 lock
  -- (a) the activation (held open) owns the authority rows FOR SHARE: a revocation waits, then commits after the activation
  perform pg_temp.r7_note('s4a_a', pg_temp.r7_hold('a', 'act:rc1'));
  perform pg_temp.r7_send_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_grant_where()));
  perform pg_temp.r7_note('s4a_r_blocked_by_a', pg_temp.r7_blocked_by('r', 'a')::text);
  perform pg_temp.r7_note('s4a_grant_while_waiting', pg_temp.r7_grant_active());
  perform pg_temp.r7_note('s4a_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('s4a_r', pg_temp.r7_collect('r'));
  perform pg_temp.r7_note('s4a_state', pg_temp.r7_state_of(pg_temp.r7_get('subject:rc1')::uuid));
  perform pg_temp.r7_note('s4a_grant_after', pg_temp.r7_grant_active());
  perform pg_temp.r7_note('s4a_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_grant_where())));
  -- (b) a revocation in flight (uncommitted) owns the grant row: the activation waits, then re-proves the capability and is refused
  perform pg_temp.r7_note('s4b_img_before', pg_temp.r7_img(pg_temp.r7_get('review:rc2')::uuid));
  perform pg_temp.r7_note('s4b_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('s4b_r', pg_temp.r7_hold_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_grant_where())));
  perform pg_temp.r7_send('b', 'act:rc2');
  perform pg_temp.r7_note('s4b_b_blocked_by_r', pg_temp.r7_blocked_by('b', 'r')::text);
  perform pg_temp.r7_note('s4b_r_commit', pg_temp.r7_end('r'));
  perform pg_temp.r7_note('s4b_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('s4b_img_after', pg_temp.r7_img(pg_temp.r7_get('review:rc2')::uuid));
  perform pg_temp.r7_note('s4b_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('s4b_state', pg_temp.r7_state_of(pg_temp.r7_get('subject:rc2')::uuid));
  perform pg_temp.r7_note('s4b_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_grant_where())));
  perform pg_temp.r7_note('s4_grant_restored', pg_temp.r7_grant_active());

  -- ---- S5: a real lock cycle; deadlock_detected is the retryable CONFLICT
  perform pg_temp.r7_note('s5_img_before', pg_temp.r7_img(pg_temp.r7_get('review:rd1')::uuid));
  perform pg_temp.r7_note('s5_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('s5_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_governed_reviews where id = %L::uuid for update', pg_temp.r7_get('review:rd1'))));
  perform pg_temp.r7_send('b', 'act:rd1');
  perform pg_temp.r7_note('s5_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_send_raw('h', format('select id::text from platform_private.cms_template_versions where id = %L::uuid for update', pg_temp.r7_get('subject:rd1')));
  perform pg_temp.r7_note('s5_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('s5_h_got_subject', pg_temp.r7_collect('h'));
  perform pg_temp.r7_note('s5_img_after', pg_temp.r7_img(pg_temp.r7_get('review:rd1')::uuid));
  perform pg_temp.r7_note('s5_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('s5_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('s5_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('act:rd1')));
  perform pg_temp.r7_note('s5_state_after_retry', pg_temp.r7_state_of(pg_temp.r7_get('subject:rd1')::uuid));

  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'r', 'p']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'r', 'p']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?') || ' restore_error=' || coalesce(pg_temp.r7_get('restore_error'), '-'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every activation scenario without an error of its own [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed governed world built with no failed fixture assertion [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('world_reviews_approved'), '7', 'fixture: seven real APPROVED governed reviews exist before the scenarios [P2-S12-AC-086]');

-- S1
select pg_temp.r7_is(pg_temp.r7_get('s1_lineage_before'), 'approved,approved',
  'fixture: the lineage holds two approved versions and no active one before the race [P2-S12-AC-086]');
select pg_temp.r7_ok(pg_temp.r7_get('s1_a') like 'ok:%' and (substr(pg_temp.r7_get('s1_a'), 4)::jsonb)->>'subjectState' = 'active',
  'the first activator of the lineage commits (held open until the second is waiting) [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('s1_b_blocked_by_a'), 'true',
  'the second activator of the lineage is observed blocked BY the first in the live lock manager [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('s1_b_waits_for'), 'advisory',
  'the second activator waits for the lineage ADVISORY lock, the last position, and not for a row [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('s1_lock_probe'), '55P03',
  'the lineage advisory lock (the CMS-03C-19 key) is held by the first activator while the second waits [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('s1_b'), 'P0001:activation_conflict',
  'the activation that loses a race on the lineage answers P0001 activation_conflict (409 at the Worker) [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('s1_b'), 'P0001:activation_conflict',
  'an activation that loses a race on the lineage is 409 activation_conflict: the loser answers P0001 activation_conflict [P2-S12-AC-205]');
select pg_temp.r7_is(pg_temp.r7_get('s1_img_after'), pg_temp.r7_get('s1_img_before'),
  'the loser changed nothing: its subject, its review and its decisions are byte-identical to before the race [P2-S12-AC-205]');
select pg_temp.r7_is(pg_temp.r7_get('s1_stores_after_b'), pg_temp.r7_get('s1_stores_after_a'),
  'the loser wrote no audit, outbox or idempotency row: the stores equal what the winner left [P2-S12-AC-205]');
select pg_temp.r7_is(pg_temp.r7_get('s1_lineage_after_b'), 'active,approved',
  'after the lost race the lineage keeps exactly one active version, the winner, and no partial switch [P2-S12-AC-086]');
select pg_temp.r7_ok(pg_temp.r7_get('s1_retry') like 'ok:%' and (substr(pg_temp.r7_get('s1_retry'), 4)::jsonb)->>'subjectState' = 'active',
  'the loser''s identical request (same Idempotency-Key) is reusable: it then activates and supersedes the winner [P2-S12-AC-205]');
select pg_temp.r7_is(pg_temp.r7_get('s1_lineage_after_retry'), 'superseded,active',
  'the retry leaves exactly one active version (the previous active one is superseded in the same transaction) [P2-S12-AC-205]');

-- S2
select pg_temp.r7_is(pg_temp.r7_get('s2_h'), '00000', 'fixture: the holder owns the governed review row FOR UPDATE (position 5) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_b_blocked_by_h'), 'true',
  'CMS-03C-09 activate is observed blocked BY the review row holder, the position 5 lock [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_probe_pos1'), '55P03',
  'while blocked at the review row the activation already holds the owner-capability grant rows (position 1) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_probe_pos3'), '55P03',
  'while blocked at the review row the activation already holds the subject version row (position 3) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_probe_pos4'), '55P03',
  'while blocked at the review row the activation already holds the bound content type version row (position 4) [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_probe_advisory'), '00000',
  'while blocked at the review row the activation does not yet hold the lineage advisory lock, which is taken last [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s2_b'), 'P0001:CONFLICT',
  'a lock-acquisition failure (lock_timeout) at the review row is the retryable P0001 CONFLICT of the operation [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s2_img_after') = pg_temp.r7_get('s2_img_before') and pg_temp.r7_get('s2_stores_after') = pg_temp.r7_get('s2_stores_before'),
  'the lock failure committed nothing: review, subject, audit, outbox and idempotency rows are unchanged [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s2_retry') like 'ok:%' and pg_temp.r7_get('s2_state_after_retry') = 'active',
  'the same request (same Idempotency-Key) succeeds once the lock is free: the key is reusable after the conflict [P2-S12-AC-276]');

-- S3
select pg_temp.r7_is(pg_temp.r7_get('s3_b_blocked_by_h'), 'true', 'CMS-03C-09 activate is observed blocked BY the advisory lock holder [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s3_b_waits_for'), 'advisory', 'the activation waits for the lineage advisory lock, the last position [P2-S12-AC-085]');
select pg_temp.r7_is(pg_temp.r7_get('s3_probe_pos5'), '55P03',
  'blocked at the advisory lock the activation already holds the review row (position 5) [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('s3_probe_pos1') = '55P03' and pg_temp.r7_get('s3_probe_pos3') = '55P03' and pg_temp.r7_get('s3_probe_pos4') = '55P03',
  'blocked at the advisory lock the activation also holds positions 1, 3 and 4: the advisory lock is acquired after every row lock [P2-S12-AC-085]');
select pg_temp.r7_ok(pg_temp.r7_get('s3_b') like 'ok:%' and pg_temp.r7_get('s3_state_after') = 'active',
  'once the advisory holder releases the activation completes and the subject is active [P2-S12-AC-085]');

-- S4
select pg_temp.r7_ok(pg_temp.r7_get('s4a_a') like 'ok:%', 'fixture: the activation holds the authority rows (position 1) while open [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s4a_r_blocked_by_a'), 'true',
  'a revocation of the activator''s grant arriving while the activation runs WAITS for it (the position 1 FOR SHARE lock) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s4a_grant_while_waiting'), 'true', 'the waiting revocation has not changed the grant yet [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s4a_state') = 'active' and pg_temp.r7_get('s4a_grant_after') = 'false',
  'the activation committed first and the waiting revocation then committed: the subject is active and the grant is revoked [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s4b_b_blocked_by_r'), 'true',
  'an activation arriving while a revocation of its grant is in flight waits for the revoking transaction [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s4b_b'), 'P0001:capability_missing',
  'a revocation committed first wins: the activation re-proves the capability under the lock and is refused capability_missing [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s4b_img_after') = pg_temp.r7_get('s4b_img_before') and pg_temp.r7_get('s4b_stores_after') = pg_temp.r7_get('s4b_stores_before')
    and pg_temp.r7_get('s4b_state') = 'approved',
  'the refused activation wrote nothing: the subject stays approved and the stores are unchanged [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s4_grant_restored'), 'true', 'cleanup: the activator grant is restored before the next scenario [P2-S12-AC-276]');

-- S5
select pg_temp.r7_is(pg_temp.r7_get('s5_b_blocked_by_h'), 'true', 'fixture: the command is blocked at the review row held by the other session before the lock cycle closes [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('s5_b'), 'P0001:CONFLICT',
  'deadlock_detected inside CMS-03C-09 is converted to the retryable P0001 CONFLICT (not a raw 40P01) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s5_img_after') = pg_temp.r7_get('s5_img_before') and pg_temp.r7_get('s5_stores_after') = pg_temp.r7_get('s5_stores_before'),
  'the deadlock victim committed nothing: review, subject and the audit, outbox and idempotency stores are unchanged [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s5_h_got_subject') like 'ok:%',
  'the other session of the cycle obtained the subject row once the victim rolled back (one committed command, no lost write) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('s5_retry') like 'ok:%' and pg_temp.r7_get('s5_state_after_retry') = 'active',
  'the same Idempotency-Key succeeds after the deadlock conflict [P2-S12-AC-276]');

-- cleanup
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-086]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-086]');
select * from pg_temp.r7_finish();
