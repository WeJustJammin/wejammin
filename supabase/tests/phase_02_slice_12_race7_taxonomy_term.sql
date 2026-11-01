-- Slice 12 race7: CMS-03C-03 taxonomy term actions under REAL concurrency (lane claude_s12_race7; BE03c "Slice 12 lock order" 1500-1530 row "CMS-03C-03 term
-- actions" (1 the curator's grant rows FOR SHARE; 3 the vocabulary's active TaxonomyVersion row FOR SHARE; 6 the term rows FOR UPDATE), rule 4 typed deadlock;
-- tracker P2-S12-AC-019, AC-047, AC-276).
-- Independent sessions (dblink; the precedent of phase_02_slice_09_schema/000b-activation-lock.sqlinc) drive the REAL command platform_api.cms_act_taxonomy_term under
-- the real service_role against a REAL active vocabulary (created, submitted, assigned, approved and activated through CMS-03C-16, -06, -08, -07, -09) and real terms.
-- The world is committed and removed again by the harness.  The command under test is the lock holder (an open transaction):
--   T1  A creates a term and stays open; B creates the SAME stable key under another Idempotency-Key: B is observed blocked on A, A commits, B answers the typed
--       CONFLICT (409 TAXONOMY_VERSION_CONFLICT at the Worker) and the stores hold exactly the winner's term, label, audit and outbox rows         [AC-019, AC-047]
--   T2  A and B deprecate the SAME term: B waits at the term row (position 6) for A, then answers the typed CONFLICT; one deprecation, one audit, one event [AC-047]
--   T3  a holder owns the vocabulary's active version row (position 3): the command waits there already holding the curator grant rows (1) and no term row (6);
--       a lock timeout is the retryable CONFLICT with nothing written and the same request then succeeds                                              [AC-019, AC-276]
--   T4  a holder owns a term row (position 6): the command waits there already holding the grant rows (1) and the active version row (3)             [AC-019, AC-276]
--   T5  the vocabulary's successor is being activated (held open): a term write carrying the previous ACTIVE version as its operand waits for the activation and
--       then loses with the typed CONFLICT; the same write with the new active version succeeds                                                        [AC-019]
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;
\ir phase_02_slice_12_race7/000-harness.sqlinc

-- CMS-03C-09 `activate` of an approved review, stashed under 'act:<tag>' (the request of pg_temp.s12gb_act)
create or replace function pg_temp.r7_stash_act(p_tag text) returns void language plpgsql as $b$
declare v_review uuid := pg_temp.s12ga_review(p_tag); v_version text := pg_temp.s12ga_rver(pg_temp.s12ga_review(p_tag));
begin
  perform pg_temp.r7_stash_cmd('act:' || p_tag, 'owner', 'platform_api.cms_activate_governed_subject',
    jsonb_build_object('reviewId', v_review, 'action', 'activate', 'expectedVersion', v_version, 'ifMatch', v_version, 'idempotencyKey', 'r7-act-' || p_tag));
end;
$b$;
create or replace function pg_temp.r7_stores() returns text language sql stable as $b$
  select 'terms=' || (select count(*) from platform_private.cms_terms) || ' labels=' || (select count(*) from platform_private.cms_term_labels)
    || ' audit=' || (select count(*) from audit_private.audit_events) || ' outbox=' || (select count(*) from platform_private.outbox_events)
    || ' idem=' || (select count(*) from platform_private.idempotency_records) || ' jobs=' || (select count(*) from platform_private.jobs) $b$;
create or replace function pg_temp.r7_term(p_tax uuid, p_key text) returns text language sql stable as $b$
  select coalesce((select lifecycle::text || ':' || version::text from platform_private.cms_terms where taxonomy_id = p_tax and term_key = p_key), 'absent') $b$;
create or replace function pg_temp.r7_terms_of(p_tax uuid, p_key text) returns bigint language sql stable as $b$
  select count(*) from platform_private.cms_terms where taxonomy_id = p_tax and term_key = p_key $b$;
