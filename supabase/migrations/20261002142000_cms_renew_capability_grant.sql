-- CMS-03A-16 (DEC-119/DEC-120): the receipt-derived owner renews an `active`
-- grant aggregate, effective or lapsed, at its exact version.  The term restarts
-- from the current UTC date (valid_from = today, valid_through <= today + 89) and
-- there is no cumulative cap, so repeated renewal is allowed.  A revoked aggregate
-- is refused (409) and is re-established only by CMS-03A-15.  Forward-only.
begin;

create or replace function platform_private.cms_renew_capability_grant(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  binding_id uuid;
  mfa_at timestamptz;
  expected_version bigint;
  through date;
  today date := platform_private.cms_grant_today();
  reason_text text;
  grant_row platform_private.cms_capability_grants%rowtype;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-16:' || coalesce(p_request->>'grantId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['grantId','expectedVersion','validThrough']::text[],
    array['grantId','expectedVersion','validThrough','reason',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'grantId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  perform platform_private.cms_grant_owner(actor_id, acting_party_id);
  select binding.binding_id, binding.mfa_verified_at into binding_id, mfa_at
    from platform_private.cms_review_binding(p_request, actor_id, acting_party_id, true) binding;
  through := platform_private.cms_grant_valid_through(p_request->'validThrough');
  reason_text := platform_private.cms_grant_reason(p_request);
  select * into grant_row
    from platform_private.cms_capability_grants existing
   where existing.id = (p_request->>'grantId')::uuid
     and existing.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if grant_row.state <> 'active' or grant_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_capability_grants
     set version = grant_row.version + 1, updated_at = pg_catalog.clock_timestamp(),
         valid_from = today, valid_through = through, last_action = 'renewed',
         reason = coalesce(reason_text, grant_row.reason)
   where id = grant_row.id;
  perform platform_private.cms_capability_grant_project(
    acting_party_id, grant_row.subject_person_ref, grant_row.capability_code, today, through, true);
  perform platform_private.cms_capability_grant_record_event(
    grant_row.id, 'renewed', grant_row.valid_through, actor_id, acting_party_id, binding_id, mfa_at);
  perform platform_private.cms_emit_event(
    'cms.capability.grant.renewed', actor_id, acting_party_id, 'cms_capability_grant',
    grant_row.id, 'CMS_CAPABILITY_GRANT_CHANGED', 'cms.capability.grant.changed.v1',
    'cms_capability_grant', grant_row.id, grant_row.version + 1,
    pg_catalog.jsonb_build_object('grantId', grant_row.id, 'subjectPersonId', grant_row.subject_person_ref),
    correlation_id
  );
  response := platform_private.cms_capability_grant_resource(grant_row.id);
  perform platform_private.cms_complete(reservation.id, grant_row.id, 200, response);
  return response;
end;
$body$;

create or replace function platform_api.cms_renew_capability_grant(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_renew_capability_grant(p_request)
$body$;

revoke all on function platform_private.cms_renew_capability_grant(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_renew_capability_grant(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_renew_capability_grant(jsonb) to service_role;

commit;
