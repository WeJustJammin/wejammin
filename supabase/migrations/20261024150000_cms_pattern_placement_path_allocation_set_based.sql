-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound).
-- cms_pattern_placement_path_allocation walked the plan root by root and rebuilt the result array on every step
-- (v_result := v_result || ...), so its cost grew with the square of the row count (measured 0.9 / 8 / 28 / 108 ms for
-- 32 / 128 / 256 / 512 rows).  The new body computes the same allocation in one pass: the newest head of every root path
-- is read once, new paths are numbered by a running count in forest order above every slot history position, retired
-- paths keep their position at the next version, and the array is aggregated once.  Same signature, volatility, owner,
-- security mode, search_path, ACL and comment; every CONFLICT condition is kept (a non-retired head, a version at the
-- ceiling, a position past the ceiling), with the same token and detail.  The installed source must equal the promoted
-- source byte for byte, else the migration aborts.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_pattern_placement_path_allocation(uuid,text,text,jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source constant text := $old$
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
$old$;
  new_source constant text := $new$
declare
  v_next bigint;
  v_result jsonb;
  v_bad bigint;
begin
  select coalesce(pg_catalog.max(instance.position)::bigint, -1) + 1 into v_next
    from platform_private.cms_composition_instances instance
   where instance.revision_id = p_revision_id and instance.slot_key = p_slot_key;
  -- One pass over the plan: the newest head of every root path is read once, the new paths are numbered by a running
  -- count in forest order, and the enriched array is aggregated once (no per-root query, no array re-copy).
  with items as (
    select item.value, item.ordinality,
           coalesce((item.value->>'isRoot')::boolean, false) as is_root,
           case when coalesce((item.value->>'isRoot')::boolean, false)
                then case when p_slot_path = '/' then item.value->>'root' else p_slot_path || (item.value->>'root') end
           end as root_path
      from pg_catalog.jsonb_array_elements(p_nodes) with ordinality item(value, ordinality)
  ), heads as (
    select distinct on (instance.path) instance.path, instance.version, instance.state, instance.position
      from platform_private.cms_composition_instances instance
     where instance.revision_id = p_revision_id
       and instance.path in (select items.root_path from items where items.root_path is not null)
     order by instance.path, instance.version desc, instance.id desc
  ), allocated as (
    select items.value, items.ordinality, items.is_root,
           heads.path is not null as has_head, heads.state as head_state,
           heads.version as head_version, heads.position as head_position,
           pg_catalog.count(*) filter (where items.is_root and heads.path is null)
             over (order by items.ordinality rows between unbounded preceding and 1 preceding) as new_before
      from items
      left join heads on heads.path = items.root_path
  ), checked as (
    select allocated.*, pg_catalog.count(*) filter (
             where allocated.is_root and (
               (allocated.has_head and (allocated.head_state <> 'retired' or allocated.head_version >= 2147483647))
               or (not allocated.has_head and v_next + coalesce(allocated.new_before, 0) > 2147483647))) over () as bad
      from allocated
  )
  select coalesce(pg_catalog.jsonb_agg(
           case when checked.is_root then checked.value || pg_catalog.jsonb_build_object(
                  'placementVersion', case when checked.has_head then checked.head_version + 1 else 1::bigint end,
                  'placementPosition', case when checked.has_head then checked.head_position
                                            else least(v_next + coalesce(checked.new_before, 0), 2147483647)::integer end)
                else checked.value end
           order by checked.ordinality), '[]'::jsonb),
         coalesce(pg_catalog.max(checked.bad), 0)
    into v_result, v_bad
    from checked;
  if v_bad > 0 then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;
  return v_result;
end;
$new$;
  definition text;
  comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'placement-perf: missing existing function %', identity using errcode = '55000';
  end if;
  if original.prosrc is distinct from old_source then
    raise exception 'placement-perf: unexpected installed source of %', identity using errcode = '55000';
  end if;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'placement-perf: unexpected baseline attributes of %', identity using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'placement-perf: ambiguous definition of %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'placement-perf: replacement changed more than the source of %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
