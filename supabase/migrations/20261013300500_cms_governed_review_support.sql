-- Slice 12 lane L1 (BE03c "Governed review machinery" applying 03b "Review scopes, reviewer assignment and
-- decision evaluation (DEC-136)" and "Qualifying approvers" unchanged; tracker P2-S12-AC-072, AC-078, AC-090,
-- AC-262): the helpers shared by the governed submit, assignment, decision, activation and read RPCs.
--
--   cms_governed_review_qualifying_decisions(review)  the approve decisions that count NOW: the decider still holds
--       the standing capability of the slot the decision satisfied in the review's owner party and the authorizing
--       assignment is not revoked (assignment expiry does not unwind a decision).  Identifiers only.
--   cms_governed_review_distinct_approvals(review)    the live count of distinct humans in that set.
--   cms_governed_review_scopes(review, actor, party)  the read scopes the caller holds: owner (the immutable owner
--       initialization receipt), submitter, reviewer (a non-revoked assignment) and capability (the subject kind's
--       owner capability in the owner party); the empty array conceals the review.
--   cms_governed_review_resource(review)              the browser GovernedReviewResource (no person, actor or party).
--   cms_governed_assignment_resource(assignment)      the browser GovernedReviewAssignmentResource.
--   cms_governed_next_actions(review, actor, party, scopes)  the permittedNextActions hint (grants nothing).
-- Private; SECURITY DEFINER; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_review_qualifying_decisions(p_review_id uuid)
returns table(decision_id uuid, reviewer_person_id uuid, capability text, assignment_id uuid)
language sql
stable
security definer
set search_path = ''
as $body$
  select decision.id, decision.reviewer_person_id, decision.capability, decision.assignment_id
    from platform_private.cms_governed_reviews review
    join platform_private.cms_governed_review_decisions decision on decision.review_id = review.id
    join platform_private.cms_governed_review_assignments assignment
      on assignment.id = decision.assignment_id
     and assignment.review_id = decision.review_id
     and assignment.reviewer_person_id = decision.reviewer_person_id
   where review.id = p_review_id
     and decision.decision = 'approve'
     and assignment.state <> 'revoked'
     and platform_private.cms_person_holds_capability(
       review.owner_id, decision.reviewer_person_id, decision.capability)
   order by decision.decided_at, decision.id
$body$;

create or replace function platform_private.cms_governed_review_distinct_approvals(p_review_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.count(distinct qualifying.reviewer_person_id)::integer
    from platform_private.cms_governed_review_qualifying_decisions(p_review_id) qualifying
$body$;

create or replace function platform_private.cms_governed_owner_capability(p_subject_kind text)
returns text
language sql
immutable
set search_path = ''
as $body$
  select case p_subject_kind when 'taxonomy_version' then 'cms.taxonomy_curator' else 'cms.template_designer' end
$body$;

create or replace function platform_private.cms_governed_review_scopes(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  person uuid;
  scopes text[] := array[]::text[];
begin
  if p_review_id is null or p_actor_id is null or p_acting_party_id is null then
    return scopes;
  end if;
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found or review_row.owner_id is distinct from p_acting_party_id then
    return scopes;
  end if;
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  if person is null or not platform_private.cms_entry_tenant_visible(p_actor_id, review_row.owner_id) then
    return scopes;
  end if;
  if exists (
    select 1 from platform_private.cms_owner_initialization receipt
     where receipt.auth_user_id = p_actor_id
       and receipt.person_id = person
       and receipt.organization_id = review_row.owner_id
  ) then
    scopes := scopes || 'owner'::text;
  end if;
  if review_row.submitted_by = person then
    scopes := scopes || 'submitter'::text;
  end if;
  if exists (
    select 1 from platform_private.cms_governed_review_assignments assignment_item
     where assignment_item.review_id = review_row.id
       and assignment_item.reviewer_person_id = person
       and assignment_item.state <> 'revoked'
  ) then
    scopes := scopes || 'reviewer'::text;
  end if;
  if platform_private.cms_person_holds_capability(
       review_row.owner_id, person, platform_private.cms_governed_owner_capability(review_row.subject_kind)) then
    scopes := scopes || 'capability'::text;
  end if;
  return scopes;
end;
$body$;

create or replace function platform_private.cms_governed_review_resource(p_review_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', review_item.id,
    'version', review_item.version::text,
    'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'subjectKind', review_item.subject_kind,
      'subjectId', review_item.subject_id,
      'subjectHash', review_item.subject_hash::text,
      'policyBasisHash', review_item.policy_basis_hash::text,
      'requiredDecisionCount', review_item.required_decision_count,
      'requiredCapabilities', review_item.required_capabilities)),
    'createdAt', platform_private.auth_iso_time(review_item.created_at),
    'updatedAt', platform_private.auth_iso_time(review_item.updated_at),
    'state', review_item.state,
    'subjectKind', review_item.subject_kind,
    'subjectId', review_item.subject_id,
    'lineageId', review_item.lineage_id,
    'subjectKey', review_item.subject_key,
    'subjectVersion', review_item.subject_version,
    'subjectHash', review_item.subject_hash::text,
    'riskClass', review_item.risk_class,
    'requiredDecisionCount', review_item.required_decision_count,
    'recordedDecisionCount', review_item.recorded_decision_count,
    'requiredCapabilities', review_item.required_capabilities,
    'policyBasisHash', review_item.policy_basis_hash::text,
    'submittedAt', platform_private.auth_iso_time(review_item.submitted_at),
    'decidedAt', platform_private.auth_iso_time(review_item.decided_at),
    'activatedAt', platform_private.auth_iso_time(review_item.activated_at),
    'invalidatedReason', review_item.invalidated_reason
  )
    from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id