create or replace function pg_temp.r7_vstates(p_tax uuid) returns text language sql stable as $b$
  select coalesce(string_agg(state::text, ',' order by version), '') from platform_private.cms_taxonomy_versions where taxonomy_id = p_tax $b$;
create or replace function pg_temp.r7_curator_where() returns text language sql stable as $b$
  select format('organization_id = %L::uuid and person_id = %L::uuid and capability_code = ''cms.taxonomy_curator''', pg_temp.r7_get('owner_org'), pg_temp.r7_get('owner_person')) $b$;

do $snap$ begin perform pg_temp.r7_note('snapshot_rows', pg_temp.r7_snapshot()::text); end $snap$;

-- ------------------------------------------------------------------------------------------------ the committed world (real producers)
begin;
select no_plan();
\o /dev/null
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/000-world.sqlinc
create temp table s12tt_setup(key text primary key, outcome text not null) on commit drop;
insert into s12tt_setup(key, outcome) values
  ('owner:curator', pg_temp.s12ga_grant('owner', 'cms.taxonomy_curator', 1)),
  ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key in ('rev1', 'rev2', 'rev3');
select pg_temp.r7_note('grants', (select string_agg(outcome, ',' order by key) from s12tt_setup));
-- the vocabulary: ACTIVE vf (flat); its successor vf2 is APPROVED and not yet active (T5)
select pg_temp.s12tt_vocab('vf', 'flat');
select pg_temp.s12tt_vocab('vf2', 'flat', '[]'::jsonb, false, 'vf');
select pg_temp.s12ga_rpc('vs-vf2', 'platform_api.cms_submit_governed_review', 'owner', jsonb_build_object(
  'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject('vf2'),
  'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('vf2')),
  'idempotencyKey', 's12tt-vs-vf2'));
