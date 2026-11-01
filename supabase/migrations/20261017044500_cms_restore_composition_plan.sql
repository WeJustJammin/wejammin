-- DEC-201: source-bound restore heads and activity-neutral dependency refs.
-- Refs locals that would collide with persisted row or record fields carry a restore_ prefix (restore_template_id, restore_root_chain).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Newest-per-path selection stays independent from active-state eligibility.
create function platform_private.cms_restore_composition_heads(p_source_revision_id uuid)
returns setof platform_private.cms_composition_instances
language sql
stable
security invoker
set search_path = ''
as $body$
  with latest as materialized (
    select distinct on (instance.path collate "C") instance.*
      from platform_private.cms_composition_instances instance
      join platform_private.cms_entry_revisions revision
        on revision.id = instance.revision_id
       and revision.owner_id = instance.owner_id
     where instance.revision_id = p_source_revision_id
     order by instance.path collate "C", instance.version desc, instance.id
  )
  select latest.*
    from latest
   where latest.state = 'active'
   order by latest.position, latest.path collate "C", latest.id
$body$;

-- Exact persisted row images produce source-template, pattern and block refs.
create function platform_private.cms_restore_composition_refs(
  p_row platform_private.cms_composition_instances)
returns table(kind text, ref_id uuid)
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare
  stored platform_private.cms_composition_instances;
  revision_row platform_private.cms_entry_revisions;
  root_pattern platform_private.cms_pattern_versions;
  block_row platform_private.cms_block_definition_versions;
  block_node record;
  nested_ref record;
  restore_template_id uuid;
  slot_path text;
  restore_root_chain text;
  tree_root text;
  pattern_ids uuid[] := '{}'::uuid[];
  block_ids uuid[] := '{}'::uuid[];
  root_seen boolean := false;
  message_text text;
