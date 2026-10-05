-- DEC-111 / BE01a AUTH-API-20 and -21: step-up challenge create (begin:
-- resolve + supersede; finish: insert the pending challenge after the Worker's
-- provider challenge), verify (prepare, failure bookkeeping, settle with the
-- first-party aal2 session rotation).  A challenge is bound to the Auth UUID,
-- the exact session id and the factor at creation, expires at the earlier of
-- the provider expiry and created_at + 10 minutes, and is consumed once.  The
-- DB stores no code and no token; a successful step-up never bumps the MFA
-- version.  Service-role-only SECURITY DEFINER wrappers.  Forward-only.
begin;

create function platform_api.auth_step_up_challenge_begin(
  p_auth_user_id uuid, p_session_id uuid, p_method text, p_factor_id uuid,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  factor identity.mfa_factor_registry%rowtype;
  verified_count integer;
begin
  if p_method is distinct from 'totp' or p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  if p_factor_id is null then
    select count(*)::integer into verified_count from identity.mfa_factor_registry
     where auth_user_id = p_auth_user_id and state = 'verified';
    if verified_count = 0 then
      raise exception 'NO_VERIFIED_FACTOR' using errcode = 'P0001';
    end if;
    if verified_count > 1 then
      raise exception 'FACTOR_ID_REQUIRED' using errcode = 'P0001';
    end if;
    select * into factor from identity.mfa_factor_registry
     where auth_user_id = p_auth_user_id and state = 'verified' for update;
  else
    select * into factor from identity.mfa_factor_registry
     where id = p_factor_id and auth_user_id = p_auth_user_id for update;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if factor.state = 'reconciling' then
      raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
    end if;
    if factor.state <> 'verified' then
      raise exception 'FACTOR_NOT_VERIFIED' using errcode = 'P0001';
    end if;
  end if;
  update identity.step_up_challenges
     set state = 'expired', version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where session_id = p_session_id and factor_id = factor.id and state = 'pending';
  return pg_catalog.jsonb_build_object(
    'factorId', factor.id,
    'providerFactorId', factor.provider_factor_id,
    'friendlyName', factor.friendly_name
  );
end;
$body$;

create function platform_api.auth_step_up_challenge_finish(
  p_auth_user_id uuid, p_session_id uuid, p_factor_id uuid, p_provider_challenge_id uuid,
  p_expires_at timestamptz, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  factor identity.mfa_factor_registry%rowtype;
  created timestamptz := pg_catalog.clock_timestamp();
  window_end timestamptz;
  challenge identity.step_up_challenges%rowtype;
begin
  if p_provider_challenge_id is null or p_expires_at is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if factor.state = 'reconciling' then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  if factor.state <> 'verified' then
    raise exception 'FACTOR_NOT_VERIFIED' using errcode = 'P0001';
  end if;
  window_end := least(p_expires_at, created + interval '10 minutes');
  if window_end <= created then
    raise exception 'CHALLENGE_EXPIRED' using errcode = 'P0001';
  end if;
  update identity.step_up_challenges
     set state = 'expired', version = version + 1, updated_at = created
   where session_id = p_session_id and factor_id = factor.id and state = 'pending';
  insert into identity.step_up_challenges(
    auth_user_id, session_id, factor_id, provider_challenge_id, state, expires_at,
    created_at, updated_at
  ) values (
    p_auth_user_id, p_session_id, factor.id, p_provider_challenge_id, 'pending',
    window_end, created, created
  ) returning * into challenge;
  perform platform_private.mfa_security_event(
    'step_up.challenge.created', p_auth_user_id, p_session_id, 'completed',
    'STEP_UP_CHALLENGE_CREATED', p_request_id, p_correlation_id);
  return pg_catalog.jsonb_build_object(
    'challengeId', challenge.id,
    'expiresAt', platform_private.auth_iso_time(challenge.expires_at)
  );
end;
$body$;

-- The challenge of this Auth UUID AND this exact session, locked.  Another
-- user's or another session's challenge is indistinguishable from an absent
-- one (NOT_FOUND); a non-pending or lapsed challenge is refused.
create function platform_private.step_up_usable_challenge(
  p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_lock boolean default true
)
returns identity.step_up_challenges
language plpgsql
security definer
set search_path = ''
as $body$
declare
  challenge identity.step_up_challenges%rowtype;
begin
  if p_lock then
    select * into challenge from identity.step_up_challenges
     where id = p_challenge_id and auth_user_id = p_auth_user_id and session_id = p_session_id
     for update;
  else
    select * into challenge from identity.step_up_challenges
     where id = p_challenge_id and auth_user_id = p_auth_user_id and session_id = p_session_id;
  end if;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if challenge.state = 'expired' then
    raise exception 'CHALLENGE_EXPIRED' using errcode = 'P0001';
  end if;
  if challenge.state <> 'pending' then
    raise exception 'CHALLENGE_CONSUMED' using errcode = 'P0001';
  end if;
  if challenge.expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'CHALLENGE_EXPIRED' using errcode = 'P0001';
  end if;
  return challenge;
end;
$body$;

create function platform_api.auth_step_up_challenge_verify_prepare(
  p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  challenge identity.step_up_challenges%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  if p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id, false);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  challenge := platform_private.step_up_usable_challenge(
    p_auth_user_id, p_session_id, p_challenge_id, false);
  select * into factor from identity.mfa_factor_registry where id = challenge.factor_id;
  if factor.state <> 'verified' then
    raise exception 'FACTOR_NOT_VERIFIED' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'factorId', factor.id,
    'providerFactorId', factor.provider_factor_id,
    'providerChallengeId', challenge.provider_challenge_id,
    'expiresAt', platform_private.auth_iso_time(challenge.expires_at)
  );
end;
$body$;

-- `incorrect` (a well-formed wrong code) keeps the challenge pending and
-- increments failed_attempt_count; `ambiguous` (invalid 2xx or post-send
-- timeout) fails it, so the user starts a new challenge.
create function platform_api.auth_step_up_challenge_failure_record(
  p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_outcome text,
  p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  challenge identity.step_up_challenges%rowtype;
begin
  if p_outcome is null or p_outcome not in ('incorrect', 'ambiguous') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  challenge := platform_private.step_up_usable_challenge(p_auth_user_id, p_session_id, p_challenge_id);
  if p_outcome = 'incorrect' then
    update identity.step_up_challenges
       set failed_attempt_count = least(failed_attempt_count + 1, 32767)::smallint,
           version = version + 1, updated_at = pg_catalog.clock_timestamp()
     where id = challenge.id;
    perform platform_private.mfa_security_event(
      'step_up.failed', p_auth_user_id, p_session_id, 'denied', 'CODE_INCORRECT',
      p_request_id, p_correlation_id);
  else
    update identity.step_up_challenges
       set state = 'failed', failed_at = pg_catalog.clock_timestamp(),
           version = version + 1, updated_at = pg_catalog.clock_timestamp()
     where id = challenge.id;
    perform platform_private.mfa_security_event(
      'step_up.failed', p_auth_user_id, p_session_id, 'failed', 'PROVIDER_AMBIGUOUS',
      p_request_id, p_correlation_id);
  end if;
  return pg_catalog.jsonb_build_object('recorded', true);
end;
$body$;

-- Settlement: pending -> consumed, the factor's last_used_at (no MFA version
-- bump, so a step-up in another tab never invalidates an enrollment or removal
-- in progress), audit and security evidence and the first-party session
-- rotation commit in one transaction.
create function platform_api.auth_step_up_challenge_verify_settle(
  p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_new_session_id uuid,
  p_issued_at timestamptz, p_request_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  challenge identity.step_up_challenges%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  perform platform_private.mfa_require_session(p_auth_user_id, p_session_id);
  challenge := platform_private.step_up_usable_challenge(p_auth_user_id, p_session_id, p_challenge_id);
  select * into factor from identity.mfa_factor_registry
   where id = challenge.factor_id for update;
  if factor.state <> 'verified' then
    raise exception 'FACTOR_NOT_VERIFIED' using errcode = 'P0001';
  end if;
  update identity.step_up_challenges
     set state = 'consumed', consumed_at = pg_catalog.clock_timestamp(),
         version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where id = challenge.id;
  update identity.mfa_factor_registry
     set last_used_at = pg_catalog.clock_timestamp(), version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where id = factor.id;
  perform platform_private.mfa_rotate_session(
    p_auth_user_id, p_session_id, p_new_session_id, p_issued_at, binding.id,
    p_request_id, p_correlation_id);
  perform platform_private.mfa_audit(
    'identity.step_up.verified', p_auth_user_id, binding.person_id, 'step_up_challenge',
    challenge.id, 'STEP_UP_VERIFIED', p_correlation_id);
  perform platform_private.mfa_security_event(
    'step_up.verified', p_auth_user_id, p_session_id, 'completed', 'STEP_UP_VERIFIED',
    p_request_id, p_correlation_id);
  return pg_catalog.jsonb_build_object('verified', true);
end;
$body$;

revoke all on function
  platform_private.step_up_usable_challenge(uuid, uuid, uuid, boolean),
  platform_api.auth_step_up_challenge_begin(uuid, uuid, text, uuid, uuid, uuid),
  platform_api.auth_step_up_challenge_finish(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid),
  platform_api.auth_step_up_challenge_verify_prepare(uuid, uuid, uuid, uuid, uuid),
  platform_api.auth_step_up_challenge_failure_record(uuid, uuid, uuid, text, uuid, uuid),
  platform_api.auth_step_up_challenge_verify_settle(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
  platform_api.auth_step_up_challenge_begin(uuid, uuid, text, uuid, uuid, uuid),
  platform_api.auth_step_up_challenge_finish(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid),
  platform_api.auth_step_up_challenge_verify_prepare(uuid, uuid, uuid, uuid, uuid),
  platform_api.auth_step_up_challenge_failure_record(uuid, uuid, uuid, text, uuid, uuid),
  platform_api.auth_step_up_challenge_verify_settle(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid)
to service_role;

commit;
