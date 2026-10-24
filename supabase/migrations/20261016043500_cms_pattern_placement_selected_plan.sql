-- DEC-193 / BE03c1483/1485: expand the whole pin before selecting actual block
-- roots in forest order. Only selected row paths/override owners are inserted.
-- The producer retains its whole-pin graph/registry checks and existing locks.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_pattern_placement_selected_plan(
  p_owner_id uuid, p_pattern platform_private.cms_pattern_versions,
  p_slot_path text, p_overrides jsonb, p_roots jsonb default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare
  v_nodes jsonb;
  v_root_count integer;
  v_named record;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'chain', expanded.node_chain, 'root', expanded.root_chain,
           'isRoot', expanded.is_root, 'node', expanded.node)
           order by expanded.ordinality), '[]'::jsonb)
    into v_nodes
    from platform_private.cms_pattern_placement_nodes(
      p_owner_id, p_pattern.block_tree, array[p_pattern.pattern_id])
      with ordinality expanded(node_chain, root_chain, is_root, node, ordinality);
  select pg_catalog.count(*)::integer into v_root_count
    from pg_catalog.jsonb_array_elements(v_nodes) item(value)
   where (item.value->>'isRoot')::boolean;
  if pg_catalog.jsonb_array_length(v_nodes) > 512 or v_root_count > 512 then
    raise exception 'pattern_nodes_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  if v_root_count = 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/patternId"]';
  end if;

  -- SQL NULL means omitted. Supplied JSON null is never an omitted selector.
  -- The public request guard checks wire grammar before reaching this helper.
  if p_roots is not null then
    if pg_catalog.jsonb_typeof(p_roots) is distinct from 'array' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/roots"]';
    end if;
    if pg_catalog.jsonb_array_length(p_roots) not between 1 and 512
       or (select pg_catalog.count(*) <> pg_catalog.count(distinct named.value)
             from pg_catalog.jsonb_array_elements(p_roots) named(value)) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/roots"]';
    end if;
    for v_named in
      select named.value, named.ordinality
        from pg_catalog.jsonb_array_elements(p_roots) with ordinality named(value, ordinality)
       order by named.ordinality
    loop
      if pg_catalog.jsonb_typeof(v_named.value) is distinct from 'string'
         or not exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) item(value)
           where (item.value->>'isRoot')::boolean
             and item.value->>'root' = (v_named.value #>> '{}')) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_array(pg_catalog.format('/roots/%s', v_named.ordinality - 1))::text;
      end if;
    end loop;
    select pg_catalog.jsonb_agg(item.value order by item.ordinality) into v_nodes
      from pg_catalog.jsonb_array_elements(v_nodes) with ordinality item(value, ordinality)
     where p_roots ? (item.value->>'root');
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) item(value)
     where (item.value->>'isRoot')::boolean
       and pg_catalog.octet_length(case when p_slot_path = '/' then item.value->>'root'
             else p_slot_path || (item.value->>'root') end) > 248) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;
  if pg_catalog.jsonb_typeof(p_overrides) is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/overrides"]';
  end if;
  if exists (select 1 from pg_catalog.jsonb_object_keys(p_overrides) named(path)
      where not exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) item(value)
        where item.value->>'chain' = named.path)) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/overrides"]';
  end if;
  return v_nodes;
end;
$body$;

comment on function platform_private.cms_pattern_placement_selected_plan(
  uuid, platform_private.cms_pattern_versions, text, jsonb, jsonb) is
  'DEC-193 private placement plan: full pinned expansion/512-node bound, exact selected block roots in forest order, selected joined248-octet row paths and override membership. SQL NULL roots means omitted; whole-pin registry digest remains the producer authority. No writes or new locks.';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_pattern_placement_selected_plan(
    uuid, platform_private.cms_pattern_versions, text, jsonb, jsonb) owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_pattern_placement_selected_plan(
  uuid, platform_private.cms_pattern_versions, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
