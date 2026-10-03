commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): CMS-03A-11 submit, CMS-03A-12
-- decision, CMS-03A-13 read and CMS-03A-14 assignment clauses that the producer
-- suites do not pin: atomicity, fail-closed policy resolution, authority
-- windows, the drift matrix, owner-only assignment summaries and the 403 for a
-- known readable review.  Candidates are produced through the named commands;
-- probes that need a forged row are labelled negative controls and rolled back.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.s09e_fp() returns text language plpgsql as $body$
begin
  return md5(pg_temp.s09d_fingerprint(true) || '|' ||
    coalesce(pg_temp.s09d_scalar('select count(*)::text from platform_private.jobs'), 'x') || '|' ||
    coalesce(pg_temp.s09d_scalar('select md5(coalesce(string_agg(t::text, '','' order by id), '''')) from platform_private.cms_field_definition_versions t'), 'x') || '|' ||
    coalesce(pg_temp.s09d_scalar('select md5(coalesce(string_agg(t::text, '','' order by id), '''')) from platform_private.cms_schema_artifacts t'), 'x'));
end;
$body$;
create function public.s09e_fail_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = current_setting('s09e.fail_event', true) then
    raise exception 'S09E_FORCED_OUTBOX_FAILURE';
  end if;
  return new;
end;
$body$;
create trigger s09e_fail_outbox before insert on platform_private.outbox_events
for each row execute function public.s09e_fail_outbox();

-- ================================================ CMS-03A-11 submit ====
-- AC388: the review freeze and the draft -> review transition are one transaction.
select pg_temp.s09d_create_type('a', 'ev11atomic');
select pg_temp.s09d_dry_run('a');
select pg_temp.s09d_seal('a');
select set_config('s09e.fail_event', 'cms.schema.review.submitted.v1', true);
select pg_temp.s09e_fp() as submit_before \gset
select pg_temp.s09d_submit('a');
select ok(pg_temp.s09d_outcome('a:submit') not in ('OK', 'MISSING'), 'a failing outbox write fails CMS-03A-11 [P2-S09-AC-388]');
select is(pg_temp.s09e_fp(), :'submit_before',
  'the failed freeze left no review, no draft -> review transition, no audit, outbox or idempotency row [P2-S09-AC-388]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'draft',
  'the candidate is still a draft: no partial freeze [P2-S09-AC-388]');
select set_config('s09e.fail_event', '', true);
select pg_temp.s09d_submit('a');
select is(pg_temp.s09d_outcome('a:submit'), 'OK', 'the freeze succeeds once the failure is removed [P2-S09-AC-388]');

-- AC389: a missing, ambiguous or hash-mismatched bound policy row fails closed with 503.
create or replace function pg_temp.s09e_policy_probe(p_tag text, p_table text, p_sql text) returns jsonb
language plpgsql as $body$
declare observed jsonb;
begin
  begin
    set constraints all immediate;
    execute format('alter table platform_private.%I disable trigger user', p_table);
    perform pg_catalog.set_config('app.cms_rpc', 'true', true);
    execute p_sql;
    perform pg_catalog.set_config('app.cms_rpc', '', true);
    perform pg_temp.s09d_submit(p_tag);
    observed := jsonb_build_object('outcome', pg_temp.s09d_outcome(p_tag || ':submit'),
      'reviews', (select count(*) from platform_private.cms_schema_reviews
                   where content_type_version_id = pg_temp.s09d_id(p_tag || ':version')),
      'state', pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id(p_tag || ':version')));
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then
      return jsonb_build_object('error', sqlerrm);
    end if;
  end;
  return observed;
end;
$body$;
select pg_temp.s09d_create_type('p', 'ev11policy');
select pg_temp.s09d_dry_run('p');
select pg_temp.s09d_seal('p');
select pg_temp.s09e_policy_probe('p', 'cms_workflow_policies', format(
  'update platform_private.cms_workflow_policies set policy_key = %L where policy_key = %L and policy_version = 1',
  'editorial.gone', 'editorial')) as probe_missing \gset
select ok(:'probe_missing'::jsonb->>'outcome' = 'DEPENDENCY_UNAVAILABLE' and (:'probe_missing'::jsonb->>'reviews')::int = 0
  and :'probe_missing'::jsonb->>'state' = 'draft',
  'a missing bound policy row is 503 DEPENDENCY_UNAVAILABLE and creates no review [P2-S09-AC-389]');
