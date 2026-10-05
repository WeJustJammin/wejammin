-- Admin MFA reset idempotency key bounds (BE05b CFG-05B-06): the Idempotency-Key
-- is 16..128 printable ASCII characters.  The record CHECK and the reset RPC
-- accepted 8..256, so a key BE05b forbids was storable.  Tighten both to the
-- BE05b bounds (the contract schema and Worker route enforce the same range).
-- The RPC body is otherwise byte-identical to 20261002175000; grants and
-- ownership are preserved by create or replace.  Forward-only.
begin;

alter table platform_private.admin_mfa_factor_resets
  drop constraint admin_mfa_factor_resets_idempotency_key_check,
  add constraint admin_mfa_factor_resets_idempotency_key_check
    check (pg_catalog.char_length(idempotency_key) between 16 and 128);

create or replace function platform_api.admin_mfa_factor_reset(p_request jsonb)
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
     or pg_catalog.char_length(key_text) not between 16 and 128
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
  -- Serialize on the target before any authorization read: every check below
  -- is made under this lock and the row locks it orders, and none is a stale
  -- read that a concurrent revocation can overtake.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin.mfa_factor_reset:' || target_person::text, 0));
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
  -- Lock the target's tenure and person rows (FOR SHARE: a concurrent
  -- revocation of the membership blocks behind this reset, and a reset that
  -- waited behind a revocation re-evaluates the row it then sees) and recheck
  -- the membership immediately before the identity reset.
  perform 1
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
     for share of tenure, person;
  if not found then
    raise exception 'TARGET_NOT_FOUND' using errcode = 'P0001';
  end if;
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

commit;
