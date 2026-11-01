-- Slice 11 lane S11-3a: platform_api.cms_record_review_decision / platform_private (CMS-03B-06, DEC-136,
-- DEC-157, DEC-158(a); tracker P2-S11-AC-011 .. AC-016, AC-108 .. AC-110, AC-121).  One assigned
-- reviewer records ONE approve|reject; the first rejection ends the review; an approve fills the first
-- unfilled specialist slot its human holds; the review is approved exactly when the distinct qualifying
-- approvers equal the required count and every specialist slot is held.  This file covers the contract,
-- the committed effects, the slot rules and replay; the refusals and the invalidation outcomes are in
-- phase_02_slice_11_rpc_review_decision_refusals.sql.  RED before 20261005017630.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(34);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- The specialist reviewer rvX also holds cms.reviewer.policy (rvS already does).
select pg_temp.h11r_member('rvX', array['cms.reviewer', 'cms.reviewer.policy']);

-- rOne: ordinary policy (1 decision).  rReject: ordinary.  rTwo / rTwoB: two required decisions.
select pg_temp.r11_frozen_review('rOne', 'dec-one');
select pg_temp.r11_assign_now('rOne-rvA', 'rOne', 'rvA');
select pg_temp.r11_frozen_review('rReject', 'dec-reject');
select pg_temp.r11_assign_now('rReject-rvB', 'rReject', 'rvB');
select pg_temp.r11_frozen_review('rTwo', 'dec-two', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('rTwo-rvA', 'rTwo', 'rvA');
select pg_temp.r11_assign_now('rTwo-rvB', 'rTwo', 'rvB');
select pg_temp.r11_frozen_review('rTwoB', 'dec-two-b', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('rTwoB-rvA', 'rTwoB', 'rvA');
select pg_temp.r11_assign_now('rTwoB-rvB', 'rTwoB', 'rvB');
-- Protected: two humans, the second slot is the specialist capability cms.reviewer.policy.
select pg_temp.r11_frozen_review('rProt1', 'dec-prot-1', pg_temp.r11_protected());
select pg_temp.r11_frozen_review('rProt2', 'dec-prot-2', pg_temp.r11_protected());
select pg_temp.r11_frozen_review('rProt3', 'dec-prot-3', pg_temp.r11_protected());
select pg_temp.r11_assign_now(r.review || '-' || r.reviewer, r.review, r.reviewer)
  from (values ('rProt1', 'rvA'), ('rProt1', 'rvB'), ('rProt1', 'rvS'), ('rProt2', 'rvX'), ('rProt2', 'rvS'),
               ('rProt3', 'rvA'), ('rProt3', 'rvB')) as r(review, reviewer);

select is(
  (select string_agg(id.key || '=' || review.risk_class || '/' || review.required_decision_count || '/' || review.required_capabilities::text,
                     ';' order by id.key)
     from (values ('rOne'), ('rTwo'), ('rProt1')) as id(key)
     join platform_private.cms_editorial_reviews review on review.id = pg_temp.s11_id(id.key)),
  'rOne=ordinary/1/["cms.reviewer"];rProt1=protected/2/["cms.reviewer", "cms.reviewer.policy"];rTwo=ordinary/2/["cms.reviewer"]',
  'control: the reviews are frozen from the real editorial policy (ordinary, two-decision override, protected with a specialist slot)');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_record_review_decision(jsonb)'),
  'cms_record_review_decision is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-016]');
select ok(pg_temp.r11_posture('platform_api', 'cms_record_review_decision(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-016]');

-- ---------------------------------------------------------------------------
-- Approve (one required decision): the committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('a1', pg_temp.r11_dreq('rOne', 'approve'));
select pg_temp.r11_dcall('a1', 'rvA', (select request from r11_req where label = 'a1'));
select is(pg_temp.r11_out('a1'), '00000:', 'the assigned reviewer approves an open review [P2-S11-AC-011]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('a1')),
  'activationEvidence,createdAt,decidedAt,dependencyHash,entryId,frozenHash,id,invalidatedReason,recordedDecisionCount,requiredDecisionCount,revisionId,riskClass,state,submittedAt,updatedAt,version,workflowPolicy',
  'the response is exactly EditorialReviewResource (17 members) [P2-S11-AC-011]');
select ok(
  pg_temp.r11_resp('a1')->>'state' = 'approved' and pg_temp.r11_resp('a1')->>'version' = '2'
    and (pg_temp.r11_resp('a1')->>'recordedDecisionCount')::integer = 1
    and (pg_temp.r11_resp('a1')->>'requiredDecisionCount')::integer = 1
    and pg_temp.r11_resp('a1')->>'decidedAt' is not null and pg_temp.r11_resp('a1')->'invalidatedReason' = 'null'::jsonb
    and pg_temp.r11_resp('a1')->>'id' = pg_temp.s11_id('rOne')::text
    and pg_temp.r11_resp('a1')->>'riskClass' = 'ordinary'
    and pg_temp.r11_resp('a1')#>>'{workflowPolicy,key}' = 'editorial',
  'the single required approve reaches approved at version 2 with decidedAt set and the frozen policy evidence [P2-S11-AC-109]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('a1'), array[
    pg_temp.s11_id('rvA')::text, pg_temp.s11_id('editor')::text, pg_temp.s11_id('creator')::text,
    pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'rvA'),
    'Reads well']),
  'the response carries no reviewer, submitter, author, party or account identifier and no reason text [P2-S11-AC-013]');
