-- Slice 11 lane S11-3a (BE03b "Review scopes, reviewer assignment and decision evaluation (DEC-136)",
-- "Recent MFA (E6)", Persisted model envelope; tracker P2-S11-AC-067 .. AC-071, AC-108 .. AC-110):
-- the helpers shared by the three review-authority commands cms_assign_editorial_reviewer,
-- cms_record_review_decision and cms_submit_review, and by the Slice 11 review reads.
--
--   cms_editorial_step_up_instant(request)       the verified MFA instant (context.stepUpVerified + stepUpAt,
--                                                fresh -30 s .. +600 s) or STEP_UP_REQUIRED
--   cms_editorial_reason_valid(reason, max, safe) 1..max Unicode code points, already NFC; with p_safe_text
--                                                also no control, line/paragraph-separator or bidirectional
--                                                formatting character and none of < > { }
--   cms_editorial_review_scopes(review, actor, party)
--                                                the review scopes the caller holds (owner, submitter,
--                                                reviewer, assignee, publisher); the empty array conceals
--   cms_lock_person_authority(org, persons, caps) position 1 of the BE03b global lock order (person_party,
--                                                membership_tenure, organization_actor_grant) FOR SHARE
--   cms_editorial_review_resource(review)         the browser EditorialReviewResource (identifiers and
--                                                evidence only, no submitter, reviewer or owner identity)
--   cms_editorial_assignment_resource(assignment) the browser EditorialReviewAssignmentResource
--
-- Every function is private: SECURITY DEFINER, empty search_path, owned by the CMS definer role, with no
-- API-role execute.  The three commands call them from definer-owned bodies.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_editorial_step_up_instant(p_request jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $body$
declare
  proof_text text;
  proof_at timestamptz;
  checked_at timestamptz := pg_catalog.clock_timestamp();
begin
  if pg_catalog.jsonb_typeof(p_request->'context') is distinct from 'object'
     or p_request->'context'->'stepUpVerified' is distinct from pg_catalog.to_jsonb(true)
     or pg_catalog.jsonb_typeof(p_request->'context'->'stepUpAt') is distinct from 'string' then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  proof_text := p_request->'context'->>'stepUpAt';
  if proof_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  begin
    proof_at := proof_text::timestamptz;
  exception when others then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end;
  -- DEC-111: a 600 second freshness window with the 30 second skew tolerance of stepUpIsFresh.
  if proof_at > checked_at + interval '30 seconds'
     or proof_at < checked_at - interval '600 seconds' then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  return proof_at;
end;
$body$;

comment on function platform_private.cms_editorial_step_up_instant(jsonb) is
  'BE03b E6: the verified binding-bound MFA instant of a Slice 11 command (context.stepUpVerified true and context.stepUpAt within -30 s .. +600 s), else STEP_UP_REQUIRED. Evaluated before the idempotency reservation and before any read of the target. Private.';

create or replace function platform_private.cms_editorial_reason_valid(
  p_reason text, p_max_code_points integer, p_safe_text boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select p_reason is not null
    and pg_catalog.char_length(p_reason) between 1 and p_max_code_points
    and p_reason = normalize(p_reason, NFC)
    and (not p_safe_text
         or p_reason !~ '[\u0001-\u001f\u007f-\u009f  ‎‏؜‪-‮⁦-⁩<>{}]')
$body$;

comment on function platform_private.cms_editorial_reason_valid(text, integer, boolean) is
  'BE03b reason rule: 1..p_max_code_points Unicode code points (not octets), already NFC (refused, never normalized); with p_safe_text also no control, line/paragraph separator or bidirectional-formatting character and none of < > { } (the decision SafeText). Private.';

create or replace function platform_private.cms_editorial_review_scopes(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
  person uuid;
  scopes text[] := array[]::text[];
begin
  if p_review_id is null or p_actor_id is null or p_acting_party_id is null then
    return scopes;
  end if;
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = p_review_id;
  -- A review of another owner is out of every scope of this acting party.
  if not found or review_row.owner_id is distinct from p_acting_party_id then
    return scopes;
  end if;
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  -- Every scope lives inside the owner organization: a non-member holds none.
  if person is null
     or not platform_private.cms_entry_tenant_visible(p_actor_id, review_row.owner_id) then
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
  -- Read scope: any non-revoked assignment (an expired window still reads; only deciding needs the window).
  if exists (
    select 1 from platform_private.cms_editorial_review_assignments assignment_item
     where assignment_item.review_id = review_row.id
       and assignment_item.reviewer_person_id = person
       and assignment_item.state <> 'revoked'
  ) then
    scopes := scopes || 'reviewer'::text;
  end if;
  if platform_private.cms_authority_origin(p_actor_id, p_acting_party_id, 'cms.author', review_row.entry_id) is not null
     or platform_private.cms_authority_origin(p_actor_id, p_acting_party_id, 'cms.editor', review_row.entry_id) is not null then
    scopes := scopes || 'assignee'::text;
  end if;
  if platform_private.cms_person_holds_capability(review_row.owner_id, person, 'cms.publisher') then
    scopes := scopes || 'publisher'::text;
  end if;
  return scopes;
end;
$body$;

comment on function platform_private.cms_editorial_review_scopes(uuid, uuid, uuid) is
  'BE03b DEC-136: the review scopes the actor holds in the acting party, from {owner, submitter, reviewer, assignee, publisher}. owner = the immutable initialization receipt identity; reviewer = a non-revoked assignment (reads; deciding also needs the window); assignee = an active cms.author/cms.editor entry assignment with the grant; publisher = a cms.publisher grant in the owner party. The empty array means the review is concealed (hidden, absent, cross-owner or non-member). Private; STABLE.';

create or replace function platform_private.cms_lock_person_authority(
  p_organization_id uuid, p_person_ids uuid[], p_capabilities text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  -- Position 1 of the BE03b global lock order, in the order the revocation path takes
  -- them (person, tenure, grants), people ascending: a revoking UPDATE and this command
  -- serialize, and no predicate narrows the rows (a grant being revoked right now must be
  -- locked although its committed state still proves authority).
  perform 1
    from platform_private.person_party person_item
   where person_item.party_id = any (p_person_ids)
   order by person_item.party_id
     for share;
  perform 1
    from identity_private.membership_tenure tenure_item
   where tenure_item.organization_id = p_organization_id
     and tenure_item.person_id = any (p_person_ids)
   order by tenure_item.person_id, tenure_item.id
     for share;
  perform 1
    from identity_private.organization_actor_grant grant_item
   where grant_item.organization_id = p_organization_id
     and grant_item.person_id = any (p_person_ids)
     and grant_item.capability_code = any (p_capabilities)
   order by grant_item.person_id, grant_item.capability_code
     for share;
end;
$body$;

comment on function platform_private.cms_lock_person_authority(uuid, uuid[], text[]) is
  'FOR SHARE locks on the authority rows (person_party, membership_tenure, organization_actor_grant for the given capabilities) of the given people in one organization, in the BE03b global order position 1. Takes no decision. Private.';

create or replace function platform_private.cms_editorial_review_resource(p_review_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', review_item.id,
    'version', review_item.version::text,
    'createdAt', platform_private.auth_iso_time(review_item.created_at),
    'updatedAt', platform_private.auth_iso_time(review_item.updated_at),
    'state', review_item.state,
    'entryId', review_item.entry_id,
    'revisionId', review_item.revision_id,
    'riskClass', review_item.risk_class,
    'workflowPolicy', pg_catalog.jsonb_build_object(
      'key', review_item.workflow_policy_key,
      'version', review_item.workflow_policy_version::text,
      'policyHash', review_item.workflow_policy_hash,
      'riskClass', review_item.risk_class,
      'requiredDecisionCount', review_item.required_decision_count,
      'requiredCapabilities', review_item.required_capabilities,
      'approvalEvidenceHash', review_item.approval_evidence_hash
    ),
    'activationEvidence', review_item.activation_evidence,
    'frozenHash', review_item.frozen_hash,
    'requiredDecisionCount', review_item.required_decision_count,
    'recordedDecisionCount', review_item.recorded_decision_count,
    'dependencyHash', review_item.dependency_hash,
    'invalidatedReason', review_item.invalidated_reason,
    'submittedAt', platform_private.auth_iso_time(review_item.submitted_at),
    'decidedAt', platform_private.auth_iso_time(review_item.decided_at)
  )
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = p_review_id
$body$;

comment on function platform_private.cms_editorial_review_resource(uuid) is
  'BE03b EditorialReviewResource (CMS-03B-05 201, CMS-03B-06 200): resource meta, state, entry and revision ids, risk class, the frozen workflow-policy and activation evidence, hashes, decision counts, invalidation reason and instants. No submitter, reviewer, owner or party identity. Private; STABLE.';

create or replace function platform_private.cms_editorial_assignment_resource(p_assignment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', assignment_item.id,
    'version', assignment_item.version::text,
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
    from platform_private.cms_editorial_review_assignments assignment_item
   where assignment_item.id = p_assignment_id
$body$;

comment on function platform_private.cms_editorial_assignment_resource(uuid) is
  'BE03b EditorialReviewAssignmentResource (CMS-03B-18): meta, review id, state, the fixed capability and actions, the window and the reason. The reviewer and the grantor never leave the server. Private; STABLE.';

-- SEC-2: the definer role reads what these helpers name and owns them; no API role may run them.
grant select on table
  platform_private.cms_editorial_reviews,
  platform_private.cms_editorial_review_assignments
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_editorial_step_up_instant(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_reason_valid(text, integer, boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_review_scopes(uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_lock_person_authority(uuid, uuid[], text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_review_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_assignment_resource(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_editorial_step_up_instant(jsonb),
  platform_private.cms_editorial_reason_valid(text, integer, boolean),
  platform_private.cms_editorial_review_scopes(uuid, uuid, uuid),
  platform_private.cms_lock_person_authority(uuid, uuid[], text[]),
  platform_private.cms_editorial_review_resource(uuid),
  platform_private.cms_editorial_assignment_resource(uuid)
  from public, anon, authenticated, service_role;

commit;