$body$;

create or replace function platform_private.cms_governed_assignment_resource(p_assignment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', assignment_item.id,
    'version', assignment_item.version::text,
    'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'assignmentId', assignment_item.id,
      'reviewId', assignment_item.review_id,
      'capability', assignment_item.capability_key,
      'actions', pg_catalog.to_jsonb(assignment_item.actions),
      'state', assignment_item.state,
      'startsAt', platform_private.auth_iso_time(assignment_item.starts_at),
      'expiresAt', platform_private.auth_iso_time(assignment_item.ends_at),
      'reason', assignment_item.reason)),
    'createdAt', platform_private.auth_iso_time(assignment_item.created_at),
    'updatedAt', platform_private.auth_iso_time(assignment_item.updated_at),
    'reviewId', assignment_item.review_id,
    'state', assignment_item.state,
    'capability', assignment_item.capability_key,
    'actions', pg_catalog.to_jsonb(assignment_item.actions),
    'startsAt', platform_private.auth_iso_time(assignment_item.starts_at),
    'expiresAt', platform_private.auth_iso_time(assignment_item.ends_at),
    'reason', assignment_item.reason
  )
    from platform_private.cms_governed_review_assignments assignment_item
   where assignment_item.id = p_assignment_id
$body$;

create or replace function platform_private.cms_governed_next_actions(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid, p_scopes text[]
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  subject jsonb;
  person uuid;
  owner_capability text;
  actions text[] := array[]::text[];
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found or p_scopes is null or pg_catalog.cardinality(p_scopes) = 0 then
    return actions;
  end if;
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  if person is null then
    return actions;
  end if;
  owner_capability := platform_private.cms_governed_owner_capability(review_row.subject_kind);
  subject := platform_private.cms_governed_subject_resolve(review_row.subject_kind, review_row.subject_id);

  if review_row.state = 'open' then
    if exists (
         select 1 from platform_private.cms_governed_review_assignments assignment_item
          where assignment_item.review_id = review_row.id
            and assignment_item.reviewer_person_id = person
            and assignment_item.state = 'active'
            and assignment_item.starts_at <= now_at and now_at < assignment_item.ends_at)
       and platform_private.cms_person_holds_capability(review_row.owner_id, person, 'cms.reviewer')
       and review_row.submitted_by is distinct from person
       and subject->>'creatorPerson' is distinct from person::text
       and not exists (
         select 1 from platform_private.cms_governed_review_decisions decision_item
          where decision_item.review_id = review_row.id and decision_item.reviewer_person_id = person) then
      actions := actions || 'record_decision'::text;
    end if;
    if 'owner' = any (p_scopes) then
      if platform_private.cms_person_holds_capability(review_row.owner_id, person, owner_capability)
         and (select pg_catalog.count(*) from platform_private.cms_governed_review_assignments assignment_item
               where assignment_item.review_id = review_row.id and assignment_item.state = 'active') < 16 then
        actions := actions || 'assign_reviewer'::text;
      end if;
      if exists (
        select 1 from platform_private.cms_governed_review_assignments assignment_item
         where assignment_item.review_id = review_row.id and assignment_item.state = 'active') then
        actions := actions || 'revoke_assignment'::text;
      end if;
    end if;
  elsif review_row.state = 'approved' and 'capability' = any (p_scopes) then
    if subject->>'state' in ('approved', 'blocked') then
      actions := actions || 'activate'::text || 'schedule'::text;
    elsif subject->>'state' = 'active' then
      actions := actions || 'retire'::text;
    end if;
  end if;
  return actions;
end;
$body$;

comment on function platform_private.cms_governed_next_actions(uuid, uuid, uuid, text[]) is
  'The review-level permittedNextActions of a caller (record_decision, assign_reviewer, revoke_assignment, activate, schedule, retire) from the caller''s review scopes. A hint for the UI that grants no authority: every command re-proves its own. Private; STABLE.';

grant select on table
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_assignments,
  platform_private.cms_governed_review_decisions,
  platform_private.cms_owner_initialization
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_review_qualifying_decisions(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_review_distinct_approvals(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_owner_capability(text) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_review_scopes(uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_review_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_assignment_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_next_actions(uuid, uuid, uuid, text[]) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_review_qualifying_decisions(uuid),
  platform_private.cms_governed_review_distinct_approvals(uuid),
  platform_private.cms_governed_owner_capability(text),
  platform_private.cms_governed_review_scopes(uuid, uuid, uuid),
  platform_private.cms_governed_review_resource(uuid),
  platform_private.cms_governed_assignment_resource(uuid),
  platform_private.cms_governed_next_actions(uuid, uuid, uuid, text[])
  from public, anon, authenticated, service_role;

commit;
