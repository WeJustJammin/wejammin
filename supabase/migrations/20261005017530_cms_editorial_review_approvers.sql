-- Slice 11 shared helpers (lane S11-3s, BE03b "Review scopes, reviewer assignment
-- and decision evaluation (DEC-136)" / "Qualifying approvers"; tracker
-- P2-S11-AC-110): the live recount of an editorial review's approvals.
--
-- A recorded `approve` COUNTS while (a) its human still holds the standing
-- capability of the slot the decision satisfied (`decision.capability`: the base
-- slot cms.reviewer or a specialist slot) in the review's owner party -- the same
-- predicate as cms_person_holds_capability (confirmed in-window tenure + active
-- in-window grant) -- and (b) the assignment that authorized it is not `revoked`.
-- Assignment EXPIRY after the decision does not unwind it (the window bounds the
-- act of deciding, not the decision); the lapse of the standing grant, its
-- revocation or the end of the tenure does.  A `reject` never counts (the first
-- rejection ends the review).
--
--   cms_editorial_review_qualifying_decisions(review) -> (decision_id,
--     reviewer_person_id, capability, assignment_id), ordered by decided_at, id.
--     No reason, owner or party identifier is projected.
--   cms_editorial_review_distinct_approvals(review) -> count of distinct reviewers
--     in that set: `distinctApprovalCount`.
--
-- Shared by the decision command (lane 3a: approved exactly when the distinct
-- qualifying approvers reach requiredDecisionCount and every specialist slot is
-- held), the revocation preflight (category 17) and the reads.  Private, STABLE,
-- pure reads; callers run under the CMS RPC context.  An absent or null review
-- has no qualifying decision.  Forward-only.
begin;

create or replace function platform_private.cms_editorial_review_qualifying_decisions(
  p_review_id uuid
)
returns table(
  decision_id uuid,
  reviewer_person_id uuid,
  capability text,
  assignment_id uuid
)
language sql
stable
security definer
set search_path = ''
as $body$
  select decision.id, decision.reviewer_person_id, decision.capability, decision.assignment_id
    from platform_private.cms_editorial_reviews review
    join platform_private.cms_editorial_decisions decision
      on decision.review_id = review.id
    join platform_private.cms_editorial_review_assignments assignment
      on assignment.id = decision.assignment_id
     and assignment.review_id = decision.review_id
     and assignment.reviewer_person_id = decision.reviewer_person_id
   where review.id = p_review_id
     and decision.decision = 'approve'
     and assignment.state <> 'revoked'
     and platform_private.cms_person_holds_capability(
       review.owner_id, decision.reviewer_person_id, decision.capability
     )
   order by decision.decided_at, decision.id
$body$;

comment on function platform_private.cms_editorial_review_qualifying_decisions(uuid) is
  'BE03b DEC-136: the approve decisions of a review that count now (the decider still holds the standing capability of the satisfied slot and the authorizing assignment is not revoked; assignment expiry does not unwind). Identifiers only. Private; STABLE.';

create or replace function platform_private.cms_editorial_review_distinct_approvals(
  p_review_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.count(distinct qualifying.reviewer_person_id)::integer
    from platform_private.cms_editorial_review_qualifying_decisions(p_review_id) qualifying
$body$;

comment on function platform_private.cms_editorial_review_distinct_approvals(uuid) is
  'BE03b DEC-136: distinctApprovalCount, the live recount of distinct humans whose approve currently counts. Private; STABLE.';

grant select on table
  platform_private.cms_editorial_decisions,
  platform_private.cms_editorial_review_assignments,
  platform_private.cms_editorial_reviews
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_editorial_review_qualifying_decisions(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_review_distinct_approvals(uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_editorial_review_qualifying_decisions(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_editorial_review_distinct_approvals(uuid)
  from public, anon, authenticated, service_role;

commit;
