-- DEC-193 / BE03c1485/1563: newest head precedes state. Retired paths reuse
-- their position at next version; only new paths consume fresh forest positions.
-- Read-only allocation under the producer's existing entry lock; no new locks.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_pattern_placement_path_allocation(
  p_revision_id uuid, p_slot_key text, p_slot_path text, p_nodes jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare
  v_next bigint;
  v_item jsonb;
  v_path text;
  v_version bigint;
  v_position integer;
  v_head platform_private.cms_composition_instances%rowtype;
  v_result jsonb := '[]'::jsonb;
begin
  select coalesce(pg_catalog.max(instance.position)::bigint, -1) + 1 into v_next
    from platform_private.cms_composition_instances instance
   where instance.revision_id = p_revision_id and instance.slot_key = p_slot_key;
  for v_item in
    select item.value from pg_catalog.jsonb_array_elements(p_nodes) with ordinality item(value, ordinality)
     order by item.ordinality
  loop
    if (v_item->>'isRoot')::boolean then
      v_path := case when p_slot_path = '/' then v_item->>'root' else p_slot_path || (v_item->>'root') end;
      select instance.* into v_head from platform_private.cms_composition_instances instance
       where instance.revision_id = p_revision_id and instance.path = v_path
       order by instance.version desc, instance.id desc limit 1;
      if found then
        if v_head.state <> 'retired' or v_head.version >= 2147483647 then
          raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
        end if;
        v_version := v_head.version + 1;
        v_position := v_head.position;
      else
        if v_next > 2147483647 then
          raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
        end if;
        v_version := 1;
        v_position := v_next::integer;
        v_next := v_next + 1;
      end if;
      v_item := v_item || pg_catalog.jsonb_build_object(
        'placementVersion', v_version, 'placementPosition', v_position);
    end if;
    v_result := v_result || pg_catalog.jsonb_build_array(v_item);
  end loop;
  return v_result;
end;
$body$;

comment on function platform_private.cms_pattern_placement_path_allocation(uuid, text, text, jsonb) is
  'DEC-193 private read-only allocation under the existing entry lock: newest revision/path head before state, nonretired CONFLICT, retired next bigint version/kept position, new paths consecutive in forest order above every slot history position. Enriches selected root entries only; no writes, renumbering or new locks.';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_pattern_placement_path_allocation(uuid, text, text, jsonb)
    owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_pattern_placement_path_allocation(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;

commit;
