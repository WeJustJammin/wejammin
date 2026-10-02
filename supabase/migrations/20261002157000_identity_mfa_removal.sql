-- DEC-111 / BE01a AUTH-API-19: TOTP factor removal.  `begin` reserves the
-- removal (the row becomes reconciling, audit, security evidence, idempotency
-- reservation and outbox commit BEFORE the provider effect); the Worker then
-- unenrolls the provider factor with the caller's token; `finish` confirms
-- `removed`.  An unresolved provider effect blocks duplicate removal and is
-- never blindly resent.  Removing the last verified factor is refused while the
-- account holds a step-up capability (fail closed).  Forward-only.
begin;

create function platform_api.auth_mfa_removal_begin(
  p_auth_user_id uuid, p_factor_id uuid, p_reason text, p_expected_version text,
  p_session_id uuid, p_key_hash bytea, p_request_hash bytea,
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
  existing platform_private.idempotency_records%rowtype;
  other_verified integer;
begin
  if p_reason is null or p_reason not in ('user_request', 'factor_compromise')
     or p_key_hash is null or pg_catalog.octet_length(p_key_hash) <> 32
     or p_request_hash is null or pg_catalog.octet_length(p_request_hash) <> 32 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  select * into existing from platform_private.idempotency_records
   where actor_id = p_auth_user_id and operation = 'AUTH-API-19' and key_hash = p_key_hash
   for update;
  if found then
    if existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_MISMATCH' using errcode = 'P0001';
    end if;
    if existing.state = 'completed'::platform_private.idempotency_state then
      select * into factor from identity.mfa_factor_registry
       where id = p_factor_id and auth_user_id = p_auth_user_id;
      if not found then
        raise exception 'NOT_FOUND' using errcode = 'P0001';
      end if;
      return pg_catalog.jsonb_build_object(
        'providerFactorId', factor.provider_factor_id,
        'replay', platform_private.mfa_projection(p_auth_user_id));
    end if;
    -- Reserved: the provider effect is unresolved; the reconciler owns it.
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  insert into platform_private.idempotency_records(
    actor_id, operation, key_hash, request_hash, expires_at
  ) values (
    p_auth_user_id, 'AUTH-API-19', p_key_hash, p_request_hash,
    pg_catalog.clock_timestamp() + interval '30 days'
  );
  perform platform_private.mfa_require_version(binding.mfa_version, p_expected_version);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state not in ('pending', 'verified') then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  if factor.state = 'verified' then
    select count(*)::integer into other_verified from identity.mfa_factor_registry other
     where other.auth_user_id = p_auth_user_id and other.state = 'verified'
       and other.id <> factor.id;
    if other_verified = 0 then
      perform platform_private.mfa_require_not_last_factor(binding.person_id);
    end if;
  end if;
  update identity.mfa_factor_registry
     set state = 'reconciling', version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = factor.id
   returning * into factor;
  perform platform_private.mfa_bump(binding.id);
  -- A compromise declaration revokes every OTHER active session of this user
  -- by exact session id; the current session is retained.
  if p_reason = 'factor_compromise' then
    update identity.auth_session_index
       set state = 'revoked', revoked_at = pg_catalog.clock_timestamp(),
           revocation_reason = 'mfa_factor_compromise', version = version + 1
     where auth_user_id = p_auth_user_id and session_id <> p_session_id and state = 'active';
    perform platform_private.mfa_security_event(
      'identity.auth.sessions.revoked', p_auth_user_id, p_session_id, 'completed',
      'FACTOR_COMPROMISE_SESSIONS_REVOKED', p_request_id, p_correlation_id);
  end if;
  perform platform_private.mfa_audit(
    'identity.mfa.factor.removal_reserved', p_auth_user_id, binding.person_id,
    'mfa_factor', factor.id, 'MFA_FACTOR_REMOVAL_RESERVED', p_correlation_id);
  perform platform_private.mfa_security_event(
    'mfa.factor.removed', p_auth_user_id, p_session_id, 'pending',
    'MFA_FACTOR_REMOVAL_RESERVED', p_request_id, p_correlation_id);
  perform platform_private.mfa_factor_changed_event(
    factor.id, factor.version, binding.id, p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'providerFactorId', factor.provider_factor_id, 'replay', null);
end;
$body$;

create function platform_api.auth_mfa_removal_finish(
  p_auth_user_id uuid, p_factor_id uuid, p_reason text, p_session_id uuid,
  p_key_hash bytea, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  reservation platform_private.idempotency_records%rowtype;
  event_id uuid;
begin
  if p_reason is null or p_reason not in ('user_request', 'factor_compromise')
     or p_key_hash is null or pg_catalog.octet_length(p_key_hash) <> 32 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into reservation from platform_private.idempotency_records
   where actor_id = p_auth_user_id and operation = 'AUTH-API-19' and key_hash = p_key_hash
   for update;
  if factor.state = 'removed' and found
     and reservation.state = 'completed'::platform_private.idempotency_state then
    return platform_private.mfa_projection(p_auth_user_id);
  end if;
  if factor.state <> 'reconciling' or not found
     or reservation.state <> 'reserved'::platform_private.idempotency_state then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  update identity.mfa_factor_registry
     set state = 'removed', pending_expires_at = null,
         removed_at = pg_catalog.clock_timestamp(), version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where id = factor.id
   returning * into factor;
  perform platform_private.mfa_bump(binding.id);
  perform platform_private.mfa_audit(
    'identity.mfa.factor.removed', p_auth_user_id, binding.person_id, 'mfa_factor',
    factor.id, 'MFA_FACTOR_REMOVED', p_correlation_id);
  event_id := platform_private.mfa_security_event(
    'mfa.factor.removed', p_auth_user_id, p_session_id, 'completed', 'MFA_FACTOR_REMOVED',
    p_request_id, p_correlation_id);
  perform platform_private.mfa_factor_changed_event(
    factor.id, factor.version, binding.id, p_correlation_id);
  perform platform_private.mfa_notification_request(event_id, binding.id, p_correlation_id);
  update platform_private.idempotency_records
     set state = 'completed'::platform_private.idempotency_state,
         response_ref = pg_catalog.jsonb_build_object(
           'status', 200, 'resourceRef', factor.id::text)
   where id = reservation.id;
  return platform_private.mfa_projection(p_auth_user_id);
end;
$body$;

revoke all on function
  platform_api.auth_mfa_removal_begin(uuid, uuid, text, text, uuid, bytea, bytea, uuid, uuid),
  platform_api.auth_mfa_removal_finish(uuid, uuid, text, uuid, bytea, uuid, uuid)
from public, anon, authenticated;

grant execute on function
  platform_api.auth_mfa_removal_begin(uuid, uuid, text, text, uuid, bytea, bytea, uuid, uuid),
  platform_api.auth_mfa_removal_finish(uuid, uuid, text, uuid, bytea, uuid, uuid)
to service_role;

commit;
