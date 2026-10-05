-- AC527 (orchestrator ruling): CMS-03A-15 for an existing active aggregate is a 409 CONFLICT
-- that directs the owner to renew.  The database signals it with DETAIL ACTIVE_GRANT_EXISTS
-- (the PostgREST `details` the Worker adapter reads); every other conflict of the command
-- (idempotency, version) stays detail-free.  Body regenerated from the live function, one
-- statement changed.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_grant_capability(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid;
  acting_party_id uuid;
  owner_person uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  binding_id uuid;
  mfa_at timestamptz;
  subject_person uuid;
  capability_key text;
  through date;
  today date := platform_private.cms_grant_today();
  reason_text text;
  grant_row platform_private.cms_capability_grants%rowtype;
  grant_id uuid;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(p_request, actor_id, 'CMS-03A-15');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['subjectPersonId','capability','validThrough']::text[],
    array['subjectPersonId','capability','validThrough','reason',
          'idempotencyKey','context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- Owner derivation: receipt identity alone (403), then the private binding
  -- with recent binding-bound MFA (401 STEP_UP_REQUIRED).
  owner_person := platform_private.cms_grant_owner(actor_id, acting_party_id);
  select binding.binding_id, binding.mfa_verified_at into binding_id, mfa_at
    from platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true) binding;
  if pg_catalog.jsonb_typeof(p_request->'subjectPersonId') <> 'string'
     or not platform_private.cms_valid_uuid(p_request->>'subjectPersonId')
     or pg_catalog.jsonb_typeof(p_request->'capability') <> 'string'
     or not platform_private.cms_grantable_capability(p_request->>'capability') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  subject_person := (p_request->>'subjectPersonId')::uuid;
  capability_key := p_request->>'capability';
  through := platform_private.cms_grant_valid_through(p_request->'validThrough');
  reason_text := platform_private.cms_grant_reason(p_request);
  if not platform_private.cms_grant_subject_eligible(acting_party_id, subject_person) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Lock the (owner, subject, capability) key even while the aggregate is absent.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'cms-capability-grant:' || acting_party_id::text || ':' || subject_person::text || ':' || capability_key, 0));
  -- Lock and recheck the subject's tenure under the (owner, subject, capability)
  -- lock: a membership that ended, or whose start is still ahead, between the
  -- eligibility read above and this point must not receive a grant.
  if not platform_private.cms_grant_subject_lock(acting_party_id, subject_person) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into grant_row
    from platform_private.cms_capability_grants existing
   where existing.owner_id = acting_party_id
     and existing.subject_person_ref = subject_person
     and existing.capability_code = capability_key
   for update;
  if found then
    if grant_row.state = 'active' then
      -- An existing active aggregate: the owner is directed to renew it (AC527).
      raise exception 'CONFLICT' using errcode = 'P0001', detail = 'ACTIVE_GRANT_EXISTS';
    end if;
    update platform_private.cms_capability_grants
       set state = 'active', version = grant_row.version + 1,
           updated_at = pg_catalog.clock_timestamp(),
           valid_from = today, valid_through = through,
           grantor_person_ref = owner_person, last_action = 'granted', reason = reason_text
     where id = grant_row.id;
    grant_id := grant_row.id;
  else
    grant_id := extensions.gen_random_uuid();
    insert into platform_private.cms_capability_grants(
      id, owner_id, state, version, subject_person_ref, capability_code,
      valid_from, valid_through, grantor_person_ref, last_action, reason
    ) values (
      grant_id, acting_party_id, 'active', 1, subject_person, capability_key,
      today, through, owner_person, 'granted', reason_text
    );
  end if;
  perform platform_private.cms_capability_grant_project(
    acting_party_id, subject_person, capability_key, today, through, true);
  perform platform_private.cms_capability_grant_record_event(
    grant_id, 'granted', null, actor_id, acting_party_id, binding_id, mfa_at);
  perform platform_private.cms_emit_event(
    'cms.capability.grant.granted', actor_id, acting_party_id, 'cms_capability_grant',
    grant_id, 'CMS_CAPABILITY_GRANT_CHANGED', 'cms.capability.grant.changed.v1',
    'cms_capability_grant', grant_id,
    (select grant_version.version from platform_private.cms_capability_grants grant_version
      where grant_version.id = grant_id),
    pg_catalog.jsonb_build_object('grantId', grant_id, 'subjectPersonId', subject_person),
    correlation_id
  );
  response := platform_private.cms_capability_grant_resource(grant_id);
  perform platform_private.cms_complete(reservation.id, grant_id, 201, response);
  return response;
end;
$function$;

commit;
