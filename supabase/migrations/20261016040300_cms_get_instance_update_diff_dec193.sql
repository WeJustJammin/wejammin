-- Slice 12 lane pattern-updates, CMS-03C-14 (BE03c route row 176, validation row 399, Pattern versions and linked updates 1367,
-- authorization 1475; contract CompositionUpdateDiffResource; tracker P2-S12-AC-112 .. AC-117; DEC-193):
-- GET /api/v1/cms/compositions/instances/{instanceId}/update-diff, the typed three-way diff of one instance.
--   platform_private.cms_get_instance_update_diff(p_request jsonb) returns jsonb   (the platform_api wrapper is 20261014140410)
-- The reader uses the independent cms_pattern_diff_plan (20261016040200), not the shared writer plan.
-- Typed complete resource: 128 paths, 256 KiB; no writes, row locks or CAS. Private; SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_get_instance_update_diff(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_row platform_private.cms_composition_instances%rowtype;
  v_entry platform_private.cms_content_entries%rowtype;
  v_plan jsonb;
  v_pinned bigint;
  v_target bigint;
  v_paths jsonb;
  v_collisions integer;
  v_resource jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['instanceId', 'context']::text[], array['instanceId', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  if pg_catalog.jsonb_typeof(p_request->'instanceId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'instanceId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into v_row from platform_private.cms_composition_instances instance_row
   where instance_row.id = (p_request->>'instanceId')::uuid;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select entry_row.* into v_entry
    from platform_private.cms_entry_revisions revision_row
    join platform_private.cms_content_entries entry_row on entry_row.id = revision_row.entry_id
   where revision_row.id = v_row.revision_id;
  if not found or v_entry.owner_party_id is distinct from v_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, v_entry.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.editor', v_entry.id) is null
     and platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.author', v_entry.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if v_row.pattern_id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  v_plan := platform_private.cms_pattern_diff_plan(v_row, v_entry.content_type_id);
  v_pinned := (v_plan->>'pinned')::bigint;
  v_target := coalesce((v_plan->>'target')::bigint, v_pinned);
  v_paths := v_plan->'paths';
  v_collisions := (v_plan->>'collisionCount')::integer;
  if pg_catalog.jsonb_array_length(v_paths) > 128 then
    raise exception 'diff_too_large' using errcode = 'P0001', detail = '["/instanceId"]';
  end if;
  v_resource := pg_catalog.jsonb_build_object(
    'instance', pg_catalog.jsonb_build_object(
      'id', v_row.id, 'version', v_row.version::text, 'revisionId', v_row.revision_id, 'path', v_row.path,
      'state', v_row.state, 'linkMode', v_row.link_mode, 'pinnedPatternVersion', v_pinned),
    'slotPath', v_plan->'slotPath', 'newRoots', v_plan->'newRoots',
    'targetPatternVersion', v_target,
    'paths', v_paths,
    'collisionCount', v_collisions,
    'bulkEligible', v_target > v_pinned and v_collisions = 0);
  if pg_catalog.octet_length(platform_private.cms_jcs(v_resource)) > 262144 then
    raise exception 'diff_too_large' using errcode = 'P0001', detail = '["/instanceId"]';
  end if;
  return v_resource;
end;
$body$;

comment on function platform_private.cms_get_instance_update_diff(jsonb) is
  'CMS-03C-14: an assigned author or editor reads the typed three-way diff (props, block identity, expanded children, local overrides and collision kinds), slot and new roots of one pattern instance against the latest active compatible pattern version above its pinned one; no newer version is a 200 with an empty diff; over 128 paths or 256 KiB is 422 diff_too_large. A read: writes and locks nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_get_instance_update_diff(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_get_instance_update_diff(jsonb) from public, anon, authenticated, service_role;

grant select on table platform_private.cms_composition_instances, platform_private.cms_entry_revisions,
  platform_private.cms_content_entries, platform_private.cms_pattern_versions to wejammin_cms_definer;

-- Privilege closure: every function the reader calls directly must be executable by the definer; only what is missing is granted.
-- The typed diff plan is created by this lane's definer and is asserted, never granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.cms_valid_uuid(text)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)', 'platform_private.cms_authority_origin(uuid,uuid,text,uuid)',
    'platform_private.cms_jcs(jsonb)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'update-diff reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
  callee_oid := pg_catalog.to_regprocedure(
    'platform_private.cms_pattern_diff_plan(platform_private.cms_composition_instances,uuid)');
  if callee_oid is null or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
    raise exception 'typed diff reader callee unavailable: %', callee_oid using errcode = '55000';
  end if;
end;
$closure$;

commit;
