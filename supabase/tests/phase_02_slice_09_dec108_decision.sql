commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-12 record review decision (BE03a route row,
-- SchemaReviewDecision table, security controls, "State machine and
-- concurrency", G6, G7, G9, G17).  Reviewers are independently authenticated
-- humans with NO CMS capability; the assignment is their only authority.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select is((select count(*)::integer from identity_private.organization_actor_grant grant_row
   join s09d_actor actor on actor.person_id = grant_row.person_id where actor.key in ('rev1', 'rev2', 'rev3')),
  0, 'fixture: the reviewers hold no CMS capability at all');

select pg_temp.s09d_create_type('a', 'dec108dec');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1');
select is(pg_temp.s09d_outcome('a:assign:rev1'), 'OK', 'fixture: the owner assigned rev1 to the frozen review');
create temp table s09d_baseline on commit drop as select pg_temp.s09d_fingerprint(false) as fingerprint;

-- Authority refusals against the open review (nothing may be recorded).
select pg_temp.s09d_decide('a', 'rev2', 'approve', '{}'::jsonb, 'a:unassigned');
select ok(pg_temp.s09d_outcome('a:unassigned') in ('FORBIDDEN', 'NOT_FOUND'),
  'a human who was never assigned cannot decide (the review is concealed or denied)');
select pg_temp.s09d_decide('a', 'other', 'approve', '{}'::jsonb, 'a:crossowner');
select is(pg_temp.s09d_outcome('a:crossowner'), 'NOT_FOUND', 'another organization''s designer sees the review as absent (404)');
select pg_temp.s09d_decide('a', 'rev1', 'approve', jsonb_build_object('actingContextId', null), 'a:nobinding');
select is(pg_temp.s09d_outcome('a:nobinding'), 'STEP_UP_REQUIRED', 'a decision without the private binding id is 401 STEP_UP_REQUIRED');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '11 minutes'
 where id = pg_temp.s09d_actor_id('rev1', 'binding')::uuid;
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:stale');
select is(pg_temp.s09d_outcome('a:stale'), 'STEP_UP_REQUIRED',
  'a stale binding heartbeat is 401 STEP_UP_REQUIRED even when the envelope claims fresh step-up');
update platform_private.acting_context_binding set last_seen_at = clock_timestamp(), state = 'revoked'
 where id = pg_temp.s09d_actor_id('rev1', 'binding')::uuid;
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:revoked');
select is(pg_temp.s09d_outcome('a:revoked'), 'STEP_UP_REQUIRED', 'a revoked binding is 401 STEP_UP_REQUIRED');
update platform_private.acting_context_binding set state = 'active' where id = pg_temp.s09d_actor_id('rev1', 'binding')::uuid;
select pg_temp.s09d_decide('a', 'rev1', 'approve',
  jsonb_build_object('actingContextId', pg_temp.s09d_actor_id('owner', 'binding')), 'a:foreignbinding');
select is(pg_temp.s09d_outcome('a:foreignbinding'), 'STEP_UP_REQUIRED',
  'MFA is binding-bound: another human''s binding id cannot satisfy the reviewer''s step-up');
select pg_temp.s09d_rpc('a:stalecas', 'platform_api.cms_decide_schema_review', 'rev1',
  jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'expectedVersion', '999', 'decision', 'approve',
    'idempotencyKey', 's09d-decide-stale-0001'), true);
select is(pg_temp.s09d_outcome('a:stalecas'), 'CONFLICT', 'a stale review CAS version is a 409 CONFLICT');
select pg_temp.s09d_rpc('a:badvalue', 'platform_api.cms_decide_schema_review', 'rev1',
  jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'expectedVersion', pg_temp.s09d_review_version('a'),
    'decision', 'maybe', 'idempotencyKey', 's09d-decide-badvalue-0001'), true);
select is(pg_temp.s09d_outcome('a:badvalue'), 'VALIDATION_FAILED', 'a decision other than approve/reject is 422 VALIDATION_FAILED');
select pg_temp.s09d_rpc('a:extra', 'platform_api.cms_decide_schema_review', 'rev1',
  jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'expectedVersion', pg_temp.s09d_review_version('a'),
    'decision', 'approve', 'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'),
    'idempotencyKey', 's09d-decide-extra-0001'), true);
