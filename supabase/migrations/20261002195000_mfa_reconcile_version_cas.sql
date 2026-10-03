-- Slice 09 review fix (AC-913): the MFA reconciler read a reconciling factor and
-- its version, polled the identity provider, and settled with only
-- (user, factor, outcome).  A slow poll could therefore settle a NEWER
-- reconciliation (the factor settled, then re-entered reconciling) with a stale
-- provider outcome and emit wrong security evidence.
--
-- auth_mfa_factor_reconcile now takes the factor `version` the reconciler
-- observed (p_expected_version) and compares it under the binding lock and the
-- factor row lock, atomically with the settlement.  A mismatch is a stale
-- delivery: the function returns {"stale": true} and applies nothing (no state
-- or version change, no mfa_version bump, no security event, no outbox row).
-- An absent or non-positive observed version is INVALID_REQUEST.  The success
-- path still returns { state }.  The old five-argument signature is dropped so
-- no caller can settle without the CAS.  Forward-only.
begin;

drop function platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, uuid, uuid);

create function platform_api.auth_mfa_factor_reconcile(
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

revoke all on function platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, bigint, uuid, uuid)
  from public, anon, authenticated;
grant execute on function platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, bigint, uuid, uuid)
  to service_role;

commit;
