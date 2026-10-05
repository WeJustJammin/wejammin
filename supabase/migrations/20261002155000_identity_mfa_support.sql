-- DEC-111 private support functions shared by the MFA / step-up RPCs.  None is
-- granted to any API role; only the named platform_api wrappers (and the
-- identity admin reset) call them.  Forward-only.
begin;

-- The account binding of one Auth UUID.  Mutations lock it for the
-- transaction (`p_lock`, the default); read-only calls do not.  The MFA
-- surface is available to `active` and eligible `claimed` accounts only.
create function platform_private.mfa_lock_binding(p_auth_user_id uuid, p_lock boolean default true)
returns identity.auth_user_bindings
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
begin
  if p_auth_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_lock then
    select * into binding from identity.auth_user_bindings
     where auth_user_id = p_auth_user_id for update;
  else
    select * into binding from identity.auth_user_bindings
     where auth_user_id = p_auth_user_id;
  end if;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if binding.state not in ('claimed', 'active') then
    raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  return binding;
end;
$body$;

-- The initiating first-party session must be this Auth UUID's active row.
create function platform_private.mfa_require_session(p_auth_user_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_session_id is null or not exists (
    select 1 from identity.auth_session_index session_row
     where session_row.session_id = p_session_id
       and session_row.auth_user_id = p_auth_user_id
       and session_row.state = 'active'
  ) then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
end;
$body$;

create function platform_private.mfa_parse_version(p_version text)
returns bigint
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if p_version is null or p_version !~ '^[1-9][0-9]{0,17}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return p_version::bigint;
end;
$body$;

-- `If-Match` compare-and-set against the per-account MFA version.
create function platform_private.mfa_require_version(p_mfa_version bigint, p_expected text)
returns void
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if platform_private.mfa_parse_version(p_expected) <> p_mfa_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
end;
$body$;

create function platform_private.mfa_require_name(p_name text)
returns void
language plpgsql
immutable
set search_path = ''
as $body$
begin
  if p_name is null
     or pg_catalog.char_length(p_name) not between 1 and 80
     or p_name <> pg_catalog.btrim(p_name)
     or p_name ~ '[[:cntrl:]]'
     or not (p_name is nfc normalized) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
end;
$body$;

-- Every factor-row state change bumps the MFA version (the ETag).
create function platform_private.mfa_bump(p_binding_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $body$
declare
  bumped bigint;
begin
  update identity.auth_user_bindings
     set mfa_version = mfa_version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = p_binding_id
   returning mfa_version into bumped;
  return bumped;
end;
$body$;

-- The safe client projection: application ids only, expired pending rows and
-- terminal rows omitted, no provider reference.
create function platform_private.mfa_projection(p_auth_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'factors', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', factor.id,
        'method', factor.method,
        'friendlyName', factor.friendly_name,
        'state', factor.state::text,
        'verifiedAt', platform_private.auth_iso_time(factor.verified_at),
        'lastUsedAt', platform_private.auth_iso_time(factor.last_used_at),
        'pendingExpiresAt', platform_private.auth_iso_time(factor.pending_expires_at)
      ) order by factor.created_at, factor.id)
      from identity.mfa_factor_registry factor
      where factor.auth_user_id = p_auth_user_id
        and (factor.state in ('verified', 'reconciling')
          or (factor.state = 'pending'
              and factor.pending_expires_at > pg_catalog.clock_timestamp()))
    ), '[]'::jsonb),
    'version', (
      select binding.mfa_version::text from identity.auth_user_bindings binding
       where binding.auth_user_id = p_auth_user_id
    )
  )
$body$;

