-- SEC-1 (found by the real-API aal proof): profile claim conversion step-up was fail-OPEN.
--
-- `coalesce(app.step_up_verified, jwt aal)` evaluates to NULL when neither the
-- server-set step-up flag nor an aal claim is present, and `NULL not in (...)`
-- is NULL, so the refusal branch never ran and conversion proceeded with no
-- step-up evidence at all. Absence of evidence must refuse: the coalesce now
-- ends in '' so every missing-evidence case reaches STEP_UP_REQUIRED.
-- rpc_convert_claim is redefined from its latest definition; nothing else changes.
CREATE OR REPLACE FUNCTION profile_private.rpc_convert_claim(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  idempotency platform_private.idempotency_records;
  key_hash bytea;
  request_hash bytea;
  expected_version bigint;
  actor_id uuid := profile_private.profile_actor();
  acting_party_id uuid;
  claim_id uuid;
  reason_code text;
  claim profile_private.claim_cases%rowtype;
  active_period profile_private.party_ownership_periods%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
  correlation_id uuid := profile_private.profile_correlation_id();
  audit_outbox_transaction boolean := true;
begin
  perform profile_private.profile_require_keys(
    p_request,
    array['claimId','reasonCode','expectedVersion','idempotencyKey']::text[]
  );
  claim_id := profile_private.profile_require_uuid(p_request->>'claimId', 'claimId');
  reason_code := p_request->>'reasonCode';
  if reason_code is null or reason_code !~ '^[a-z][a-z0-9_.-]{0,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  expected_version := profile_private.profile_expected_version(p_request);
  acting_party_id := profile_private.profile_acting_party(actor_id);
  if coalesce(
    nullif(pg_catalog.current_setting('app.step_up_verified', true), ''),
    nullif(platform_private.request_jwt_claim('aal'), ''),
    ''
  ) not in ('1','true','aal2') then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;

  key_hash := profile_private.profile_key_hash(p_request);
  request_hash := profile_private.profile_request_hash('profile.claim.convert', p_request);
  idempotency := platform_private.identity_idempotency_reserve(
    actor_id, 'profile.claim.convert', key_hash, request_hash);
  if idempotency.state = 'completed'::platform_private.idempotency_state then
    select * into claim from profile_private.claim_cases c
     where c.id = (idempotency.response_ref->>'resourceRef')::uuid;
    if found then return profile_private.profile_claim_resource(claim); end if;
  end if;

  select * into claim from profile_private.claim_cases c
   where c.id = claim_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if claim.claimant_person_id <> actor_id and not exists (
    select 1 from profile_private.party_ownership_periods p
     where p.party_id = claim.target_party_id
       and p.owner_person_id = actor_id
       and p.control_level = 'full'
       and p.state = 'active'::profile.ownership_period_state
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if claim.version <> expected_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if claim.state::text not in ('provisional','full') then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from profile_private.ownership_contests c
     where c.party_id = claim.target_party_id
       and c.state in ('open'::profile.contest_state, 'frozen'::profile.contest_state)
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from profile_private.claim_proof_attempts p
     where p.claim_id = claim.id
       and p.state = 'accepted'::profile.proof_state
       and (p.tier = 'A' or (p.tier = 'B' and pg_catalog.cardinality(p.attester_ids) >= 2))
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  if claim.state::text <> 'full' or claim.control_level <> 'full' then
    update profile_private.claim_cases
       set state = 'full', control_level = 'full', window_expires_at = null,
           version = version + 1, updated_at = now_at
     where id = claim.id and version = expected_version
     returning * into claim;
    if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;
  end if;

  select * into active_period from profile_private.party_ownership_periods p
   where p.party_id = claim.target_party_id
     and p.state = 'active'::profile.ownership_period_state
   order by p.starts_at desc, p.id desc limit 1 for update;
  if found and (
    active_period.owner_person_id <> claim.claimant_person_id
    or active_period.control_level <> 'full'
  ) then
    perform profile_private.profile_close_active_period(claim.target_party_id, now_at);
    active_period := null;
  end if;
  if not found or active_period.id is null then
    insert into profile_private.party_ownership_periods(
      owner_id, party_id, owner_person_id, basis_kind, basis_id,
      starts_at, control_level, state, case_id, version
    ) values (
      claim.target_party_id, claim.target_party_id, claim.claimant_person_id,
      'claim', claim.id, now_at, 'full', 'active', claim.id, 1
    );
  end if;
  perform profile_private.profile_effects(
    'claim.converted', actor_id, acting_party_id, 'claim', claim.id,
    'CLAIM_CONVERTED', 'profile.claim.converted.v1', 'claim', claim.id, claim.version,
    pg_catalog.jsonb_build_object('claimId', claim.id, 'controlLevel', 'full'),
    correlation_id
  );
  perform profile_private.profile_complete(idempotency.id, claim.id, 200);
  return profile_private.profile_claim_resource(claim);
end;
$function$;
