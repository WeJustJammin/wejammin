-- Slice 11 lane S11-3a: platform_api.cms_assign_editorial_reviewer / platform_private (CMS-03B-18,
-- DEC-136, DEC-157, DEC-158(b); tracker P2-S11-AC-067 .. AC-071, AC-119).  The receipt-derived
-- owner creates or revokes a bounded read+decide assignment on one OPEN review.  This file covers
-- the contract, the committed effects, replay, the step-up gate and the reason rules; the refusals
-- are in phase_02_slice_11_rpc_review_assign_refusals.sql.  RED before 20261005017620.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(38);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/010-assign.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- Every revision of entry A is inserted BEFORE any review: a later, newer revision of the entry
-- invalidates the older live reviews (revision_superseded, the Slice 11 producer trigger).
select pg_temp.r11_revision('revR2', 22);
-- r1: the review under test (open v1 on revA1, authored by the creator, submitted by the editor).
select pg_temp.h11r_review('r1');
-- r2: a second open review whose assignment r1 must never be able to reach.
select pg_temp.h11r_review('r2', jsonb_build_object('revision_id', pg_temp.s11_id('revR2')));

-- ---------------------------------------------------------------------------
-- Shape, privileges and the code-point reason bound.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_assign_editorial_reviewer(jsonb)'),
  'cms_assign_editorial_reviewer is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-070]');
select ok(pg_temp.r11_posture('platform_api', 'cms_assign_editorial_reviewer(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-070]');
select ok(
  pg_temp.h11_private_definer('cms_editorial_step_up_instant(jsonb)')
    and pg_temp.h11_private_definer('cms_editorial_review_scopes(uuid,uuid,uuid)')
    and pg_temp.h11_private_definer('cms_editorial_review_resource(uuid)')
    and pg_temp.h11_private_definer('cms_editorial_assignment_resource(uuid)'),
  'the shared review-authority helpers are private definers with no API-role execute [P2-S11-AC-069]');
select ok(
  pg_temp.s11_condef('platform_private.cms_editorial_review_assignments',
    'cms_editorial_review_assignments_reason_check') like '%char_length(reason)%256%',
  'the stored assignment reason is bounded in Unicode code points, not octets (DEC-158(b)) [P2-S11-AC-068]');

-- ---------------------------------------------------------------------------
-- Create: the committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('c1', pg_temp.r11_areq('r1', 'create'));
insert into r11_snap(label, effects) values ('before-c1', pg_temp.r11_effects());
select pg_temp.r11_acall('c1', 'owner', (select request from r11_req where label = 'c1'));

select is(pg_temp.r11_out('c1'), '00000:',
  'the receipt-derived owner creates a reviewer assignment on an open review [P2-S11-AC-067]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('c1')),
  'actions,capability,createdAt,expiresAt,id,reason,reviewId,startsAt,state,updatedAt,version',
  'the resource is exactly EditorialReviewAssignmentResource: meta, reviewId, state, capability, actions, window, reason [P2-S11-AC-067]');
select ok(
  pg_temp.r11_resp('c1')->>'state' = 'active'
    and pg_temp.r11_resp('c1')->>'version' = '1'
    and pg_temp.r11_resp('c1')->>'capability' = 'cms.editorial_review'
    and pg_temp.r11_resp('c1')->'actions' = '["read","decide"]'::jsonb
    and pg_temp.r11_resp('c1')->>'reviewId' = pg_temp.s11_id('r1')::text
    and pg_temp.r11_resp('c1') ? 'reason'
    and pg_temp.r11_resp('c1')->'reason' = 'null'::jsonb,
  'a created assignment is active at version 1, confers exactly read and decide on this review and carries a null reason when none was given [P2-S11-AC-067]');
select ok(
  (pg_temp.r11_resp('c1')->>'expiresAt')::timestamptz = (select (request->>'expiresAt')::timestamptz from r11_req where label = 'c1')
    and (pg_temp.r11_resp('c1')->>'expiresAt')::timestamptz > (pg_temp.r11_resp('c1')->>'startsAt')::timestamptz
    and (pg_temp.r11_resp('c1')->>'expiresAt')::timestamptz <= (pg_temp.r11_resp('c1')->>'startsAt')::timestamptz + interval '7 days',
  'the window ends at the requested expiry, after it starts and within seven days [P2-S11-AC-068]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('c1'), array[
    pg_temp.s11_id('rvA')::text, pg_temp.s11_id('creator')::text, pg_temp.s11_id('editor')::text,
    pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner'),
    (select auth_user_id::text from r11_actor where key = 'rvA')]),
  'the response names no reviewer, grantor, owner, party or account identifier [P2-S11-AC-069]');
