-- Slice 11 lane S11-3d (E2 evidence regression), BE03b "Derived revision
-- workflow state (E2)": a review reaches `approved`/`rejected` ONLY through a
-- committed cms_editorial_decisions row whose reviewer still holds the satisfied
-- slot's capability under an active, versioned, in-window assignment -- exactly
-- what cms_record_review_decision writes and what the E2 fixture
-- (phase_02_slice_11_e2/000-derived-evidence.sqlinc, pg_temp.e2_review) now
-- seeds before it advances the review.
--
-- This file is the regression for that fixture.  It would FAIL if the fixture
-- went back to a count-only review UPDATE: platform_private.cms_review_cas_guard
-- refuses a decision-count advance with no decision rows, so the suite aborts
-- before its plan.  It would also fail if the fixture seeded a decision row that
-- no longer qualifies -- a missing standing cms.reviewer grant, a foreign or
-- revoked assignment, or a stale reviewed hash -- because cms_decision_binding_
-- guard or cms_review_cas_guard then refuses the advance, or the qualifying
-- recount no longer reaches the required count and the derived state is wrong.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_e2/000-derived-evidence.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

create or replace function pg_temp.e2x_rev(p_n integer) returns uuid language sql immutable as $$
  select ('a9170000-0000-4000-8000-0000000e10' || lpad(p_n::text, 2, '0'))::uuid $$;

-- Append every revision FIRST (a revision INSERT invalidates older live reviews
-- of the entry and locale), then attach the evidence.
select pg_temp.e2_revision('a9100000-0000-4000-8000-000000000301', pg_temp.e2x_rev(n), n)
  from generate_series(2, 5) n;
select pg_temp.e2_evidence(pg_temp.e2x_rev(2), 'approved');
select pg_temp.e2_evidence(pg_temp.e2x_rev(3), 'rejected');
select pg_temp.e2_evidence(pg_temp.e2x_rev(4), 'submitted');
select pg_temp.e2_evidence(pg_temp.e2x_rev(5), 'invalidated');

create or replace function pg_temp.e2x_review(p_revision uuid) returns uuid language sql stable as $$
  select review.id from platform_private.cms_editorial_reviews review
   where review.revision_id = p_revision
   order by review.submitted_at desc, review.id desc limit 1 $$;

-- --------------------------------- the derived state is decision-backed ----
select is(platform_private.cms_revision_effective_state(pg_temp.e2x_rev(2)), 'approved',
  'the approved revision derives approved [P2-S11-AC-085]');
select is(platform_private.cms_revision_effective_state(pg_temp.e2x_rev(3)), 'rejected',
  'the rejected revision derives rejected [P2-S11-AC-085]');
select is(platform_private.cms_revision_effective_state(pg_temp.e2x_rev(4)), 'submitted',
  'the open-review revision derives submitted [P2-S11-AC-085]');
select is(platform_private.cms_revision_effective_state(pg_temp.e2x_rev(5)), 'draft',
  'the invalidated review returns the revision to draft [P2-S11-AC-085]');

-- the advance to approved/rejected is backed by exactly one decision row
select is(
  (select review.state || '/' || review.version || '/' || review.recorded_decision_count
     from platform_private.cms_editorial_reviews review
    where review.id = pg_temp.e2x_review(pg_temp.e2x_rev(2))),
  'approved/2/1', 'the approved review advanced to v2 with one recorded decision [P2-S11-AC-085]');
select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_editorial_decisions decision
    where decision.review_id = pg_temp.e2x_review(pg_temp.e2x_rev(2)) and decision.decision = 'approve'),
  1, 'the approved review carries exactly one approve decision row [P2-S11-AC-085]');
select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_editorial_decisions decision
    where decision.review_id = pg_temp.e2x_review(pg_temp.e2x_rev(3)) and decision.decision = 'reject'),
  1, 'the rejected review carries exactly one reject decision row [P2-S11-AC-085]');

-- the approve COUNTS now (the reviewer holds the satisfied slot capability)
select is(platform_private.cms_editorial_review_distinct_approvals(pg_temp.e2x_review(pg_temp.e2x_rev(2))),
  1, 'the approve counts: its reviewer holds cms.reviewer in the review owner party [P2-S11-AC-085]');
select is(platform_private.cms_editorial_review_distinct_approvals(pg_temp.e2x_review(pg_temp.e2x_rev(3))),
  0, 'a reject is never a qualifying approval [P2-S11-AC-085]');

-- separation of duties and the assignment window the guards demand
select ok(
  (select decision.reviewer_person_id <> review.submitted_by
      and decision.reviewer_person_id <> revision.author_person_id
     from platform_private.cms_editorial_decisions decision
     join platform_private.cms_editorial_reviews review on review.id = decision.review_id
     join platform_private.cms_entry_revisions revision on revision.id = review.revision_id
    where decision.review_id = pg_temp.e2x_review(pg_temp.e2x_rev(2))),
  'the deciding reviewer is neither the review submitter nor the revision author [P2-S11-AC-085]');
select ok(
  (select assignment.state = 'active' and assignment.version = decision.assignment_version
      and decision.decided_at >= assignment.starts_at and decision.decided_at < assignment.ends_at
      and platform_private.cms_person_holds_capability(
        review.owner_id, decision.reviewer_person_id, decision.capability)
     from platform_private.cms_editorial_decisions decision
     join platform_private.cms_editorial_review_assignments assignment
       on assignment.id = decision.assignment_id
     join platform_private.cms_editorial_reviews review on review.id = decision.review_id
    where decision.review_id = pg_temp.e2x_review(pg_temp.e2x_rev(2))),
  'the decision was taken inside an active, versioned assignment window by a standing cms.reviewer [P2-S11-AC-085]');

select * from finish();
rollback;
