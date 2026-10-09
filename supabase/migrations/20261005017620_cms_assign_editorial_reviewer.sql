-- Slice 11 lane S11-3a, CMS-03B-18 (BE03b "Review scopes, reviewer assignment and decision
-- evaluation (DEC-136)", DEC-157 lock order, DEC-158(b); tracker P2-S11-AC-067 .. AC-071, AC-119):
-- platform_private.cms_assign_editorial_reviewer(p_request jsonb) returns jsonb, with the
-- platform_api wrapper the Worker calls (service_role only).
--
-- The receipt-derived owner creates or revokes a bounded `read`+`decide` assignment of one reviewer
-- on one OPEN editorial review.  Order of the evaluation (every refusal is a P0001 whose whole
-- message is the token; nothing it refuses is committed):
--   1. structure: exact keys per action (INVALID_REQUEST), UUIDs, positive decimal versions that
--      must agree (VALIDATION_FAILED at the member / INVALID_REQUEST), reviewer id, offset-ISO
--      expiry, assignment id and the optional 1..256 code-point NFC reason (VALIDATION_FAILED at
--      the member pointer);
--   2. the step-up proof (STEP_UP_REQUIRED), before the review is read and before the idempotency
--      reservation (E6);
--   3. concealment: an absent, cross-owner or non-member-scoped review is NOT_FOUND; a readable
--      review whose caller is not the immutable owner receipt identity is 403 capability_missing,
--      as is an owner without a currently valid `cms.editor` grant (the grantor authority end);
--      a revoke needs the owner receipt only;
--   4. the authority rows of the grantor and the reviewer FOR SHARE (global order position 1),
--      then the idempotency reservation (an exact replay returns the stored response);
--   5. the review row FOR UPDATE (position 5): review_not_open, then the CAS operand
--      (VERSION_MISMATCH with the expected and current versions);
--   6. create: uniform reviewer_not_eligible (absent, non-member, ungranted, banned, submitter or
--      revision author alike), assignment_exists (an ACTIVE row, expired or not), assignment_limit
--      (16 unexpired active rows), expiry_out_of_bounds at /expiresAt (after now, <= 7 days, <= the
--      reviewer's cms.reviewer grant day end, <= the owner's cms.editor grant day end);
--      revoke: the assignment of THIS review (NOT_FOUND otherwise), still active (CONFLICT).
-- The review `version` does not advance on a create or on a revoke that authorized no counted approve
-- (DEC-157): assignment changes only recount.  A REVOKE of the assignment that authorized a COUNTED
-- approve decision of the open review also invalidates the review `reviewer_authority_changed`
-- (DEC-161, BE03b "Review invalidation"; cms_invalidate_editorial_review under the review lock already
-- held) and still answers the assignment resource.  One audit record and one
-- cms.entry.review-changed.v1 {reviewId, revisionId}, aggregated on the review at the version the
-- command saw, commit with the change and the completed idempotency record (the invalidation adds its
-- own audit record and event at the new version).
--
-- The revoke `reason` is validated and is part of the idempotency binding, but is not stored: the
-- assignment guard (20261005017020) makes `reason` immutable and the audit record is identifier-only.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_assign_editorial_reviewer(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  grantor_person uuid;
  correlation_id uuid;
  action text;
  requested_review uuid;
  expected_version bigint;
  reviewer_person uuid;
  requested_assignment uuid;
  reason_text text;
  starts timestamptz;
  ends timestamptz;
  reviewer_end timestamptz;
  grantor_end timestamptz;
  grant_through date;
  scopes text[];
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_editorial_reviews%rowtype;
  assignment_row platform_private.cms_editorial_review_assignments%rowtype;
  revision_author uuid;
  assignment_id uuid;
  active_count integer;
  counted_approve boolean := false;
  status_code integer;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  action := p_request->>'action';
  if action = 'create' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey',
            'reviewerPersonId', 'expiresAt']::text[],
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey',
            'reviewerPersonId', 'expiresAt', 'reason', 'context', 'correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif action = 'revoke' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey',
            'assignmentId']::text[],
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey',
            'assignmentId', 'reason', 'context', 'correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_review := (p_request->>'reviewId')::uuid;
  expected_version := (p_request->>'expectedVersion')::bigint;
  if action = 'create' then
    if pg_catalog.jsonb_typeof(p_request->'reviewerPersonId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'reviewerPersonId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reviewerPersonId"]';
    end if;
    reviewer_person := (p_request->>'reviewerPersonId')::uuid;
    if pg_catalog.jsonb_typeof(p_request->'expiresAt') is distinct from 'string'
       or p_request->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expiresAt"]';
    end if;
    begin
      ends := (p_request->>'expiresAt')::timestamptz;
    exception when others then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expiresAt"]';
    end;
  else
    if pg_catalog.jsonb_typeof(p_request->'assignmentId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'assignmentId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/assignmentId"]';
    end if;
    requested_assignment := (p_request->>'assignmentId')::uuid;
  end if;
  if p_request ? 'reason' then
    if pg_catalog.jsonb_typeof(p_request->'reason') is distinct from 'string'
       or not platform_private.cms_editorial_reason_valid(p_request->>'reason', 256, false) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reason"]';
    end if;
    reason_text := p_request->>'reason';
  end if;

  -- 2. the step-up proof, before the review is read and before the reservation (E6)
  perform platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404) and the owner gate (403)
  grantor_person := platform_private.identity_actor_person(actor_id);
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review;
  if not found or review_row.owner_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  scopes := platform_private.cms_editorial_review_scopes(review_row.id, actor_id, acting_party_id);
  if pg_catalog.cardinality(scopes) = 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not ('owner' = any (scopes)) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if action = 'create' then
    if not platform_private.cms_person_holds_capability(review_row.owner_id, grantor_person, 'cms.editor') then
      raise exception 'capability_missing' using errcode = 'P0001';
    end if;
  end if;

  -- 4. the authority rows (position 1), then the idempotency reservation
  perform platform_private.cms_lock_person_authority(
    review_row.owner_id,
    case when action = 'create' then array[grantor_person, reviewer_person]::uuid[]
         else array[grantor_person]::uuid[] end,
    array['cms.editor', 'cms.reviewer']::text[]
  );
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-18');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5. the review row (position 5): state, then the CAS operand
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review
     for update;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if review_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, review_row.version);
  end if;

  starts := pg_catalog.clock_timestamp();
  if action = 'create' then
    -- 6a. eligibility: one uniform refusal, never an existence or role signal
    select revision_item.author_person_id into revision_author
      from platform_private.cms_entry_revisions revision_item
     where revision_item.id = review_row.revision_id;
    if reviewer_person = review_row.submitted_by
       or reviewer_person = revision_author
       or not platform_private.cms_review_person_eligible(reviewer_person)
       or not platform_private.cms_person_holds_capability(review_row.owner_id, reviewer_person, 'cms.reviewer') then
      raise exception 'reviewer_not_eligible' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from platform_private.cms_editorial_review_assignments existing
       where existing.review_id = review_row.id
         and existing.reviewer_person_id = reviewer_person
         and existing.state = 'active'
    ) then
      raise exception 'assignment_exists' using errcode = 'P0001';
    end if;
    select pg_catalog.count(*)::integer into active_count
      from platform_private.cms_editorial_review_assignments existing
     where existing.review_id = review_row.id
       and existing.state = 'active'
       and existing.ends_at > starts;
    if active_count >= 16 then
      raise exception 'assignment_limit' using errcode = 'P0001';
    end if;
    -- 6b. the window: after now, at most seven days, within both grants
    select grant_item.valid_through into grant_through
      from identity_private.organization_actor_grant grant_item
     where grant_item.organization_id = review_row.owner_id
       and grant_item.person_id = reviewer_person
       and grant_item.capability_code = 'cms.reviewer';
    reviewer_end := case when grant_through is null then 'infinity'::timestamptz
                         else ((grant_through + 1)::timestamp at time zone 'UTC') end;
    select grant_item.valid_through into grant_through
      from identity_private.organization_actor_grant grant_item
     where grant_item.organization_id = review_row.owner_id
       and grant_item.person_id = grantor_person
       and grant_item.capability_code = 'cms.editor';
    grantor_end := case when grant_through is null then 'infinity'::timestamptz
                        else ((grant_through + 1)::timestamp at time zone 'UTC') end;
    if ends <= starts
       or ends > starts + interval '7 days'
       or ends > reviewer_end
       or ends > grantor_end then
      raise exception 'expiry_out_of_bounds' using errcode = 'P0001', detail = '["/expiresAt"]';
    end if;
    assignment_id := extensions.gen_random_uuid();
    insert into platform_private.cms_editorial_review_assignments(
      id, owner_id, review_id, reviewer_person_id, grantor_person_id, capability_key,
      actions, state, starts_at, ends_at, reason, version, created_at, updated_at
    ) values (
      assignment_id, review_row.owner_id, review_row.id, reviewer_person, grantor_person,
      'cms.editorial_review', array['read', 'decide']::text[], 'active', starts, ends,
      reason_text, 1, starts, starts
    );
    status_code := 201;
  else
    select assignment_item.* into assignment_row
      from platform_private.cms_editorial_review_assignments assignment_item
     where assignment_item.id = requested_assignment
       and assignment_item.review_id = review_row.id
       for update;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if assignment_row.state <> 'active' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    assignment_id := assignment_row.id;
    -- DEC-161 / BE03b "Review invalidation": the assignment authorized a COUNTED approve (the decider
    -- still holds the standing capability, the assignment is not yet revoked) of this OPEN review.
    counted_approve := exists (
      select 1
        from platform_private.cms_editorial_review_qualifying_decisions(review_row.id) counted
       where counted.assignment_id = assignment_row.id
    );
    update platform_private.cms_editorial_review_assignments assignment_item
       set state = 'revoked',
           version = assignment_item.version + 1,
           updated_at = starts
     where assignment_item.id = assignment_id;
    status_code := 200;
  end if;

  perform platform_private.cms_emit_event(
    'cms.editorial.review.assignment.' || action, actor_id, acting_party_id,
    'cms_editorial_review', review_row.id, 'CMS_EDITORIAL_REVIEW_ASSIGNMENT_CHANGED',
    'cms.entry.review-changed.v1', 'cms_editorial_review', review_row.id, review_row.version,
    pg_catalog.jsonb_build_object('reviewId', review_row.id, 'revisionId', review_row.revision_id),
    correlation_id
  );
  if counted_approve then
    -- The review row is already held (position 5), so the core takes no earlier lock (DEC-157).
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'reasonCode', 'reviewer_authority_changed',
      'correlationId', correlation_id, 'actorId', actor_id));
  end if;
  response := platform_private.cms_editorial_assignment_resource(assignment_id);
  perform platform_private.cms_complete(reservation.id, assignment_id, status_code, response);
  return response;
end;
$body$;

comment on function platform_private.cms_assign_editorial_reviewer(jsonb) is
  'CMS-03B-18: the receipt-derived owner creates or revokes a bounded read+decide reviewer assignment on one open editorial review under step-up, the review row lock and the exact review version; the review version never advances. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_assign_editorial_reviewer(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_assign_editorial_reviewer(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the command reads and writes, held by the definer role only.
grant select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;
grant insert, select, update on table platform_private.cms_editorial_review_assignments
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_assign_editorial_reviewer(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_assign_editorial_reviewer(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_assign_editorial_reviewer(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_assign_editorial_reviewer(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_assign_editorial_reviewer(jsonb) to service_role;

commit;
