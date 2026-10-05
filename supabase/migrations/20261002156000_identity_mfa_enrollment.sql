-- DEC-111 / BE01a AUTH-API-16, -17, -18: the factor list read, TOTP enrollment
-- start (transaction A: supersede + CAS; transaction B: insert the pending row
-- after the Worker's provider enrollment) and enrollment verify (prepare, then
-- settle together with the first-party session rotation).  The Worker calls
-- Supabase MFA itself; PostgreSQL records protected registry state only and
-- never a TOTP secret, URI or code.  Service-role-only SECURITY DEFINER
-- wrappers with a pinned empty search_path.  Forward-only.
begin;

create function platform_api.auth_mfa_factors_read(
  p_auth_user_id uuid, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
begin
  if p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id, false);
  return platform_private.mfa_projection(binding.auth_user_id);
end;
$body$;

-- Transaction A.  CAS on the MFA version, supersede any pending row (the
-- Worker removes that unverified provider factor first, so the provider's
-- per-user friendly-name uniqueness cannot collide), and refuse a full or
-- name-colliding account.  The version moves only when a row was superseded.
create function platform_api.auth_mfa_enrollment_begin(
  p_auth_user_id uuid, p_friendly_name text, p_expected_version text,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  superseded identity.mfa_factor_registry%rowtype;
  superseded_provider_id uuid;
  current_version bigint;
  live_count integer;
begin
  perform platform_private.mfa_require_name(p_friendly_name);
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_version(binding.mfa_version, p_expected_version);
  current_version := binding.mfa_version;
  select * into superseded from identity.mfa_factor_registry
   where auth_user_id = p_auth_user_id and state = 'pending' for update;
  if found then
    update identity.mfa_factor_registry
       set state = 'expired', pending_expires_at = null, version = version + 1,
           updated_at = pg_catalog.clock_timestamp()
     where id = superseded.id
     returning * into superseded;
    superseded_provider_id := superseded.provider_factor_id;
    current_version := platform_private.mfa_bump(binding.id);
    perform platform_private.mfa_security_event(
      'mfa.enroll.expired', p_auth_user_id, null, 'completed', 'ENROLLMENT_SUPERSEDED',
      p_request_id, p_correlation_id);
    perform platform_private.mfa_factor_changed_event(
      superseded.id, superseded.version, binding.id, p_correlation_id);
  end if;
  select count(*)::integer into live_count from identity.mfa_factor_registry
   where auth_user_id = p_auth_user_id and state in ('pending', 'verified', 'reconciling');
  if live_count >= 10 then
    raise exception 'MFA_FACTOR_LIMIT' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from identity.mfa_factor_registry
     where auth_user_id = p_auth_user_id
       and state in ('pending', 'verified', 'reconciling')
       and pg_catalog.lower(friendly_name) = pg_catalog.lower(p_friendly_name)
  ) then
    raise exception 'FACTOR_NAME_TAKEN' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'supersededProviderFactorId', superseded_provider_id,
    'version', current_version::text
  );
end;
$body$;