insert into s12gov_ids(key, value) values ('vf2:review', pg_temp.s12ga_body('vs-vf2')->>'id') on conflict (key) do update set value = excluded.value;
select pg_temp.s12ga_assign('va-vf2', 'owner', pg_temp.s12ga_review('vf2'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('vd-vf2', 'rev1', pg_temp.s12ga_review('vf2'), 'approve');
select pg_temp.r7_note('vf2_review_state', (select state from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('vf2')));
-- the terms the scenarios act on (real create actions, committed)
select pg_temp.s12tt_act('w-' || k, 'owner', pg_temp.s12tt_lineage('vf'), 'create', k) from unnest(array['k2', 'k3', 'k5']) k;
select pg_temp.r7_note('terms_created', (select string_agg(pg_temp.s12ga_out('w-' || k), ',' order by k) from unnest(array['k2', 'k3', 'k5']) k));
create or replace function pg_temp.r7_stash_term(p_key text, p_label text, p_action text, p_term text, p_operand text default null) returns void language plpgsql as $b$
declare request jsonb := pg_temp.s12tt_req(p_label, pg_temp.s12tt_lineage('vf'), p_action, p_term)
  || case when p_operand is null then '{}'::jsonb else jsonb_build_object('expectedVersion', p_operand, 'ifMatch', p_operand) end;
begin
  perform pg_temp.r7_stash_cmd(p_key, 'owner', 'platform_api.cms_act_taxonomy_term', request);
end;
$b$;
select pg_temp.r7_stash_term('t1:a', 'r7-t1a', 'create', 'k1');
select pg_temp.r7_stash_term('t1:b', 'r7-t1b', 'create', 'k1');
select pg_temp.r7_stash_term('t2:a', 'r7-t2a', 'deprecate', 'k2');
select pg_temp.r7_stash_term('t2:b', 'r7-t2b', 'deprecate', 'k2');
select pg_temp.r7_stash_term('t3', 'r7-t3', 'deprecate', 'k3');
select pg_temp.r7_stash_copy('t3:lt', 't3', '{"lock_timeout": "3s"}'::jsonb);
select pg_temp.r7_stash_term('t4', 'r7-t4', 'deprecate', 'k5');
select pg_temp.r7_stash_term('t5:b', 'r7-t5b', 'create', 'k6');
select pg_temp.r7_stash_term('t5:b2', 'r7-t5b', 'create', 'k6', '2');
select pg_temp.r7_stash_term('t5:c', 'r7-t5c', 'create', 'k7', '1');
select pg_temp.r7_stash_term('t6:a', 'r7-t6a', 'create', 'k8', '2');
select pg_temp.r7_stash_term('t6:b', 'r7-t6b', 'create', 'k9', '2');
select pg_temp.r7_stash_act('vf2');
select pg_temp.r7_note('owner_org', pg_temp.s09d_id('ownerOrg')::text);
select pg_temp.r7_note('owner_person', (select person_id::text from s09d_actor where key = 'owner'));
select pg_temp.r7_note('tax', pg_temp.s12tt_lineage('vf')::text);
select pg_temp.r7_note('tax_v1', pg_temp.s12tt_active_id(pg_temp.s12tt_lineage('vf'))::text);
select pg_temp.r7_note('term_k3', pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'k3')::text);
select pg_temp.r7_note('term_k5', pg_temp.s12tt_term_id(pg_temp.s12tt_lineage('vf'), 'k5')::text);
\o
select pg_temp.r7_note('world_failed', num_failed()::text);
commit;

-- ------------------------------------------------------------------------------------------------ the scenarios
set statement_timeout = 0;
do $scenario$
declare c text; tax uuid; v1 uuid; k3 uuid; k5 uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', false);
  tax := pg_temp.r7_get('tax')::uuid; v1 := pg_temp.r7_get('tax_v1')::uuid; k3 := pg_temp.r7_get('term_k3')::uuid; k5 := pg_temp.r7_get('term_k5')::uuid;
  for c in select unnest(array['a', 'b', 'h', 'p']) loop perform pg_temp.r7_conn(c); end loop;

  -- T1: the same stable key
  perform pg_temp.r7_note('t1_a', pg_temp.r7_hold('a', 't1:a'));
  perform pg_temp.r7_send('b', 't1:b');
  perform pg_temp.r7_note('t1_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('t1_b_waits_for', pg_temp.r7_waiting_for('b'));
  perform pg_temp.r7_note('t1_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('t1_stores_after_a', pg_temp.r7_stores());
  perform pg_temp.r7_note('t1_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t1_stores_after_b', pg_temp.r7_stores());
  perform pg_temp.r7_note('t1_terms', pg_temp.r7_terms_of(tax, 'k1')::text);

  -- T2: the same term, two deprecations
  perform pg_temp.r7_note('t2_a', pg_temp.r7_hold('a', 't2:a'));
  perform pg_temp.r7_send('b', 't2:b');
  perform pg_temp.r7_note('t2_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('t2_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('t2_stores_after_a', pg_temp.r7_stores());
  perform pg_temp.r7_note('t2_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t2_stores_after_b', pg_temp.r7_stores());
  perform pg_temp.r7_note('t2_term', pg_temp.r7_term(tax, 'k2'));

  -- T3: a holder owns the vocabulary's active version row (position 3)
  perform pg_temp.r7_note('t3_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('t3_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_taxonomy_versions where id = %L::uuid for update', v1)));
  perform pg_temp.r7_send('b', 't3:lt');
  perform pg_temp.r7_note('t3_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('t3_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_curator_where()));
  perform pg_temp.r7_note('t3_probe_pos6', pg_temp.r7_row_locked('p', 'platform_private.cms_terms', format('id = %L::uuid', k3)));
  perform pg_temp.r7_note('t3_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t3_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('t3_term_after_conflict', pg_temp.r7_term(tax, 'k3'));
  perform pg_temp.r7_note('t3_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('t3_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('t3')));
  perform pg_temp.r7_note('t3_term_after_retry', pg_temp.r7_term(tax, 'k3'));

  -- T4: a holder owns a term row (position 6)
  perform pg_temp.r7_note('t4_h', pg_temp.r7_hold_raw('h', format('perform 1 from platform_private.cms_terms where id = %L::uuid for update', k5)));
  perform pg_temp.r7_send('b', 't4');
  perform pg_temp.r7_note('t4_b_blocked_by_h', pg_temp.r7_blocked_by('b', 'h')::text);
  perform pg_temp.r7_note('t4_probe_pos1', pg_temp.r7_row_locked('p', 'identity_private.organization_actor_grant', pg_temp.r7_curator_where()));
  perform pg_temp.r7_note('t4_probe_pos3', pg_temp.r7_row_locked('p', 'platform_private.cms_taxonomy_versions', format('id = %L::uuid', v1)));
  perform pg_temp.r7_note('t4_h_end', pg_temp.r7_end('h', 'rollback'));
  perform pg_temp.r7_note('t4_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t4_term', pg_temp.r7_term(tax, 'k5'));

  -- T5: a stale active-version operand loses against the activation of the successor
  perform pg_temp.r7_note('t5_states_before', pg_temp.r7_vstates(tax));
  perform pg_temp.r7_note('t5_a', pg_temp.r7_hold('a', 'act:vf2'));
  perform pg_temp.r7_send('b', 't5:b');
  perform pg_temp.r7_note('t5_b_blocked_by_a', pg_temp.r7_blocked_by('b', 'a')::text);
  perform pg_temp.r7_note('t5_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('t5_stores_after_a', pg_temp.r7_stores());
  perform pg_temp.r7_note('t5_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t5_stores_after_b', pg_temp.r7_stores());
  perform pg_temp.r7_note('t5_states_after', pg_temp.r7_vstates(tax));
  perform pg_temp.r7_note('t5_stale_after', pg_temp.r7_sql('b', pg_temp.r7_call_sql('t5:c')));
  perform pg_temp.r7_note('t5_retry', pg_temp.r7_sql('b', pg_temp.r7_call_sql('t5:b2')));
  perform pg_temp.r7_note('t5_term', pg_temp.r7_term(tax, 'k6'));

  -- T6: the curator capability is re-proved under the position 1 lock (the vocabulary is at version 2 now)
  perform pg_temp.r7_conn('r');
  perform pg_temp.r7_note('t6a_a', pg_temp.r7_hold('a', 't6:a'));
  perform pg_temp.r7_send_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_curator_where()));
  perform pg_temp.r7_note('t6a_r_blocked_by_a', pg_temp.r7_blocked_by('r', 'a')::text);
  perform pg_temp.r7_note('t6a_a_commit', pg_temp.r7_end('a'));
  perform pg_temp.r7_note('t6a_r', pg_temp.r7_collect('r'));
  perform pg_temp.r7_note('t6a_term', pg_temp.r7_term(tax, 'k8'));
  perform pg_temp.r7_note('t6a_grant', (select active::text from identity_private.organization_actor_grant where organization_id = pg_temp.r7_get('owner_org')::uuid
    and person_id = pg_temp.r7_get('owner_person')::uuid and capability_code = 'cms.taxonomy_curator'));
  perform pg_temp.r7_note('t6a_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_curator_where())));
  perform pg_temp.r7_note('t6b_stores_before', pg_temp.r7_stores());
  perform pg_temp.r7_note('t6b_r', pg_temp.r7_hold_raw('r', format('update identity_private.organization_actor_grant set active = false where %s', pg_temp.r7_curator_where())));
  perform pg_temp.r7_send('b', 't6:b');
  perform pg_temp.r7_note('t6b_b_blocked_by_r', pg_temp.r7_blocked_by('b', 'r')::text);
  perform pg_temp.r7_note('t6b_r_commit', pg_temp.r7_end('r'));
  perform pg_temp.r7_note('t6b_b', pg_temp.r7_collect('b'));
  perform pg_temp.r7_note('t6b_stores_after', pg_temp.r7_stores());
  perform pg_temp.r7_note('t6b_term', pg_temp.r7_term(tax, 'k9'));
  perform pg_temp.r7_note('t6b_restore', pg_temp.r7_do('p', format('update identity_private.organization_actor_grant set active = true where %s', pg_temp.r7_curator_where())));
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p', 'r']);
exception when others then
  perform pg_temp.r7_note('harness_error', sqlstate || ':' || sqlerrm);
  perform pg_temp.r7_cleanup(array['a', 'b', 'h', 'p', 'r']);
end;
$scenario$;
\ir phase_02_slice_12_race7/090-restore.sqlinc

-- ------------------------------------------------------------------------------------------------ assertions
select pg_temp.r7_diag('restore=' || coalesce(pg_temp.r7_get('restore'), '?') || ' restore2=' || coalesce(pg_temp.r7_get('restore2'), '?') || ' off=' || coalesce(pg_temp.r7_get('restore_off'), '?') || ' on=' || coalesce(pg_temp.r7_get('restore_on'), '?') || ' missing_before=' || coalesce(pg_temp.r7_get('missing_before'), '?') || ' missing_where=' || coalesce(pg_temp.r7_get('missing_where'), '?') || ' added_where=' || coalesce(pg_temp.r7_get('added_where'), '?'));
select pg_temp.r7_is(pg_temp.r7_get('harness_error'), null, 'the committed-world harness ran every term scenario without an error of its own [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('world_failed'), '0', 'the committed vocabulary world built with no failed fixture assertion [P2-S12-AC-019]');
select pg_temp.r7_ok(pg_temp.r7_get('grants') = 'OK,OK' and pg_temp.r7_get('vf2_review_state') = 'approved' and pg_temp.r7_get('terms_created') = 'ok,ok,ok',
  'fixture: the curator and reviewer grants, an approved successor vocabulary and three real terms exist before the scenarios [P2-S12-AC-019]');

-- T1
select pg_temp.r7_ok(pg_temp.r7_get('t1_a') like 'ok:%', 'the first create of the stable key commits while its session stays open [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t1_b_blocked_by_a'), 'true', 'a second create of the same stable key is observed blocked BY the first in the live lock manager [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t1_b_waits_for'), 'transactionid', 'the second create waits for the first transaction to finish (the unique stable key) [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t1_b'), 'P0001:CONFLICT',
  'exactly one winner of a duplicate stable key: the loser answers the typed CONFLICT (409 TAXONOMY_VERSION_CONFLICT) [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t1_b'), 'P0001:CONFLICT',
  'two competing writers on one vocabulary serialize: the loser gets the typed CONFLICT (409 TAXONOMY_VERSION_CONFLICT) [P2-S12-AC-047]');
select pg_temp.r7_ok(pg_temp.r7_get('t1_stores_after_b') = pg_temp.r7_get('t1_stores_after_a') and pg_temp.r7_get('t1_terms') = '1',
  'the loser created no duplicate term, label, audit, outbox or idempotency row: the stores equal what the winner left and one term holds the key [P2-S12-AC-047]');

-- T2
select pg_temp.r7_is(pg_temp.r7_get('t2_b_blocked_by_a'), 'true', 'a second deprecation of the same term waits for the first (the position 6 term row) [P2-S12-AC-047]');
select pg_temp.r7_is(pg_temp.r7_get('t2_b'), 'P0001:CONFLICT',
  'two competing writers on one term serialize: the loser answers the typed CONFLICT, never a second transition [P2-S12-AC-047]');
select pg_temp.r7_ok(pg_temp.r7_get('t2_stores_after_b') = pg_temp.r7_get('t2_stores_after_a') and pg_temp.r7_get('t2_term') like 'deprecated:%',
  'the loser wrote no label, audit, outbox or idempotency row and the term is deprecated exactly once [P2-S12-AC-047]');

-- T3
select pg_temp.r7_is(pg_temp.r7_get('t3_b_blocked_by_h'), 'true', 'the term action is observed blocked BY the holder of the vocabulary active version row (position 3) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t3_probe_pos1'), '55P03', 'waiting at position 3 the term action already holds the curator grant rows (position 1) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t3_probe_pos6'), '00000', 'waiting at position 3 the term action does not yet hold the term row (position 6): no earlier position is taken after a later one [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t3_b'), 'P0001:CONFLICT', 'a lock-acquisition failure (lock_timeout) at the active version row is the retryable P0001 CONFLICT of CMS-03C-03 [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t3_stores_after') = pg_temp.r7_get('t3_stores_before') and pg_temp.r7_get('t3_term_after_conflict') like 'active:%',
  'the lock failure committed nothing: no label, audit, outbox or idempotency row and the term is unchanged [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t3_retry') like 'ok:%' and pg_temp.r7_get('t3_term_after_retry') like 'deprecated:%',
  'the same request (same Idempotency-Key) succeeds once the row is free: the key is reusable after the conflict [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t3_probe_pos1'), '55P03', 'the term action holds the curator grant rows (position 1) before the vocabulary row (position 3) [P2-S12-AC-019]');

