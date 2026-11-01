-- DEC-193 / BE03c1487: simultaneous per-selector resolution, not whole-L fallback.
-- Pure content/graph seam only. Caller retains registry/auth/CAS/append duties.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_pattern_update_resolve(
  p_base jsonb, p_target jsonb, p_overrides jsonb, p_choices jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $body$
declare
  base_expanded jsonb;
  target_expanded jsonb;
  base_values jsonb;
  target_values jsonb;
  delta jsonb;
  changes jsonb;
  answers jsonb := '{}'::jsonb;
  selected jsonb := '{}'::jsonb;
  kept jsonb := '{}'::jsonb;
  output_nodes jsonb := '[]'::jsonb;
  choice jsonb;
  change jsonb;
  frontier jsonb;
  node jsonb;
  value jsonb;
  path text;
  root_path text;
  parent_path text;
  answer text;
  keep_override boolean;
  detached boolean := false;
  pending_paths text[];
  pending_parents integer[] := array[-1];
  child_paths text[];
  visited text[] := '{}'::text[];
  parent_index integer;
  node_index integer;
begin
  if pg_catalog.jsonb_typeof(p_overrides) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_choices) is distinct from 'array'
     or p_base is null or p_target is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  base_expanded := platform_private.cms_pattern_snapshot_expanded(p_base);
  target_expanded := platform_private.cms_pattern_snapshot_expanded(p_target);
  root_path := base_expanded->0->>'chain';
  if root_path is null or (pg_catalog.jsonb_array_length(target_expanded) > 0
      and target_expanded->0->>'chain' is distinct from root_path) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select pg_catalog.jsonb_object_agg(item->>'chain', pg_catalog.jsonb_build_object(
    'blockKey', item->'node'->'blockKey', 'blockVersion', item->'node'->'blockVersion',
    'props', item->'node'->'props', 'children', item->'children')) into base_values
    from pg_catalog.jsonb_array_elements(base_expanded) item;
  select coalesce(pg_catalog.jsonb_object_agg(item->>'chain', pg_catalog.jsonb_build_object(
    'blockKey', item->'node'->'blockKey', 'blockVersion', item->'node'->'blockVersion',
    'props', item->'node'->'props', 'children', item->'children')), '{}'::jsonb) into target_values
    from pg_catalog.jsonb_array_elements(target_expanded) item;

  for path, value in select item.key, item.value from pg_catalog.jsonb_each(p_overrides) item loop
    -- Existing override keys retain their 512-character bound; snapshots do not.
    if not (base_values ? path) or pg_catalog.char_length(path) > 512
       or platform_private.cms_json_bounded(value, 262144, 8, 128, 128) is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;
  delta := platform_private.cms_pattern_diff_delta(
    base_expanded, target_expanded, root_path, p_overrides);
  select coalesce(pg_catalog.jsonb_object_agg(item->>'path', item), '{}'::jsonb)
    into changes from pg_catalog.jsonb_array_elements(delta->'paths') item;

  for choice in select item from pg_catalog.jsonb_array_elements(p_choices) item loop
    if not platform_private.cms_exact_keys(choice, array['path','choice'], array['path','choice'])
       or pg_catalog.jsonb_typeof(choice->'path') is distinct from 'string'
       or pg_catalog.jsonb_typeof(choice->'choice') is distinct from 'string' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    path := choice->>'path';
    answer := choice->>'choice';
    if answer not in ('yours', 'theirs') or answers ? path
       or not (changes ? path) or changes->path->'collision' is distinct from 'true'::jsonb then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    answers := answers || pg_catalog.jsonb_build_object(path, answer);
    if answer = 'yours' and changes->path->>'collisionKind' in ('structure', 'removed_root') then
      detached := true;
    end if;
  end loop;
  if pg_catalog.jsonb_array_length(p_choices) <> (delta->>'collisionCount')::integer then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  -- Resolve every selector before traversal. Membership descendants inherit only
  -- their highest emitted frontier; ordinary ancestors never override answers.
  for path in select item.key from pg_catalog.jsonb_each(base_values || target_values) item
    order by item.key collate "C"
  loop
    select item into frontier from pg_catalog.jsonb_array_elements(delta->'paths') item
      where (item->>'path' = path or pg_catalog.starts_with(path, (item->>'path') || '/'))
        and ((item->'base' = 'null'::jsonb) <> (item->'theirs' = 'null'::jsonb))
      order by pg_catalog.char_length(item->>'path') limit 1;
    change := changes->path;
    keep_override := false;
    if frontier is not null then
      answer := answers->>(frontier->>'path');
      if answer = 'yours' then
        node := base_values->path;
        keep_override := p_overrides ? path;
      else
        node := target_values->path;
      end if;
    elsif change is null then
      node := base_values->path;
      keep_override := p_overrides ? path;
    elsif change->>'collisionKind' in ('structure', 'removed_root') then
      if answers->>path = 'yours' then
        node := base_values->path;
        keep_override := p_overrides ? path;
      else
        node := target_values->path;
        keep_override := p_overrides ? path
          and target_values->path->'props' is not distinct from base_values->path->'props';
      end if;
    else
      node := target_values->path;
      keep_override := change->>'collisionKind' = 'props' and answers->>path = 'yours';
    end if;
    if node is not null and keep_override then
      node := pg_catalog.jsonb_set(node, array['props'], p_overrides->path, false);
      kept := kept || pg_catalog.jsonb_build_object(path, p_overrides->path);
    end if;
    selected := selected || pg_catalog.jsonb_build_object(path, coalesce(node, 'null'::jsonb));
  end loop;

  if selected->root_path = 'null'::jsonb then
    if exists (select 1 from pg_catalog.jsonb_each(selected) item where item.value <> 'null'::jsonb) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object('disposition', 'retired', 'tree', null, 'overrides', '{}'::jsonb);
  end if;
  pending_paths := array[root_path];
  while pg_catalog.cardinality(pending_paths) > 0 loop
    path := pending_paths[1];
    parent_index := pending_parents[1];
    pending_paths := pending_paths[2:];
    pending_parents := pending_parents[2:];
    node := selected->path;
    node_index := pg_catalog.cardinality(visited);
    if node is null or node = 'null'::jsonb or path = any(visited) or node_index >= 512 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    parent_path := case when parent_index < 0 then '' else visited[parent_index + 1] end;
    if not pg_catalog.starts_with(path, parent_path || '/') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    output_nodes := output_nodes || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'parent', case when parent_index < 0 then null else parent_index end,
      'keySegments', pg_catalog.string_to_array(pg_catalog.substr(path, pg_catalog.char_length(parent_path) + 2), '/'),
      'blockKey', node->'blockKey', 'blockVersion', node->'blockVersion', 'props', node->'props'));
    visited := pg_catalog.array_append(visited, path);
    child_paths := array(select item from pg_catalog.jsonb_array_elements_text(node->'children') item);
    pending_paths := child_paths || pending_paths;
    pending_parents := pg_catalog.array_fill(node_index, array[pg_catalog.cardinality(child_paths)]) || pending_parents;
  end loop;
  if pg_catalog.cardinality(visited) <> (select pg_catalog.count(*) from pg_catalog.jsonb_each(selected) item
      where item.value <> 'null'::jsonb) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  value := pg_catalog.jsonb_build_object('format', 'cms.detached_tree.v1', 'nodes', output_nodes);
  if platform_private.cms_detached_tree_valid(value) is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object('disposition', case when detached then 'detached' else 'linked' end,
    'tree', value, 'overrides', case when detached then '{}'::jsonb else kept end);
end;
$body$;

comment on function platform_private.cms_pattern_update_resolve(jsonb,jsonb,jsonb,jsonb) is
  'DEC-193 pure simultaneous B/L/T resolution. Reuses typed delta, requires exact collision answers, honors descendant selectors under chosen ancestor topology, inherits only highest membership frontiers, refuses inconsistent/unreachable graphs and validates canonical <=512-node output. No public diff-read cap or store/registry/authorization decision.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_resolve(jsonb,jsonb,jsonb,jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_update_resolve(jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;

commit;
