-- Slice 11 lane S11-3a: the CMS-03B-18 revoke path and a counted approve (DEC-161, BE03b "Review
-- invalidation": "reviewer_authority_changed ... or a counted approver's assignment is revoked while
-- the review is open"; tracker P2-S11-AC-070, AC-112).  Revoking the assignment that authorized a
-- COUNTED approve decision of an OPEN review also invalidates the review reviewer_authority_changed
-- (cms_invalidate_editorial_review, DEC-157 lock order: the review row is already held); every other
-- create or revoke leaves the review state and version unchanged.  The revoke still answers 200 with
-- the assignment resource.  RED before the DEC-161 edit of 20261005017620.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(20);

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
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;
create temp table r11_req(label text primary key, request jsonb not null) on commit drop;

-- Every revision of entry A is inserted before any review (a newer revision invalidates older live reviews).
select pg_temp.r11_revision('rev-counted', 51);
select pg_temp.r11_revision('rev-uncounted', 52);
select pg_temp.r11_revision('rev-lapsed', 53);
select pg_temp.r11_revision('rev-plain', 54);

-- A two-decision review in which rvA's approve is recorded under rvA's assignment.
create or replace function pg_temp.r11_with_approve(p_review text, p_revision text)
returns void
language plpgsql
as $body$
begin
  perform pg_temp.h11r_review(p_review, jsonb_build_object(
    'revision_id', pg_temp.s11_id(p_revision), 'required_decision_count', 2));
  perform pg_temp.r11_assign_now(p_review || '-rvA', p_review, 'rvA');
  perform pg_temp.r11_assign_now(p_review || '-rvB', p_review, 'rvB');
  perform pg_temp.r11_decide_now(p_review || '-dec', p_review, 'rvA', p_review || '-rvA', 'approve');
end;
$body$;
select pg_temp.r11_with_approve('rCounted', 'rev-counted');
select pg_temp.r11_with_approve('rUncounted', 'rev-uncounted');
select pg_temp.r11_with_approve('rLapsed', 'rev-lapsed');
-- A review with an assignment and no decision at all.
select pg_temp.h11r_review('rPlain', jsonb_build_object('revision_id', pg_temp.s11_id('rev-plain')));
select pg_temp.r11_assign_now('rPlain-rvA', 'rPlain', 'rvA');

select is(
  (select string_agg(id.key || '=' || review.state || '/' || review.version || '/' || review.recorded_decision_count, ',' order by id.key)
     from (values ('rCounted'), ('rUncounted'), ('rLapsed'), ('rPlain')) as id(key)
     join platform_private.cms_editorial_reviews review on review.id = pg_temp.s11_id(id.key)),
  'rCounted=open/2/1,rLapsed=open/2/1,rPlain=open/1/0,rUncounted=open/2/1',
  'control: three open reviews hold one recorded approve by rvA, one holds none');
select is(platform_private.cms_editorial_review_distinct_approvals(pg_temp.s11_id('rCounted')), 1,
  'control: rvA''s approve counts while its assignment is active');

-- ---------------------------------------------------------------------------
-- The assignment of a counted approve is revoked: the open review is invalidated.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('v-counted', pg_temp.r11_areq('rCounted', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('rCounted-rvA'))));
select pg_temp.r11_acall('v-counted', 'owner', (select request from r11_req where label = 'v-counted'));
select ok(
  pg_temp.r11_out('v-counted') = '00000:' and pg_temp.r11_resp('v-counted')->>'state' = 'revoked'
    and pg_temp.r11_resp('v-counted')->>'version' = '2' and pg_temp.r11_resp('v-counted')->>'id' = pg_temp.s11_id('rCounted-rvA')::text
    and pg_temp.r11_keys(pg_temp.r11_resp('v-counted')) = 'actions,capability,createdAt,expiresAt,id,reason,reviewId,startsAt,state,updatedAt,version',
  'the revoke still answers with the assignment resource, revoked at version 2 [P2-S11-AC-112]');
