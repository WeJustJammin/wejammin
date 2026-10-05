-- DEC-119/DEC-120 shared authority for the owner CMS capability grant commands:
-- receipt-derived owner, subject eligibility, the derived lapse state, the safe
-- resource projection, the actor-grant projection writer and the event writer.
-- Every function is a pinned-search_path private helper with no role grant.
-- Forward-only.
begin;

-- The owner is the immutable cms_owner_initialization receipt identity acting
-- in the receipt organization.  No capability key and no currently valid CMS
-- grant is required, so a lapsed owner grant stays recoverable (DEC-120).
-- Returns the owner's person id, else FORBIDDEN.
create or replace function platform_private.cms_grant_owner(
  p_actor_id uuid, p_acting_party_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  owner_person uuid;
begin
  owner_person := platform_private.identity_actor_person(p_actor_id);
  if owner_person is null
     or p_acting_party_id is null
     or not exists (
       select 1 from platform_private.cms_owner_initialization receipt
        where receipt.auth_user_id = p_actor_id
          and receipt.person_id = owner_person
          and receipt.organization_id = p_acting_party_id
     ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return owner_person;
end;
$body$;

-- A real, claimed or active, non-banned human with a confirmed, unended
-- membership in the owner's organization.  Anything else is indistinguishable.
create or replace function platform_private.cms_grant_subject_eligible(
  p_organization_id uuid, p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select p_person_id is not null
    and platform_private.cms_review_person_eligible(p_person_id)
    and exists (
      select 1 from identity_private.membership_tenure tenure
       where tenure.organization_id = p_organization_id
         and tenure.person_id = p_person_id
         and tenure.state = 'confirmed'
         and (tenure.ends_on is null or tenure.ends_on >= (pg_catalog.now() at time zone 'UTC')::date)
    )
$body$;

-- The current UTC calendar date, the clock every grant term is read against.
create or replace function platform_private.cms_grant_today()
returns date
language sql
stable
set search_path = ''
as $body$
  select (pg_catalog.now() at time zone 'UTC')::date
$body$;

-- Derived external state: `lapsed` is an `active` physical row whose
-- valid_through is before the current UTC date.
create or replace function platform_private.cms_capability_grant_state(
  p_state text, p_valid_through date
)
returns text
language sql
stable
set search_path = ''
as $body$
  select case
    when p_state = 'revoked' then 'revoked'
    when p_valid_through < platform_private.cms_grant_today() then 'lapsed'
    else 'active'
  end
$body$;

-- CmsCapabilityGrantResource: ResourceMeta plus the grant term; no grantor,
-- actor, party, binding or ownership identifier.
create or replace function platform_private.cms_capability_grant_resource(p_grant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_with_content_hash(pg_catalog.jsonb_build_object(
    'resourceKind', 'cms_capability_grant',
    'id', grant_row.id,
    'version', grant_row.version::text,
    'createdAt', grant_row.created_at,
    'updatedAt', grant_row.updated_at,
    'state', platform_private.cms_capability_grant_state(grant_row.state, grant_row.valid_through),
    'subjectPersonId', grant_row.subject_person_ref,
    'capability', grant_row.capability_code,
    'validFrom', pg_catalog.to_char(grant_row.valid_from, 'YYYY-MM-DD'),
    'validThrough', pg_catalog.to_char(grant_row.valid_through, 'YYYY-MM-DD'),
    'endsAt', ((grant_row.valid_through + 1)::timestamp at time zone 'UTC'),
    'lastAction', grant_row.last_action,
    'reason', grant_row.reason
  ))
  from platform_private.cms_capability_grants grant_row
  where grant_row.id = p_grant_id
$body$;

-- The effective-authority projection every CMS capability predicate reads.  Only
-- the grant, renew and revoke commands call it, in the aggregate's transaction.
create or replace function platform_private.cms_capability_grant_project(
  p_organization_id uuid, p_person_id uuid, p_capability text,
  p_valid_from date, p_valid_through date, p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  insert into identity_private.organization_actor_grant(
    organization_id, person_id, capability_code, valid_from, valid_through, active,
    created_at, updated_at
  ) values (
    p_organization_id, p_person_id, p_capability, p_valid_from, p_valid_through, p_active,
    pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
  )
  on conflict (organization_id, person_id, capability_code) do update
    set valid_from = excluded.valid_from,
        valid_through = excluded.valid_through,
        active = excluded.active,
        updated_at = excluded.updated_at;
end;
$body$;

-- Appends the one event row of an aggregate write.  The binding identity is the
-- same versioned private projection review decisions use and is never serialized.
create or replace function platform_private.cms_capability_grant_record_event(
  p_grant_id uuid, p_action text, p_prior_valid_through date,
  p_actor_id uuid, p_acting_party_id uuid, p_binding_id uuid, p_mfa_verified_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  recorded_at timestamptz := pg_catalog.clock_timestamp();
begin
  -- created_at and updated_at are one value: the event row is immutable.
  insert into platform_private.cms_capability_grant_events(
    owner_id, grant_id, aggregate_version, action, subject_person_ref, capability_code,
    grantor_person_ref, valid_from, valid_through, prior_valid_through, reason,
    binding_context_hash, mfa_verified_at, created_at, updated_at
  )
  select grant_row.owner_id, grant_row.id, grant_row.version, p_action,
         grant_row.subject_person_ref, grant_row.capability_code,
         grant_row.grantor_person_ref, grant_row.valid_from, grant_row.valid_through,
         p_prior_valid_through, grant_row.reason,
         platform_private.cms_review_context_hash(
           p_actor_id, platform_private.identity_actor_person(p_actor_id),
           p_acting_party_id, p_binding_id),
         p_mfa_verified_at, recorded_at, recorded_at
    from platform_private.cms_capability_grants grant_row
   where grant_row.id = p_grant_id;
end;
$body$;

-- Parses a request term: a real calendar date read as a UTC date, not before the
-- current UTC date and not after today + 89 (90 UTC days, DEC-120).
create or replace function platform_private.cms_grant_valid_through(p_value jsonb)
returns date
language plpgsql
stable
set search_path = ''
as $body$
declare
  parsed date;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'string'
     or (p_value #>> '{}') !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  begin
    parsed := (p_value #>> '{}')::date;
  exception when others then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end;
  -- 2027-02-30 is rejected by the cast; 2027-02-29 style overflow cannot round-trip.
  if pg_catalog.to_char(parsed, 'YYYY-MM-DD') <> (p_value #>> '{}')
     or parsed < platform_private.cms_grant_today()
     or parsed > platform_private.cms_grant_today() + 89 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return parsed;
end;
$body$;

-- Optional reason: NFC-normalized, 1 to 256 octets (the table bound).
create or replace function platform_private.cms_grant_reason(p_request jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
declare
  reason_text text;
begin
  if not p_request ? 'reason' then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reason') <> 'string' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  reason_text := normalize(p_request->>'reason', nfc);
  if pg_catalog.octet_length(reason_text) not between 1 and 256 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return reason_text;
end;
$body$;

revoke all on function platform_private.cms_grant_owner(uuid, uuid),
  platform_private.cms_grant_subject_eligible(uuid, uuid),
  platform_private.cms_grant_today(),
  platform_private.cms_capability_grant_state(text, date),
  platform_private.cms_capability_grant_resource(uuid),
  platform_private.cms_capability_grant_project(uuid, uuid, text, date, date, boolean),
  platform_private.cms_capability_grant_record_event(uuid, text, date, uuid, uuid, uuid, timestamptz),
  platform_private.cms_grant_valid_through(jsonb),
  platform_private.cms_grant_reason(jsonb)
  from public, anon, authenticated, service_role;

commit;
