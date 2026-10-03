-- Slice 09 R14 (Codex review of 20261002200000, AC933): CFG-05B-06 settlement
-- emitted a reconciler wake-up (identity.mfa-factor.changed.v1) for every `failed`
-- outcome unconditionally.  The settlement request carries no idempotency key, so
-- a retry of the same report (the Worker re-sends a settle whose response it never
-- saw) or two concurrent copies re-entered the branch with the same factor version
-- and each wrote another outbox row: retry amplification and duplicate queue work,
-- against the migration's own "one event" claim.  Settlement now keeps a receipt,
-- platform_private.admin_mfa_factor_reset_settlements, keyed by reset, factor,
-- outcome and the factor version the outcome was applied at.  The first report of a
-- `failed` outcome for a factor version inserts the receipt and emits the event; a
-- replay finds the receipt and emits nothing.  A factor that later moves to a new
-- version is a new key, so a genuine second failure still wakes the reconciler.
-- Removal outcomes record their receipt as they confirm (their event was already
-- once-only, guarded by the state change).  Concurrent settlements serialize on the
-- reset row the function locks first, so the second sees the first's receipt.
-- Signature, grants, return shape and every other behaviour are unchanged.
-- The receipt table has no factor foreign key on purpose: the 30-day registry sweep
-- purges removed factor rows.  Forward-only.
begin;

create table platform_private.admin_mfa_factor_reset_settlements (
  reset_id uuid not null references platform_private.admin_mfa_factor_resets(id),
  factor_id uuid not null,
  outcome text not null check (outcome in ('removed', 'absent', 'failed')),
  factor_version bigint not null check (factor_version > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (reset_id, factor_id, outcome, factor_version)
);

alter table platform_private.admin_mfa_factor_reset_settlements enable row level security;
alter table platform_private.admin_mfa_factor_reset_settlements force row level security;
revoke all on table platform_private.admin_mfa_factor_reset_settlements
  from public, anon, authenticated, service_role;

-- Append-only: a receipt is evidence that a report was already applied.
create function platform_private.admin_mfa_factor_reset_settlement_guard()
returns trigger
language plpgsql
set search_path = ''
as $guard$
begin
  raise exception 'ADMIN_MFA_RESET_SETTLEMENT_APPEND_ONLY' using errcode = 'P0001';
end;
$guard$;

create trigger admin_mfa_factor_reset_settlements_guard
  before update or delete on platform_private.admin_mfa_factor_reset_settlements
  for each row execute function platform_private.admin_mfa_factor_reset_settlement_guard();

-- The settlement function runs as the NOLOGIN definer role (SEC-2): it reads and
-- appends receipts, nothing else.
grant insert, select on table platform_private.admin_mfa_factor_reset_settlements
  to wejammin_cms_definer;
create policy admin_mfa_factor_reset_settlements_cms_definer_insert
  on platform_private.admin_mfa_factor_reset_settlements
  for insert to wejammin_cms_definer with check (true);
create policy admin_mfa_factor_reset_settlements_cms_definer_select
  on platform_private.admin_mfa_factor_reset_settlements
  for select to wejammin_cms_definer using (true);

create or replace function platform_api.admin_mfa_factor_reset_settle(p_request jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  first_report boolean;
  settled_version bigint;
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
      settled_version := factor.version;
      update identity.mfa_factor_registry
         set state = 'removed', pending_expires_at = null,
             removed_at = pg_catalog.clock_timestamp(), version = version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = factor.id
       returning * into factor;
      confirmed := confirmed + 1;
      insert into platform_private.admin_mfa_factor_reset_settlements(
        reset_id, factor_id, outcome, factor_version)
      values (reset_row.id, factor.id, outcome_name, settled_version)
      on conflict do nothing;
      perform platform_private.mfa_factor_changed_event(
        factor.id, factor.version, target_binding.id, correlation);
    elsif outcome_name = 'failed' and factor.state = 'reconciling' then
      -- The provider could not confirm this removal and the row deliberately
      -- stays reconciling.  The change event of the reservation transaction may
      -- already have been consumed before the provider call failed, so the first
      -- report of this outcome for this factor version emits a fresh one: the
      -- reconciler is woken by exactly this event.  The receipt is keyed by
      -- (reset, factor, outcome, factor version), so a replay or a concurrent
      -- duplicate of the same report finds it and emits nothing; concurrent
      -- settlements serialize on the reset row locked above.
      insert into platform_private.admin_mfa_factor_reset_settlements(
        reset_id, factor_id, outcome, factor_version)
      values (reset_row.id, factor.id, outcome_name, factor.version)
      on conflict do nothing
      returning true into first_report;
      if first_report then
        perform platform_private.mfa_factor_changed_event(
          factor.id, factor.version, target_binding.id, correlation);
      end if;
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
$function$;

commit;
