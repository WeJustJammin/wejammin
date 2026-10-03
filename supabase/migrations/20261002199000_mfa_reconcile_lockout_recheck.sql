-- Slice 09 R8 (Codex f3c0736e, high; r8-auth NEEDS-DB): the MFA verification
-- lockout (20261002176000) is checked by both verify-prepare RPCs and, since
-- 20261002196000, by both settle RPCs, but the auth-state-reconciler settlement
-- never consulted it.  A provider-ambiguous factor marked reconciling (including
-- the one a lock-refused settle used to leave behind) could therefore be settled
-- `verified` by the reconciler while the account's 15-minute verification lock
-- was active, bypassing AUTH-API-18 / AUTH-API-21 entirely.
--
-- auth_mfa_factor_reconcile now re-checks the persisted lockout under the
-- account binding lock for the `verified` and `pending` outcomes (the two that
-- leave a factor verifiable) and refuses with MFA_VERIFICATION_LOCKED:<seconds>
-- having written nothing, so the row stays reconciling and the reconciler
-- retries after the lock.  `removed` never verifies anything and is unchanged.
-- auth_mfa_factor_mark_reconciling verifies nothing and is unchanged.  The
-- signature, grants, stale-version CAS and return shapes are unchanged.
-- Forward-only.
begin;

create or replace function platform_api.auth_mfa_factor_reconcile(
  p_auth_user_id uuid, p_factor_id uuid, p_outcome text, p_expected_version bigint,
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
  if p_outcome is null or p_outcome not in ('verified', 'pending', 'removed')
     or p_expected_version is null or p_expected_version < 1 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  binding := platform_private.mfa_lock_binding(p_auth_user_id);
  -- The shared verification lockout is re-checked under the binding lock (the
  -- lock-setting failure charge runs under the same lock) before any outcome
  -- that makes the factor verifiable.  `removed` verifies nothing and settles
  -- even while the account is locked.  The refusal precedes the version
  -- compare-and-set, so a locked account reveals nothing about the factor.
  if p_outcome in ('verified', 'pending') then
    perform platform_private.mfa_verification_require_unlocked(p_auth_user_id);
  end if;
  select * into factor from identity.mfa_factor_registry
   where id = p_factor_id and auth_user_id = p_auth_user_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Compare-and-set on the version the reconciler observed: a different
  -- version means this delivery polled an older reconciliation.
  if factor.version <> p_expected_version then
    return pg_catalog.jsonb_build_object('stale', true);
  end if;
  if factor.state <> 'reconciling' then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  -- BE01a: reconciling -> verified | pending | removed only.  A provider-
  -- unverified factor returns to pending (its window may already have
  -- elapsed; the registry sweep, never this reconciler, then writes
  -- pending -> expired).  Exactly one pending row per user exists, so a
  -- reconciling row superseded by a newer pending enrollment settles to
  -- removed instead.  A factor that was ever verified cannot become pending.
  if p_outcome = 'pending' and factor.verified_at is not null then
    raise exception 'FACTOR_STATE_CONFLICT' using errcode = 'P0001';
  end if;
  next_state := case p_outcome
    when 'verified' then 'verified'::identity.mfa_factor_state
    when 'removed' then 'removed'::identity.mfa_factor_state
    when 'pending' then case
      when exists (
             select 1 from identity.mfa_factor_registry other
              where other.auth_user_id = p_auth_user_id and other.state = 'pending'
                and other.id <> factor.id)
        then 'removed'::identity.mfa_factor_state
      else 'pending'::identity.mfa_factor_state end
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

commit;