select ok(
  exists (
    select 1 from platform_private.cms_editorial_review_assignments assignment
     where assignment.id = (pg_temp.r11_resp('c1')->>'id')::uuid
       and assignment.review_id = pg_temp.s11_id('r1')
       and assignment.owner_id = pg_temp.s11_id('org')
       and assignment.reviewer_person_id = pg_temp.s11_id('rvA')
       and assignment.grantor_person_id = pg_temp.s11_id('creator')
       and assignment.state = 'active' and assignment.version = 1
       and assignment.capability_key = 'cms.editorial_review'
       and assignment.actions = array['read', 'decide']::text[]
       and assignment.ends_at = (select (request->>'expiresAt')::timestamptz from r11_req where label = 'c1')
       and assignment.starts_at <= clock_timestamp()),
  'the row stores the server-resolved reviewer and grantor, the fixed capability and actions, and the requested window [P2-S11-AC-119]');
select ok(
  exists (select 1 from platform_private.cms_editorial_reviews review
           where review.id = pg_temp.s11_id('r1') and review.version = 1 and review.state = 'open'
             and review.recorded_decision_count = 0),
  'creating an assignment leaves the review version, state and decision count unchanged [P2-S11-AC-070]');
select is(
  (select count(*)::integer from audit_private.audit_events audit
    where audit.action = 'cms.editorial.review.assignment.create' and audit.target_id = pg_temp.s11_id('r1')
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'owner')
      and audit.acting_party_id = pg_temp.s11_id('org')
      and audit.reason_code = 'CMS_EDITORIAL_REVIEW_ASSIGNMENT_CHANGED'),
  1, 'exactly one audit record is committed for the creation [P2-S11-AC-070]');
select ok(
  (select count(*) = 1 from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('r1')
      and event.aggregate_type = 'cms_editorial_review' and event.aggregate_version = 1
      and event.payload = jsonb_build_object('reviewId', pg_temp.s11_id('r1'), 'revisionId', pg_temp.s11_id('revA1'))),
  'exactly one identifier-only cms.entry.review-changed.v1 is committed, aggregated on the review at its unchanged version [P2-S11-AC-070]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 'c1')), 'completed',
  'the idempotency reservation is completed with the command [P2-S11-AC-070]');

-- ---------------------------------------------------------------------------
-- Replay and mismatch.
-- ---------------------------------------------------------------------------
insert into r11_snap(label, effects) values ('after-c1', pg_temp.r11_effects());
select pg_temp.r11_acall('c1-replay', 'owner', (select request from r11_req where label = 'c1'));
select ok(pg_temp.r11_out('c1-replay') = '00000:' and pg_temp.r11_resp('c1-replay') = pg_temp.r11_resp('c1'),
  'an exact replay returns the stored response unchanged [P2-S11-AC-071]');
select is(pg_temp.r11_effects(), (select effects from r11_snap where label = 'after-c1'),
  'the replay adds no assignment, audit record, outbox event or reservation [P2-S11-AC-071]');
