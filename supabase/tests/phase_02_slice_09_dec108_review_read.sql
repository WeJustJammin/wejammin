commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-13 read schema review (BE03a route row,
-- field matrix, "Database invariants" read-only rule, G13, G16).  The read is a
-- capability-scoped projection with zero side effects.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('a', 'dec108read');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1');
create temp table s09d_read_baseline on commit drop as select pg_temp.s09d_fingerprint() as fingerprint;

select pg_temp.s09d_get_review('a:owner', 'a', 'owner');
select is(pg_temp.s09d_outcome('a:owner'), 'OK', 'the submitting schema designer reads the review [P2-S09-AC-451]');
select ok((select r->>'resourceKind' = 'schema_review' and r->>'state' = 'open'
    and r->>'id' = pg_temp.s09d_id('a:review')::text and r ?& array['contentHash','version','createdAt','updatedAt']
    and r->'frozenEvidence'->>'definitionHash' ~ '^[a-f0-9]{64}$' and jsonb_typeof(r->'decisions') = 'array'
    and (r->'permittedNextActions') ? 'assign_reviewer'
    from (select pg_temp.s09d_resp('a:owner') r) s),
  'the open review shows its frozen evidence and offers the owner assignment');
select ok((select r->>'contentHash' ~ '^[a-f0-9]{64}$' and r->>'contentHash' = platform_private.cms_jcs_sha256(r - 'contentHash')
    from (select pg_temp.s09d_resp('a:owner') r) s),
  'contentHash is the SHA-256 of the RFC 8785/JCS canonical JSON of the resource excluding contentHash (G16)');
select ok(coalesce((select bool_and(position(needle in r::text) = 0)
    from (select pg_temp.s09d_resp('a:owner') r) s, (values
      (pg_temp.s09d_actor_id('owner', 'auth')), (pg_temp.s09d_actor_id('owner', 'person')),
      (pg_temp.s09d_actor_id('owner', 'binding')), (pg_temp.s09d_actor_id('rev1', 'auth')),
      (pg_temp.s09d_actor_id('rev1', 'person')), (pg_temp.s09d_actor_id('rev1', 'binding'))) n(needle)), false),
  'the projection exposes no actor, person, party, reviewer, grantor or private binding identifier');
select pg_temp.s09d_get_review('a:designer2', 'a', 'designer2');
select is(pg_temp.s09d_outcome('a:designer2'), 'OK', 'any schema designer in the review''s owner scope may read it [P2-S09-AC-451]');
select pg_temp.s09d_get_review('a:rev1', 'a', 'rev1');
select is(pg_temp.s09d_outcome('a:rev1'), 'OK', 'an assigned review-only human reads the review without any CMS capability [P2-S09-AC-452]');
select ok((select r->'permittedNextActions' ? 'record_decision' and not (r->'permittedNextActions' ? 'assign_reviewer')
    and not (r->'permittedNextActions' ? 'activate')
    from (select pg_temp.s09d_resp('a:rev1') r) s),
  'the assigned reviewer''s next actions are limited to recording a decision [P2-S09-AC-452]');
