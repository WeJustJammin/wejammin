-- A confirmed membership confers nothing before its first day: every
-- effective-capability predicate and the CMS grant subject-eligibility check
-- require tenure.starts_on <= the current UTC date, exactly as they already
-- require ends_on to be unreached, so an already-recorded future membership
-- cannot be granted a capability nor hold one before its tenure begins
-- (organization membership boundary).  CMS-03A-15 additionally locks the
-- subject's tenure row (FOR SHARE, ordered after the owner/subject/capability
-- advisory lock) and rechecks eligibility before it writes the aggregate and its
-- actor-grant projection, so a membership that ends or is revoked between the
-- eligibility read and the write is refused with 404.  Forward-only.
begin;

create or replace function platform_private.cms_grant_subject_lock(
  p_organization_id uuid, p_person_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform 1
    from identity_private.membership_tenure tenure
   where tenure.organization_id = p_organization_id
     and tenure.person_id = p_person_id
     and tenure.state = 'confirmed'
     and tenure.starts_on <= (pg_catalog.clock_timestamp() at time zone 'UTC')::date
     and (tenure.ends_on is null
          or tenure.ends_on >= (pg_catalog.clock_timestamp() at time zone 'UTC')::date)
   order by tenure.id
     for share;
  if not found then
    return false;
  end if;
  perform 1 from platform_private.person_party person
   where person.party_id = p_person_id
     for share;
  return platform_private.cms_grant_subject_eligible(p_organization_id, p_person_id);
end;
$body$;

revoke all on function platform_private.cms_grant_subject_lock(uuid, uuid)
  from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION platform_private.cfg_require_capability(p_actor_id uuid, p_acting_party_id uuid, p_capability text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  person_party_id uuid;
begin
  if p_actor_id is null
     or p_acting_party_id is null
     or p_capability is null
     or p_capability !~ '^[a-z][a-z0-9_.-]{1,127}$' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  person_party_id := platform_private.identity_actor_person(p_actor_id);
  if person_party_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
     where tenure.organization_id = p_acting_party_id
       and tenure.person_id = person_party_id
       and tenure.state = 'confirmed'
       and tenure.starts_on <= current_date
       and (tenure.ends_on is null or tenure.ends_on >= current_date)
       and actor_grant.capability_code = p_capability
       and actor_grant.active
       and actor_grant.valid_from <= current_date
       and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_authority_origin(p_actor_id uuid, p_acting_party_id uuid, p_capability_key text, p_entry_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
  grant_present boolean;
  assignment_present boolean;
begin
  if p_capability_key is null
     or p_capability_key not in ('cms.author', 'cms.editor', 'cms.reviewer')
     or not platform_private.cms_capability_registry_valid(p_capability_key, 1) then
    return null;
  end if;
  if p_actor_id is null or p_acting_party_id is null then
    return null;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return null;
  end if;
  select exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code = p_capability_key
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) into grant_present;
  if not grant_present then
    return null;
  end if;
  if p_entry_id is null then
    return 'grant';
  end if;
  select exists (
    select 1
    from platform_private.cms_entry_assignments assignment
    where assignment.entry_id = p_entry_id
      and assignment.owner_id = p_acting_party_id
      and assignment.assignee_person_id = resolved_person_id
      and assignment.capability_key = p_capability_key
      and assignment.state = 'active'
  ) into assignment_present;
  if not assignment_present then
    return null;
  end if;
  return 'assignment';
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_entry_tenant_visible(p_actor_id uuid, p_owner_party_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_owner_party_id is null then
    return false;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  if resolved_person_id is null then
    return false;
  end if;
  return exists (
    select 1
    from identity_private.membership_tenure tenure
    where tenure.organization_id = p_owner_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_template_designer_authorized(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  if p_actor_id is null or p_acting_party_id is null
     or not platform_private.cms_capability_registry_valid('cms.template_designer', 1) then
    return false;
  end if;
  begin
    resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    return false;
  end;
  if resolved_person_id is null then return false; end if;
  return exists (
    select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
     where tenure.organization_id = p_acting_party_id
       and tenure.person_id = resolved_person_id
       and tenure.state = 'confirmed'
       and tenure.starts_on <= current_date
       and (tenure.ends_on is null or tenure.ends_on >= current_date)
       and actor_grant.capability_code = 'cms.template_designer'
       and actor_grant.active
       and actor_grant.valid_from <= current_date
       and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.mfa_step_up_capability_held(p_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
      select 1
        from identity_private.organization_actor_grant actor_grant
        join identity_private.membership_tenure tenure
          on tenure.organization_id = actor_grant.organization_id
         and tenure.person_id = actor_grant.person_id
       where actor_grant.person_id = p_person_id
         and actor_grant.active
         and actor_grant.valid_from <= (pg_catalog.clock_timestamp() at time zone 'UTC')::date
         and (actor_grant.valid_through is null
              or actor_grant.valid_through >= (pg_catalog.clock_timestamp() at time zone 'UTC')::date)
         and tenure.state = 'confirmed'
         and tenure.starts_on <= (pg_catalog.clock_timestamp() at time zone 'UTC')::date
         and (tenure.ends_on is null
              or tenure.ends_on >= (pg_catalog.clock_timestamp() at time zone 'UTC')::date)
         and platform_private.step_up_capability_designated(actor_grant.capability_code)
    )
    or exists (
      select 1 from platform_private.admin_capability_grants admin_grant
       where admin_grant.subject_person_id = p_person_id
         and admin_grant.state = 'active'
         and admin_grant.starts_at <= pg_catalog.clock_timestamp()
         and admin_grant.ends_at > pg_catalog.clock_timestamp()
         and platform_private.step_up_capability_designated(admin_grant.capability_key)
    )
    or exists (
      select 1 from platform_private.cms_schema_review_assignments assignment
       where assignment.reviewer_person_ref = p_person_id
         and assignment.state = 'active'
         and assignment.starts_at <= pg_catalog.clock_timestamp()
         and assignment.ends_at > pg_catalog.clock_timestamp()
    )
    or exists (
      select 1 from platform_private.cms_owner_initialization receipt
       where receipt.person_id = p_person_id
    )
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_person_holds_capability(p_organization_id uuid, p_person_id uuid, p_capability text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
      from identity_private.membership_tenure tenure
      join identity_private.organization_actor_grant actor_grant
        on actor_grant.organization_id = tenure.organization_id
       and actor_grant.person_id = tenure.person_id
     where tenure.organization_id = p_organization_id
       and tenure.person_id = p_person_id
       and tenure.state = 'confirmed'
       and tenure.starts_on <= current_date
       and (tenure.ends_on is null or tenure.ends_on >= current_date)
       and actor_grant.capability_code = p_capability
       and actor_grant.active
       and actor_grant.valid_from <= current_date
       and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  )
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_require_capability(p_actor_id uuid, p_acting_party_id uuid, p_capability text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  if resolved_person_id is null or p_acting_party_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code = p_capability
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_require_read(p_actor_id uuid, p_acting_party_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_person_id uuid;
begin
  resolved_person_id := platform_private.identity_actor_person(p_actor_id);
  if resolved_person_id is null or p_acting_party_id is null then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from identity_private.membership_tenure tenure
    join identity_private.organization_actor_grant actor_grant
      on actor_grant.organization_id = tenure.organization_id
     and actor_grant.person_id = tenure.person_id
    where tenure.organization_id = p_acting_party_id
      and tenure.person_id = resolved_person_id
      and tenure.state = 'confirmed'
      and tenure.starts_on <= current_date
      and (tenure.ends_on is null or tenure.ends_on >= current_date)
      and actor_grant.capability_code in ('cms.schema_registry.read', 'cms.schema_designer')
      and actor_grant.active
      and actor_grant.valid_from <= current_date
      and (actor_grant.valid_through is null or actor_grant.valid_through >= current_date)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_grant_subject_eligible(p_organization_id uuid, p_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_person_id is not null
    and platform_private.cms_review_person_eligible(p_person_id)
    and exists (
      select 1 from identity_private.membership_tenure tenure
       where tenure.organization_id = p_organization_id
         and tenure.person_id = p_person_id
         and tenure.state = 'confirmed'
         and tenure.starts_on <= (pg_catalog.now() at time zone 'UTC')::date
         and (tenure.ends_on is null or tenure.ends_on >= (pg_catalog.now() at time zone 'UTC')::date)
    )
$function$;

CREATE OR REPLACE FUNCTION identity_private.require_organization_actor(p_organization_id uuid, p_actor_id uuid, p_capability text DEFAULT 'organization.admin'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  acting_party_id uuid;
begin
  if p_organization_id is null or p_actor_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  acting_party_id := identity_private.trusted_acting_party(p_actor_id);
  if acting_party_id not in (p_actor_id, p_organization_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from identity_private.membership_tenure t
     where t.organization_id = p_organization_id
       and t.person_id = p_actor_id
       and t.state = 'confirmed'
       and t.starts_on <= current_date
       and (t.ends_on is null or t.ends_on >= current_date)
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_capability is null or p_capability = '' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from identity_private.organization_actor_grant g
     where g.organization_id = p_organization_id
       and g.person_id = p_actor_id
       and g.active
       and g.valid_from <= current_date
       and (g.valid_through is null or g.valid_through >= current_date)
       and (
         g.capability_code = p_capability
         or (p_capability = 'organization.admin'
             and g.capability_code in ('organization.owner', 'organization.admin'))
         or (p_capability = 'organization.type.manage'
             and g.capability_code in ('organization.owner', 'organization.admin', 'organization.type.manage'))
         or (p_capability = 'organization.membership.invite'
             and g.capability_code in ('organization.owner', 'organization.admin', 'organization.membership.invite'))
         or (p_capability = 'organization.membership.assert'
             and g.capability_code in ('organization.owner', 'organization.admin', 'organization.membership.assert'))
         or (p_capability = 'organization.membership.end'
             and g.capability_code in ('organization.owner', 'organization.admin', 'organization.membership.end'))
         or (p_capability = 'organization.membership.capacity'
             and g.capability_code in ('organization.owner', 'organization.admin', 'organization.membership.capacity'))
       )
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end;
$function$;

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
      raise exception 'CONFLICT' using errcode = 'P0001';
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