select pg_temp.r11_acall('c1-mismatch', 'owner', jsonb_set(
  (select request from r11_req where label = 'c1'), '{expiresAt}',
  to_jsonb(to_char((clock_timestamp() + interval '5 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
select is(pg_temp.r11_out('c1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH',
  'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- Revoke.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('v1', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.r11_resp('c1')->>'id')));
select ok(
  pg_temp.r11_out('v1') = '00000:'
    and pg_temp.r11_resp('v1')->>'state' = 'revoked' and pg_temp.r11_resp('v1')->>'version' = '2'
    and pg_temp.r11_resp('v1')->>'id' = pg_temp.r11_resp('c1')->>'id'
    and pg_temp.r11_keys(pg_temp.r11_resp('v1')) = pg_temp.r11_keys(pg_temp.r11_resp('c1')),
  'revoking returns the same assignment, revoked, at version 2 [P2-S11-AC-067]');
select ok(
  exists (select 1 from platform_private.cms_editorial_review_assignments assignment
           where assignment.id = (pg_temp.r11_resp('c1')->>'id')::uuid and assignment.state = 'revoked' and assignment.version = 2)
    and exists (select 1 from platform_private.cms_editorial_reviews review
                 where review.id = pg_temp.s11_id('r1') and review.version = 1 and review.state = 'open'),
  'the revoke moves only the assignment (active -> revoked, version + 1); the review is untouched [P2-S11-AC-070]');
select is(
  (select count(*)::integer from audit_private.audit_events audit
    where audit.action = 'cms.editorial.review.assignment.revoke' and audit.target_id = pg_temp.s11_id('r1')),
  1, 'exactly one audit record is committed for the revoke [P2-S11-AC-070]');
select is(
  (select count(*)::integer from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('r1')
      and event.aggregate_version = 1),
  2, 'the create and the revoke each emitted one review-changed event, both at the unchanged review version [P2-S11-AC-070]');
select pg_temp.r11_acall('v1-again', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.r11_resp('c1')->>'id')));
select is(pg_temp.r11_out('v1-again'), 'P0001:CONFLICT',
  'revoking an already revoked assignment is a 409 conflict [P2-S11-AC-068]');
select pg_temp.r11_acall('v-missing', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', extensions.gen_random_uuid())));
select is(pg_temp.r11_out('v-missing'), 'P0001:NOT_FOUND', 'revoking a missing assignment is 404 [P2-S11-AC-068]');
select pg_temp.h11r_assign('other-asg', 'r2', 'rvB');
select pg_temp.r11_acall('v-foreign', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('other-asg'))));
select is(pg_temp.r11_out('v-foreign'), 'P0001:NOT_FOUND',
  'an assignment of another review is indistinguishable from a missing one [P2-S11-AC-068]');
select ok(
  exists (select 1 from platform_private.cms_editorial_review_assignments where id = pg_temp.s11_id('other-asg') and state = 'active' and version = 1),
  'the refused foreign revoke changed nothing [P2-S11-AC-071]');
select pg_temp.r11_acall('c1-again', 'owner', pg_temp.r11_areq('r1', 'create'));
select is(pg_temp.r11_out('c1-again'), '00000:',
  'after a revoke the same reviewer can be assigned again (only an active row occupies the unique slot) [P2-S11-AC-119]');
select pg_temp.r11_acall('c1-again-revoke', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.r11_resp('c1-again')->>'id')));

-- ---------------------------------------------------------------------------
-- Reason: 1..256 Unicode code points, already NFC, nothing else (DEC-158(b)).
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('reason-256', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvB'), 'reason', repeat(U&'\00E9', 256))));
select ok(pg_temp.r11_out('reason-256') = '00000:' and pg_temp.r11_resp('reason-256')->>'reason' = repeat(U&'\00E9', 256)
    and (select assignment.reason = repeat(U&'\00E9', 256) from platform_private.cms_editorial_review_assignments assignment
          where assignment.id = (pg_temp.r11_resp('reason-256')->>'id')::uuid),
  'a 256-code-point reason (512 octets) is accepted and stored verbatim [P2-S11-AC-068]');
select pg_temp.r11_acall('reason-257', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'reason', repeat(U&'\00E9', 257))), false);
select pg_temp.r11_acall('reason-empty', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'reason', '')), false);
select pg_temp.r11_acall('reason-nfd', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'reason', 'e' || U&'\0301')), false);
select pg_temp.r11_acall('reason-number', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'reason', 5)), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || pg_temp.r11_detail(label), ';' order by label)
     from (values ('reason-257'), ('reason-empty'), ('reason-nfd'), ('reason-number')) as v(label)),
  'reason-257=P0001:VALIDATION_FAILED["/reason"];reason-empty=P0001:VALIDATION_FAILED["/reason"];reason-nfd=P0001:VALIDATION_FAILED["/reason"];reason-number=P0001:VALIDATION_FAILED["/reason"]',
  'a reason of 257 code points, an empty reason, a non-NFC reason and a non-string reason are each VALIDATION_FAILED at /reason (refused, never normalized) [P2-S11-AC-068]');