-- Immutable security evidence; returns the event id the notifier references.
create function platform_private.mfa_security_event(
  p_action text, p_auth_user_id uuid, p_session_id uuid, p_outcome text,
  p_reason_code text, p_request_id uuid, p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  event_id uuid;
begin
  insert into identity.security_events(
    action, actor_auth_user_id, session_id, safe_outcome, reason_code,
    request_id, correlation_id
  ) values (
    p_action, p_auth_user_id, p_session_id, p_outcome, p_reason_code,
    p_request_id, p_correlation_id
  ) returning id into event_id;
  return event_id;
end;
$body$;

create function platform_private.mfa_audit(
  p_action text, p_actor_id uuid, p_acting_party_id uuid, p_target_type text,
  p_target_id uuid, p_reason_code text, p_correlation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $body$
  insert into audit_private.audit_events(
    action, actor_id, acting_party_id, target_type, target_id,
    decision, reason_code, correlation_id
  ) values (
    p_action, p_actor_id, p_acting_party_id, p_target_type, p_target_id,
    'allowed', p_reason_code, p_correlation_id
  )
$body$;

-- identity.mfa-factor.changed.v1: identifiers only, never a secret or provider id.
create function platform_private.mfa_factor_changed_event(
  p_factor_id uuid, p_factor_version bigint, p_binding_id uuid, p_correlation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $body$
  insert into platform_private.outbox_events(
    event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
    correlation_id, payload
  ) values (
    'identity.mfa-factor.changed.v1', 1, 'mfa_factor', p_factor_id, p_factor_version,
    p_correlation_id,
    pg_catalog.jsonb_build_object('mfaFactorId', p_factor_id, 'authBindingId', p_binding_id)
  )
$body$;

-- identity.security-notification.requested.v1: the notifier rereads the
-- security event; no email, template body or secret travels in the queue.
create function platform_private.mfa_notification_request(
  p_security_event_id uuid, p_binding_id uuid, p_correlation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $body$
  insert into platform_private.outbox_events(
    event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
    correlation_id, payload
  ) values (
    'identity.security-notification.requested.v1', 1, 'security_event',
    p_security_event_id, 1, p_correlation_id,
    pg_catalog.jsonb_build_object(
      'securityEventId', p_security_event_id, 'authBindingId', p_binding_id)
  )
$body$;

-- First-party session rotation to the aal2 session, inside the settle
-- transaction.  Same id: touch the index row.  Different id: register the new
-- active row and revoke the initiating row by exact session id, so one step-up
-- never leaves two live rows.  Any refusal raises and rolls the settlement back.
create function platform_private.mfa_rotate_session(
  p_auth_user_id uuid, p_session_id uuid, p_new_session_id uuid, p_issued_at timestamptz,
  p_binding_id uuid, p_request_id uuid, p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  changed integer;
begin
  if p_new_session_id is null or p_issued_at is null
     or p_issued_at > pg_catalog.clock_timestamp() + interval '30 seconds' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_new_session_id = p_session_id then
    update identity.auth_session_index
       set last_seen_at = pg_catalog.clock_timestamp(), version = version + 1
     where session_id = p_session_id and auth_user_id = p_auth_user_id and state = 'active';
    get diagnostics changed = row_count;
    if changed <> 1 then
      raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
    end if;
    return;
  end if;
  update identity.auth_session_index
     set state = 'revoked', revoked_at = pg_catalog.clock_timestamp(),
         revocation_reason = 'mfa_step_up_rotation', version = version + 1
   where session_id = p_session_id and auth_user_id = p_auth_user_id and state = 'active';
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  insert into identity.auth_session_index(
    session_id, auth_user_id, binding_id, state, issued_at, last_seen_at
  ) values (
    p_new_session_id, p_auth_user_id, p_binding_id, 'active', p_issued_at,
    pg_catalog.clock_timestamp()
  ) on conflict (session_id) do nothing;
  get diagnostics changed = row_count;
  if changed <> 1 then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_security_event(
    'identity.auth.session.rotated', p_auth_user_id, p_new_session_id, 'completed',
    'SESSION_ROTATED', p_request_id, p_correlation_id
  );
end;
$body$;

-- Protected step-up designation: the capability keys whose operations require
-- step-up MFA.  CMS-03A-04 activation (cms.schema_designer), CMS-03A-12
-- decisions (cms.schema_review), CMS-03A-14 assignment (cms.schema_review.assign)
-- and every admin.* capability (BE05b admin operations are step-up gated).
-- Code-owned; extended only by a forward migration.
create function platform_private.step_up_capability_designated(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select coalesce(
    p_key in ('cms.schema_designer', 'cms.schema_review', 'cms.schema_review.assign')
    or p_key ~ '^admin\.[a-z0-9_.-]+$',
    false)
$body$;

-- Does the person currently hold any step-up designated capability?  Reads the
-- currently effective authority only: confirmed unended membership + active,
-- in-window CMS/admin grants, an active in-window review assignment, and the
-- immutable owner-initialization receipt (CMS-03A-15..17 need no grant).
create function platform_private.mfa_step_up_capability_held(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
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
$body$;

-- Removing the last verified factor is refused while a step-up capability is
-- held.  The read fails closed: any error refuses the removal.
create function platform_private.mfa_require_not_last_factor(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if platform_private.mfa_step_up_capability_held(p_person_id) then
    raise exception 'LAST_FACTOR_REQUIRED' using errcode = 'P0001';
  end if;
exception when others then
  raise exception 'LAST_FACTOR_REQUIRED' using errcode = 'P0001';
end;
$body$;

revoke all on function
  platform_private.mfa_lock_binding(uuid, boolean),
  platform_private.mfa_require_session(uuid, uuid),
  platform_private.mfa_parse_version(text),
  platform_private.mfa_require_version(bigint, text),
  platform_private.mfa_require_name(text),
  platform_private.mfa_bump(uuid),
  platform_private.mfa_projection(uuid),
  platform_private.mfa_security_event(text, uuid, uuid, text, text, uuid, uuid),
  platform_private.mfa_audit(text, uuid, uuid, text, uuid, text, uuid),
  platform_private.mfa_factor_changed_event(uuid, bigint, uuid, uuid),
  platform_private.mfa_notification_request(uuid, uuid, uuid),
  platform_private.mfa_rotate_session(uuid, uuid, uuid, timestamptz, uuid, uuid, uuid),
  platform_private.step_up_capability_designated(text),
  platform_private.mfa_step_up_capability_held(uuid),
  platform_private.mfa_require_not_last_factor(uuid)
from public, anon, authenticated, service_role;

commit;
