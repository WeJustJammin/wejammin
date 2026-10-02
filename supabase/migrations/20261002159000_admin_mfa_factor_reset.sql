-- DEC-111 follow-up / BE05b CFG-05B-06 and BE01a "Administrative factor reset":
-- the lost-factor recovery.  An operator holding an effective
-- admin.identity.mfa_reset grant (action reset, resource type organization)
-- resets another confirmed member's factors.  Reservation: one transaction
-- locks the reset, the grant and the target, inserts the reset row
-- `reconciling`, and calls identity.rpc_admin_reset_mfa_factors, which moves
-- every live factor to `reconciling`, expires the target's pending step-up
-- challenges and bumps mfa_version.  The Worker then unenrolls each provider
-- factor through the operator-only adapter; settlement records each outcome.
-- The committed reservation is never rolled back on provider failure.  Not
-- subject to last_factor_required; never self; changes no session or login
-- method.  Forward-only.
begin;

create table platform_private.admin_mfa_factor_resets (
  id uuid primary key default extensions.gen_random_uuid(),
  target_person_id uuid not null references platform_private.person_party(party_id),
  organization_id uuid not null references platform_private.party(id),
  operator_person_id uuid not null references platform_private.person_party(party_id),
  grant_id uuid not null references platform_private.admin_capability_grants(id),
  reason text not null check (pg_catalog.char_length(reason) between 1 and 512),
  idempotency_key text not null check (pg_catalog.char_length(idempotency_key) between 8 and 256),
  state text not null check (state in ('reconciling', 'completed')),
  removed_factor_count integer not null default 0 check (removed_factor_count between 0 and 10),
  moved_factor_ids uuid[] not null default '{}' check (pg_catalog.cardinality(moved_factor_ids) <= 10),
  outbox_event_id uuid not null,
  version_no bigint not null default 1 check (version_no > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  check (operator_person_id <> target_person_id),
  check ((completed_at is null) = (state = 'reconciling')),
  unique (operator_person_id, idempotency_key)
);

create unique index admin_mfa_factor_resets_one_live_per_target
  on platform_private.admin_mfa_factor_resets (target_person_id) where state = 'reconciling';
create index admin_mfa_factor_resets_target_created
  on platform_private.admin_mfa_factor_resets (target_person_id, created_at desc);

alter table platform_private.admin_mfa_factor_resets enable row level security;
alter table platform_private.admin_mfa_factor_resets force row level security;
revoke all on table platform_private.admin_mfa_factor_resets
  from public, anon, authenticated, service_role;

-- Only state, the settled count and the version move (and the moved-factor set,
-- once, when the identity RPC reports it); the record is append-only.
create function platform_private.admin_mfa_factor_reset_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'ADMIN_MFA_RESET_APPEND_ONLY' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.target_person_id is distinct from old.target_person_id
     or new.organization_id is distinct from old.organization_id
     or new.operator_person_id is distinct from old.operator_person_id
     or new.grant_id is distinct from old.grant_id
     or new.reason is distinct from old.reason
     or new.idempotency_key is distinct from old.idempotency_key
     or (new.moved_factor_ids is distinct from old.moved_factor_ids
         and pg_catalog.cardinality(old.moved_factor_ids) > 0)
     or new.outbox_event_id is distinct from old.outbox_event_id
     or new.created_at is distinct from old.created_at
     or old.state = 'completed' then
    raise exception 'ADMIN_MFA_RESET_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger admin_mfa_factor_resets_guard
  before update or delete on platform_private.admin_mfa_factor_resets
  for each row execute function platform_private.admin_mfa_factor_reset_guard();

-- The BE01a identity state change.  Executable only through the admin wrapper
-- below (no role is granted it).  Moves every pending, verified and reconciling
-- factor of the target to `reconciling` (already-reconciling rows are included
-- in the set the Worker must settle), expires the target's pending step-up
-- challenges, bumps mfa_version once when any row changed, and records the
-- target's security evidence and notification request.
create function identity.rpc_admin_reset_mfa_factors(
  p_reset_id uuid, p_target_person_id uuid, p_operator_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
  factor identity.mfa_factor_registry%rowtype;
  moved uuid[] := array[]::uuid[];
  provider_ids uuid[] := array[]::uuid[];
  changed integer := 0;
  new_version bigint;
  event_id uuid;
  correlation uuid;
begin
  if p_reset_id is null or p_target_person_id is null or p_operator_person_id is null
     or p_target_person_id = p_operator_person_id then
    raise exception 'MFA_RESET_INVALID' using errcode = 'P0001';
  end if;
  -- The wrapper passes its correlation id through a transaction-local setting so
  -- the audit, security evidence and outbox rows of one reset share it.
  correlation := coalesce(
    nullif(pg_catalog.current_setting('app.mfa_reset_correlation', true), '')::uuid,
    extensions.gen_random_uuid());
  select * into binding from identity.auth_user_bindings
   where person_id = p_target_person_id for update;
  if not found or binding.state not in ('claimed', 'active') then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  for factor in
    select * from identity.mfa_factor_registry
     where auth_user_id = binding.auth_user_id
       and state in ('pending', 'verified', 'reconciling')
     order by created_at, id
     for update
  loop
    moved := moved || factor.id;
    provider_ids := provider_ids || factor.provider_factor_id;
    if factor.state <> 'reconciling' then
      update identity.mfa_factor_registry
         set state = 'reconciling', version = version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = factor.id
       returning * into factor;
      changed := changed + 1;
      perform platform_private.mfa_factor_changed_event(
        factor.id, factor.version, binding.id, correlation);
    end if;
  end loop;
  update identity.step_up_challenges
     set state = 'expired', version = version + 1, updated_at = pg_catalog.clock_timestamp()
   where auth_user_id = binding.auth_user_id and state = 'pending';
  new_version := binding.mfa_version;
  if changed > 0 then
    new_version := platform_private.mfa_bump(binding.id);
  end if;
  event_id := platform_private.mfa_security_event(
    'mfa.factors.reset', binding.auth_user_id, null, 'completed', 'MFA_FACTORS_RESET',
    p_reset_id, correlation);
  perform platform_private.mfa_notification_request(event_id, binding.id, correlation);
  return pg_catalog.jsonb_build_object(
    'targetAuthUserId', binding.auth_user_id,
    'movedFactorIds', pg_catalog.to_jsonb(moved),
    'providerFactorIds', pg_catalog.to_jsonb(provider_ids),
    'mfaVersion', new_version::text
  );
end;
$body$;

-- The public projection of one reset row (replay and settlement responses).
create function platform_private.admin_mfa_factor_reset_view(p_reset_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'resetId', reset.id,
    'targetPersonId', reset.target_person_id,
    'state', reset.state,
    'removedFactorCount', reset.removed_factor_count,
    'mfaVersion', (
      select binding.mfa_version::text from identity.auth_user_bindings binding
       where binding.person_id = reset.target_person_id),
    'outboxEventId', reset.outbox_event_id
  )
  from platform_private.admin_mfa_factor_resets reset
  where reset.id = p_reset_id
$body$;

create function platform_api.admin_mfa_factor_reset(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor record;
  operator_person uuid;
  organization uuid;
  target_person uuid;
  reason_text text;
  key_text text;
  reservation platform_private.idempotency_records;
  grant_row platform_private.admin_capability_grants%rowtype;
  existing platform_private.admin_mfa_factor_resets%rowtype;
  reset_id uuid := extensions.gen_random_uuid();
  outbox_id uuid := extensions.gen_random_uuid();
  correlation uuid;
  effect jsonb;
  moved_ids uuid[];
  provider_ids jsonb;
  reset_state text;
  response jsonb;
begin
  perform platform_private.cfg_require_keys(
    p_request,
    array['targetPersonId', 'reason', 'idempotencyKey', 'context']::text[],
    array['targetPersonId', 'reason', 'idempotencyKey', 'context']::text[]);
  select * into actor from platform_private.cfg_request_actor(p_request, true);
  reason_text := pg_catalog.btrim(p_request->>'reason');
  key_text := p_request->>'idempotencyKey';
  if not platform_private.cfg_valid_uuid(p_request->>'targetPersonId')
     or reason_text is null
     or pg_catalog.char_length(reason_text) not between 1 and 512
     or key_text is null
     or pg_catalog.char_length(key_text) not between 8 and 256
     or key_text ~ '[[:cntrl:]]' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  target_person := (p_request->>'targetPersonId')::uuid;
  perform platform_private.cfg_require_fresh_step_up(p_request);
  organization := actor.acting_party_id;
  operator_person := platform_private.identity_actor_person(actor.actor_id);
  correlation := platform_private.cfg_correlation(p_request);
  begin
    reservation := platform_private.identity_idempotency_reserve(
      actor.actor_id, 'admin.mfa_factor_reset:' || organization::text,
      platform_private.cfg_hash_text(key_text),
      platform_private.cfg_hash_text(
        pg_catalog.jsonb_build_object('targetPersonId', target_person, 'reason', reason_text)::text));
  exception when others then
    if sqlerrm = 'IDEMPOTENCY_MISMATCH' then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    raise;
  end;
  select * into grant_row from platform_private.admin_capability_grants candidate
   where candidate.subject_person_id = operator_person
     and candidate.capability_key = 'admin.identity.mfa_reset'
     and candidate.resource_type = 'organization'
     and candidate.resource_id = organization
     and candidate.state = 'active'
     and candidate.starts_at <= pg_catalog.clock_timestamp()
     and candidate.ends_at > pg_catalog.clock_timestamp()
     and 'reset' = any (candidate.actions)
     and platform_private.admin_scope_valid(candidate.scope, organization)
   order by candidate.created_at desc, candidate.id
   limit 1
   for share;
  if not found then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if reservation.state = 'completed'::platform_private.idempotency_state then
    select * into existing from platform_private.admin_mfa_factor_resets
     where operator_person_id = operator_person and idempotency_key = key_text;
    if not found then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    return platform_private.admin_mfa_factor_reset_view(existing.id) || pg_catalog.jsonb_build_object(
      'pendingProviderFactorIds', '[]'::jsonb);
  end if;
  if target_person = operator_person then
    raise exception 'MFA_RESET_INVALID' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
      from identity_private.membership_tenure tenure
      join platform_private.person_party person on person.party_id = tenure.person_id
      join auth.users auth_user on auth_user.id = person.auth_user_id
     where tenure.organization_id = organization
       and tenure.person_id = target_person
       and tenure.state = 'confirmed'
       and tenure.starts_on <= (pg_catalog.clock_timestamp() at time zone 'UTC')::date
       and (tenure.ends_on is null
            or tenure.ends_on >= (pg_catalog.clock_timestamp() at time zone 'UTC')::date)
       and person.account_state in ('claimed', 'active')
       and (auth_user.banned_until is null
            or auth_user.banned_until <= pg_catalog.clock_timestamp())
  ) then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin.mfa_factor_reset:' || target_person::text, 0));
  if exists (
    select 1 from platform_private.admin_mfa_factor_resets live
     where live.target_person_id = target_person and live.state = 'reconciling'
  ) then
    raise exception 'MFA_RESET_IN_PROGRESS' using errcode = 'P0001';
  end if;
  insert into platform_private.admin_mfa_factor_resets(
    id, target_person_id, organization_id, operator_person_id, grant_id, reason,
    idempotency_key, state, outbox_event_id
  ) values (
    reset_id, target_person, organization, operator_person, grant_row.id, reason_text,
    key_text, 'reconciling', outbox_id
  );
  perform pg_catalog.set_config('app.mfa_reset_correlation', correlation::text, true);
  effect := identity.rpc_admin_reset_mfa_factors(reset_id, target_person, operator_person);
  perform pg_catalog.set_config('app.mfa_reset_correlation', '', true);
  moved_ids := array(select pg_catalog.jsonb_array_elements_text(effect->'movedFactorIds')::uuid);
  provider_ids := effect->'providerFactorIds';
  reset_state := case when pg_catalog.cardinality(moved_ids) = 0 then 'completed' else 'reconciling' end;
  update platform_private.admin_mfa_factor_resets
     set moved_factor_ids = moved_ids, state = reset_state,
         completed_at = case when reset_state = 'completed' then pg_catalog.clock_timestamp() end,
         version_no = version_no + 1
   where id = reset_id;
  insert into platform_private.outbox_events(
    id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
    correlation_id, payload
  ) values (
    outbox_id, 'admin.mfa-factor.reset.v1', 1, 'admin_mfa_factor_reset', reset_id, 1,
    correlation,
    pg_catalog.jsonb_build_object('resetId', reset_id, 'targetPersonId', target_person));
  perform platform_private.mfa_audit(
    'identity.mfa.factors.reset', actor.actor_id, organization, 'person', target_person,
    'MFA_FACTORS_RESET', correlation);
  update platform_private.idempotency_records
     set state = 'completed'::platform_private.idempotency_state,
         response_ref = pg_catalog.jsonb_build_object(
           'status', 200, 'resourceRef', reset_id::text)
   where id = reservation.id;
  response := platform_private.admin_mfa_factor_reset_view(reset_id);
  return response || pg_catalog.jsonb_build_object(
    'targetAuthUserId', effect->'targetAuthUserId',
    'pendingProviderFactorIds', provider_ids);
end;
$body$;

-- Settlement of the operator-only provider adapter's per-factor outcomes.
-- `removed` and `absent` confirm removal; `failed` leaves the row reconciling
-- for auth-state-reconciler (no rollback, no blind resend).  Completed once
-- every moved factor is removed.  The settlement transaction bumps mfa_version
-- once when it confirmed any removal.
create function platform_api.admin_mfa_factor_reset_settle(p_request jsonb)
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

revoke all on function
  identity.rpc_admin_reset_mfa_factors(uuid, uuid, uuid),
  platform_private.admin_mfa_factor_reset_guard(),
  platform_private.admin_mfa_factor_reset_view(uuid),
  platform_api.admin_mfa_factor_reset(jsonb),
  platform_api.admin_mfa_factor_reset_settle(jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  platform_api.admin_mfa_factor_reset(jsonb),
  platform_api.admin_mfa_factor_reset_settle(jsonb)
to service_role;

commit;