select pg_temp.r11_acall('reason-plain', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'reason', E'Legal <b>copy</b>\nplease')), false);
select ok(pg_temp.r11_out('reason-plain') = '00000:' and pg_temp.r11_resp('reason-plain')->>'reason' = E'Legal <b>copy</b>\nplease',
  'no SafeText exclusion applies to an assignment reason: markup characters and a newline are accepted (DEC-158(b)) [P2-S11-AC-068]');

-- ---------------------------------------------------------------------------
-- Step-up: unconditional, verified first, reserves nothing, changes nothing.
-- ---------------------------------------------------------------------------
insert into r11_snap(label, effects) values ('before-stepup', pg_temp.r11_effects());
select pg_temp.r11_acall('su-stale', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'context', pg_temp.r11_ctx(interval '611 seconds'))));
select pg_temp.r11_acall('su-future', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'context', pg_temp.r11_ctx(interval '-40 seconds'))));
select pg_temp.r11_acall('su-unverified', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'context', pg_temp.r11_ctx(interval '60 seconds', false))));
select pg_temp.r11_acall('su-absent', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'context', pg_temp.r11_ctx() - 'stepUpAt')));
select pg_temp.r11_acall('su-malformed', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'context', pg_temp.r11_ctx() || '{"stepUpAt":"yesterday"}'::jsonb)));
select pg_temp.r11_acall('su-hidden', 'stranger', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))));
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('su-stale'), ('su-future'), ('su-unverified'), ('su-absent'), ('su-malformed'), ('su-hidden')) as v(label)),
  'su-absent=P0001:STEP_UP_REQUIRED;su-future=P0001:STEP_UP_REQUIRED;su-hidden=P0001:STEP_UP_REQUIRED;su-malformed=P0001:STEP_UP_REQUIRED;su-stale=P0001:STEP_UP_REQUIRED;su-unverified=P0001:STEP_UP_REQUIRED',
  'a stale (> 600 s), future (> 30 s), unverified, absent or malformed proof is STEP_UP_REQUIRED, and it is evaluated before concealment (a hidden review is not disclosed) [P2-S11-AC-071]');
select is(pg_temp.r11_effects(), (select effects from r11_snap where label = 'before-stepup'),
  'the step-up refusals reserved no idempotency record and changed no state [P2-S11-AC-071]');
select pg_temp.r11_acall('su-edge-ok', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'context', pg_temp.r11_ctx(interval '590 seconds'))), false);
select pg_temp.r11_acall('su-skew-ok', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'context', pg_temp.r11_ctx(interval '-20 seconds'))), false);
select is(pg_temp.r11_out('su-edge-ok') || '|' || pg_temp.r11_out('su-skew-ok'), '00000:|00000:',
  'a proof 590 s old and a proof 20 s in the future (within the 600 s window and the 30 s skew) are accepted [P2-S11-AC-071]');

select * from finish();
rollback;