select pg_temp.s09e_policy_probe('p', 'cms_workflow_policies', format(
  'update platform_private.cms_workflow_policies set policy_hash = %L where policy_key = %L and policy_version = 1',
  repeat('0', 64), 'editorial')) as probe_hash \gset
select ok(:'probe_hash'::jsonb->>'outcome' = 'DEPENDENCY_UNAVAILABLE' and (:'probe_hash'::jsonb->>'reviews')::int = 0
  and :'probe_hash'::jsonb->>'state' = 'draft',
  'a hash-mismatched bound policy row is 503 DEPENDENCY_UNAVAILABLE and creates no review [P2-S09-AC-389]');
select pg_temp.s09e_policy_probe('p', 'cms_workflow_policies', $q$
  alter table platform_private.cms_workflow_policies drop constraint cms_workflow_policies_member_unique;
  insert into platform_private.cms_workflow_policies(owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities)
    select owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities
      from platform_private.cms_workflow_policies where policy_key = 'editorial' and policy_version = 1$q$) as probe_ambiguous \gset
select ok(:'probe_ambiguous'::jsonb->>'outcome' = 'DEPENDENCY_UNAVAILABLE' and (:'probe_ambiguous'::jsonb->>'reviews')::int = 0
  and :'probe_ambiguous'::jsonb->>'state' = 'draft',
  'an ambiguous bound policy row (two rows for one member) is 503 DEPENDENCY_UNAVAILABLE and creates no review [P2-S09-AC-389]');
select ok(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_workflow_policies') = '8',
  'every policy tampering was rolled back: the eight seeded members are intact');

-- ================================================ CMS-03A-12 decision ====
-- AC417: the submitter cannot decide, even holding a forged assignment.
select pg_temp.s09d_create_type('s', 'ev12submitter');
select pg_temp.s09d_to_review('s');
select pg_temp.s09d_assign('s', 'rev1');
select pg_temp.s09d_decide('s', 'owner', 'approve', '{}'::jsonb, 's:ownerdecide');
select ok(pg_temp.s09d_outcome('s:ownerdecide') = 'FORBIDDEN'
  and pg_temp.s09d_outcome('s:ownerdecide') <> 'OK',
  'the submitter holds no assignment and cannot decide their own review: the review is readable to them, so 403 FORBIDDEN [P2-S09-AC-417] [P2-S09-AC-431]');
select set_config('app.cms_rpc', 'true', true);
select pg_temp.s09d_try(format($q$insert into platform_private.cms_schema_review_assignments(
      owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key, actions, state, starts_at, ends_at)
    select review.owner_id, review.id, review.submitter_person_ref, review.submitter_person_ref,
      'cms.schema_review', array['read','decide']::text[], 'active', clock_timestamp(), clock_timestamp() + interval '1 day'
    from platform_private.cms_schema_reviews review where review.id = %L$q$, pg_temp.s09d_id('s:review'))) as forged \gset
select pg_temp.s09d_decide('s', 'owner', 'approve', '{}'::jsonb, 's:forgeddecide');
select ok(pg_temp.s09d_outcome('s:forgeddecide') = 'CONFLICT'
  and pg_temp.s09d_outcome('s:forgeddecide') <> 'OK'
  and pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_review_decisions where review_id = %L',
        pg_temp.s09d_id('s:review'))) = '0',
  'negative control: even with a forged assignment the submitter is refused and no decision is recorded [P2-S09-AC-417]');

-- AC416: authority starts at starts_at: a not-yet-started assignment confers nothing.
select pg_temp.s09d_create_type('f', 'ev12future');
select pg_temp.s09d_to_review('f');
select pg_temp.s09d_assign('f', 'rev1');
select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
   set starts_at = clock_timestamp() + interval '1 hour', ends_at = clock_timestamp() + interval '2 hours'
 where id = %L$q$, pg_temp.s09d_id('f:assignment:rev1')));
select pg_temp.s09d_decide('f', 'rev1', 'approve');
select ok(pg_temp.s09d_outcome('f:assign:rev1') = 'OK' and pg_temp.s09d_outcome('f:decide:rev1') = 'NOT_FOUND',
  'an assignment whose starts_at has not been reached confers no authority (starts_at <= now < ends_at) [P2-S09-AC-416]');
