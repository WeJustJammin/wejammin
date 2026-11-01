-- Slice 11 lane S11-3a: cms_record_review_decision committed refusals (CMS-03B-06 step 4, DEC-157,
-- DEC-159; tracker P2-S11-AC-108, AC-111, AC-112).  A frozen manifest that no longer matches COMMITS
-- the invalidation (reason dependency_changed) and answers the committed-refusal envelope
-- { kind: 'refusal', reasonCode: 'dependency_changed', details: { dependencyHash } } (details {} when
-- the current manifest cannot be rebuilt) instead of raising, so the Worker can answer 409 after the
-- commit; the decision is not recorded.  A recorded approve that no longer counts (its decider's
-- standing grant lapsed or its assignment was revoked) leaves a review that can never be approved:
-- the next approve commits reviewer_authority_changed the same way and answers
-- { kind: 'refusal', reasonCode: 'review_not_open', details: {} } (a reject is still allowed).
-- RED before 20261005017630.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

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

-- A relation row added to a frozen revision changes the rebuilt manifest (relations group).
create or replace function pg_temp.r11_drift_dependency(p_review text, p_target_tag text)
returns void
language plpgsql
as $body$
declare
  target_revision uuid := pg_temp.h11w_revision(p_target_tag);
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform pg_temp.h11w_relation(
    (select revision_id from platform_private.cms_editorial_reviews where id = pg_temp.s11_id(p_review)),
    'rel_omit',
    (select revision_item.entry_id from platform_private.cms_entry_revisions revision_item where revision_item.id = target_revision),
    1);
end;
$body$;

-- ---------------------------------------------------------------------------
-- dependency_changed: the invalidation commits, the decision does not.
-- ---------------------------------------------------------------------------
select pg_temp.r11_frozen_review('rDep', 'inv-dep');
select pg_temp.r11_assign_now('rDep-rvA', 'rDep', 'rvA');
select pg_temp.r11_frozen_review('rDepRejected', 'inv-dep-rejected');
select pg_temp.r11_assign_now('rDepRejected-rvA', 'rDepRejected', 'rvA');
select pg_temp.r11_assign_now('rDepRejected-rvB', 'rDepRejected', 'rvB');
select pg_temp.r11_decide_now('rDepRejected-dec', 'rDepRejected', 'rvB', 'rDepRejected-rvB', 'reject');
select pg_temp.r11_frozen_review('rDepApproved', 'inv-dep-approved');
select pg_temp.r11_assign_now('rDepApproved-rvA', 'rDepApproved', 'rvA');
select pg_temp.r11_assign_now('rDepApproved-rvB', 'rDepApproved', 'rvB');
select pg_temp.r11_decide_now('rDepApproved-dec', 'rDepApproved', 'rvB', 'rDepApproved-rvB', 'approve');
select pg_temp.r11_drift_dependency('rDep', 'inv-dep-t1');
select pg_temp.r11_drift_dependency('rDepRejected', 'inv-dep-t2');
select pg_temp.r11_drift_dependency('rDepApproved', 'inv-dep-t3');

