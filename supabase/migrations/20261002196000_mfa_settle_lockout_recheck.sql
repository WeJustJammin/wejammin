-- Slice 09 review fix (AC-778, AC-865): the shared MFA verification lockout
-- (20261002176000) was checked only by the two verify-prepare RPCs, before the
-- Worker contacts the identity provider.  A request that prepared while the
-- account was unlocked could therefore still settle after concurrent failures
-- had persisted the 15-minute lock: the enrollment settle verified a factor and
-- rotated the session, and the step-up settle consumed a challenge and rotated
-- the session, both during the lockout.
--
-- Both settle RPCs now re-check the persisted lockout immediately after they
-- acquire the account binding row lock.  The failure charge runs under that same
-- lock, so a settle either runs entirely before the lock-setting failure or sees
-- the committed lock and is refused with MFA_VERIFICATION_LOCKED:<seconds> having
-- written nothing.  The bodies are otherwise unchanged and the settle signatures,
-- grants and return shapes stay as they were.  Forward-only.
begin;

create or replace function platform_api.auth_mfa_enrollment_verify_settle(
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
  perform platform_private.mfa_verification_require_unlocked(p_auth_user_id);
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

create or replace function platform_api.auth_step_up_challenge_verify_settle(
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
  perform platform_private.mfa_verification_require_unlocked(p_auth_user_id);
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

commit;