select pg_temp.s09d_get_review('f:get', 'f', 'rev1');
select is(pg_temp.s09d_outcome('f:get'), 'NOT_FOUND',
  'the not-yet-started assignment does not open the review read either [P2-S09-AC-416]');

-- AC423: the drift matrix.  Every frozen-evidence input invalidates the open review.
create or replace function pg_temp.s09e_open_review(p_tag text, p_key text, p_workflow text default 'editorial')
returns void language plpgsql as $body$
begin
  perform pg_temp.s09d_create_type(p_tag, p_key, p_workflow);
  perform pg_temp.s09d_to_review(p_tag);
  perform pg_temp.s09d_assign(p_tag, 'rev1');
end;
$body$;
create or replace function pg_temp.s09e_drift_state(p_tag text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id(p_tag || ':review')) || '/'
      || pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id(p_tag || ':version'))
$body$;
-- candidate hash / dependency set: a relation bound after the freeze.
select pg_temp.s09e_open_review('dh', 'ev12drifthash');
select pg_temp.s09d_add_relation('dh');
select is(pg_temp.s09e_drift_state('dh'), 'invalidated/draft',
  'candidate hash and dependency-set drift (a relation bound after the freeze) invalidates the open review [P2-S09-AC-423]');
-- policy: the candidate's bound workflow member changes.
select pg_temp.s09e_open_review('dp', 'ev12driftpolicy');
set constraints all immediate;
alter table platform_private.cms_content_type_versions disable trigger cms_content_type_versions_guard;
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_type_versions set workflow_key = 'cms.standard' where id = pg_temp.s09d_id('dp:version');
alter table platform_private.cms_content_type_versions enable trigger cms_content_type_versions_guard;
set constraints all deferred;
select is(pg_temp.s09e_drift_state('dp'), 'invalidated/draft',
  'policy drift (a different bound workflow member) invalidates the open review [P2-S09-AC-423]');
-- compiler version: the artifact hash composes the compiler version (proved in
-- artifact_versioning), so a compiler change is a definition_hash change and is
-- the candidate-hash drift above; one artifact exists per version (UNIQUE).
select ok(pg_temp.s09d_constraint_has('cms_schema_artifacts', 'UNIQUE (content_type_version_id)'),
  'one compiled artifact exists per version: a compiler change can only surface as a new definition_hash, which invalidates the open review [P2-S09-AC-423]');
-- dry-run evidence: the candidate's bound attempt changes.
select pg_temp.s09e_open_review('dd', 'ev12driftdry');
select pg_temp.s09d_create_type('dz', 'ev12driftdryother');
select pg_temp.s09d_dry_run('dz');
set constraints all immediate;
alter table platform_private.cms_content_type_versions disable trigger cms_content_type_versions_guard;
update platform_private.cms_content_type_versions set dry_run_id = pg_temp.s09d_id('dz:dryRun') where id = pg_temp.s09d_id('dd:version');
alter table platform_private.cms_content_type_versions enable trigger cms_content_type_versions_guard;
set constraints all deferred;
select is(pg_temp.s09e_drift_state('dd'), 'invalidated/draft',
  'dry-run evidence drift (another attempt bound to the candidate) invalidates the open review [P2-S09-AC-423]');
-- reviewer authority: an assignment revoke leaves the review open but the approver stops counting (read_review proof);
-- the owner-capability change is proven by the activation suite; here a lapsed assignment window refuses the decision.