select ok(
  exists (
    select 1 from platform_private.cms_editorial_decisions decision
     where decision.review_id = pg_temp.s11_id('rOne')
       and decision.reviewer_person_id = pg_temp.s11_id('rvA')
       and decision.owner_id = pg_temp.s11_id('org') and decision.acting_party_id = pg_temp.s11_id('org')
       and decision.state = 'recorded' and decision.version = 1 and decision.updated_at = decision.created_at
       and decision.decision = 'approve' and decision.capability = 'cms.reviewer'
       and decision.assignment_id = pg_temp.s11_id('rOne-rvA') and decision.assignment_version = 1
       and decision.reason = 'Reads well; approved.'
       and decision.comment_hash = pg_temp.h11_sha256('Reads well; approved.')
       and decision.reviewed_hash = (select frozen_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rOne'))
       and abs(extract(epoch from decision.step_up_at
             - (select (request->'context'->>'stepUpAt')::timestamptz from r11_req where label = 'a1'))) < 0.001
       and decision.decided_at >= decision.step_up_at),
  'the decision row stores the server-derived reviewer, slot, assignment, MFA instant, frozen reviewed hash, reason and its SHA-256 comment hash [P2-S11-AC-109]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.editorial.review.decide' and audit.target_type = 'cms_editorial_decision'
      and audit.target_id = (select id from platform_private.cms_editorial_decisions where review_id = pg_temp.s11_id('rOne'))
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'rvA')
      and audit.reason_code = 'CMS_EDITORIAL_REVIEW_DECIDED')
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rOne')
            and event.aggregate_type = 'cms_editorial_review' and event.aggregate_version = 2
            and event.payload = jsonb_build_object('reviewId', pg_temp.s11_id('rOne'),
                  'revisionId', (select revision_id from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rOne')))),
  'exactly one audit record and one identifier-only cms.entry.review-changed.v1 at the new review version commit with the decision [P2-S11-AC-016]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 'a1')), 'completed',
  'the idempotency reservation is completed with the decision [P2-S11-AC-014]');
insert into r11_snap(label, effects) values ('after-a1', pg_temp.r11_effects());
select pg_temp.r11_dcall('a1-replay', 'rvA', (select request from r11_req where label = 'a1'));
select ok(pg_temp.r11_out('a1-replay') = '00000:' and pg_temp.r11_resp('a1-replay') = pg_temp.r11_resp('a1')
    and pg_temp.r11_effects() = (select effects from r11_snap where label = 'after-a1'),
  'an exact replay returns the stored response and adds no decision, audit record, event or reservation [P2-S11-AC-014]');
select pg_temp.r11_dcall('a1-mismatch', 'rvA', jsonb_set((select request from r11_req where label = 'a1'), '{reason}', '"Changed my mind."'));
select is(pg_temp.r11_out('a1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH', 'the same key with a changed reason is IDEMPOTENCY_MISMATCH [P2-S11-AC-014]');
select pg_temp.r11_dcall('a1-after', 'rvA', pg_temp.r11_dreq('rOne', 'approve'));
select is(pg_temp.r11_out('a1-after'), 'P0001:review_not_open', 'a second attempt on the approved review is review_not_open [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- Reject ends the review terminally.
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('r1', 'rvB', pg_temp.r11_dreq('rReject', 'reject'));
select ok(pg_temp.r11_out('r1') = '00000:' and pg_temp.r11_resp('r1')->>'state' = 'rejected'
    and pg_temp.r11_resp('r1')->>'version' = '2' and pg_temp.r11_resp('r1')->>'decidedAt' is not null
    and (pg_temp.r11_resp('r1')->>'recordedDecisionCount')::integer = 1,
  'a reject sets the review rejected immediately and terminally at version 2 [P2-S11-AC-109]');
select ok(exists (select 1 from platform_private.cms_editorial_decisions decision
                   where decision.review_id = pg_temp.s11_id('rReject') and decision.decision = 'reject'
                     and decision.capability = 'cms.reviewer' and decision.reason = 'Needs work; rejected.'),
  'the reject row carries the base slot capability cms.reviewer [P2-S11-AC-121]');
select pg_temp.r11_dcall('r1-after', 'rvB', pg_temp.r11_dreq('rReject', 'approve'));
select is(pg_temp.r11_out('r1-after'), 'P0001:review_not_open', 'a rejected review accepts no further decision [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- Two required decisions: open until the second distinct approver; the first rejection ends it.
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('t1', 'rvA', pg_temp.r11_dreq('rTwo', 'approve'));
select ok(pg_temp.r11_out('t1') = '00000:' and pg_temp.r11_resp('t1')->>'state' = 'open'
    and pg_temp.r11_resp('t1')->>'version' = '2' and (pg_temp.r11_resp('t1')->>'recordedDecisionCount')::integer = 1
    and pg_temp.r11_resp('t1')->'decidedAt' = 'null'::jsonb,
  'the first of two approvals leaves the review open at version 2 with no decidedAt [P2-S11-AC-109]');
select pg_temp.r11_dcall('t1-dup', 'rvA', pg_temp.r11_dreq('rTwo', 'approve'));
select is(pg_temp.r11_out('t1-dup'), 'P0001:duplicate_decision', 'one human records at most one decision per review [P2-S11-AC-108]');
select pg_temp.r11_dcall('t2', 'rvB', pg_temp.r11_dreq('rTwo', 'approve'));
select ok(pg_temp.r11_out('t2') = '00000:' and pg_temp.r11_resp('t2')->>'state' = 'approved'
    and pg_temp.r11_resp('t2')->>'version' = '3' and (pg_temp.r11_resp('t2')->>'recordedDecisionCount')::integer = 2
    and platform_private.cms_editorial_review_distinct_approvals(pg_temp.s11_id('rTwo')) = 2,
  'the second distinct approver reaches the required count: approved at version 3 with two distinct qualifying approvers [P2-S11-AC-109]');
select pg_temp.r11_dcall('u1', 'rvA', pg_temp.r11_dreq('rTwoB', 'approve'));
select pg_temp.r11_dcall('u2', 'rvB', pg_temp.r11_dreq('rTwoB', 'reject'));
select ok(pg_temp.r11_out('u2') = '00000:' and pg_temp.r11_resp('u2')->>'state' = 'rejected'
    and pg_temp.r11_rv('rTwoB') = 'rejected/3/2'
    and platform_private.cms_editorial_review_distinct_approvals(pg_temp.s11_id('rTwoB')) = 1,
  'the first rejection ends a review that already holds an approval; the approve still recounts but cannot approve it [P2-S11-AC-109]');

-- ---------------------------------------------------------------------------
-- Specialist slots (protected policy, requiredCapabilities [cms.reviewer, cms.reviewer.policy]).
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('p1-a', 'rvA', pg_temp.r11_dreq('rProt1', 'approve'));
select ok(pg_temp.r11_out('p1-a') = '00000:' and pg_temp.r11_rv('rProt1') = 'open/2/1'
    and (select capability from platform_private.cms_editorial_decisions
          where review_id = pg_temp.s11_id('rProt1') and reviewer_person_id = pg_temp.s11_id('rvA')) = 'cms.reviewer',
  'a base-only reviewer approves first: the base slot, the review stays open (one approval still possible for the specialist slot) [P2-S11-AC-109]');
insert into r11_snap(label, effects) values ('before-unsat', pg_temp.r11_effects());
select pg_temp.r11_dcall('p1-b', 'rvB', pg_temp.r11_dreq('rProt1', 'approve'));
select ok(pg_temp.r11_out('p1-b') = 'P0001:specialist_slot_unsatisfiable'
    and pg_temp.r11_effects() = (select effects from r11_snap where label = 'before-unsat'),
  'a second base-only approve is refused specialist_slot_unsatisfiable (no approval left for the unfilled specialist slot) and changes nothing [P2-S11-AC-109]');
select pg_temp.r11_dcall('p1-s', 'rvS', pg_temp.r11_dreq('rProt1', 'approve'));
select ok(pg_temp.r11_out('p1-s') = '00000:' and pg_temp.r11_resp('p1-s')->>'state' = 'approved'
    and (select capability from platform_private.cms_editorial_decisions
          where review_id = pg_temp.s11_id('rProt1') and reviewer_person_id = pg_temp.s11_id('rvS')) = 'cms.reviewer.policy',
  'the specialist approves: the first unfilled specialist slot they hold is satisfied and the review is approved [P2-S11-AC-109]');
select pg_temp.r11_dcall('p2-x', 'rvX', pg_temp.r11_dreq('rProt2', 'approve'));
select pg_temp.r11_dcall('p2-s', 'rvS', pg_temp.r11_dreq('rProt2', 'approve'));
select ok(pg_temp.r11_out('p2-x') = '00000:' and pg_temp.r11_out('p2-s') = '00000:'
    and pg_temp.r11_resp('p2-s')->>'state' = 'approved'
    and (select string_agg(reviewer.key || ':' || decision.capability, ',' order by reviewer.key)
           from platform_private.cms_editorial_decisions decision
           join (values ('rvX'), ('rvS')) reviewer(key) on pg_temp.s11_id(reviewer.key) = decision.reviewer_person_id
          where decision.review_id = pg_temp.s11_id('rProt2')) = 'rvS:cms.reviewer,rvX:cms.reviewer.policy',
  'when the specialist slot is already filled by a counted approver a second specialist fills the base slot [P2-S11-AC-109]');
select pg_temp.r11_dcall('p3-a', 'rvA', pg_temp.r11_dreq('rProt3', 'approve'));
select pg_temp.r11_dcall('p3-b', 'rvB', pg_temp.r11_dreq('rProt3', 'reject'));
select ok(pg_temp.r11_out('p3-b') = '00000:' and pg_temp.r11_resp('p3-b')->>'state' = 'rejected',
  'a reject is never refused on the specialist-slot ground [P2-S11-AC-109]');

select * from finish();
rollback;
