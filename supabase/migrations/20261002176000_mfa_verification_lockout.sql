-- DEC-111 / BE01a "Observability and Abuse Controls": enrollment and step-up
-- verification failures share ONE account-scoped budget that locks the account's
-- verification for 15 minutes (AUTH-API-18 and AUTH-API-21 are one key: the
-- budget carries no operation id).  Ten failures inside any sliding 15 minutes
-- persist `locked_until = now + 15 minutes` and clear the in-window list.
--
--   * identity.mfa_verification_lockouts: one row per account (forced RLS, no
--     grant); `failure_times` holds at most nine in-window failure instants.
--   * platform_private.mfa_verification_charge_failure charges one failure.  It
--     runs inside the callers' transaction under the account binding row lock
--     (FOR UPDATE), so concurrent failures are counted exactly once each and a
--     failure recorded while locked is neither counted nor extends the lock.
--   * platform_private.mfa_verification_require_unlocked refuses with
--     MFA_VERIFICATION_LOCKED:<seconds remaining>; both verify-prepare RPCs call
--     it first, so a locked account is refused before the Worker can contact the
--     provider.
--   * platform_api.auth_mfa_verification_failure_record charges an enrollment
--     verification failure (incorrect | ambiguous); the step-up failure_record
--     RPC charges the same budget in the same transaction as its per-challenge
--     bookkeeping (response unchanged).
-- A successful verification does not reset the budget.  Forward-only.
begin;

create table identity.mfa_verification_lockouts (
  auth_user_id uuid primary key
    references identity.auth_user_bindings (auth_user_id) on delete cascade,
  failure_times timestamptz[] not null default '{}'
    check (pg_catalog.cardinality(failure_times) <= 9),
  locked_until timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table identity.mfa_verification_lockouts enable row level security;
alter table identity.mfa_verification_lockouts force row level security;
revoke all on table identity.mfa_verification_lockouts
  from public, anon, authenticated, service_role;

create function platform_private.mfa_verification_require_unlocked(p_auth_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  remaining integer;
begin
  select pg_catalog.ceil(extract(epoch from (lockout.locked_until - pg_catalog.clock_timestamp())))::integer
    into remaining
    from identity.mfa_verification_lockouts lockout
   where lockout.auth_user_id = p_auth_user_id
     and lockout.locked_until > pg_catalog.clock_timestamp();
  if found then
    raise exception 'MFA_VERIFICATION_LOCKED:%', remaining using errcode = 'P0001';
  end if;
end;
$body$;

create function platform_private.mfa_verification_charge_failure(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  now_at timestamptz := pg_catalog.clock_timestamp();
  state identity.mfa_verification_lockouts%rowtype;
  kept timestamptz[];
begin
  -- The caller holds the account binding row lock (mfa_lock_binding, FOR UPDATE).
  insert into identity.mfa_verification_lockouts (auth_user_id)
  values (p_auth_user_id)
  on conflict (auth_user_id) do nothing;
  select * into state from identity.mfa_verification_lockouts
   where auth_user_id = p_auth_user_id for update;
  if state.locked_until is not null and state.locked_until > now_at then
    return pg_catalog.jsonb_build_object(
      'recorded', true, 'locked', true,
      'retryAfterSeconds', pg_catalog.ceil(extract(epoch from (state.locked_until - now_at)))::integer);
  end if;
  kept := array(
    select failure.at
      from pg_catalog.unnest(state.failure_times) as failure(at)
     where failure.at > now_at - interval '15 minutes'
     order by failure.at);
  kept := kept || now_at;
  if pg_catalog.cardinality(kept) >= 10 then
    update identity.mfa_verification_lockouts
       set failure_times = '{}', locked_until = now_at + interval '15 minutes',
           version = version + 1, updated_at = now_at
     where auth_user_id = p_auth_user_id;
    return pg_catalog.jsonb_build_object('recorded', true, 'locked', true, 'retryAfterSeconds', 900);
  end if;
  update identity.mfa_verification_lockouts
     set failure_times = kept, locked_until = null,
         version = version + 1, updated_at = now_at
   where auth_user_id = p_auth_user_id;
  return pg_catalog.jsonb_build_object('recorded', true, 'locked', false, 'retryAfterSeconds', 0);
end;
$body$;

create function platform_api.auth_mfa_verification_failure_record(
  p_auth_user_id uuid,
  p_outcome text,
  p_request_id uuid,
  p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_request_id is null or p_correlation_id is null
     or p_outcome is null or p_outcome not in ('incorrect', 'ambiguous') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id);
  return platform_private.mfa_verification_charge_failure(p_auth_user_id);
end;
$body$;

revoke all on function
  platform_private.mfa_verification_require_unlocked(uuid),
  platform_private.mfa_verification_charge_failure(uuid),
  platform_api.auth_mfa_verification_failure_record(uuid, text, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function
  platform_api.auth_mfa_verification_failure_record(uuid, text, uuid, uuid)
to service_role;

CREATE OR REPLACE FUNCTION platform_api.auth_mfa_enrollment_verify_prepare(p_auth_user_id uuid, p_factor_id uuid, p_expected_version text, p_request_id uuid, p_correlation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  if p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id, false);
  perform platform_private.mfa_verification_require_unlocked(p_auth_user_id);
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

CREATE OR REPLACE FUNCTION platform_api.auth_step_up_challenge_verify_prepare(p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_request_id uuid, p_correlation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $body$
declare
  challenge identity.step_up_challenges%rowtype;
  factor identity.mfa_factor_registry%rowtype;
begin
  if p_request_id is null or p_correlation_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.mfa_lock_binding(p_auth_user_id, false);
  perform platform_private.mfa_verification_require_unlocked(p_auth_user_id);
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

CREATE OR REPLACE FUNCTION platform_api.auth_step_up_challenge_failure_record(p_auth_user_id uuid, p_session_id uuid, p_challenge_id uuid, p_outcome text, p_request_id uuid, p_correlation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $body$
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
  perform platform_private.mfa_verification_charge_failure(p_auth_user_id);
  return pg_catalog.jsonb_build_object('recorded', true);
end;
$body$;

commit;
