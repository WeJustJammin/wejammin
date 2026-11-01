-- DEC-193 CMS-03C-14 only. Exact flat template-slot prefix, not the legacy
-- shortest-suffix/identity heuristic. No writes, row locks or writer-plan change.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_pattern_diff_plan(
  p_row platform_private.cms_composition_instances, p_content_type_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_template_id uuid;
  v_slot_path text;
  v_root_chain text;
  v_pinned platform_private.cms_pattern_versions%rowtype;
  v_target platform_private.cms_pattern_versions%rowtype;
  v_base_nodes jsonb;
  v_target_nodes jsonb;
  v_no_update jsonb;
begin
  if p_row.pattern_id is null or p_row.pattern_version is null or p_row.pattern_version < 1 then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select revision.template_version_id into v_template_id
    from platform_private.cms_entry_revisions revision
   where revision.id = p_row.revision_id and revision.owner_id = p_row.owner_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_template_id is null then
    v_slot_path := '/';
    v_root_chain := p_row.path;
  else
    select '/' || (slot.value->>'key') into v_slot_path
      from platform_private.cms_template_versions template_row
      cross join lateral pg_catalog.jsonb_array_elements(template_row.slots) slot(value)
     where template_row.id = v_template_id and template_row.owner_id = p_row.owner_id
       and slot.value->>'key' = p_row.slot_key;
    if not found or not pg_catalog.starts_with(p_row.path, v_slot_path || '/') then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    v_root_chain := pg_catalog.substr(p_row.path, pg_catalog.char_length(v_slot_path) + 1);
  end if;
  v_no_update := pg_catalog.jsonb_build_object('pinned', p_row.pattern_version,
    'target', p_row.pattern_version, 'slotPath', v_slot_path,
    'paths', '[]'::jsonb, 'newRoots', '[]'::jsonb, 'collisionCount', 0);

  -- Provenance-only snapshots and other history do not resolve content through
  -- their pin. Canonical row path + exact template slot already fixes the root.
  if p_row.link_mode <> 'linked' or p_row.state not in ('active', 'pending_diff')
     or exists (select 1 from platform_private.cms_composition_instances newer
       where newer.revision_id = p_row.revision_id and newer.path = p_row.path
         and newer.version > p_row.version) then
    return v_no_update;
  end if;
  select * into v_pinned from platform_private.cms_pattern_versions candidate
   where candidate.owner_id = p_row.owner_id and candidate.pattern_id = p_row.pattern_id
     and candidate.version = p_row.pattern_version;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  v_target := platform_private.cms_pattern_update_target(
    p_row.owner_id, p_row.pattern_id, p_row.pattern_version, p_content_type_id);
  if v_target.id is null then return v_no_update; end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'chain', expanded.node_chain, 'root', expanded.root_chain,
    'isRoot', expanded.is_root, 'node', expanded.node) order by expanded.ordinality), '[]'::jsonb)
    into v_base_nodes
    from platform_private.cms_pattern_update_nodes(p_row.owner_id, v_pinned.block_tree,
      array[v_pinned.pattern_id], false) with ordinality
      expanded(node_chain, root_chain, is_root, node, ordinality);
  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_base_nodes) item(value)
    where (item.value->>'isRoot')::boolean and item.value->>'chain' = v_root_chain
      and item.value->'node'->>'blockKey' = p_row.block_key
      and (item.value->'node'->>'blockVersion')::bigint = p_row.block_version) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'chain', expanded.node_chain, 'root', expanded.root_chain,
    'isRoot', expanded.is_root, 'node', expanded.node) order by expanded.ordinality), '[]'::jsonb)
    into v_target_nodes
    from platform_private.cms_pattern_update_nodes(p_row.owner_id, v_target.block_tree,
      array[v_target.pattern_id], false) with ordinality
      expanded(node_chain, root_chain, is_root, node, ordinality);
  return v_no_update || platform_private.cms_pattern_diff_delta(v_base_nodes, v_target_nodes, v_root_chain, p_row.props)
    || pg_catalog.jsonb_build_object('target', v_target.version);
end;
$body$;

comment on function platform_private.cms_pattern_diff_plan(platform_private.cms_composition_instances, uuid) is
  'DEC-193 CMS-03C-14 GET-only plan: exact flat template-slot anchoring, positive provenance/no-update history, newest active compatible target and expanded typed delta. Does not alter the legacy accept/detach planner or infer invalid nested-slot placement history. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_diff_plan(platform_private.cms_composition_instances, uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_diff_plan(platform_private.cms_composition_instances, uuid)
  from public, anon, authenticated, service_role;

do $closure$
declare callee text; callee_oid regprocedure; source_table text;
begin
  foreach callee in array array[
    'platform_private.cms_pattern_update_target(uuid,uuid,bigint,uuid)',
    'platform_private.cms_pattern_update_nodes(uuid,jsonb,uuid[],boolean,text,text,integer)',
    'platform_private.cms_pattern_diff_delta(jsonb,jsonb,text,jsonb)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      raise exception 'typed diff planner callee unavailable: %', callee using errcode = '55000';
    end if;
  end loop;
  foreach source_table in array array['platform_private.cms_entry_revisions', 'platform_private.cms_template_versions',
    'platform_private.cms_composition_instances', 'platform_private.cms_pattern_versions'] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', source_table, 'SELECT') then
      raise exception 'typed diff planner SELECT unavailable: %', source_table using errcode = '55000';
    end if;
  end loop;
end;
$closure$;

commit;
