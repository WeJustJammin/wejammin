-- Slice 12 lane linked-scan (review V6-01, root decision: no second copy of the composition row writer; BE03c "Linked update", Canonical
-- records "every other append (... the linked-update scan ...) copies the position of the row it follows"; tracker P2-S12-AC-212):
-- the shared append helper platform_private.cms_pattern_update_next_row gains a fourth action.
--
--   'pending'   the row the linked-update scan appends for a linked instance: a copy of the head at the next version, state `pending_diff`,
--               pinned to the UNCHANGED pattern version, pending_pattern_version = p_plan->'target', position, slot, block, props, bindings,
--               digest, parent and `created_by` of the head unchanged (a system job has no actor, so p_actor is ignored and the author of the
--               row it follows stays), carried_from_id null (R1-006: no cross-revision carry source).  The helper checks only what it
--               alone can: the head is a linked `active` or `pending_diff` row and the target is a version number above its pin.
--
-- The installed private function is amended by 1 guarded anchored replacement: the anchor occurs exactly once in the installed source (the
-- `detach` branch that opens the action dispatch), the inverse replacement restores the installed source byte for byte, so the accept and
-- detach paths are the installed bytes, and every pg_proc attribute except the source (owner, SECURITY DEFINER, volatility, search_path,
-- ACL, comment) is unchanged.  Sorts after its definer (pattern-updates 20261014140550) and before the scan.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text :=
    'platform_private.cms_pattern_update_next_row(platform_private.cms_composition_instances,text,jsonb,jsonb,text,uuid,timestamp with time zone)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source text;
  new_source text;
  inverse_source text;
  definition text;
  comment_text text;
  i integer;
  anchors_old text[] := array[
    $old$  if p_action = 'detach' then
    select * into pinned from platform_private.cms_pattern_versions candidate$old$
  ];
  anchors_new text[] := array[
    $new$  if p_action = 'pending' then
    -- BE03c Linked update (review V6-01): the linked-update scan appends through this helper, not through a second copy of the row writer.
    if p_plan is null or pg_catalog.jsonb_typeof(p_plan->'target') is distinct from 'number'
       or (p_plan->>'target') !~ '^[1-9][0-9]{0,9}$' or p_head.link_mode <> 'linked'
       or p_head.state not in ('active', 'pending_diff') or p_head.pattern_version is null then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if (p_plan->>'target')::bigint > 2147483647 or (p_plan->>'target')::bigint <= p_head.pattern_version then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    v_row := p_head;
    v_row.carried_from_id := null;
    v_row.id := extensions.gen_random_uuid();
    v_row.version := p_head.version + 1;
    v_row.state := 'pending_diff';
    v_row.pending_pattern_version := (p_plan->>'target')::integer;
    v_row.created_at := p_now;
    v_row.updated_at := p_now;
    return v_row;
  end if;
  if p_action = 'detach' then
    select * into pinned from platform_private.cms_pattern_versions candidate$new$
  ];
begin
  select proc.* into original from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'linked-scan pending action: missing existing function: %', identity using errcode = '55000';
  end if;
  old_source := original.prosrc;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'v'
     or original.proretset or original.prorettype <> 'platform_private.cms_composition_instances'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'plpgsql') then
    raise exception 'linked-scan pending action: unexpected baseline attributes: %', identity using errcode = '55000';
  end if;
  new_source := old_source;
  for i in 1 .. pg_catalog.cardinality(anchors_old) loop
    if (pg_catalog.length(new_source) - pg_catalog.length(pg_catalog.replace(new_source, anchors_old[i], '')))
         / pg_catalog.length(anchors_old[i]) <> 1
       or pg_catalog.strpos(old_source, anchors_new[i]) <> 0 then
      raise exception 'linked-scan pending action: unexpected anchor % in %', i, identity using errcode = '55000';
    end if;
    new_source := pg_catalog.replace(new_source, anchors_old[i], anchors_new[i]);
  end loop;
  inverse_source := new_source;
  for i in reverse pg_catalog.cardinality(anchors_old) .. 1 loop
    if (pg_catalog.length(inverse_source) - pg_catalog.length(pg_catalog.replace(inverse_source, anchors_new[i], '')))
         / pg_catalog.length(anchors_new[i]) <> 1 then
      raise exception 'linked-scan pending action: ambiguous inverse % in %', i, identity using errcode = '55000';
    end if;
    inverse_source := pg_catalog.replace(inverse_source, anchors_new[i], anchors_old[i]);
  end loop;
  if inverse_source is distinct from old_source then
    raise exception 'linked-scan pending action: non-anchored change in %', identity using errcode = '55000';
  end if;
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if definition is null or pg_catalog.length(old_source) = 0
     or (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
          / pg_catalog.length(old_source) <> 1 then
    raise exception 'linked-scan pending action: ambiguous definition: %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'linked-scan pending action: replacement changed more than the source: %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
