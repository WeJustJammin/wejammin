-- Slice 12 lane pattern-def (BE03c route rows CMS-03C-12 at 174 and cmsPatternLatestRead at 165, Permission/RLS/
-- grants 1447, authorization 1473 and 1479; tracker P2-S12-AC-100 to AC-104, AC-171 to AC-176): the latest read,
-- the Worker transport wrappers and the privilege closure of the pattern producers.
--
--   platform_private.cms_pattern_latest(p_request jsonb)        the owner's latest version of a key, any state, as
--                                                              PatternVersionDetail (the resource plus blockTree)
--   platform_api.cms_create_pattern_version(p_request jsonb)   Worker transport of CMS-03C-12
--   platform_api.cms_pattern_latest(p_request jsonb)           Worker transport of cmsPatternLatestRead
-- Both wrappers are SECURITY DEFINER, owned by the CMS definer, EXECUTE for service_role only (never public, anon
-- or authenticated), restore the app.cms_rpc flag (SEC-2) and map a residual lock failure to the retryable
-- CONFLICT (BE03b lock order).  Every stored row is a PatternNode forest (20261014020100 allows no legacy shape),
-- so the read needs no format filter.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_latest(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_person_id uuid;
  v_id uuid;
  v_tree jsonb;
begin
  -- SEC-2: the forced policies of the CMS tables admit a row only inside an RPC context; the wrapper restores it
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if not platform_private.cms_exact_keys(
       p_request, array['patternKey','context']::text[], array['patternKey','context']::text[])
     or pg_catalog.jsonb_typeof(p_request->'context') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_request->'patternKey') is distinct from 'string'
     or p_request->>'patternKey' !~ '^[a-z][a-z0-9-]{1,63}$'
     or p_request->>'patternKey' in ('context', 'versions', 'selector', 'new') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  begin
    v_person_id := platform_private.identity_actor_person(v_actor_id);
  exception when others then
    v_person_id := null;
  end;
  if v_person_id is null or not platform_private.cms_entry_tenant_visible(v_actor_id, v_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(v_party_id, v_person_id, 'cms.template_designer') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  select latest.id, latest.block_tree into v_id, v_tree
    from platform_private.cms_pattern_versions latest
   where latest.owner_id = v_party_id
     and latest.pattern_key = p_request->>'patternKey'
   order by latest.version desc
   limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_pattern_resource(v_id) || pg_catalog.jsonb_build_object('blockTree', v_tree);
end;
$body$;

comment on function platform_private.cms_pattern_latest(jsonb) is
  'cmsPatternLatestRead: the caller owner''s latest version of a pattern key in any state, as the PatternVersionDetail (the safe resource plus its block tree), for the designer edit form. The key resolves only within the caller''s owner scope, so a key another owner holds is the same NOT_FOUND as an unused key; a non-member is NOT_FOUND, a member without cms.template_designer is capability_missing. Private.';

create or replace function platform_api.cms_create_pattern_version(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_create_pattern_version(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

create or replace function platform_api.cms_pattern_latest(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_pattern_latest(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_create_pattern_version(jsonb) is
  'CMS-03C-12 Worker transport: delegates to platform_private.cms_create_pattern_version; service_role only.';
comment on function platform_api.cms_pattern_latest(jsonb) is
  'cmsPatternLatestRead Worker transport: delegates to platform_private.cms_pattern_latest; service_role only.';

grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_pattern_latest(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_create_pattern_version(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_pattern_latest(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_latest(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_create_pattern_version(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_pattern_latest(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_create_pattern_version(jsonb) to service_role;
grant execute on function platform_api.cms_pattern_latest(jsonb) to service_role;

-- Privilege closure.  The producers run as the CMS definer role, so every function they call directly (and every
-- function the table CHECKs and the lifecycle guard name) must be executable by that role; earlier governed work
-- failed at runtime on two missing EXECUTE grants.  Only what is missing is granted (non-grantable, definer only).
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)',
    'platform_private.cms_correlation(jsonb)',
    'platform_private.identity_actor_person(uuid)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)',
    'platform_private.cms_person_holds_capability(uuid,uuid,text)',
    'platform_private.cms_lock_governed_authority(uuid,uuid,text)',
    'platform_private.cms_reserve(jsonb,uuid,text)',
    'platform_private.cms_complete(uuid,uuid,integer,jsonb)',
    'platform_private.cms_record_audit(text,uuid,uuid,text,uuid,text,uuid)',
    'platform_private.cms_exact_keys(jsonb,text[],text[])',
    'platform_private.cms_valid_version(text)',
    'platform_private.cms_jcs_sha256(jsonb)',
    'platform_private.auth_iso_time(timestamp with time zone)',
    'platform_private.cms_governed_pattern_closure(uuid,jsonb,integer)',
    'platform_private.cms_governed_lifecycle_update(jsonb,jsonb)',
    'platform_private.cms_pattern_tree_keys_valid(jsonb)',
    'platform_private.cms_pattern_forest_check(jsonb)',
    'platform_private.cms_pattern_forest_nodes(jsonb)',
    'platform_private.cms_pattern_type_ids_valid(jsonb)',
    'platform_private.cms_pattern_props_valid(jsonb,jsonb)',
    'platform_private.cms_pattern_nested_closure(uuid,jsonb)',
    'platform_private.cms_pattern_registry_digest(uuid,jsonb)',
    'platform_private.cms_pattern_blocks_compatible(uuid,jsonb,jsonb)',
    'platform_private.cms_pattern_resource(uuid)',
    'platform_private.cms_create_pattern_version(jsonb)',
    'platform_private.cms_pattern_latest(jsonb)',
    'extensions.gen_random_uuid()'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'pattern producer callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
