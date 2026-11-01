-- DEC-193 CMS-03C-02: five exact live-source amendments, not a producer copy.
-- Preserve all authentication/authority/replay/CAS/lock/digest/review/effect
-- statements and the public wrapper. Any mismatch aborts the transaction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_insert_pattern_instance(jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$  v_nodes := platform_private.cms_pattern_placement_plan(v_revision.owner_id, v_pattern, v_slot_path, v_overrides);$old$,
    $old$  -- (revision_id, path) is unique: a placement never overwrites, and nothing is written when any row collides
  if exists (
    select 1
      from platform_private.cms_composition_instances existing
      join pg_catalog.jsonb_array_elements(v_nodes) item(value)
        on (item.value->>'isRoot')::boolean
       and existing.path = case when v_slot_path = '/' then item.value->>'root' else v_slot_path || (item.value->>'root') end
     where existing.revision_id = v_revision.id
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;$old$,
    $old$  -- DEC-185: one above the greatest position of the (revision, slot), of any state or version, else 0
  select coalesce(pg_catalog.max(existing.position)::bigint, -1) + 1 into v_base
    from platform_private.cms_composition_instances existing
   where existing.revision_id = v_revision.id and existing.slot_key = v_slot_key;
  if v_base + v_roots - 1 > 2147483647 then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;$old$,
    $old$    select extensions.gen_random_uuid(), v_revision.owner_id, 'active', 1, v_now, v_now, v_revision.id,$old$,
    $old$           '{}'::jsonb, null, v_actor_id, (v_base + (row_number() over (order by root_row.seq)) - 1)::integer$old$
  ];
  anchors_new text[] := array[
    $new$  v_nodes := platform_private.cms_pattern_placement_selected_plan(
    v_revision.owner_id, v_pattern, v_slot_path, v_overrides, p_request->'roots');$new$,
    $new$  -- DEC-193: newest heads, retired reuse and new positions under the existing entry lock.
  v_nodes := platform_private.cms_pattern_placement_path_allocation(
    v_revision.id, v_slot_key, v_slot_path, v_nodes);$new$,
    $new$  -- DEC-193: allocation above counts only new paths; retired paths keep position/version history.$new$,
    $new$    select extensions.gen_random_uuid(), v_revision.owner_id, 'active',
           (root_row.node_info->>'placementVersion')::bigint, v_now, v_now, v_revision.id,$new$,
    $new$           '{}'::jsonb, null, v_actor_id, (root_row.node_info->>'placementPosition')::integer$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'selected-roots placement producer missing: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'pg_catalog.jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'selected-roots placement producer: unexpected attributes' using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', original.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', original.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', original.oid, 'EXECUTE')
     or exists (select 1 from pg_catalog.aclexplode(coalesce(original.proacl,
       pg_catalog.acldefault('f', original.proowner))) acl_entry
       where acl_entry.grantee = 0 and acl_entry.privilege_type = 'EXECUTE') then
    raise exception 'selected-roots placement producer: unexpected private ACL' using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(new_source, anchors_new[i]) <> 0 then
      raise exception 'selected-roots placement producer: unexpected anchor %', i using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'selected-roots placement producer: ambiguous inverse %', i using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'selected-roots placement producer: non-anchor change' using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'selected-roots placement producer: ambiguous definition' using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'selected-roots placement producer: replacement changed more than the source' using errcode = '55000';
  end if;
end;
$migration$;

commit;
