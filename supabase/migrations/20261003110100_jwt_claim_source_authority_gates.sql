-- SEC-1: move every authority gate to platform_private.request_jwt_claim.
--
-- Each function below is redefined from its latest definition with the only
-- change being the claim source: the legacy per-claim settings (never set by
-- PostgREST v10+) become request_jwt_claim('<name>').
-- Observed before this migration against a real PostgREST: an authenticated
-- caller naming another user in p_request.context passed cfg_actor, and every
-- service_role worker RPC answered UNAUTHENTICATED.

-- platform_private.cfg_actor: 2 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION platform_private.cfg_actor(p_request jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  value text;
  context_auth_user_id text := platform_private.cfg_context_value(p_request, 'authUserId');
  context_actor_person_id text := platform_private.cfg_context_value(p_request, 'actorPersonId');
  jwt_subject text := nullif(platform_private.request_jwt_claim('sub'), '');
  jwt_role text := nullif(platform_private.request_jwt_claim('role'), '');
begin
  if jwt_role = 'authenticated' then
    if not platform_private.cfg_valid_uuid(jwt_subject)
       or (context_auth_user_id is not null and context_auth_user_id <> jwt_subject)
       or (context_actor_person_id is not null and context_actor_person_id <> jwt_subject) then
      raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
    end if;
    value := jwt_subject;
  else
    -- Only the service-role Worker and migration/test owners can reach the
    -- private command surface.  Their context has already been verified at
    -- the Worker boundary; direct authenticated Data API callers are denied
    -- by the wrapper grants below.
    value := context_auth_user_id;
    if value is null then
      value := nullif(pg_catalog.current_setting('app.actor_auth_user_id', true), '');
    end if;
    if value is null then
      value := nullif(pg_catalog.current_setting('app.auth_user_id', true), '');
    end if;
  end if;
  if not platform_private.cfg_valid_uuid(value) then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = value::uuid) then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  return value::uuid;
end;
$function$;