select is(
  platform_private.cms_frozen_dependencies_status(
    (select revision_id from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDep')),
    (select dependency_manifest from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDep'))),
  'stale', 'control: the changed relation makes the frozen manifest stale');

insert into r11_req(label, request) values ('d1', pg_temp.r11_dreq('rDep', 'approve'));
insert into r11_snap(label, effects) values ('before-d1', pg_temp.r11_effects());
select pg_temp.r11_dcall('d1', 'rvA', (select request from r11_req where label = 'd1'));
select ok(
  pg_temp.r11_out('d1') = '00000:'
    and pg_temp.r11_keys(pg_temp.r11_resp('d1')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('d1')->>'kind' = 'refusal' and pg_temp.r11_resp('d1')->>'reasonCode' = 'dependency_changed',
  'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} instead of raising (so the invalidation commits) [P2-S11-AC-108]');
select ok(
  pg_temp.r11_keys(pg_temp.r11_resp('d1')->'details') = 'dependencyHash'
    and pg_temp.r11_resp('d1')#>>'{details,dependencyHash}' = platform_private.cms_jcs_sha256(
      platform_private.cms_build_dependency_manifest(
        (select revision_id from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDep'))))
    and pg_temp.r11_resp('d1')#>>'{details,dependencyHash}' <> (select dependency_hash from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDep')),
  'the details carry only the CURRENT dependencyHash (the rebuilt manifest), not the frozen one [P2-S11-AC-108]');
select ok(
  pg_temp.r11_rv('rDep') = 'invalidated/2/0'
    and exists (select 1 from platform_private.cms_editorial_reviews review
                 where review.id = pg_temp.s11_id('rDep') and review.invalidated_reason = 'dependency_changed'
                   and review.decided_at is null)
    and not pg_temp.r11_leaks(pg_temp.r11_resp('d1'), array[pg_temp.s11_id('rDep')::text, pg_temp.s11_id('rvA')::text]),
  'the review is invalidated (dependency_changed) at version 2 with no decidedAt, and the envelope names no review or reviewer [P2-S11-AC-111]');
select is((select count(*)::integer from platform_private.cms_editorial_decisions where review_id = pg_temp.s11_id('rDep')), 0,
  'no decision row was recorded for the refused decision [P2-S11-AC-108]');
select is(
  (select count(*)::integer from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rDep')),
  1, 'the invalidation committed exactly one cms.entry.review-changed.v1 [P2-S11-AC-111]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 'd1')), 'completed',
  'the idempotency reservation is completed with the typed outcome [P2-S11-AC-014]');
insert into r11_snap(label, effects) values ('after-d1', pg_temp.r11_effects());
select pg_temp.r11_dcall('d1-replay', 'rvA', (select request from r11_req where label = 'd1'));
select ok(pg_temp.r11_out('d1-replay') = '00000:' and pg_temp.r11_resp('d1-replay') = pg_temp.r11_resp('d1')
    and pg_temp.r11_effects() = (select effects from r11_snap where label = 'after-d1'),
  'an exact replay returns the same typed outcome with no second effect [P2-S11-AC-014]');
select pg_temp.r11_dcall('d1-again', 'rvA', pg_temp.r11_dreq('rDep', 'approve'));
select is(pg_temp.r11_out('d1-again'), 'P0001:review_not_open', 'with a new key the invalidated review is review_not_open [P2-S11-AC-108]');

select pg_temp.r11_dcall('d2', 'rvA', pg_temp.r11_dreq('rDepRejected', 'approve'));
select pg_temp.r11_dcall('d3', 'rvA', pg_temp.r11_dreq('rDepApproved', 'approve'));
select ok(pg_temp.r11_out('d2') = 'P0001:review_not_open' and pg_temp.r11_out('d3') = 'P0001:review_not_open'
    and pg_temp.r11_rv('rDepRejected') = 'rejected/2/1' and pg_temp.r11_rv('rDepApproved') = 'approved/2/1',
  'a decision on a rejected or approved review is review_not_open: the state check precedes the dependency rebuild, so a refused decision invalidates nothing [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- reviewer_authority_changed: a recorded approve no longer counts.
-- ---------------------------------------------------------------------------
select pg_temp.r11_frozen_review('rDrift', 'inv-drift', jsonb_build_object('required_decision_count', 3));
select pg_temp.r11_assign_now('rDrift-rvA', 'rDrift', 'rvA');
select pg_temp.r11_assign_now('rDrift-rvB', 'rDrift', 'rvB');
select pg_temp.r11_assign_now('rDrift-rvS', 'rDrift', 'rvS');
select pg_temp.r11_decide_now('rDrift-dec', 'rDrift', 'rvA', 'rDrift-rvA', 'approve');
select pg_temp.r11_frozen_review('rDrift2', 'inv-drift-2', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('rDrift2-rvA', 'rDrift2', 'rvA');
select pg_temp.r11_assign_now('rDrift2-rvB', 'rDrift2', 'rvB');
select pg_temp.r11_decide_now('rDrift2-dec', 'rDrift2', 'rvA', 'rDrift2-rvA', 'approve');
select pg_temp.r11_frozen_review('rLive', 'inv-live', jsonb_build_object('required_decision_count', 3));
select pg_temp.r11_assign_now('rLive-rvA', 'rLive', 'rvA');
select pg_temp.r11_assign_now('rLive-rvB', 'rLive', 'rvB');
select pg_temp.r11_decide_now('rLive-dec', 'rLive', 'rvA', 'rLive-rvA', 'approve');

-- control: while the earlier approve still counts a further approve is recorded.
select pg_temp.r11_dcall('l1', 'rvB', pg_temp.r11_dreq('rLive', 'approve'), false);
select is(pg_temp.r11_out('l1'), '00000:', 'control: with every recorded approve still counting, a further approve is recorded [P2-S11-AC-109]');

-- The grant LAPSES by the calendar (no UPDATE event): the raw exec skips the eager producer
-- trigger (cms_invalidate_reviews_for_person), which would otherwise invalidate the reviews at the
-- UPDATE; the command must find the lapse lazily.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvA')));
select is(platform_private.cms_editorial_review_distinct_approvals(pg_temp.s11_id('rDrift')), 0,
  'control: the lapse of rvA''s standing grant unwinds the recorded approve');
insert into r11_snap(label, effects) values ('before-drift', pg_temp.r11_effects());
select pg_temp.r11_dcall('x1', 'rvB', pg_temp.r11_dreq('rDrift', 'approve'));
select ok(
  pg_temp.r11_out('x1') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('x1')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('x1')->>'kind' = 'refusal' and pg_temp.r11_resp('x1')->>'reasonCode' = 'review_not_open'
    and pg_temp.r11_resp('x1')->'details' = '{}'::jsonb
    and pg_temp.r11_rv('rDrift') = 'invalidated/3/1'
    and (select invalidated_reason from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDrift')) = 'reviewer_authority_changed',
  'an approve on a review whose recorded approve lapsed commits reviewer_authority_changed (the review could never be approved) and answers the committed refusal review_not_open with empty details [P2-S11-AC-112]');
select is((select count(*)::integer from platform_private.cms_editorial_decisions
            where review_id = pg_temp.s11_id('rDrift') and reviewer_person_id = pg_temp.s11_id('rvB')), 0,
  'the refused approve recorded no decision row [P2-S11-AC-112]');
select pg_temp.r11_dcall('x2', 'rvB', pg_temp.r11_dreq('rDrift2', 'reject'));
select ok(pg_temp.r11_out('x2') = '00000:' and pg_temp.r11_resp('x2')->>'state' = 'rejected',
  'a reject is still allowed on such a review: it ends the review terminally [P2-S11-AC-112]');
-- A revoked assignment of the earlier approver has the same effect as a lapsed grant.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_from = current_date, valid_through = null
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvA')));
select pg_temp.r11_frozen_review('rDrift3', 'inv-drift-3', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('rDrift3-rvA', 'rDrift3', 'rvA');
select pg_temp.r11_assign_now('rDrift3-rvB', 'rDrift3', 'rvB');
select pg_temp.r11_decide_now('rDrift3-dec', 'rDrift3', 'rvA', 'rDrift3-rvA', 'approve');
update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('rDrift3-rvA');
select pg_temp.r11_dcall('x3', 'rvB', pg_temp.r11_dreq('rDrift3', 'approve'));
select ok(pg_temp.r11_resp('x3')->>'kind' = 'refusal' and pg_temp.r11_resp('x3')->>'reasonCode' = 'review_not_open'
    and pg_temp.r11_rv('rDrift3') = 'invalidated/3/1'
    and (select invalidated_reason from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rDrift3')) = 'reviewer_authority_changed',
  'a revoked assignment of a counted approver also leaves the review unable to be approved: reviewer_authority_changed [P2-S11-AC-112]');

select * from finish();
rollback;