select is(pg_temp.s09d_outcome('a:extra'), 'INVALID_REQUEST', 'the reviewer is server-resolved: a caller-supplied reviewer is an unknown key');
select ok(pg_temp.s09d_id('a:review') is not null and pg_temp.s09d_outcome('a:stalecas') = 'CONFLICT'
  and pg_temp.s09d_fingerprint(false) = (select fingerprint from s09d_baseline),
  'every refusal leaves reviews, decisions, versions, idempotency and outbox unchanged');

-- The accepted decision.
select pg_temp.s09d_decide('a', 'rev1', 'approve');
select is(pg_temp.s09d_outcome('a:decide:rev1'), 'OK', 'an assigned reviewer with recent binding-bound MFA records an approval');
select ok((select r->>'resourceKind' = 'schema_review_decision' and r->>'decision' = 'approve'
    and r->>'reviewId' = pg_temp.s09d_id('a:review')::text and r->>'capability' = 'cms.schema_review'
    and r->>'decidedAt' is not null
    and coalesce((select bool_and(position(needle in r::text) = 0) from (values
      (pg_temp.s09d_actor_id('rev1', 'auth')), (pg_temp.s09d_actor_id('rev1', 'person')),
      (pg_temp.s09d_actor_id('rev1', 'binding'))) n(needle)), false)
    from (select pg_temp.s09d_resp('a:decide:rev1') r) s),
  'the 201 SchemaReviewDecisionResource names the decision without any reviewer identifier');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    decision.reviewer_person_ref = %2$L and decision.assignment_id = %3$L
    and decision.capability_key = 'cms.schema_review' and decision.decision = 'approve'
    and decision.binding_context_hash ~ '^[a-f0-9]{64}$'
    and decision.reviewed_hash = review.definition_hash
    and decision.mfa_verified_at <= decision.decided_at
    and decision.mfa_verified_at >= decision.decided_at - interval '10 minutes'
    and decision.updated_at = decision.created_at)::text
  from platform_private.cms_schema_review_decisions decision
  join platform_private.cms_schema_reviews review on review.id = decision.review_id
  where decision.id = %1$L$q$, pg_temp.s09d_id('a:decision:rev1'), pg_temp.s09d_actor_id('rev1', 'person'),
  pg_temp.s09d_id('a:assignment:rev1')))::boolean, false),
  'the decision records the assignment, reviewed hash, binding-bound context and MFA time at decision time');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (state = 'approved' and approval_evidence_hash ~ '^[a-f0-9]{64}$'
    and decided_at is not null)::text from platform_private.cms_schema_reviews where id = %L$q$,
  pg_temp.s09d_id('a:review')))::boolean, false)
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')) = 'approved',
  'the policy count (1) approves the review with evidence and moves the candidate to approved');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from audit_private.audit_events where target_id = %1$L) >= 1
    and (select count(*) from platform_private.outbox_events where aggregate_id = %1$L or aggregate_id = %2$L) >= 1)::text$q$,
  pg_temp.s09d_id('a:decision:rev1'), pg_temp.s09d_id('a:review')))::boolean, false),
  'the decision writes its audit and outbox evidence atomically');
select ok((select r->>'state' = 'approved' and (r->>'distinctApprovalCount')::int = 1
    and (r->>'recordedDecisionCount')::int = 1
    from (select pg_temp.s09d_get_review('a:get', 'a') r) s),
  'the review projection counts one distinct approving human');
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:again');
select is(pg_temp.s09d_outcome('a:again'), 'CONFLICT', 'a decided review accepts no further decision from the same human (409)');
-- The submitter can never be recorded as a reviewer, even by a direct write
-- against an OPEN review (a before-insert trigger, never a cross-row CHECK).
select pg_temp.s09d_create_type('sb', 'dec108decsubmitter');
select pg_temp.s09d_to_review('sb');
select pg_temp.s09d_assign('sb', 'rev1');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format($q$insert into platform_private.cms_schema_review_decisions(
      owner_id, review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash,
      capability_key, capability_version, decision, reviewed_hash, mfa_verified_at)
    select review.owner_id, review.id, %2$L, 1, review.submitter_person_ref, repeat('a', 64),
      'cms.schema_review', 1, 'approve', review.definition_hash, clock_timestamp()
    from platform_private.cms_schema_reviews review where review.id = %1$L and review.state = 'open'$q$,
    pg_temp.s09d_id('sb:review'), pg_temp.s09d_id('sb:assignment:rev1')), 'P0001', null,
  'the submitter can never be recorded as a reviewer of an open review (trigger, not a cross-row CHECK)');