-- platform_private.cms_release_actor: 1 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION platform_private.cms_release_actor(p_request jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  bound_key text := nullif(platform_private.cfg_context_value(p_request, 'releasePrincipalId'), '');
  requested_key text := nullif(p_request->>'releaseKeyId', '');
  now_at timestamptz := pg_catalog.clock_timestamp();
  actor_id uuid;
begin
  if platform_private.request_jwt_claim('role') is distinct from 'service_role'
     or bound_key is null or bound_key !~ '^[a-z][a-z0-9_.-]{1,95}$'
     or requested_key is distinct from bound_key then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  select principal.principal_id
    into actor_id
    from platform_private.cfg_release_principals principal
   where principal.key_id = bound_key
     and principal.active
     and principal.revoked_at is null
     and (principal.valid_from is null or principal.valid_from <= now_at)
     and (principal.valid_through is null or principal.valid_through >= now_at);
  if actor_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  return actor_id;
end;
$function$;

-- platform_private.cms_require_release_worker: 1 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION platform_private.cms_require_release_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if platform_private.request_jwt_claim('role') is distinct from 'service_role' then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
end;
$function$;

-- platform_private.cms_session_system_scope: 1 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION platform_private.cms_session_system_scope()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select platform_private.cms_session_uuid('app.cms_session_actor') is null
     and nullif(platform_private.request_jwt_claim('role'), '')
         is not distinct from 'service_role'
$function$;

-- platform_private.identity_auth_user: 1 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION platform_private.identity_auth_user()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  configured text := nullif(pg_catalog.current_setting('app.auth_user_id', true), '');
  claimed text := nullif(platform_private.request_jwt_claim('sub'), '');
  result uuid;
begin
  if configured is null then configured := claimed; end if;
  if configured is null or configured !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if claimed is not null and claimed !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if claimed is not null and configured::uuid <> claimed::uuid then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  result := configured::uuid;
  if not exists (select 1 from auth.users u where u.id = result) then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  return result;
end;
$function$;

-- identity_private.identity_organization_read: 1 claim read(s) moved to request_jwt_claim
CREATE OR REPLACE FUNCTION identity_private.identity_organization_read(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  auth_setting text := nullif(pg_catalog.current_setting('app.auth_user_id', true), '');
  request_claim text := nullif(platform_private.request_jwt_claim('sub'), '');
  auth_id uuid;
  actor_id uuid;
  acting_party_id uuid;
begin
  if p_organization_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if auth_setting is null and request_claim is null then
    return identity_private.organization_public_resource(p_organization_id);
  end if;
  auth_id := platform_private.identity_auth_user();
  actor_id := platform_private.identity_actor_person(auth_id);
  acting_party_id := identity_private.trusted_acting_party(actor_id);
  if acting_party_id in (actor_id, p_organization_id)
     and (
       exists (
         select 1
           from identity_private.membership_tenure t
          where t.organization_id = p_organization_id
            and t.person_id = actor_id
            and t.state = 'confirmed'
            and (t.ends_on is null or t.ends_on >= current_date)
       )
       or exists (
         select 1
           from identity_private.organization_actor_grant g
          where g.organization_id = p_organization_id
            and g.person_id = actor_id
            and g.active
            and g.valid_from <= current_date
            and (g.valid_through is null or g.valid_through >= current_date)
       )
     ) then
    return identity_private.organization_resource(p_organization_id);
  end if;
  return identity_private.organization_public_resource(p_organization_id);
end;
$function$;

-- profile_private.rpc_convert_claim: 1 claim read(s) moved to request_jwt_claim
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
    nullif(platform_private.request_jwt_claim('aal'), '')
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

-- platform_private.initialize_cms_owner: the operator's actor context is established through
-- the one real claims setting (the JSON request.jwt.claims) instead of the legacy per-claim
-- subject setting. The function is SECURITY INVOKER, refuses any caller but the postgres
-- operator, is revoked from every API role, and restores the prior setting values before
-- returning.
create or replace function platform_private.initialize_cms_owner(
  p_auth_user_id uuid,
  p_person_id uuid,
  p_expected_email text,
  p_grant_ends_at timestamptz,
  p_authorization_ref uuid,
  p_preview boolean
) returns jsonb
language plpgsql security invoker
set search_path = ''
set timezone = 'UTC'
as $body$
declare
  now_at timestamptz := clock_timestamp();
  alias_result jsonb;
  organization_result jsonb;
  alias_id uuid;
  organization_id uuid;
  setting_name text;
  previous_settings jsonb := '{}'::jsonb;
  capability text;
begin
  if current_user <> 'postgres' then
    raise exception 'BOOTSTRAP_OPERATOR_REQUIRED' using errcode = 'P0001';
  end if;
  if p_auth_user_id is null or p_person_id is null or p_authorization_ref is null
     or p_preview is null or p_expected_email is null
     or p_grant_ends_at is null
     or p_grant_ends_at <= now_at
     or (p_grant_ends_at at time zone 'UTC')::date <= current_date
     or p_grant_ends_at > now_at + interval '7 days' then
    raise exception 'BOOTSTRAP_INVALID' using errcode = 'P0001';
  end if;
  -- Serialize the empty-authority check with competing initializations and grants.
  lock table platform_private.cms_owner_initialization,
    identity_private.organization_actor_grant,
    platform_private.admin_capability_grants in share row exclusive mode;
  if exists (select 1 from platform_private.cms_owner_initialization) then
    raise exception 'BOOTSTRAP_ALREADY_INITIALIZED' using errcode = 'P0001';
  end if;
  perform 1 from auth.users u
    join platform_private.person_party p on p.auth_user_id = u.id
    where u.id = p_auth_user_id and p.party_id = p_person_id
      and lower(u.email) = lower(p_expected_email)
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now_at)
      and p.account_state in ('claimed','active')
    for update of u,p;
  if not found then
    raise exception 'BOOTSTRAP_IDENTITY_MISMATCH' using errcode = 'P0001';
  end if;
  if exists (select 1 from identity_private.organization_actor_grant
      where capability_code like 'cms.%' or capability_code like 'admin.%')
     or exists (select 1 from platform_private.admin_capability_grants) then
    raise exception 'BOOTSTRAP_AUTHORITY_EXISTS' using errcode = 'P0001';
  end if;
  if exists (select 1 from platform_private.handle_reservation
      where normalized_handle = 'webejammin') then
    raise exception 'BOOTSTRAP_HANDLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_preview then
    return jsonb_build_object('state','preview','personId',p_person_id,
      'handle','WeBeJammin','grantEndsAt',p_grant_ends_at,
      'capabilities',jsonb_build_array('cms.schema_registry.read','cms.schema_designer',
        'admin.inbox.read','admin.audit.read'));
  end if;

  -- Existing identity operations require actor context. The operator receipt below
  -- identifies this as owner-authorized initialization, not an interactive login.
  foreach setting_name in array array['app.auth_user_id','request.jwt.claims',
    'app.actor_auth_user_id','app.actor_person_id','app.acting_party_id','app.acting_context_id',
    'app.idempotency_key_hash','app.request_hash','app.correlation_id'] loop
    previous_settings := previous_settings || jsonb_build_object(
      setting_name,coalesce(current_setting(setting_name,true),''));
  end loop;
  perform set_config('app.auth_user_id',p_auth_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_auth_user_id)::text,true);
  perform set_config('app.actor_auth_user_id',p_auth_user_id::text,true);
  perform set_config('app.actor_person_id',p_person_id::text,true);
  -- Operator initialization has no browser-selected acting context. Clearing
  -- these settings selects the canonical self-person default without refreshing
  -- or changing any existing session/context binding.
  perform set_config('app.acting_party_id','',true);
  perform set_config('app.acting_context_id','',true);
  perform set_config('app.correlation_id',p_authorization_ref::text,true);
  perform set_config('app.idempotency_key_hash',p_authorization_ref::text || ':alias',true);
  perform set_config('app.request_hash',p_authorization_ref::text || ':alias',true);
  alias_result := platform_api.identity_alias_create('WeBeJammin','WeBeJammin','private');
  alias_id := (alias_result->>'aliasId')::uuid;
  perform set_config('app.idempotency_key_hash',p_authorization_ref::text || ':organization',true);
  perform set_config('app.request_hash',p_authorization_ref::text || ':organization',true);
  organization_result := platform_api.rpc_create_organization('self_member','{}'::text[]);
  organization_id := (organization_result->>'organizationId')::uuid;

  foreach capability in array array['cms.schema_registry.read','cms.schema_designer',
    'admin.inbox.read','admin.audit.read'] loop
    insert into identity_private.organization_actor_grant(
      organization_id,person_id,capability_code,valid_from,valid_through,active)
    values(organization_id,p_person_id,capability,current_date,
      (p_grant_ends_at at time zone 'UTC')::date - 1,true);
  end loop;
  foreach capability in array array['admin.inbox.read','admin.audit.read'] loop
    insert into platform_private.admin_capability_grants(
      subject_person_id,capability_key,resource_type,resource_id,scope,actions,
      starts_at,ends_at,grantor_person_id,reason,purpose_grant,state,version_no)
    values(p_person_id,capability,'organization',organization_id,
      jsonb_build_object('actingPartyId',organization_id),array['read'],now_at,
      p_grant_ends_at,p_person_id,'Owner-authorized initial setup; see initialization receipt',
      false,'active',1);
  end loop;
  insert into platform_private.cms_owner_initialization(
    auth_user_id,person_id,alias_id,organization_id,authorization_ref,operator_role,grant_ends_at)
  values(p_auth_user_id,p_person_id,alias_id,organization_id,p_authorization_ref,
    current_user,p_grant_ends_at);
  insert into audit_private.audit_events(action,actor_id,acting_party_id,target_type,
    target_id,decision,reason_code,correlation_id)
  values('operator.cms_owner.initialize',p_auth_user_id,organization_id,'organization',
    organization_id,'allowed','OWNER_AUTHORIZED_OPERATOR_INITIALIZATION',p_authorization_ref);
  for setting_name in select jsonb_object_keys(previous_settings) loop
    perform set_config(setting_name,previous_settings->>setting_name,true);
  end loop;
  return jsonb_build_object('state','initialized','personId',p_person_id,
    'aliasId',alias_id,'organizationId',organization_id,'grantEndsAt',p_grant_ends_at);
end;
$body$;

revoke all on function platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)
  from public,anon,authenticated,service_role;
comment on function platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)
  is 'One-time operator initialization only. Never use as hosted login, MFA or AC265 evidence.';