-- T4
select pg_temp.r7_is(pg_temp.r7_get('t4_b_blocked_by_h'), 'true', 'the term action is observed blocked BY the holder of the term row (position 6) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t4_probe_pos1') = '55P03' and pg_temp.r7_get('t4_probe_pos3') = '55P03',
  'waiting at position 6 the term action already holds the grant rows (1) and the vocabulary active version row (3) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t4_b') like 'ok:%' and pg_temp.r7_get('t4_term') like 'deprecated:%', 'once the term row holder releases, the term action completes [P2-S12-AC-276]');

-- T5
select pg_temp.r7_is(pg_temp.r7_get('t5_states_before'), 'active,approved', 'fixture: the vocabulary has an active version and an approved successor before the activation race [P2-S12-AC-019]');
select pg_temp.r7_ok(pg_temp.r7_get('t5_a') like 'ok:%', 'the activation of the successor vocabulary version commits while its session stays open [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t5_b_blocked_by_a'), 'true', 'a term write carrying the previous active version waits for the activation in flight (the position 3 row) [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t5_b'), 'P0001:taxonomy_not_active',
  'a writer that waited on the active version row the activation superseded is refused with the typed taxonomy_not_active (Slice 12 lock order rule 2: a superseded bound definition row) and loses [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('t5_stale_after'), 'P0001:CONFLICT',
  'a stale active-version operand arriving after the activation committed loses with the typed CONFLICT (409 TAXONOMY_VERSION_CONFLICT) [P2-S12-AC-019]');