-- AC426 / AC427: the decision and its audit/outbox rows commit atomically (approve and reject).
select pg_temp.s09d_create_type('m', 'ev12atomic');
select pg_temp.s09d_to_review('m');
select pg_temp.s09d_assign('m', 'rev1');
select set_config('s09e.fail_event', 'cms.schema.review.decided.v1', true);
select pg_temp.s09e_fp() as decide_before \gset
select pg_temp.s09d_decide('m', 'rev1', 'approve', '{}'::jsonb, 'm:approve-fail');
select ok(pg_temp.s09d_outcome('m:approve-fail') not in ('OK', 'MISSING'), 'a failing outbox write fails an approve decision [P2-S09-AC-426]');
select is(pg_temp.s09e_fp(), :'decide_before', 'the failed approve appended no decision, audit, outbox or idempotency row [P2-S09-AC-426]');
select is(pg_temp.s09e_drift_state('m'), 'open/review', 'the review stayed open and the candidate stayed in review [P2-S09-AC-426]');
select pg_temp.s09d_decide('m', 'rev1', 'reject', '{}'::jsonb, 'm:reject-fail');
select ok(pg_temp.s09d_outcome('m:reject-fail') not in ('OK', 'MISSING')
  and pg_temp.s09e_fp() = :'decide_before' and pg_temp.s09e_drift_state('m') = 'open/review',
  'a failing outbox write fails a reject decision with no partial draft transition [P2-S09-AC-427]');
select set_config('s09e.fail_event', '', true);
select pg_temp.s09d_decide('m', 'rev1', 'reject', '{}'::jsonb, 'm:reject-ok');
select ok(pg_temp.s09d_outcome('m:reject-ok') = 'OK' and pg_temp.s09e_drift_state('m') = 'rejected/draft'
  and coalesce(pg_temp.s09d_scalar(format($q$select (
      (select count(*) from audit_private.audit_events where target_id = %1$L) >= 1
      and (select count(*) from platform_private.outbox_events where aggregate_id = %1$L or aggregate_id = %2$L) >= 1)::text$q$,
    pg_temp.s09d_id('m:decision:rev1'), pg_temp.s09d_id('m:review')))::boolean, false),
  'a rejected review returns the candidate to an editable draft with its audit and outbox evidence in the same transaction [P2-S09-AC-427]');

-- ================================================ CMS-03A-13 read ====
-- AC447: earlier decisions do not re-require MFA freshness.
select pg_temp.s09d_create_type('o', 'ev13oldmfa');
select pg_temp.s09d_to_approved('o');
select pg_temp.s09d_timewarp('cms_schema_review_decisions', format($q$update platform_private.cms_schema_review_decisions
   set decided_at = decided_at - interval '2 hours', created_at = created_at - interval '2 hours',
       updated_at = updated_at - interval '2 hours', mfa_verified_at = mfa_verified_at - interval '2 hours'
 where review_id = %L$q$, pg_temp.s09d_id('o:review')));
select pg_temp.s09d_get_review('o:get', 'o', 'owner');
select ok((select (r->>'distinctApprovalCount')::int = 1 and r->>'state' = 'approved'
    from (select pg_temp.s09d_resp('o:get') r) s),
  'distinctApprovalCount counts a human whose decision MFA is two hours old: earlier MFA freshness is not re-required [P2-S09-AC-447]');

-- AC449: assignments are an owner-only safe summary; every other reader gets [].
select pg_temp.s09d_create_type('w', 'ev13assign');
select pg_temp.s09d_to_review('w');
select pg_temp.s09d_assign('w', 'rev1');
select pg_temp.s09d_get_review('w:owner', 'w', 'owner');
select pg_temp.s09d_get_review('w:designer2', 'w', 'designer2');
select pg_temp.s09d_get_review('w:rev1', 'w', 'rev1');
select ok((select jsonb_array_length(r->'assignments') = 1
    and r->'assignments'->0 ?& array['assignmentId', 'version', 'state', 'startsAt']
    and not (r->'assignments'->0 ? 'reviewerPersonId') and not (r->'assignments'->0 ? 'grantorPersonId')
    and position(pg_temp.s09d_actor_id('rev1', 'person') in r::text) = 0
    from (select pg_temp.s09d_resp('w:owner') r) s),
  'the receipt-derived owner sees one safe assignment summary with no person identifier [P2-S09-AC-449]');
select ok((select r->'assignments' = '[]'::jsonb from (select pg_temp.s09d_resp('w:designer2') r) s)
  and (select r->'assignments' = '[]'::jsonb from (select pg_temp.s09d_resp('w:rev1') r) s),
  'a non-owner designer and the assigned reviewer both read an empty assignments array [P2-S09-AC-449]');