select pg_temp.s09d_get_review('a:rev2', 'a', 'rev2');
select is(pg_temp.s09d_outcome('a:rev2'), 'NOT_FOUND', 'an unassigned human sees the review as absent [P2-S09-AC-452]');
select pg_temp.s09d_get_review('a:other', 'a', 'other');
select is(pg_temp.s09d_outcome('a:other'), 'NOT_FOUND', 'another organization''s designer sees the review as absent');
select pg_temp.s09d_session('owner');
select pg_temp.s09d_call('a:absent', 'platform_api.cms_get_schema_review', jsonb_build_object(
  'reviewId', extensions.gen_random_uuid(), 'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('a:absent'), 'NOT_FOUND', 'a missing review is indistinguishable from a concealed one (404)');
select pg_temp.s09d_call('a:malformed', 'platform_api.cms_get_schema_review', jsonb_build_object(
  'reviewId', 'not-a-uuid', 'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('a:malformed'), 'INVALID_REQUEST', 'a malformed review UUID is a 400 INVALID_REQUEST');
select pg_temp.s09d_call('a:idem', 'platform_api.cms_get_schema_review', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'idempotencyKey', 's09d-read-idem-0001', 'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('a:idem'), 'INVALID_REQUEST', 'a mutation-only Idempotency-Key on the GET is a 400 INVALID_REQUEST');
select pg_temp.s09d_call('a:ifmatch', 'platform_api.cms_get_schema_review', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'ifMatch', '"1"', 'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('a:ifmatch'), 'INVALID_REQUEST', 'a mutation-only If-Match on the GET is a 400 INVALID_REQUEST');
select pg_temp.s09d_call('a:extra', 'platform_api.cms_get_schema_review', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'expand', 'decisions', 'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('a:extra'), 'INVALID_REQUEST', 'an unknown query/key is a 400 INVALID_REQUEST');
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('app.auth_user_id', '', true);
select set_config('app.actor_auth_user_id', '', true);
select pg_temp.s09d_call('a:anon', 'platform_api.cms_get_schema_review', jsonb_build_object('reviewId', pg_temp.s09d_id('a:review')));
select is(pg_temp.s09d_outcome('a:anon'), 'UNAUTHENTICATED', 'a request without a verified actor is a 401 UNAUTHENTICATED');
select ok(pg_temp.s09d_outcome('a:owner') = 'OK' and pg_temp.s09d_outcome('a:rev1') = 'OK'
  and pg_temp.s09d_fingerprint() = (select fingerprint from s09d_read_baseline),
  'successful and rejected reads leave definitions, reviews, assignments, idempotency, audit and outbox byte-for-byte unchanged [P2-S09-AC-453]');

-- Decision history after an approval (the projection carries references only).
select pg_temp.s09d_decide('a', 'rev1', 'approve');
select pg_temp.s09d_get_review('a:after', 'a', 'owner');
select ok((select r->>'state' = 'approved' and (r->>'distinctApprovalCount')::int = 1
    and (r->>'recordedDecisionCount')::int = 1 and jsonb_array_length(r->'decisions') = 1
    and r->'decisions'->0 ?& array['id','decision','capability','decidedAt']
    and r->'decisions'->0->>'id' = pg_temp.s09d_id('a:decision:rev1')::text
    and r->>'approvalEvidenceHash' ~ '^[a-f0-9]{64}$' and r->>'decidedAt' is not null
    and not (r->'decisions'->0 ? 'reviewerPersonId')
    from (select pg_temp.s09d_resp('a:after') r) s),
  'an approved review projects exactly the decision references, the evidence digest and the decision time');

-- A revoked human stops counting without erasing the recorded decision (protected policy).
select pg_temp.s09d_create_type('p', 'dec108readprot', 'cms.disclosure.policy');
select pg_temp.s09d_to_review('p');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_assign('p', 'rev1');
select pg_temp.s09d_assign('p', 'rev2');
select pg_temp.s09d_decide('p', 'rev1', 'approve');
select pg_temp.s09d_rpc('p:revoke', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('p:review'), 'action', 'revoke',
    'expectedVersion', pg_temp.s09d_review_version('p'), 'assignmentId', pg_temp.s09d_id('p:assignment:rev1'),
    'idempotencyKey', 's09d-read-revoke-0001'), true);
select pg_temp.s09d_get_review('p:after', 'p', 'owner');
select ok((select r->>'state' = 'open' and (r->>'recordedDecisionCount')::int = 1 and (r->>'distinctApprovalCount')::int = 0
    from (select pg_temp.s09d_resp('p:after') r) s),
  'after a revoke the recorded decision remains but no longer counts toward distinctApprovalCount [P2-S09-AC-447]');

select ok(pg_temp.s09d_service_only('platform_api.cms_get_schema_review(jsonb)')
  and to_regprocedure('platform_private.cms_get_schema_review(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_get_schema_review(jsonb)'), 'execute'), true),
  'the review-read RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