-- Same-key replay.
select pg_temp.s09d_create_type('r', 'dec108decreplay');
select pg_temp.s09d_to_review('r');
select pg_temp.s09d_assign('r', 'rev1');
select ok(pg_temp.s09d_replay_pair('r:decide', 'platform_api.cms_decide_schema_review', 'rev1',
    jsonb_build_object('reviewId', pg_temp.s09d_id('r:review'), 'expectedVersion', pg_temp.s09d_review_version('r'),
      'decision', 'approve', 'idempotencyKey', 's09d-decide-replay-0001'), true)
  and pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_review_decisions where review_id = %L',
    pg_temp.s09d_id('r:review'))) = '1',
  'a same-key replay returns the same decision and appends nothing');

-- Rejection returns the candidate to an editable draft; resubmission freezes new evidence.
select pg_temp.s09d_create_type('j', 'dec108decreject');
select pg_temp.s09d_to_review('j');
select pg_temp.s09d_assign('j', 'rev1');
select pg_temp.s09d_decide('j', 'rev1', 'reject');
select ok(pg_temp.s09d_outcome('j:decide:rev1') = 'OK'
  and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('j:review')) = 'rejected'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('j:version')) = 'draft',
  'a rejection moves the review to rejected and returns the candidate to draft');
select pg_temp.s09d_add_relation('j');
select pg_temp.s09d_remember('j:oldReview', pg_temp.s09d_id('j:review'));
select pg_temp.s09d_to_review('j');
select ok(pg_temp.s09d_outcome('j:submit') = 'OK' and pg_temp.s09d_id('j:review') <> pg_temp.s09d_id('j:oldReview')
  and pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_review_decisions where review_id = %L',
      pg_temp.s09d_id('j:review'))) = '0',
  'a resubmission after rejection freezes new evidence and carries none of the old decisions');

-- Drift and authority loss while the review is open.
select pg_temp.s09d_create_type('g', 'dec108decdrift');
select pg_temp.s09d_to_review('g');
select pg_temp.s09d_assign('g', 'rev1');
select pg_temp.s09d_add_relation('g');
select ok(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('g:review')) = 'invalidated',
  'candidate drift after the freeze invalidates the open review');
select pg_temp.s09d_decide('g', 'rev1', 'approve', '{}'::jsonb, 'g:late');
select ok(pg_temp.s09d_outcome('g:late') = 'CONFLICT', 'a decision on a drift-invalidated review is a 409 CONFLICT (frozen-evidence drift)');
select pg_temp.s09d_create_type('x', 'dec108decexpiry');
select pg_temp.s09d_to_review('x');
select pg_temp.s09d_assign('x', 'rev1');
select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
   set starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 second'
 where id = %L$q$, pg_temp.s09d_id('x:assignment:rev1')));
select pg_temp.s09d_decide('x', 'rev1', 'approve');
select ok(pg_temp.s09d_outcome('x:assign:rev1') = 'OK' and pg_temp.s09d_outcome('x:decide:rev1') in ('FORBIDDEN', 'NOT_FOUND'),
  'an assignment past ends_at stops authorizing decisions with no expiry sweep');
select pg_temp.s09d_create_type('v', 'dec108decrevoke');
select pg_temp.s09d_to_review('v');
select pg_temp.s09d_assign('v', 'rev1');
select pg_temp.s09d_rpc('v:revoke', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('v:review'), 'action', 'revoke',
    'expectedVersion', pg_temp.s09d_review_version('v'), 'assignmentId', pg_temp.s09d_id('v:assignment:rev1'),
    'idempotencyKey', 's09d-decide-revoke-0001'), true);
