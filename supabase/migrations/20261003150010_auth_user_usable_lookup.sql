-- SEC-2 (second sweep): read auth.users through one narrow lookup.
--
-- The two Slice 09 functions that join auth.users (the administrative MFA reset
-- and the review-person eligibility check) are about to be owned by non-bypass
-- roles (20261003150200).  auth.users belongs to the Auth service: the platform
-- role holds no grant option on the auth schema, so no migration can give a
-- dedicated role USAGE on it, and a join against it from those functions would
-- fail with `permission denied for schema auth`.  auth.users has no row-level
-- security, so reading it is not part of the SEC-2 class; the read moves into
-- one SECURITY DEFINER lookup that stays with the platform owner, takes a
-- single Auth user id and returns a boolean (no row, no column, no id leaves
-- it).  The two functions keep exactly their previous predicates:
--   * the reset requires the Auth user to exist and not be banned right now;
--   * the eligibility check additionally requires it to be undeleted.
-- EXECUTE goes to the two dedicated roles that call it and to no API role.
-- Forward-only.
begin;

create function platform_private.auth_user_usable(p_auth_user_id uuid, p_require_undeleted boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select exists (
    select 1 from auth.users u
     where u.id = p_auth_user_id
       and (not p_require_undeleted or u.deleted_at is null)
       and (u.banned_until is null or u.banned_until <= pg_catalog.clock_timestamp())
  )
$body$;
revoke all on function platform_private.auth_user_usable(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function platform_private.auth_user_usable(uuid, boolean)
  to wejammin_cms_definer, wejammin_cms_authority_reader;

CREATE OR REPLACE FUNCTION platform_private.cms_review_person_eligible(p_person_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
      from platform_private.person_party person
     where person.party_id = p_person_id
       and person.account_state in (
         'claimed'::platform_private.person_account_state,
         'active'::platform_private.person_account_state
       )
       and platform_private.auth_user_usable(person.auth_user_id, true)
  )
$function$;

CREATE OR REPLACE FUNCTION platform_api.admin_mfa_factor_reset(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   where tenure.organization_id = organization
     and tenure.person_id = target_person
     and tenure.state = 'confirmed'
     and tenure.starts_on <= (pg_catalog.clock_timestamp() at time zone 'UTC')::date
     and (tenure.ends_on is null
          or tenure.ends_on >= (pg_catalog.clock_timestamp() at time zone 'UTC')::date)
     and person.account_state in ('claimed', 'active')
     and platform_private.auth_user_usable(person.auth_user_id, false)
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
$function$;

commit;
