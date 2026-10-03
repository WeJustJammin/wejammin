-- Slice 09 R8 (r8-auth NEEDS-DB, P2-S09-AC-933): CFG-05B-06 settlement leaves a
-- factor whose provider removal failed `reconciling` "for auth-state-reconciler",
-- but only the reservation transaction emitted identity.mfa-factor.changed.v1 for
-- it, before the provider call.  If the reconciler had already consumed that
-- event, nothing woke it again and the factor sat reconciling with no consumer.
-- admin_mfa_factor_reset_settle now emits one change event, with exactly the
-- {mfaFactorId, authBindingId} payload, for each factor a `failed` outcome leaves
-- reconciling.  Everything else (validation, removal confirmation, the single
-- mfa_version bump, audit, completion, idempotent replay) is unchanged, and so
-- are the signature, grants and return shape.  Forward-only.
begin;

create or replace function platform_api.admin_mfa_factor_reset_settle(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor record;
  operator_person uuid;
  reset_row platform_private.admin_mfa_factor_resets%rowtype;
  target_binding identity.auth_user_bindings%rowtype;
  outcome jsonb;
  provider_id uuid;
  outcome_name text;
  seen uuid[] := array[]::uuid[];
  factor identity.mfa_factor_registry%rowtype;
  confirmed integer := 0;
  removed_total integer;
  correlation uuid;
begin
  perform platform_private.cfg_require_keys(
    p_request,
    array['resetId', 'outcomes', 'context']::text[],
    array['resetId', 'outcomes', 'context']::text[]);
  select * into actor from platform_private.cfg_request_actor(p_request, true);
  if not platform_private.cfg_valid_uuid(p_request->>'resetId')
     or pg_catalog.jsonb_typeof(p_request->'outcomes') <> 'array'
     or pg_catalog.jsonb_array_length(p_request->'outcomes') > 10 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into reset_row from platform_private.admin_mfa_factor_resets
   where id = (p_request->>'resetId')::uuid for update;
  if not found then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  operator_person := platform_private.identity_actor_person(actor.actor_id);
  if reset_row.operator_person_id <> operator_person
     or reset_row.organization_id <> actor.acting_party_id then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  correlation := platform_private.cfg_correlation(p_request);
  select * into target_binding from identity.auth_user_bindings
   where person_id = reset_row.target_person_id for update;
  for outcome in select * from pg_catalog.jsonb_array_elements(p_request->'outcomes') loop
    if pg_catalog.jsonb_typeof(outcome) <> 'object'
       or not platform_private.cfg_valid_uuid(outcome->>'providerFactorId')
       or outcome->>'outcome' is null
       or outcome->>'outcome' not in ('removed', 'absent', 'failed') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    provider_id := (outcome->>'providerFactorId')::uuid;
    outcome_name := outcome->>'outcome';
    if provider_id = any (seen) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    seen := seen || provider_id;
    select * into factor from identity.mfa_factor_registry candidate
     where candidate.provider_factor_id = provider_id
       and candidate.auth_user_id = target_binding.auth_user_id
       and candidate.id = any (reset_row.moved_factor_ids)
     for update;
    if not found then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if outcome_name in ('removed', 'absent') and factor.state = 'reconciling' then
      update identity.mfa_factor_registry
         set state = 'removed', pending_expires_at = null,
             removed_at = pg_catalog.clock_timestamp(), version = version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = factor.id
       returning * into factor;
      confirmed := confirmed + 1;
      perform platform_private.mfa_factor_changed_event(
        factor.id, factor.version, target_binding.id, correlation);
    elsif outcome_name = 'failed' and factor.state = 'reconciling' then
      -- The provider could not confirm this removal and the row deliberately
      -- stays reconciling.  The change event of the reservation transaction may
      -- already have been consumed before the provider call failed, so settlement
      -- emits a fresh one: the reconciler is woken by exactly this event, and its
      -- version compare-and-set makes redelivery harmless.
      perform platform_private.mfa_factor_changed_event(
        factor.id, factor.version, target_binding.id, correlation);
    end if;
  end loop;
  if confirmed > 0 then
    perform platform_private.mfa_bump(target_binding.id);
    perform platform_private.mfa_audit(
      'identity.mfa.factors.reset.settled', actor.actor_id, reset_row.organization_id,
      'person', reset_row.target_person_id, 'MFA_FACTORS_RESET_SETTLED', correlation);
  end if;
  select count(*)::integer into removed_total from identity.mfa_factor_registry candidate
   where candidate.id = any (reset_row.moved_factor_ids) and candidate.state = 'removed';
  update platform_private.admin_mfa_factor_resets
     set removed_factor_count = removed_total,
         state = case when removed_total = pg_catalog.cardinality(moved_factor_ids)
                      then 'completed' else 'reconciling' end,
         completed_at = case when removed_total = pg_catalog.cardinality(moved_factor_ids)
                             then pg_catalog.clock_timestamp() end,
         version_no = version_no + 1
   where id = reset_row.id
     and (removed_factor_count <> removed_total or confirmed > 0);
  return platform_private.admin_mfa_factor_reset_view(reset_row.id);
end;
$body$;

commit;
