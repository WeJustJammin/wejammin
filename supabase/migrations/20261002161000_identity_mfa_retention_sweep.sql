-- DEC-111 / BE01a "Index, RLS, and retention inventory": the retention sweep.
-- Stale pending enrollments (pending_expires_at elapsed) and stale pending
-- step-up challenges (expires_at elapsed) are expired; `removed`/`expired`
-- factor rows and non-pending challenges are purged 30 days after their last
-- change (an old factor is kept while any challenge still references it).
-- Pending, verified and reconciling rows are never purged.  Each expired factor
-- bumps that account's MFA version, writes security evidence and emits the
-- factor-changed event so the reconciler can clean the unverified provider
-- factor.  Service-role only; `p_batch` bounds the rows each step touches.
-- Forward-only.
begin;

create function platform_api.auth_mfa_registry_sweep(p_batch integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  expired_factors integer := 0;
  expired_challenges integer;
  purged_challenges integer;
  purged_factors integer;
  sweep_correlation uuid := extensions.gen_random_uuid();
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- 1. Stale pending enrollments.  The binding is locked before the factor,
  --    the same order every enrollment RPC uses.
  for candidate in
    select stale.id, stale.auth_user_id
      from identity.mfa_factor_registry stale
     where stale.state = 'pending'
       and stale.pending_expires_at <= pg_catalog.clock_timestamp()
     order by stale.pending_expires_at, stale.id
     limit p_batch
  loop
    select * into binding from identity.auth_user_bindings
     where auth_user_id = candidate.auth_user_id for update;
    select * into factor from identity.mfa_factor_registry
     where id = candidate.id and state = 'pending'
       and pending_expires_at <= pg_catalog.clock_timestamp()
     for update;
    if found and binding.id is not null then
      update identity.mfa_factor_registry
         set state = 'expired', pending_expires_at = null, version = version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = factor.id
       returning * into factor;
      perform platform_private.mfa_bump(binding.id);
      perform platform_private.mfa_security_event(
        'mfa.enroll.expired', factor.auth_user_id, null, 'completed', 'ENROLLMENT_EXPIRED',
        sweep_correlation, sweep_correlation);
      perform platform_private.mfa_factor_changed_event(
        factor.id, factor.version, binding.id, sweep_correlation);
      expired_factors := expired_factors + 1;
    end if;
  end loop;
  -- 2. Stale pending challenges.
  update identity.step_up_challenges challenge
     set state = 'expired', version = challenge.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where challenge.id in (
     select stale.id from identity.step_up_challenges stale
      where stale.state = 'pending' and stale.expires_at <= pg_catalog.clock_timestamp()
      order by stale.expires_at, stale.id
      limit p_batch
      for update skip locked);
  get diagnostics expired_challenges = row_count;
  -- 3. Purge: only the sweep may delete registry rows.
  perform pg_catalog.set_config('app.mfa_registry_purge', 'on', true);
  delete from identity.step_up_challenges challenge
   where challenge.id in (
     select old_challenge.id from identity.step_up_challenges old_challenge
      where old_challenge.state <> 'pending'
        and old_challenge.updated_at < pg_catalog.clock_timestamp() - interval '30 days'
      order by old_challenge.updated_at, old_challenge.id
      limit p_batch
      for update skip locked);
  get diagnostics purged_challenges = row_count;
  delete from identity.mfa_factor_registry old_factor
   where old_factor.id in (
     select eligible.id from identity.mfa_factor_registry eligible
      where eligible.state in ('removed', 'expired')
        and eligible.updated_at < pg_catalog.clock_timestamp() - interval '30 days'
        and not exists (
          select 1 from identity.step_up_challenges referencing
           where referencing.factor_id = eligible.id)
      order by eligible.updated_at, eligible.id
      limit p_batch
      for update skip locked);
  get diagnostics purged_factors = row_count;
  perform pg_catalog.set_config('app.mfa_registry_purge', '', true);
  return pg_catalog.jsonb_build_object(
    'expiredFactors', expired_factors,
    'expiredChallenges', expired_challenges,
    'purgedChallenges', purged_challenges,
    'purgedFactors', purged_factors
  );
end;
$body$;

revoke all on function platform_api.auth_mfa_registry_sweep(integer)
  from public, anon, authenticated;
grant execute on function platform_api.auth_mfa_registry_sweep(integer) to service_role;

commit;