select pg_temp.r7_ok(pg_temp.r7_get('t5_stores_after_b') = pg_temp.r7_get('t5_stores_after_a') and pg_temp.r7_get('t5_states_after') = 'superseded,active',
  'the stale write wrote nothing and the vocabulary now has exactly one active version, the successor [P2-S12-AC-019]');
select pg_temp.r7_ok(pg_temp.r7_get('t5_retry') like 'ok:%' and pg_temp.r7_get('t5_term') = 'active:1',
  'the same write with the new active version as its operand succeeds [P2-S12-AC-019]');

-- T6
select pg_temp.r7_ok(pg_temp.r7_get('t6a_a') like 'ok:%', 'the term create (held open) owns the curator authority rows (position 1) [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t6a_r_blocked_by_a'), 'true', 'a revocation of the curator grant arriving while the term action runs WAITS for it (the position 1 FOR SHARE lock) [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t6a_term') = 'active:1' and pg_temp.r7_get('t6a_grant') = 'false',
  'the term action committed first and the waiting revocation then committed: the term exists and the grant is revoked [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t6b_b_blocked_by_r'), 'true', 'a term action arriving while a revocation of its curator grant is in flight waits for the revoking transaction [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('t6b_b'), 'P0001:capability_missing',
  'a revocation committed first wins: the term action re-proves the capability under the lock and is refused capability_missing [P2-S12-AC-276]');
select pg_temp.r7_ok(pg_temp.r7_get('t6b_stores_after') = pg_temp.r7_get('t6b_stores_before') and pg_temp.r7_get('t6b_term') = 'absent',
  'the refused term action wrote nothing: no term, label, audit, outbox or idempotency record [P2-S12-AC-276]');
select pg_temp.r7_is(pg_temp.r7_get('added_after_restore'), '0', 'cleanup: the harness removed every row the committed world and the scenarios added (' || coalesce(pg_temp.r7_get('added_where'), '') || ') [P2-S12-AC-019]');
select pg_temp.r7_is(pg_temp.r7_get('missing_after_restore'), '0', 'cleanup: no pre-existing row was changed or removed [P2-S12-AC-019]');
select * from pg_temp.r7_finish();