select ok(
  pg_temp.r11_rv('rCounted') = 'invalidated/3/1'
    and (select invalidated_reason from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rCounted')) = 'reviewer_authority_changed'
    and (select decided_at from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rCounted')) is null,
  'the open review is invalidated reviewer_authority_changed (version + 1, the recorded decision count kept) [P2-S11-AC-112]');
select is(
  (select count(*)::integer from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rCounted')),
  2, 'the revoke emitted its review-changed event (at the review version it saw) and the invalidation emitted its own at the new version [P2-S11-AC-112]');
select is(
  (select string_agg(event.aggregate_version::text, ',' order by event.aggregate_version) from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rCounted')),
  '2,3', 'the two events carry strictly increasing aggregate versions [P2-S11-AC-112]');
select is(
  (select count(*)::integer from audit_private.audit_events audit
    where audit.target_id = pg_temp.s11_id('rCounted')
      and audit.action in ('cms.editorial.review.assignment.revoke', 'cms.entry.review.invalidate')),
  2, 'both the revoke and the invalidation left an audit record [P2-S11-AC-112]');
select is((select count(*)::integer from platform_private.cms_editorial_decisions where review_id = pg_temp.s11_id('rCounted')), 1,
  'the append-only decision row is kept as history [P2-S11-AC-112]');
-- Replay: the stored assignment resource, no second invalidation or event.
insert into r11_snap(label, effects) values ('after-counted', pg_temp.r11_effects());
select pg_temp.r11_acall('v-counted-replay', 'owner', (select request from r11_req where label = 'v-counted'));
select ok(pg_temp.r11_out('v-counted-replay') = '00000:' and pg_temp.r11_resp('v-counted-replay') = pg_temp.r11_resp('v-counted')
    and pg_temp.r11_effects() = (select effects from r11_snap where label = 'after-counted'),
  'an exact replay returns the stored assignment resource and invalidates nothing twice [P2-S11-AC-112]');

-- ---------------------------------------------------------------------------
-- Every other change leaves the review state and version unchanged.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('v-uncounted', 'owner', pg_temp.r11_areq('rUncounted', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('rUncounted-rvB'))));
select ok(pg_temp.r11_out('v-uncounted') = '00000:' and pg_temp.r11_resp('v-uncounted')->>'state' = 'revoked'
    and pg_temp.r11_rv('rUncounted') = 'open/2/1'
    and (select count(*)::integer from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rUncounted')) = 1,
  'revoking the assignment of a reviewer who recorded no decision leaves the review open at the same version and emits only the revoke event [P2-S11-AC-070]');
select pg_temp.r11_acall('v-plain', 'owner', pg_temp.r11_areq('rPlain', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('rPlain-rvA'))));
select ok(pg_temp.r11_out('v-plain') = '00000:' and pg_temp.r11_rv('rPlain') = 'open/1/0',
  'revoking an assignment on a review with no decision leaves the review at version 1 [P2-S11-AC-070]');
select pg_temp.r11_acall('c-plain', 'owner', pg_temp.r11_areq('rPlain', 'create'));
select ok(pg_temp.r11_out('c-plain') = '00000:' and pg_temp.r11_rv('rPlain') = 'open/1/0',
  'creating an assignment never changes the review [P2-S11-AC-070]');
-- The approve no longer counts (its decider''s standing grant lapsed by the calendar): the assignment
-- authorized no COUNTED approve, so revoking it changes nothing.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvA')));
select is(platform_private.cms_editorial_review_distinct_approvals(pg_temp.s11_id('rLapsed')), 0,
  'control: the lapse of rvA''s standing grant unwinds the recorded approve of rLapsed');
select pg_temp.r11_acall('v-lapsed', 'owner', pg_temp.r11_areq('rLapsed', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('rLapsed-rvA'))));
select ok(pg_temp.r11_out('v-lapsed') = '00000:' and pg_temp.r11_resp('v-lapsed')->>'state' = 'revoked'
    and pg_temp.r11_rv('rLapsed') = 'open/2/1',
  'revoking the assignment of an approve that already stopped counting leaves the review open at the same version [P2-S11-AC-070]');

select * from finish();
rollback;