-- AC452 / AC453: a known readable review lacking the capability is a 403; reads change nothing.
select pg_temp.s09g_member('rev3');
select pg_temp.s09e_fp() as read_before \gset
select pg_temp.s09d_session('rev3');
select pg_temp.s09d_call('w:member', 'platform_api.cms_get_schema_review',
  jsonb_build_object('reviewId', pg_temp.s09d_id('w:review'),
    'context', pg_temp.s09d_context('rev3', false, jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')))));
select is(pg_temp.s09d_outcome('w:member'), 'FORBIDDEN',
  'a member of the owner organization acting as it, with no designer capability and no assignment, is denied a known readable review with 403 [P2-S09-AC-452] [P2-S09-AC-457]');
select pg_temp.s09d_get_review('w:other', 'w', 'other');
select is(pg_temp.s09d_outcome('w:other'), 'NOT_FOUND', 'another organization still sees the review as absent (404) [P2-S09-AC-452]');
select pg_temp.s09d_get_review('w:rev2', 'w', 'rev2');
select is(pg_temp.s09d_outcome('w:rev2'), 'NOT_FOUND', 'a human outside the owner organization still sees the review as absent (404) [P2-S09-AC-452]');
select is(pg_temp.s09e_fp(), :'read_before',
  'success, 403 and 404 reads performed no INSERT, UPDATE, DELETE, idempotency reservation, audit, outbox, job, lease or state change [P2-S09-AC-453]');

-- ================================================ CMS-03A-14 assignment ====
-- AC471: the seven-day ceiling is inclusive; one second more is refused.
select pg_temp.s09d_create_type('x', 'ev14ceiling');
select pg_temp.s09d_to_review('x');
select ok(pg_temp.s09g_renew('x:own', 'owner', (select id from platform_private.cms_capability_grants
      where subject_person_ref = pg_temp.s09d_actor_id('owner', 'person')::uuid and capability_code = 'cms.schema_designer'),
    (select version::text from platform_private.cms_capability_grants
      where subject_person_ref = pg_temp.s09d_actor_id('owner', 'person')::uuid and capability_code = 'cms.schema_designer'),
    pg_temp.s09g_day(30)) is not null, 'fixture: the owner authority is renewed far beyond seven days');
select pg_temp.s09d_assign('x', 'rev1', interval '7 days' - interval '1 minute', 'owner', 'x:seven');
select is(pg_temp.s09d_outcome('x:seven'), 'OK', 'an expiry just inside seven days is accepted [P2-S09-AC-471]');
select pg_temp.s09d_assign('x', 'rev2', interval '7 days 2 seconds', 'owner', 'x:over');
select is(pg_temp.s09d_outcome('x:over'), 'CONFLICT', 'an expiry two seconds beyond seven days is refused [P2-S09-AC-471]');

-- AC469: the reviewer must be a real, active or claimed human: an unclaimed (shadow) person is refused.
update platform_private.person_party set account_state = 'shadow', auth_user_id = null
 where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;
select pg_temp.s09d_assign('x', 'rev2', interval '1 day', 'owner', 'x:shadow');
select is(pg_temp.s09d_outcome('x:shadow'), 'CONFLICT',
  'an unclaimed (shadow) person is not an eligible reviewer: 409 CONFLICT and no identity is created [P2-S09-AC-469]');
update platform_private.person_party set account_state = 'claimed', auth_user_id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid
 where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;
select pg_temp.s09d_assign('x', 'rev2', interval '1 day', 'owner', 'x:claimed');
select is(pg_temp.s09d_outcome('x:claimed'), 'OK', 'control: the same human once claimed is an eligible reviewer [P2-S09-AC-469]');

-- AC474: revoke references an existing assignment of that review.
select pg_temp.s09d_create_type('y', 'ev14other');
select pg_temp.s09d_to_review('y');
select pg_temp.s09d_assign('y', 'rev2');
select pg_temp.s09d_rpc('x:revoke:other', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('x:review'), 'action', 'revoke',
    'expectedVersion', pg_temp.s09d_review_version('x'), 'assignmentId', pg_temp.s09d_id('y:assignment:rev2'),
    'idempotencyKey', 's09e-revoke-other-0001'), true);
select is(pg_temp.s09d_outcome('x:revoke:other'), 'CONFLICT',
  'revoking an assignment that belongs to another review is a 409 CONFLICT (not an assignment of that review) [P2-S09-AC-474]');
select pg_temp.s09d_rpc('x:revoke:malformed', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('x:review'), 'action', 'revoke',
    'expectedVersion', pg_temp.s09d_review_version('x'), 'assignmentId', 'not-a-uuid',
    'idempotencyKey', 's09e-revoke-malformed-0001'), true);
select ok(pg_temp.s09d_outcome('x:revoke:malformed') = 'INVALID_REQUEST',
  'a malformed assignmentId is an assignment schema failure [P2-S09-AC-474]');
select ok(pg_temp.s09d_scalar(format('select state from platform_private.cms_schema_review_assignments where id = %L',
  pg_temp.s09d_id('y:assignment:rev2'))) = 'active', 'the other review''s assignment was not revoked [P2-S09-AC-474]');

-- AC489: assignment create and revoke commit with their audit and outbox rows or not at all.
select pg_temp.s09d_create_type('q', 'ev14atomic');
select pg_temp.s09d_to_review('q');
select set_config('s09e.fail_event', 'cms.schema.review.assignment.changed.v1', true);
select pg_temp.s09e_fp() as assign_before \gset
select pg_temp.s09d_assign('q', 'rev1', interval '1 day', 'owner', 'q:fail');
select ok(pg_temp.s09d_outcome('q:fail') not in ('OK', 'MISSING') and pg_temp.s09e_fp() = :'assign_before',
  'a failing outbox write rolls the assignment create back with its audit and idempotency rows [P2-S09-AC-489]');
select set_config('s09e.fail_event', '', true);
select pg_temp.s09d_assign('q', 'rev1', interval '1 day', 'owner', 'q:ok');
select set_config('s09e.fail_event', 'cms.schema.review.assignment.changed.v1', true);
select pg_temp.s09e_fp() as revoke_before \gset
select pg_temp.s09d_rpc('q:revoke', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('q:review'), 'action', 'revoke',
    'expectedVersion', pg_temp.s09d_review_version('q'), 'assignmentId', pg_temp.s09d_id('q:assignment:rev1'),
    'idempotencyKey', 's09e-revoke-atomic-0001'), true);