select pg_temp.s09d_decide('v', 'rev1', 'approve');
select ok(pg_temp.s09d_outcome('v:revoke') = 'OK' and pg_temp.s09d_outcome('v:decide:rev1') in ('FORBIDDEN', 'NOT_FOUND'),
  'a revoked assignment stops authorizing decisions');

-- Protected policy (G17 / DEC-110): two distinct humans; a repeated human never counts.
select pg_temp.s09d_create_type('p', 'dec108decprot', 'cms.disclosure.policy');
select pg_temp.s09d_to_review('p');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_assign('p', 'rev1');
select pg_temp.s09d_assign('p', 'rev2');
select ok((select r->>'riskClass' = 'protected' and (r->>'requiredDecisionCount')::int = 2
    from (select pg_temp.s09d_resp('p:submit') r) s),
  'a protected workflow key freezes riskClass protected with a required decision count of 2');
select pg_temp.s09d_decide('p', 'rev1', 'approve');
select ok(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')) = 'open'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('p:version')) = 'review',
  'one approval of two required leaves the review open and the candidate in review');
select pg_temp.s09d_decide('p', 'rev1', 'approve', '{}'::jsonb, 'p:repeat');
select is(pg_temp.s09d_outcome('p:repeat'), 'CONFLICT', 'the same human cannot decide twice (409)');
select pg_temp.s09d_decide('p', 'rev2', 'approve');
select ok(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')) = 'approved'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('p:version')) = 'approved'
  and (select r->>'distinctApprovalCount' = '2' from (select pg_temp.s09d_get_review('p:get', 'p') r) s),
  'approval happens exactly when the second distinct human approves');

-- Specialist slots (BE03a "Workflow policy registry"): a protected review whose
-- specialist capability no counted approver holds cannot be completed, and a
-- counted approver who loses the specialist capability is reviewer-authority drift.
select pg_temp.s09d_create_type('q', 'dec108decspecial', 'cms.disclosure.legal');
select pg_temp.s09d_to_review('q');
select pg_temp.s09d_assign('q', 'rev1');
select pg_temp.s09d_assign('q', 'rev2');
select pg_temp.s09d_decide('q', 'rev1', 'approve');
select pg_temp.s09d_decide('q', 'rev2', 'approve', '{}'::jsonb, 'q:completing');
select ok(pg_temp.s09d_outcome('q:decide:rev1') = 'OK' and pg_temp.s09d_outcome('q:completing') = 'CONFLICT'
  and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('q:review')) = 'open'
  and pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_review_decisions where review_id = %L',
      pg_temp.s09d_id('q:review'))) = '1',
  'the approval that would leave the specialist slot unsatisfiable is a 409 and records nothing');
select pg_temp.s09d_decide('q', 'rev2', 'reject', '{}'::jsonb, 'q:reject');
select ok(pg_temp.s09d_outcome('q:reject') = 'OK'
  and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('q:review')) = 'rejected',
  'a reject decision is never refused on the specialist-slot ground');
select pg_temp.s09d_create_type('u', 'dec108decspecialdrift', 'cms.disclosure.policy');
select pg_temp.s09d_to_review('u');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_assign('u', 'rev1');
select pg_temp.s09d_assign('u', 'rev2');
select pg_temp.s09d_decide('u', 'rev1', 'approve');
select pg_temp.s09d_decide('u', 'rev2', 'approve');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('u:review')), 'approved',
  'fixture: a protected review with a specialist holder is approved');
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s09d_id('ownerOrg')
   and person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid
   and capability_code = 'cms.reviewer.policy';
select ok(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('u:review')) = 'invalidated'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('u:version')) = 'draft',
  'a counted approver losing the specialist capability invalidates the approved review and returns the candidate to draft');

select ok(pg_temp.s09d_service_only('platform_api.cms_decide_schema_review(jsonb)')
  and to_regprocedure('platform_private.cms_decide_schema_review(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_decide_schema_review(jsonb)'), 'execute'), true),
  'the decision RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
