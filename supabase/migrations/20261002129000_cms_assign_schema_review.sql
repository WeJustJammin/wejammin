-- CMS-03A-14: the server-derived owner (immutable initialization receipt
-- identity AND a currently valid CMS grant) creates or revokes a bounded,
-- fixed read+decide assignment on one frozen review.  The assignment never
-- creates an identity, never grants an organization or admin capability and
-- is bounded to seven days and to the grantor's own authority end.
-- Forward-only.
begin;

create or replace function platform_private.cms_assign_schema_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_schema_reviews%rowtype;
  assignment_row platform_private.cms_schema_review_assignments%rowtype;
  action text;
  expected_version bigint;
  reviewer_person uuid;
  starts timestamptz := pg_catalog.clock_timestamp();
  ends timestamptz;
  authority_end timestamptz;
  assignment_id uuid;
  reason_text text;
  response jsonb;
  status_code integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-14:' || coalesce(p_request->>'reviewId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  action := p_request->>'action';
  if action = 'create' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId','action','expectedVersion','reviewerPersonId','expiresAt']::text[],
      array['reviewId','action','expectedVersion','reviewerPersonId','expiresAt','reason',
            'idempotencyKey','ifMatch','context','correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif action = 'revoke' then
    if not platform_private.cms_exact_keys(
      p_request,
      array['reviewId','action','expectedVersion','assignmentId']::text[],
      array['reviewId','action','expectedVersion','assignmentId','reason',
            'idempotencyKey','ifMatch','context','correlationId']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not platform_private.cms_valid_uuid(p_request->>'reviewId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if p_request ? 'reason' then
    reason_text := p_request->>'reason';
    if pg_catalog.jsonb_typeof(p_request->'reason') <> 'string'
       or pg_catalog.octet_length(reason_text) not between 1 and 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  person_id := platform_private.identity_actor_person(actor_id);
  -- Concealment first: a review outside the caller's designer or assigned
  -- scope is indistinguishable from an absent one.
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = (p_request->>'reviewId')::uuid for update;
  if not found
     or platform_private.cms_review_scope(review_row.id, actor_id, acting_party_id) is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  authority_end := platform_private.cms_review_owner_authority_end(actor_id, acting_party_id);
  perform platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true);
  if review_row.version <> expected_version or review_row.state <> 'open' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if action = 'create' then
    if not platform_private.cms_valid_uuid(p_request->>'reviewerPersonId')
       or pg_catalog.jsonb_typeof(p_request->'expiresAt') <> 'string'
       or p_request->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    begin
      ends := (p_request->>'expiresAt')::timestamptz;
    exception when others then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end;
    reviewer_person := (p_request->>'reviewerPersonId')::uuid;
    if reviewer_person = review_row.submitter_person_ref
       or not platform_private.cms_review_person_eligible(reviewer_person)
       or not coalesce((
         -- The reviewer's current binding is their most recently selected one.
         select reviewer_binding.state = 'active' and reviewer_binding.expires_at > starts
           from platform_private.acting_context_binding reviewer_binding
          where reviewer_binding.person_id = reviewer_person
          order by reviewer_binding.selected_at desc, reviewer_binding.id desc
          limit 1
       ), false)
       or ends <= starts
       or ends > starts + interval '7 days'
       or ends > authority_end
       or exists (
         select 1 from platform_private.cms_schema_review_decisions decision
          where decision.review_id = review_row.id
            and decision.reviewer_person_ref = reviewer_person
       )
       or exists (
         select 1 from platform_private.cms_schema_review_assignments existing
          where existing.review_id = review_row.id
            and existing.reviewer_person_ref = reviewer_person
            and platform_private.cms_review_assignment_effective(
              existing.state, existing.starts_at, existing.ends_at)
       ) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    assignment_id := extensions.gen_random_uuid();
    insert into platform_private.cms_schema_review_assignments(
      id, owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key,
      actions, state, starts_at, ends_at, reason, created_at, updated_at, version
    ) values (
      assignment_id, review_row.owner_id, review_row.id, reviewer_person, person_id,
      'cms.schema_review', array['read', 'decide']::text[], 'active', starts, ends,
      reason_text, starts, starts, 1
    );
    status_code := 201;
  else
    if not platform_private.cms_valid_uuid(p_request->>'assignmentId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    select * into assignment_row from platform_private.cms_schema_review_assignments existing
     where existing.id = (p_request->>'assignmentId')::uuid
       and existing.review_id = review_row.id
       and existing.state = 'active'
     for update;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    assignment_id := assignment_row.id;
    update platform_private.cms_schema_review_assignments existing
       set state = 'revoked',
           reason = coalesce(reason_text, existing.reason),
           version = existing.version + 1,
           updated_at = pg_catalog.clock_timestamp()
     where existing.id = assignment_id;
    status_code := 200;
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.review.assignment.' || action, actor_id, acting_party_id,
    'cms_schema_review_assignment', assignment_id, 'CMS_SCHEMA_REVIEW_ASSIGNMENT_CHANGED',
    'cms.schema.review.assignment.changed.v1', 'cms_schema_review_assignment', assignment_id,
    (select assignment.version from platform_private.cms_schema_review_assignments assignment
      where assignment.id = assignment_id),
    pg_catalog.jsonb_build_object(
      'reviewId', review_row.id, 'assignmentId', assignment_id,
      'state', case when action = 'create' then 'active' else 'revoked' end
    ), correlation_id
  );
  response := platform_private.cms_schema_review_assignment_resource(assignment_id);
  perform platform_private.cms_complete(reservation.id, assignment_id, status_code, response);
  return response;
end;
$body$;

create or replace function platform_api.cms_assign_schema_review(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_assign_schema_review(p_request)
$body$;

revoke all on function platform_private.cms_assign_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_assign_schema_review(jsonb) to service_role;
revoke all on function platform_api.cms_assign_schema_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_assign_schema_review(jsonb) to service_role;

commit;