begin
  select instance.* into stored
    from platform_private.cms_composition_instances instance
   where instance.id = p_row.id;
  if not found or pg_catalog.to_jsonb(stored) is distinct from pg_catalog.to_jsonb(p_row) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = stored.revision_id and revision.owner_id = stored.owner_id;
  if not found then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  restore_template_id := revision_row.template_version_id;
  if restore_template_id is null then
    if stored.slot_key is distinct from 'root' then
      raise exception 'template_incompatible' using errcode = 'P0001';
    end if;
    restore_root_chain := stored.path;
  else
    select '/' || (slot.value->>'key') into slot_path
      from platform_private.cms_template_versions template_row
      cross join lateral pg_catalog.jsonb_array_elements(template_row.slots) slot(value)
     where template_row.id = restore_template_id and template_row.owner_id = stored.owner_id
       and slot.value->>'key' = stored.slot_key;
    if not found or not pg_catalog.starts_with(stored.path, slot_path || '/') then
      raise exception 'template_incompatible' using errcode = 'P0001';
    end if;
    restore_root_chain := pg_catalog.substr(stored.path, pg_catalog.char_length(slot_path) + 1);
  end if;
  if restore_template_id is not null then
    kind := 'template';
    ref_id := restore_template_id;
    return next;
  end if;
  if stored.detached_tree is not null then
    if platform_private.cms_detached_tree_valid(stored.detached_tree) is not true then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    select '/' || pg_catalog.string_agg(segment.value, '/' order by segment.ordinal)
      into tree_root
      from pg_catalog.jsonb_array_elements_text(stored.detached_tree#>'{nodes,0,keySegments}')
        with ordinality segment(value, ordinal);
    if tree_root is distinct from restore_root_chain
       or stored.detached_tree#>>'{nodes,0,blockKey}' is distinct from stored.block_key
       or (stored.detached_tree#>>'{nodes,0,blockVersion}')::bigint is distinct from stored.block_version then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    for block_node in
      select node.value from pg_catalog.jsonb_array_elements(stored.detached_tree->'nodes') node(value)
    loop
      select definition.id into block_row
        from platform_private.cms_block_definition_versions definition
       where definition.block_key = block_node.value->>'blockKey'
         and definition.block_version = (block_node.value->>'blockVersion')::bigint
         and definition.state = 'registered';
      if not found then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      if not (block_row.id = any(block_ids)) then
        block_ids := pg_catalog.array_append(block_ids, block_row.id);
      end if;
    end loop;
  elsif stored.pattern_id is not null then
    select pattern.* into root_pattern
      from platform_private.cms_pattern_versions pattern
     where pattern.owner_id = stored.owner_id
       and pattern.pattern_id = stored.pattern_id
       and pattern.version = stored.pattern_version;
    if not found then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    pattern_ids := pg_catalog.array_append(pattern_ids, root_pattern.id);
    begin
      for block_node in
        select reached.*
          from platform_private.cms_pattern_update_nodes(
            stored.owner_id, root_pattern.block_tree, array[root_pattern.pattern_id], false, '', null, 1)
            reached
      loop
        if block_node.is_root and block_node.root_chain = restore_root_chain then
          root_seen := true;
          if block_node.node->>'blockKey' is distinct from stored.block_key
             or (block_node.node->>'blockVersion')::bigint is distinct from stored.block_version then
            raise exception 'migration_chain_incomplete' using errcode = 'P0001';
          end if;
        end if;
        select definition.id into block_row
          from platform_private.cms_block_definition_versions definition
         where definition.block_key = block_node.node->>'blockKey'
           and definition.block_version = (block_node.node->>'blockVersion')::bigint
           and definition.state = 'registered';
        if not found then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
        if not (block_row.id = any(block_ids)) then
          block_ids := pg_catalog.array_append(block_ids, block_row.id);
        end if;
      end loop;
    exception when sqlstate 'P0001' then
      get stacked diagnostics message_text = message_text;
      if message_text in ('nested_pattern_not_active', 'pattern_cycle', 'pattern_depth_exceeded') then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      raise;
    end;
    if not root_seen then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    for nested_ref in
      select distinct closure.nested_row_id
        from platform_private.cms_pattern_nested_closure(stored.owner_id, root_pattern.block_tree) closure
    loop
      if nested_ref.nested_row_id is null then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      if not (nested_ref.nested_row_id = any(pattern_ids)) then
        pattern_ids := pg_catalog.array_append(pattern_ids, nested_ref.nested_row_id);
      end if;
    end loop;
    if exists (
      select 1
        from platform_private.cms_pattern_nested_closure(stored.owner_id, root_pattern.block_tree) closure
        join platform_private.cms_pattern_versions nested_pattern
          on nested_pattern.id = closure.nested_row_id
       where closure.nested_depth >= 10
         and exists (select 1 from platform_private.cms_pattern_refs(nested_pattern.block_tree))
    ) then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
  else
    select definition.id into block_row
      from platform_private.cms_block_definition_versions definition
     where definition.block_key = stored.block_key
       and definition.block_version = stored.block_version
       and definition.state = 'registered';
    if not found then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    block_ids := pg_catalog.array_append(block_ids, block_row.id);
  end if;
  select coalesce(pg_catalog.array_agg(member order by member), '{}'::uuid[]) into pattern_ids
    from (select distinct member from pg_catalog.unnest(pattern_ids) member) unique_members;
  select coalesce(pg_catalog.array_agg(member order by member), '{}'::uuid[]) into block_ids
    from (select distinct member from pg_catalog.unnest(block_ids) member) unique_members;
  for ref_id in select member from pg_catalog.unnest(pattern_ids) member loop
    kind := 'pattern';
    return next;
  end loop;
  for ref_id in select member from pg_catalog.unnest(block_ids) member loop
    kind := 'block';
    return next;
  end loop;
end;
$body$;

-- Transfer ownership without leaving schema CREATE at rest, then deny API roles.
do $owner$
declare
  had_create boolean := pg_catalog.has_schema_privilege(
    'wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then
    grant create on schema platform_private to wejammin_cms_definer;
  end if;
  alter function platform_private.cms_restore_composition_heads(uuid)
    owner to wejammin_cms_definer;
  alter function platform_private.cms_restore_composition_refs(
    platform_private.cms_composition_instances) owner to wejammin_cms_definer;
  if not had_create then
    revoke create on schema platform_private from wejammin_cms_definer;
  end if;
end;
$owner$;
revoke all on function platform_private.cms_restore_composition_heads(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_restore_composition_refs(
  platform_private.cms_composition_instances)
  from public, anon, authenticated, service_role;

do $guard$
declare
  proc pg_catalog.pg_proc%rowtype;
  signature text;
  callee regprocedure;
  is_heads boolean;
begin
  foreach signature in array array[
    'platform_private.cms_restore_composition_heads(uuid)',
    'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)'
  ] loop
    callee := pg_catalog.to_regprocedure(signature);
    select item.* into proc
      from pg_catalog.pg_proc item where item.oid = callee;
    is_heads := signature like '%heads(uuid)%';
    if not found
       or proc.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
       or proc.prosecdef or proc.prokind <> 'f' or not proc.proretset
       or proc.pronargs <> 1 or proc.pronargdefaults <> 0
       or proc.provolatile <> 's'
       or proc.prorettype <> (case when is_heads then
         'platform_private.cms_composition_instances'::pg_catalog.regtype
         else 'record'::pg_catalog.regtype end)
       or proc.proconfig is distinct from array['search_path=""']::text[]
       or proc.prolang <> (select language.oid from pg_catalog.pg_language language
          where language.lanname = case when is_heads then 'sql' else 'plpgsql' end)
       or (select pg_catalog.count(*) from pg_catalog.pg_proc item
         where item.pronamespace = proc.pronamespace and item.proname = proc.proname) <> 1
       or exists (select 1 from pg_catalog.aclexplode(proc.proacl) acl where acl.grantee = 0)
       or pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE') then
      raise exception 'restore composition heads/refs attributes or ACL changed: %', signature
        using errcode = '55000';
    end if;
  end loop;
  foreach signature in array array[
    'platform_private.cms_pattern_update_nodes(uuid,jsonb,uuid[],boolean,text,text,integer)',
    'platform_private.cms_pattern_nested_closure(uuid,jsonb)',
    'platform_private.cms_pattern_refs(jsonb)',
    'platform_private.cms_detached_tree_valid(jsonb)'
  ] loop
    callee := pg_catalog.to_regprocedure(signature);
    if callee is null
       or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee, 'EXECUTE') then
      raise exception 'restore composition refs dependency unavailable: %', signature
        using errcode = '55000';
    end if;
  end loop;
  foreach signature in array array[
    'platform_private.cms_composition_instances',
    'platform_private.cms_entry_revisions',
    'platform_private.cms_template_versions',
    'platform_private.cms_pattern_versions',
    'platform_private.cms_block_definition_versions'
  ] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', signature, 'SELECT') then
      raise exception 'restore composition refs source unavailable: %', signature
        using errcode = '55000';
    end if;
  end loop;
end;
$guard$;
commit;
