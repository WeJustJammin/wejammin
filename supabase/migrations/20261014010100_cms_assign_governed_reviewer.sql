-- Slice 12 lane governed-a, CMS-03C-08 (BE03c Route Registry 173, Governed review machinery, Per-operation authorization
-- matrix, Slice 12 lock order; BE03b "Review scopes, reviewer assignment and decision evaluation" CMS-03B-18 applied with the
-- governed substitutions; DEC-137, DEC-157, DEC-158(b); tracker P2-S12-AC-076 .. AC-080):
--   platform_private.cms_assign_governed_reviewer(p_request jsonb) returns jsonb, with the platform_api wrapper the Worker calls
--   (service_role only).
--
-- The receipt-derived owner creates or revokes a bounded `read`+`decide` assignment of one reviewer on one OPEN governed review.
-- Order of the evaluation (every refusal is a P0001 whose whole message is the token; nothing it refuses is committed):
--   1. structure: exact keys per action, UUIDs, agreeing versions, offset-ISO expiry, optional 1..256 code-point NFC reason;
--   2. the step-up proof before the review is read and before the reservation;
--   3. concealment (404) and the owner gate (403: the immutable owner receipt identity holding a valid designer or curator grant),
--      proved twice around the position 1 lock of the grantor and reviewer authority rows;
--   4. the idempotency reservation (an exact replay returns the stored response);
--   5. a revoke takes the SUBJECT version row (position 3) before the review row (position 5), because revoking a counted approval
--      invalidates; review_not_open, then the CAS operand (VERSION_MISMATCH);
--   6. create: uniform reviewer_not_eligible, assignment_exists, assignment_limit (16), expiry_out_of_bounds (<= 7 days, the reviewer
--      grant day end, the grantor grant day end); revoke: NOT_FOUND for another review's assignment, CONFLICT when already revoked.
-- The review `version` never advances on a create or on a revoke that authorized no counted approval.  One audit record commits
-- with the change and the completed idempotency record; governed review state changes emit no event.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_assign_governed_reviewer(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_grantor uuid;
  v_correlation uuid;
  v_action text;
  v_review_id uuid;
  v_expected bigint;
  v_reviewer uuid;
  v_assignment_req uuid;
  v_reason text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_reviewer_end timestamptz;
  v_grantor_end timestamptz;
  v_through date;
  v_scopes text[];
  v_owner_capability text;
  v_reservation platform_private.idempotency_records;
  v_review platform_private.cms_governed_reviews%rowtype;
  v_assignment platform_private.cms_governed_review_assignments%rowtype;
  v_subject jsonb;
  v_assignment_id uuid;
  v_active integer;
  v_counted boolean := false;
  v_status integer;
  v_response jsonb;
  v_pass integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation := platform_private.cms_correlation(p_request);

  -- 1. structure
  if pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_action := p_request->>'action';
  if v_action = 'create' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'reviewerPersonId', 'expiresAt']::text[],
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'reviewerPersonId', 'expiresAt', 'reason',
            'context', 'correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif v_action = 'revoke' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'assignmentId']::text[],
      array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'assignmentId', 'reason',
            'context', 'correlationId']::text[]
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
  v_expected := platform_private.cms_governed_cas_operand(p_request);
  v_review_id := (p_request->>'reviewId')::uuid;
  if v_action = 'create' then
    if pg_catalog.jsonb_typeof(p_request->'reviewerPersonId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'reviewerPersonId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reviewerPersonId"]';
    end if;
    v_reviewer := (p_request->>'reviewerPersonId')::uuid;
    if pg_catalog.jsonb_typeof(p_request->'expiresAt') is distinct from 'string'
       or p_request->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expiresAt"]';
    end if;
    begin
      v_ends := (p_request->>'expiresAt')::timestamptz;
    exception when others then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expiresAt"]';
    end;
  else
    if pg_catalog.jsonb_typeof(p_request->'assignmentId') is distinct from 'string'
       or platform_private.cms_valid_uuid(p_request->>'assignmentId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/assignmentId"]';
    end if;
    v_assignment_req := (p_request->>'assignmentId')::uuid;
  end if;
  if p_request ? 'reason' then
    if pg_catalog.jsonb_typeof(p_request->'reason') is distinct from 'string'
       or not platform_private.cms_editorial_reason_valid(p_request->>'reason', 256, false) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/reason"]';
    end if;
    v_reason := p_request->>'reason';
  end if;

  -- 2. the step-up proof, before the review is read and before the reservation
  perform platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404), the owner gate (403) and the authority rows (position 1), proved twice: pass 1 reads the committed state
  --    and decides whether this organization's authority rows may be locked at all; pass 2 re-proves the SAME authority under the
  --    locks, so a revocation that committed while this command waited wins with the pass 1 token.
  for v_pass in 1..2 loop
    v_grantor := platform_private.identity_actor_person(v_actor_id);
    select review_item.* into v_review
      from platform_private.cms_governed_reviews review_item
     where review_item.id = v_review_id;
    if not found or v_review.owner_id is distinct from v_party_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    v_scopes := platform_private.cms_governed_review_scopes(v_review.id, v_actor_id, v_party_id);
    if pg_catalog.cardinality(v_scopes) = 0 then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if not ('owner' = any (v_scopes)) then
      raise exception 'capability_missing' using errcode = 'P0001';
    end if;
    v_owner_capability := platform_private.cms_governed_owner_capability(v_review.subject_kind);
    if not platform_private.cms_person_holds_capability(v_review.owner_id, v_grantor, v_owner_capability) then
      raise exception 'capability_missing' using errcode = 'P0001';
    end if;
    if v_pass = 1 then
      perform platform_private.cms_lock_person_authority(
        v_review.owner_id,
        case when v_action = 'create' then array[v_grantor, v_reviewer]::uuid[] else array[v_grantor]::uuid[] end,
        array[v_owner_capability, 'cms.reviewer']::text[]);
    end if;
  end loop;

  -- 4. the idempotency reservation (an exact replay returns the stored response)
  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-08');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config('response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5. the subject row (position 3, revoke only: it may invalidate), then the review row (position 5)
  if v_action = 'revoke' then
    v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  end if;
  select review_item.* into v_review
    from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review_id
     for update;
  if v_review.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  if v_review.version <> v_expected then
    perform platform_private.cms_raise_version_mismatch(v_expected, v_review.version);
  end if;

  v_starts := pg_catalog.clock_timestamp();
  if v_action = 'create' then
    -- 6a. eligibility: one uniform refusal, never an existence or role signal
    v_subject := platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id);
    if v_reviewer = v_review.submitted_by
       or v_reviewer::text is not distinct from v_subject->>'creatorPerson'
       or not platform_private.cms_review_person_eligible(v_reviewer)
       or not platform_private.cms_person_holds_capability(v_review.owner_id, v_reviewer, 'cms.reviewer') then
      raise exception 'reviewer_not_eligible' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from platform_private.cms_governed_review_assignments existing
       where existing.review_id = v_review.id and existing.reviewer_person_id = v_reviewer and existing.state = 'active'
    ) then
      raise exception 'assignment_exists' using errcode = 'P0001';
    end if;
    select pg_catalog.count(*)::integer into v_active
      from platform_private.cms_governed_review_assignments existing
     where existing.review_id = v_review.id and existing.state = 'active' and existing.ends_at > v_starts;
    if v_active >= 16 then
      raise exception 'assignment_limit' using errcode = 'P0001';
    end if;
    -- 6b. the window: after now, at most seven days, within both grants (the day a grant is valid through ends at midnight UTC)
    select grant_item.valid_through into v_through
      from identity_private.organization_actor_grant grant_item
     where grant_item.organization_id = v_review.owner_id and grant_item.person_id = v_reviewer
       and grant_item.capability_code = 'cms.reviewer';
    v_reviewer_end := case when v_through is null then 'infinity'::timestamptz
                           else ((v_through + 1)::timestamp at time zone 'UTC') end;
    select grant_item.valid_through into v_through
      from identity_private.organization_actor_grant grant_item
     where grant_item.organization_id = v_review.owner_id and grant_item.person_id = v_grantor
       and grant_item.capability_code = v_owner_capability;
    v_grantor_end := case when v_through is null then 'infinity'::timestamptz
                          else ((v_through + 1)::timestamp at time zone 'UTC') end;
    if v_ends <= v_starts or v_ends > v_starts + interval '7 days' or v_ends > v_reviewer_end or v_ends > v_grantor_end then
      raise exception 'expiry_out_of_bounds' using errcode = 'P0001', detail = '["/expiresAt"]';
    end if;
    v_assignment_id := extensions.gen_random_uuid();
    insert into platform_private.cms_governed_review_assignments(
      id, owner_id, review_id, reviewer_person_id, grantor_person_id, capability_key, actions, state,
      starts_at, ends_at, reason, version, created_at, updated_at
    ) values (
      v_assignment_id, v_review.owner_id, v_review.id, v_reviewer, v_grantor, 'cms.definition_review',
      array['read', 'decide']::text[], 'active', v_starts, v_ends, v_reason, 1, v_starts, v_starts
    );
    v_status := 201;
  else
    select assignment_item.* into v_assignment
      from platform_private.cms_governed_review_assignments assignment_item
     where assignment_item.id = v_assignment_req and assignment_item.review_id = v_review.id
       for update;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_assignment.state <> 'active' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    v_assignment_id := v_assignment.id;
    -- the assignment authorized a COUNTED approval of this open review (read before it is revoked)
    v_counted := exists (
      select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
       where counted.assignment_id = v_assignment.id
    );
    update platform_private.cms_governed_review_assignments assignment_item
       set state = 'revoked', version = assignment_item.version + 1, updated_at = pg_catalog.clock_timestamp()
     where assignment_item.id = v_assignment_id;
    v_status := 200;
  end if;

  perform platform_private.cms_record_audit(
    'cms.governed.review.assignment.' || v_action, v_actor_id, v_party_id,
    'cms_governed_review', v_review.id, 'CMS_GOVERNED_REVIEW_ASSIGNMENT_CHANGED', v_correlation);
  if v_counted then
    -- the subject (position 3) and the review row (position 5) are held, so the helper takes no earlier lock
    perform platform_private.cms_governed_invalidate_open_review(
      v_review.id, 'reviewer_authority_changed', v_actor_id, v_party_id, v_correlation);
  end if;
  v_response := platform_private.cms_governed_assignment_resource(v_assignment_id);
  perform platform_private.cms_complete(v_reservation.id, v_assignment_id, v_status, v_response);
  return v_response;
end;
$body$;

comment on function platform_private.cms_assign_governed_reviewer(jsonb) is
  'CMS-03C-08: the receipt-derived owner creates or revokes a bounded read+decide reviewer assignment on one open governed review under step-up, the Slice 12 lock order and the exact review version; the review version never advances, except that revoking the assignment of a counted approval invalidates the review reviewer_authority_changed. Private; the Worker calls the platform_api wrapper.';

-- SEC-2: what the command reads and writes, held by the definer role only (idempotent restatements).
grant select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant insert, select, update on table platform_private.cms_governed_review_assignments to wejammin_cms_definer;
grant select on table platform_private.cms_governed_review_decisions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_assign_governed_reviewer(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_assign_governed_reviewer(jsonb)
  from public, anon, authenticated, service_role;

commit;
