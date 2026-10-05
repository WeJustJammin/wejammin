-- Slice 09 audit remediation (R3, AC-904): the MFA factor state machine of
-- BE01a allows  reconciling -> verified | pending | removed  only.  The guard
-- and auth_mfa_factor_reconcile allowed reconciling -> expired (a provider
-- "unverified" outcome after the pending window had elapsed or been superseded
-- settled straight to expired).  Expiry of a pending row is written only by
-- the MFA registry sweep and AUTH-API-17 transaction A.  Forward-only.
begin;

create or replace function platform_private.mfa_factor_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    if coalesce(pg_catalog.current_setting('app.mfa_registry_purge', true), '') <> 'on'
       or old.state not in ('removed', 'expired') then
      raise exception 'MFA_REGISTRY_RETENTION_ONLY' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if new.id is distinct from old.id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.method is distinct from old.method
     or new.provider_factor_id is distinct from old.provider_factor_id
     or new.friendly_name is distinct from old.friendly_name
     or new.created_at is distinct from old.created_at then
    raise exception 'MFA_FACTOR_IMMUTABLE' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'MFA_FACTOR_VERSION' using errcode = 'P0001';
  end if;
  if old.state in ('removed', 'expired') then
    raise exception 'MFA_FACTOR_TERMINAL' using errcode = 'P0001';
  end if;
  if new.state <> old.state and not (
       (old.state = 'pending' and new.state in ('verified', 'expired', 'reconciling'))
    or (old.state = 'verified' and new.state = 'reconciling')
    or (old.state = 'reconciling' and new.state in ('verified', 'pending', 'removed'))
  ) then
    raise exception 'MFA_FACTOR_TRANSITION' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create or replace function platform_api.auth_mfa_factor_reconcile(
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