-- Transaction B.  Insert the pending row (10-minute window) for the provider
-- factor the Worker just enrolled and bump the MFA version.
create function platform_api.auth_mfa_enrollment_finish(
  p_auth_user_id uuid, p_provider_factor_id uuid, p_friendly_name text,
  p_expected_version text, p_session_id uuid, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  started_at timestamptz := pg_catalog.clock_timestamp();
  live_count integer;
  violated text;
  new_version bigint;
begin
  if p_provider_factor_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_require_name(p_friendly_name);
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  perform platform_private.mfa_require_version(binding.mfa_version, p_expected_version);
  select count(*)::integer into live_count from identity.mfa_factor_registry
   where auth_user_id = p_auth_user_id and state in ('pending', 'verified', 'reconciling');
  if live_count >= 10 then
    raise exception 'MFA_FACTOR_LIMIT' using errcode = 'P0001';
  end if;
  begin
    insert into identity.mfa_factor_registry(
      auth_user_id, provider_factor_id, friendly_name, state, pending_expires_at,
      created_at, updated_at
    ) values (
      p_auth_user_id, p_provider_factor_id, p_friendly_name, 'pending',
      started_at + interval '10 minutes', started_at, started_at
    ) returning * into factor;
  exception when unique_violation then
    get stacked diagnostics violated = constraint_name;
    if violated = 'mfa_factor_live_name_per_user' then
      raise exception 'FACTOR_NAME_TAKEN' using errcode = 'P0001';
    end if;
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end;
  new_version := platform_private.mfa_bump(binding.id);
  perform platform_private.mfa_audit(
    'identity.mfa.enroll.started', p_auth_user_id, binding.person_id, 'mfa_factor',
    factor.id, 'MFA_ENROLLMENT_STARTED', p_correlation_id);
  perform platform_private.mfa_security_event(
    'mfa.enroll.started', p_auth_user_id, p_session_id, 'completed',
    'MFA_ENROLLMENT_STARTED', p_request_id, p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'factorId', factor.id,
    'expiresAt', platform_private.auth_iso_time(factor.pending_expires_at),
    'version', new_version::text
  );
end;
$body$;

-- Read-only: the protected provider factor id of an owned, pending, unexpired
-- factor, so the Worker can create the provider challenge and verify the code.
create function platform_api.auth_mfa_enrollment_verify_prepare(
  p_auth_user_id uuid, p_factor_id uuid, p_expected_version text,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  if p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id, false);
  perform platform_private.mfa_require_version(binding.mfa_version, p_expected_version);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state <> 'pending' then
    raise exception 'FACTOR_NOT_PENDING' using errcode = 'P0001';
  end if;
  if factor.pending_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'ENROLLMENT_EXPIRED' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object('providerFactorId', factor.provider_factor_id);
end;
$body$;

-- Settlement: pending -> verified, audit, security evidence, outbox events and
-- the first-party session rotation commit in ONE transaction, so a refused
-- rotation rolls the settlement back and the factor stays recoverable.
create function platform_api.auth_mfa_enrollment_verify_settle(
  p_auth_user_id uuid, p_factor_id uuid, p_expected_version text, p_session_id uuid,
  p_new_session_id uuid, p_issued_at timestamptz, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  event_id uuid;
begin
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  perform platform_private.mfa_require_version(binding.mfa_version, p_expected_version);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state <> 'pending' then
    raise exception 'FACTOR_NOT_PENDING' using errcode = 'P0001';
  end if;
  if factor.pending_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'ENROLLMENT_EXPIRED' using errcode = 'P0001';
  end if;
  update identity.mfa_factor_registry
     set state = 'verified', pending_expires_at = null,
         verified_at = pg_catalog.clock_timestamp(), last_used_at = pg_catalog.clock_timestamp(),
         version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = factor.id
   returning * into factor;
  perform platform_private.mfa_bump(binding.id);
  perform platform_private.mfa_rotate_session(
    p_auth_user_id, p_session_id, p_new_session_id, p_issued_at, binding.id,
    p_request_id, p_correlation_id);
  perform platform_private.mfa_audit(
    'identity.mfa.enroll.verified', p_auth_user_id, binding.person_id, 'mfa_factor',
    factor.id, 'MFA_FACTOR_ADDED', p_correlation_id);
  event_id := platform_private.mfa_security_event(
    'mfa.enroll.verified', p_auth_user_id, p_session_id, 'completed', 'MFA_FACTOR_ADDED',
    p_request_id, p_correlation_id);
  perform platform_private.mfa_factor_changed_event(
    factor.id, factor.version, binding.id, p_correlation_id);
  perform platform_private.mfa_notification_request(event_id, binding.id, p_correlation_id);
  return platform_private.mfa_projection(p_auth_user_id);
end;
$body$;

-- A post-send provider ambiguity (timeout, invalid 2xx, local finalization
-- failure) marks the row reconciling; the auth-state-reconciler settles it.
create function platform_api.auth_mfa_factor_mark_reconciling(
  p_auth_user_id uuid, p_factor_id uuid, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state = 'reconciling' then
    return pg_catalog.jsonb_build_object('marked', true);
  end if;
  if factor.state not in ('pending', 'verified') then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  update identity.mfa_factor_registry
     set state = 'reconciling', version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = factor.id
   returning * into factor;
  perform platform_private.mfa_bump(binding.id);
  perform platform_private.mfa_security_event(
    'mfa.factor.reconciling', p_auth_user_id, null, 'pending', 'PROVIDER_AMBIGUOUS',
    p_request_id, p_correlation_id);
  perform platform_private.mfa_factor_changed_event(
    factor.id, factor.version, binding.id, p_correlation_id);
  return pg_catalog.jsonb_build_object('marked', true);
end;
$body$;

-- auth-state-reconciler: settles a reconciling row by the provider's factor
-- status.  `verified`, `pending` (only while the 10-minute window is open and
-- no other pending row exists, otherwise the row settles to expired) or
-- `removed`.  Never driven by a client.
create function platform_api.auth_mfa_factor_reconcile(
  p_auth_user_id uuid, p_factor_id uuid, p_outcome text,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  next_state identity.mfa_factor_state;
begin
  if p_outcome is null or p_outcome not in ('verified', 'pending', 'removed') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state <> 'reconciling' then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  next_state := case p_outcome
    when 'verified' then 'verified'::identity.mfa_factor_state
    when 'removed' then 'removed'::identity.mfa_factor_state
    when 'pending' then case
      when factor.pending_expires_at is not null
           and factor.pending_expires_at > pg_catalog.clock_timestamp()
           and not exists (
             select 1 from identity.mfa_factor_registry other
              where other.auth_user_id = p_auth_user_id and other.state = 'pending')
        then 'pending'::identity.mfa_factor_state
      else 'expired'::identity.mfa_factor_state end
  end;
  update identity.mfa_factor_registry
     set state = next_state,
         pending_expires_at = case when next_state = 'pending' then pending_expires_at end,
         verified_at = case when next_state = 'verified'
                            then coalesce(verified_at, pg_catalog.clock_timestamp())
                            else verified_at end,
         removed_at = case when next_state = 'removed' then pg_catalog.clock_timestamp() end,
         version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = factor.id
   returning * into factor;
  perform platform_private.mfa_bump(binding.id);
  perform platform_private.mfa_security_event(
    'mfa.factor.reconciled', p_auth_user_id, null, 'completed', 'MFA_FACTOR_RECONCILED',
    p_request_id, p_correlation_id);
  perform platform_private.mfa_factor_changed_event(
    factor.id, factor.version, binding.id, p_correlation_id);
  return pg_catalog.jsonb_build_object('state', factor.state::text);
end;
$body$;

revoke all on function
  platform_api.auth_mfa_factors_read(uuid, uuid, uuid),
  platform_api.auth_mfa_enrollment_begin(uuid, text, text, uuid, uuid),
  platform_api.auth_mfa_enrollment_finish(uuid, uuid, text, text, uuid, uuid, uuid),
  platform_api.auth_mfa_enrollment_verify_prepare(uuid, uuid, text, uuid, uuid),
  platform_api.auth_mfa_enrollment_verify_settle(uuid, uuid, text, uuid, uuid, timestamptz, uuid, uuid),
  platform_api.auth_mfa_factor_mark_reconciling(uuid, uuid, uuid, uuid),
  platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, uuid, uuid)
from public, anon, authenticated;

grant execute on function
  platform_api.auth_mfa_factors_read(uuid, uuid, uuid),
  platform_api.auth_mfa_enrollment_begin(uuid, text, text, uuid, uuid),
  platform_api.auth_mfa_enrollment_finish(uuid, uuid, text, text, uuid, uuid, uuid),
  platform_api.auth_mfa_enrollment_verify_prepare(uuid, uuid, text, uuid, uuid),
  platform_api.auth_mfa_enrollment_verify_settle(uuid, uuid, text, uuid, uuid, timestamptz, uuid, uuid),
  platform_api.auth_mfa_factor_mark_reconciling(uuid, uuid, uuid, uuid),
  platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, uuid, uuid)
to service_role;

commit;