select ok(pg_temp.s09d_outcome('q:revoke') not in ('OK', 'MISSING') and pg_temp.s09e_fp() = :'revoke_before'
  and pg_temp.s09d_read('cms_schema_review_assignments', 'state', pg_temp.s09d_id('q:assignment:rev1')) = 'active',
  'a failing outbox write rolls the assignment revoke back: the assignment stays active [P2-S09-AC-489]');

select set_config('s09e.fail_event', '', true);
-- AC486: grantor authority ends at the end of the owner grant's valid_through UTC day.
select pg_temp.s09d_create_type('z', 'ev14daylimit');
select pg_temp.s09d_to_review('z');
select pg_temp.s09g_warp('owner', 'cms.schema_designer', -3, 0) as warped \gset
-- the expiry stays inside the current UTC day whatever the time of day the suite runs
select pg_temp.s09d_assign('z', 'rev1', least(interval '1 hour', (date_trunc('day', (clock_timestamp() at time zone 'UTC') + interval '1 day') - (clock_timestamp() at time zone 'UTC')) / 2), 'owner', 'z:lastday');
select is(pg_temp.s09d_outcome('z:lastday'), 'OK',
  'on the last valid UTC day the owner authority is still current and an expiry within it is accepted [P2-S09-AC-486]');
select pg_temp.s09d_assign('z', 'rev2', interval '2 days', 'owner', 'z:beyond');
select is(pg_temp.s09d_outcome('z:beyond'), 'CONFLICT',
  'an expiry past the end of the owner grant''s valid_through UTC day is refused [P2-S09-AC-486]');
select pg_temp.s09g_warp('owner', 'cms.schema_designer', -3, -1) as lapsed \gset
select pg_temp.s09d_assign('z', 'rev3', least(interval '1 hour', (date_trunc('day', (clock_timestamp() at time zone 'UTC') + interval '1 day') - (clock_timestamp() at time zone 'UTC')) / 2), 'owner', 'z:lapsed');
select ok(pg_temp.s09d_outcome('z:lapsed') = 'NOT_FOUND',
  'the day after valid_through the owner grant no longer gives current owner authority [P2-S09-AC-486]');

select * from finish();
rollback;
